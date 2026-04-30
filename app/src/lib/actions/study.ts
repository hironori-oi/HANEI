"use server";

/**
 * HANEI - Study Server Actions
 *
 * submitAnswer: 解答提出 → 正誤判定 → SRS 更新 → 解説取得 → XP 加算 → 次問取得
 * 三層認可: requireAuth → requireLearnerOwner → scoped repository
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  srsStates,
  xpLevels,
  problems,
  characters,
  answerLogs,
  learnerProfiles,
} from "@/lib/db/schema";
import { requireAuth, requireLearnerOwner } from "@/lib/auth/guards";
import {
  getNextProblem,
  getSrsState,
  recordAnswerLog,
  getExplanation,
  saveExplanation,
} from "@/lib/study/repository";
import { initialCard, reviewCard, type SrsCardInput } from "@/lib/srs/fsrs";
import { computeRunningStreak } from "@/lib/study/streak";
import { applyComboToXp, type ComboTier } from "@/lib/study/combo";
import { scoreWritingEssay } from "@/lib/ai/score-writing";
import { getTodayCostJpy } from "@/lib/ai/cost-guard";
import { awardCoins, getCoinBalance } from "@/lib/actions/coins";
import { incrementQuestProgress } from "@/lib/actions/quests";
import { updateFamilyStreakOnLearn } from "@/lib/actions/family-streak";
import { COIN_REWARDS } from "@/lib/economy/ledger";

const SubmitAnswerSchema = z.object({
  learnerId: z.string().min(1),
  problemId: z.string().min(1),
  // writing_essay は最大 600 字 (英検 3 級 writing 上限 ≒ 50 words / 余裕で許容)
  choice: z.string().min(1).max(600),
  timeSpentMs: z.number().int().min(0).max(600000),
  /**
   * クライアント側の連続正解数 (W8-T2 / 表示同期用)。
   * サーバ側では answer_logs から再計算した正解 streak を真とし、
   * このパラメータは UI が「直前まで」何連続だったかを伝えるヒント値として扱う。
   * 上限 200 を超える値は防御的に切り詰める。
   */
  clientCombo: z.number().int().min(0).max(200).optional(),
});

export type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;

export interface SubmitAnswerResult {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  xpDelta: number;
  totalXp: number;
  nextDueAt: string; // ISO
  nextProblemId: string | null;
  /**
   * 直近の連続正解数 (今回の解答を含む / W5 G-5 ことだまトリ mood 用)。
   * 不正解の場合は 0、正解の場合は「直前まで連続していた正解数 + 1」。
   * answer_logs 起点で計算。
   */
  streak: number;
  /**
   * W8-T2: combo XP 倍率 (1.0 / 1.5 / 2.0 / 3.0)。サーバ側で計算済 (cheating 不可)。
   */
  comboMultiplier: number;
  /** W8-T2: combo tier (0=未発動 / 1=1.5x / 2=2x / 3=3x) */
  comboTier: ComboTier;
  /** W10-T1: 今回の解答で獲得したハネキン (はね金) */
  coinDelta: number;
  /** W10-T1: 解答後のハネキン残高 (denormalized cache) */
  coinBalance: number;
}

// computeRunningStreak は @/lib/study/streak.ts に分離 ("use server" 制約のため)。

/**
 * 解答を提出して即時フィードバック + SRS 更新を行う。
 */
