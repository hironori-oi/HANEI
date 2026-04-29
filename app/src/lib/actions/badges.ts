"use server";

/**
 * HANEI - Badge Server Actions / Resolvers (W9-C)
 *
 * /badges ページ (Server Component) と submitAnswer hook から呼ばれる:
 *   - resolveBadgeStats: stats 集計 (純関数 isBadgeAchieved 用)
 *   - resolveEarnedBadges: user_badges から取得済 BadgeCode 一覧
 *   - awardNewlyEarnedBadges: stats 比較 → 新規 INSERT (副作用あり)
 *
 * 三層認可:
 *   - 全 SQL に learner_id スコープ条件
 *   - 呼び出し側で requireAuth + requireLearnerOwner 済みである前提
 *   - 念のため learnerId と一致しない user_badges/answer_logs は SQL で除外
 *
 * 不変条件:
 *   - badges.code は ALL_BADGE_CODES と同期 (seed が前提)
 *   - mastery skill は "vocabulary"/"grammar"/"reading"/"listening" の 4 種固定
 */

import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import {
  answerLogs,
  badges,
  mockExamResults,
  problems,
  streaks,
  userBadges,
} from "@/lib/db/schema";
import {
  ALL_BADGE_CODES,
  isBadgeCode,
  type BadgeCode,
} from "@/lib/badges/badge-codes";
import {
  checkBadgeAchievements,
  type LearnerBadgeStats,
  type SkillMasteryCounts,
} from "@/lib/badges/badge-engine";

// ---------------------------------------------------------------------------
// 1. Stats 集計 (4 スキル × answer_logs.is_correct distinct problemId)
// ---------------------------------------------------------------------------

const SKILLS = ["vocabulary", "grammar", "reading", "listening"] as const;

/**
 * learner の現在 LearnerBadgeStats を集計する。
 * - totalAnswerCount = answer_logs 件数
 * - currentStreak = streaks.current_streak
 * - skillMasteryCounts.<skill> = 当該スキル prefix を持つ problemId で is_correct=true distinct
 * - mockExamCount = mock_exam_results 件数
 */
export async function resolveBadgeStats(
  learnerId: string,
): Promise<LearnerBadgeStats> {
  const [
    totalRows,
    streakRows,
    mockRows,
    masteryRows,
  ] = await Promise.all([
    // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / 呼び出し側で requireLearnerOwner 済
    db
      .select({ cnt: sql<number>`COUNT(*)` })
      .from(answerLogs)
      .where(eq(answerLogs.learnerId, learnerId)),
    // eslint-disable-next-line no-restricted-syntax -- 同上
    db
      .select({ s: streaks.currentStreak })
      .from(streaks)
      .where(eq(streaks.learnerId, learnerId))
      .limit(1),
    // eslint-disable-next-line no-restricted-syntax -- 同上
    db
      .select({ cnt: sql<number>`COUNT(*)` })
      .from(mockExamResults)
      .where(eq(mockExamResults.learnerId, learnerId)),
    Promise.all(
      SKILLS.map((skill) =>
        // eslint-disable-next-line no-restricted-syntax -- 同上 / problems は public マスタ
        db
          .select({
            cnt: sql<number>`COUNT(DISTINCT ${answerLogs.problemId})`,
          })
          .from(answerLogs)
          .innerJoin(problems, eq(problems.id, answerLogs.problemId))
          .where(
            and(
              eq(answerLogs.learnerId, learnerId),
              eq(answerLogs.isCorrect, true),
              // skillId は "<skill>-<level>" の形式 (例 "vocabulary-3")
              sql`${problems.skillId} LIKE ${skill + "-%"}`,
            ),
          ),
      ),
    ),
  ]);

  const totalAnswerCount = Number(totalRows[0]?.cnt ?? 0);
  const currentStreak = Number(streakRows[0]?.s ?? 0);
  const mockExamCount = Number(mockRows[0]?.cnt ?? 0);

  const skillMasteryCounts: SkillMasteryCounts = {
    vocabulary: Number(masteryRows[0]?.[0]?.cnt ?? 0),
    grammar: Number(masteryRows[1]?.[0]?.cnt ?? 0),
    reading: Number(masteryRows[2]?.[0]?.cnt ?? 0),
    listening: Number(masteryRows[3]?.[0]?.cnt ?? 0),
  };

  return {
    totalAnswerCount,
    currentStreak,
    skillMasteryCounts,
    mockExamCount,
  };
}

