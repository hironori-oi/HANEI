/**
 * E2E: 学習コアループのスモーク
 * (W2-09 / dev-w2 R-6)
 *
 * Phase 1 W2 では実 DB / 実メールを使った本物のサインアップは CI では不安定なため、
 * 「未認証で /study/eiken-5/vocab を踏むとログインに飛ばされる」「/login が表示される」
 * 「/signup が表示される」「/study パスがルーティングされている」 を最低限スモークで担保する。
 *
 * 実トランザクション (signup -> verify -> study -> SRS 更新) は W3 で
 * in-memory libSQL + Resend mock 化したうえで本格 E2E 化する (申し送り事項)。
 */

import { test, expect } from "@playwright/test";

test.describe("study loop smoke (未認証 -> ログイン誘導)", () => {
  test("未認証で /study/eiken-5/vocab を開くと /login にリダイレクトされる", async ({ page }) => {
    await page.goto("/study/eiken-5/vocab");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("/login ページが表示され、メール / パスワード入力が存在する", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/メールアドレス/)).toBeVisible();
    await expect(page.getByLabel(/パスワード/)).toBeVisible();
  });

  test("/signup から /login へのリンクで遷移できる", async ({ page }) => {
    await page.goto("/signup");
    const loginLink = page.getByRole("link", { name: /ログイン/ });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("不正な levelCode は notFound に倒れる", async ({ page }) => {
    const res = await page.goto("/study/eiken-9/vocab");
    // 認可前の段階なら /login に行くか、認可後なら 404。どちらでも study 画面ではない。
    if (res) {
      expect([200, 404, 307, 308]).toContain(res.status());
    }
    await expect(page).not.toHaveURL(/\/study\/eiken-9\/vocab$/);
  });
});
