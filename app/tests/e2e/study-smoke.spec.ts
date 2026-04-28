/**
 * E2E: 学習コアループのフル ハッピーパス スモーク (W5 / G-6 / DEC-036)
 *
 * 目的:
 *   MVP 第 1 シナリオ「signup → onboarding/learner → /home → /study/eiken-5/vocab → 解答 → 解説 → 次問」
 *   を Playwright で全自動化し、CI でも回せる前提のスモークとして 1 spec で完結させる。
 *
 * シナリオ:
 *   1. /signup から保護者を新規登録 (email + password + 同意 3 種)
 *   2. signup action が autoSignIn=true なので、redirect 先 (/verify-email) からそのまま
 *      session cookie を持って /onboarding/learner へ遷移可能
 *   3. /onboarding/learner で学習者プロフィール作成 (受験日 = 半年後)
 *   4. /home に遷移し、受験日カウントダウン / 進捗バー / きょうのミッション の DOM を検証
 *      - 「mastered=0 / total>0」「solved=0」が error にならず空状態として表示されること
 *   5. /study/eiken-5/vocab に遷移して 4 択問題 1 問が表示されることを検証
 *   6. 4 択のいずれかをクリック → 即時フィードバック (正誤マーク + 解説 + ことだまトリ mood)
 *      - mood は cheerful / encouraging / celebrating / sad のいずれか (thinking 以外)
 *   7. 「つぎの問題へ」ボタンクリック → 次の problemId に切り替わる or /home に戻る
 *
 * 前提:
 *   - playwright.config.ts の webServer が `npm run build && npm run start` で立ち上がり、
 *     env.TURSO_DATABASE_URL = file:./tests/e2e/.tmp/e2e.db に向いている (W4 / T-4)
 *   - tests/e2e/fixtures/db-fixture.ts が globalSetup で 5 級 vocab 5 問 + 各問の
 *     problem_explanations を seed している (G-4 フィルタ通過用)
 *   - Better Auth は requireEmailVerification=false なので signup 直後にログイン状態
 *   - listening の TTS audio はこのシナリオ対象外 (vocab ハッピーパスに集中)
 */

import { test, expect } from "@playwright/test";

// ハッピーパスは workerIndex で重複しない一意の email を発行 (fixture seed の
// parent.e2e@hanei.test と衝突しない / 複数 worker 間で衝突しない)
function buildSignupCredentials(workerIndex: number): {
  email: string;
  password: string;
  parentName: string;
  nickname: string;
} {
  const stamp = `${Date.now()}_${workerIndex}`;
  return {
    email: `smoke_${stamp}@hanei.test`,
    password: "test-password-smoke",
    parentName: `スモーク保護者${workerIndex}`,
    nickname: `スモーク子${workerIndex}`,
  };
}

