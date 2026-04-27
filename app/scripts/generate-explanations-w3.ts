/**
 * scripts/generate-explanations-w3.ts (W3 / T-3)
 *
 * 用途: seed-problems-w2 (200 問) + seed-problems-w3 (400 問 / Research が後で追加)
 *       計 600 問の誤答解説を gpt-5-mini で bulk 生成し problem_explanations に insert。
 *
 * 各問題ごとに:
 *  - 正解の理由
 *  - 各誤答選択肢が誤りの理由 (3 つ)
 *  - 子ども向け補足解説
 * を 1 件の explanation_text にまとめて保存する。
 *
 * cost-guard:
 *  - 1 回の実行で総額 ¥500 を超えそうなら中断
 *  - これは「学習者個別の ¥10/日 上限」とは別の管理者用上限
 *
 * 重要:
 *   ※ 実 OpenAI API 課金が発生するため Agent 環境では絶対に実行しない。
 *      実装のみで完了とし、オーナーが後でローカルから `npm run ai:generate-explanations`
 *      で実行する。
 *
 * 実行: `npm run ai:generate-explanations`
 *   オプション (環境変数):
 *     - DRY_RUN=true : OpenAI を呼ばずに件数試算のみ
 *     - MAX_PROBLEMS=10 : 動作確認用に上限を絞る
 *     - LEVEL_FILTER=eiken-5 : 級で絞り込み (eiken-5 / eiken-4 / eiken-3 / 5 / 4 / 3)
 *     - SKILL_FILTER=vocab : スキルで絞り込み
 *         (vocab / grammar / listening / listening-response / reading / writing / reorder)
 *     - ADMIN_COST_CEILING_JPY=2000 : 1 run の JPY 上限 (default ¥500)
 *
 * DEC-031 (W4.5 / B プラン / 段階生成):
 *   gpt-5-mini の reasoning_tokens 込み実コストが見積もりの 22 倍になり
 *   1 run ¥500 上限で 44/822 件しか進まなかった。
 *   MVP 用 5 級 vocab を最優先で完成させるため、level/skill フィルタを追加。
 *   stage1: LEVEL_FILTER=eiken-5 SKILL_FILTER=vocab で 160 問だけ。
 */

import { z } from "zod";
import { generateObject } from "ai";
import { randomUUID } from "node:crypto";
import { primaryModel, hasApiKey } from "../src/lib/ai/openai";
import { db } from "../src/lib/db/client";
import { problemExplanations, problems } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { estimateCostJpy } from "../src/lib/ai/cost-guard";
import { loadAllSeedIds } from "./seed-id-mapper";

// ---------------------------------------------------------------------------
// 管理者用 cost ceiling (¥500 / 1 run)
// ---------------------------------------------------------------------------
const ADMIN_COST_CEILING_JPY = Number(
  process.env.ADMIN_COST_CEILING_JPY ?? 500,
);

