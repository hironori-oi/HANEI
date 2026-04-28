/**
 * scripts/generate-explanations-from-db.ts (W7 / B-9)
 *
 * 用途:
 *   production Turso DB に直接問い合わせて、解説 (problem_explanations) が
 *   未生成な problems を抽出 → AI で解説生成 → INSERT する。
 *
 * 背景 (DEC-039 / DEC-040):
 *   - 旧 generate-explanations-w3.ts は seed YAML/JSON が source-of-truth だが、
 *     production DB には seed YAML より多い問題が入っている。
 *     結果、reading_passage (R3-011..050 の 40 問 question) と
 *     listening (L4-021..100 の 76 問) が未生成のまま残っていた。
 *   - 本スクリプトは DB を source-of-truth とし、
 *     reading_passage_mcq の question 単位生成にも対応する。
 *
 * 環境変数:
 *   - LEVEL_FILTER  : "eiken-3" / "eiken-4" / "eiken-5" / "3" / "4" / "5" / 空
 *                     (problems.level_id "5"/"4"/"3" にマップ)
 *   - SKILL_FILTER  : DB skill_id 完全一致 (例: "reading-3" / "listening-4")
 *   - MAX_PROBLEMS  : 上限件数 (デフォルト 全件)
 *   - DRY_RUN       : "true" / "1" → 実 API を呼ばず cost 試算のみ
 *   - ADMIN_COST_CEILING_JPY : 1 run の JPY 上限 (default ¥500)
 *
 * cost-guard:
 *   - 1 run 累計コスト >= ADMIN_COST_CEILING_JPY で abort
 *   - idempotent: explanation 既存の problem は skip するので途中中断 OK / 再実行 OK
 *
 * 実行: `npm run ai:generate-explanations:from-db`
 *       `npm run ai:generate-explanations:from-db:reading-3`
 *       `npm run ai:generate-explanations:from-db:listening-4`
 *       `npm run ai:generate-explanations:from-db:dry`
 */

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { problemExplanations, problems } from "../src/lib/db/schema";
import { hasApiKey } from "../src/lib/ai/openai";
import {
  estimateCostJpy,
  generateOneExplanation,
  parsePassageQuestions,
  type GenerateInput,
} from "./lib/explanation-generator";

// ---------------------------------------------------------------------------
// 管理者用 cost ceiling (¥500 / 1 run)
// ---------------------------------------------------------------------------
const ADMIN_COST_CEILING_JPY = Number(
  process.env.ADMIN_COST_CEILING_JPY ?? 500,
);

// ---------------------------------------------------------------------------
// 型: DB から取得する未生成問題 row
// ---------------------------------------------------------------------------
export interface DbProblemRow {
  id: string;
  type:
    | "mcq"
    | "fill_in"
    | "reorder"
    | "listening_mcq"
    | "reading_passage_mcq"
    | "writing_essay";
  levelId: "5" | "4" | "3";
  skillId: string;
  questionJson: unknown;
  correctAnswer: string;
}

// ---------------------------------------------------------------------------
// (純粋関数) LEVEL_FILTER の正規化
// ---------------------------------------------------------------------------
export function normalizeLevelFilterToDb(raw: string): "5" | "4" | "3" | "" {
  const v = raw.trim();
  if (!v) return "";
  if (v === "5" || v === "4" || v === "3") return v;
  if (v === "eiken-5") return "5";
  if (v === "eiken-4") return "4";
  if (v === "eiken-3") return "3";
  return "";
}

// ---------------------------------------------------------------------------
// (純粋関数) DB rows から explanation 未生成のものに絞り込む。
// rawRows は LEFT JOIN 済を想定 (explanationId が null なら未生成)。
// ---------------------------------------------------------------------------
export interface JoinedRow {
  problem: DbProblemRow;
  explanationId: string | null;
}

export function extractMissingProblems(
  rawRows: ReadonlyArray<JoinedRow>,
): DbProblemRow[] {
  return rawRows.filter((r) => r.explanationId === null).map((r) => r.problem);
}

