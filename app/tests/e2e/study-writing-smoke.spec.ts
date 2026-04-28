/**
 * E2E: writing_essay UI スモーク (W7 / B-10)
 *
 * 目的:
 *   3 級 writing の textarea + 文字数カウンタ + 「決定」ボタン + AI フィードバック表示
 *   (DEC-039 / F-2 と W7 B-10) を 1 経路で全自動検証する。
 *
 * シナリオ:
 *   1. /signup → 保護者登録 (workerIndex で email 衝突回避)
 *   2. /onboarding/learner で受験する級 = 3, 受験日 = 半年後
 *   3. /home に遷移 (基本 DOM のみ確認)
 *   4. /study/eiken-3/writing へ直接遷移
 *   5. textarea + 文字数カウンタ + 「決定」ボタンが表示される
 *   6. 9 文字以下では「決定」disabled、10 文字以上で enabled
 *   7. 模範解答と単語が重複する英作文を入力 → 決定 → feedback 表示
 *   8. お手本 (model answer) は送信後にだけ表示される (カンニング防止)
 *
 * 注意:
 *   - OPENAI_API_KEY 未設定の E2E 環境では scoreWritingEssay() は
 *     jaccardWordOverlap ベースの決定論フォールバックに落ちるため、
 *     模範解答に近い回答であれば correct=true で「せいかい」と表示される。
 *   - 4 択ボタン (choice-A 等) は writing_essay では非表示であることを併せて検証。
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
    email: `writing_${stamp}@hanei.test`,
    password: "test-password-writing",
    parentName: `ライティング保護者${workerIndex}`,
    nickname: `ライティング子${workerIndex}`,
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

test.describe("MVP writing_essay UI スモーク (W7 B-10)", () => {
  test("signup → onboarding(level=3) → /study/eiken-3/writing → textarea 入力 → 決定 → feedback", async ({
    page,
  }, testInfo) => {
    const { email, password, parentName, nickname } = buildSignupCredentials(
      testInfo.workerIndex,
    );
    const examDate = sixMonthsFromNow();

    // ---------------------------------------------------------------------
    // 1. /signup
    // ---------------------------------------------------------------------
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: /アカウント作成/ }),
    ).toBeVisible();

    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel(/パスワード/).fill(password);
    await page.getByLabel("保護者の方のお名前").fill(parentName);

    await page.locator('input[name="consent_coppa"]').check();
    await page.locator('input[name="consent_ai_chat"]').check();
    await page.locator('input[name="consent_terms"]').check();

    await page.getByRole("button", { name: "アカウントを作成する" }).click();
    await expect(page).toHaveURL(/\/verify-email(\?|$)/, { timeout: 15000 });

    // ---------------------------------------------------------------------
    // 2. /onboarding/learner (level=3)
    // ---------------------------------------------------------------------
    await page.goto("/onboarding/learner");
    await expect(
      page.getByRole("heading", { name: /お子さまのプロフィール/ }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByLabel("ニックネーム").fill(nickname);
    await page.locator('select[name="target_level"]').selectOption("3");
    await page.locator('input[name="exam_date"]').fill(examDate);

    await page.getByRole("button", { name: "この内容で進める" }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 15000 });

    // ---------------------------------------------------------------------
    // 3. /study/eiken-3/writing へ遷移
    // ---------------------------------------------------------------------
    await page.goto("/study/eiken-3/writing");
    await expect(page).toHaveURL(/\/study\/eiken-3\/writing/, {
      timeout: 15000,
    });

    // 4 択は出ない (writing は textarea のみ)
    expect(await page.locator('[data-testid="choice-A"]').count()).toBe(0);
    expect(await page.locator('[data-testid="choice-B"]').count()).toBe(0);

    // textarea / counter / submit が表示される
    const textarea = page.locator('[data-testid="essay-textarea"]');
    const counter = page.locator('[data-testid="essay-counter"]');
    const submit = page.locator('[data-testid="essay-submit"]');
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await expect(counter).toBeVisible();
    await expect(submit).toBeVisible();

    // 送信前にお手本 (model answer) は出ていない (カンニング防止)
    expect(
      await page.locator('[data-testid="essay-model-answer"]').count(),
    ).toBe(0);

    // ---------------------------------------------------------------------
    // 4. 9 文字 (下限未満) では「決定」が disabled
    // ---------------------------------------------------------------------
    await textarea.fill("I like a");
    await expect(submit).toBeDisabled();
    await expect(counter).toContainText("8 / 600");

    // ---------------------------------------------------------------------
    // 5. 模範解答に近い回答を入力 → 決定 → feedback 表示
    //    (jaccard fallback で correct=true 期待 / OPENAI_API_KEY 不在環境前提)
    // ---------------------------------------------------------------------
    const goodAnswer =
      "I like soccer. I play soccer with my friends every weekend. It is fun.";
    await textarea.fill(goodAnswer);
    await expect(submit).toBeEnabled();
    await submit.click();

    const feedback = page.locator('[data-testid="study-feedback"]');
    await expect(feedback).toBeVisible({ timeout: 15000 });

    // explanation (kid-safe フィードバック) が表示
    const explanationText = await page
      .locator('[data-testid="study-explanation"]')
      .innerText();
    expect(explanationText.trim().length).toBeGreaterThan(0);

    // 送信後にお手本が表示される (送信前との対比)
    await expect(
      page.locator('[data-testid="essay-model-answer"]'),
    ).toBeVisible();
  });
});
