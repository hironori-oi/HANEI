import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// W4.5 / DEC-027:
//   drizzle-kit は `.env.local` を自動読み込みしない。defineConfig 評価時点で
//   process.env.TURSO_DATABASE_URL が undefined だと `file:./local.db` に
//   フォールバックされ、ローカル SQLite ファイルにテーブルが作られてしまう。
//   ここで明示的に .env.local → .env の順で読み込み、Turso URL を有効化する。
config({ path: ".env.local" });
config({ path: ".env" });

// DEC-028: drizzle-kit 起動時の接続先を必ず 1 行表示する
// (DEC-027 の「Turso のつもりが local.db に push」事象の再発防止)
const _drizzleUrl = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
const _drizzleKind = _drizzleUrl.startsWith("libsql://") || _drizzleUrl.startsWith("https://")
  ? "TURSO (remote)"
  : _drizzleUrl.startsWith("file:")
    ? "LOCAL SQLite file"
    : "UNKNOWN";
console.log(`[drizzle.config] connection: kind=${_drizzleKind} url=${_drizzleUrl.replace(/(authToken|password|token)=[^&]*/gi, "$1=<REDACTED>")}`);

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});