// ---------------------------------------------------------------------------
// (純粋関数) 単問形式 (mcq / listening_mcq / fill_in / writing_essay 等) の
// questionJson から GenerateInput を組み立てる。
//
// seed-problems-runner.ts の buildChoiceQuestionJson 形式:
//   { prompt, choices: [{label, text}], passage?, audioTranscript? }
// ---------------------------------------------------------------------------
export interface ChoiceQuestionJson {
  prompt?: string;
  choices?: ReadonlyArray<{ label?: string; text?: string }>;
  passage?: string;
  audioTranscript?: string;
}

export function buildChoiceInputFromDb(
  row: DbProblemRow,
): GenerateInput | null {
  const json = row.questionJson as ChoiceQuestionJson | null | undefined;
  if (!json || typeof json !== "object") return null;
  const promptText = typeof json.prompt === "string" ? json.prompt : "";
  const passage = typeof json.passage === "string" ? json.passage : "";
  const combinedPrompt = passage
    ? `[Passage]\n${passage}\n[Question]\n${promptText}`
    : promptText;
  const choices = Array.isArray(json.choices)
    ? json.choices.map((c) =>
        c && typeof c === "object" && typeof c.text === "string" ? c.text : "",
      )
    : [];
  // writing_essay 等 choices が空の場合は擬似 4 択で埋める
  const padded =
    choices.length > 0 ? choices : [row.correctAnswer || "(answer)", "", "", ""];
  return {
    prompt: combinedPrompt,
    choices: padded,
    correctAnswer: row.correctAnswer || "A",
  };
}

