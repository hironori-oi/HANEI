/**
 * scripts/seed-problems-runner.ts (W4.5 / T-2)
 *
 * 用途:
 *   - W2 (200 問) + W3 (401 問 / choice 271 + writing 100 + reorder 30) +
 *     W4 (221 問 / choice 181 + reading-passage 40) +
 *     W5 (20 問 / choice 3 級 listening / DEC-079) = **計 842 問**
 *     を `problems` テーブルへ投入する admin スクリプト。
 *   - 各問題の自然 ID (V5-001 / G5-001 / L5-001 / V5W4-001 / L4-021 /
 *     R3-011 / W3-001 / O5-001 / V3-012R 等) は `seed-id-mapper.ts` から取得し、
 *     ソース seed ファイル (seed-problems-w2/w3/w4) は一切改変しない。
 *
 * 仕様:
 *   - 冪等: `INSERT OR IGNORE` 相当の `onConflictDoNothing()` で再実行安全
 *     (libSQL/SQLite で動作)
 *   - DRY_RUN=true / DRY_RUN=1 対応 (DB 書込なしで件数試算のみ)
 *   - TURSO_DATABASE_URL 未設定なら client.ts 側で `file:./local.db` にフォールバック
 *   - 出力: `inserted=X / skipped=Y / total=Z` を console.log
 *   - ID 重複検知は seed-id-mapper.ts の `loadAllSeedIds()` 内で実施 (早期 throw)
 *
 * カラムマッピング (seed → DB):
 *   - level "eiken-5"/"eiken-4"/"eiken-3"      → levelId "5"/"4"/"3"
 *   - skill "vocab"                            → skillId "vocabulary",  type "mcq"
 *   - skill "grammar"                          → skillId "grammar",     type "mcq"
 *   - skill "listening"/"listening-response"   → skillId "listening",   type "listening_mcq"
 *   - skill "reading"                          → skillId "reading",     type "mcq" (W2 短文)
 *                                                                       /  "reading_passage_mcq" (W4 passage)
 *   - skill "writing"                          → skillId "writing",     type "writing_essay"
 *   - skill "reorder"                          → skillId "reading",     type "reorder"
 *     (※ 並べ替えは reading 系として扱う / skills マスタに reorder は存在しない)
 *
 * 重要:
 *   - eiken_levels / skills マスタは前提として既に DB に存在している前提
 *     (drizzle migration の手動投入 or 別 seed)。
 *     未投入の場合は本スクリプト先頭で軽量 upsert を行う。
 *   - .env.local には TURSO_DATABASE_URL / TURSO_AUTH_TOKEN を設定済み想定。
 *
 * 実行: `npm run db:seed`
 *   オプション (環境変数):
 *     - DRY_RUN=true / DRY_RUN=1 : 集計のみ (DB 書込なし)
 *     - SEED_LEVELS_SKILLS=1     : eiken_levels / skills マスタも upsert する
 *                                  (初回 / migration 直後のみ推奨)
 */

import { db } from "../src/lib/db/client";
import {
  problems,
  eikenLevels,
  skills,
  type Problem,
} from "../src/lib/db/schema";
import {
  loadAllSeedIds,
  type SeedChoice,
  type SeedReadingPassage,
  type SeedWriting,
  type SeedReorder,
} from "./seed-id-mapper";
// W6 B-6: skill_id 変換は production / E2E fixture で共有 (DEC-038 補遺 #2)
import {
  mapSkillId as mapSkillIdShared,
  mapSkillCode as mapSkillCodeShared,
} from "../src/lib/study/skill-id-mapper";

// ---------------------------------------------------------------------------
// マスタ ID マッピング
// ---------------------------------------------------------------------------

/** seed level ("eiken-5" 等) → DB eiken_levels.id ("5" 等) */
function mapLevelId(seedLevel: string): "5" | "4" | "3" {
  switch (seedLevel) {
    case "eiken-5":
      return "5";
    case "eiken-4":
      return "4";
    case "eiken-3":
      return "3";
    default:
      throw new Error(`[seed-runner] unknown seed level: ${seedLevel}`);
  }
}

/**
 * seed skill ("vocab" 等) → DB skills.id
 *
 * W6 B-6: 実装は `src/lib/study/skill-id-mapper.ts` に集約。
 * 本ファイルは既存呼び出し元の (seedSkill, levelId) 順序を保つため
 * thin wrapper を維持する。
 *
 * 形式: `<base>-<level>` (例: "vocabulary-5")
 */
