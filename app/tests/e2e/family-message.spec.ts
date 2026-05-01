/**
 * E2E: family-message (W11-T2 / 親→子 応援メッセージ kotodama-tori 代読 modal + DEC-024 moderation)
 *
 * 検証スコープ (push-modal / moderation pipeline / DEC-024 罰則ゼロ):
 *   1. parent_messages を直接 INSERT で未読 1 件作成 → /home 訪問
 *      → kotodama-tori-modal が表示 (data-testid="family-message-modal")
 *      → 本文が含まれる / 罰語が含まれない (DEC-024)
 *      → 「ありがとう」click → markMessageRead → DB read_at IS NOT NULL
 *      → reload で modal が表示されない (= 既読は再 push されない)
 *   2. /parent/messages/new で「だめ」を含む custom 文を送信試行
 *      → moderation エラー前向きコピー表示 (data-testid="moderation-error")
 *      → 通常文「がんばろう」で送信成功 (data-testid="send-success")
 *
 * 戦略の根拠 (W11-T1 / W11-T3 と同パターン):
 *   - validateParentMessageBody 純関数は tests/unit/messages.moderation.test.ts で
 *     43 ケース網羅済 (型ガード / 長さ境界 / 罵倒系 / 否定系 / 強制系 / PII / 励まし OK).
 *   - findOldestUnreadMessage は tests/unit/messages.parent-messages-server.test.ts で
 *     7 ケース網羅済 (空 / 全既読 / 単独未読 / 複数未読 desc 末尾 / 混在).
 *   - sendCustomMessage の moderation 統合 SQL 経路は drizzle layer の合成で
 *     family_id WHERE が SQL レベルで強制される構造で保証される.
 *
 * 設計判断: study UI (submitAnswer / click → study-feedback) を一切踏まないため
 *   preexisting study-smoke regression からは構造的に独立.
 *   E2E は W11-T1 / W11-T3 で確立した SQLITE_BUSY 対策 (serial mode + execWithRetry +
 *   client.batch) パターンを再利用.
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
    email: `family_msg_${stamp}@hanei.test`,
    password: "test-password-family-msg",
    parentName: `家族ＭＳＧ親${workerIndex}`,
    nickname: `家族ＭＳＧ子${workerIndex}_${suffix}`,
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
 * SQLITE_BUSY 用の retry helper (W11-T3 から踏襲).
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
      const waitMs = Math.min(1500, 100 * 2 ** attempt) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

interface LearnerInfo {
  learnerId: string;
  familyId: string;
  parentUserId: string;
}

async function getFamilyAndParent(learnerId: string): Promise<LearnerInfo> {
  const client = createClient({ url: dbUrl() });
  try {
    const learnerR = await execWithRetry(() =>
      client.execute({
        sql: "SELECT family_id FROM learner_profiles WHERE id = ? LIMIT 1",
        args: [learnerId],
      }),
    );
    if (learnerR.rows.length === 0)
      throw new Error(`learner ${learnerId} not found`);
    const familyId = String(learnerR.rows[0]!.family_id);

    const memberR = await execWithRetry(() =>
      client.execute({
        sql: "SELECT user_id FROM family_members WHERE family_id = ? AND role = 'parent' LIMIT 1",
        args: [familyId],
      }),
    );
    if (memberR.rows.length === 0)
      throw new Error(`parent for family ${familyId} not found`);
    const parentUserId = String(memberR.rows[0]!.user_id);

    return { learnerId, familyId, parentUserId };
  } finally {
    client.close();
  }
}

/**
 * 親→子 応援メッセージを直接 INSERT (UI 経由なし).
 * 未読 (read_at NULL) で作成.
 */
