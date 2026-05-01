/**
 * HANEI - Family Weekly Digest Read-only Helper (W11-T5 / 保護者ダッシュボード Card 版 Weekly Digest)
 *
 * Phase 2 W11-T5 (DEC-063): 保護者ダッシュボードに「今週の ハイライト」 Card を出すための
 * read-only server-only helper. 副作用無し / 新規テーブル無し / 新規 server action 無し.
 *
 * "use server" ではない通常の server-only モジュール:
 *   - Server Component (parent dashboard) から直接 import する.
 *   - 認可は呼び出し元で実施 (parent dashboard は requireParent + scopedQueries 済).
 *   - 本関数自体は SQL レベルで learner_profiles.family_id = ? を強制しているので
 *     家族間漏洩は構造的に防止済 (COPPA 準拠 / DEC-061 / DEC-003).
 *
 * 既存基盤の最大流用 (DEC-063):
 *   - getFamilyStreak(familyId)               (W11-T1)
 *   - getFamilyWeeklyLeaderboard(familyId)    (W11-T3)
 *   - 新規 SQL 1 系統のみ: 直近 7 日 (JST 6:00 境界) family scope の answer_logs × problems × skills
 *     を skill_id GROUP BY → COUNT(*) DESC → LIMIT 5 でトップ単元集計.
 *
 * DEC-024 罰則ゼロ哲学:
 *   - エラー耐性: top-skills 取得失敗時は空配列フォールバック (= 罰メッセージ無し / UI が前向き案内).
 *   - 純関数 composeWeeklyDigestView に渡して view-model 化 (励ましコピーは pre-curated catalog から
 *     deterministic に選択). 罰語は構造的に発生し得ない設計.
 */

import { and, desc, eq, gte, inArray, sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { answerLogs, learnerProfiles, problems, skills } from "@/lib/db/schema";
import { getJstQuestDate, jstQuestDayStartUtc } from "@/lib/quest/jst-date";
import { getFamilyStreak } from "@/lib/study/family-streak";
import { getFamilyWeeklyLeaderboard } from "@/lib/study/family-leaderboard";
import {
  composeWeeklyDigestView,
  type DigestSkillRow,
  type FamilyWeeklyDigestView,
} from "@/lib/study/family-weekly-digest-summary";

/** ランキング集計のウィンドウ日数 (= 直近 7 日 / leaderboard と同一) */
const DIGEST_WINDOW_DAYS = 7;

/** トップ単元 SELECT の LIMIT (純関数 selectTopSkills(_,3) のためのバッファ) */
const TOP_SKILL_LIMIT = 5;

/**
 * 家族の直近 7 日 (JST 6:00 境界) における top skills (answer_logs 件数降順) を取得する.
 *
 * 認可保証:
 *   - learner_profiles.family_id = ? で family を確定後、その learner_id IN (...) で answer_logs を絞る.
 *   - = SQL レベルで family scope を強制 (COPPA 準拠 / DEC-061 / DEC-003).
 *
 * 失敗時:
 *   - 例外を投げず空配列を返す (digest 全体の表示は streak / leaderboard で継続).
 */
async function getFamilyTopSkillsLast7Days(
  familyId: string,
  cutoff: Date,
): Promise<DigestSkillRow[]> {
  try {
    // 1) family の learner_id を確定 (family_id WHERE 必須)
    // eslint-disable-next-line no-restricted-syntax -- family-scoped read-only (DEC-063 / DEC-003)
    const learners = await db
      .select({ id: learnerProfiles.id })
      .from(learnerProfiles)
      .where(eq(learnerProfiles.familyId, familyId));

    if (learners.length === 0) return [];
    const learnerIds = learners.map((l) => l.id);

    // 2) 直近 7 日の answer_logs × problems × skills を skillId 単位で集計
    //    family スコープは learnerIds inArray で構造的に保証.
    // eslint-disable-next-line no-restricted-syntax -- family-scoped read-only (DEC-063 / DEC-003)
    const rows = await db
      .select({
        skillId: skills.id,
        displayName: skills.displayName,
        answerCount: drizzleSql<number>`COUNT(*)`.as("answer_count"),
      })
      .from(answerLogs)
      .innerJoin(problems, eq(answerLogs.problemId, problems.id))
      .innerJoin(skills, eq(problems.skillId, skills.id))
      .where(
        and(
          inArray(answerLogs.learnerId, learnerIds),
          gte(answerLogs.answeredAt, cutoff),
        ),
      )
      .groupBy(skills.id, skills.displayName)
      .orderBy(desc(drizzleSql`COUNT(*)`))
      .limit(TOP_SKILL_LIMIT);

    return rows.map((r) => ({
      skillId: r.skillId,
      displayName: r.displayName,
      answerCount: Number(r.answerCount) || 0,
    }));
  } catch {
    // top-skills 取得失敗は digest 全体を落とさない (DEC-024 前向き fallback)
    return [];
  }
}

/**
 * 指定 family の今週ハイライト (Weekly Digest) view-model を返す.
 *
 * 認可: 呼び出し元 (parent dashboard / Server Component) で requireParent / scopedQueries 済.
 *       本関数は SQL レベルで family_id = ? を強制 (COPPA 準拠 / DEC-061 / DEC-003).
 *
 * 副作用なし: DB 読み取りのみ (write / cron / API 呼び出し一切なし).
 */
export async function getFamilyWeeklyDigest(
  familyId: string,
  now?: Date,
): Promise<FamilyWeeklyDigestView> {
  if (!familyId || typeof familyId !== "string") {
    throw new TypeError("[family-weekly-digest] familyId is required");
  }

  // 1) leaderboard と同 cutoff (JST 6:00 境界 / 7 日 window) を計算
  const today = getJstQuestDate(now ?? new Date());
  const todayStartUtc = jstQuestDayStartUtc(today);
  const cutoff = new Date(
    todayStartUtc.getTime() - (DIGEST_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000,
  );

  // 2) 既存基盤 + 新規 top skills 集計を並列取得
  const [familyStreak, leaderboard, topSkills] = await Promise.all([
    getFamilyStreak(familyId, now),
    getFamilyWeeklyLeaderboard(familyId, now),
    getFamilyTopSkillsLast7Days(familyId, cutoff),
  ]);

  // 3) 純関数 compose で view-model を組み立て (励ましコピー deterministic 選択を含む)
  return composeWeeklyDigestView({
    familyId,
    weekStartUtc: cutoff,
    familyStreakDays: familyStreak.days,
    familyStreakAlive: familyStreak.isAlive,
    perLearnerWeeklyXp: leaderboard.map((row) => ({
      learnerId: row.learnerId,
      nickname: row.nickname,
      weeklyXp: row.weeklyXp,
    })),
    topSkills,
  });
}
