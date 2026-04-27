/**
 * E2E: 保護者サインアップフォームの基本バリデーション
 * (review-phase0-gate.md §8.2 W1-09)
 *
 * W1 雛形: form 表示 + 必須項目 + 同意チェック.
 * W2 で実際のサインアップ完了 -> /onboarding/learner 遷移までを E2E 化。
 */

import { test, expect } from "@playwright/test";

test.describe("/signup", () => {
  test("ページが表示され、主要要素が存在する", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /アカウント作成/ })).toBeVisible();
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
    await expect(page.getByLabel(/パスワード/)).toBeVisible();
    await expect(page.getByLabel("保護者の方のお名前")).toBeVisible();
  });

  test("必須項目が空のままだとブラウザバリデーションがブロックする", async ({ page }) => {
    await page.goto("/signup");
    const submit = page.getByRole("button", { name: "アカウントを作成する" });
    await submit.click();
    // HTML5 required: フォームは送信されず、URL が変わらないこと
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("3つの同意チェックボックスが表示されている (K-3 保護者同意フロー)", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('input[name="consent_coppa"]')).toBeVisible();
    await expect(page.locator('input[name="consent_ai_chat"]')).toBeVisible();
    await expect(page.locator('input[name="consent_terms"]')).toBeVisible();
  });

  test("ログイン画面へのリンクが存在する", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("link", { name: /ログイン/ })).toBeVisible();
  });
});