async function insertUnreadParentMessage(
  info: LearnerInfo,
  body: string,
): Promise<string> {
  const client = createClient({ url: dbUrl() });
  const id = `pm_e2e_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  try {
    await execWithRetry(() =>
      client.execute({
        sql: `INSERT INTO parent_messages (
          id, family_id, from_user_id, to_learner_id,
          template_code, body, read_at, created_at
        ) VALUES (?, ?, ?, ?, NULL, ?, NULL, unixepoch())`,
        args: [
          id,
          info.familyId,
          info.parentUserId,
          info.learnerId,
          body,
        ],
      }),
    );
    return id;
  } finally {
    client.close();
  }
}

async function getMessageReadAt(messageId: string): Promise<number | null> {
  const client = createClient({ url: dbUrl() });
  try {
    const r = await execWithRetry(() =>
      client.execute({
        sql: "SELECT read_at FROM parent_messages WHERE id = ? LIMIT 1",
        args: [messageId],
      }),
    );
    if (r.rows.length === 0) return null;
    const v = r.rows[0]!.read_at;
    if (v === null || v === undefined) return null;
    return Number(v);
  } finally {
    client.close();
  }
}

async function signupAndOnboard(
  page: import("@playwright/test").Page,
  workerIndex: number,
  suffix: string,
): Promise<{ learnerId: string; nickname: string }> {
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

  return { learnerId, nickname };
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
    expect(
      text,
      `罰語 "${w}" が含まれてはいけない (DEC-024 罰則ゼロ哲学)`,
    ).not.toContain(w);
  }
}

// SQLITE_BUSY 対策: serial mode (W11-T1 / W11-T3 と同パターン).
test.describe.configure({ mode: "serial" });

test.describe("family-message (W11-T2 / 親→子 応援メッセージ + moderation)", () => {
  test("最古未読 → /home で kotodama-tori-modal 表示 → 「ありがとう」 → DB read_at セット → reload で非表示", async ({
    page,
  }, testInfo) => {
    // Step 1: parent + learner を signup → onboard
    const { learnerId, nickname } = await signupAndOnboard(
      page,
      testInfo.workerIndex,
      "modal",
    );
    const info = await getFamilyAndParent(learnerId);

    // Step 2: 親メッセージ 1 件を直接 INSERT (未読)
    const body = "きょうも いっしょに がんばろう。おうえんしてるよ。";
    const messageId = await insertUnreadParentMessage(info, body);

    // Step 3: /home に訪問 → modal 表示確認
    await page.goto(`/home?learner=${encodeURIComponent(learnerId)}`);
    const modal = page.locator('[data-testid="family-message-modal"]');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal).toHaveAttribute("data-message-id", messageId);

    // 本文が含まれる
    const modalText = (await modal.textContent()) ?? "";
    expect(modalText).toContain("がんばろう");
    expect(modalText).toContain(nickname);
    // 罰語が含まれない (DEC-024)
    expectNoPunishmentWords(modalText);

    // Step 4: 「ありがとう」 click → markMessageRead 発火
    await page.locator('[data-testid="family-message-thanks-btn"]').click();
    await expect(modal).toBeHidden({ timeout: 15000 });

    // Step 5: DB の read_at が NOT NULL になっている
    const readAt = await getMessageReadAt(messageId);
    expect(readAt, "read_at が markMessageRead で NOT NULL に更新されるべき").not.toBeNull();
    expect(readAt!).toBeGreaterThan(0);

    // Step 6: reload で modal は非表示 (既読は再 push されない)
    await page.reload();
    await expect(
      page.locator('[data-testid="family-message-modal"]'),
    ).toHaveCount(0, { timeout: 5000 });
  });

  test("/parent/messages/new で「だめ」含む custom 送信 → moderation エラー / 通常文は成功", async ({
    page,
  }, testInfo) => {
    // Step 1: parent + learner を signup → onboard
    const { learnerId } = await signupAndOnboard(
      page,
      testInfo.workerIndex,
      "mod",
    );

    // Step 2: /parent/messages/new に遷移
    await page.goto(
      `/parent/messages/new?learner=${encodeURIComponent(learnerId)}`,
    );
    await expect(
      page.locator('[data-testid="template-picker"]'),
    ).toBeVisible({ timeout: 15000 });

    // Step 3: テンプレを 1 つ選択 → カスタム編集に切替
    // 「encourage_start」カテゴリ tab はデフォルトで開いている.
    // template-list 内の <li> > <button data-testid="template-XXX"> を 1 つ選ぶ.
    const firstTemplate = page
      .locator('[data-testid="template-list-encourage_start"] button[data-testid^="template-"]')
      .first();
    await firstTemplate.click();

    // 「文章を カスタムする」 click
    await page.locator('[data-testid="start-custom-btn"]').click();
    const textarea = page.locator('[data-testid="custom-body-textarea"]');
    await expect(textarea).toBeVisible();

    // 禁止語「だめ」を含む文に書き換え
    await textarea.fill("そんなんじゃ だめ だよ");

    // 送信
    await page.locator('[data-testid="send-custom-btn"]').click();

    // moderation エラー表示 (前向き案内 / 罰語ゼロ)
    const modErr = page.locator('[data-testid="moderation-error"]');
    await expect(modErr).toBeVisible({ timeout: 15000 });
    const errText = (await modErr.textContent()) ?? "";
    expect(errText).toContain("やわらかく");
    // 親 UI のエラー文に罰語そのものを表示しない (DEC-024)
    expect(errText).not.toContain("だめ");
    expect(errText).not.toContain("ペナルティ");

    // Step 4: 通常文 (励まし系) で送信成功
    await textarea.fill("きょうも いっしょに がんばろう");
    await page.locator('[data-testid="send-custom-btn"]').click();

    const okMsg = page.locator('[data-testid="send-success"]');
    await expect(okMsg).toBeVisible({ timeout: 15000 });
    const okText = (await okMsg.textContent()) ?? "";
    expect(okText).toContain("おくりました");
    expectNoPunishmentWords(okText);
  });
});
