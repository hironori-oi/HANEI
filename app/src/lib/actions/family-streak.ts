"use server";

/**
 * HANEI - Family Streak Server Actions (W11-T1 / 家族のれんぞく)
 *
 * 学習完了経路の終端で `updateFamilyStreakOnLearn(familyId)` を 1 回呼ぶ.
 * 同日 2 回目以降は no-op (兄弟救済の冪等性 / DEC-055).
 *
 * 三層認可 (DEC-003):
 *   - 第一層: middleware (proxy.ts)
 *   - 第二層: requireAuth + getFamilyIdForUser で「呼び出し元の user が familyId に属する」を確認
 *   - 第三層: SQL は family_id を必ず WHERE に含める / atomic UPDATE で他家族への副作用ゼロ
 *
 * 罰則ゼロ哲学 (DEC-024):
 *   - 本 action は streak / coin / xp に副作用なし.
 *   - hard_limit (60 分) で session が終わっても family_streak は減らない.
 *   - 切れた場合 (1 日以上空き) は 1 リセットのみ. 罰メッセージは UI 側で出さない.
 *
 * 冪等性 (DEC-055):
 *   - SELECT で現状を取得 → computeFamilyStreakRollover で次状態計算 →
 *     atomic UPDATE WHERE last_family_active_date IS NOT ? で同日 2 回目の書込を構造的に阻止.
 *   - 同日 2 回目は computeFamilyStreakRollover が shouldUpdate=false を返し SQL を発行しない.
 *
 * Turbopack 制約:
 *   - 本ファイルは "use server". sync export は禁止.
 *   - 純関数 computeFamilyStreakRollover は src/lib/study/family-streak-rollover.ts に切り出し済.
 */

import { eq, and, or, ne, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { families } from "@/lib/db/schema";
import { requireAuth, getFamilyIdForUser } from "@/lib/auth/guards";
import { getJstQuestDate } from "@/lib/quest/jst-date";
import { computeFamilyStreakRollover } from "@/lib/study/family-streak-rollover";

export interface UpdateFamilyStreakOnLearnResult {
  /** 更新後の家族 streak 日数 */
  familyStreakDays: number;
}

/**
 * 学習者が当日学習した瞬間に呼ぶ server action.
 *
 * - 同日 2 回目以降は computeFamilyStreakRollover が shouldUpdate=false を返し no-op.
 * - 連続日は +1, 1 日以上空きは 1 にリセット.
 * - learner.family_id は呼び出し元で取得済 (scopedQueries / requireLearnerOwner 経由).
 *
 * @param familyId - 学習者の所属する family の id
 * @param now      - テスト用に時刻を注入できる. 本番では new Date() を使う.
 */
export async function updateFamilyStreakOnLearn(
  familyId: string,
  now?: Date,
): Promise<UpdateFamilyStreakOnLearnResult> {
  if (!familyId || typeof familyId !== "string") {
    throw new TypeError("[family-streak] familyId is required");
  }

  // 三層認可: 呼び出し元 user が familyId に属することを確認 (横断防止)
  const session = await requireAuth();
  const userFamilyId = await getFamilyIdForUser(session.userId);
  if (userFamilyId !== familyId) {
    throw new Error(
      `[family-streak] requireFamilyMember: user ${session.userId} is not in family ${familyId}`,
    );
  }

  const todayDate = getJstQuestDate(now ?? new Date());

  // 1) 現状を SELECT
  // eslint-disable-next-line no-restricted-syntax -- family_id 単一スコープ済 (DEC-003)
  const rows = await db
    .select({
      familyStreakDays: families.familyStreakDays,
      lastFamilyActiveDate: families.lastFamilyActiveDate,
    })
    .from(families)
    .where(eq(families.id, familyId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(`[family-streak] family ${familyId} not found`);
  }

  const prev = {
    familyStreakDays: Math.max(0, row.familyStreakDays | 0),
    lastFamilyActiveDate: row.lastFamilyActiveDate ?? null,
  };

  // 2) 純関数で次状態計算
  const rollover = computeFamilyStreakRollover(prev, todayDate);

  // 3) shouldUpdate=false (同日 2 回目以降) は no-op
  if (!rollover.shouldUpdate) {
    return { familyStreakDays: prev.familyStreakDays };
  }

  // 4) atomic UPDATE: WHERE family_id = ? AND (last_family_active_date IS NULL OR <> todayDate)
  //    で同日 2 回目の書込を構造的に阻止 (DEC-055 / race-safe).
  //    SQLite/libSQL は IS DISTINCT FROM を持たないので isNull OR ne で表現.
  //    純関数側でも shouldUpdate=false で短絡しているが、複数 process race の保険として SQL 側にも貼る.
  await db
    .update(families)
    .set({
      familyStreakDays: rollover.newDays,
      lastFamilyActiveDate: todayDate,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(families.id, familyId),
        or(
          isNull(families.lastFamilyActiveDate),
          ne(families.lastFamilyActiveDate, todayDate),
        ),
      ),
    );

  return { familyStreakDays: rollover.newDays };
}
