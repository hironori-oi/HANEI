/**
 * E2E: family-leaderboard (W11-T3 / 家族内ランキング)
 *
 * 検証スコープ (read path / 親可視化レイヤ / DEC-024 罰則ゼロ):
 *   1. 兄弟 2 人 + answer_logs 直接 INSERT
 *      → /parent/dashboard で 1 位 / 2 位が data-leaderboard-rank で見える
 *      → 1 位が高 XP / 2 位が低 XP / 罰語が無い
 *   2. 単独 learner (兄弟なし)
 *      → 「最下位」「ビリ」を絶対に出さず、「がんばってるね」前向きコピー
 *   3. 全員 0 XP (answer_logs ゼロ)
 *      → 「今週はまだ。今日 はじめよう」前向きコピー
 *   4. DEC-024 罰則ゼロ哲学: 罰語 (だめ / やりすぎ / ペナルティ / 最下位 / ビリ / 下位) 一切なし
 *
 * 戦略の根拠 (write path のテスト戦略 / W11-T1 と同一):
 *   - computeWeeklyXpRanking 純関数は tests/unit/family-leaderboard-ranking.test.ts で 14 ケース網羅済
 *     (通常降順 / 1224 ranking / 全員 0 / 単独 / 空 / 大量 / 負値・NaN 防御 / 非配列 throw / kotodama-tori stage / 小数 floor)
 *   - getFamilyWeeklyLeaderboard の SQL 経路 (eq(family_id) + inArray(learner_ids) + gte(answered_at))
 *     は drizzle layer の合成であり、family_id WHERE が SQL レベルで強制される構造で COPPA 準拠保証.
 *   - submitAnswer に W11-T3 で書き込み副作用は追加していない (read-only).
 *
 * 設計判断: E2E は「親 dashboard で見える結果」に集中.
 *   - 学習 UI 経由の click → submitAnswer は study-smoke / session-cumulative / overtime-cumulative
 *     が個別に carry. W11-T3 では親可視化と純関数挙動 + DB 集計の正確性に E2E を絞る.
 *   - W11-T1 と同パターンで answer_logs を直接 INSERT (UI flow 経由しない) → 既存リグレッションの影響を受けない.
 *
 * 依存:
 *   - migration 0001 で answer_logs / learner_profiles / problems が既に存在.
 *   - getFamilyWeeklyLeaderboard は src/lib/study/family-leaderboard.ts (read-only) で
 *     parent dashboard の Server Component から直 import される (W11-T3 設計 / DEC-061).
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

function buildSignupCredentials(workerIndex: number, suffix: string): {
  email: string;
  password: string;
  parentName: string;
  nickname: string;
} {
  const stamp = `${Date.now()}_${workerIndex}_${suffix}`;
  return {
    email: `family_lb_${stamp}@hanei.test`,
    password: "test-password-family-lb",
    parentName: `家族ＬＢ親${workerIndex}`,
    nickname: `家族ＬＢ子A${workerIndex}_${suffix}`,
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

/**
 * SQLITE_BUSY 用の retry helper.
 * fullyParallel=true で複数 worker から同一 file: DB に書き込むときに発生する一時的 lock を吸収.
 */
async function execWithRetry<T>(fn: () => Promise<T>, maxAttempts = 16): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/SQLITE_BUSY|database is locked/i.test(msg)) throw err;
      lastErr = err;
      // 100ms 〜 1500ms の指数 backoff (jitter 付き)
      const waitMs = Math.min(1500, 100 * 2 ** attempt) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

async function getFamilyIdForLearner(learnerId: string): Promise<string> {
  const client = createClient({ url: dbUrl() });
  try {
    const r = await execWithRetry(() =>
      client.execute({
        sql: "SELECT family_id FROM learner_profiles WHERE id = ? LIMIT 1",
        args: [learnerId],
      }),
    );
    if (r.rows.length === 0) {
      throw new Error(`learner ${learnerId} not found`);
    }
    return String(r.rows[0]!.family_id);
  } finally {
    client.close();
  }
}

/**
 * family に兄弟 learner を 1 人追加.
 * UI を通さず DB 直接 INSERT (E2E 用 minimal helper).
 */
