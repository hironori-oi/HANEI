/**
 * HANEI - E2E in-memory libSQL Fixture (W3 / T-1)
 *
 * 目的:
 *  - Playwright E2E が Turso 本番に依存せず、各テスト前に in-memory libSQL に
 *    25 テーブル + 最小 seed (family / parent user / learner profile / 5級語彙 5 問)
 *    を立て直せるようにする
 *
 * 利用方針:
 *  - playwright.config.ts の globalSetup でこの fixture を起動
 *  - `TURSO_DATABASE_URL=":memory:"` または `file::memory:?cache=shared` を環境に投入
 *  - 各 spec の beforeEach 相当で `seedFixture()` を呼ぶ (test serial 推奨)
 *
 * 注意:
 *  - 本ファイルは「fixture を立てて in-memory DB に schema + seed を流す」だけを担う。
 *    実 API (OpenAI / Resend / R2) は呼ばない。
 *  - `:memory:` では libSQL の同一プロセス内でしか共有できないため、Next.js 側の
 *    db client (src/lib/db/client.ts) と Playwright runner が同一プロセスでないと
 *    seed が見えない。本 W3 では「fixture が立つ + spec がそのまま spec を流せる」
 *    レベルまでで完了とし、SSR 側からの読み出しを伴う本格 E2E は webServer の
 *    DB を別途指定する形で W4 以降に拡張する (申し送り)。
 */

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../../src/lib/db/schema";
// W6 B-6: skill_id 形式 ("<base>-<level>") は production seed と共有モジュール経由で揃える。
// production canonical の `mapSkillId(level, seedSkill)` をそのまま借用することで、
// fixture と production data の skill_id 乖離 (DEC-038 補遺 #2 の silent breakage 原因) を
// 構造的に防止する。
import { mapSkillId } from "../../../src/lib/study/skill-id-mapper";

export interface DbFixture {
  client: Client;
  db: ReturnType<typeof drizzle<typeof schema>>;
  url: string;
}

/**
 * SQLite/libSQL 用 DDL を 1 ファイルにまとめた最小スキーマ。
 * drizzle のマイグレーション SQL (drizzle/0000_initial.sql + 0001_w2_extensions.sql)
 * を順に流すのが本筋だが、E2E fixture は Node から直接 createClient で叩くので
 * fs.readFile + execMultiple で逐次実行する。
 */
export async function applyMigrations(client: Client): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const migrationsDir = path.resolve(__dirname, "../../../drizzle");
  const files = [
    "0000_initial.sql",
    "0001_w2_extensions.sql",
    // W8 (Phase 2 第1週): learner_profiles.daily_goal_xp + preferences
    "0003_w8_daily_goal.sql",
    "0004_w8_preferences.sql",
    // W9 (Phase 2 第2週): accessories + badges seed + parent_messages
    "0006_w9_accessories.sql",
    "0007_w9_badges_seed.sql",
    "0008_w9_parent_messages.sql",
    "0009_w9_accessories_seed.sql",
    // W10 (Phase 2 第3週): ハネキン (はね金) 経済 foundation
    "0010_w10_coin_economy.sql",
    // W10-T2: Shop inventory (Streak Freeze + kotodama feed)
    "0011_w10_shop_inventory.sql",
    // W10-T3: Daily Quest (デイリーミッション lazy generation)
    "0012_w10_daily_quests.sql",
    // W10-T4: coin_transactions 冪等チェック partial UNIQUE INDEX (DEC-055 補強)
    "0013_w10_coin_idempotency_unique.sql",
    // W10-T5: study_sessions テーブル新設 (過学習防止 / 「今日 X 分」可視化)
    "0014_w10_study_sessions.sql",
    // W11-T1: families.family_streak_days + families.last_family_active_date (家族のれんぞく)
    "0015_w11_family_streak.sql",
  ];
  for (const f of files) {
    const fp = path.join(migrationsDir, f);
    const sql = await fs.readFile(fp, "utf-8");
    // drizzle の出力 SQL は `--> statement-breakpoint` で区切られている。
    // 区切りが無いケース (W1 manual) はファイル全体を 1 マイグレーションとして
    // セミコロンで分割する。
    // 1. 行コメント (-- ...) を全行から剥がす (split のときに先頭が "--" になって
    //    丸ごと filter で落ちる事故を防ぐため)。文字列リテラル内の `--` までは
    //    除去しないが、本 migration 内に該当する文字列リテラルは存在しない。
    const stripped = sql
      .split(/\r?\n/)
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n");
    const statements = stripped
      .split(/-->\s*statement-breakpoint|;\s*\n/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err) {
        // CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS なので冪等。
        // SQLite/libSQL は ALTER TABLE ADD COLUMN に IF NOT EXISTS が無いので、
        // 0001 で追加された state カラム等の `duplicate column name` も握り潰す。
        // (DEC-037 G-6 fix: globalSetup の fs.unlink が race / Playwright reuse で
        //  失敗したケースでも fixture を冪等に立て直せるようにする)
        const msg = err instanceof Error ? err.message : String(err);
        const benign =
          /already exists/i.test(msg) || /duplicate column name/i.test(msg);
        if (!benign) throw err;
      }
    }
  }
}

