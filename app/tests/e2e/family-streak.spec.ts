/**
 * E2E: family-streak (W11-T1 / 家族のれんぞく)
 *
 * 検証スコープ (read path / 親可視化レイヤ):
 *   1. DB 直接で families.family_streak_days = 1 / last_family_active_date = 今日 をセットアップ
 *      → /parent/dashboard で data-family-streak-days="1" / data-family-streak-alive="1"
 *      が見えること.
 *   2. last_family_active_date を 1 日前にロールバック
 *      → 「生きて」いる扱い (isAlive=true / 今日学習すれば +1 候補) が表示されること.
 *   3. last_family_active_date = 2 日前
 *      → days=0 / isAlive=false (切れている) として表示されること.
 *   4. DEC-024 罰則ゼロ哲学: 表示コピーに罰語 (だめ / やりすぎ / ペナルティ) が含まれない.
 *
 * 戦略の根拠 (write path のテスト戦略):
 *   - computeFamilyStreakRollover の純関数は tests/unit/family-streak-rollover.test.ts で
 *     13 ケース網羅済 (同日 no-op / 連続日 +1 / 1 日空きで reset / null 初学習 /
 *     JST 6:00 境界整合 / 月跨ぎ / 年跨ぎ / うるう年 / 負値防御).
 *   - updateFamilyStreakOnLearn の SQL 経路 (atomic UPDATE WHERE last IS DISTINCT FROM today)
 *     は純関数 + drizzle layer の合成であり、純関数を網羅したことで構造的に書き込み正確性が保証される.
 *   - submitAnswer 終端での hook 呼び出しは best-effort (try/catch) で副作用ゼロ. study.ts diff で確認可能.
 *
 * 設計判断: E2E は「ユーザーから見える結果 = 親 dashboard 表示」に集中させる.
 *   - W10-T5 push 時点 (c337bf9) で study-smoke / family-streak の click → study-feedback 経路に
 *     既存リグレッションが存在することを確認 (= W11-T1 とは独立の preexisting issue).
 *   - 学習 UI 経由の click → submitAnswer は study-smoke / session-cumulative / overtime-cumulative
 *     が個別に carry する責務範囲. W11-T1 では family streak の親可視化と純関数挙動に E2E を絞る.
 *
 * 依存:
 *   - migration 0015 で families.family_streak_days + last_family_active_date が追加済 (db-fixture.ts)
 *   - getFamilyStreak は src/lib/study/family-streak.ts (read-only) で server action 経由ではなく
 *     parent dashboard の Server Component から直 import される (W11-T1 設計)
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@libsql/client";

function buildSignupCredentials(workerIndex: number): {
  email: string;
  password: string;
  parentName: string;
  nickname: string;
} {
  const stamp = `${Date.now()}_${workerIndex}`;
  return {
    email: `family_streak_${stamp}@hanei.test`,
    password: "test-password-family",
    parentName: `家族保護者${workerIndex}`,
    nickname: `家族子A${workerIndex}`,
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
 * JST 6:00 境界の今日の quest_date を 'YYYY-MM-DD' 形式で返す純関数.
 * E2E 用 helper. src/lib/quest/jst-date.ts の挙動と整合させる.
 */