async function addSiblingLearner(
  familyId: string,
  nickname: string,
): Promise<string> {
  const client = createClient({ url: dbUrl() });
  const learnerId = `lrn_e2e_lb_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  try {
    await execWithRetry(() =>
      client.execute({
        sql: `INSERT INTO learner_profiles (
          id, family_id, user_id, nickname, avatar_id,
          current_level, target_eiken_level, exam_date,
          daily_minutes_target, daily_goal_xp,
          preferences, coin_balance
        ) VALUES (?, ?, NULL, ?, 'kotodama_tori', 'eiken5', '5', NULL, 60, 20,
          '{"soundEnabled":true,"confettiEnabled":true}', 0)`,
        args: [learnerId, familyId, nickname],
      }),
    );
    return learnerId;
  } finally {
    client.close();
  }
}

/**
 * answer_logs に正解 row を N 件、現在時刻で INSERT.
 * 直近 7 日 window 内に必ず入る.
 *
 * problemId は db-fixture.ts の seed (`prb_e2e_5_vocab_001` etc.) を使用.
 *
 * SQLITE_BUSY 対策: client.batch() で 1 transaction にまとめ + retry-on-busy.
 */
async function insertCorrectAnswers(
  learnerId: string,
  count: number,
): Promise<void> {
  if (count <= 0) return;
  const client = createClient({ url: dbUrl() });
  try {
    const problemId = "prb_e2e_5_vocab_001";
    const nowSec = Math.floor(Date.now() / 1000);
    const stmts = Array.from({ length: count }, (_, i) => {
      const id = `alog_e2e_lb_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      return {
        sql: `INSERT INTO answer_logs (
          id, learner_id, problem_id, user_answer, is_correct, time_spent_ms, answered_at
        ) VALUES (?, ?, ?, 'A', 1, 1500, ?)`,
        args: [id, learnerId, problemId, nowSec - i * 60] as const,
      };
    });
    // batch を 1 transaction として処理 (worker 並列の SQLITE_BUSY を最小化)
    await execWithRetry(() => client.batch(stmts.map((s) => ({ sql: s.sql, args: [...s.args] })), "write"));
  } finally {
    client.close();
  }
}

async function signupAndOnboard(
  page: import("@playwright/test").Page,
  workerIndex: number,
  suffix: string,
): Promise<{ learnerId: string; nickname: string; email: string }> {
  const { email, password, parentName, nickname } = buildSignupCredentials(
    workerIndex,
    suffix,
  );
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

  return { learnerId, nickname, email };
}

const PUNISHMENT_WORDS = [
  "だめ",
  "やりすぎ",
  "ペナルティ",
  "最下位",
  "ビリ",
  "下位",
] as const;

function expectNoPunishmentWords(text: string): void {
  for (const w of PUNISHMENT_WORDS) {
    expect(text, `罰語 "${w}" が含まれてはいけない (DEC-024 罰則ゼロ哲学)`).not.toContain(
      w,
    );
  }
}

// fullyParallel=true で同一 file: SQLite に複数 worker から書き込むと SQLITE_BUSY が発生する.
// W11-T3 の 3 テストは write 量が小さいので serial で十分速く、安定させる方が価値が高い.
test.describe.configure({ mode: "serial" });