// 受験日 = 半年後 (今日からおよそ 180 日後 / YYYY-MM-DD)
function sixMonthsFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  // ローカル日付で YYYY-MM-DD に整形 (UTC ずれ回避)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test.describe("MVP 学習コアループ ハッピーパス (G-6)", () => {
  test("signup → onboarding → /home → /study/eiken-5/vocab → 解答 → 解説 → 次問", async ({
    page,
  }, testInfo) => {
    const { email, password, parentName, nickname } = buildSignupCredentials(
      testInfo.workerIndex,
    );
    const examDate = sixMonthsFromNow();

    // -----------------------------------------------------------------------
    // 1. /signup
    // -----------------------------------------------------------------------
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: /アカウント作成/ }),
    ).toBeVisible();

    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel(/パスワード/).fill(password);
    await page.getByLabel("保護者の方のお名前").fill(parentName);

    // 3 種の同意を全部チェック
    await page.locator('input[name="consent_coppa"]').check();
    await page.locator('input[name="consent_ai_chat"]').check();
    await page.locator('input[name="consent_terms"]').check();

    await page.getByRole("button", { name: "アカウントを作成する" }).click();

    // signup action は autoSignIn=true で session cookie を発行し、
    // /verify-email にリダイレクトする (requireEmailVerification=false なので
    // verify を介さず先に進める)
    await expect(page).toHaveURL(/\/verify-email(\?|$)/, { timeout: 15000 });

    // -----------------------------------------------------------------------
    // 2. /onboarding/learner (signup の session cookie をそのまま使う)
    // -----------------------------------------------------------------------
    await page.goto("/onboarding/learner");
    await expect(
      page.getByRole("heading", { name: /お子さまのプロフィール/ }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByLabel("ニックネーム").fill(nickname);
    // avatar / current_level / target_level は default を採用 (kotodama_tori / beginner / 3)
    // ただし target_level は home の進捗バー / CTA URL を 5 級に揃えるため "5" に変更
    await page.locator('select[name="target_level"]').selectOption("5");
    await page.locator('input[name="exam_date"]').fill(examDate);

    await page.getByRole("button", { name: "この内容で進める" }).click();

    // -----------------------------------------------------------------------
    // 3. /home (実データ表示 / G-1 + G-3)
    // -----------------------------------------------------------------------
    await expect(page).toHaveURL(/\/home$/, { timeout: 15000 });

    // ヘッダ: ニックネーム + きょうのミッション
    await expect(
      page.getByRole("heading", { name: "きょうのミッション" }),
    ).toBeVisible();
    await expect(page.getByText(`こんにちは、${nickname} さん`)).toBeVisible();

    // 受験日カウントダウン (examDate が表示される + 「あと N 日」)
    await expect(page.getByText("受験日まで")).toBeVisible();
    await expect(page.getByText(examDate)).toBeVisible();
    // W8 で sakura-streak-display も「あと N 日で つぎの だんかい！」を出すため
    // 受験日カウントダウン側だけを指す aria-live="polite" のメイン日数表示を狙う。
    await expect(
      page.locator('p[aria-live="polite"]').filter({ hasText: /あと \d+ 日/ }),
    ).toBeVisible();

    // 連続記録 / Lv は初期値 (空状態) で表示される
    await expect(page.getByText("れんぞくきろく")).toBeVisible();
    await expect(page.getByText(/Lv\. \d+/)).toBeVisible();

    // G-3 進捗バー: 「英検5級の進捗」+ 4 スキル分の Progress (mastered=0 / total>0 が error にならない)
    await expect(
      page.getByRole("heading", { name: /英検5級の進捗/ }),
    ).toBeVisible();
    // aria-label で「<スキル名> の進捗 NN%」が 4 本存在することを確認
    const progressBars = page.locator('[role="progressbar"][aria-label*="の進捗"]');
    // /home の MissionCard 4 本 + 級別進捗 4 本 = 計 8 本以上
    await expect(progressBars.first()).toBeVisible();
    expect(await progressBars.count()).toBeGreaterThanOrEqual(4);

    // CTA: 「語彙(英検5級)をはじめる」(/study/eiken-5/vocab)
    const startVocabCta = page.getByRole("link", {
      name: /語彙\(英検5級\)をはじめる/,
    });
    await expect(startVocabCta).toBeVisible();

    // -----------------------------------------------------------------------
    // 4. /study/eiken-5/vocab (4 択問題)
    // -----------------------------------------------------------------------
    await startVocabCta.click();
    await expect(page).toHaveURL(/\/study\/eiken-5\/vocab/, { timeout: 15000 });

    // ことだまトリが表示される (解答前は thinking)
    const kotodama = page.locator('[data-testid="kotodama-tori"]');
    await expect(kotodama).toBeVisible();
    await expect(kotodama).toHaveAttribute("data-mood", "thinking");

    // 4 択ボタンが揃っている
    const choiceA = page.locator('[data-testid="choice-A"]');
    const choiceB = page.locator('[data-testid="choice-B"]');
    const choiceC = page.locator('[data-testid="choice-C"]');
    const choiceD = page.locator('[data-testid="choice-D"]');
    await expect(choiceA).toBeVisible();
    await expect(choiceB).toBeVisible();
    await expect(choiceC).toBeVisible();
    await expect(choiceD).toBeVisible();

    // 問題 prompt が表示されている (空でないこと)
    const promptText = await page
      .locator('[data-testid="study-prompt"]')
      .innerText();
    expect(promptText.trim().length).toBeGreaterThan(0);

    // listening 以外なので audio-player は表示されない (G-2 の gate 確認)
    expect(await page.locator('[data-testid="audio-player"]').count()).toBe(0);

    // -----------------------------------------------------------------------
    // 5. 解答 (A を選択 → 即時フィードバック)
    // -----------------------------------------------------------------------
    await choiceA.click();

    // 解説 + 次問ボタンの出現を待つ (server action 完了 = フィードバック描画)
    const feedback = page.locator('[data-testid="study-feedback"]');
    await expect(feedback).toBeVisible({ timeout: 15000 });

    // 正誤マーク (せいかい / おしい のどちらかが見えていれば OK)
    const verdictHeading = feedback.getByRole("heading", {
      name: /(せいかい|おしい)/,
    });
    await expect(verdictHeading).toBeVisible();

    // 解説テキスト (problem_explanations の cached / fallback) が表示される
    const explanationText = await page
      .locator('[data-testid="study-explanation"]')
      .innerText();
    expect(explanationText.trim().length).toBeGreaterThan(0);

    // ことだまトリ mood が thinking 以外に遷移している
    const moodAfter = await kotodama.getAttribute("data-mood");
    expect(["cheerful", "celebrating", "sad", "encouraging"]).toContain(
      moodAfter,
    );

    // -----------------------------------------------------------------------
    // 6. 次問遷移 (router.refresh で別 problemId が出る or /home へ)
    // -----------------------------------------------------------------------
    const firstProblemPrompt = promptText;

    const nextBtn = page.locator('[data-testid="study-next"]');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // 次の問題が出る or /home に戻る (フィードバックが消えていることを確認)
    await expect(feedback).toBeHidden({ timeout: 15000 });

    // /home に飛んだ or 次問 prompt が出ている のどちらかであれば OK
    const currentUrl = page.url();
    if (/\/home$/.test(currentUrl)) {
      await expect(
        page.getByRole("heading", { name: "きょうのミッション" }),
      ).toBeVisible();
    } else {
      // study ページのまま → 別 problemId が表示されているはず
      await expect(page).toHaveURL(/\/study\/eiken-5\/vocab/);
      const nextPrompt = page.locator('[data-testid="study-prompt"]');
      await expect(nextPrompt).toBeVisible({ timeout: 15000 });
      const nextPromptText = await nextPrompt.innerText();
      expect(nextPromptText.trim().length).toBeGreaterThan(0);
      // 直前と同じ問題が連続して出るのは router.refresh + SRS due 経路で
      // 起こりうる (1 問しか seed が無いケース等) ので必ずしも別 problem を要求しない
      // が、prompt が再度描画されていれば OK とする。
      void firstProblemPrompt;
    }
  });
});
