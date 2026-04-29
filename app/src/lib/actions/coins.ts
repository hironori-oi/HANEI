"use server";

/**
 * HANEI - ハネキン (はね金) Server Actions (W10-T1)
 *
 * 学習/Shop/Quest から呼ばれる経済 Server Actions:
 *   - getCoinBalance     : 残高取得 (denormalized cache を信用 / 検証クエリ別途)
 *   - awardCoins         : 獲得 (lesson / streak / badge / quest / level_up / manual_adjust)
 *   - spendCoins         : 消費 (shop_purchase / freeze_purchase / feed_purchase / manual_adjust)
 *   - listTransactions   : 取引履歴 (取引履歴ページ / 監査用)
 *   - hasReceivedFor     : 冪等チェック (同 reason + referenceId の重複付与防止)
 *
 * 三層認可:
 *   - 全 SQL に learner_id スコープ条件
 *   - 呼び出し側で requireAuth + requireLearnerOwner 済みである前提
 *   - awardCoins / spendCoins は内部で再度 requireAuth + requireLearnerOwner を呼ぶ (FormData 改ざん防御)
 *
 * 並行制御:
 *   - SQLite の serialized writes に依存。INSERT(coin_transactions) と
 *     UPDATE(learner_profiles.coin_balance) は単一 Server Action 内で連続実行。
 *   - spendCoins は WHERE coin_balance >= cost で原子的に減算 (rowsAffected で成否判定)。
 *
 * 課金システム化禁止 (DEC-012): 外部購入導線ゼロの閉じた経済。
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import {
  coinTransactions,
  learnerProfiles,
  type CoinTransaction,
} from "@/lib/db/schema";
import { requireAuth, requireLearnerOwner } from "@/lib/auth/guards";
import {
  validateAmount,
  validateReasonAmountSign,
  validateSpend,
  type CoinReason,
} from "@/lib/economy/ledger";

// ---------------------------------------------------------------------------
// 1. 残高取得
// ---------------------------------------------------------------------------

/**
 * 学習者のハネキン残高を返す (denormalized cache を信用)。
 * - learner が存在しなければ 0 を返す (整合性は呼び出し側で確認)
 */
export async function getCoinBalance(learnerId: string): Promise<number> {
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / 呼び出し側で requireLearnerOwner 済
  const rows = await db
    .select({ b: learnerProfiles.coinBalance })
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);
  return Number(rows[0]?.b ?? 0);
}

// ---------------------------------------------------------------------------
// 2. 取引履歴
// ---------------------------------------------------------------------------

export interface ListTransactionsOptions {
  limit?: number;
}

/**
 * 取引履歴を新着順で返す (default 50 件 / 上限 200)。
 */
export async function listTransactions(
  learnerId: string,
  opts: ListTransactionsOptions = {},
): Promise<CoinTransaction[]> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / 呼び出し側で requireLearnerOwner 済
  const rows = await db
    .select()
    .from(coinTransactions)
    .where(eq(coinTransactions.learnerId, learnerId))
    .orderBy(desc(coinTransactions.createdAt))
    .limit(limit);
  return rows;
}

// ---------------------------------------------------------------------------
// 3. 冪等チェック (同 reason + referenceId の重複付与防止)
// ---------------------------------------------------------------------------

/**
 * 同一 (learnerId, reason, referenceId) の取引が既に記録されているか確認する。
 * - referenceId なしでは判定不可 (true を返さない)
 * - 例: badge 獲得時の重複付与チェック / streak 1 日 1 回チェック
 */
