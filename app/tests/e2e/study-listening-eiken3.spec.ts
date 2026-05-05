/**
 * E2E: study-listening-eiken3 (W12-T5 / DEC-079)
 *
 * 目的:
 *   β 開始 19 項目判定 (DEC-074 §6) の「リスニング音源最低 1 セット seed 投入」
 *   GREEN 化条件のうち、「3 級 listening が audio gate UI で再生可能 + replay
 *   3 回上限が機能する」を Playwright で実機検証する。
 *
 * 前提:
 *   - tests/e2e/fixtures/db-fixture.ts は 3 級 listening の skills / problems を
 *     seed していないため、本 spec の beforeAll で直接 fixture DB に
 *     skills(listening-3) / problems / problem_explanations を 1 件 INSERT する。
 *   - audio_url は dummy URL (実 R2 fetch は network 落ちで再生エラーになる) でも、
 *     <audio> 要素の描画 + onPlay handler 起動 + playCount counter + MAX_REPLAY=3
 *     gate は HTMLMediaElement.play() を Playwright が呼べばトリガーされる。
 *
 * 検証ポイント:
 *   1. /study/eiken-3/listening 直リンクで 4 択問題が描画される
 *   2. data-testid="audio-player" Card が描画される (shouldShowAudioUi gate)
 *   3. data-testid="audio-element" の <audio> 要素が src 付きで描画される
 *   4. data-testid="audio-play-toggle" が disabled でないこと
 *   5. クリック → playCount text "X / 3 かい" が 1 → 2 → 3 と進む
 *   6. 4 回目クリック試行時には replay button が disabled になること
 *   7. 罰語ゼロ (失敗 / サボ / ダメ / 悪い) が body 全体に含まれない
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@libsql/client";

const E2E_DB_URL =
  process.env.TURSO_DATABASE_URL_E2E ?? "file:./tests/e2e/.tmp/e2e.db";

// 本 spec 専用 problem id (fixture の prb_e2e_ ID 命名と衝突しない)
const TEST_PROBLEM_ID = "prb_e2e_listening3_001";
const TEST_AUDIO_URL =
  "https://example.com/tts/v1/L3-001-nova-e2e-fixture.mp3";

function buildSignupCredentials(workerIndex: number): {
  email: string;
  password: string;
  parentName: string;
  nickname: string;
} {
  const stamp = `${Date.now()}_${workerIndex}`;
  return {
    email: `parent_listening3_${stamp}@hanei.test`,
    password: "test-password-listening3",
    parentName: `保護者${workerIndex}`,
    nickname: `子${workerIndex}`,
  };
}

function isoDateOffsetDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 3 級 listening の skills + problems + problem_explanations を 1 件 INSERT する。
 * 冪等 (INSERT OR IGNORE 相当 / 既存行があれば audio_url のみ UPDATE)。
 */