// ---------------------------------------------------------------------------
// 2. 取得済 badges 一覧
// ---------------------------------------------------------------------------

export interface EarnedBadgeRow {
  code: BadgeCode;
  earnedAtSec: number;
}

/**
 * 既取得 badges を earned_at desc で返す。未知コードは除外。
 */
export async function resolveEarnedBadges(
  learnerId: string,
): Promise<EarnedBadgeRow[]> {
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / 呼び出し側で requireLearnerOwner 済
  const rows = await db
    .select({
      code: badges.code,
      earnedAt: userBadges.earnedAt,
    })
    .from(userBadges)
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .where(eq(userBadges.learnerId, learnerId));

  const result: EarnedBadgeRow[] = [];
  for (const r of rows) {
    if (!isBadgeCode(r.code)) continue;
    const at = r.earnedAt instanceof Date
      ? Math.floor(r.earnedAt.getTime() / 1000)
      : Number(r.earnedAt) || 0;
    result.push({ code: r.code, earnedAtSec: at });
  }
  // 取得日昇順 (古 → 新) → 表示側で必要に応じ並べ替え
  result.sort((a, b) => a.earnedAtSec - b.earnedAtSec);
  return result;
}

// ---------------------------------------------------------------------------
// 3. 新規付与 (副作用あり)
// ---------------------------------------------------------------------------

export interface AwardBadgesResult {
  newlyEarned: BadgeCode[];
  allEarned: BadgeCode[];
}

/**
 * stats から判定し、未取得かつ達成済の badges を user_badges に INSERT する。
 *
 * - badges.code → badges.id の解決は in-memory map 経由 (1 query)
 * - 既取得チェックは alreadyEarned 引数 (resolveEarnedBadges 結果) で行う
 * - INSERT は uniqueIndex 違反を ON CONFLICT DO NOTHING で握る
 *
 * 呼び出し側 (submitAnswer 後) は newlyEarned を return → クライアント modal 表示。
 */
export async function awardNewlyEarnedBadges(
  learnerId: string,
  stats: LearnerBadgeStats,
): Promise<AwardBadgesResult> {
  const earnedRows = await resolveEarnedBadges(learnerId);
  const alreadyEarned = earnedRows.map((r) => r.code);
  const { newlyEarned, allEarned } = checkBadgeAchievements(
    learnerId,
    stats,
    alreadyEarned,
  );
  if (newlyEarned.length === 0) {
    return { newlyEarned: [], allEarned };
  }

  // code → id 解決
  // eslint-disable-next-line no-restricted-syntax -- public マスタ参照 (family 横断ではない)
  const masterRows = await db
    .select({ id: badges.id, code: badges.code })
    .from(badges);
  const codeToId = new Map<string, string>(
    masterRows.map((r) => [r.code, r.id]),
  );

  for (const code of newlyEarned) {
    const badgeId = codeToId.get(code);
    if (!badgeId) continue; // seed 未投入のコードは skip (本番は seed 必須)
    try {
      await db.insert(userBadges).values({
        id: `ub_${randomUUID()}`,
        learnerId,
        badgeId,
      });
    } catch {
      // uniqueIndex 違反は無視 (race / 二重実行)
    }
  }
  return { newlyEarned, allEarned };
}

// ---------------------------------------------------------------------------
// 4. 表示用バンドル (Server Component で 1 await)
// ---------------------------------------------------------------------------

export interface BadgesPageData {
  stats: LearnerBadgeStats;
  earned: EarnedBadgeRow[];
  /** 全 8 種を含む、表示用 (allEarned ⊂ ALL_BADGE_CODES) */
  allCodes: ReadonlyArray<BadgeCode>;
}

export async function loadBadgesPageData(
  learnerId: string,
): Promise<BadgesPageData> {
  const [stats, earned] = await Promise.all([
    resolveBadgeStats(learnerId),
    resolveEarnedBadges(learnerId),
  ]);
  return { stats, earned, allCodes: ALL_BADGE_CODES };
}