/**
 * 最小 seed (E2E が前提とする最小データ)。
 *  - 1 family
 *  - 1 parent user (consents 済 / email_verified=true)
 *  - 1 learner profile (eiken5)
 *  - eiken_levels マスタ ('5')
 *  - skills マスタ ('vocabulary')
 *  - problems 5 問 (5級 vocab / qa_status='live')
 */
export async function seedFixture(client: Client): Promise<{
  familyId: string;
  parentUserId: string;
  parentEmail: string;
  parentPasswordPlain: string;
  learnerId: string;
}> {
  const familyId = "fam_e2e_001";
  const parentUserId = "usr_e2e_parent_001";
  const learnerId = "lp_e2e_001";
  const parentEmail = "parent.e2e@hanei.test";
  const parentPasswordPlain = "test-password-e2e";

  // 既存 seed を全削除 (冪等)
  for (const tbl of [
    // W10-T5: study_sessions も flush (signup 起点の E2E は learner_id 別なので必須ではないが安全側)
    "study_sessions",
    // W10-T3: Daily Quest 行も flush (signup 起点の E2E は learner_id 別なので必須ではないが安全側)
    "daily_quests",
    "user_badges",
    "ai_coach_messages",
    "ai_coach_conversations",
    "answer_logs",
    "srs_states",
    "problem_explanations",
    "problems",
    "skills",
    "eiken_levels",
    "exam_dates",
    "mastery_estimates",
    "mock_exam_results",
    "characters",
    "xp_levels",
    "streaks",
    "daily_plans",
    "parent_consents",
    "learner_profiles",
    "family_members",
    "verifications",
    "accounts",
    "sessions",
    "users",
    "families",
    "badges",
    "generated_problems_queue",
  ]) {
    try {
      await client.execute(`DELETE FROM ${tbl}`);
    } catch {
      // テーブルが無い場合 (まだ migrate されていない fresh db) は無視
    }
  }

  // families
  await client.execute({
    sql: `INSERT INTO families (id, display_name, plan) VALUES (?, ?, ?)`,
    args: [familyId, "E2E Family", "free"],
  });

  // users (parent)
  await client.execute({
    sql: `INSERT INTO users (id, email, email_verified, name, role) VALUES (?, ?, ?, ?, ?)`,
    args: [parentUserId, parentEmail, 1, "E2E 保護者", "parent"],
  });

  // family_members
  await client.execute({
    sql: `INSERT INTO family_members (id, family_id, user_id, role) VALUES (?, ?, ?, ?)`,
    args: ["fm_e2e_001", familyId, parentUserId, "parent"],
  });

  // parent_consents (3 種を最低 1 行ずつ)
  for (const [idx, kind] of (["coppa_initial", "ai_chat", "terms"] as const).entries()) {
    await client.execute({
      sql: `INSERT INTO parent_consents (id, family_id, parent_user_id, consent_type, consent_version) VALUES (?, ?, ?, ?, ?)`,
      args: [`pc_e2e_${idx}`, familyId, parentUserId, kind, "v1"],
    });
  }

  // learner_profiles
  await client.execute({
    sql: `INSERT INTO learner_profiles (id, family_id, nickname, avatar_id, current_level, target_eiken_level, daily_minutes_target) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [learnerId, familyId, "たろう", "kotodama_tori", "eiken5", "5", 60],
  });

  // eiken_levels マスタ (W6 B-5: 5 / 4 / 3 級すべてを seeding)
  const eikenLevelRows: ReadonlyArray<
    [id: "5" | "4" | "3", displayName: string, vocab: number, desc: string]
  > = [
    ["5", "英検5級", 600, "中学初級レベル"],
    ["4", "英検4級", 1300, "中学中級レベル"],
    ["3", "英検3級", 2100, "中学卒業レベル"],
  ];
  for (const [id, displayName, vocab, desc] of eikenLevelRows) {
    await client.execute({
      sql: `INSERT INTO eiken_levels (id, display_name, target_vocab_count, description) VALUES (?, ?, ?, ?)`,
      args: [id, displayName, vocab, desc],
    });
  }

  // skills マスタ
  // W6 B-5 / B-6: production canonical の level 付き形式 ("vocabulary-5" / "reading-4" 等)
  // を src/lib/study/skill-id-mapper.ts 経由で組み立てる。
  // E2E は vocab + reading のみカバー (listening は TTS 音源が必要なので除外)。
  const skillSeedTargets: ReadonlyArray<{
    level: "5" | "4" | "3";
    seedSkill: "vocab" | "reading" | "writing";
    displayName: string;
  }> = [
    { level: "5", seedSkill: "vocab", displayName: "英検 5 級 語彙" },
    { level: "5", seedSkill: "reading", displayName: "英検 5 級 読解" },
    { level: "4", seedSkill: "vocab", displayName: "英検 4 級 語彙" },
    { level: "4", seedSkill: "reading", displayName: "英検 4 級 読解" },
    { level: "3", seedSkill: "vocab", displayName: "英検 3 級 語彙" },
    { level: "3", seedSkill: "reading", displayName: "英検 3 級 読解" },
    // W7 B-10: writing_essay UI スモーク用
    { level: "3", seedSkill: "writing", displayName: "英検 3 級 ライティング" },
  ];
  for (const s of skillSeedTargets) {
    await client.execute({
      sql: `INSERT INTO skills (id, eiken_level_id, display_name) VALUES (?, ?, ?)`,
      args: [mapSkillId(s.level, s.seedSkill), s.level, s.displayName],
    });
  }

  // problems
  // 5 級 vocab は W5 までの 5 問を維持 (既存 study-smoke.spec.ts の prompt 表示テスト互換)。
  // 5 級 reading + 4 級 vocab/reading + 3 級 vocab/reading に対し各 3 問ずつ追加。
  type SeedProblem = {
    id: string;
    level: "5" | "4" | "3";
    seedSkill: "vocab" | "reading";
    prompt: string;
    choices: [string, string, string, string];
    correct: "A" | "B" | "C" | "D";
    explanation: string;
  };

  const buildBatch = (
    level: "5" | "4" | "3",
    seedSkill: "vocab" | "reading",
    items: ReadonlyArray<{
      prompt: string;
      choices: [string, string, string, string];
      correct: "A" | "B" | "C" | "D";
      explanation: string;
    }>,
  ): SeedProblem[] =>
    items.map((it, idx) => ({
      id: `prb_e2e_${level}_${seedSkill}_${String(idx + 1).padStart(3, "0")}`,
      level,
      seedSkill,
      prompt: it.prompt,
      choices: it.choices,
      correct: it.correct,
      explanation: it.explanation,
    }));

  const problemSeed: SeedProblem[] = [
    // ----- 5 級 vocab (5 問 / 既存互換) -----
    ...buildBatch("5", "vocab", [
      {
        prompt: "I (   ) a student.",
        choices: ["am", "is", "are", "be"],
        correct: "A",
        explanation: "「I」のあとには am を使います。",
      },
      {
        prompt: "This (   ) my dog.",
        choices: ["am", "is", "are", "do"],
        correct: "B",
        explanation: "「This」のあとには is を使います。",
      },
      {
        prompt: "We (   ) friends.",
        choices: ["am", "is", "are", "be"],
        correct: "C",
        explanation: "「We」のあとには are を使います。",
      },
      {
        prompt: "I have a (   ) at home. It is small and white.",
        choices: ["river", "school", "cat", "weather"],
        correct: "C",
        explanation: "ヒントから cat (ねこ) が自然です。",
      },
      {
        prompt: "She (   ) breakfast every morning.",
        choices: ["eat", "eats", "eating", "ate"],
        correct: "B",
        explanation: "三人称単数現在は eats を使います。",
      },
    ]),
    // ----- 5 級 reading (3 問) -----
    ...buildBatch("5", "reading", [
      {
        prompt: "What does Tom like?",
        choices: ["Apples", "Oranges", "Cats", "Dogs"],
        correct: "C",
        explanation: "本文に「Tom likes cats」とあります。",
      },
      {
        prompt: "Where is the park?",
        choices: ["Near the school", "By the river", "On the hill", "In Tokyo"],
        correct: "A",
        explanation: "本文に「near the school」と書かれています。",
      },
      {
        prompt: "When does Mary play tennis?",
        choices: ["Monday", "Tuesday", "Saturday", "Sunday"],
        correct: "C",
        explanation: "Saturday にテニスをすると書かれています。",
      },
    ]),
    // ----- 4 級 vocab (3 問) -----
    ...buildBatch("4", "vocab", [
      {
        prompt: "He has (   ) the new book yet.",
        choices: ["read", "not read", "reading", "reads"],
        correct: "B",
        explanation: "現在完了の否定は have/has not + 過去分詞です。",
      },
      {
        prompt: "If it (   ) tomorrow, we will stay home.",
        choices: ["rain", "rains", "rained", "raining"],
        correct: "B",
        explanation: "時・条件の副詞節は現在形を使います。",
      },
      {
        prompt: "The cake (   ) by my mother.",
        choices: ["was made", "made", "is making", "makes"],
        correct: "A",
        explanation: "受動態は be 動詞 + 過去分詞です。",
      },
    ]),
    // ----- 4 級 reading (3 問) -----
    ...buildBatch("4", "reading", [
      {
        prompt: "Why does Ken study English?",
        choices: ["For work", "For travel", "For school", "For fun"],
        correct: "C",
        explanation: "本文に「for school」とあります。",
      },
      {
        prompt: "Who lives in Osaka?",
        choices: ["Ken", "Ken's father", "Ken's mother", "Ken's brother"],
        correct: "D",
        explanation: "Ken の弟が大阪に住んでいます。",
      },
      {
        prompt: "What time does the movie start?",
        choices: ["6:00", "6:30", "7:00", "7:30"],
        correct: "C",
        explanation: "本文に「starts at 7:00」とあります。",
      },
    ]),
    // ----- 3 級 vocab (3 問) -----
    ...buildBatch("3", "vocab", [
      {
        prompt: "I would rather (   ) than go out.",
        choices: ["to stay", "stay", "staying", "stayed"],
        correct: "B",
        explanation: "would rather のあとは原形です。",
      },
      {
        prompt: "She is (   ) of speaking in public.",
        choices: ["afraid", "happy", "glad", "interested"],
        correct: "A",
        explanation: "be afraid of で「〜を恐れる」。",
      },
      {
        prompt: "The book (   ) I borrowed was interesting.",
        choices: ["who", "which", "what", "whose"],
        correct: "B",
        explanation: "先行詞が物なので which を使います。",
      },
    ]),
    // ----- 3 級 reading (3 問) -----
    ...buildBatch("3", "reading", [
      {
        prompt: "What is the main topic of the passage?",
        choices: ["Food", "Sports", "Travel", "School"],
        correct: "C",
        explanation: "本文は旅行について述べています。",
      },
      {
        prompt: "How long did the trip last?",
        choices: ["3 days", "5 days", "7 days", "10 days"],
        correct: "C",
        explanation: "本文に「a week」とあります。",
      },
      {
        prompt: "Which country did Anna visit?",
        choices: ["France", "Italy", "Spain", "Germany"],
        correct: "A",
        explanation: "本文に「to France」とあります。",
      },
    ]),
  ];

  for (const p of problemSeed) {
    const questionJson = JSON.stringify({
      prompt: p.prompt,
      choices: p.choices.map((text, i) => ({
        label: ["A", "B", "C", "D"][i],
        text,
      })),
    });
    await client.execute({
      sql: `INSERT INTO problems (id, level_id, skill_id, type, question_json, correct_answer, explanation, qa_verdict, qa_status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        p.id,
        p.level,
        mapSkillId(p.level, p.seedSkill),
        "mcq",
        questionJson,
        p.correct,
        p.explanation,
        "pass",
        "live",
        "ai_generated",
      ],
    });
    // problem_explanations を 1 件ずつ INSERT
    // (W5 G-4 / DEC-036: getNextProblem は EXISTS problem_explanations で出題対象を絞るため、
    //  E2E fixture でも各 problem に対応する解説行が必要。)
    await client.execute({
      sql: `INSERT INTO problem_explanations (id, problem_id, explanation_text, generated_by) VALUES (?, ?, ?, ?)`,
      args: [
        `pe_${p.id}`,
        p.id,
        `${p.explanation} (cached explanation for E2E)`,
        "curated",
      ],
    });
  }

  // ----- W7 B-10: writing_essay 問題 (3 級 / 1 問) -----
  // OPENAI_API_KEY 未設定の E2E 環境では scoreWritingEssay() が
  // jaccardWordOverlap ベースの決定論フォールバックに落ちるため、
  // 模範解答と単語が十分重複する解答を送れば correct=true で次問へ進める。
  {
    const writingId = "prb_e2e_3_writing_001";
    const writingQuestionJson = JSON.stringify({
      prompt: "What sport do you like? Please write 2-3 sentences.",
      modelAnswer:
        "I like soccer. I play soccer with my friends every weekend. It is a lot of fun.",
      wordCountMin: 15,
      wordCountMax: 50,
    });
    await client.execute({
      sql: `INSERT INTO problems (id, level_id, skill_id, type, question_json, correct_answer, explanation, qa_verdict, qa_status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        writingId,
        "3",
        mapSkillId("3", "writing"),
        "writing_essay",
        writingQuestionJson,
        // correct_answer は writing_essay では「お手本」を保持するだけ (採点は scoreWritingEssay)
        "I like soccer. I play soccer with my friends every weekend. It is a lot of fun.",
        "ライティングは自分の言葉で書くことが大切です。",
        "pass",
        "live",
        "ai_generated",
      ],
    });
    await client.execute({
      sql: `INSERT INTO problem_explanations (id, problem_id, explanation_text, generated_by) VALUES (?, ?, ?, ?)`,
      args: [
        `pe_${writingId}`,
        writingId,
        "ライティングはお手本と違っても OK です。 (cached explanation for E2E)",
        "curated",
      ],
    });
  }

  // streaks / xp_levels / characters の初期行 (parent dashboard 集計テスト用)
  await client.execute({
    sql: `INSERT INTO streaks (id, learner_id, current_streak, longest_streak) VALUES (?, ?, ?, ?)`,
    args: ["sk_e2e_001", learnerId, 0, 0],
  });
  await client.execute({
    sql: `INSERT INTO xp_levels (id, learner_id, total_xp, level, next_level_xp) VALUES (?, ?, ?, ?, ?)`,
    args: ["xp_e2e_001", learnerId, 0, 1, 100],
  });
  await client.execute({
    sql: `INSERT INTO characters (id, learner_id, mood, level) VALUES (?, ?, ?, ?)`,
    args: ["ch_e2e_001", learnerId, "normal", 1],
  });
  await client.execute({
    sql: `INSERT INTO exam_dates (id, learner_id, level, exam_date, plan_generated) VALUES (?, ?, ?, ?, ?)`,
    args: ["ed_e2e_001", learnerId, "5", "2026-10-12", 0],
  });

  return {
    familyId,
    parentUserId,
    parentEmail,
    parentPasswordPlain,
    learnerId,
  };
}

/**
 * Fixture 全体を立ち上げ (Playwright globalSetup から呼ぶ)
 * 既定で `:memory:` を使うが、TURSO_DATABASE_URL_E2E が指定されていればそれを使う。
 */
export async function setupDbFixture(): Promise<DbFixture> {
  const url = process.env.TURSO_DATABASE_URL_E2E ?? ":memory:";
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  await applyMigrations(client);
  await seedFixture(client);
  return { client, db, url };
}

/**
 * Fixture を破棄 (Playwright globalTeardown から呼ぶ)
 */
export async function teardownDbFixture(fixture: DbFixture): Promise<void> {
  fixture.client.close();
}