// ---------------------------------------------------------------------------
// 出力スキーマ
// ---------------------------------------------------------------------------
const ExplanationSchema = z.object({
  correctReason: z.string().describe("正解選択肢が正しい理由 (子ども向けやさしい日本語 / 80字以内)"),
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
type Explanation = z.infer<typeof ExplanationSchema>;

interface ProblemSeed {
  id: string;
  prompt: string;
  choices: string[];
  correctAnswer: string;
  /** "eiken-5" | "eiken-4" | "eiken-3" (level filter 用) */
  level: string;
  /** "vocab" | "grammar" | "listening" | "listening-response" | "reading" | "writing" | "reorder" */
  skill: string;
}

// ---------------------------------------------------------------------------
// 1 問あたり生成
// ---------------------------------------------------------------------------
async function generateOne(p: ProblemSeed): Promise<{
  text: string;
  tokensIn: number;
  tokensOut: number;
}> {
  const system = `
あなたは英検5〜3級レベルの英語問題に「子ども向けの誤答解説」を書く先生です。
小学生でも分かる日本語のですます調で、優しく、断定的に書いてください。
絵文字や顔文字は禁止です。
`.trim();

  const userPrompt = `
問題: ${p.prompt}
選択肢: ${p.choices.map((c, i) => `${["A", "B", "C", "D"][i]}: ${c}`).join(" / ")}
正解: ${p.correctAnswer}

上記の問題について、以下の構造で出力してください:
  - correctReason: 正解の理由
  - wrongReasons: 誤答 2〜3 つの理由
  - kidNote: 覚え方のコツ
`.trim();

  if (!hasApiKey()) {
    // ローカル fixture (DRY_RUN 用)
    return {
      text: `[mock] ${p.prompt} の解説 (correct=${p.correctAnswer})`,
      tokensIn: 200,
      tokensOut: 200,
    };
  }

  // DEC-033 (2026-04-27 / W4.5):
  //   gpt-5-mini は内部で reasoning_tokens を消費し、これは
  //   max_completion_tokens(=AI SDK の maxTokens) の中から差し引かれる。
  //   maxTokens=600 では reasoning が 600 を食い切って実出力 0 → JSON parse 失敗
  //   ("finishReason":"length", text:"") が量産されていた (stage 1 で 122/160 件失敗)。
  //   出力本体は ~150 tokens で十分なので、reasoning 用に 4000 まで余裕を持たせる。
  //   実コスト試算: 4000 completion × $2/M = $0.008/件 ≒ ¥1.2/件 (上限値)。
  //   実際には reasoning も全使用しないので平均 ¥0.5〜1.0/件 想定。
  const result = await generateObject({
    model: primaryModel(),
    schema: ExplanationSchema,
    system,
    prompt: userPrompt,
    maxTokens: 4000,
  });
  const obj: Explanation = result.object;
  const text = [
    `【正解の理由】 ${obj.correctReason}`,
    "【誤答の理由】",
    ...obj.wrongReasons.map((w) => `  - ${w.choice}: ${w.reason}`),
    `【覚えるコツ】 ${obj.kidNote}`,
  ].join("\n");

  // AI SDK の usage は result.usage にある (promptTokens / completionTokens)
  const usage = result.usage;
  return {
    text,
    tokensIn: usage?.promptTokens ?? 200,
    tokensOut: usage?.completionTokens ?? 200,
  };
}

// ---------------------------------------------------------------------------
// 入力ソース読み込み (seed-id-mapper で自然 ID 採番済の choice 問題を使用)
//
// W4.5 / T-3:
//   旧実装は `seed_0000` のような fake ID を生成していたが、これは DB の
//   problems.id (V5-001 等の自然 ID) と一致せず全件 skip となっていた。
//   修正: seed-id-mapper.loadAllSeedIds() を経由して
//         choiceProblems / writingProblems / reorderProblems を吸い上げ、
//         DB に登録された自然 ID と完全一致させる。
//   reading-passage は質問が複数あり 1 件の解説テキストに圧縮しづらいため、
//   現状は除外 (passage 専用 explanation は別マイルストーンで対応)。
// ---------------------------------------------------------------------------
async function loadSeedProblems(): Promise<ProblemSeed[]> {
  const all = await loadAllSeedIds();
  const out: ProblemSeed[] = [];

  // 4 択型 (mcq / listening_mcq / W2 reading 短文)
  for (const p of all.choiceProblems) {
    out.push({
      id: p.id,
      prompt: p.prompt_text,
      choices: p.choices,
      correctAnswer: ["A", "B", "C", "D"][p.correct_index] ?? "A",
      level: p.level,
      skill: p.skill,
    });
  }

  // writing は選択肢が無いため、prompt + model_answer を擬似 4 択として扱わない
  // 代わりに「正解解説」フィールドのみで explanation を生成する用に擬似 choices を埋める
  for (const p of all.writingProblems) {
    out.push({
      id: p.id,
      prompt: p.prompt,
      choices: [p.model_answer, "", "", ""],
      correctAnswer: "A",
      level: p.level,
      skill: p.skill,
    });
  }

  // reorder は並び順だが、子ども向け解説は correct_sentence を A 扱いで生成
  for (const p of all.reorderProblems) {
    out.push({
      id: p.id,
      prompt: p.prompt_text,
      choices: [p.correct_sentence, ...p.choices.slice(0, 3)],
      correctAnswer: "A",
      level: p.level,
      skill: p.skill,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// LEVEL / SKILL フィルタ (DEC-031 / B プラン段階生成)
//
// LEVEL_FILTER:
//   - "eiken-5" / "eiken-4" / "eiken-3" : 完全一致
//   - "5" / "4" / "3"                   : 自動で `eiken-${n}` に変換
//   - 未指定 (空文字)                  : フィルタしない
//
// SKILL_FILTER:
//   - 完全一致。SKILL_FILTER=listening は "listening" のみマッチ
//     (eiken-4 の "listening-response" はマッチしないので注意)
//   - 未指定 (空文字)                  : フィルタしない
// ---------------------------------------------------------------------------
function normalizeLevelFilter(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (v === "5" || v === "4" || v === "3") return `eiken-${v}`;
  return v;
}

function applyFilters(
  seeds: ProblemSeed[],
  levelFilter: string,
  skillFilter: string,
): ProblemSeed[] {
  const normalizedLevel = normalizeLevelFilter(levelFilter);
  const normalizedSkill = skillFilter.trim();
  return seeds.filter((s) => {
    if (normalizedLevel && s.level !== normalizedLevel) return false;
    if (normalizedSkill && s.skill !== normalizedSkill) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// CLI エントリ (W4 / T-6b: DRY_RUN=1 を default 推奨化)
// ---------------------------------------------------------------------------
//
// DRY_RUN モード仕様:
//   - 実 OpenAI API は呼ばない (mock な出力を保存しない)
//   - 既存解説の有無 / 問題本体の存在チェックは行う
//   - cost を `estimateCostJpy(200, 200)` の固定値で積算 → 全件 (600 問) で ¥180〜360
//     のオーダ感をオーナー報告できるようにする
//   - 上限到達でも実 API 呼び出しが無いので「天井に到達した」ことを早期検知できる
//   - W4 では `MAX_PROBLEMS=10 DRY_RUN=true npm run ai:generate-explanations` を
//     試走想定。DRY_RUN=1 (number) も拾うように parse を寛容化。
//
async function main() {
  const dryRun =
    process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";
  const maxN = process.env.MAX_PROBLEMS
    ? Number(process.env.MAX_PROBLEMS)
    : Number.POSITIVE_INFINITY;
  const levelFilter = process.env.LEVEL_FILTER ?? "";
  const skillFilter = process.env.SKILL_FILTER ?? "";

  const allSeeds = await loadSeedProblems();
  const filtered = applyFilters(allSeeds, levelFilter, skillFilter);
  const seeds = filtered.slice(0, maxN);
  console.log(
    `[generate-explanations-w3] all=${allSeeds.length} filtered=${filtered.length} target=${seeds.length} ` +
      `dryRun=${dryRun} ceiling=¥${ADMIN_COST_CEILING_JPY} ` +
      `levelFilter=${levelFilter || "(none)"} skillFilter=${skillFilter || "(none)"}`,
  );

  // 早期 fail: dryRun 以外で API key 不在なら即終了
  if (!dryRun && !hasApiKey()) {
    console.error(
      "[generate-explanations-w3] OPENAI_API_KEY が未設定です。.env.local に OPENAI_API_KEY=sk-... を設定してください。",
    );
    console.error(
      "[generate-explanations-w3] (試走したい場合は DRY_RUN=true を付けて実行してください)",
    );
    process.exit(1);
  }

  let runningCostJpy = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of seeds) {
    // DEC-034 (W4.5 / 2026-04-27):
    //   per-iteration の全体を try/catch で包む。
    //   旧構造では existing-check / problem-row check の SELECT が Turso 接続 retry を
    //   全消費して throw した時に main() ごと死亡し、残り全件が処理されなくなっていた
    //   (B プラン step 2 で L5-013 以降が落ちて 10 件不足したのが実害)。
    //   どこで throw しても loop を継続し failed カウンタに加算する。
    try {
      // 1. 既に解説があればスキップ (冪等)
       
      const existing = await db
        .select({ id: problemExplanations.id })
        .from(problemExplanations)
        .where(eq(problemExplanations.problemId, p.id))
        .limit(1);
      if (existing[0]) {
        skipped += 1;
        continue;
      }

      // 2. 問題本体が DB にあるか確認 (無ければ skip)
       
      const probRow = await db
        .select({ id: problems.id })
        .from(problems)
        .where(eq(problems.id, p.id))
        .limit(1);
      if (!probRow[0]) {
        skipped += 1;
        continue;
      }

      // 3. cost ceiling check
      if (runningCostJpy >= ADMIN_COST_CEILING_JPY) {
        console.warn(
          `[generate-explanations-w3] cost ceiling reached: ¥${runningCostJpy.toFixed(2)} >= ¥${ADMIN_COST_CEILING_JPY}. abort.`,
        );
        break;
      }

      // 4. 生成
      if (dryRun) {
        console.log(`[dry-run] would generate for ${p.id}`);
        runningCostJpy += estimateCostJpy(200, 200);
        continue;
      }

      try {
        const { text, tokensIn, tokensOut } = await generateOne(p);
        const cost = estimateCostJpy(tokensIn, tokensOut);
        runningCostJpy += cost;

        // 5. insert
        await db.insert(problemExplanations).values({
          id: `pe_${randomUUID()}`,
          problemId: p.id,
          explanationText: text,
          generatedBy: "ai_coach",
        });
        inserted += 1;
        console.log(
          `[generate-explanations-w3] ok problem=${p.id} cost=¥${cost.toFixed(2)} running=¥${runningCostJpy.toFixed(2)}`,
        );
      } catch (err) {
        // DEC-033: 失敗時も OpenAI は課金されているので usage を抽出して running cost に加算
        // (AI SDK の AI_NoObjectGeneratedError は err.usage / err.response を持つ)
        failed += 1;
        const e = err as {
          usage?: { promptTokens?: number; completionTokens?: number };
          finishReason?: string;
        };
        const usage = e?.usage;
        if (usage?.promptTokens !== undefined && usage?.completionTokens !== undefined) {
          const failCost = estimateCostJpy(usage.promptTokens, usage.completionTokens);
          runningCostJpy += failCost;
          console.error(
            `[generate-explanations-w3] failed for ${p.id} ` +
              `finish=${e.finishReason ?? "?"} ` +
              `usage(p=${usage.promptTokens},c=${usage.completionTokens}) ` +
              `cost=¥${failCost.toFixed(2)} running=¥${runningCostJpy.toFixed(2)}`,
          );
        } else {
          console.error(`[generate-explanations-w3] failed for ${p.id}:`, err);
        }
      }
    } catch (outerErr) {
      // DEC-034: existing-check / problem-row check / その他想定外の throw を吸収
      // ループは継続し、当該問題は失敗としてカウント
      failed += 1;
      const code = (outerErr as { code?: string; cause?: { code?: string } })?.code
        ?? (outerErr as { cause?: { code?: string } })?.cause?.code
        ?? "?";
      console.error(
        `[generate-explanations-w3] outer error for ${p.id} code=${code}: ` +
          `${(outerErr as Error)?.message ?? String(outerErr)}`,
      );
    }
  }

  console.log(
    `[generate-explanations-w3] done inserted=${inserted} skipped=${skipped} failed=${failed} cost=¥${runningCostJpy.toFixed(2)}`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
