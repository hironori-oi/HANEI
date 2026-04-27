/**
 * E2E: 学習コアループ multi-level スモーク (W6 / B-5)
 *
 * 目的:
 *   W5 G-6 の `study-smoke.spec.ts` は 5 級 vocab しか走っていないため、
 *   skill_id `<base>-<level>` 形式 (DEC-038 補遺 #2 の canonical) が
 *   4 級 / 3 級で破綻していても regression を検出できなかった。
 *
 *   本 spec では parametrize で以下 4 ルートをカバーし、production canonical の
 *   `vocabulary-4` / `reading-4` / `vocabulary-3` / `reading-3` が正しく
 *   resolve することを構造的に保証する。
 *
 * シナリオ (各ルート共通 / parametrize):
 *   1. /signup から保護者を新規登録 (workerIndex + level + skill で email 衝突回避)
 *   2. /onboarding/learner で受験する級 = 該当級, 受験日 = 半年後
 *   3. /home に遷移 (基本 DOM 検証 — 進捗バー / 受験日 / きょうのミッション)
 *   4. /study/eiken-${level}/${skill} に直接遷移 (home の CTA は target_level 依存のため)
 *   5. 4 択 1 問が表示されることを検証 → A 選択 → 即時フィードバック → 解説
 *   6. 「つぎの問題へ」 → feedback が消える
 *
 * 注意:
 *   - listening は TTS audio 必須なので B-5 の対象外
 *   - 4/3 級の skill_id 解決が壊れていれば「問題が用意されていません」案内が出るので、
 *     4 択ボタンの可視確認だけで silent breakage を検出できる
 *   - fixture (`tests/e2e/fixtures/db-fixture.ts`) は production の `mapSkillId(level, skill)`
 *     を共有 module 経由で借用済 (W6 B-6)
 */

import { test, expect } from "@playwright/test";

type LevelCode = "5" | "4" | "3";
type SkillCode = "vocab" | "reading";

interface Route {
  level: LevelCode;
  skill: SkillCode;
  description: string;
}

const ROUTES: ReadonlyArray<Route> = [
  { level: "4", skill: "vocab", description: "英検4級 vocab" },
  { level: "4", skill: "reading", description: "英検4級 reading" },
  { level: "3", skill: "vocab", description: "英検3級 vocab" },
  { level: "3", skill: "reading", description: "英検3級 reading" },
];

function buildSignupCredentials(
  workerIndex: number,
  level: LevelCode,
  skill: SkillCode,
): {
  email: string;
  password: string;
  parentName: string;
  nickname: string;
} {
  const stamp = `${Date.now()}_${workerIndex}_${level}${skill}`;
  return {
    email: `multi_${stamp}@hanei.test`,
    password: "test-password-multi",
    parentName: `マルチ保護者${workerIndex}`,
    nickname: `マルチ${level}${skill}`,
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

test.describe("MVP 学習コアループ multi-level スモーク (W6 B-5)", () => {
  for (const route of ROUTES) {
    test(`${route.description}: signup → onboarding(level=${route.level}) → /study/eiken-${route.level}/${route.skill} → 解答 → フィードバック`, async ({
      page,
    }, testInfo) => {
      const { email, password, parentName, nickname } = buildSignupCredentials(
        testInfo.workerIndex,
        route.level,
        route.skill,
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
      // 2. /onboarding/learner
      // ---------------------------------------------------------------------
      await page.goto("/onboarding/learner");
      await expect(
        page.getByRole("heading", { name: /お子さまのプロフィール/ }),
      ).toBeVisible({ timeout: 15000 });

      await page.getByLabel("ニックネーム").fill(nickname);
      await page
        .locator('select[name="target_level"]')
        .selectOption(route.level);
      await page.locator('input[name="exam_date"]').fill(examDate);

      await page.getByRole("button", { name: "この内容で進める" }).click();

      // ---------------------------------------------------------------------
      // 3. /home (実データ表示)
      // ---------------------------------------------------------------------
      await expect(page).toHaveURL(/\/home$/, { timeout: 15000 });
      await expect(
        page.getByRole("heading", { name: "きょうのミッション" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: new RegExp(`英検${route.level}級の進捗`) }),
      ).toBeVisible();

      // ---------------------------------------------------------------------
      // 4. /study/eiken-${level}/${skill} へ直接遷移
      //    (home CTA は vocab/grammar しか提示しないため reading は直 URL でカバー)
      // ---------------------------------------------------------------------
      await page.goto(`/study/eiken-${route.level}/${route.skill}`);
      await expect(page).toHaveURL(
        new RegExp(`/study/eiken-${route.level}/${route.skill}`),
        { timeout: 15000 },
      );

      // 4 択 + ことだまトリ thinking
      const kotodama = page.locator('[data-testid="kotodama-tori"]');
      await expect(kotodama).toBeVisible({ timeout: 15000 });
      await expect(kotodama).toHaveAttribute("data-mood", "thinking");

      const choiceA = page.locator('[data-testid="choice-A"]');
      const choiceB = page.locator('[data-testid="choice-B"]');
      const choiceC = page.locator('[data-testid="choice-C"]');
      const choiceD = page.locator('[data-testid="choice-D"]');
      await expect(choiceA).toBeVisible();
      await expect(choiceB).toBeVisible();
      await expect(choiceC).toBeVisible();
      await expect(choiceD).toBeVisible();

      const promptText = await page
        .locator('[data-testid="study-prompt"]')
        .innerText();
      expect(promptText.trim().length).toBeGreaterThan(0);

      // listening 以外なので audio-player は出ない (canonical resolver の確認)
      expect(await page.locator('[data-testid="audio-player"]').count()).toBe(0);

      // ---------------------------------------------------------------------
      // 5. 解答 → 即時フィードバック
      // ---------------------------------------------------------------------
      await choiceA.click();

      const feedback = page.locator('[data-testid="study-feedback"]');
      await expect(feedback).toBeVisible({ timeout: 15000 });

      const verdictHeading = feedback.getByRole("heading", {
        name: /(せいかい|おしい)/,
      });
      await expect(verdictHeading).toBeVisible();

      const explanationText = await page
        .locator('[data-testid="study-explanation"]')
        .innerText();
      expect(explanationText.trim().length).toBeGreaterThan(0);

      const moodAfter = await kotodama.getAttribute("data-mood");
      expect(["cheerful", "celebrating", "sad", "encouraging"]).toContain(
        moodAfter,
      );

      // ---------------------------------------------------------------------
      // 6. 次問遷移 (router.refresh で別 problemId or /home)
      // ---------------------------------------------------------------------
      const nextBtn = page.locator('[data-testid="study-next"]');
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();

      await expect(feedback).toBeHidden({ timeout: 15000 });

      const currentUrl = page.url();
      if (/\/home$/.test(currentUrl)) {
        await expect(
          page.getByRole("heading", { name: "きょうのミッション" }),
        ).toBeVisible();
      } else {
        await expect(page).toHaveURL(
          new RegExp(`/study/eiken-${route.level}/${route.skill}`),
        );
        const nextPrompt = page.locator('[data-testid="study-prompt"]');
        await expect(nextPrompt).toBeVisible({ timeout: 15000 });
        const nextPromptText = await nextPrompt.innerText();
        expect(nextPromptText.trim().length).toBeGreaterThan(0);
      }
    });
  }
});
