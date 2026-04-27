/**
 * HANEI - Writing Essay AI Scoring (W6 / F-2)
 *
 * 模試演習 / 自由記述採点 (英検 3 級 writing 等) を AI SDK で動的化する。
 *
 * 旧仕様: submitAnswer の `problem.correctAnswer === userAnswer` の文字列一致判定。
 *         writing_essay は model_answer と完全一致しないと不正解扱いになり破綻。
 * 新仕様: 本モジュールの `scoreWritingEssay` を `submitAnswer` から呼び出して、
 *         0..1 正規化スコア + kid-safe フィードバックを返す。
 *
 * セーフティ:
 *  - 子ども向けフィードバックなのでネガティブ表現禁止 (system prompt 明記)
 *  - 入力 (子どもの作文) を OpenAI Moderation API で先にチェック
 *  - 出力 token を上限制 (max_tokens=300) → 1 回 ≤ ¥1 想定
 *  - OPENAI_API_KEY 未設定時は決定論的フォールバック (語彙重複ベース簡易スコア)
 *  - moderation flag 時はフォールバックスコアにフォールバック (kid-safe)
 *  - 1 学習者の当日累計コストが AI_COST_LIMIT_JPY_PER_USER_PER_DAY を超えたら fallback
 *
 * 三層認可: 本モジュール自体は認可ガードを呼ばない (caller の Server Action が
 *           requireAuth + requireLearnerOwner を実施した後で呼ぶ前提)。
 */

import { generateObject } from "ai";
import { z } from "zod";
import { primaryModel, fallbackModel, hasApiKey } from "./openai";
import { moderateText } from "./moderation";
import { estimateCostJpy } from "./cost-guard";
import { AI_COST_LIMIT_JPY_PER_USER_PER_DAY } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Schema (gpt-5-mini を generateObject で呼ぶ際の出力形)
// ---------------------------------------------------------------------------
export const WritingScoreSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe("作文の総合スコア (0=未達 / 1=満点)"),
  feedback: z
    .string()
    .min(1)
    .max(280)
    .describe("子ども向け 280 字以内のポジティブな日本語フィードバック"),
  strengths: z
    .array(z.string().min(1).max(80))
    .max(3)
    .describe("良かった点 1〜3 個"),
  improvement: z
    .string()
    .min(1)
    .max(120)
    .describe("次に頑張ると良い点 (1 つだけ / 否定表現禁止)"),
});
export type WritingScoreObject = z.infer<typeof WritingScoreSchema>;

export interface ScoreWritingInput {
  /** 学習者の作文 */
  userAnswer: string;
  /** 模範解答 (seed の model_answer) */
  modelAnswer: string;
  /** 設問本文 (prompt) */
  prompt: string;
  /** 英検級 (3 / 4 / 5) */
  level: "5" | "4" | "3";
  /** 任意: テスト用に注入する Date.now */
  now?: Date;
}

export interface ScoreWritingResult {
  /** 0..1 正規化スコア */
  score: number;
  /** 正解扱いとみなすか (score >= 0.6 を Phase 1 暫定閾値) */
  isCorrect: boolean;
  /** 子ども向けフィードバック (kid-safe) */
  feedback: string;
  /** 良かった点 */
  strengths: string[];
  /** 次に頑張ると良い点 */
  improvement: string;
  /** 採点パス: "ai" | "fallback_no_key" | "fallback_moderation" | "fallback_cost" | "fallback_error" */
  source:
    | "ai"
    | "fallback_no_key"
    | "fallback_moderation"
    | "fallback_cost"
    | "fallback_error";
  /** 推定コスト (¥) */
  estimatedCostJpy: number;
}

const PASS_THRESHOLD = 0.6;
const MAX_OUTPUT_TOKENS = 300;
// 1 リクエスト最大コスト ≤ ¥1 を担保する設計 (max_output ≤ 300 + 入力 ≤ ~400 tokens)。
// gpt-5-mini @ 0.002 USD/1K out + 0.00025 USD/1K in × 150 JPY/USD で
// (300/1000)*0.002 + (400/1000)*0.00025 ≈ 0.0007 USD ≈ ¥0.1 (上限の 1/10)。
const PER_REQUEST_HARD_CAP_JPY = 1.0;

/**
 * 子ども作文を AI SDK で採点。
 *
 * 1) moderation: 子どもの作文を NG 検査。flagged ならフォールバック。
 * 2) cost ガード: 当日累計が上限なら fallback。
 * 3) generateObject(gpt-5-mini, WritingScoreSchema) で構造化出力。
 * 4) primary 失敗時は fallback model に切替。両方失敗時は決定論フォールバック。
 *
 * 「当日累計コスト」は本関数では計算しない (caller が学習者単位の集計を持つため)。
 * 引数 `priorCostJpy` を渡されると上限判定に使う。省略時は 0 として扱う。
 */