function mapSkillId(seedSkill: string, levelId: "5" | "4" | "3"): string {
  return mapSkillIdShared(levelId, seedSkill);
}

function mapSkillCode(
  seedSkill: string,
): "vocabulary" | "grammar" | "listening" | "reading" | "writing" {
  return mapSkillCodeShared(seedSkill);
}

/** seed skill → DB problems.type */
function mapProblemType(
  seedSkill: string,
  variant: "choice" | "passage" | "writing" | "reorder",
): Problem["type"] {
  if (variant === "writing") return "writing_essay";
  if (variant === "reorder") return "reorder";
  if (variant === "passage") return "reading_passage_mcq";
  // choice variant
  if (seedSkill === "listening" || seedSkill === "listening-response") {
    return "listening_mcq";
  }
  return "mcq";
}

/** "A"/"B"/"C"/"D" ラベル */
const LABELS = ["A", "B", "C", "D"] as const;

function labelFor(index: number): string {
  return LABELS[index] ?? "A";
}

// ---------------------------------------------------------------------------
// questionJson 構築
// ---------------------------------------------------------------------------

/**
 * 4 択型 (mcq / listening_mcq / W2 reading 短文 mcq) の questionJson。
 * replace-problem.ts の toDbQuestionJson と同型 (label/text 配列)。
 */
function buildChoiceQuestionJson(p: SeedChoice): Record<string, unknown> {
  const out: Record<string, unknown> = {
    prompt: p.prompt_text,
    choices: p.choices.map((text, i) => ({
      label: labelFor(i),
      text,
    })),
  };
  if (p.passage_text !== undefined) out["passage"] = p.passage_text;
  if (p.audio_transcript !== undefined) {
    out["audioTranscript"] = p.audio_transcript;
  }
  if (p.tags.length > 0) out["tags"] = p.tags;
  out["estimatedTimeSec"] = p.estimated_time_sec;
  out["difficulty"] = p.difficulty;
  return out;
}

/** writing_essay の questionJson */
function buildWritingQuestionJson(p: SeedWriting): Record<string, unknown> {
  return {
    prompt: p.prompt,
    modelAnswer: p.model_answer,
    wordCountMin: p.word_count_min,
    wordCountMax: p.word_count_max,
    estimatedTimeSec: p.estimated_time_sec,
    tags: p.tags,
    difficulty: p.difficulty,
  };
}

/** reorder の questionJson */
function buildReorderQuestionJson(p: SeedReorder): Record<string, unknown> {
  return {
    prompt: p.prompt_text,
    chunks: p.choices,
    correctOrder: p.correct_order,
    correctSentence: p.correct_sentence,
    estimatedTimeSec: p.estimated_time_sec,
    tags: p.tags,
    difficulty: p.difficulty,
  };
}

/** reading_passage_mcq の questionJson (1 passage に複数 question) */
function buildReadingPassageQuestionJson(
  p: SeedReadingPassage,
): Record<string, unknown> {
  return {
    passage: p.passage,
    wordCount: p.word_count,
    genre: p.genre,
    questions: p.questions.map((q) => ({
      prompt: q.question,
      choices: q.choices.map((text, i) => ({ label: labelFor(i), text })),
      correctAnswer: labelFor(q.correct_index),
      explanation: q.explanation_jp,
    })),
    estimatedTimeSec: p.estimated_time_sec,
    tags: p.tags,
    difficulty: p.difficulty,
  };
}

// ---------------------------------------------------------------------------
// マスタ upsert (option)
// ---------------------------------------------------------------------------

/**
 * eiken_levels / skills を冪等 upsert する (SEED_LEVELS_SKILLS=1 時のみ)。
 * levels: 5 / 4 / 3
 * skills: <code>-<level> (例: vocabulary-5 / grammar-4 / reading-3 / writing-3)
 */
