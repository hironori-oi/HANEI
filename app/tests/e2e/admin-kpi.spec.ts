/**
 * E2E: admin-kpi (W12-T1 / DEC-065 / KPI ダッシュボード admin 専用 read-only)
 *
 * 検証スコープ (read path / 認可レイヤ / DEC-024 罰則ゼロ / DEC-065):
 *   ① admin login → /admin/kpi
 *      → data-testid="admin-kpi-dashboard" 可視
 *      → 6 カテゴリ全 9 card (3 retention + 4 KPI + バッジ + メッセージ) が data-kpi-id で見える
 *      → 罰語が一切含まれない
 *   ② parent login → /admin/kpi
 *      → /home に redirect (admin 以外を構造的に弾く / 第二層認可)
 *
 * 戦略:
 *   - 既存 family-* / signup と同じ「signup → onboarding → ログイン状態の cookie を確保」パターンを踏襲.
 *   - admin user は signup 後に DB 直接 UPDATE で role='admin' に上げる (better-auth の signup は parent 既定).
 *   - DB 直接アクセスは family-weekly-digest.spec.ts と同じ execWithRetry + createClient ヘルパで行う.
 *   - serial mode で SQLITE_BUSY を回避.
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@libsql/client";

function buildSignupCredentials(
  workerIndex: number,
  suffix: string,
): {
  email: string;
  password: string;
  parentName: string;
  nickname: string;
} {
  const stamp = `${Date.now()}_${workerIndex}_${suffix}`;
  return {
    email: `admin_kpi_${stamp}@hanei.test`,
    password: "test-password-admin-kpi",
    parentName: `KPI親${workerIndex}`,
    nickname: `KPI子${workerIndex}_${suffix}`,
  };
}

function sixMonthsFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dbUrl(): string {
  return (
    process.env.TURSO_DATABASE_URL_E2E ??
    process.env.TURSO_DATABASE_URL ??
    "file:./tests/e2e/.tmp/e2e.db"
  );
}

async function execWithRetry<T>(fn: () => Promise<T>, maxAttempts = 16): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/SQLITE_BUSY|database is locked/i.test(msg)) throw err;
      lastErr = err;
      const waitMs = Math.min(1500, 100 * 2 ** attempt) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

/**
 * email から user を取得し role='admin' に UPDATE.
 * better-auth の signup は role='parent' を default 投入するため、admin のみ事後 promote する.
 */
async function promoteToAdmin(email: string): Promise<void> {
  const client = createClient({ url: dbUrl() });
  try {
    await execWithRetry(() =>
      client.execute({
        sql: `UPDATE users SET role = 'admin' WHERE email = ?`,
        args: [email],
      }),
    );
  } finally {
    client.close();
  }
}

/**
 * signup → onboarding → /home まで到達して active session cookie を確保する.
 * (family-weekly-digest.spec.ts の signupAndOnboard と同等)
 *
 * `password` も返すのは, admin promote 後に「cookie cache を bust するため
 * cookie を全消し → /login で再ログイン」する必要があるため (better-auth の
 * cookieCache.maxAge=5min で role が古い値で固着するのを構造的に解消する).
 */
