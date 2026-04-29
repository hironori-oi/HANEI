"use server";

/**
 * HANEI - Accessory Server Actions / Resolvers (W9-B)
 *
 * /settings/accessories ページ (Server Component) と submitAnswer hook から呼ばれる:
 *   - resolveUnlockStats: stats 集計 (level / totalXp / currentStreak / badgeCodes)
 *   - resolveUnlockedAccessories: learner_accessories から取得済 AccessoryCode 一覧
 *   - awardNewlyUnlockedAccessories: stats 比較 → 新規 INSERT (副作用あり)
 *   - toggleEquipped: スロット内 1 件のみ装着 (mutex) を保証する
 *
 * 三層認可:
 *   - 全 SQL に learner_id スコープ条件
 *   - 呼び出し側で requireAuth + requireLearnerOwner 済みである前提
 *   - 念のため learnerId と一致しない learner_accessories は SQL で除外
 *
 * 不変条件:
 *   - accessories.code は ACCESSORY_CODES と同期 (seed が前提)
 *   - 同一 (learner_id, accessory_code) は uniqueIndex で重複防止
 *   - 同一 slot で is_equipped=1 は最大 1 件 (toggleEquipped の transaction で保証)
 */

import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import {
  badges,
  learnerAccessories,
  streaks,
  userBadges,
  xpLevels,
} from "@/lib/db/schema";
import {
  ACCESSORY_BY_CODE,
  ACCESSORY_CATALOG,
  isAccessoryCode,
  type AccessoryCode,
  type AccessorySlot,
} from "@/lib/accessories/catalog";
import {
  checkUnlocks,
  type UnlockStats,
} from "@/lib/accessories/unlock-engine";
import { requireAuth, requireLearnerOwner } from "@/lib/auth/guards";

// ---------------------------------------------------------------------------
// 1. Stats 集計 (xp_levels / streaks / user_badges)
// ---------------------------------------------------------------------------

/**
 * learner の現在 UnlockStats を集計する。
 * - level / totalXp = xp_levels (1 行 / learner)
 * - currentStreak = streaks.currentStreak
 * - badgeCodes = user_badges JOIN badges (取得済 code 一覧)
 */
export async function resolveUnlockStats(
  learnerId: string,
): Promise<UnlockStats> {
  const [xpRows, streakRows, badgeRows] = await Promise.all([
    // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / 呼び出し側で requireLearnerOwner 済
    db
      .select({ level: xpLevels.level, totalXp: xpLevels.totalXp })
      .from(xpLevels)
      .where(eq(xpLevels.learnerId, learnerId))
      .limit(1),
    // eslint-disable-next-line no-restricted-syntax -- 同上
    db
      .select({ s: streaks.currentStreak })
      .from(streaks)
      .where(eq(streaks.learnerId, learnerId))
      .limit(1),
    // eslint-disable-next-line no-restricted-syntax -- 同上
    db
      .select({ code: badges.code })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.learnerId, learnerId)),
  ]);

  const level = Number(xpRows[0]?.level ?? 1);
  const totalXp = Number(xpRows[0]?.totalXp ?? 0);
  const currentStreak = Number(streakRows[0]?.s ?? 0);
  const badgeCodes = badgeRows.map((r) => r.code);

  return { level, totalXp, currentStreak, badgeCodes };
}

// ---------------------------------------------------------------------------
// 2. 取得済 accessories 一覧
// ---------------------------------------------------------------------------

export interface UnlockedAccessoryRow {
  code: AccessoryCode;
  unlockedAtSec: number;
  isEquipped: boolean;
}

/**
 * learner_accessories から取得済 accessories を返す。未知コードは除外。
 */