export async function scoreWritingEssay(
  input: ScoreWritingInput,
  priorCostJpy = 0,
): Promise<ScoreWritingResult> {
  // 1. moderation
  const mod = await moderateText(input.userAnswer);
  if (mod.flagged) {
    const fb = buildFallbackResult(input, "fallback_moderation");
    return fb;
  }

  // 2. cost ガード
  if (priorCostJpy >= AI_COST_LIMIT_JPY_PER_USER_PER_DAY) {
    return buildFallbackResult(input, "fallback_cost");
  }

  // 3. API key 未設定なら deterministic fallback
  if (!hasApiKey()) {
    return buildFallbackResult(input, "fallback_no_key");
  }

  // 4. generateObject を呼ぶ
  const system = buildSystemPrompt(input.level);
  const userPrompt = buildUserPrompt(input);

  try {
    const result = await generateObject({
      model: primaryModel(),
      schema: WritingScoreSchema,
      system,
      prompt: userPrompt,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
    const cost = capCost(estimateCostJpy(estimateInputTokens(userPrompt), MAX_OUTPUT_TOKENS));
    return finalize(result.object, cost, "ai");
  } catch (errPrimary) {
    console.warn("[score-writing] primary failed, trying fallback model:", errPrimary);
    try {
      const result2 = await generateObject({
        model: fallbackModel(),
        schema: WritingScoreSchema,
        system,
        prompt: userPrompt,
        maxTokens: MAX_OUTPUT_TOKENS,
      });
      const cost = capCost(estimateCostJpy(estimateInputTokens(userPrompt), MAX_OUTPUT_TOKENS));
      return finalize(result2.object, cost, "ai");
    } catch (errFallback) {
      console.warn("[score-writing] fallback model failed too:", errFallback);
      return buildFallbackResult(input, "fallback_error");
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function buildSystemPrompt(level: "5" | "4" | "3"): string {
  // kid-safe / no-negative ガイドライン (オーナー厳命)
  return [
    `あなたは小学生に英語を教えるやさしい先生です (英検${level}級レベルの作文を採点)。`,
    "重要なルール:",
    "1. これは小学生 (6〜12歳) へのフィードバックです。ネガティブ表現 (だめ / 間違い / ひどい / 悪い 等) を使ってはいけません。",
    "2. かならずポジティブな視点で、できているところを先に伝えてください。",
    "3. 「次に頑張ると良い点」は 1 つだけ、優しい言葉で書いてください。",
    "4. 個人情報 (本名 / 住所 / 電話) を含めてはいけません。",
    "5. 出力は JSON スキーマに完全準拠してください。",
    "6. score は 0.0〜1.0 の小数で、内容理解 / 文法 / スペル / 設問への適合を総合した値です。",
    "7. feedback / improvement / strengths は日本語で書いてください。",
  ].join("\n");
}

export function buildUserPrompt(input: ScoreWritingInput): string {
  return [
    "以下の英作文を採点してください。",
    "",
    "【設問】",
    input.prompt,
    "",
    "【模範解答】",
    input.modelAnswer,
    "",
    "【子どもの作文】",
    input.userAnswer,
    "",
    "JSON で score, feedback, strengths, improvement を返してください。",
  ].join("\n");
}

/** 雑な input トークン推定 (~4 chars / token) */
export function estimateInputTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** ¥1 ハードキャップ */
function capCost(cost: number): number {
  return Math.min(cost, PER_REQUEST_HARD_CAP_JPY);
}

function finalize(
  obj: WritingScoreObject,
  estimatedCostJpy: number,
  source: ScoreWritingResult["source"],
): ScoreWritingResult {
  const score = clamp01(obj.score);
  return {
    score,
    isCorrect: score >= PASS_THRESHOLD,
    feedback: obj.feedback,
    strengths: obj.strengths,
    improvement: obj.improvement,
    source,
    estimatedCostJpy,
  };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return Number(v.toFixed(4));
}

/**
 * AI を使えない / 使うべきでない場合の決定論フォールバック。
 *
 * - 単語の重複率 (Jaccard) を score の元にする
 * - feedback / improvement は固定の優しいテンプレート
 * - 個別の学習データに基づかないので safe
 */
export function buildFallbackResult(
  input: ScoreWritingInput,
  source: Extract<
    ScoreWritingResult["source"],
    "fallback_no_key" | "fallback_moderation" | "fallback_cost" | "fallback_error"
  >,
): ScoreWritingResult {
  const score = jaccardWordOverlap(input.userAnswer, input.modelAnswer);
  return {
    score,
    isCorrect: score >= PASS_THRESHOLD,
    feedback:
      "じぶんの言葉で書けたのが何より素晴らしいです。次の問題でも、思いついた英単語をどんどん使ってみましょう。",
    strengths: ["じぶんの言葉で書こうとしたこと"],
    improvement: "次は模範解答にある単語をいくつか使ってみると、もっと伝わる文になります。",
    source,
    estimatedCostJpy: 0,
  };
}

/** 単語重複率 (0..1) - スペース / 句読点で分割 */
export function jaccardWordOverlap(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 0),
    );
  const sa = norm(a);
  const sb = norm(b);
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) {
    if (sb.has(w)) inter += 1;
  }
  const union = sa.size + sb.size - inter;
  if (union === 0) return 0;
  return Number((inter / union).toFixed(4));
}

// 公開 (caller が閾値を確認したい場合)
export const WRITING_PASS_THRESHOLD = PASS_THRESHOLD;
export const WRITING_MAX_OUTPUT_TOKENS = MAX_OUTPUT_TOKENS;
export const WRITING_PER_REQUEST_HARD_CAP_JPY = PER_REQUEST_HARD_CAP_JPY;
