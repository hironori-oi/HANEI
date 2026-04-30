/**
 * E2E: session_cumulative (W10-T5 / 過学習防止 / 30 分 nudge)
 *
 * 検証ポイント:
 *   1. M-A1 リグレッションガード:
 *      - /study に session-mode (?dur=5&session=<uuid>) でアクセスした際、
 *        page.tsx 経由で study_sessions 行が作成される (UNIQUE で冪等).
 *   2. 30 分 nudge:
 *      - DB の study_sessions.cumulative_seconds を 30 分以上に揃えた状態で
 *        /study/eiken-5/vocab を再訪 → サーバから降りる serverTodayCumulativeSeconds が
 *        30 分を超えるため、StudyClient の 1 秒 tick 内で nudge modal が出る.
 *      - data-testid="overlearning-modal" / data-variant="nudge" を確認.
 *
 * 戦略:
 *   - signup → /home → /study/eiken-5/vocab?dur=5&session=<uuid> で session-mode 起動
 *   - DB に study_sessions 行が存在することを直接 SQL で確認 (M-A1 ガード)
 *   - 直接 SQL で cumulative_seconds = 30*60 + 1 に書き換え
 *   - reload で nudge modal 表示
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
    email: `cumul_${stamp}@hanei.test`,
    password: "test-password-cumul",
    parentName: `累計保護者${workerIndex}`,
    nickname: `累計子${workerIndex}`,
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

async function readStudySessionRows(
  learnerId: string,
): Promise<
  Array<{
    id: string;
    client_session_id: string;
    cumulative_seconds: number;
    session_date: string;
    end_reason: string | null;
  }>
> {
  const client = createClient({ url: dbUrl() });
  try {
    const r = await client.execute({
      sql: "SELECT id, client_session_id, cumulative_seconds, session_date, end_reason FROM study_sessions WHERE learner_id = ? ORDER BY started_at",
      args: [learnerId],
    });
    return r.rows.map((row) => ({
      id: String(row.id),
      client_session_id: String(row.client_session_id),
      cumulative_seconds: Number(row.cumulative_seconds),
      session_date: String(row.session_date),
      end_reason:
        row.end_reason === null || row.end_reason === undefined
          ? null
          : String(row.end_reason),
    }));
  } finally {
    client.close();
  }
}

async function bumpCumulativeSeconds(
  learnerId: string,
  totalSeconds: number,
): Promise<void> {
  // 既存 study_sessions 行 (進行中) の cumulative_seconds を一括 UPDATE.
  // 行が無い場合は単独セッション行を 1 つ作って seed する.
  const client = createClient({ url: dbUrl() });
  try {
    const rows = await client.execute({
      sql: "SELECT id FROM study_sessions WHERE learner_id = ?",
      args: [learnerId],
    });
    if (rows.rows.length === 0) {
      // ここに来るのは想定外 (テスト前に 1 度 /study に入る前提)。安全側に new 行を作る.
      const id = `ss_seed_${randomUUID()}`;
      await client.execute({
        sql: "INSERT INTO study_sessions (id, learner_id, session_date, client_session_id, cumulative_seconds) VALUES (?, ?, date('now'), ?, ?)",
        args: [id, learnerId, `seed_${id}`, totalSeconds],
      });
      return;
    }
    // 1 件目のみ更新 (UNIQUE 制約あり / 簡潔化)
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

  // learnerId を home の「ショップ」リンクから抽出 (study-smoke / shop / quests と同手法)
  const shopLink = page.locator('[data-testid="home-shop-link"]');
  await expect(shopLink).toBeVisible();
  const href = await shopLink.getAttribute("href");
  const match = href?.match(/learner=([^&]+)/);
  const learnerId = match ? decodeURIComponent(match[1]!) : "";
  expect(learnerId.length).toBeGreaterThan(0);

  return { learnerId, nickname };
}

test.describe("session-cumulative (W10-T5 / 30 分 nudge + M-A1 リグレッションガード)", () => {
  test("session-mode で /study に入ると study_sessions 行が作成される (M-A1 ガード)", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);

    // session-mode で /study/eiken-5/vocab に入る (URL は SessionPicker と同形式)
    const sessionId = randomUUID();
    await page.goto(
      `/study/eiken-5/vocab?dur=5&session=${encodeURIComponent(sessionId)}`,
    );
    // 問題が表示されるのを待つ (server-render が走った = startOrResumeStudySession 完了)
    await expect(page.locator('[data-testid="study-prompt"]')).toBeVisible({
      timeout: 15000,
    });

    // DB に行が 1 件作成されている (UNIQUE = 同 sessionId の二重作成なし)
    const rows = await readStudySessionRows(learnerId);
    expect(rows.length).toBe(1);
    expect(rows[0]!.client_session_id).toBe(sessionId);
    expect(rows[0]!.cumulative_seconds).toBe(0);
    expect(rows[0]!.end_reason).toBeNull();

    // 同じ URL で再訪 (router.refresh 相当) しても行数は変わらない (冪等)
    await page.goto(
      `/study/eiken-5/vocab?dur=5&session=${encodeURIComponent(sessionId)}`,
    );
    await expect(page.locator('[data-testid="study-prompt"]')).toBeVisible({
      timeout: 15000,
    });
    const rows2 = await readStudySessionRows(learnerId);
    expect(rows2.length).toBe(1);
    expect(rows2[0]!.id).toBe(rows[0]!.id);
  });

  test("当日累計が 30 分を超えていると nudge modal が表示される", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);

    // 1) まず session-mode で 1 度 /study に入って行を作る
    const sessionId = randomUUID();
    await page.goto(
      `/study/eiken-5/vocab?dur=5&session=${encodeURIComponent(sessionId)}`,
    );
    await expect(page.locator('[data-testid="study-prompt"]')).toBeVisible({
      timeout: 15000,
    });

    // 2) DB レイヤで cumulative_seconds を 30 分 + 1 秒に書き換え
    await bumpCumulativeSeconds(learnerId, 30 * 60 + 1);

    // 3) reload で server から降りる serverTodayCumulativeSeconds >= 30*60 になる
    //    → StudyClient mount 後 1 秒 tick で nudge 検知 (1 秒で出る).
    await page.goto(
      `/study/eiken-5/vocab?dur=5&session=${encodeURIComponent(sessionId)}`,
    );
    // hard_limit (60 分) には到達していないので、ふつうの問題ページが描画される
    await expect(page.locator('[data-testid="study-prompt"]')).toBeVisible({
      timeout: 15000,
    });

    // 4) nudge modal が出る (1 秒 tick + setState で出るため、4 秒待ち)
    const modal = page.locator(
      '[data-testid="overlearning-modal"][data-variant="nudge"]',
    );
    await expect(modal).toBeVisible({ timeout: 8000 });

    // ボタンが 2 つある (おやすみする / もうすこしやる)
    await expect(
      page.locator('[data-testid="overlearning-rest-cta"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="overlearning-continue-cta"]'),
    ).toBeVisible();

    // 「もうすこし やる」を押すと modal が消えて学習が継続できる
    await page.locator('[data-testid="overlearning-continue-cta"]').click();
    await expect(modal).toBeHidden({ timeout: 5000 });
    // 問題は引き続き見えている
    await expect(page.locator('[data-testid="study-prompt"]')).toBeVisible();
  });
});
