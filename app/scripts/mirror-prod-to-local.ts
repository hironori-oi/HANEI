/**
 * scripts/mirror-prod-to-local.ts (DEC-038 follow-up #2 / 2026-04-27)
 *
 * 用途:
 *   - 本番 Turso (libsql://) → ローカル `file:./local.db` への一方向ミラー。
 *   - 主に `problems` / `problem_explanations` / `eiken_levels` / `skills` /
 *     `badges` のマスタ・コンテンツデータを seed する。
 *   - AI 呼び出しは一切しない。¥0。
 *
 * 背景:
 *   - `npm run db:seed:dev` は user/family/learner のみ投入 (DEC-038)。
 *   - 5 級 vocab 160 問など実コンテンツは本番 Turso にしか存在しないため、
 *     `npm run dev` で /study/eiken-5/vocab を開いても "問題が用意されていません"
 *     表示になる。
 *
 * 設計:
 *   - source URL/token は `.env.local` の TURSO_DATABASE_URL / TURSO_AUTH_TOKEN を使う。
 *   - target は常に `file:./local.db` 固定 (ハードコード)。
 *   - 既存行は `INSERT OR REPLACE` で上書き (冪等)。
 *   - users / families / learner_profiles など個人データは **絶対に触らない**
 *     (本番に dev seed の owner@hanei.local が漏れるリスクを排除)。
 *
 * 実行: `npm run db:mirror:prod`
 */

import { createClient } from "@libsql/client";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// .env.local 直接読み (tsx の --env-file は子プロセス挙動が読みにくいため自前で読む)
// ---------------------------------------------------------------------------
function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(`[mirror] .env.local not found at ${envPath}`);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

// ---------------------------------------------------------------------------
// ミラー対象テーブル (依存順 = 親 → 子)
// ※ users / families / learner_profiles / family_members / parent_consents /
//   exam_dates / streaks / xp_levels / characters は **個人データなので除外**。
// ※ accounts / sessions / verifications も Better Auth 個人データなので除外。
// ---------------------------------------------------------------------------
const MIRROR_TABLES = [
  // master
  "eiken_levels",
  "skills",
  "badges",
  // content (parent first)
  "problems",
  "problem_explanations",
  // generated_problems_queue は QA-pending を含み dev では不要
] as const;

async function getColumns(
  client: ReturnType<typeof createClient>,
  table: string,
): Promise<string[]> {
  const res = await client.execute({
    sql: `PRAGMA table_info(${table})`,
    args: [],
  });
  return res.rows.map((r) => String(r.name));
}

async function mirrorTable(
  source: ReturnType<typeof createClient>,
  target: ReturnType<typeof createClient>,
  table: string,
): Promise<{ table: string; rows: number }> {
  const sourceCols = await getColumns(source, table);
  const targetCols = await getColumns(target, table);
  if (targetCols.length === 0) {
    console.log(
      `[mirror] skip ${table}: target has no such table (migration 未適用?)`,
    );
    return { table, rows: 0 };
  }
  const cols = sourceCols.filter((c) => targetCols.includes(c));
  if (cols.length === 0) {
    console.log(`[mirror] skip ${table}: no common columns`);
    return { table, rows: 0 };
  }
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map(() => "?").join(", ");

  const result = await source.execute({
    sql: `SELECT ${colList} FROM ${table}`,
    args: [],
  });
  if (result.rows.length === 0) {
    console.log(`[mirror] ${table}: 0 rows in source`);
    return { table, rows: 0 };
  }

  // batch in tx — INSERT OR IGNORE で既存 master 行 (seed-dev-user.ts が入れた '5'
  // など) を保護。content 系 (problems / problem_explanations) は target が空なので
  // 全件新規 INSERT になる。
  await target.execute("BEGIN");
  try {
    for (const row of result.rows) {
      const args = cols.map((c) => row[c] ?? null);
      await target.execute({
        sql: `INSERT OR IGNORE INTO ${table} (${colList}) VALUES (${placeholders})`,
        args,
      });
    }
    await target.execute("COMMIT");
  } catch (err) {
    await target.execute("ROLLBACK");
    throw err;
  }

  console.log(`[mirror] ${table}: ${result.rows.length} rows mirrored`);
  return { table, rows: result.rows.length };
}

async function main(): Promise<void> {
  const envLocal = loadEnvLocal();
  const sourceUrl = envLocal.TURSO_DATABASE_URL;
  const sourceToken = envLocal.TURSO_AUTH_TOKEN;

  if (!sourceUrl || !sourceUrl.startsWith("libsql://")) {
    throw new Error(
      `[mirror] .env.local の TURSO_DATABASE_URL が libsql:// で始まっていません (got: ${sourceUrl ? sourceUrl.slice(0, 12) + "..." : "undefined"})`,
    );
  }
  if (!sourceToken) {
    throw new Error("[mirror] .env.local の TURSO_AUTH_TOKEN が未設定です");
  }

  const targetUrl = "file:./local.db";

  console.log(`[mirror] source: ${sourceUrl.slice(0, 40)}...`);
  console.log(`[mirror] target: ${targetUrl}`);

  const source = createClient({ url: sourceUrl, authToken: sourceToken });
  const target = createClient({ url: targetUrl });

  // local.db に migration が当たっていない可能性を考慮 → users 等の存在で簡易チェック
  const targetTables = await target.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    args: [],
  });
  const targetTableNames = new Set(targetTables.rows.map((r) => String(r.name)));
  if (!targetTableNames.has("problems")) {
    console.log(
      "[mirror] target に problems テーブルが無い → 先に `npm run db:seed:dev` を実行してください (drizzle migrations が適用される)",
    );
    target.close();
    source.close();
    process.exit(2);
  }

  // FK 一時 OFF: 万一 source の参照整合 (replaced_by 等) が完璧でなくても
  // mirror 順序問題で fail しないように。完了後に ON に戻す。
  await target.execute("PRAGMA foreign_keys = OFF");

  const summary: { table: string; rows: number }[] = [];
  try {
    for (const table of MIRROR_TABLES) {
      summary.push(await mirrorTable(source, target, table));
    }
  } finally {
    await target.execute("PRAGMA foreign_keys = ON");
  }

  console.log("");
  console.log("[mirror] === Summary ===");
  for (const s of summary) {
    console.log(`  ${s.table.padEnd(24)} ${s.rows} rows`);
  }
  const total = summary.reduce((acc, s) => acc + s.rows, 0);
  console.log(`  ${"TOTAL".padEnd(24)} ${total} rows`);

  source.close();
  target.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[mirror] FAILED:", err);
    process.exit(1);
  });
