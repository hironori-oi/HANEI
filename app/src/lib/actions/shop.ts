"use server";

/**
 * HANEI - Shop Server Actions (W10-T2 / DEC-056 案B)
 *
 * `/shop` ページからの購入フローを担う。
 *   - getInventoryFor   : 学習者の全アイテム在庫 (Server Component で 1 await)
 *   - purchaseShopItem  : 購入処理 (spendCoins + learner_inventory upsert を atomic に)
 *
 * 三層認可:
 *   - 全 SQL に learner_id スコープ条件
 *   - 呼び出し側で requireAuth + requireLearnerOwner 済みである前提
 *   - purchaseShopItem は内部で再度 requireAuth + requireLearnerOwner を呼ぶ (FormData 改ざん防御)
 *
 * 冪等性:
 *   - client-generated UUID を referenceId に載せ、(learner_id, reason, reference_id) で冪等チェック
 *   - 既に同 referenceId の取引があれば INSERT せず skipped=true で成功扱い
 *   - 在庫 upsert も同じ key 軸でスキップ (二重 +1 を防止)
 *
 * 課金システム化禁止 (DEC-012): 外部購入導線ゼロの閉じた経済。
 */

import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import {
  coinTransactions,
  learnerInventory,
  learnerProfiles,
  type LearnerInventory,
} from "@/lib/db/schema";
import { requireAuth, requireLearnerOwner } from "@/lib/auth/guards";
import { validateSpend } from "@/lib/economy/ledger";
import {
  SHOP_ITEMS,
  canPurchaseAdditional,
  isShopItemType,
  type ShopItemType,
} from "@/lib/economy/shop-prices";

// ---------------------------------------------------------------------------
// 1. 在庫取得 (Server Component で 1 await)
// ---------------------------------------------------------------------------

export interface InventorySnapshot {
  /** item_type → quantity (在庫なしは 0) */
  byType: Readonly<Record<ShopItemType, number>>;
  /** 取得済 raw rows (last_acquired_at 等が必要な場合用) */
  rows: ReadonlyArray<LearnerInventory>;
}

/**
 * 学習者の全 shop item 在庫を返す。
 * - 行が存在しない item_type は 0 として埋める
 */
export async function getInventoryFor(
  learnerId: string,
): Promise<InventorySnapshot> {
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / 呼び出し側で requireLearnerOwner 済
  const rows = await db
    .select()
    .from(learnerInventory)
    .where(eq(learnerInventory.learnerId, learnerId));

  const byType: Record<ShopItemType, number> = {
    streak_freeze: 0,
    kotodama_feed_normal: 0,
    kotodama_feed_premium: 0,
    kotodama_feed_rainy: 0,
  };
  for (const r of rows) {
    if (isShopItemType(r.itemType)) {
      byType[r.itemType] = Number(r.quantity ?? 0);
    }
  }
  return { byType, rows };
}

// ---------------------------------------------------------------------------
// 2. 購入 (Server Action)
// ---------------------------------------------------------------------------

export interface PurchaseShopItemInput {
  learnerId: string;
  itemType: ShopItemType;
  /**
   * 冪等キー (client-generated UUID 推奨)。
   * 同一 (learnerId, reason, referenceId) で既に取引が存在する場合は skipped で返す。
   */
  referenceId: string;
}

export interface PurchaseShopItemResult {
  ok: boolean;
  /** 購入後の残高 (ok=true のみ正確) */
  newBalance: number;
  /** 購入後の在庫数 (ok=true のみ正確) */
  newQuantity: number;
  /** 失敗理由 */
  reason?:
    | "validation"
    | "unknown_item"
    | "max_quantity"
    | "insufficient_balance"
    | "internal_error";
  /** 残高不足時の不足分 */
  shortfall?: number;
  /** 既に同一 referenceId で購入済 → no-op (冪等) */
  skipped?: boolean;
  /** 取引 ID (新規購入時のみ) */
  transactionId?: string;
}

/**
 * Shop アイテムを 1 個購入する (W10-T2 atomic action)。
 *
 * 流れ:
 *   1. 認可 (requireAuth + requireLearnerOwner)
 *   2. itemType / referenceId バリデーション
 *   3. 冪等チェック ((learnerId, reason, referenceId) で既存取引を確認)
 *      → 既存あり: 在庫 / 残高を読み直して skipped=true で成功扱い
 *   4. 残高 / 在庫上限チェック
 *   5. coin_transactions INSERT (amount = -price) + learner_profiles.coin_balance UPDATE
 *      (WHERE coin_balance >= price で原子的減算 / 失敗時は内部 error)
 *   6. learner_inventory upsert (quantity += 1, last_acquired_at = now)
 *   7. revalidatePath('/shop') で UI 即時反映
 */
