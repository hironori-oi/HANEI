/**
 * scripts/lib/explanation-generator.ts (W7 / B-9)
 *
 * 用途:
 *   - generate-explanations-w3.ts (seed YAML 起点) と
 *     generate-explanations-from-db.ts (DB 起点) の両方から共有される
 *     「1 問あたりの誤答解説生成 + 整形」純粋ロジックモジュール。
 *
 * 切り出し方針 (DEC-039 / DEC-040 受け B-9):
 *   - W3 script に閉じていた Zod schema / system prompt / generateObject 呼び出し
 *     / 整形済み explanation_text 組み立てを一カ所に寄せ、両 script で同一仕様に
 *     する (二重メンテを防ぐ)。
 *   - DB / fs 副作用は持たない。OpenAI 呼び出しのみが副作用。
 *   - `hasApiKey()` 不在時は mock 出力を返す (DRY_RUN 試走で path を通せるようにする)。
 *
 * 注意:
 *   - reading_passage_mcq の question 単位採番 (`<problemId>::q1` 等) は呼び出し側で
 *     行う。本モジュールは「1 件分の (prompt, choices, correctAnswer)」を受け取り
 *     1 件の explanation_text を返す責務に集中する。
 */

import { z } from "zod";
import { generateObject } from "ai";
import { primaryModel, hasApiKey } from "../../src/lib/ai/openai";
import { estimateCostJpy } from "../../src/lib/ai/cost-guard";

// ---------------------------------------------------------------------------
// 出力スキーマ (W3 から移植 / 完全同型)
// ---------------------------------------------------------------------------
export const ExplanationSchema = z.object({
  correctReason: z
    .string()
    .describe("正解選択肢が正しい理由 (子ども向けやさしい日本語 / 80字以内)"),
  wrongReasons: z
    .array(
      z.object({
        choice: z.string(),
        reason: z.string().describe("誤答が誤りである理由 (60字以内)"),
      }),
    )
    .min(2)
    .max(3),
  kidNote: z.string().describe("覚えるためのちょっとした補足コツ (60字以内)"),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

// ---------------------------------------------------------------------------
// 共通の入力型 (mcq / listening_mcq / reading_passage_mcq の 1 question すべてに対応)
// ---------------------------------------------------------------------------
export interface GenerateInput {
  /** AI 呼び出しに渡す問題本文 (passage を含む場合は呼び出し側で連結する) */
  prompt: string;
  /** 4 択 (3 択以上 / writing/reorder では擬似 4 択にして渡す) */
  choices: string[];
  /** 正解ラベル: "A" / "B" / "C" / "D" 等 */
  correctAnswer: string;
}

export interface GenerateResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

// ---------------------------------------------------------------------------
// system prompt (W3 から移植)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `
あなたは英検5〜3級レベルの英語問題に「子ども向けの誤答解説」を書く先生です。
小学生でも分かる日本語のですます調で、優しく、断定的に書いてください。
絵文字や顔文字は禁止です。
`.trim();

const LABELS = ["A", "B", "C", "D"] as const;

/**
 * (純粋関数) 入力から user prompt を組み立てる。
 * 単体テストの主対象。
 */
export function buildUserPrompt(input: GenerateInput): string {
  const choicesLine = input.choices
    .map((c, i) => `${LABELS[i] ?? "?"}: ${c}`)
    .join(" / ");
  return `
問題: ${input.prompt}
選択肢: ${choicesLine}
正解: ${input.correctAnswer}

上記の問題について、以下の構造で出力してください:
  - correctReason: 正解の理由
  - wrongReasons: 誤答 2〜3 つの理由
  - kidNote: 覚え方のコツ
`.trim();
}

/**
 * (純粋関数) Explanation オブジェクトを explanation_text 文字列に整形する。
 * W3 と完全同型。
 */
export function formatExplanationText(obj: Explanation): string {
  return [
    `【正解の理由】 ${obj.correctReason}`,
    "【誤答の理由】",
    ...obj.wrongReasons.map((w) => `  - ${w.choice}: ${w.reason}`),
    `【覚えるコツ】 ${obj.kidNote}`,
  ].join("\n");
}

/**
 * 1 件の explanation を生成する。
 *
 * - hasApiKey() が false なら mock 文字列を返す (DRY_RUN / fixture 用)。
 * - max tokens = 4000 (DEC-033: gpt-5-mini reasoning_tokens 用に余裕を確保)
 *
 * 失敗時は throw する (呼び出し側で try/catch して failed カウンタに加算する)。
 */
export async function generateOneExplanation(
  input: GenerateInput,
): Promise<GenerateResult> {
  if (!hasApiKey()) {
    return {
      text: `[mock] ${input.prompt} の解説 (correct=${input.correctAnswer})`,
      tokensIn: 200,
      tokensOut: 200,
    };
  }

  const result = await generateObject({
    model: primaryModel(),
    schema: ExplanationSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(input),
    maxTokens: 4000,
  });

  const obj: Explanation = result.object;
  const text = formatExplanationText(obj);
  const usage = result.usage;
  return {
    text,
    tokensIn: usage?.promptTokens ?? 200,
    tokensOut: usage?.completionTokens ?? 200,
  };
}

// ---------------------------------------------------------------------------
// reading_passage_mcq 用ユーティリティ
// ---------------------------------------------------------------------------

/**
 * DB の questionJson (reading_passage_mcq) で保存される 1 question の形。
 * seed-problems-runner.ts の buildReadingPassageQuestionJson と同型。
 */
export interface PassageQuestion {
  prompt: string;
  choices: ReadonlyArray<{ label: string; text: string }>;
  correctAnswer: string;
  explanation?: string;
}

export interface PassageQuestionJson {
  passage: string;
  wordCount?: number;
  genre?: string;
  questions: ReadonlyArray<PassageQuestion>;
  estimatedTimeSec?: number;
  tags?: ReadonlyArray<string>;
  difficulty?: number;
}

/**
 * (純粋関数) reading_passage_mcq の questionJson から
 * GenerateInput[] と「question index 配列」を返す。
 *
 * - passage 本文は各 question の prompt に「[Passage]\n...\n[Question]\n...」形式で連結する。
 * - choices は label を捨てて text 配列にして渡す。
 * - 1 件の問題 = N 件の question = N 件の explanation を生成することを意味する。
 */
export function parsePassageQuestions(
  raw: unknown,
): Array<{ index: number; input: GenerateInput }> {
  const json = raw as PassageQuestionJson | null | undefined;
  if (!json || typeof json !== "object") return [];
  const passage = typeof json.passage === "string" ? json.passage : "";
  const questions = Array.isArray(json.questions) ? json.questions : [];
  const out: Array<{ index: number; input: GenerateInput }> = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q !== "object") continue;
    const choiceTexts = Array.isArray(q.choices)
      ? q.choices.map((c: { text?: string } | null | undefined) =>
          c && typeof c === "object" && typeof c.text === "string" ? c.text : "",
        )
      : [];
    const promptCombined =
      passage && q.prompt
        ? `[Passage]\n${passage}\n[Question]\n${q.prompt}`
        : (q.prompt ?? passage);
    out.push({
      index: i,
      input: {
        prompt: promptCombined,
        choices: choiceTexts,
        correctAnswer: typeof q.correctAnswer === "string" ? q.correctAnswer : "A",
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// estimateCostJpy の re-export (呼び出し側の import 整理用)
// ---------------------------------------------------------------------------
export { estimateCostJpy };