async function seedLevelsAndSkills(): Promise<void> {
  const levelRows = [
    {
      id: "5",
      displayName: "英検 5 級",
      targetVocabCount: 600,
      description: "中学初級レベル",
    },
    {
      id: "4",
      displayName: "英検 4 級",
      targetVocabCount: 1300,
      description: "中学中級レベル",
    },
    {
      id: "3",
      displayName: "英検 3 級",
      targetVocabCount: 2100,
      description: "中学卒業レベル",
    },
  ] as const;

  for (const row of levelRows) {
    await db.insert(eikenLevels).values(row).onConflictDoNothing();
  }

  const skillCodes: ReadonlyArray<{
    code: "vocabulary" | "grammar" | "listening" | "reading" | "writing";
    displayName: string;
  }> = [
    { code: "vocabulary", displayName: "語彙" },
    { code: "grammar", displayName: "文法" },
    { code: "listening", displayName: "リスニング" },
    { code: "reading", displayName: "リーディング" },
    { code: "writing", displayName: "ライティング" },
  ];

  for (const lvl of levelRows) {
    for (const s of skillCodes) {
      await db
        .insert(skills)
        .values({
          id: `${s.code}-${lvl.id}`,
          eikenLevelId: lvl.id,
          displayName: `${lvl.displayName} ${s.displayName}`,
        })
        .onConflictDoNothing();
    }
  }
}

// ---------------------------------------------------------------------------
// 投入ロジック
// ---------------------------------------------------------------------------

interface RunSummary {
  inserted: number;
  skipped: number;
  total: number;
}

/**
 * 1 件 insert 試行。冪等のため `onConflictDoNothing()` を使用。
 * `inserted` は libSQL drizzle 結果から判断不能なため、insert 前に
 * SELECT して既存判定するのではなく、count(*) を前後で測る方式を採らず、
 * `RETURNING id` または insert の rowsAffected を使う。
 *
 * libSQL の drizzle .returning() を使って判定する。
 * (drizzle-orm v0.45 / libsql adapter で `.returning({ id: problems.id })`)
 */
async function insertOne(args: {
  id: string;
  levelId: string;
  skillId: string;
  type: Problem["type"];
  questionJson: unknown;
  correctAnswer: string;
  explanation: string;
  qualityScore: number;
}): Promise<{ inserted: boolean }> {
  const ret = await db
    .insert(problems)
    .values({
      id: args.id,
      levelId: args.levelId,
      skillId: args.skillId,
      type: args.type,
      questionJson: args.questionJson as never,
      correctAnswer: args.correctAnswer,
      explanation: args.explanation,
      generationQualityScore: args.qualityScore,
      qaVerdict: "pass",
      qaStatus: "live",
      source: "ai_generated",
    })
    .onConflictDoNothing()
    .returning({ id: problems.id });
  return { inserted: ret.length > 0 };
}