async function signupAndOnboard(
  page: import("@playwright/test").Page,
  workerIndex: number,
  suffix: string,
): Promise<{ email: string; password: string }> {
  const { email, password, parentName, nickname } = buildSignupCredentials(
    workerIndex,
    suffix,
  );
  const examDate = sixMonthsFromNow();

  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel(/パスワード/).fill(password);
  await page.getByLabel("保護者の方のお名前").fill(parentName);
  await page.locator('input[name="consent_coppa"]').check();
  await page.locator('input[name="consent_ai_chat"]').check();
  await page.locator('input[name="consent_terms"]').check();
  await page.getByRole("button", { name: "アカウントを作成する" }).click();

  await expect(page).toHaveURL(/\/verify-email(\?|$)/, { timeout: 15000 });

  await page.goto("/onboarding/learner");
  await expect(
    page.getByRole("heading", { name: /お子さまのプロフィール/ }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByLabel("ニックネーム").fill(nickname);
  await page.locator('select[name="target_level"]').selectOption("5");
  await page.locator('input[name="exam_date"]').fill(examDate);
  await page.getByRole("button", { name: "この内容で進める" }).click();

  await expect(page).toHaveURL(/\/home(\?|$)/, { timeout: 15000 });

  return { email, password };
}

/**
 * cookie を全消し → /login で再ログイン. better-auth の cookieCache (maxAge 5min) は
 * role 等の user 情報を cookie 値そのものに焼き込むため、DB の role を UPDATE しても
 * 既存 cookie には反映されない. promote 後に新規ログインで cookie を作り直す.
 */
async function clearCookiesAndReLogin(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/home(\?|$)/, { timeout: 15000 });
}

const PUNISHMENT_WORDS = [
  "最下位",
  "ペナルティ",
  "サボ",
  "もうダメ",
  "失敗",
  "やりすぎ",
  "がんばってない",
] as const;

function expectNoPunishmentWords(text: string): void {
  for (const w of PUNISHMENT_WORDS) {
    expect(
      text,
      `罰語 "${w}" が含まれてはいけない (DEC-024 罰則ゼロ哲学)`,
    ).not.toContain(w);
  }
}

const REQUIRED_KPI_IDS = [
  "retention-day-1",
  "retention-day-7",
  "retention-day-30",
  "avg-session-minutes",
  "streak-median",
  "streak-freeze-usage",
  "daily-quest-completion-rate",
  "badge-distribution",
  "family-message-frequency",
] as const;

// fullyParallel=true で同一 file: SQLite に複数 worker から書き込むと SQLITE_BUSY が発生する.
// W11-T3 / W11-T5 と同様 serial 化.
test.describe.configure({ mode: "serial" });

test.describe("admin-kpi (W12-T1 / DEC-065 / admin 専用 read-only)", () => {
  test("admin login → /admin/kpi → 全 9 card 可視 + 罰語不在", async ({
    page,
  }, testInfo) => {
    const { email, password } = await signupAndOnboard(
      page,
      testInfo.workerIndex,
      "admin_ok",
    );
    // signup 後に role='admin' に promote.
    // better-auth は cookieCache (maxAge 5min) で role 値を cookie 自体に焼き込むため、
    // DB UPDATE しただけでは既存 session の role は "parent" のまま固着する.
    // → cookie を全消し → /login で再ログインして fresh な admin cookie を作り直す.
    await promoteToAdmin(email);
    await clearCookiesAndReLogin(page, email, password);

    await page.goto("/admin/kpi");
    const dashboard = page.locator('[data-testid="admin-kpi-dashboard"]');
    await expect(dashboard).toBeVisible({ timeout: 15000 });

    // 9 KPI card 全件可視
    for (const kpiId of REQUIRED_KPI_IDS) {
      const card = page.locator(`[data-kpi-id="${kpiId}"]`);
      await expect(
        card,
        `KPI card "${kpiId}" が見えていること`,
      ).toBeVisible({ timeout: 10000 });
    }

    // 罰語不在 (DEC-024)
    const dashboardText = (await dashboard.textContent()) ?? "";
    expectNoPunishmentWords(dashboardText);
  });

  test("parent login → /admin/kpi → /home に redirect", async ({
    page,
  }, testInfo) => {
    // role='parent' のままにしておく (= signup 直後の default)
    await signupAndOnboard(page, testInfo.workerIndex, "parent_block");

    await page.goto("/admin/kpi");
    // requireAdmin → redirect("/home") で home に着地する.
    await expect(page).toHaveURL(/\/home(\?|$)/, { timeout: 15000 });
    // KPI dashboard は描画されない.
    await expect(
      page.locator('[data-testid="admin-kpi-dashboard"]'),
    ).toHaveCount(0);
  });
});
