/**
 * E2E: parent-dashboard-flow (W3 / T-7)
 *
 * 検証ポイント:
 *  - 未認証で /parent/dashboard を踏むと /login へリダイレクトされる
 *  - /signup ページから /login へ遷移できる
 *  - /parent/dashboard が SSR でルーティングできている (404 で無い)
 *
 * 注意:
 *  - W3 段階では :memory: libSQL fixture が webServer 子プロセスから見えないため、
 *    実 signup → onboarding → dashboard 描画の通し E2E は webServer の DB を
 *    file:./tests/e2e/.tmp/e2e.db に切り替えてからとなる (申し送り §6 / W4)。
 *  - 本 spec はそれまでのスモークとして、認可リダイレクト + ルーティング存在を担保する。
 */

import { test, expect } from "@playwright/test";

test.describe("/parent/dashboard - 保護者ダッシュボード スモーク", () => {
  test("未認証で /parent/dashboard を開くと /login にリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/parent/dashboard");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("/signup から /login への導線が表示される", async ({ page }) => {
    await page.goto("/signup");
    const loginLink = page.getByRole("link", { name: /ログイン/ });
    await expect(loginLink).toBeVisible();
  });

  test("/parent/dashboard ルートが notFound に倒れない", async ({ page }) => {
    const res = await page.goto("/parent/dashboard");
    if (res) {
      // 認可前の段階なら /login へ 307/308 リダイレクト or 200
      expect([200, 307, 308]).toContain(res.status());
    }
    // /parent/dashboard そのままに留まらない (リダイレクトされる)
    await expect(page).not.toHaveURL(/^.*\/parent\/dashboard$/);
  });
});
