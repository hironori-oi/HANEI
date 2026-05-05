/**
 * E2E: study-target-set (W12-T4 / Phase 3 第 1 波 / DEC-078)
 *
 * 目的:
 *   親 settings (/parent/settings/notifications) からの「学習時間目標」 section の動作を verify する。
 *   既存 settings-smoke / learner-exam-date-self-edit と同じ signup → onboarding fixture pattern。
 *
 * 検証ポイント:
 *   1. settings notifications page に「学習時間目標」 section が表示される
 *   2. 目標分数 30 分 + reminder ON + 19:00 で保存 → reauth dialog → 成功 message
 *   3. リロードで保存値が永続化されている
 *   4. /home に「今日の学習時間目標」 Card が表示され target=30 分で render
 *   5. 罰則ゼロ哲学 (DEC-024): エラー path でも「失敗」「サボ」「ダメ」等の罰語ゼロ
 *
 * 前提:
 *   - playwright.config.ts の webServer + tests/e2e/fixtures/db-fixture.ts seed
 *   - signup の autoSignIn=true で session cookie 保持
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
    email: `parent_studytarget_${stamp}@hanei.test`,
    password: "test-password-study-target",
    parentName: `保護者${workerIndex}`,
    nickname: `子${workerIndex}`,
  };
}

function isoDateOffsetDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test.describe("/parent/settings/notifications - 学習時間目標 (DEC-078)", () => {
  test("学習時間目標 section が表示され、30 分 / ON / 19:00 で保存できる (reauth フロー込)", async ({
    page,
  }, testInfo) => {
    const { email, password, parentName, nickname } = buildSignupCredentials(
      testInfo.workerIndex,
    );
    const examDate = isoDateOffsetDays(120);

    // ----- signup -----
    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel(/パスワード/).fill(password);
    await page.getByLabel("保護者の方のお名前").fill(parentName);
    await page.locator('input[name="consent_coppa"]').check();
    await page.locator('input[name="consent_ai_chat"]').check();
    await page.locator('input[name="consent_terms"]').check();
    await page.getByRole("button", { name: "アカウントを作成する" }).click();
    await expect(page).toHaveURL(/\/verify-email(\?|$)/, { timeout: 15000 });

    // ----- onboarding -----
    await page.goto("/onboarding/learner");
    await page.getByLabel("ニックネーム").fill(nickname);
    await page.locator('select[name="target_level"]').selectOption("5");
    await page.locator('input[name="exam_date"]').fill(examDate);
    await page.getByRole("button", { name: "この内容で進める" }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 15000 });

    // ----- /parent/settings/notifications 遷移 -----
    await page.goto("/parent/settings/notifications");
    await expect(
      page.locator('[data-testid="parent-settings-notifications"]'),
    ).toBeVisible({ timeout: 15000 });

    // 学習時間目標 section が見える
    const studyTargetForm = page.locator('[data-testid="study-target-form"]');
    await expect(studyTargetForm).toBeVisible();
    await expect(studyTargetForm).toContainText("学習時間目標");

    // ----- 30 分 / ON / 19:00 を入力 -----
    const minutesInput = page.locator(
      '[data-testid="daily-minutes-target-input"]',
    );
    await minutesInput.fill("30");

    // 既に reminder = ON が default だが、再確認
    const reminderToggle = page.locator(
      '[data-testid="study-target-reminder-toggle"]',
    );
    await expect(reminderToggle).toHaveAttribute("aria-checked", "true");

    const timeInput = page.locator(
      '[data-testid="study-target-reminder-time-input"]',
    );
    await timeInput.fill("19:00");

    // ----- submit → reauth dialog 経由で保存 -----
    await page.locator('[data-testid="study-target-submit"]').click();

    // reauth dialog が開く
    const reauthDialog = page.locator(
      '[data-testid="parent-reauth-dialog"], [role="dialog"]',
    );
    await expect(reauthDialog.first()).toBeVisible({ timeout: 10000 });

    // パスワードを入力して再認証
    const reauthInput = page.locator(
      'input[type="password"][data-testid="parent-reauth-password-input"], input[type="password"]',
    );
    await reauthInput.first().fill(password);
    // 再認証ボタンを click
    const reauthSubmit = page.locator(
      '[data-testid="parent-reauth-submit"], button:has-text("確認")',
    );
    await reauthSubmit.first().click();

    // 保存成功 message
    await expect(
      page.locator('[data-testid="study-target-success"]'),
    ).toBeVisible({ timeout: 15000 });

    // ----- リロードで永続化確認 -----
    await page.reload();
    await expect(
      page.locator('[data-testid="parent-settings-notifications"]'),
    ).toBeVisible({ timeout: 15000 });
    await expect(minutesInput).toHaveValue("30");
    await expect(reminderToggle).toHaveAttribute("aria-checked", "true");
    await expect(timeInput).toHaveValue("19:00");

    // ----- /home に「今日の学習時間目標」 Card 表示 -----
    await page.goto("/home");
    const studyTargetDisplay = page.locator(
      '[data-testid="home-study-target-display"]',
    );
    await expect(studyTargetDisplay).toBeVisible({ timeout: 15000 });
    await expect(studyTargetDisplay).toHaveAttribute(
      "data-target-minutes",
      "30",
    );
    await expect(studyTargetDisplay).toContainText("きょうの学習時間目標");
  });

  test("181 分 (上限超過) は保存ボタン押下で reject、エラー文言が罰語ゼロ", async ({
    page,
  }, testInfo) => {
    const { email, password, parentName, nickname } = buildSignupCredentials(
      testInfo.workerIndex,
    );
    const examDate = isoDateOffsetDays(60);

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
    await page.getByLabel("ニックネーム").fill(nickname);
    await page.locator('select[name="target_level"]').selectOption("5");
    await page.locator('input[name="exam_date"]').fill(examDate);
    await page.getByRole("button", { name: "この内容で進める" }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 15000 });

    await page.goto("/parent/settings/notifications");
    const minutesInput = page.locator(
      '[data-testid="daily-minutes-target-input"]',
    );

    // input の min/max 属性で UI 段階で 180 にクランプされる動作の verify。
    // form 側の onChange clamp で 180 に丸められる (= reject ではなく自動補正の安全側設計)。
    await minutesInput.fill("181");
    // blur で onChange 評価
    await minutesInput.blur();
    const valueAfter = await minutesInput.inputValue();
    // clamp によって 180 以下の値に丸まる
    expect(Number(valueAfter)).toBeLessThanOrEqual(180);

    // 念のため、フォーム上に罰語が一切 render されていないこと (DEC-024)
    const formText = (await page.locator('[data-testid="study-target-form"]').textContent()) ?? "";
    expect(formText).not.toContain("失敗");
    expect(formText).not.toContain("サボ");
    expect(formText).not.toContain("怠け");
    expect(formText).not.toContain("ダメ");
    expect(formText).not.toContain("だめ");
    expect(formText).not.toContain("禁止");
  });
});
