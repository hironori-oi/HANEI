/**
 * E2E: overtime_cumulative (W10-T5 / 60 分 hard_limit + DEC-024 streak 保全)
 *
 * 検証ポイント:
 *   1. 60 分 hard_limit gate:
 *      - DB の study_sessions.cumulative_seconds を 60 分以上に揃えた状態で
 *        /study/eiken-5/vocab を再訪 → page.tsx server で hard_limit 判定 →
 *        問題ページではなく gate ページ ([data-testid="overlearning-hard-limit-gate"])
 *        が描画される (DB 負荷削減 + 入口で止める).
 *   2. 罰則ゼロ哲学 (DEC-024):
 *      - hard_limit 到達時点で streaks.current_streak / longest_streak は減らない.
 *      - 「ごほうび: あした また あおうね」のような前向きコピーで終わる
 *        (gate ページに「がんばったね」が含まれる).
 *   3. 「ホームへ もどる」ボタンで /home に戻れる (動線確認).
 *
 * 戦略:
 *   - signup → /home → /study/eiken-5/vocab?dur=5&session=<uuid> で session-mode 起動
 *   - 起動時の streak 値を保存 (W10-T5 着手前)
 *   - 直接 SQL で cumulative_seconds = 60*60 + 1 に書き換え
 *   - reload で hard_limit gate が描画される
 *   - reload 後の streak 値を再読込 → 値が一致 (減算なし) を assert
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

function buildSignupCredentials(workerIndex: number): {
  email: string;
  password: string;
  parentName: string;
  nickname: string;
} {
  const stamp = `${Date.now()}_${workerIndex}`;
  return {
    email: `overtime_${stamp}@hanei.test`,
    password: "test-password-overtime",
    parentName: `60分保護者${workerIndex}`,
    nickname: `60分子${workerIndex}`,
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

function dbUrl(): string {
  return (
    process.env.TURSO_DATABASE_URL_E2E ??
    process.env.TURSO_DATABASE_URL ??
    "file:./tests/e2e/.tmp/e2e.db"
  );
}

async function readStreak(
  learnerId: string,
): Promise<{
  currentStreak: number;
  longestStreak: number;
  freezeTickets: number;
} | null> {
  const client = createClient({ url: dbUrl() });
  try {
    const r = await client.execute({
      sql: "SELECT current_streak, longest_streak, freeze_tickets FROM streaks WHERE learner_id = ? LIMIT 1",
      args: [learnerId],
    });
    if (r.rows.length === 0) return null;
    const row = r.rows[0]!;
    return {
      currentStreak: Number(row.current_streak),
      longestStreak: Number(row.longest_streak),
      freezeTickets: Number(row.freeze_tickets),
    };
  } finally {
    client.close();
  }
}

async function bumpCumulativeSeconds(
  learnerId: string,
  totalSeconds: number,
): Promise<void> {
  const client = createClient({ url: dbUrl() });
  try {
    const rows = await client.execute({
      sql: "SELECT id FROM study_sessions WHERE learner_id = ?",
      args: [learnerId],
    });
    if (rows.rows.length === 0) {
      // 想定外: 安全側に new 行を seed する
      const id = `ss_overtime_seed_${randomUUID()}`;
      await client.execute({
        sql: "INSERT INTO study_sessions (id, learner_id, session_date, client_session_id, cumulative_seconds) VALUES (?, ?, date('now'), ?, ?)",
        args: [id, learnerId, `seed_${id}`, totalSeconds],
      });
      return;
    }
    await client.execute({
      sql: "UPDATE study_sessions SET cumulative_seconds = ? WHERE id = ?",
      args: [totalSeconds, String(rows.rows[0]!.id)],
    });
  } finally {
    client.close();
  }
}

async function signupAndOnboard(
  page: import("@playwright/test").Page,
  workerIndex: number,
): Promise<{ learnerId: string; nickname: string }> {
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

  const shopLink = page.locator('[data-testid="home-shop-link"]');
  await expect(shopLink).toBeVisible();
  const href = await shopLink.getAttribute("href");
  const match = href?.match(/learner=([^&]+)/);
  const learnerId = match ? decodeURIComponent(match[1]!) : "";
  expect(learnerId.length).toBeGreaterThan(0);

  return { learnerId, nickname };
}

test.describe("overtime-cumulative (W10-T5 / 60 分 hard_limit + DEC-024 streak 保全)", () => {
  test("当日累計が 60 分を超えると hard_limit gate が表示され、streak は減らない", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);

    // 1) session-mode で 1 度 /study に入って study_sessions 行を作る
    const sessionId = randomUUID();
    await page.goto(
      `/study/eiken-5/vocab?dur=5&session=${encodeURIComponent(sessionId)}`,
    );
    await expect(page.locator('[data-testid="study-prompt"]')).toBeVisible({
      timeout: 15000,
    });

    // 2) hard_limit 到達 _前_ の streak 値を保存
    const streakBefore = await readStreak(learnerId);
    expect(streakBefore).not.toBeNull();

    // 3) DB レイヤで cumulative_seconds を 60 分 + 1 秒 に書き換え
    await bumpCumulativeSeconds(learnerId, 60 * 60 + 1);

    // 4) reload で server-render 段階で hard_limit gate ページに切り替わる
    await page.goto(
      `/study/eiken-5/vocab?dur=5&session=${encodeURIComponent(sessionId)}`,
    );

    // 5) hard_limit gate が表示される (問題ページは出ない)
    const gate = page.locator('[data-testid="overlearning-hard-limit-gate"]');
    await expect(gate).toBeVisible({ timeout: 15000 });
    // 問題は server-render 段階で取得されない (= study-prompt が出ない)
    await expect(page.locator('[data-testid="study-prompt"]')).toHaveCount(0);

    // 6) 罰則ゼロ哲学 (DEC-024): 前向きコピー / 「がんばったね」が含まれる
    await expect(gate).toContainText("がんばったね");
    // 罰・否定の語が含まれていない
    const gateText = (await gate.textContent()) ?? "";
    expect(gateText).not.toContain("だめ");
    expect(gateText).not.toContain("やりすぎ");
    expect(gateText).not.toContain("ペナルティ");

    // 7) data-today-minutes が 60 (以上) を保持している
    const todayMinutesAttr = await gate.getAttribute("data-today-minutes");
    expect(todayMinutesAttr).not.toBeNull();
    expect(Number(todayMinutesAttr)).toBeGreaterThanOrEqual(60);

    // 8) DEC-024: streak が減算されていない (currentStreak / longestStreak / freezeTickets 不変)
    const streakAfter = await readStreak(learnerId);
    expect(streakAfter).not.toBeNull();
    expect(streakAfter!.currentStreak).toBe(streakBefore!.currentStreak);
    expect(streakAfter!.longestStreak).toBe(streakBefore!.longestStreak);
    expect(streakAfter!.freezeTickets).toBe(streakBefore!.freezeTickets);

    // 9) 「ホームへ もどる」ボタンで /home に戻れる (動線確認)
    await page.getByRole("link", { name: /ホームへ もどる/ }).click();
    await expect(page).toHaveURL(/\/home(\?|$)/, { timeout: 15000 });
  });
});