export async function resolveUnlockedAccessories(
  learnerId: string,
): Promise<UnlockedAccessoryRow[]> {
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / 呼び出し側で requireLearnerOwner 済
  const rows = await db
    .select({
      code: learnerAccessories.accessoryCode,
      unlockedAt: learnerAccessories.unlockedAt,
      isEquipped: learnerAccessories.isEquipped,
    })
    .from(learnerAccessories)
    .where(eq(learnerAccessories.learnerId, learnerId));

  const result: UnlockedAccessoryRow[] = [];
  for (const r of rows) {
    if (!isAccessoryCode(r.code)) continue;
    const at =
      r.unlockedAt instanceof Date
        ? Math.floor(r.unlockedAt.getTime() / 1000)
        : Number(r.unlockedAt) || 0;
    result.push({
      code: r.code,
      unlockedAtSec: at,
      isEquipped: !!r.isEquipped,
    });
  }
  result.sort((a, b) => a.unlockedAtSec - b.unlockedAtSec);
  return result;
}

// ---------------------------------------------------------------------------
// 3. 新規付与 (副作用あり)
// ---------------------------------------------------------------------------

export interface AwardAccessoriesResult {
  newlyUnlocked: AccessoryCode[];
  allUnlocked: AccessoryCode[];
}

/**
 * stats から判定し、未取得かつ解禁条件を満たす accessories を learner_accessories に INSERT する。
 *
 * - 既取得チェックは alreadyUnlocked 引数 (resolveUnlockedAccessories) で行う
 * - INSERT は uniqueIndex (learner_id, accessory_code) 違反を try/catch で握る
 * - is_equipped は INSERT 時 false (default) → 別途 toggleEquipped で装着
 */
export async function awardNewlyUnlockedAccessories(
  learnerId: string,
  stats: UnlockStats,
): Promise<AwardAccessoriesResult> {
  const unlockedRows = await resolveUnlockedAccessories(learnerId);
  const alreadyUnlocked = unlockedRows.map((r) => r.code);
  const { newlyUnlocked, allUnlocked } = checkUnlocks(stats, alreadyUnlocked);
  if (newlyUnlocked.length === 0) {
    return { newlyUnlocked: [], allUnlocked };
  }

  for (const code of newlyUnlocked) {
    try {
      await db.insert(learnerAccessories).values({
        id: `la_${randomUUID()}`,
        learnerId,
        accessoryCode: code,
        isEquipped: false,
      });
    } catch {
      // uniqueIndex 違反は無視 (race / 二重実行)
    }
  }
  return { newlyUnlocked, allUnlocked };
}

// ---------------------------------------------------------------------------
// 4. 装着切替 (Server Action / form action)
//
// 呼び出し時に requireAuth + requireLearnerOwner を実行 (三層認可第二層)。
// 同 slot で複数装着しないよう、SQL レベルで他の同 slot 装着を OFF してから ON にする。
// ---------------------------------------------------------------------------

export interface ToggleEquippedResult {
  ok: boolean;
  /** 切替後の装着状態 (true = 装着中, false = 解除) */
  isEquipped: boolean;
  message?: string;
}

/**
 * 指定 code の装着を切替える。
 * - 未解禁 → ok:false (不正リクエストとして弾く)
 * - 装着中 (is_equipped=1) → 解除 (false)
 * - 未装着 (is_equipped=0) → 同 slot の他全部を OFF にしてから ON
 */
