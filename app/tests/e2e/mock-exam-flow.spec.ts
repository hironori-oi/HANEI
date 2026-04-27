/**
 * E2E: mock-exam-flow (W4 / T-7)
 *
 * 検証ポイント:
 *  - 未認証で /parent/mock-exam-results を開くと /login へリダイレクトされる
 *  - /parent/mock-exam-results そのものは notFound に倒れない (ルーティング存在)
 *  - /parent/mock-exam-results URL に ?learner= を付けて踏んでも未認証なら /login に流れる
 *
 * 注意:
 *  - W4 段階では webServer の DB を file:./tests/e2e/.tmp/e2e.db に切り替える土台を
 *    用意済 (T-4)。ただし parent / learner / mock_exam_results まで通した実描画 E2E
 *    は signup → 学習者作成 → 模試結果 seed まで自動化が必要なため、本 spec では
 *    認可リダイレクト + ルーティング存在のスモークで W5 以降のフル描画 E2E に
 *    繋ぐ。
 */

import { test, expect } from "@playwright/test";

test.describe("/parent/mock-exam-results - 模試結果ページ スモーク", () => {
  test("未認証で /parent/mock-exam-results を開くと /login にリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/parent/mock-exam-results");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("/parent/mock-exam-results ルートが notFound に倒れない", async ({
    page,
  }) => {
    const res = await page.goto("/parent/mock-exam-results");
    if (res) {
      // 認可前の段階なら /login へ 200/307/308
      expect([200, 307, 308]).toContain(res.status());
    }
    // /parent/mock-exam-results そのままに留まらない (リダイレクトされる)
    await expect(page).not.toHaveURL(/^.*\/parent\/mock-exam-results$/);
  });

  test("?learner=<id> 付きで踏んでも未認証なら /login に流れる (URL 改ざん防御の最終層)", async ({
    page,
  }) => {
    await page.goto("/parent/mock-exam-results?learner=lr_other_family");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
