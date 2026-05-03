/**
 * E2E: signup-beta-invite (W12-T3-A / DEC-069 / β invite flow)
 *
 * 検証スコープ:
 *   ① 正常 redeem: 有効 code を入力 → /verify-email 遷移 + redemption_count=1 +
 *      users.beta_invited_by_code に code 記録.
 *   ② 不正 code: 形式違反 (短すぎ / alphabet 外) → /signup?error=invite_invalid.
 *   ③ 上限到達: maxRedemptions=1 / redemptionCount=1 を事前 INSERT →
 *      /signup?error=invite_full.
 *   ④ 期限切れ: expiresAt < now を事前 INSERT → /signup?error=invite_expired.
 *
 * 前提:
 *   - playwright.config.ts の webServer.env に BETA_INVITE_REQUIRED が
 *     pass-through される. このファイルを実行するときは
 *       cross-env BETA_INVITE_REQUIRED=true npm run e2e tests/e2e/signup-beta-invite.spec.ts --workers=1
 *     のように env を渡すこと. 既存 E2E (admin-kpi など) を BETA_INVITE_REQUIRED=true
 *     で実行すると signup form が invite_code 必須化されて壊れるため要注意.
 *
 *   - DB fixture (file:./tests/e2e/.tmp/e2e.db) に beta_invite_codes テーブルが
 *     存在する (db-fixture.ts applyMigrations で 0017_w12_beta_invite.sql 実行済).
 *
 * 認可 (DEC-003 三層):
 *   - 第一層: middleware は signup 公開 / invite check は server action 内で完結.
 *   - 第二層: signupAction 内で SELECT + race-safe atomic UPDATE.
 *   - 第三層: beta_invite_codes は個人特定要素 0 で構造排除.
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@libsql/client";

function dbUrl(): string {
  return (
    process.env.TURSO_DATABASE_URL_E2E ??
    process.env.TURSO_DATABASE_URL ??
    "file:./tests/e2e/.tmp/e2e.db"
  );
}

async function execWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 16,
): Promise<T> {
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

interface SeedInviteOptions {
  id: string;
  code: string;
  maxRedemptions?: number;
  redemptionCount?: number;
  expiresAt?: number | null; // ms epoch / null = 無期限
  disabledAt?: number | null;
}

async function seedInvite(opts: SeedInviteOptions): Promise<void> {
  const client = createClient({ url: dbUrl() });
  try {
    // 重複時は冪等に上書き (DELETE → INSERT) し、worker 並列でも seed が衝突しない.
    await execWithRetry(() =>
      client.execute({
        sql: `DELETE FROM beta_invite_codes WHERE id = ? OR code = ?`,
        args: [opts.id, opts.code],
      }),
    );
    await execWithRetry(() =>
      client.execute({
        sql: `INSERT INTO beta_invite_codes
              (id, code, created_by, note, max_redemptions, redemption_count, expires_at, disabled_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          opts.id,
          opts.code,
          "e2e",
          "e2e-seed",
          opts.maxRedemptions ?? 1,
          opts.redemptionCount ?? 0,
          opts.expiresAt ?? null,
          opts.disabledAt ?? null,
          Date.now(),
        ],
      }),
    );
  } finally {
    client.close();
  }
}

async function fetchInviteRow(code: string): Promise<{
  redemption_count: number;
  max_redemptions: number;
} | null> {
  const client = createClient({ url: dbUrl() });
  try {
    const result = await execWithRetry(() =>
      client.execute({
        sql: `SELECT redemption_count, max_redemptions FROM beta_invite_codes WHERE code = ?`,
        args: [code],
      }),
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      redemption_count: Number(row.redemption_count),
      max_redemptions: Number(row.max_redemptions),
    };
  } finally {
    client.close();
  }
}

async function fetchUserBetaInvitedBy(email: string): Promise<string | null> {
  const client = createClient({ url: dbUrl() });
  try {
    const result = await execWithRetry(() =>
      client.execute({
        sql: `SELECT beta_invited_by_code FROM users WHERE email = ?`,
        args: [email],
      }),
    );
    const row = result.rows[0];
    if (!row) return null;
    const v = row.beta_invited_by_code;
    return typeof v === "string" ? v : null;
  } finally {
    client.close();
  }
}

function buildSignupCredentials(
  workerIndex: number,
  suffix: string,
): {
  email: string;
  password: string;
  parentName: string;
} {
  const stamp = `${Date.now()}_${workerIndex}_${suffix}`;
  return {
    email: `beta_invite_${stamp}@hanei.test`,
    password: "test-password-beta-invite",
    parentName: `β親${workerIndex}`,
  };
}

// fullyParallel=true で同一 file: SQLite に複数 worker から書き込むと SQLITE_BUSY が発生する.
// admin-kpi.spec.ts と同様 serial 化.
test.describe.configure({ mode: "serial" });

test.describe("signup-beta-invite (W12-T3-A / DEC-069 / β invite flow)", () => {
  test.beforeEach(async () => {
    if (process.env.BETA_INVITE_REQUIRED !== "true") {
      test.skip(
        true,
        "BETA_INVITE_REQUIRED=true 未設定のためスキップ. 実行時は cross-env BETA_INVITE_REQUIRED=true で再実行してください.",
      );
    }
  });

  test("正常 redeem: 有効 code → /verify-email 遷移 + redemption_count=1 + users.beta_invited_by_code 記録", async ({
    page,
  }, testInfo) => {
    const code = "ABCD2345";
    const inviteId = `bic_e2e_ok_${testInfo.workerIndex}`;
    await seedInvite({
      id: inviteId,
      code,
      maxRedemptions: 1,
      redemptionCount: 0,
    });

    const { email, password, parentName } = buildSignupCredentials(
      testInfo.workerIndex,
      "ok",
    );

    await page.goto("/signup");
    await expect(page.locator('[data-testid="invite-code-input"]')).toBeVisible({
      timeout: 10000,
    });
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel(/パスワード/).fill(password);
    await page.getByLabel("保護者の方のお名前").fill(parentName);
    await page.locator('[data-testid="invite-code-input"]').fill(code);
    await page.locator('input[name="consent_coppa"]').check();
    await page.locator('input[name="consent_ai_chat"]').check();
    await page.locator('input[name="consent_terms"]').check();
    await page.getByRole("button", { name: "アカウントを作成する" }).click();

    await expect(page).toHaveURL(/\/verify-email(\?|$)/, { timeout: 15000 });

    // DB 検証: redemption_count が +1 になっていること.
    const row = await fetchInviteRow(code);
    expect(row).not.toBeNull();
    expect(row?.redemption_count).toBe(1);
    expect(row?.max_redemptions).toBe(1);

    // DB 検証: users.beta_invited_by_code に code が記録されていること.
    const stored = await fetchUserBetaInvitedBy(email);
    expect(stored).toBe(code);
  });

  test("不正 code: 形式違反 (alphabet 外) → /signup?error=invite_invalid", async ({
    page,
  }, testInfo) => {
    const { email, password, parentName } = buildSignupCredentials(
      testInfo.workerIndex,
      "invalid",
    );

    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel(/パスワード/).fill(password);
    await page.getByLabel("保護者の方のお名前").fill(parentName);
    // alphabet 外文字 (除外文字 "0" / "I") + 長さは 8 文字なので
    // length チェックは pass、alphabet チェックで invalid 判定される.
    await page.locator('[data-testid="invite-code-input"]').fill("AB0DEFG1");
    await page.locator('input[name="consent_coppa"]').check();
    await page.locator('input[name="consent_ai_chat"]').check();
    await page.locator('input[name="consent_terms"]').check();
    await page.getByRole("button", { name: "アカウントを作成する" }).click();

    await expect(page).toHaveURL(/\/signup\?error=invite_invalid/, {
      timeout: 15000,
    });
    // 中立文言が表示されていること (DEC-024 罰則ゼロ).
    // Next.js の `__next-route-announcer__` も role="alert" を持つため、
    // 可視 alert を取得するために `:not(#__next-route-announcer__)` で除外する.
    const alertText =
      (await page
        .locator('[role="alert"]:not(#__next-route-announcer__)')
        .textContent()) ?? "";
    expect(alertText).toContain("招待コード");
  });

  test("上限到達: redemptionCount=maxRedemptions=1 → /signup?error=invite_full", async ({
    page,
  }, testInfo) => {
    // 8 文字 / alphabet 内 (F/U/M/C/2/3/4 / `0/O/1/I/L` 除外文字を含まない)
    const code = "FUMMC234";
    const inviteId = `bic_e2e_full_${testInfo.workerIndex}`;
    await seedInvite({
      id: inviteId,
      code,
      maxRedemptions: 1,
      redemptionCount: 1, // 既に上限到達
    });

    const { email, password, parentName } = buildSignupCredentials(
      testInfo.workerIndex,
      "full",
    );

    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel(/パスワード/).fill(password);
    await page.getByLabel("保護者の方のお名前").fill(parentName);
    await page.locator('[data-testid="invite-code-input"]').fill(code);
    await page.locator('input[name="consent_coppa"]').check();
    await page.locator('input[name="consent_ai_chat"]').check();
    await page.locator('input[name="consent_terms"]').check();
    await page.getByRole("button", { name: "アカウントを作成する" }).click();

    await expect(page).toHaveURL(/\/signup\?error=invite_full/, {
      timeout: 15000,
    });
    const alertText =
      (await page
        .locator('[role="alert"]:not(#__next-route-announcer__)')
        .textContent()) ?? "";
    expect(alertText).toContain("上限");
  });

  test("期限切れ: expiresAt < now → /signup?error=invite_expired", async ({
    page,
  }, testInfo) => {
    // 8 文字 / alphabet 内 (E/X/P/R/D/2/3/4 / `0/O/1/I/L` 除外文字を含まない)
    const code = "EXPRD234";
    const inviteId = `bic_e2e_exp_${testInfo.workerIndex}`;
    // 1 時間前に期限切れ.
    const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
    await seedInvite({
      id: inviteId,
      code,
      maxRedemptions: 5,
      redemptionCount: 0,
      expiresAt: oneHourAgoMs,
    });

    const { email, password, parentName } = buildSignupCredentials(
      testInfo.workerIndex,
      "expired",
    );

    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel(/パスワード/).fill(password);
    await page.getByLabel("保護者の方のお名前").fill(parentName);
    await page.locator('[data-testid="invite-code-input"]').fill(code);
    await page.locator('input[name="consent_coppa"]').check();
    await page.locator('input[name="consent_ai_chat"]').check();
    await page.locator('input[name="consent_terms"]').check();
    await page.getByRole("button", { name: "アカウントを作成する" }).click();

    await expect(page).toHaveURL(/\/signup\?error=invite_expired/, {
      timeout: 15000,
    });
    const alertText =
      (await page
        .locator('[role="alert"]:not(#__next-route-announcer__)')
        .textContent()) ?? "";
    expect(alertText).toContain("有効期限");

    // DB 検証: redemption_count は変わらず 0 のまま (= UPDATE が走っていないこと).
    const row = await fetchInviteRow(code);
    expect(row?.redemption_count).toBe(0);
  });
});