// ---------------------------------------------------------------------------
// DB から未生成 problem を全取得 (LEFT JOIN 済)
//
// 注意: Drizzle の leftJoin select は { problems: ..., problem_explanations: ... }
// 形式の row を返す。問題側のみ取り出して JoinedRow に整形する。
// ---------------------------------------------------------------------------
async function fetchMissingProblems(args: {
  levelDb: "5" | "4" | "3" | "";
  skill: string;
  limit: number;
}): Promise<DbProblemRow[]> {
  const conditions: ReturnType<typeof sql>[] = [
    sql`${problemExplanations.id} IS NULL`,
  ];
  if (args.levelDb) {
    conditions.push(sql`${problems.levelId} = ${args.levelDb}`);
  }
  if (args.skill) {
    conditions.push(sql`${problems.skillId} = ${args.skill}`);
  }
  const where = conditions.reduce(
    (acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`),
    sql``,
  );

  const rows = await db
    .select({
      id: problems.id,
      type: problems.type,
      levelId: problems.levelId,
      skillId: problems.skillId,
      questionJson: problems.questionJson,
      correctAnswer: problems.correctAnswer,
    })
    .from(problems)
    .leftJoin(
      problemExplanations,
      sql`${problemExplanations.problemId} = ${problems.id}`,
    )
    .where(where)
    .orderBy(problems.id);

  const sliced = rows.slice(0, args.limit);
  // type narrowing: Drizzle select の levelId は schema.ts の enum と一致
  return sliced.map((r) => ({
    id: r.id,
    type: r.type,
    levelId: r.levelId as "5" | "4" | "3",
    skillId: r.skillId,
    questionJson: r.questionJson,
    correctAnswer: r.correctAnswer,
  }));
}

// ---------------------------------------------------------------------------
// 1 件の explanation を INSERT する (idempotent)
// ---------------------------------------------------------------------------
async function insertExplanation(args: {
  problemId: string;
  text: string;
  /** reading_passage 等で 1 problem に複数 explanation を入れる場合は別 ID を持たせる */
  explanationIdSuffix?: string;
}): Promise<void> {
  await db.insert(problemExplanations).values({
    id: `pe_${randomUUID()}`,
    problemId: args.problemId,
    explanationText: args.text,
    generatedBy: "ai_coach",
  });
  // suffix は将来 question 単位の複数 explanation を区別する用途で予約 (現状未使用)
  void args.explanationIdSuffix;
}

// ---------------------------------------------------------------------------
// CLI エントリ
// ---------------------------------------------------------------------------
async function main() {
  const dryRun =
    process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";
  const maxN = process.env.MAX_PROBLEMS
    ? Number(process.env.MAX_PROBLEMS)
    : Number.POSITIVE_INFINITY;
  const levelFilterRaw = process.env.LEVEL_FILTER ?? "";
  const skillFilter = (process.env.SKILL_FILTER ?? "").trim();
  const levelDb = normalizeLevelFilterToDb(levelFilterRaw);

  // 接続先表示
  const dbUrl = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
  const dbKind = dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")
    ? "TURSO (remote)"
    : dbUrl.startsWith("file:")
      ? "LOCAL SQLite file"
      : "UNKNOWN";
  console.log(
    `[generate-from-db] connection=${dbKind} dryRun=${dryRun} ` +
      `ceiling=¥${ADMIN_COST_CEILING_JPY} ` +
      `levelFilter=${levelFilterRaw || "(none)"} skillFilter=${skillFilter || "(none)"}`,
  );

  // 早期 fail
  if (!dryRun && !hasApiKey()) {
    console.error(
      "[generate-from-db] OPENAI_API_KEY が未設定です。.env.local に OPENAI_API_KEY=sk-... を設定してください。",
    );
    process.exit(1);
  }

  // ---- DB 取得 ----
  const limit =
    maxN === Number.POSITIVE_INFINITY
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, Math.floor(maxN));
  const missing = await fetchMissingProblems({
    levelDb,
    skill: skillFilter,
    limit,
  });

  console.log(
    `[generate-from-db] missing problems = ${missing.length} (after filters / before MAX_PROBLEMS slice)`,
  );

  // reading_passage_mcq の question 数を集計し、生成総件数を出す
  const passageQCount = missing
    .filter((p) => p.type === "reading_passage_mcq")
    .reduce(
      (acc, p) => acc + parsePassageQuestions(p.questionJson).length,
      0,
    );
  const choiceQCount = missing.filter(
    (p) => p.type !== "reading_passage_mcq",
  ).length;
  console.log(
    `[generate-from-db] target explanations = choice(${choiceQCount}) + passageQ(${passageQCount}) = ${choiceQCount + passageQCount}`,
  );

  // ---- 生成ループ ----
  let runningCostJpy = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  outer: for (const p of missing) {
    try {
      // 念のため再確認 (race / 先行 run の途中再開時)
      const existing = await db
        .select({ id: problemExplanations.id })
        .from(problemExplanations)
        .where(eq(problemExplanations.problemId, p.id))
        .limit(1);
      if (existing[0] && p.type !== "reading_passage_mcq") {
        skipped += 1;
        continue;
      }

      // ---- reading_passage_mcq: question 単位で生成 ----
      if (p.type === "reading_passage_mcq") {
        const items = parsePassageQuestions(p.questionJson);
        if (items.length === 0) {
          skipped += 1;
          continue;
        }
        // すでに 1 件以上 explanation があれば skip (idempotent / 部分的に作っていた場合は手動再生成)
        if (existing[0]) {
          skipped += 1;
          continue;
        }
        // 全 question を 1 つの problem に対して explanation_text を結合して保存する。
        // (problem_explanations は 1:N 可だがクエリが煩雑になるため 1 件に圧縮)
        const parts: string[] = [];
        for (const it of items) {
          if (runningCostJpy >= ADMIN_COST_CEILING_JPY) {
            console.warn(
              `[generate-from-db] cost ceiling reached at passage q (¥${runningCostJpy.toFixed(2)} >= ¥${ADMIN_COST_CEILING_JPY}). abort.`,
            );
            break outer;
          }
          if (dryRun) {
            console.log(`[dry-run] would generate ${p.id}::q${it.index + 1}`);
            runningCostJpy += estimateCostJpy(200, 200);
            parts.push(`【質問${it.index + 1}】 [dry-run mock]`);
            continue;
          }
          try {
            const { text, tokensIn, tokensOut } = await generateOneExplanation(
              it.input,
            );
            const cost = estimateCostJpy(tokensIn, tokensOut);
            runningCostJpy += cost;
            parts.push(`【質問${it.index + 1}】\n${text}`);
            console.log(
              `[generate-from-db] ok ${p.id}::q${it.index + 1} cost=¥${cost.toFixed(2)} running=¥${runningCostJpy.toFixed(2)}`,
            );
          } catch (err) {
            failed += 1;
            const e = err as {
              usage?: { promptTokens?: number; completionTokens?: number };
              finishReason?: string;
            };
            const usage = e?.usage;
            if (
              usage?.promptTokens !== undefined &&
              usage?.completionTokens !== undefined
            ) {
              const failCost = estimateCostJpy(
                usage.promptTokens,
                usage.completionTokens,
              );
              runningCostJpy += failCost;
              console.error(
                `[generate-from-db] failed ${p.id}::q${it.index + 1} ` +
                  `finish=${e.finishReason ?? "?"} cost=¥${failCost.toFixed(2)} running=¥${runningCostJpy.toFixed(2)}`,
              );
            } else {
              console.error(
                `[generate-from-db] failed ${p.id}::q${it.index + 1}:`,
                err,
              );
            }
          }
        }
        if (parts.length > 0 && !dryRun) {
          await insertExplanation({
            problemId: p.id,
            text: parts.join("\n\n"),
          });
          inserted += 1;
        } else if (dryRun) {
          inserted += 1;
        }
        continue;
      }

      // ---- 単問形式 (mcq / listening_mcq / writing_essay / reorder / fill_in) ----
      const input = buildChoiceInputFromDb(p);
      if (!input) {
        console.warn(
          `[generate-from-db] questionJson が解釈不可 problem=${p.id} type=${p.type}`,
        );
        skipped += 1;
        continue;
      }

      if (runningCostJpy >= ADMIN_COST_CEILING_JPY) {
        console.warn(
          `[generate-from-db] cost ceiling reached: ¥${runningCostJpy.toFixed(2)} >= ¥${ADMIN_COST_CEILING_JPY}. abort.`,
        );
        break;
      }

      if (dryRun) {
        console.log(`[dry-run] would generate ${p.id} (type=${p.type})`);
        runningCostJpy += estimateCostJpy(200, 200);
        inserted += 1;
        continue;
      }

      try {
        const { text, tokensIn, tokensOut } = await generateOneExplanation(input);
        const cost = estimateCostJpy(tokensIn, tokensOut);
        runningCostJpy += cost;
        await insertExplanation({ problemId: p.id, text });
        inserted += 1;
        console.log(
          `[generate-from-db] ok ${p.id} type=${p.type} cost=¥${cost.toFixed(2)} running=¥${runningCostJpy.toFixed(2)}`,
        );
      } catch (err) {
        failed += 1;
        const e = err as {
          usage?: { promptTokens?: number; completionTokens?: number };
          finishReason?: string;
        };
        const usage = e?.usage;
        if (
          usage?.promptTokens !== undefined &&
          usage?.completionTokens !== undefined
        ) {
          const failCost = estimateCostJpy(
            usage.promptTokens,
            usage.completionTokens,
          );
          runningCostJpy += failCost;
          console.error(
            `[generate-from-db] failed ${p.id} ` +
              `finish=${e.finishReason ?? "?"} cost=¥${failCost.toFixed(2)} running=¥${runningCostJpy.toFixed(2)}`,
          );
        } else {
          console.error(`[generate-from-db] failed ${p.id}:`, err);
        }
      }
    } catch (outerErr) {
      failed += 1;
      const code =
        (outerErr as { code?: string; cause?: { code?: string } })?.code ??
        (outerErr as { cause?: { code?: string } })?.cause?.code ??
        "?";
      console.error(
        `[generate-from-db] outer error ${p.id} code=${code}: ` +
          `${(outerErr as Error)?.message ?? String(outerErr)}`,
      );
    }
  }

  console.log(
    `[generate-from-db] done inserted=${inserted} skipped=${skipped} failed=${failed} cost=¥${runningCostJpy.toFixed(2)}`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
