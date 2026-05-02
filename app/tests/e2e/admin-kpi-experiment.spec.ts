/**
 * E2E: admin-kpi-experiment (W12-T2 / DEC-066 / A/B test cohort 分布カード)
 *
 * 検証スコープ:
 *   ① admin login → /admin/kpi
 *      → 10 枚目の card (data-kpi-id="experiment-streak-freeze-cohort") が見える
 *      → 既存 9 枚 + 10 枚目で計 10 card 可視
 *      → 罰語が含まれない (DEC-024 構造的担保)
 *
 * 戦略:
 *   - 既存 admin-kpi.spec.ts と同パターン (signup → promoteToAdmin → clearCookies + 再ログイン).
 *   - cohort 分布は seed データに依存しない (= まだ割当 0 名でも fallback 表示で card は存在する).
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
    email: `admin_kpi_exp_${stamp}@hanei.test`,
    password: "test-password-admin-kpi-exp",
    parentName: `KPI実験親${workerIndex}`,
    nickname: `KPI実験子${workerIndex}_${suffix}`,
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
  "experiment-streak-freeze-cohort",
] as const;

test.describe.configure({ mode: "serial" });

test.describe("admin-kpi-experiment (W12-T2 / DEC-066 / A/B test cohort)", () => {
  test("admin login → /admin/kpi → 10 枚目に A/B test cohort card 可視 + 罰語不在", async ({
    page,
  }, testInfo) => {
    const { email, password } = await signupAndOnboard(
      page,
      testInfo.workerIndex,
      "experiment_ok",
    );
    await promoteToAdmin(email);
    await clearCookiesAndReLogin(page, email, password);

    await page.goto("/admin/kpi");
    const dashboard = page.locator('[data-testid="admin-kpi-dashboard"]');
    await expect(dashboard).toBeVisible({ timeout: 15000 });

    // 10 KPI card 全件可視 (新規 experiment card 含む)
    for (const kpiId of REQUIRED_KPI_IDS) {
      const card = page.locator(`[data-kpi-id="${kpiId}"]`);
      await expect(
        card,
        `KPI card "${kpiId}" が見えていること`,
      ).toBeVisible({ timeout: 10000 });
    }

    // 10 枚目 (A/B test cohort) の中身を確認
    const expCard = page.locator(
      '[data-kpi-id="experiment-streak-freeze-cohort"]',
    );
    await expect(expCard).toBeVisible();
    const expText = (await expCard.textContent()) ?? "";
    // title or description のいずれかに「cohort」「streak freeze」相当の文字が露出する
    expect(expText.length).toBeGreaterThan(0);
    expectNoPunishmentWords(expText);

    // dashboard 全体の罰語不在 (DEC-024)
    const dashboardText = (await dashboard.textContent()) ?? "";
    expectNoPunishmentWords(dashboardText);
  });
});
