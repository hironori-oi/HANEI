/**
 * HANEI - AI コーチ Tool Use 定義 (zod スキーマ)
 *
 * dev-phase0 §4.3 で定義された 4 関数のスキーマ。
 * AI SDK の `tools` パラメータに渡す形式。
 *
 * W1 はスキーマと型のみ定義。実行ハンドラは W2 以降で実装。
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. recommend_next_problems
//    学習者の現在地と SRS due 状態から、次に解くべき問題 N 件を返す
// ---------------------------------------------------------------------------
export const RecommendNextProblemsInput = z.object({
  learnerId: z.string().describe("学習者プロフィールID"),
  count: z.number().int().min(1).max(20).default(5).describe("推奨件数"),
  preferSkill: z
    .enum(["vocabulary", "grammar", "listening", "reading", "writing", "speaking"])
    .optional()
    .describe("優先スキル (なければ FSRS due 順)"),
});

export const RecommendNextProblemsOutput = z.object({
  problems: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      levelId: z.string(),
      skillId: z.string(),
      reason: z.string().describe("なぜこの問題が今おすすめなのかの説明"),
    }),
  ),
});

// ---------------------------------------------------------------------------
// 2. explain_wrong_answer
//    誤答に対する個別最適化された解説を生成する
// ---------------------------------------------------------------------------
export const ExplainWrongAnswerInput = z.object({
  learnerId: z.string(),
  problemId: z.string(),
  userAnswer: z.string().describe("学習者が選んだ / 入力した解答"),
  childAge: z.number().int().min(6).max(15).optional(),
});

export const ExplainWrongAnswerOutput = z.object({
  explanation: z.string().describe("小学生向けの解説 (300字以内)"),
  encouragement: z.string().describe("自己肯定感を上げる励ましの一言"),
  exampleSentences: z.array(z.string()).describe("理解を助ける例文 (1〜3 件)"),
});

// ---------------------------------------------------------------------------
// 3. generate_additional_problem
//    弱点に応じて新しい問題を1問だけ動的生成する
// ---------------------------------------------------------------------------
export const GenerateAdditionalProblemInput = z.object({
  learnerId: z.string(),
  skillId: z.enum([
    "vocabulary",
    "grammar",
    "listening",
    "reading",
    "writing",
    "speaking",
  ]),
  levelId: z.enum(["5", "4", "3"]),
  weaknessTopic: z.string().describe("弱点トピック (例: be動詞, 過去形)"),
});

export const GenerateAdditionalProblemOutput = z.object({
  problem: z.object({
    type: z.string(),
    questionJson: z.unknown(),
    correctAnswer: z.string(),
    explanation: z.string(),
  }),
  generationQualityScore: z.number().min(0).max(100).optional(),
});

// ---------------------------------------------------------------------------
// 4. update_study_plan
//    受験日 / 進捗 / 残り時間から日次プランを再計算する
// ---------------------------------------------------------------------------
export const UpdateStudyPlanInput = z.object({
  learnerId: z.string(),
  reason: z.string().describe("プラン更新の理由 (例: '昨日の正答率が下がったため文法を増やす')"),
});

export const UpdateStudyPlanOutput = z.object({
  daysUntilExam: z.number().int(),
  dailyMinutes: z.number().int().describe("1日あたりの目標分数"),
  breakdown: z.object({
    vocabulary: z.number().int(),
    grammar: z.number().int(),
    listening: z.number().int(),
    reading: z.number().int().optional(),
    writing: z.number().int().optional(),
  }),
  message: z.string().describe("学習者向けの励ましメッセージ"),
});

// ---------------------------------------------------------------------------
// AI SDK tool 定義 (実行ハンドラは W2 で実装)
// ---------------------------------------------------------------------------
export const aiCoachTools = {
  recommend_next_problems: {
    description: "学習者の現在地と SRS due 状態から、次に解くべき問題を提案する",
    parameters: RecommendNextProblemsInput,
  },
  explain_wrong_answer: {
    description: "誤答に対して、その子のレベルに合わせたやさしい解説を生成する",
    parameters: ExplainWrongAnswerInput,
  },
  generate_additional_problem: {
    description: "弱点に応じて新しい問題を1問だけ動的生成する",
    parameters: GenerateAdditionalProblemInput,
  },
  update_study_plan: {
    description: "受験日・進捗・残り時間から日次プランを再計算する",
    parameters: UpdateStudyPlanInput,
  },
} as const;

export type AiCoachToolName = keyof typeof aiCoachTools;
