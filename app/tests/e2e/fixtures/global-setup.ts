/**
 * Playwright globalSetup: file libSQL fixture を立てる
 * (W4 / T-4)
 *
 * W3 までは `:memory:` で fixture を立てていたが、Next.js webServer (子プロセス) 側から
 * 同じ DB に見えなかったため、通し E2E が書けなかった。
 *
 * W4 では `file:./tests/e2e/.tmp/e2e.db` に切り替え、webServer 側にも同じパスを
 * playwright.config.ts の `webServer.env.TURSO_DATABASE_URL` で共有する。
 * これで signup → onboarding → /parent/dashboard の通し E2E が実装可能になる。
 */

import { setupDbFixture } from "./db-fixture";
import path from "node:path";
import fs from "node:fs/promises";

const DEFAULT_E2E_DB = "file:./tests/e2e/.tmp/e2e.db";

async function globalSetup(): Promise<void> {
  const dbUrl = process.env.TURSO_DATABASE_URL_E2E ?? DEFAULT_E2E_DB;

  // .tmp ディレクトリを作成 + 既存 DB を削除 (冪等な seed のため)
  if (dbUrl.startsWith("file:")) {
    const filePath = dbUrl.replace(/^file:/, "");
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.unlink(filePath);
    } catch {
      // 初回は存在しないので無視
    }
  }

  // fixture / webServer 共通の DB url
  process.env.TURSO_DATABASE_URL = dbUrl;
  process.env.TURSO_DATABASE_URL_E2E = dbUrl;

  const fixture = await setupDbFixture();
  // close は teardown で行う (Playwright がプロセスを落とす際に自動 GC される)
  void fixture;
}

export default globalSetup;