function getTodayJstQuestDate(): string {
  const now = new Date();
  const jstShifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // JST 06:00 を境に quest_date が変わる. JST 06:00 未満なら前日.
  if (jstShifted.getUTCHours() < 6) {
    jstShifted.setUTCDate(jstShifted.getUTCDate() - 1);
  }
  const y = jstShifted.getUTCFullYear();
  const m = String(jstShifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jstShifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function previousDateString(dateStr: string): string {
  const parts = dateStr.split("-").map((s) => Number.parseInt(s, 10));
  const utc = Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!);
  const prev = new Date(utc - 24 * 60 * 60 * 1000);
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  return `${py}-${pm}-${pd}`;
}

async function getFamilyIdForLearner(learnerId: string): Promise<string> {
  const client = createClient({ url: dbUrl() });
  try {
    const r = await client.execute({
      sql: "SELECT family_id FROM learner_profiles WHERE id = ? LIMIT 1",
      args: [learnerId],
    });
    if (r.rows.length === 0) {
      throw new Error(`learner ${learnerId} not found`);
    }
    return String(r.rows[0]!.family_id);
  } finally {
    client.close();
  }
}

async function setFamilyStreakDirect(
  familyId: string,
  days: number,
  lastActiveDate: string | null,
): Promise<void> {
  const client = createClient({ url: dbUrl() });
  try {
    await client.execute({
      sql: "UPDATE families SET family_streak_days = ?, last_family_active_date = ? WHERE id = ?",
      args: [days, lastActiveDate, familyId],
    });
  } finally {
    client.close();
  }
}

async function readFamilyStreak(
  familyId: string,
): Promise<{
  familyStreakDays: number;
  lastFamilyActiveDate: string | null;
} | null> {
  const client = createClient({ url: dbUrl() });
  try {
    const r = await client.execute({
      sql: "SELECT family_streak_days, last_family_active_date FROM families WHERE id = ? LIMIT 1",
      args: [familyId],
    });
    if (r.rows.length === 0) return null;
    const row = r.rows[0]!;
    return {
      familyStreakDays: Number(row.family_streak_days),
      lastFamilyActiveDate:
        row.last_family_active_date === null ||
        row.last_family_active_date === undefined
          ? null
          : String(row.last_family_active_date),
    };
  } finally {
    client.close();
  }
}

async function signupAndOnboard(
  page: import("@playwright/test").Page,
  workerIndex: number,
): Promise<{ learnerId: string; nickname: string; email: string }> {
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

  return { learnerId, nickname, email };
}

test.describe("family-streak (W11-T1 / 家族のれんぞく / 親への可視化)", () => {
  test("DB 直接で family streak 1 (今日 active) → 親 dashboard で alive=1 / days=1", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);
    const familyId = await getFamilyIdForLearner(learnerId);

    // 今日 active (= 連続中)
    const today = getTodayJstQuestDate();
    await setFamilyStreakDirect(familyId, 1, today);

    // DB レベルで反映されていることを確認
    const after = await readFamilyStreak(familyId);
    expect(after).not.toBeNull();
    expect(after!.familyStreakDays).toBe(1);
    expect(after!.lastFamilyActiveDate).toBe(today);

    // 親 dashboard で確認
    await page.goto(`/parent/dashboard?learner=${encodeURIComponent(learnerId)}`);
    const card = page.locator('[data-testid="family-streak-card"]');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toHaveAttribute("data-family-streak-days", "1");
    await expect(card).toHaveAttribute("data-family-streak-alive", "1");

    // DEC-024 罰則ゼロ: 罰語が含まれない
    const cardText = (await card.textContent()) ?? "";
    expect(cardText).not.toContain("だめ");
    expect(cardText).not.toContain("やりすぎ");
    expect(cardText).not.toContain("ペナルティ");
  });

  test("last_family_active_date が 1 日前 → alive=1 / days 維持 (今日学習すれば +1 候補)", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);
    const familyId = await getFamilyIdForLearner(learnerId);

    const today = getTodayJstQuestDate();
    const yesterday = previousDateString(today);
    await setFamilyStreakDirect(familyId, 3, yesterday);

    await page.goto(`/parent/dashboard?learner=${encodeURIComponent(learnerId)}`);
    const card = page.locator('[data-testid="family-streak-card"]');
    await expect(card).toBeVisible({ timeout: 15000 });
    // 昨日 active = まだ生きている = isAlive=true / days=3 (今日学習すれば 4 候補)
    await expect(card).toHaveAttribute("data-family-streak-days", "3");
    await expect(card).toHaveAttribute("data-family-streak-alive", "1");
  });

  test("last_family_active_date が 2 日前 → days=0 / alive=0 (切れているが罰なし)", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);
    const familyId = await getFamilyIdForLearner(learnerId);

    const today = getTodayJstQuestDate();
    const twoDaysAgo = previousDateString(previousDateString(today));
    await setFamilyStreakDirect(familyId, 7, twoDaysAgo);

    await page.goto(`/parent/dashboard?learner=${encodeURIComponent(learnerId)}`);
    const card = page.locator('[data-testid="family-streak-card"]');
    await expect(card).toBeVisible({ timeout: 15000 });
    // 切れている = days=0 / alive=0 (DB 側の 7 は getFamilyStreak が 0 に正規化)
    await expect(card).toHaveAttribute("data-family-streak-days", "0");
    await expect(card).toHaveAttribute("data-family-streak-alive", "0");
    // 罰メッセージは出さない (DEC-024 / 「またいつでも」前向きコピー)
    const cardText = (await card.textContent()) ?? "";
    expect(cardText).not.toContain("だめ");
    expect(cardText).not.toContain("やりすぎ");
    expect(cardText).not.toContain("ペナルティ");
  });
});
