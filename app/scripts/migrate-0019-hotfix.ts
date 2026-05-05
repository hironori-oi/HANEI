/**
 * scripts/migrate-0019-hotfix.ts (DEC-083 / 2026-05-06)
 *
 * 用途:
 *   DEC-078 W12-T4 で追加した `0019_w12_t4_learner_study_targets.sql` を
 *   Turso remote に直接適用する hotfix script。
 *
 * 経緯 (DEC-083 / β 開始前 hotfix):
 *   - 2026-05-06 オーナー手元 `bun run dev` で
 *     `SqliteError: no such table: learner_study_targets` が再現。
 *   - 診断結果: `app/drizzle/meta/_journal.json` が存在しない =
 *     drizzle-kit が migration tracking journal を持っていない =
 *     `drizzle-kit migrate` が silent no-op で終了するため
 *     0019 が Turso remote に未適用のまま残っていた。
 *   - 過去の 0000〜0018 は drizzle-kit push or 別経路で適用されていた模様。
 *   - 真の再発防止 (drizzle workflow 再構築) は DEC-083 別 atomic で実施予定。
 *     本 script は β 開始前 blocker 解消の hotfix のみに絞る。
 *
 * 認可 / 安全性:
 *   - `.env.local` の TURSO_DATABASE_URL + TURSO_AUTH_TOKEN を使う (DEC-027).
 *   - libSQL ファイル (file:./...) を誤って指していたら明示警告.
 *   - DEC-028 風に接続先を必ず 1 行表示 (auth token は redact).
 *
 * 冪等性 (DEC-055):
 *   - DDL は CREATE TABLE IF NOT EXISTS / CREATE UNIQUE INDEX IF NOT EXISTS.
 *   - 何度実行しても同じ結果 (既存時は no-op + log 表示).
 *
 * 実行:
 *   - `npm run db:migrate-hotfix-0019` (推奨 / package.json に登録済)
 *   - 直接: `tsx --env-file=.env.local scripts/migrate-0019-hotfix.ts`
 *
 * 実装メモ (2026-05-06 訂正):
 *   - tsx (esbuild) の CJS transform は top-level await を許容しない.
 *     `async function main()` + `main().then().catch()` で包み, prog 引数なしで実行.
 */

import { createClient } from "@libsql/client";

async function main(): Promise<void> {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl) {
    console.error(
      "[migrate-0019-hotfix] ERROR: TURSO_DATABASE_URL が未設定です. " +
        ".env.local が読み込まれているか確認してください " +
        "(`tsx --env-file=.env.local scripts/migrate-0019-hotfix.ts`).",
    );
    process.exit(1);
  }

  const isTursoRemote =
    databaseUrl.startsWith("libsql://") || databaseUrl.startsWith("https://");
  const redactedUrl = databaseUrl.replace(
    /(authToken|password|token)=[^&]*/gi,
    "$1=<REDACTED>",
  );
  const kind = isTursoRemote
    ? "TURSO (remote)"
    : databaseUrl.startsWith("file:")
      ? "LOCAL SQLite file"
      : "UNKNOWN";

  console.log(
    `[migrate-0019-hotfix] connection: kind=${kind} url=${redactedUrl}`,
  );

  if (!isTursoRemote) {
    console.warn(
      "[migrate-0019-hotfix] WARN: TURSO remote ではないように見えます. " +
        "本来は本番 Turso URL を指すべきです. 続行しますが意図と異なる場合は中止してください.",
    );
  }

  const client = createClient({
    url: databaseUrl,
    ...(authToken ? { authToken } : {}),
  });

  // ---- 1. 適用前 diagnostic ------------------------------------------------
  const beforeRows = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: ["learner_study_targets"],
  });
  const existsBefore = beforeRows.rows.length > 0;
  console.log(
    `[migrate-0019-hotfix] before: learner_study_targets exists = ${existsBefore}`,
  );

  // ---- 2. DDL 投入 (冪等) --------------------------------------------------
  // 0019_w12_t4_learner_study_targets.sql と完全一致 (drizzle migration source).
  // `IF NOT EXISTS` で重複実行時は no-op.
  await client.execute(`
    CREATE TABLE IF NOT EXISTS \`learner_study_targets\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`learner_id\` text NOT NULL,
      \`daily_minutes_target\` integer NOT NULL DEFAULT 15,
      \`reminder_enabled\` integer NOT NULL DEFAULT 1,
      \`reminder_time\` text NOT NULL DEFAULT '19:00',
      \`created_at\` integer NOT NULL DEFAULT (unixepoch()),
      \`updated_at\` integer NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (\`learner_id\`) REFERENCES \`learner_profiles\`(\`id\`) ON DELETE CASCADE
    )
  `);

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS \`learner_study_targets_learner_idx\`
      ON \`learner_study_targets\` (\`learner_id\`)
  `);

  // ---- 3. 適用後 diagnostic ------------------------------------------------
  const afterRows = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: ["learner_study_targets"],
  });
  const existsAfter = afterRows.rows.length > 0;
  console.log(
    `[migrate-0019-hotfix] after:  learner_study_targets exists = ${existsAfter}`,
  );

  const indexRows = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
    args: ["learner_study_targets_learner_idx"],
  });
  console.log(
    `[migrate-0019-hotfix] after:  learner_study_targets_learner_idx exists = ${indexRows.rows.length > 0}`,
  );

  if (!existsAfter) {
    console.error(
      "[migrate-0019-hotfix] ERROR: 適用後に learner_study_targets が存在しません. " +
        "DDL 実行は完了したが Turso 側に反映されていない可能性があります. " +
        "TURSO_AUTH_TOKEN の権限 / 接続先 URL を確認してください.",
    );
    process.exit(1);
  }

  console.log(
    existsBefore
      ? "[migrate-0019-hotfix] ✓ done (no-op / 既存 table 確認)"
      : "[migrate-0019-hotfix] ✓ done (CREATE TABLE 完了)",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[migrate-0019-hotfix] FATAL:", err);
    process.exit(1);
  });
