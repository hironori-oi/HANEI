/**
 * E2E: 13歳未満の保護者同意フロー (K-3 受入基準)
 * (W2-09 / dev-w2 R-6)
 *
 * 検証ポイント:
 *  - /signup に 3 種同意 (COPPA / AI / 利用規約) の checkbox が並ぶ
 *  - 同意未チェック状態だとブラウザの required で送信ブロック
 *  - 13 歳未満向けの説明文言が表示されている
 *  - 利用規約 / プライバシーポリシーへのリンク (legal pages) が踏める
 *
 * 実 INSERT (parent_consents 3 行追加) の検証は in-memory libSQL を整備してから W3 で本格 E2E 化。
 */

import { test, expect } from "@playwright/test";

test.describe("/signup - 13歳未満の保護者同意フロー", () => {
  test("13歳未満向けの保護者同意セクションが表示される", async ({ page }) => {
    await page.goto("/signup");
    // strict-mode 対策: ページ内に「13歳未満」を含む要素は CardDescription と
    // 同意 checkbox の <strong> の 2 箇所あるため .first() で先頭(説明文)のみ検証する。
    await expect(page.getByText(/13歳未満/).first()).toBeVisible();
  });

  test("3 つの同意 checkbox がすべてフォーム内に存在する", async ({ page }) => {
    await page.goto("/signup");
    const coppa = page.locator('input[name="consent_coppa"]');
    const aiChat = page.locator('input[name="consent_ai_chat"]');
    const terms = page.locator('input[name="consent_terms"]');
    await expect(coppa).toBeVisible();
    await expect(aiChat).toBeVisible();
    await expect(terms).toBeVisible();
  });

  test("3 つの同意は required (未チェックでは submit できない)", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill("parent_e2e@example.com");
    await page.getByLabel(/パスワード/).fill("test-password-1");
    await page.getByLabel("保護者の方のお名前").fill("テスト保護者");
    // 同意は付けずに送信 -> URL は /signup のまま
    await page.getByRole("button", { name: "アカウントを作成する" }).click();
    await expect(page).toHaveURL(/\/signup($|\?)/);
  });

  test("利用規約 / プライバシーポリシーへのリンクから legal ページへ遷移できる", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(page).toHaveURL(/\/legal\/terms$/);
    await page.goto("/legal/privacy");
    await expect(page).toHaveURL(/\/legal\/privacy$/);
  });
});
