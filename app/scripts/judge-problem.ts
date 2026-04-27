/**
 * scripts/judge-problem.ts
 *
 * DEC-011 LLM-as-Judge パイプラインの第2ステージ:
 *   生成された問題を別の LLM (Claude Sonnet 4.5) で採点。
 *   cross-LLM verification により、生成側の認知バイアスを除去する。
 *
 * 採点軸:
 *  - 正解の妥当性
 *  - 選択肢の適切性
 *  - 難易度の整合
 *  - 著作権侵害ソース文の混入なし
 *  - 子ども不適切表現なし
 *
 * 出力: { qa_verdict, quality_score (0-100), reasons[] }
 *
 * 実行: `npm run ai:judge-problem`
 */

import { z } from "zod";
import type { Eiken5VocabProblem } from "./generate-problem";
import { generateEiken5VocabProblem } from "./generate-problem";

// ---------------------------------------------------------------------------
// Verdict schema
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 採点プロンプト (Claude Sonnet 4.5 / DEC-011)
// ---------------------------------------------------------------------------
// NOTE: Claude API 接続は W3 で実装。現状は mockJudge 経由なので未使用だが、採点軸の仕様書として保持。
const _JUDGE_SYSTEM_PROMPT = `
あなたは英検5級〜3級レベルの英語問題の品質審査員です。
以下の問題を「英検5級として小学生に出題して妥当か」観点で 5 軸 × 各 20 点 = 100 点満点で採点してください。

採点軸:
  1. answerCorrectness (正解の妥当性): 提示された正解は本当に正しいか
  2. distractorQuality (誤答選択肢の質): 紛らわしすぎず、易しすぎないか
  3. levelAlignment (難易度整合): 英検5級 (中学初級) に妥当か
  4. originality (独自性): 既存教材の文をそのまま流用していない・出題が独自か
  5. childSafety (子ども安全性): 暴力・性的・差別・恐怖を含まないか

また、上記をふまえて qaVerdict ("pass" or "fail") を判定してください。
${PASS_THRESHOLD} 点以上を pass とします。
`.trim();

// ---------------------------------------------------------------------------
// モック判定 (API キー未設定時)
// ---------------------------------------------------------------------------
function mockJudge(problem: Eiken5VocabProblem): JudgeVerdict {
  // 単純に: 「答えが A〜D いずれか」「choices が 4 件」「explanation が 50 文字以上」を満たせば pass
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
        : ["mock judge: 構造的チェックは合格 (cross-LLM 採点は本番 API キー必要)"],
    axes,
  };
}

// ---------------------------------------------------------------------------
// 実 API 呼び出し (Anthropic SDK)
// ---------------------------------------------------------------------------
async function realJudge(problem: Eiken5VocabProblem): Promise<JudgeVerdict> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockJudge(problem);
  }

  // TODO(W2): @anthropic-ai/sdk で Claude Sonnet 4.5 に Structured Outputs 風で投げる
  //   const Anthropic = (await import("@anthropic-ai/sdk")).default;
  //   const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  //   const res = await client.messages.create({...});
  //   return JudgeVerdictSchema.parse(JSON.parse(res.content[0].text));

  // W1 PoC: 実呼び出しはモックにフォールバック
  return mockJudge(problem);
}

export async function judgeProblem(problem: Eiken5VocabProblem): Promise<JudgeVerdict> {
  return realJudge(problem);
}

// CLI エントリ
async function main() {
  console.log("[judge-problem] generating sample problem...");
  const problem = await generateEiken5VocabProblem();
  console.log("[judge-problem] generated:", problem.questionJson.prompt);

  console.log("[judge-problem] judging...");
  const verdict = await judgeProblem(problem);
  console.log(JSON.stringify({ problem, verdict }, null, 2));

  if (verdict.qaVerdict === "fail") {
    console.error(`[judge-problem] FAIL (score=${verdict.qualityScore})`);
    process.exit(1);
  } else {
    console.log(`[judge-problem] PASS (score=${verdict.qualityScore})`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
