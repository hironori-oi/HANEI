/**
 * E2E: /parent/settings/account レベル変更 regression smoke (DEC-090 hotfix)
 *
 * 背景:
 *   `lib/actions/reset-learner-study-data.ts` ("use server") が非 async const
 *   (RESET_DELETE_TABLE_NAMES / RESET_KEEP_TABLE_NAMES) を export していたため、
 *   `<LearnerResetStudyDataSection>` を import する `/parent/settings/account/page.tsx` の
 *   production module 評価が「A "use server" file can only export async functions」で失敗し、
 *   親が目標英検級を変更しようとすると 500 が返っていた.
 *
 * 本 spec は settings-smoke.spec.ts の cancel-only パスを拡張し、
 * **reauth 成功 → updateLearnerProfile 再呼び出し → router.refresh() 後の page 再描画**
 * までを通すことで上記 500 の再発を構造的に防ぐ.
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
    email: `diaglvl_${stamp}@hanei.test`,
    password: "test-password-diag",
    parentName: `診断保護者${workerIndex}`,
    nickname: `診断子${workerIndex}`,
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

test.describe("/parent/settings/account レベル変更 regression smoke (DEC-090 hotfix)", () => {
  test("signup → onboarding → /parent/settings/account → level 5→4 → reauth 成功 → 再 render が 200 で返る", async ({
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

    // onboarding (level 5)
    await page.goto("/onboarding/learner");
    await page.getByLabel("ニックネーム").fill(nickname);
    await page.locator('select[name="target_level"]').selectOption("5");
    await page.locator('input[name="exam_date"]').fill(examDate);
    await page.getByRole("button", { name: "この内容で進める" }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 15000 });

    // /parent/settings/account 初期 GET 描画 = 健全であること
    await page.goto("/parent/settings/account");
    await expect(
      page.locator('[data-testid="parent-settings-account"]'),
    ).toBeVisible({ timeout: 15000 });

    // level を 5 → 4 に変更
    await page.locator('[data-testid="account-level-select"]').selectOption("4");
    await page.locator('[data-testid="account-submit"]').click();

    // reauth dialog が開く
    await expect(
      page.locator('[data-testid="parent-reauth-dialog"]'),
    ).toBeVisible({ timeout: 15000 });

    // パスワード入力 → 送信
    await page
      .locator('[data-testid="parent-reauth-password-input"]')
      .fill(password);
    await page.locator('[data-testid="parent-reauth-submit"]').click();

    // dialog が閉じる + 成功表示 = page が 500 にならず render される
    await expect(
      page.locator('[data-testid="parent-reauth-dialog"]'),
    ).not.toBeVisible({ timeout: 15000 });

    // success message OR 単純に再 render 後も page が壊れないこと
    await expect(
      page.locator('[data-testid="parent-settings-account"]'),
    ).toBeVisible({ timeout: 15000 });

    // 変更後の値が反映されていることを確認 (router.refresh 後)
    await expect(
      page.locator('[data-testid="account-level-select"]'),
    ).toHaveValue("4", { timeout: 15000 });
  });
});
