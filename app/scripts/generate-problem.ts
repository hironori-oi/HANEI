/**
 * scripts/generate-problem.ts
 *
 * DEC-011 LLM-as-Judge パイプラインの第1ステージ:
 *   gpt-5-mini で英検5級語彙問題を1問生成し、JSON Schema で構造化出力。
 *
 * 実行: `npm run ai:generate-problem`
 *
 * 環境変数:
 *  - OPENAI_API_KEY (未設定時はモックの fixture を返す)
 *  - OPENAI_MODEL_PRIMARY (default: gpt-5-mini)
 */

import { z } from "zod";
import { generateObject } from "ai";
import { primaryModel, hasApiKey } from "@/lib/ai/openai";

// ---------------------------------------------------------------------------
// 出力スキーマ (JSON Schema 強制)
// ---------------------------------------------------------------------------
export const Eiken5VocabProblemSchema = z.object({
  level: z.literal("5"),
  skill: z.literal("vocabulary"),
  type: z.literal("mcq"),
  questionJson: z.object({
    prompt: z.string().describe("問題文 (英文または日本語の意味を問う形式)"),
    choices: z
      .array(
        z.object({
          label: z.enum(["A", "B", "C", "D"]),
          text: z.string(),
        }),
      )
      .length(4),
  }),
  correctAnswer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().describe("小学生向けやさしい日本語解説"),
});

export type Eiken5VocabProblem = z.infer<typeof Eiken5VocabProblemSchema>;

// ---------------------------------------------------------------------------
// プロンプト
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `
あなたは英検5級レベルの英語問題作成者です。
小学生向けに、以下の制約を厳守して問題を1問だけ生成してください。

【厳守】
- 形式: 4択の語彙問題 (mcq)
- 出題範囲: 英検5級レベル (be動詞 / 一般動詞 / 基本疑問文 / 中学初級語彙約 600 語)
- 子どもが安心して解ける内容: 動物・食べ物・学校・家族・色・スポーツ などの題材
- 不適切な内容 (暴力・性的・差別・恐怖) は禁止
- 正解は明確に1つ、誤答は紛らわしすぎず、易しすぎない
- 解説は小学生向けに「ですます調」のやさしい日本語で 200 字以内
- 著作物の引用 (英検過去問の流用) は禁止、100% オリジナルで作成
`.trim();

// ---------------------------------------------------------------------------
// モック fixture (OPENAI_API_KEY 未設定時)
// ---------------------------------------------------------------------------
const MOCK_PROBLEM: Eiken5VocabProblem = {
  level: "5",
  skill: "vocabulary",
  type: "mcq",
  questionJson: {
    prompt: "I have a ( ) at home. It is small and white.",
    choices: [
      { label: "A", text: "cat" },
      { label: "B", text: "river" },
      { label: "C", text: "school" },
      { label: "D", text: "weather" },
    ],
  },
  correctAnswer: "A",
  explanation:
    "「家にいる」「小さくて白い」というヒントから、動物の cat (ねこ) が一番自然です。river (川) や school (学校) は家にいるものではないですね。",
};

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------
export async function generateEiken5VocabProblem(): Promise<Eiken5VocabProblem> {
  if (!hasApiKey()) {
    console.log("[generate-problem] OPENAI_API_KEY 未設定のため、モック fixture を返します。");
    return MOCK_PROBLEM;
  }

  const { object } = await generateObject({
    model: primaryModel(),
    schema: Eiken5VocabProblemSchema,
    system: SYSTEM_PROMPT,
    prompt: "英検5級レベルの語彙問題を1問、4択で生成してください。",
  });

  return object;
}

// CLI エントリ
async function main() {
  const problem = await generateEiken5VocabProblem();
  console.log(JSON.stringify(problem, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