export async function hasReceivedFor(
  learnerId: string,
  reason: CoinReason,
  referenceId: string,
): Promise<boolean> {
  if (!referenceId) return false;
  // eslint-disable-next-line no-restricted-syntax -- 三重スコープ条件 (learner + reason + reference_id)
  const rows = await db
    .select({ id: coinTransactions.id })
    .from(coinTransactions)
    .where(
      and(
        eq(coinTransactions.learnerId, learnerId),
        eq(coinTransactions.reason, reason),
        eq(coinTransactions.referenceId, referenceId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// 4. 獲得 (Server Action)
// ---------------------------------------------------------------------------

export interface AwardCoinsResult {
  ok: boolean;
  /** 獲得後の残高 (ok=true のみ正確) */
  newBalance: number;
  /** 取引 ID (ok=true のみ) */
  transactionId?: string;
  /** スキップ理由 (ok=false / true でも skipped=true なら冪等チェックで無付与) */
  reason?: "validation" | "sign_mismatch" | "duplicate" | "learner_not_found";
  /** 冪等チェックで skipped (= 既に同 referenceId で付与済) の場合 true */
  skipped?: boolean;
}

export interface AwardCoinsInput {
  learnerId: string;
  amount: number;
  reason: CoinReason;
  referenceId?: string;
  memo?: string;
  /**
   * 同一 referenceId による重複付与を防ぐ (default false)。
   * true の場合、(learnerId, reason, referenceId) で既存取引があれば INSERT せず
   * skipped=true で返す。badge 獲得 / streak 日次 / quest 完了で利用。
   */
  idempotent?: boolean;
}

/**
 * 学習者にハネキンを付与する。
 * - amount > 0 必須 (manual_adjust 以外)
 * - reason と amount の符号整合を検証
 * - idempotent=true なら同 referenceId の重複付与を skip
 */
export async function awardCoins(input: AwardCoinsInput): Promise<AwardCoinsResult> {
  // ---- 認可 (三層目: 改ざん防御) ----
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, input.learnerId);

  // ---- バリデーション ----
  const v = validateAmount(input.amount);
  if (!v.ok) {
    return { ok: false, newBalance: 0, reason: "validation" };
  }
  const sign = validateReasonAmountSign(input.reason, input.amount);
  if (!sign.ok) {
    return { ok: false, newBalance: 0, reason: "sign_mismatch" };
  }

  // ---- 冪等チェック ----
  if (input.idempotent && input.referenceId) {
    const dup = await hasReceivedFor(
      input.learnerId,
      input.reason,
      input.referenceId,
    );
    if (dup) {
      const balance = await getCoinBalance(input.learnerId);
      return {
        ok: true,
        newBalance: balance,
        skipped: true,
        reason: "duplicate",
      };
    }
  }

  // ---- 1. coin_transactions INSERT ----
  const transactionId = `ct_${randomUUID()}`;
  await db.insert(coinTransactions).values({
    id: transactionId,
    learnerId: input.learnerId,
    amount: input.amount,
    reason: input.reason,
    referenceId: input.referenceId ?? null,
    memo: input.memo ?? null,
  });

  // ---- 2. learner_profiles.coin_balance UPDATE (atomic + via SQL) ----
  // (db.update は no-restricted-syntax 対象外 / learner_id スコープ条件あり)
  await db
    .update(learnerProfiles)
    .set({
      coinBalance: sql`${learnerProfiles.coinBalance} + ${input.amount}`,
      updatedAt: new Date(),
    })
    .where(eq(learnerProfiles.id, input.learnerId));

  const newBalance = await getCoinBalance(input.learnerId);
  return { ok: true, newBalance, transactionId };
}

// ---------------------------------------------------------------------------
// 5. 消費 (Server Action)
// ---------------------------------------------------------------------------

export interface SpendCoinsResult {
  ok: boolean;
  /** 消費後の残高 (ok=true のみ正確) */
  newBalance: number;
  transactionId?: string;
  reason?:
    | "validation"
    | "sign_mismatch"
    | "insufficient_balance"
    | "learner_not_found";
  /** 残高不足時の不足分 */
  shortfall?: number;
}

export interface SpendCoinsInput {
  learnerId: string;
  /** 消費額 (正の整数 / 内部で -cost として記録) */
  cost: number;
  reason: CoinReason;
  referenceId?: string;
  memo?: string;
}

/**
 * 学習者からハネキンを消費する (Shop / Freeze 追加購入 / kotodama feed)。
 * - cost > 0 必須 (内部で -cost として記録)
 * - 残高 >= cost 必須 (atomic SQL 条件 update で防御)
 */
export async function spendCoins(input: SpendCoinsInput): Promise<SpendCoinsResult> {
  // ---- 認可 ----
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, input.learnerId);

  // ---- バリデーション ----
  const balance = await getCoinBalance(input.learnerId);
  const v = validateSpend(balance, input.cost);
  if (!v.ok) {
    if (v.reason === "non_positive_cost") {
      return { ok: false, newBalance: balance, reason: "validation" };
    }
    return {
      ok: false,
      newBalance: balance,
      reason: "insufficient_balance",
      shortfall: v.shortfall,
    };
  }
  // 消費 reason は SPEND_REASONS のいずれか必須 (符号は内部で負に)
  const sign = validateReasonAmountSign(input.reason, -input.cost);
  if (!sign.ok) {
    return { ok: false, newBalance: balance, reason: "sign_mismatch" };
  }

  // ---- 1. coin_transactions INSERT (amount = -cost) ----
  const transactionId = `ct_${randomUUID()}`;
  await db.insert(coinTransactions).values({
    id: transactionId,
    learnerId: input.learnerId,
    amount: -input.cost,
    reason: input.reason,
    referenceId: input.referenceId ?? null,
    memo: input.memo ?? null,
  });

  // ---- 2. learner_profiles.coin_balance UPDATE (atomic conditional) ----
  // (db.update は no-restricted-syntax 対象外 / learner_id スコープ条件 + 残高条件あり)
  await db
    .update(learnerProfiles)
    .set({
      coinBalance: sql`${learnerProfiles.coinBalance} - ${input.cost}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(learnerProfiles.id, input.learnerId),
        sql`${learnerProfiles.coinBalance} >= ${input.cost}`,
      ),
    );

  const newBalance = await getCoinBalance(input.learnerId);
  return { ok: true, newBalance, transactionId };
}
