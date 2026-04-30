import { defineConfig, devices } from "@playwright/test";

/**
 * E2E webServer DB 切替 (W4 / T-4)
 *
 * W3 では `:memory:` libSQL fixture が webServer 子プロセスから見えなかったため、
 * 通し E2E (signup → email verify → onboarding → home → /study → /parent/dashboard)
 * は実装不能だった。
 *
 * W4 で fixture / webServer 双方を共有ファイル `file:./tests/e2e/.tmp/e2e.db` に
 * 揃えることで、Next.js 子プロセスからも fixture が見える状態にする。
 */
const E2E_DB_PATH =
  process.env.TURSO_DATABASE_URL_E2E ?? "file:./tests/e2e/.tmp/e2e.db";

// W10-T5: dev で port 3000 が占有されている場合に env で切替できるように。
// 既存挙動 (PORT 未指定) は 3000 を維持。
const E2E_PORT = Number(process.env.E2E_PORT ?? "3000");
const E2E_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/fixtures/**"],
  globalSetup: "./tests/e2e/fixtures/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // build 中の Next.js が「page data 収集」目的で /api/auth /api/cron 等の route
    // module を初期化し、その時点で db client が file: URL を open する。
    // globalSetup が webServer 起動より前に走るが、Next.js 子プロセスは DB ディレクトリ
    // が無いと SQLITE_CANTOPEN(14) で死ぬ。
    // → build 開始前に .tmp ディレクトリと空 DB ファイルを保証する。
    command:
      "node -e \"const fs=require('fs');fs.mkdirSync('tests/e2e/.tmp',{recursive:true});if(!fs.existsSync('tests/e2e/.tmp/e2e.db'))fs.closeSync(fs.openSync('tests/e2e/.tmp/e2e.db','a'));\" && npm run build && npm run start",
    url: E2E_BASE_URL,
    // W7 / B-8: 常時 false。dev (`next dev` / `local.db`) が port 3000 を
    // 占有していた場合、Playwright がそれを再利用して E2E が誤った DB を見にいき
    // silent skip / silent fail する事故 (DEC-040 W7 申し送り B-8) を構造的に防ぐ。
    // build + start のオーバーヘッドは ~30 秒程度許容する。
    reuseExistingServer: false,
    timeout: 180 * 1000,
    env: {
      // webServer (Next.js 子プロセス) と fixture が同一 DB を見るための共有 file:
      // path。`:memory:` だと子プロセス間で隔離されるため file: モードで共有する。
      TURSO_DATABASE_URL: E2E_DB_PATH,
      NODE_ENV: "production",
      // W10-T5: PORT を Next.js `start` に渡すことで E2E_PORT (default 3000) を実際に listen させる。
      PORT: String(E2E_PORT),
    },
  },
});
