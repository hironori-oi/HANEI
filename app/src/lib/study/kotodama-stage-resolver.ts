/**
 * HANEI - ことだまトリ Stage Resolver (W9-T1 / DB クエリ層)
 *
 * 「現在の learner」から KotodamaStageInput を作るための DB クエリ層。
 * - kotodama-tori-stage.ts は純関数のみで DB 依存ゼロ
 * - 本モジュールは Drizzle 経由で集計し、画面側に渡しやすい型に変換する
 *
 * 三層認可: 呼び出し側が requireAuth + requireLearnerOwner を済ませている前提。
 * (本モジュール内では追加の認可は行わない / SQL 条件で learner_id を必ず指定する)
 */

import { eq } from "drizzle-orm";
import { xpLevels, streaks, userBadges, badges } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import type { KotodamaStageInput } from "@/lib/study/kotodama-tori-stage";

/**
 * learner の kotodama-stage 計算に必要な統計を一括取得する。
 *
 * - totalXp: xp_levels.total_xp (未登録 = 0)
 * - currentStreak: streaks.current_streak (未登録 = 0)
 * - badgeCount: user_badges count
 * - badgeCodes: 取得済 badges.code 配列
 */
export async function getKotodamaStageInput(
  db: Db,
  learnerId: string,
): Promise<KotodamaStageInput> {
  const [xpRows, streakRows, badgeRows] = await Promise.all([
    // eslint-disable-next-line no-restricted-syntax -- 同上
    db
      .select({ totalXp: xpLevels.totalXp })
      .from(xpLevels)
      .where(eq(xpLevels.learnerId, learnerId))
      .limit(1),
    // eslint-disable-next-line no-restricted-syntax -- 同上
    db
      .select({ currentStreak: streaks.currentStreak })
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

  const totalXp = xpRows[0]?.totalXp ?? 0;
  const currentStreak = streakRows[0]?.currentStreak ?? 0;
  const badgeCodes = badgeRows.map((r) => r.code);

  return {
    totalXp,
    currentStreak,
    badgeCount: badgeCodes.length,
    badgeCodes,
  };
}