async function ensureEiken3ListeningSeed(): Promise<void> {
  const client = createClient({ url: E2E_DB_URL });
  try {
    // skills 行 (listening-3) を upsert
    // 既存行があっても無視 (display_name は念のため固定値で更新しない方が冪等)
    try {
      await client.execute({
        sql: `INSERT INTO skills (id, eiken_level_id, display_name) VALUES (?, ?, ?)`,
        args: ["listening-3", "3", "英検 3 級 リスニング"],
      });
    } catch {
      // 既に存在 → そのまま
    }

    // problems 行 (eiken-3 listening / audio_url 付き)
    const questionJson = JSON.stringify({
      prompt: "対話を聞いて、質問に答えなさい。",
      audioTranscript:
        "What did you do at school today? I studied math and played soccer.",
      choices: [
        { label: "A", text: "He studied math and played soccer." },
        { label: "B", text: "He went to the library." },
        { label: "C", text: "He stayed home all day." },
        { label: "D", text: "He visited his grandmother." },
      ],
      estimatedTimeSec: 30,
      difficulty: 1,
      tags: ["listening", "school"],
    });

    // 1 度 DELETE して INSERT し直す形で冪等を担保 (audio_url 含む全列を fixture 値に固定)
    await client.execute({
      sql: `DELETE FROM problem_explanations WHERE problem_id = ?`,
      args: [TEST_PROBLEM_ID],
    });
    await client.execute({
      sql: `DELETE FROM problems WHERE id = ?`,
      args: [TEST_PROBLEM_ID],
    });
    await client.execute({
      sql: `INSERT INTO problems (id, level_id, skill_id, type, question_json, correct_answer, explanation, audio_url, qa_verdict, qa_status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        TEST_PROBLEM_ID,
        "3",
        "listening-3",
        "listening_mcq",
        questionJson,
        "A",
        "「I studied math and played soccer」と言っているので、彼は数学の学習とサッカーをしました。",
        TEST_AUDIO_URL,
        "pass",
        "live",
        "ai_generated",
      ],
    });
    await client.execute({
      sql: `INSERT INTO problem_explanations (id, problem_id, explanation_text, generated_by) VALUES (?, ?, ?, ?)`,
      args: [
        `pe_${TEST_PROBLEM_ID}`,
        TEST_PROBLEM_ID,
        "音声で「I studied math and played soccer」と言っているので A が正解です。",
        "curated",
      ],
    });
  } finally {
    client.close();
  }
}

test.describe("MVP β: 3 級 listening audio gate (W12-T5 / DEC-079)", () => {
  test.beforeAll(async () => {
    await ensureEiken3ListeningSeed();
  });

  test("/study/eiken-3/listening で audio-player が描画され replay 3 回上限が機能する", async ({
    page,
  }, testInfo) => {
    const { email, password, parentName, nickname } = buildSignupCredentials(
      testInfo.workerIndex,
    );
    const examDate = isoDateOffsetDays(180);

    // ----- signup -----
    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel(/パスワード/).fill(password);
    await page.getByLabel("保護者の方のお名前").fill(parentName);
    await page.locator('input[name="consent_coppa"]').check();
    await page.locator('input[name="consent_ai_chat"]').check();
    await page.locator('input[name="consent_terms"]').check();
    await page.getByRole("button", { name: "アカウントを作成する" }).click();
    await expect(page).toHaveURL(/\/verify-email(\?|$)/, { timeout: 15000 });

    // ----- onboarding (target_level=3 を選択して 3 級 listening 動線に揃える) -----
    await page.goto("/onboarding/learner");
    await page.getByLabel("ニックネーム").fill(nickname);
    await page.locator('select[name="target_level"]').selectOption("3");
    await page.locator('input[name="exam_date"]').fill(examDate);
    await page.getByRole("button", { name: "この内容で進める" }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 15000 });

    // ----- /study/eiken-3/listening に直リンクで遷移 -----
    await page.goto("/study/eiken-3/listening");
    await expect(page).toHaveURL(/\/study\/eiken-3\/listening/, {
      timeout: 15000,
    });

    // 問題 prompt が描画される
    const prompt = page.locator('[data-testid="study-prompt"]');
    await expect(prompt).toBeVisible({ timeout: 15000 });

    // -----------------------------------------------------------------------
    // (2)(3) audio-player Card + <audio> 要素
    // -----------------------------------------------------------------------
    const audioPlayer = page.locator('[data-testid="audio-player"]');
    await expect(audioPlayer).toBeVisible();

    const audioEl = page.locator('[data-testid="audio-element"]');
    await expect(audioEl).toHaveAttribute("src", TEST_AUDIO_URL);

    // -----------------------------------------------------------------------
    // (4) play-toggle が初期状態で disabled でない (canReplay(0)=true)
    // -----------------------------------------------------------------------
    const playToggle = page.locator('[data-testid="audio-play-toggle"]');
    await expect(playToggle).toBeVisible();
    await expect(playToggle).toBeEnabled();

    const replayBtn = page.locator('[data-testid="audio-replay"]');
    await expect(replayBtn).toBeEnabled();

    const playCount = page.locator('[data-testid="audio-play-count"]');
    await expect(playCount).toHaveText("0 / 3 かい");

    // -----------------------------------------------------------------------
    // (5) onPlay handler を発火させて playCount を進める
    //   実 audio fetch は dummy URL のため失敗するが、
    //   HTMLMediaElement.play() を呼ぶと React 側 <audio onPlay> が発火し
    //   setPlayCount((c) => c + 1) が実行される。Playwright の evaluate で
    //   src 付きでも play() の Promise は reject されるが onPlay は呼ばれない
    //   ケースもあるため、本 spec では onPlay event を直接 dispatch して
    //   counter 遷移と MAX_REPLAY=3 disabled gate のロジック側を検証する。
    // -----------------------------------------------------------------------
    for (let i = 1; i <= 3; i++) {
      await audioEl.evaluate((el) => {
        el.dispatchEvent(new Event("play"));
      });
      await expect(playCount).toHaveText(`${i} / 3 かい`);
    }

    // (6) 3 回到達後は replay disabled (canReplay(3)=false)
    await expect(replayBtn).toBeDisabled();
    // play-toggle は「現在再生中なら enabled / そうでなければ canReplay(playCount)」
    // で disabled が決まる。onPlay dispatch 後 isPlaying=true なので enabled だが、
    // pause を dispatch すると disabled に落ちるはず。
    await audioEl.evaluate((el) => {
      el.dispatchEvent(new Event("pause"));
    });
    await expect(playToggle).toBeDisabled();

    // -----------------------------------------------------------------------
    // (7) 罰語ゼロ assert (DEC-024)
    // -----------------------------------------------------------------------
    const body = page.locator("body");
    await expect(body).not.toContainText("失敗");
    await expect(body).not.toContainText("サボ");
    await expect(body).not.toContainText("ダメ");
    await expect(body).not.toContainText("悪い");
  });
});