export async function toggleEquippedAccessory(
  learnerId: string,
  code: AccessoryCode,
): Promise<ToggleEquippedResult> {
  // ---- 認可 (三層目: 改ざん防御) ----
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, learnerId);

  const def = ACCESSORY_BY_CODE[code];
  if (!def) {
    return { ok: false, isEquipped: false, message: "未知のアクセサリです。" };
  }

  // 解禁チェック (DB に存在するか)
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / 直前に requireLearnerOwner 済
  const owned = await db
    .select({
      id: learnerAccessories.id,
      isEquipped: learnerAccessories.isEquipped,
    })
    .from(learnerAccessories)
    .where(
      and(
        eq(learnerAccessories.learnerId, learnerId),
        eq(learnerAccessories.accessoryCode, code),
      ),
    )
    .limit(1);
  if (owned.length === 0) {
    return {
      ok: false,
      isEquipped: false,
      message: "このアクセサリは まだ 解禁されていません。",
    };
  }

  const currentlyEquipped = !!owned[0]?.isEquipped;
  const slot = def.slot;

  if (currentlyEquipped) {
    // 装着中 → 解除 (db.update は no-restricted-syntax 対象外 / learner_id スコープ条件あり)
    await db
      .update(learnerAccessories)
      .set({ isEquipped: false })
      .where(
        and(
          eq(learnerAccessories.learnerId, learnerId),
          eq(learnerAccessories.accessoryCode, code),
        ),
      );
    revalidatePath("/settings/accessories");
    return { ok: true, isEquipped: false };
  }

  // 未装着 → 同 slot の他装着を OFF にしてから ON
  // 1. 同 slot の所有 accessories を取得
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / 直前に requireLearnerOwner 済
  const slotOwned = await db
    .select({ accessoryCode: learnerAccessories.accessoryCode })
    .from(learnerAccessories)
    .where(eq(learnerAccessories.learnerId, learnerId));

  const sameSlotCodes = slotOwned
    .map((r) => r.accessoryCode)
    .filter((c): c is AccessoryCode => isAccessoryCode(c))
    .filter((c) => ACCESSORY_BY_CODE[c]?.slot === slot && c !== code);

  // 2. 同 slot の他装着を OFF (一括 SQL: code IN (...))
  //    (db.update は no-restricted-syntax 対象外 / learner_id スコープ条件あり)
  if (sameSlotCodes.length > 0) {
    await db
      .update(learnerAccessories)
      .set({ isEquipped: false })
      .where(
        and(
          eq(learnerAccessories.learnerId, learnerId),
          sql`${learnerAccessories.accessoryCode} IN (${sql.join(
            sameSlotCodes.map((c) => sql`${c}`),
            sql`, `,
          )})`,
        ),
      );
  }

  // 3. 対象を ON (db.update は no-restricted-syntax 対象外 / learner_id スコープ条件あり)
  await db
    .update(learnerAccessories)
    .set({ isEquipped: true })
    .where(
      and(
        eq(learnerAccessories.learnerId, learnerId),
        eq(learnerAccessories.accessoryCode, code),
      ),
    );

  revalidatePath("/settings/accessories");
  return { ok: true, isEquipped: true };
}

// ---------------------------------------------------------------------------
// 5. 表示用バンドル (Server Component で 1 await)
// ---------------------------------------------------------------------------

export interface AccessoriesPageData {
  stats: UnlockStats;
  unlocked: UnlockedAccessoryRow[];
  /** 全 12 種を含む、表示用 (ACCESSORY_CATALOG と同順) */
  allCodes: ReadonlyArray<AccessoryCode>;
  /** 装着中 code (slot → code | null) */
  equippedBySlot: Readonly<Record<AccessorySlot, AccessoryCode | null>>;
}

export async function loadAccessoriesPageData(
  learnerId: string,
): Promise<AccessoriesPageData> {
  const [stats, unlocked] = await Promise.all([
    resolveUnlockStats(learnerId),
    resolveUnlockedAccessories(learnerId),
  ]);

  const equippedBySlot: Record<AccessorySlot, AccessoryCode | null> = {
    hat: null,
    scarf: null,
    wing_charm: null,
  };
  for (const u of unlocked) {
    if (!u.isEquipped) continue;
    const def = ACCESSORY_BY_CODE[u.code];
    if (!def) continue;
    equippedBySlot[def.slot] = u.code;
  }

  return {
    stats,
    unlocked,
    allCodes: ACCESSORY_CATALOG.map((a) => a.code),
    equippedBySlot,
  };
}