async function runSeed(dryRun: boolean): Promise<RunSummary> {
  const all = await loadAllSeedIds();
  console.log(
    `[seed-runner] loaded total=${all.total} (choice=${all.choiceProblems.length}, writing=${all.writingProblems.length}, reorder=${all.reorderProblems.length}, readingPassage=${all.readingPassageProblems.length}) dryRun=${dryRun}`,
  );

  let inserted = 0;
  let skipped = 0;

  // ---- 4 択型 (mcq / listening_mcq / W2 reading 短文 mcq) ----
  for (const p of all.choiceProblems) {
    const levelId = mapLevelId(p.level);
    const skillId = mapSkillId(p.skill, levelId);
    const type = mapProblemType(p.skill, "choice");
    const correctAnswer = labelFor(p.correct_index);
    const questionJson = buildChoiceQuestionJson(p);

    if (dryRun) {
      console.log(
        `[dry-run] would insert id=${p.id} level=${levelId} skill=${skillId} type=${type}`,
      );
      inserted += 1; // dry-run 上の「投入予定」として加算 (実 DB は触らない)
      continue;
    }
    const r = await insertOne({
      id: p.id,
      levelId,
      skillId,
      type,
      questionJson,
      correctAnswer,
      explanation: p.explanation_jp,
      qualityScore: p.generated_quality_score,
    });
    if (r.inserted) inserted += 1;
    else skipped += 1;
  }

  // ---- writing_essay ----
  for (const p of all.writingProblems) {
    const levelId = mapLevelId(p.level);
    const skillId = mapSkillId(p.skill, levelId);
    const type = mapProblemType(p.skill, "writing");
    if (dryRun) {
      console.log(
        `[dry-run] would insert id=${p.id} level=${levelId} skill=${skillId} type=${type}`,
      );
      inserted += 1;
      continue;
    }
    const r = await insertOne({
      id: p.id,
      levelId,
      skillId,
      type,
      questionJson: buildWritingQuestionJson(p),
      correctAnswer: p.model_answer,
      explanation: `[Writing model answer] ${p.model_answer}`,
      qualityScore: p.generated_quality_score,
    });
    if (r.inserted) inserted += 1;
    else skipped += 1;
  }

  // ---- reorder ----
  for (const p of all.reorderProblems) {
    const levelId = mapLevelId(p.level);
    const skillId = mapSkillId(p.skill, levelId);
    const type = mapProblemType(p.skill, "reorder");
    if (dryRun) {
      console.log(
        `[dry-run] would insert id=${p.id} level=${levelId} skill=${skillId} type=${type}`,
      );
      inserted += 1;
      continue;
    }
    const r = await insertOne({
      id: p.id,
      levelId,
      skillId,
      type,
      questionJson: buildReorderQuestionJson(p),
      correctAnswer: p.correct_order.join(","),
      explanation: p.explanation_jp,
      qualityScore: p.generated_quality_score,
    });
    if (r.inserted) inserted += 1;
    else skipped += 1;
  }

  // ---- reading_passage_mcq ----
  for (const p of all.readingPassageProblems) {
    const levelId = mapLevelId(p.level);
    const skillId = mapSkillId(p.skill, levelId);
    const type = mapProblemType(p.skill, "passage");
    // 複数 question を 1 行にまとめるため、correctAnswer は先頭問題の正解ラベル + 番号で表現
    const firstQ = p.questions[0];
    const correctAnswer = firstQ
      ? p.questions.map((q) => labelFor(q.correct_index)).join(",")
      : "A";
    const explanation = p.questions
      .map((q, i) => `Q${i + 1}: ${q.explanation_jp}`)
      .join("\n");
    if (dryRun) {
      console.log(
        `[dry-run] would insert id=${p.id} level=${levelId} skill=${skillId} type=${type}`,
      );
      inserted += 1;
      continue;
    }
    const r = await insertOne({
      id: p.id,
      levelId,
      skillId,
      type,
      questionJson: buildReadingPassageQuestionJson(p),
      correctAnswer,
      explanation,
      qualityScore: p.generated_quality_score,
    });
    if (r.inserted) inserted += 1;
    else skipped += 1;
  }

  return { inserted, skipped, total: all.total };
}

// ---------------------------------------------------------------------------
// CLI エントリ
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const dryRun =
    process.env["DRY_RUN"] === "true" || process.env["DRY_RUN"] === "1";
  const seedMaster = process.env["SEED_LEVELS_SKILLS"] === "1";

  // DEC-028: 接続先 URL を必ず 1 行表示し、誤接続を即時検知できるようにする
  // (DEC-027 で「Turso のつもりが local.db に push していた」事象が発生したため)
  const dbUrl = process.env["TURSO_DATABASE_URL"] ?? "file:./local.db";
  const dbKind = dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")
    ? "TURSO (remote)"
    : dbUrl.startsWith("file:")
      ? "LOCAL SQLite file"
      : "UNKNOWN";
  // URL 内の auth token 等が含まれていても安全な形に redact
  const safeUrl = dbUrl.replace(/(authToken|password|token)=[^&]*/gi, "$1=<REDACTED>");
  console.log(`[seed-runner] connection: kind=${dbKind} url=${safeUrl}`);

  if (seedMaster && !dryRun) {
    console.log("[seed-runner] upserting eiken_levels / skills masters...");
    await seedLevelsAndSkills();
  } else if (seedMaster && dryRun) {
    console.log(
      "[seed-runner] (dry-run) would upsert eiken_levels (3 rows) + skills (15 rows)",
    );
  }

  const summary = await runSeed(dryRun);
  console.log(
    `[seed-runner] done inserted=${summary.inserted} skipped=${summary.skipped} total=${summary.total}`,
  );

  if (summary.total !== 842) {
    console.warn(
      `[seed-runner] WARNING: total=${summary.total} (expected 842). seed-id-mapper の採番ロジックに変更があった可能性があります。`,
    );
  }
}

// テスト用に各種 helper を re-export
export {
  mapLevelId,
  mapSkillId,
  mapSkillCode,
  mapProblemType,
  buildChoiceQuestionJson,
  buildWritingQuestionJson,
  buildReorderQuestionJson,
  buildReadingPassageQuestionJson,
  runSeed,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