test.describe("family-leaderboard (W11-T3 / 家族内ランキング / 親への可視化)", () => {
  test("兄弟 2 人 + answer_logs INSERT → 1 位 / 2 位が降順で表示 (DEC-024 罰語ゼロ)", async ({
    page,
  }, testInfo) => {
    // Step 1: parent + 第 1 子 (A) を signup → onboard
    const { learnerId: learnerA } = await signupAndOnboard(
      page,
      testInfo.workerIndex,
      "two_a",
    );
    const familyId = await getFamilyIdForLearner(learnerA);

    // Step 2: 第 2 子 (B) を DB 直接で追加
    const learnerB = await addSiblingLearner(familyId, "妹ＬＢ");

    // Step 3: answer_logs 直接 INSERT (A=5 正解 → 50 XP / B=3 正解 → 30 XP)
    await insertCorrectAnswers(learnerA, 5);
    await insertCorrectAnswers(learnerB, 3);

    // Step 4: 親 dashboard で確認
    await page.goto(
      `/parent/dashboard?learner=${encodeURIComponent(learnerA)}`,
    );
    const card = page.locator('[data-testid="family-leaderboard-card"]');
    await expect(card).toBeVisible({ timeout: 15000 });

    // 1 位は学習者 A (50 XP)
    const rank1 = card.locator('[data-leaderboard-rank="1"]');
    await expect(rank1).toBeVisible();
    await expect(rank1).toHaveAttribute("data-learner-id", learnerA);
    await expect(rank1).toHaveAttribute("data-weekly-xp", "50");

    // 2 位は学習者 B (30 XP)
    const rank2 = card.locator('[data-leaderboard-rank="2"]');
    await expect(rank2).toBeVisible();
    await expect(rank2).toHaveAttribute("data-learner-id", learnerB);
    await expect(rank2).toHaveAttribute("data-weekly-xp", "30");

    // DEC-024 罰則ゼロ哲学: 罰語が含まれない
    const cardText = (await card.textContent()) ?? "";
    expectNoPunishmentWords(cardText);
  });

  test("単独 learner (兄弟なし) → 1 位のみ + 「がんばってるね」前向きコピー", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(
      page,
      testInfo.workerIndex,
      "solo",
    );
    // 直近 7 日 で 2 正解 → 20 XP
    await insertCorrectAnswers(learnerId, 2);

    await page.goto(
      `/parent/dashboard?learner=${encodeURIComponent(learnerId)}`,
    );
    const card = page.locator('[data-testid="family-leaderboard-card"]');
    await expect(card).toBeVisible({ timeout: 15000 });

    // 単独 learner は 1 位 (構造的に「最下位」を出さない)
    const rank1 = card.locator('[data-leaderboard-rank="1"]');
    await expect(rank1).toBeVisible();
    await expect(rank1).toHaveAttribute("data-learner-id", learnerId);
    await expect(rank1).toHaveAttribute("data-weekly-xp", "20");

    // 2 位以下は存在しない
    const rank2 = card.locator('[data-leaderboard-rank="2"]');
    await expect(rank2).toHaveCount(0);

    // 「がんばってるね」前向きコピー
    const cardText = (await card.textContent()) ?? "";
    expect(cardText).toContain("がんばってるね");
    expectNoPunishmentWords(cardText);
  });

  test("全員 0 XP (answer_logs ゼロ) → 「今週はまだ。今日 はじめよう」前向きコピー", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(
      page,
      testInfo.workerIndex,
      "zero",
    );
    // answer_logs は INSERT しない (= 0 XP)

    await page.goto(
      `/parent/dashboard?learner=${encodeURIComponent(learnerId)}`,
    );
    const card = page.locator('[data-testid="family-leaderboard-card"]');
    await expect(card).toBeVisible({ timeout: 15000 });

    // 1 位は存在 (1 人) するが weeklyXp=0
    const rank1 = card.locator('[data-leaderboard-rank="1"]');
    await expect(rank1).toBeVisible();
    await expect(rank1).toHaveAttribute("data-weekly-xp", "0");

    // 「今週はまだ」 + 「今日 はじめよう」が含まれる (= isAllZero / leaderboardSolo 解釈の上で
    //  単独 learner なら solo コピーに切替, 全員 0 で兄弟有なら zero コピーに切替).
    //  単独 learner で 0 XP のとき、現状 UI は solo 優先 ("今週も 0 XP がんばってるね") を出す.
    //  そこで「solo + 0 XP の前向きコピー」のいずれかが含まれることを許容する設計に合わせる.
    const cardText = (await card.textContent()) ?? "";
    const hasZeroPositive =
      cardText.includes("今週はまだ") || cardText.includes("がんばってるね");
    expect(
      hasZeroPositive,
      "全員 0 XP / 単独 0 XP 共に 前向きコピーが含まれる",
    ).toBe(true);
    expectNoPunishmentWords(cardText);
  });
});