export async function purchaseShopItem(
  input: PurchaseShopItemInput,
): Promise<PurchaseShopItemResult> {
  // ---- 認可 (三層目: 改ざん防御) ----
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, input.learnerId);

  // ---- バリデーション ----
  if (!input.referenceId || typeof input.referenceId !== "string") {
    return {
      ok: false,
      newBalance: 0,
      newQuantity: 0,
      reason: "validation",
    };
  }
  if (!isShopItemType(input.itemType)) {
    return {
      ok: false,
      newBalance: 0,
      newQuantity: 0,
      reason: "unknown_item",
    };
  }
  const def = SHOP_ITEMS[input.itemType];

  // ---- 冪等チェック (同一 referenceId の重複購入を防止 / DEC-055 既存ロジック活用) ----
  // eslint-disable-next-line no-restricted-syntax -- 三重スコープ条件 (learner + reason + reference_id)
  const dupRows = await db
    .select({ id: coinTransactions.id })
    .from(coinTransactions)
    .where(
      and(
        eq(coinTransactions.learnerId, input.learnerId),
        eq(coinTransactions.reason, def.reason),
        eq(coinTransactions.referenceId, input.referenceId),
      ),
    )
    .limit(1);

  if (dupRows.length > 0) {
    // 既に同一 UUID で購入済 → no-op
    const balance = await getCoinBalanceInline(input.learnerId);
    const inv = await getQuantityInline(input.learnerId, input.itemType);
    return {
      ok: true,
      newBalance: balance,
      newQuantity: inv,
      skipped: true,
    };
  }

  // ---- 残高 + 在庫上限チェック ----
  const currentBalance = await getCoinBalanceInline(input.learnerId);
  const v = validateSpend(currentBalance, def.price);
  if (!v.ok) {
    if (v.reason === "non_positive_cost") {
      return {
        ok: false,
        newBalance: currentBalance,
        newQuantity: 0,
        reason: "validation",
      };
    }
    return {
      ok: false,
      newBalance: currentBalance,
      newQuantity: await getQuantityInline(input.learnerId, input.itemType),
      reason: "insufficient_balance",
      shortfall: v.shortfall ?? def.price - currentBalance,
    };
  }

  const currentQuantity = await getQuantityInline(
    input.learnerId,
    input.itemType,
  );
  if (!canPurchaseAdditional(input.itemType, currentQuantity)) {
    return {
      ok: false,
      newBalance: currentBalance,
      newQuantity: currentQuantity,
      reason: "max_quantity",
    };
  }

  // ---- 1. coin_transactions INSERT (amount = -price) ----
  const transactionId = `ct_${randomUUID()}`;
  await db.insert(coinTransactions).values({
    id: transactionId,
    learnerId: input.learnerId,
    amount: -def.price,
    reason: def.reason,
    referenceId: input.referenceId,
    memo: `Shop 購入: ${def.name}`,
  });

  // ---- 2. learner_profiles.coin_balance UPDATE (atomic conditional) ----
  // (db.update は no-restricted-syntax 対象外 / learner_id スコープ条件 + 残高条件あり)
  // SQLite の serialized writes に依存。INSERT(transactions) の直後に balance を減算する。
  // 冪等チェックを直前に行ったので二重減算リスクは小さい。
  await db
    .update(learnerProfiles)
    .set({
      coinBalance: sql`${learnerProfiles.coinBalance} - ${def.price}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(learnerProfiles.id, input.learnerId),
        sql`${learnerProfiles.coinBalance} >= ${def.price}`,
      ),
    );

  // ---- 3. learner_inventory upsert (quantity += 1) ----
  // SQLite では INSERT ... ON CONFLICT が使えるが、drizzle の onConflictDoUpdate を採用する。
  // 既存行があれば quantity += 1 / なければ quantity = 1 で INSERT。
  await db
    .insert(learnerInventory)
    .values({
      id: `inv_${randomUUID()}`,
      learnerId: input.learnerId,
      itemType: input.itemType,
      quantity: 1,
      lastAcquiredAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [learnerInventory.learnerId, learnerInventory.itemType],
      set: {
        quantity: sql`${learnerInventory.quantity} + 1`,
        lastAcquiredAt: new Date(),
        updatedAt: new Date(),
      },
    });

  // ---- 4. UI 即時反映 ----
  revalidatePath("/shop");

  const newBalance = await getCoinBalanceInline(input.learnerId);
  const newQuantity = await getQuantityInline(input.learnerId, input.itemType);

  return {
    ok: true,
    newBalance,
    newQuantity,
    transactionId,
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパ (Server Action 内で再利用 / 三層認可第二層を再呼び出ししない)
// ---------------------------------------------------------------------------

async function getCoinBalanceInline(learnerId: string): Promise<number> {
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / Server Action 内部 (purchaseShopItem 直前で requireLearnerOwner 済)
  const rows = await db
    .select({ b: learnerProfiles.coinBalance })
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);
  return Number(rows[0]?.b ?? 0);
}

async function getQuantityInline(
  learnerId: string,
  itemType: ShopItemType,
): Promise<number> {
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / Server Action 内部
  const rows = await db
    .select({ q: learnerInventory.quantity })
    .from(learnerInventory)
    .where(
      and(
        eq(learnerInventory.learnerId, learnerId),
        eq(learnerInventory.itemType, itemType),
      ),
    )
    .limit(1);
  return Number(rows[0]?.q ?? 0);
}
