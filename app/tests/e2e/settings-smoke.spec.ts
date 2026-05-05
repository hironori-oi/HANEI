/**
 * E2E: settings-smoke (W12-T1 / Phase 3 第 1 波 / DEC-074)
 *
 * 目的:
 *   `/parent/settings` 配下 4 route (index / account / notifications / security) の
 *   「未認証 redirect」「認証後 page 描画」「reauth dialog 表示」をスモーク検証する。
 *
 * 検証ポイント (大粒度 / DB ハッピーパスを再構築せず lightweight):
 *   1. 未認証で /parent/settings/* にアクセス → /login へ redirect
 *   2. 認証 (signup → onboarding 完了済 fixture) で settings index が描画される
 *   3. account / notifications / security 各 route が 200 で描画され testid が見える
 *   4. account から「保存する」を押すと parent-reauth-dialog が開く (sensitive = reauth 必須)
 *
 * 前提:
 *   - playwright.config.ts の webServer + tests/e2e/fixtures/db-fixture.ts seed
 *   - settings-related migration 0018_w12_t1_learner_settings.sql は db-fixture に登録済
 */

import { test, expect } from "@playwright/test";

function buildSignupCredentials(workerIndex: number): {
  email: string;
  password: string;
  parentName: string;
  nickname: string;
} {
  const stamp = `${Date.now()}_${workerIndex}`;
  return {
    email: `settings_${stamp}@hanei.test`,
    password: "test-password-settings",
    parentName: `設定保護者${workerIndex}`,
    nickname: `設定子${workerIndex}`,
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

test.describe("/parent/settings/* - 親 settings スモーク", () => {
  test("未認証で /parent/settings に来ると /login にリダイレクト", async ({
    page,
  }) => {
    await page.goto("/parent/settings");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("未認証で /parent/settings/account に来ると /login にリダイレクト", async ({
    page,
  }) => {
    await page.goto("/parent/settings/account");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("未認証で /parent/settings/notifications に来ると /login にリダイレクト", async ({
    page,
  }) => {
    await page.goto("/parent/settings/notifications");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("未認証で /parent/settings/security に来ると /login にリダイレクト", async ({
    page,
  }) => {
    await page.goto("/parent/settings/security");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("signup → onboarding → /parent/settings 4 route 描画 + reauth dialog 表示", async ({
    page,
  }, testInfo) => {
    const { email, password, parentName, nickname } = buildSignupCredentials(
      testInfo.workerIndex,
    );
    const examDate = sixMonthsFromNow();

    // signup
    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel(/パスワード/).fill(password);
    await page.getByLabel("保護者の方のお名前").fill(parentName);
    await page.locator('input[name="consent_coppa"]').check();
    await page.locator('input[name="consent_ai_chat"]').check();
    await page.locator('input[name="consent_terms"]').check();
    await page.getByRole("button", { name: "アカウントを作成する" }).click();
    await expect(page).toHaveURL(/\/verify-email(\?|$)/, { timeout: 15000 });

    // onboarding
    await page.goto("/onboarding/learner");
    await page.getByLabel("ニックネーム").fill(nickname);
    await page.locator('select[name="target_level"]').selectOption("5");
    await page.locator('input[name="exam_date"]').fill(examDate);
    await page.getByRole("button", { name: "この内容で進める" }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 15000 });

    // /parent/settings index
    await page.goto("/parent/settings");
    await expect(
      page.locator('[data-testid="parent-settings-index"]'),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('[data-testid="settings-link-account"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="settings-link-notifications"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="settings-link-security"]'),
    ).toBeVisible();

    // /parent/settings/account
    await page.locator('[data-testid="settings-link-account"]').click();
    await expect(page).toHaveURL(/\/parent\/settings\/account/, {
      timeout: 15000,
    });
    await expect(
      page.locator('[data-testid="parent-settings-account"]'),
    ).toBeVisible();
    await expect(page.locator('[data-testid="account-form"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="account-nickname-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="account-level-select"]'),
    ).toBeVisible();
    await expect(page.locator('[data-testid="parent-email"]')).toContainText(
      email,
    );

    // account: 値を変更して「保存する」押下 → reauth dialog が open する (sensitive)
    await page
      .locator('[data-testid="account-nickname-input"]')
      .fill(`${nickname}改`);
    await page.locator('[data-testid="account-submit"]').click();
    await expect(
      page.locator('[data-testid="parent-reauth-dialog"]'),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('[data-testid="parent-reauth-password-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="parent-reauth-submit"]'),
    ).toBeVisible();

    // dialog をキャンセル (キャンセルボタンで閉じる)
    await page.getByRole("button", { name: "キャンセル" }).click();
    await expect(
      page.locator('[data-testid="parent-reauth-dialog"]'),
    ).not.toBeVisible({ timeout: 5000 });

    // /parent/settings/notifications
    await page.goto("/parent/settings/notifications");
    await expect(
      page.locator('[data-testid="parent-settings-notifications"]'),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('[data-testid="notifications-form"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="notifications-toggle"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="reminder-toggle"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="sound-server-toggle"]'),
    ).toBeVisible();

    // /parent/settings/security
    await page.goto("/parent/settings/security");
    await expect(
      page.locator('[data-testid="parent-settings-security"]'),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('[data-testid="security-link-password"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="security-link-2fa"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="security-link-withdraw"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="security-parent-email"]'),
    ).toContainText(email);
  });
});
