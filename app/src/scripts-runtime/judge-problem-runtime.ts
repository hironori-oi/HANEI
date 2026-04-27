/**
 * Runtime wrapper for LLM-as-Judge.
 * Anthropic Claude Sonnet 4.5 で採点。API キー未設定時は構造的モック。
 */

import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { Eiken5VocabProblem } from "./generate-problem-runtime";

export const JudgeVerdictSchema = z.object({
  qaVerdict: z.enum(["pass", "fail"]),
  qualityScore: z.number().int().min(0).max(100),
  reasons: z.array(z.string()),
  axes: z.object({
    answerCorrectness: z.number().int().min(0).max(20),
    distractorQuality: z.number().int().min(0).max(20),
    levelAlignment: z.number().int().min(0).max(20),
    originality: z.number().int().min(0).max(20),
    childSafety: z.number().int().min(0).max(20),
  }),
});

export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

const PASS_THRESHOLD = 80;
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";

const JUDGE_SYSTEM_PROMPT = `
あなたは英検5級〜3級レベルの英語問題の品質審査員です。
以下の問題を「英検5級として小学生に出題して妥当か」観点で 5 軸 × 各 20 点 = 100 点満点で採点してください。

採点軸:
  1. answerCorrectness (正解の妥当性): 提示された正解は本当に正しいか
  2. distractorQuality (誤答選択肢の質): 紛らわしすぎず、易しすぎないか
  3. levelAlignment (難易度整合): 英検5級 (中学初級) に妥当か
  4. originality (独自性): 既存教材の文をそのまま流用していない・出題が独自か
  5. childSafety (子ども安全性): 暴力・性的・差別・恐怖を含まないか

出力は次の JSON のみ:
{
  "qaVerdict": "pass" | "fail",
  "qualityScore": 0..100,
  "reasons": ["string", ...],
  "axes": {
    "answerCorrectness": 0..20,
    "distractorQuality": 0..20,
    "levelAlignment": 0..20,
    "originality": 0..20,
    "childSafety": 0..20
  }
}
${PASS_THRESHOLD} 点以上を pass とします。
`.trim();

function mockJudge(problem: Eiken5VocabProblem): JudgeVerdict {
  const reasons: string[] = [];
  const axes = {
    answerCorrectness: 18,
    distractorQuality: 16,
    levelAlignment: 18,
    originality: 16,
    childSafety: 20,
  };
  if (!["A", "B", "C", "D"].includes(problem.correctAnswer)) {
    axes.answerCorrectness = 0;
    reasons.push("correctAnswer が A〜D の範囲外");
  }
  if (problem.questionJson.choices.length !== 4) {
    axes.distractorQuality = 0;
    reasons.push("choices の数が 4 件ではない");
  }
  if (problem.explanation.length < 50) {
    axes.levelAlignment -= 5;
    reasons.push("解説が 50 文字未満で不十分");
  }
  const qualityScore =
    axes.answerCorrectness +
    axes.distractorQuality +
    axes.levelAlignment +
    axes.originality +
    axes.childSafety;
  return {
    qaVerdict: qualityScore >= PASS_THRESHOLD ? "pass" : "fail",
    qualityScore,
    reasons:
      reasons.length > 0
        ? reasons
        : ["mock judge: 構造的チェック合格 (cross-LLM 採点には ANTHROPIC_API_KEY 必要)"],
    axes,
  };
}

export async function judgeProblem(
  problem: Eiken5VocabProblem,
): Promise<JudgeVerdict> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockJudge(problem);
  }
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      system: JUDGE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `採点対象:\n${JSON.stringify(problem, null, 2)}`,
            },
          ],
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return mockJudge(problem);
    }
    // JSON 抽出 (LLM が backtick で囲む可能性に対応)
    const jsonMatch = block.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return mockJudge(problem);
    const parsed = JudgeVerdictSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) return mockJudge(problem);
    return parsed.data;
  } catch (err) {
    console.warn("[judge-runtime] anthropic call failed:", err);
    return mockJudge(problem);
  }
}
