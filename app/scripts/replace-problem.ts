/**
 * scripts/replace-problem.ts (W3 / T-6 + W4 / T-6a 拡張)
 *
 * 用途:
 *  - 単発: 1 問だけ id 指定で差し替えるヘルパ。
 *  - W4 拡張: `--bulk` モードで `seed-problems-w3.ts` の `replacements` 配列を
 *    まとめて本番 DB に流し込む (V3-012R 等の改稿パッチ)。
 *
 * 入力 (単発モード):
 *   - 環境変数 PROBLEM_ID (差し替え対象の problems.id)
 *   - 標準入力から JSON で新しい問題本体を渡す。形:
 *       {
 *         "questionJson": { "prompt": "...", "choices": [...] },
 *         "correctAnswer": "A",
 *         "explanation": "..."
 *       }
 *
 * 入力 (bulk モード):
 *   - 引数 `--bulk` または環境変数 BULK=1
 *   - replacements 配列の各要素を seed-problems-w3 の ChoiceProblem 形式から
 *     DB の questionJson 形式に変換して update。
 *   - 各 replacement の `tags` から `V3-012R` 等の対象 problemId を抽出し、
 *     `problems.id` への `WHERE` で update。
 *
 * 動作:
 *   - 対象 id が存在しなければ throw (bulk モードでは failures に記録して続行)
 *   - update して updated_at を now にする
 *
 * 重要: 本番 DB を更新するため最小限のレビュー後に実行。
 *
 * 実行:
 *   - 単発: `cat new.json | PROBLEM_ID=v3_012 npm run ai:replace-problem`
 *   - bulk: `npm run ai:replace-problem -- --bulk`
 *           or `BULK=1 npm run ai:replace-problem`
 */

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { problems } from "../src/lib/db/schema";

export interface ReplaceProblemInput {
  questionJson: unknown;
  correctAnswer: string;
  explanation: string;
}

/**
 * 1 問差し替え (test 用に export)
 */
export async function replaceProblem(
  problemId: string,
  patch: ReplaceProblemInput,
): Promise<{ replaced: true }> {
  if (!problemId) {
    throw new Error("[replace-problem] problemId is required");
  }
   
  const existing = await db
    .select({ id: problems.id })
    .from(problems)
    .where(eq(problems.id, problemId))
    .limit(1);
  if (!existing[0]) {
    throw new Error(`[replace-problem] problemId not found: ${problemId}`);
  }
  await db
    .update(problems)
    .set({
      questionJson: patch.questionJson as never,
      correctAnswer: patch.correctAnswer,
      explanation: patch.explanation,
      updatedAt: new Date(),
    })
    .where(eq(problems.id, problemId));
  return { replaced: true };
}

// ---------------------------------------------------------------------------
// W4 / T-6a: bulk 適用モード
// ---------------------------------------------------------------------------

interface ReplacementSource {
  level: string;
  skill: string;
  prompt_text: string;
  choices: string[];
  correct_index: number;
  explanation_jp: string;
  tags: string[];
}

/** tags から `V3-012R` のような problemId 候補を抽出 (末尾の R は剥がす) */
export function extractTargetProblemIdFromTags(
  tags: ReadonlyArray<string>,
): string | null {
  for (const t of tags) {
    const m = /^([A-Z]{1,3}\d{1,2}-\d{2,4})R?$/.exec(t);
    if (m) {
      const baseId = m[1] ?? "";
      if (baseId) return baseId.toLowerCase().replace("-", "_");
    }
  }
  return null;
}

/** ChoiceProblem 形式から DB の questionJson 形式 (W2 と同じスキーマ) に変換 */
export function toDbQuestionJson(
  src: Pick<ReplacementSource, "prompt_text" | "choices">,
): unknown {
  return {
    prompt: src.prompt_text,
    choices: src.choices.map((text, i) => ({
      label: ["A", "B", "C", "D"][i] ?? "?",
      text,
    })),
  };
}

export interface BulkReplaceSummary {
  total: number;
  applied: number;
  skipped: number;
  failures: Array<{ tagsHint: string; reason: string }>;
}

/**
 * seed-problems-w3 の replacements 配列を一括適用。
 */
export async function bulkReplaceFromW3Replacements(
  replacements: ReadonlyArray<ReplacementSource>,
): Promise<BulkReplaceSummary> {
  const summary: BulkReplaceSummary = {
    total: replacements.length,
    applied: 0,
    skipped: 0,
    failures: [],
  };
  for (const r of replacements) {
    const targetId = extractTargetProblemIdFromTags(r.tags);
    if (!targetId) {
      summary.skipped += 1;
      summary.failures.push({
        tagsHint: r.tags.join(","),
        reason: "no problemId-like tag found",
      });
      continue;
    }
    const correctLabel = ["A", "B", "C", "D"][r.correct_index] ?? "A";
    try {
      await replaceProblem(targetId, {
        questionJson: toDbQuestionJson(r),
        correctAnswer: correctLabel,
        explanation: r.explanation_jp,
      });
      summary.applied += 1;
    } catch (err) {
      summary.skipped += 1;
      summary.failures.push({
        tagsHint: r.tags.join(","),
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return summary;
}

async function runBulk(): Promise<void> {
  const w3 = (await import("./seed-problems-w3")) as {
    default: { replacements: ReplacementSource[] };
  };
  const replacements = w3.default.replacements ?? [];
  if (replacements.length === 0) {
    console.log("[replace-problem][bulk] no replacements to apply");
    return;
  }
  console.log(
    `[replace-problem][bulk] applying ${replacements.length} replacements...`,
  );
  const summary = await bulkReplaceFromW3Replacements(replacements);
  console.log(
    `[replace-problem][bulk] done total=${summary.total} applied=${summary.applied} skipped=${summary.skipped}`,
  );
  if (summary.failures.length > 0) {
    console.warn(
      `[replace-problem][bulk] failures:\n${summary.failures
        .map((f) => `  - tags=${f.tagsHint} reason=${f.reason}`)
        .join("\n")}`,
    );
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function runSingle(): Promise<void> {
  const problemId = process.env.PROBLEM_ID;
  if (!problemId) {
    console.error("[replace-problem] PROBLEM_ID env required (or use --bulk)");
    process.exit(1);
  }
  const raw = await readStdin();
  if (!raw.trim()) {
    console.error("[replace-problem] empty stdin (expected JSON)");
    process.exit(1);
  }
  const patch = JSON.parse(raw) as ReplaceProblemInput;
  const result = await replaceProblem(problemId, patch);
  console.log(JSON.stringify(result));
}

async function main(): Promise<void> {
  const isBulk = process.argv.includes("--bulk") || process.env.BULK === "1";
  if (isBulk) {
    await runBulk();
    return;
  }
  await runSingle();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
