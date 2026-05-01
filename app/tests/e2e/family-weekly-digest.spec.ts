/**
 * E2E: family-weekly-digest (W11-T5 / 保護者ダッシュボード Card 版 Weekly Digest)
 *
 * 検証スコープ (read path / 親可視化レイヤ / DEC-024 罰則ゼロ / DEC-063):
 *   1. family + parent + 2 learner + answer_logs 直接 INSERT
 *      → /parent/dashboard で `data-testid="family-weekly-digest-card"` 可視
 *      → 罰語が一切含まれない
 *      → `data-week-encouragement-key` が pre-curated catalog の key のいずれか
 *      → top-skills-count >= 1
 *   2. 解答ログ無しの family
 *      → card 可視 + topSkills 0 件 + 「来週から ...」 fallback コピー表示
 *      → 罰語が一切含まれない
 *
 * 戦略:
 *   - W11-T3 family-leaderboard.spec.ts と同 SQLITE_BUSY 対策 + signupAndOnboard.
 *   - read path のみ確認 (write 経路は study-smoke 等が個別に carry).
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
    email: `family_wd_${stamp}@hanei.test`,
    password: "test-password-family-wd",
    parentName: `家族ＷＤ親${workerIndex}`,
    nickname: `家族ＷＤ子A${workerIndex}_${suffix}`,
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

async function execWithRetry<T>(fn: () => Promise<T>, maxAttempts = 16): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/SQLITE_BUSY|database is locked/i.test(msg)) throw err;
      lastErr = err;
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

async function addSiblingLearner(
  familyId: string,
  nickname: string,
): Promise<string> {
  const client = createClient({ url: dbUrl() });
  const learnerId = `lrn_e2e_wd_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
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
 * answer_logs に正解 row を N 件 INSERT (db-fixture seed の `prb_e2e_5_vocab_001` を使う).
 * 直近 7 日 window 内に必ず入る.
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
      const id = `alog_e2e_wd_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      return {
        sql: `INSERT INTO answer_logs (
          id, learner_id, problem_id, user_answer, is_correct, time_spent_ms, answered_at
        ) VALUES (?, ?, ?, 'A', 1, 1500, ?)`,
        args: [id, learnerId, problemId, nowSec - i * 60] as const,
      };
    });
    await execWithRetry(() =>
      client.batch(
        stmts.map((s) => ({ sql: s.sql, args: [...s.args] })),
        "write",
      ),
    );
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
  "最下位",
  "ペナルティ",
  "サボ",
  "もうダメ",
  "失敗",
  "やりすぎ",
  "がんばってない",
] as const;

function expectNoPunishmentWords(text: string): void {
  for (const w of PUNISHMENT_WORDS) {
    expect(
      text,
      `罰語 "${w}" が含まれてはいけない (DEC-024 罰則ゼロ哲学)`,
    ).not.toContain(w);
  }
}

// pre-curated catalog (= ENCOURAGEMENT_COPIES の key) - source of truth と一致する集合.
const ENCOURAGEMENT_KEYS = [
  "next_week_together",
  "small_steps",
  "family_continues",
  "be_kind",
  "future_self",
  "without_pressure",
  "support_matters",
  "looking_forward",
] as const;

// fullyParallel=true で同一 file: SQLite に複数 worker から書き込むと SQLITE_BUSY が発生する.
// W11-T3 / W11-T5 と同様 serial 化.
test.describe.configure({ mode: "serial" });

test.describe("family-weekly-digest (W11-T5 / Card 版 Weekly Digest / DEC-063)", () => {
  test("解答ログ有り family → digest card 可視 + 罰語不在 + encouragement key valid + top skills >= 1", async ({
    page,
  }, testInfo) => {
    const { learnerId: learnerA } = await signupAndOnboard(
      page,
      testInfo.workerIndex,
      "with_logs_a",
    );
    const familyId = await getFamilyIdForLearner(learnerA);
    const learnerB = await addSiblingLearner(familyId, "妹ＷＤ");

    // 直近 7 日に正解ログ INSERT (= top skills が必ず 1 件以上入る + leaderboard XP > 0)
    await insertCorrectAnswers(learnerA, 4);
    await insertCorrectAnswers(learnerB, 2);

    await page.goto(
      `/parent/dashboard?learner=${encodeURIComponent(learnerA)}`,
    );
    const card = page.locator('[data-testid="family-weekly-digest-card"]');
    await expect(card).toBeVisible({ timeout: 15000 });

    // encouragement key が catalog のいずれかに該当
    const encouragementKey = await card.getAttribute(
      "data-week-encouragement-key",
    );
    expect(encouragementKey, "encouragement key 属性が存在").toBeTruthy();
    expect(
      ENCOURAGEMENT_KEYS as ReadonlyArray<string>,
    ).toContain(encouragementKey ?? "");

    // top skills は >= 1 件 (vocabulary-5 が JOIN で出る)
    const topSkillsCount = await card.getAttribute("data-top-skills-count");
    expect(Number(topSkillsCount)).toBeGreaterThanOrEqual(1);

    // 各子の今週 XP ミニリスト: learnerA / learnerB が data-digest-learner-id で見える
    await expect(
      card.locator(`[data-digest-learner-id="${learnerA}"]`),
    ).toBeVisible();
    await expect(
      card.locator(`[data-digest-learner-id="${learnerB}"]`),
    ).toBeVisible();

    // top skill 1 件目は data-digest-top-skill-id が存在
    await expect(
      card.locator("[data-digest-top-skill-id]").first(),
    ).toBeVisible();

    // 罰語不在 (DEC-024)
    const cardText = (await card.textContent()) ?? "";
    expectNoPunishmentWords(cardText);
  });

  test("解答ログ無しの family → digest card 可視 + topSkills 0 件 + 「来週から ...」 fallback + 罰語不在", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(
      page,
      testInfo.workerIndex,
      "no_logs",
    );
    // answer_logs INSERT しない → top skills 0 件

    await page.goto(
      `/parent/dashboard?learner=${encodeURIComponent(learnerId)}`,
    );
    const card = page.locator('[data-testid="family-weekly-digest-card"]');
    await expect(card).toBeVisible({ timeout: 15000 });

    // top skills 0 件
    const topSkillsCount = await card.getAttribute("data-top-skills-count");
    expect(topSkillsCount).toBe("0");

    // fallback コピー
    const cardText = (await card.textContent()) ?? "";
    expect(cardText).toContain("来週から");

    // encouragement key も catalog 内
    const encouragementKey = await card.getAttribute(
      "data-week-encouragement-key",
    );
    expect(
      ENCOURAGEMENT_KEYS as ReadonlyArray<string>,
    ).toContain(encouragementKey ?? "");

    // 罰語不在
    expectNoPunishmentWords(cardText);
  });
});
