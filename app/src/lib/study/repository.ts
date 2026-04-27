/**
 * HANEI - Study Repository (scoped queries)
 *
 * 三層認可防衛 第三層: family_id / learner_id でスコープされたクエリビルダ。
 * 必ず scoped (familyId or learnerId) を引数に取る関数のみを公開する。
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  problems,
  srsStates,
  answerLogs,
  problemExplanations,
  learnerProfiles,
  type Problem,
  type SrsState,
  type ProblemExplanation,
} from "@/lib/db/schema";

/**
 * 学習者と familyId が一致することを SQL で再確認 + プロフィール返却。
 */
export async function getLearnerInFamily(
  familyId: string,
  learnerId: string,
): Promise<typeof learnerProfiles.$inferSelect | null> {
  // eslint-disable-next-line no-restricted-syntax -- scoped クエリ本体
  const rows = await db
    .select()
    .from(learnerProfiles)
    .where(
      and(eq(learnerProfiles.familyId, familyId), eq(learnerProfiles.id, learnerId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * level + skill で 1 問取り出す。
 * 優先順:
 *   1. SRS due (= 復習タイミングが今より過去) の問題
 *   2. 未学習 (srs_states に行が無い) かつ qa_status=live or pass
 *   3. ランダム
 *
 * DEC-036 G-4: explanation 無し問題は出題対象から除外。
 *   `problem_explanations` に対応行が EXISTS する problem のみ採用する。
 *   これにより 5 級 listening の未生成 1 件 (DEC-035) が出題されない。
 *   4 級 / 3 級の旧 21 件もしばらく出題されないが、W6 バックフィルで自然解禁される。
 */
export async function getNextProblem(
  learnerId: string,
  levelId: string,
  skillId: string,
): Promise<Problem | null> {
  const now = new Date();
  // 1. 復習 due 問題
  // eslint-disable-next-line no-restricted-syntax -- scoped (learnerId 必須)
  const dueRows = await db
    .select({
      id: problems.id,
      levelId: problems.levelId,
      skillId: problems.skillId,
      type: problems.type,
      questionJson: problems.questionJson,
      correctAnswer: problems.correctAnswer,
      explanation: problems.explanation,
      generationQualityScore: problems.generationQualityScore,
      qaVerdict: problems.qaVerdict,
      qaReasons: problems.qaReasons,
      qaStatus: problems.qaStatus,
      audioUrl: problems.audioUrl,
      source: problems.source,
      createdAt: problems.createdAt,
      updatedAt: problems.updatedAt,
    })
    .from(problems)
    .innerJoin(srsStates, eq(srsStates.problemId, problems.id))
    .where(
      and(
        eq(srsStates.learnerId, learnerId),
        eq(problems.levelId, levelId),
        eq(problems.skillId, skillId),
        sql`${srsStates.dueAt} <= ${Math.floor(now.getTime() / 1000)}`,
        // DEC-036 G-4: explanation 無し除外、W6 バックフィルで自然解禁
        sql`EXISTS (
          SELECT 1 FROM ${problemExplanations}
          WHERE ${problemExplanations.problemId} = ${problems.id}
        )`,
      ),
    )
    .limit(1);
  if (dueRows[0]) return dueRows[0] as Problem;

  // 2. 未学習問題 (NOT EXISTS)
  // eslint-disable-next-line no-restricted-syntax -- scoped (learnerId 必須)
  const newRows = await db
    .select()
    .from(problems)
    .where(
      and(
        eq(problems.levelId, levelId),
        eq(problems.skillId, skillId),
        sql`(${problems.qaStatus} = 'live' OR ${problems.qaVerdict} = 'pass')`,
        sql`NOT EXISTS (
          SELECT 1 FROM ${srsStates}
          WHERE ${srsStates.problemId} = ${problems.id}
            AND ${srsStates.learnerId} = ${learnerId}
        )`,
        // DEC-036 G-4: explanation 無し除外、W6 バックフィルで自然解禁
        sql`EXISTS (
          SELECT 1 FROM ${problemExplanations}
          WHERE ${problemExplanations.problemId} = ${problems.id}
        )`,
      ),
    )
    .limit(1);
  return newRows[0] ?? null;
}

/**
 * 既存 SRS 状態を取得 (なければ null)
 */
export async function getSrsState(
  learnerId: string,
  problemId: string,
): Promise<SrsState | null> {
  // eslint-disable-next-line no-restricted-syntax -- scoped (learnerId 必須)
  const rows = await db
    .select()
    .from(srsStates)
    .where(and(eq(srsStates.learnerId, learnerId), eq(srsStates.problemId, problemId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 解答ログを記録 (learnerId スコープ)
 */
export async function recordAnswerLog(input: {
  id: string;
  learnerId: string;
  problemId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpentMs: number;
}): Promise<void> {
  await db.insert(answerLogs).values({
    id: input.id,
    learnerId: input.learnerId,
    problemId: input.problemId,
    userAnswer: input.userAnswer,
    isCorrect: input.isCorrect,
    timeSpentMs: input.timeSpentMs,
  });
}

/**
 * 解説を取得 (problem_explanations 優先 / なければ problems.explanation)
 */
export async function getExplanation(
  problemId: string,
): Promise<ProblemExplanation | null> {
  // eslint-disable-next-line no-restricted-syntax -- public 解説テーブル参照
  const rows = await db
    .select()
    .from(problemExplanations)
    .where(eq(problemExplanations.problemId, problemId))
    .orderBy(sql`${problemExplanations.generatedAt} DESC`)
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 解説を保存 (AI 生成解説のキャッシュ)
 */
export async function saveExplanation(input: {
  id: string;
  problemId: string;
  explanationText: string;
  generatedBy: "ai_coach" | "curated" | "fallback";
}): Promise<void> {
  await db.insert(problemExplanations).values({
    id: input.id,
    problemId: input.problemId,
    explanationText: input.explanationText,
    generatedBy: input.generatedBy,
  });
}
