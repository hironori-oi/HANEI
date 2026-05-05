/**
 * E2E: learner-exam-date-self-edit (W12-T2 / DEC-076)
 *
 * 目的:
 *   学習者本人画面 (/home) からの「受験日 自己編集」path 動作を verify する。
 *   既存 settings-smoke / study-smoke と同じ signup → onboarding fixture pattern。
 *
 * 検証ポイント:
 *   1. /home に「受験日を変更する」link が表示される
 *   2. link クリックで /home/exam-date に遷移、現在の受験日が表示される
 *   3. 過去日入力 → エラー表示 + submit ボタンが押せない (input の min 属性 + form の error stage)
 *   4. 未来日入力 + 上書き保存 → /home に戻り、新しい日付が反映される (双方向同期 = home 側)
 *   5. 同 family の親 dashboard (/parent/dashboard) でも新しい受験日が反映される
 *      (双方向同期 = parent 側 / DEC-076 §双方向同期)
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
    email: `learner_examdate_${stamp}@hanei.test`,
    password: "test-password-learner-examdate",
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

test.describe("/home/exam-date - 学習者本人による受験日 自己編集 (DEC-076)", () => {
  test("signup → onboarding → /home → /home/exam-date で受験日変更 → /home + /parent/dashboard 双方向同期", async ({
    page,
  }, testInfo) => {
    const { email, password, parentName, nickname } = buildSignupCredentials(
      testInfo.workerIndex,
    );
    const initialExamDate = isoDateOffsetDays(180); // 半年後
    const newExamDate = isoDateOffsetDays(120); // 4 ヶ月後 (未来 / 異なる日付)

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
    await page.locator('input[name="exam_date"]').fill(initialExamDate);
    await page.getByRole("button", { name: "この内容で進める" }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 15000 });

    // ----- /home: 受験日 link 確認 -----
    await expect(page.getByText(initialExamDate)).toBeVisible();
    const editLink = page.locator('[data-testid="home-exam-date-edit-link"]');
    await expect(editLink).toBeVisible();
    await expect(editLink).toContainText("受験日を変更する");

    // ----- /home/exam-date 遷移 -----
    await editLink.click();
    await expect(page).toHaveURL(/\/home\/exam-date/, { timeout: 15000 });
    await expect(
      page.locator('[data-testid="learner-exam-date-page"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="learner-exam-date-current"]'),
    ).toContainText(initialExamDate);
    await expect(
      page.locator('[data-testid="learner-exam-date-form"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="learner-exam-date-input"]'),
    ).toBeVisible();

    // ----- 過去日入力ガード: 昨日の日付を入れてエラーが表示される -----
    const pastDate = isoDateOffsetDays(-1);
    const input = page.locator('[data-testid="learner-exam-date-input"]');
    // Note: <input type="date"> の min 属性により多くのブラウザで native に弾かれるが、
    // JS 経由で value を設定して onChange を発火し、form 側の error stage を verify する
    await input.fill(pastDate);
    await expect(
      page.locator('[data-testid="learner-exam-date-error"]'),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('[data-testid="learner-exam-date-error"]'),
    ).toContainText("今日以降");
    // submit ボタンは disabled か押下しても save に進まない
    const submitBtn = page.locator('[data-testid="learner-exam-date-submit"]');
    // error stage 中は disabled (form 側の `disabled` 条件に stage.kind === "error" を含めている)
    await expect(submitBtn).toBeDisabled();

    // ----- 未来日入力 + 上書き保存 -----
    await input.fill(newExamDate);
    // error が消えて submit が有効化される
    await expect(
      page.locator('[data-testid="learner-exam-date-error"]'),
    ).not.toBeVisible({ timeout: 5000 });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 既存日付があるため overwrite confirm が出る
    const overwriteBox = page.locator(
      '[data-testid="learner-exam-date-overwrite"]',
    );
    await expect(overwriteBox).toBeVisible({ timeout: 10000 });
    await expect(overwriteBox).toContainText(newExamDate);

    await page
      .locator('[data-testid="learner-exam-date-confirm-overwrite"]')
      .click();

    // 保存成功 → /home に戻る
    await expect(
      page.locator('[data-testid="learner-exam-date-saved"]'),
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/home$/, { timeout: 10000 });

    // ----- 双方向同期 = /home 側に新日付が反映 -----
    await expect(page.getByText(newExamDate).first()).toBeVisible({
      timeout: 10000,
    });

    // ----- 双方向同期 = /parent/dashboard 側にも新日付が反映 -----
    await page.goto("/parent/dashboard");
    // dashboard が描画され、英検 5 級 / 新日付が見える
    await expect(page.getByText(newExamDate).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("過去日入力時に submit が押せず、エラーメッセージが罰語ゼロの丁寧日本語である", async ({
    page,
  }, testInfo) => {
    const { email, password, parentName, nickname } = buildSignupCredentials(
      testInfo.workerIndex,
    );
    const initialExamDate = isoDateOffsetDays(90);

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
    await page.locator('input[name="exam_date"]').fill(initialExamDate);
    await page.getByRole("button", { name: "この内容で進める" }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 15000 });

    await page.goto("/home/exam-date");
    await expect(
      page.locator('[data-testid="learner-exam-date-page"]'),
    ).toBeVisible({ timeout: 15000 });

    // 昨日の日付を入れてエラー検証
    const pastDate = isoDateOffsetDays(-1);
    await page.locator('[data-testid="learner-exam-date-input"]').fill(pastDate);

    const errorBox = page.locator('[data-testid="learner-exam-date-error"]');
    await expect(errorBox).toBeVisible({ timeout: 5000 });
    const errorText = (await errorBox.textContent()) ?? "";
    // 罰則ゼロ哲学 (DEC-024): 罰語が含まれないこと
    expect(errorText).not.toContain("ダメ");
    expect(errorText).not.toContain("だめ");
    expect(errorText).not.toContain("禁止");
    expect(errorText).not.toContain("失敗");
    // 丁寧日本語の確認
    expect(errorText).toContain("今日以降");
  });
});