export async function submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
  const parsed = SubmitAnswerSchema.parse(input);
  const session = await requireAuth();
  const { learnerId } = await requireLearnerOwner(session.userId, parsed.learnerId);

  // 問題を取得
  // eslint-disable-next-line no-restricted-syntax -- 認可済 (requireLearnerOwner 通過後の単一問題取得)
  const problemRows = await db
    .select()
    .from(problems)
    .where(eq(problems.id, parsed.problemId))
    .limit(1);
  const problem = problemRows[0];
  if (!problem) {
    throw new Error("[study/submitAnswer] problem not found");
  }

  // 採点: writing_essay は AI SDK で動的判定 (W6 / F-2)、それ以外は文字列一致
  let correct = problem.correctAnswer === parsed.choice;
  let writingFeedback: string | null = null;
  if (problem.type === "writing_essay") {
    // questionJson から prompt / modelAnswer を取り出す (seed-problems-runner で構築済)
    const qj = (problem.questionJson ?? {}) as {
      prompt?: string;
      modelAnswer?: string;
    };
    const priorCost = await getTodayCostJpy(learnerId);
    const scored = await scoreWritingEssay(
      {
        userAnswer: parsed.choice,
        modelAnswer: qj.modelAnswer ?? problem.correctAnswer,
        prompt: qj.prompt ?? "",
        // problem.levelId は "5" | "4" | "3" のいずれか
        level: (problem.levelId === "5" || problem.levelId === "4" || problem.levelId === "3"
          ? problem.levelId
          : "3") as "5" | "4" | "3",
      },
      priorCost,
    );
    correct = scored.isCorrect;
    writingFeedback = scored.feedback;
  }

  // 解答ログ記録
  await recordAnswerLog({
    id: `al_${randomUUID()}`,
    learnerId,
    problemId: parsed.problemId,
    userAnswer: parsed.choice,
    isCorrect: correct,
    timeSpentMs: parsed.timeSpentMs,
  });

  // SRS 更新 (FSRS)
  const existing = await getSrsState(learnerId, parsed.problemId);
  const card: SrsCardInput = existing
    ? {
        stability: existing.stability,
        difficulty: existing.difficulty,
        due: existing.dueAt,
        state: existing.state ?? 0,
        reps: existing.reviewCount,
        lapses: 0,
        lastReview: existing.lastReviewedAt ?? null,
      }
    : initialCard();

  const next = reviewCard(card, correct);

  if (existing) {
    await db
      .update(srsStates)
      .set({
        stability: next.stability,
        difficulty: next.difficulty,
        state: next.state,
        dueAt: next.due,
        lastReviewedAt: next.lastReview,
        reviewCount: existing.reviewCount + 1,
        fsrsState: next.fsrsState,
        updatedAt: new Date(),
      })
      .where(eq(srsStates.id, existing.id));
  } else {
    await db.insert(srsStates).values({
      id: `sr_${randomUUID()}`,
      learnerId,
      problemId: parsed.problemId,
      stability: next.stability,
      difficulty: next.difficulty,
      state: next.state,
      dueAt: next.due,
      lastReviewedAt: next.lastReview,
      reviewCount: 1,
      fsrsState: next.fsrsState,
    });
  }

  // 解説を取得 (キャッシュ優先 / 既存解説テキストにフォールバック)
  let explanationText = problem.explanation;
  if (writingFeedback) {
    // writing_essay は AI フィードバックを優先表示 (kid-safe)
    explanationText = writingFeedback;
  } else if (!correct) {
    const cached = await getExplanation(parsed.problemId);
    if (cached) {
      explanationText = cached.explanationText;
    } else if (problem.explanation && problem.explanation.length > 0) {
      // 既存 explanation を使用 + AI コーチ呼び出しは別 API (/api/ai/coach) に委譲
      explanationText = problem.explanation;
    } else {
      explanationText = "解説は準備中です。先生にきいてみよう。";
    }
  }

  // W8-T2: combo 倍率を適用した XP 加算 (サーバ側で計算 / cheating 不可)
  // 直近の running streak を計算し、今回が正解なら +1 して combo として使用
  // (これにより client が嘘の clientCombo を送っても server 側真値で上書きする)
  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済
  const recentLogsForCombo = await db
    .select({ isCorrect: answerLogs.isCorrect })
    .from(answerLogs)
    .where(eq(answerLogs.learnerId, learnerId))
    .orderBy(desc(answerLogs.answeredAt))
    .limit(50);
  const serverCombo = computeRunningStreak(recentLogsForCombo);

  // 基礎 XP: 正解=10 / 不正解=1
  const baseXp = correct ? 10 : 1;
  // combo 倍率は正解時のみ適用 (不正解は基礎 1 XP のまま)
  const comboApplied = correct
    ? applyComboToXp(baseXp, serverCombo)
    : { xp: baseXp, multiplier: 1.0, tier: 0 as ComboTier };
  const xpDelta = comboApplied.xp;

  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済
  const xpRows = await db
    .select()
    .from(xpLevels)
    .where(eq(xpLevels.learnerId, learnerId))
    .limit(1);
  const xpRow = xpRows[0];
  let totalXp = xpDelta;
  if (xpRow) {
    totalXp = xpRow.totalXp + xpDelta;
    await db
      .update(xpLevels)
      .set({ totalXp, updatedAt: new Date() })
      .where(eq(xpLevels.id, xpRow.id));
  } else {
    await db.insert(xpLevels).values({
      id: `xp_${randomUUID()}`,
      learnerId,
      totalXp,
      level: 1,
      nextLevelXp: 100,
    });
  }

  // ことだまトリ mood 更新 (正解=excited / 不正解=normal)
  await db
    .update(characters)
    .set({ mood: correct ? "excited" : "normal", updatedAt: new Date() })
    .where(eq(characters.learnerId, learnerId));

  // W10-T1: ハネキン (はね金) 付与 — 正解時のみ COIN_REWARDS.LESSON_CORRECT
  // - 不正解は罰則ゼロ (DEC-024 親メッセージ哲学 / 励まし主軸 と整合)
  // - awardCoins 内部で再度 requireAuth + requireLearnerOwner を実行 (二重防御)
  // - lesson は冪等不要 (同 problemId で再挑戦して再正解した場合は再付与 OK)
  // - 失敗 / 不正解時は denormalized cache を 1 query で読む (PK 引きのため軽い)
  let coinDelta = 0;
  let coinBalance = 0;
  if (correct && COIN_REWARDS.LESSON_CORRECT > 0) {
    try {
      const award = await awardCoins({
        learnerId,
        amount: COIN_REWARDS.LESSON_CORRECT,
        reason: "lesson",
        referenceId: parsed.problemId,
        memo: `lesson correct (${problem.skillId})`,
      });
      if (award.ok) {
        coinDelta = COIN_REWARDS.LESSON_CORRECT;
        coinBalance = award.newBalance;
      }
    } catch {
      // award 失敗は学習体験を中断しない (best-effort / Sentry に投げる経路は別途検討)
    }
  }
  if (coinBalance === 0 && coinDelta === 0) {
    // 不正解 / award 失敗時に現残高を 1 query で取得 (PK 引き / await badge.tsx と同等)
    coinBalance = await getCoinBalance(learnerId);
  }

  // W10-T3: Daily Quest 進捗反映 (best-effort / 学習体験を中断しない)
  // problem.skillId ("vocabulary-5" 等) から skill code を抽出して
  // 当日の quest 行に progress += 1 する。当日 lazy gen 未実行なら何もしない。
  try {
    const skillRe = /^(vocabulary|grammar|listening|reading|writing)(?:-[0-9]+)?$/;
    const skillMatch = skillRe.exec(problem.skillId);
    if (skillMatch) {
      const skill = skillMatch[1] as
        | "vocabulary"
        | "grammar"
        | "listening"
        | "reading"
        | "writing";
      await incrementQuestProgress({
        learnerId,
        skill,
        isCorrect: correct,
      });
    }
  } catch {
    // best-effort / 学習体験を中断しない (Sentry 経路は別途検討)
  }

  // W11-T1: Family 内 Streak 更新 (best-effort / 学習体験を中断しない)
  // - learner.familyId を引いて updateFamilyStreakOnLearn を 1 回呼ぶ.
  // - 同日 2 回目以降は computeFamilyStreakRollover が shouldUpdate=false を返し no-op (DEC-055 / 兄弟救済の冪等性).
  // - hard_limit (60 分) で session が終わっても本処理は streak を減らさない (DEC-024 / 罰則ゼロ).
  try {
    // eslint-disable-next-line no-restricted-syntax -- 認可済 (requireLearnerOwner 通過後の learner.family_id 取得)
    const learnerFamilyRows = await db
      .select({ familyId: learnerProfiles.familyId })
      .from(learnerProfiles)
      .where(eq(learnerProfiles.id, learnerId))
      .limit(1);
    const familyId = learnerFamilyRows[0]?.familyId;
    if (familyId) {
      await updateFamilyStreakOnLearn(familyId);
    }
  } catch {
    // best-effort / 学習体験を中断しない (family_streak 更新失敗は表示の遅延でしかない)
  }

  // 次の問題
  const nextProblem = await getNextProblem(learnerId, problem.levelId, problem.skillId);

  // running streak (W5 G-5 ことだまトリ mood 用) は serverCombo (XP 計算用に取得済) を再利用
  const streak = serverCombo;

  // 任意の clientCombo は防御的に参照のみ (UI 同期確認 / 将来のテレメトリ用)
  void parsed.clientCombo;

  return {
    correct,
    correctAnswer: problem.correctAnswer,
    explanation: explanationText,
    xpDelta,
    totalXp,
    nextDueAt: next.due.toISOString(),
    nextProblemId: nextProblem?.id ?? null,
    streak,
    comboMultiplier: comboApplied.multiplier,
    comboTier: comboApplied.tier,
    coinDelta,
    coinBalance,
  };
}

/**
 * AI コーチに解説生成を依頼してキャッシュに保存 (誤答時の改善ループ)
 */
export async function regenerateExplanation(
  problemId: string,
  learnerId: string,
): Promise<{ explanation: string }> {
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, learnerId);

  // eslint-disable-next-line no-restricted-syntax -- 認可済
  const rows = await db.select().from(problems).where(eq(problems.id, problemId)).limit(1);
  const problem = rows[0];
  if (!problem) {
    throw new Error("[study/regenerateExplanation] problem not found");
  }

  // 既存問題本体の explanation を fallback として保存 (AI 呼び出しは /api/ai/coach 経由を推奨)
  await saveExplanation({
    id: `pe_${randomUUID()}`,
    problemId,
    explanationText: problem.explanation,
    generatedBy: "fallback",
  });

  return { explanation: problem.explanation };
}

// XP / DB 整合性のため sql import を保持
const _ = sql;
