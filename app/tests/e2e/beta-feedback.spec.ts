/**
 * E2E: beta-feedback (W12-T3-B / DEC-070 / β feedback 収集動線)
 *
 * 検証スコープ:
 *   ① /home 表示時に [data-testid="beta-feedback-button"] が見える (parent role)
 *   ② ボタン click → dialog 開く / [data-testid="beta-feedback-textarea"] 表示
 *   ③ textarea 入力 → [data-testid="beta-feedback-submit"] click →
 *      [data-testid="beta-feedback-thanks"] 完了表示
 *   ④ 「閉じる」ボタン経路: 入力後に閉じる → 再 open で textarea が空に reset
 *
 * 前提:
 *   - DSN 未設定環境では Sentry SDK が `enabled: Boolean(dsn)` で no-op 化されるため、
 *     captureFeedback 呼び出しは構造的に副作用なし (envelope 飛ばない).
 *     E2E では実 SDK を呼んでも問題ない (DEC-070 §5).
 *   - BETA_FEEDBACK_ENABLED 未設定 = default 表示 (kill switch は "false" のみ非表示).
 *
 * 認可 (DEC-003):
 *   - middleware: /home は requireAuth で保護.
 *   - page: requireAuth + getFamilyIdForUser + requireLearnerOwner.
 *   - feedback button は client component / Sentry 直送のため DB 認可不要.
 */

import { test, expect, type Page } from "@playwright/test";

function buildSignupCredentials(workerIndex: number): {
  email: string;
  password: string;
  parentName: string;
  nickname: string;
} {
  const stamp = `${Date.now()}_${workerIndex}`;
  return {
    email: `beta_fb_${stamp}@hanei.test`,
    password: "test-password-beta-fb",
    parentName: `フィードバック保護者${workerIndex}`,
    nickname: `フィードバック子${workerIndex}`,
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

/**
 * signup → email-verify pass-through → onboarding → /home まで完了させる.
 * quests.spec.ts と同パターン.
 */
async function signupAndOnboard(
  page: Page,
  workerIndex: number,
): Promise<void> {
  const { email, password, parentName, nickname } =
    buildSignupCredentials(workerIndex);
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
}

// fullyParallel=true で同一 file: SQLite に複数 worker から書き込むと
// SQLITE_BUSY が発生する. quests.spec.ts / signup-beta-invite.spec.ts と同様 serial 化.
test.describe.configure({ mode: "serial" });

test.describe("beta-feedback (W12-T3-B / DEC-070)", () => {
  test("/home 上で feedback button が見える / dialog 開閉 / submit → thanks 表示", async ({
    page,
  }, testInfo) => {
    await signupAndOnboard(page, testInfo.workerIndex);

    // ① ボタン visible
    const feedbackButton = page.locator(
      '[data-testid="beta-feedback-button"]',
    );
    await expect(feedbackButton).toBeVisible({ timeout: 15000 });

    // 初期状態: dialog が開いていない (textarea が DOM に出ていない)
    await expect(
      page.locator('[data-testid="beta-feedback-textarea"]'),
    ).toHaveCount(0);

    // ② ボタン click → dialog 開く
    await feedbackButton.click();
    const textarea = page.locator(
      '[data-testid="beta-feedback-textarea"]',
    );
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // 完了状態が初期表示されていない
    await expect(
      page.locator('[data-testid="beta-feedback-thanks"]'),
    ).toHaveCount(0);

    // ③ textarea 入力 → submit
    await textarea.fill(
      "テストです。ご意見の送信フローが動いているか確認しています。",
    );
    const submit = page.locator('[data-testid="beta-feedback-submit"]');
    await expect(submit).toBeEnabled();
    await submit.click();

    // 完了表示 (中立文言 / DEC-024 罰則ゼロ)
    const thanks = page.locator('[data-testid="beta-feedback-thanks"]');
    await expect(thanks).toBeVisible({ timeout: 10000 });
    await expect(thanks).toContainText("ご意見を送信しました");
  });

  test("「閉じる」 → 再 open で textarea が空に reset (DEC-070 §4 cancel cases)", async ({
    page,
  }, testInfo) => {
    await signupAndOnboard(page, testInfo.workerIndex);

    const feedbackButton = page.locator(
      '[data-testid="beta-feedback-button"]',
    );
    await expect(feedbackButton).toBeVisible({ timeout: 15000 });
    await feedbackButton.click();

    const textarea = page.locator(
      '[data-testid="beta-feedback-textarea"]',
    );
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // 何か入力する
    await textarea.fill("途中まで書いたあとに閉じるパス");
    await expect(textarea).toHaveValue("途中まで書いたあとに閉じるパス");

    // 「閉じる」 button を click (radix Dialog onOpenChange(false) → state reset).
    // shadcn Dialog 既定の右上 X (aria sr-only "閉じる") と form 内 cancel が
    // どちらも name="閉じる" でマッチするため、form scope で限定する.
    const closeButton = page
      .locator("form")
      .getByRole("button", { name: "閉じる" });
    await closeButton.click();

    // dialog 消滅 = textarea が DOM から消える
    await expect(textarea).toHaveCount(0, { timeout: 5000 });

    // 再 open
    await feedbackButton.click();
    const textareaAgain = page.locator(
      '[data-testid="beta-feedback-textarea"]',
    );
    await expect(textareaAgain).toBeVisible({ timeout: 5000 });
    // 空に reset されていること (= state 完全 reset)
    await expect(textareaAgain).toHaveValue("");
  });
});
