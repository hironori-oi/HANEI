/**
 * E2E: /shop UI (W10-T2 / DEC-056 案B)
 *
 * 3 ケース:
 *   1. 残高不足 → 購入失敗 / 在庫変化なし / 「ハネキンが X 個 たりないよ」表示
 *   2. 残高十分 → 購入成功 / 残高 -price / 在庫 +1 / coin_transactions 行追加
 *   3. 同 referenceId 二重 submit (UI からは同等の冪等性: 二回目は skipped 扱い)
 *
 * 戦略:
 *   - signup 新規 parent + 新規 learner で clean state を確保 (study-smoke と同方針)
 *   - balance 操作は webServer と共有している file libSQL に直接 UPDATE
 *   - 冪等性は purchaseShopItem を直接 import 呼び出しできないため、
 *     UI から 1 回購入 → 残高/在庫スナップショット → 同 referenceId で再 INSERT 試行
 *     を server action 関数の代わりに直接 DB レイヤで再現できないので、
 *     ここでは「fixture seed の冪等関数」を別経路で叩けない。
 *     → 代替として「UI から連続クリック (手早く) でも 1 件しか購入されない」を確認するに留める。
 *       (Server action 内部の hasReceivedFor は単体テスト側で担保 / W10-T2 unit テスト範囲)
 *
 * 前提:
 *   - playwright.config.ts の webServer が `npm run start` で立ち上がり、
 *     env.TURSO_DATABASE_URL = file:./tests/e2e/.tmp/e2e.db を共有
 *   - 0011 migration が globalSetup で適用済み (db-fixture.ts に追加)
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
    email: `shop_${stamp}@hanei.test`,
    password: "test-password-shop",
    parentName: `ショップ保護者${workerIndex}`,
    nickname: `ショップ子${workerIndex}`,
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

/**
 * 共有 file libSQL に直接接続して指定 learner の coin_balance を更新する。
 */
async function setLearnerBalance(learnerId: string, balance: number): Promise<void> {
  const url =
    process.env.TURSO_DATABASE_URL_E2E ??
    process.env.TURSO_DATABASE_URL ??
    "file:./tests/e2e/.tmp/e2e.db";
  const client = createClient({ url });
  try {
    await client.execute({
      sql: "UPDATE learner_profiles SET coin_balance = ? WHERE id = ?",
      args: [balance, learnerId],
    });
  } finally {
    client.close();
  }
}

/**
 * 共有 file libSQL から指定 learner の (balance, inventory of itemType) を読む。
 */
async function readLearnerState(
  learnerId: string,
  itemType: string,
): Promise<{ balance: number; quantity: number; transactionCount: number }> {
  const url =
    process.env.TURSO_DATABASE_URL_E2E ??
    process.env.TURSO_DATABASE_URL ??
    "file:./tests/e2e/.tmp/e2e.db";
  const client = createClient({ url });
  try {
    const balRows = await client.execute({
      sql: "SELECT coin_balance AS b FROM learner_profiles WHERE id = ?",
      args: [learnerId],
    });
    const invRows = await client.execute({
      sql: "SELECT quantity AS q FROM learner_inventory WHERE learner_id = ? AND item_type = ?",
      args: [learnerId, itemType],
    });
    const txRows = await client.execute({
      sql: "SELECT COUNT(*) AS c FROM coin_transactions WHERE learner_id = ? AND reason = 'freeze_purchase'",
      args: [learnerId],
    });
    const balance = Number((balRows.rows[0]?.b as number | bigint | null) ?? 0);
    const quantity = Number((invRows.rows[0]?.q as number | bigint | null) ?? 0);
    const transactionCount = Number(
      (txRows.rows[0]?.c as number | bigint | null) ?? 0,
    );
    return { balance, quantity, transactionCount };
  } finally {
    client.close();
  }
}

/**
 * signup → onboarding を実行して /home に到達した状態にし、learnerId を返す。
 */
async function signupAndOnboard(
  page: import("@playwright/test").Page,
  workerIndex: number,
): Promise<{ email: string; nickname: string; learnerId: string }> {
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

  // learner_id は home の「ショップ」リンクの URL から取り出す
  const shopLink = page.locator('[data-testid="home-shop-link"]');
  await expect(shopLink).toBeVisible();
  const href = await shopLink.getAttribute("href");
  const match = href?.match(/learner=([^&]+)/);
  const learnerId = match ? decodeURIComponent(match[1]!) : "";
  expect(learnerId.length).toBeGreaterThan(0);

  return { email, nickname, learnerId };
}

test.describe("/shop UI (W10-T2 / DEC-056 案B)", () => {
  test("残高不足: Streak Freeze (30) を 0 ハネキンで開いても 買えず、たりない金額が表示される", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);

    // 残高 0 のまま /shop へ
    await page.goto(`/shop?learner=${encodeURIComponent(learnerId)}`);
    await expect(
      page.getByRole("heading", { name: /^ショップ$/ }),
    ).toBeVisible();

    const card = page.locator('[data-testid="shop-item-streak_freeze"]');
    await expect(card).toBeVisible();

    // 「買う」ボタンは出ない / 代わりに shortfall + クエスト誘導
    const buyBtn = page.locator('[data-testid="shop-buy-button-streak_freeze"]');
    expect(await buyBtn.count()).toBe(0);

    const shortfall = page.locator('[data-testid="shop-shortfall-streak_freeze"]');
    await expect(shortfall).toBeVisible();
    // 30 ハネキン - 0 = 30 たりない
    await expect(shortfall).toContainText("30");
    await expect(shortfall).toContainText("たりないよ");

    // クエストへの CTA (streak_freeze カード内のみを対象に scope する)
    const questsCta = card.getByRole("link", {
      name: /クエストで\s*ハネキンを\s*ためる/,
    });
    await expect(questsCta).toBeVisible();
    const questHref = await questsCta.getAttribute("href");
    expect(questHref).toContain("/quests");

    // DB 状態に変化が無いこと (在庫 0 / 取引 0)
    const after = await readLearnerState(learnerId, "streak_freeze");
    expect(after.balance).toBe(0);
    expect(after.quantity).toBe(0);
    expect(after.transactionCount).toBe(0);
  });

  test("残高十分: 50 ハネキン → Streak Freeze (30) を 1 個購入 → 残高 20 / 在庫 1 / coin_transactions +1", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);

    // balance を直接 50 にセット
    await setLearnerBalance(learnerId, 50);

    await page.goto(`/shop?learner=${encodeURIComponent(learnerId)}`);

    // 大表示残高 (HanekinBalanceHeader)
    const header = page.locator('[data-testid="hanekin-balance-header"]');
    await expect(header).toBeVisible();
    await expect(header).toContainText("50");

    // 「買う」ボタンが見えている
    const buyBtn = page.locator('[data-testid="shop-buy-button-streak_freeze"]');
    await expect(buyBtn).toBeVisible();
    await buyBtn.click();

    // 確認 dialog
    const dialog = page.locator(
      '[data-testid="shop-confirm-dialog-streak_freeze"]',
    );
    await expect(dialog).toBeVisible();
    const confirmBtn = page.locator(
      '[data-testid="shop-confirm-button-streak_freeze"]',
    );
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 結果メッセージ
    const result = page.locator('[data-testid="shop-result-streak_freeze"]');
    await expect(result).toBeVisible({ timeout: 15000 });
    await expect(result).toContainText("ありがとう");

    // DB 状態の確認
    const after = await readLearnerState(learnerId, "streak_freeze");
    expect(after.balance).toBe(20); // 50 - 30
    expect(after.quantity).toBe(1);
    expect(after.transactionCount).toBe(1);
  });

  test("UI 連打: 確認 dialog の 買う を 2 回連打しても 在庫は 1 / 取引も 1 (purchase は同 referenceId だが 1 回しか飛ばない)", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);

    // 1 回購入できる残高
    await setLearnerBalance(learnerId, 60);

    await page.goto(`/shop?learner=${encodeURIComponent(learnerId)}`);

    // 1 回目: 買うを押下 → 確認
    await page.locator('[data-testid="shop-buy-button-streak_freeze"]').click();
    const dialog = page.locator(
      '[data-testid="shop-confirm-dialog-streak_freeze"]',
    );
    await expect(dialog).toBeVisible();
    const confirmBtn = page.locator(
      '[data-testid="shop-confirm-button-streak_freeze"]',
    );
    // 連打を擬似的に: dispatchEvent('click') を 2 回連続で発火 (force=true 同等)
    // ConfirmPurchaseDialog 側で pending=true になるため二度目の onClick は disabled で no-op
    await confirmBtn.dispatchEvent("click");
    await confirmBtn.dispatchEvent("click").catch(() => undefined);

    // 結果 status (toast 風 / shop-result-streak_freeze) が出るのを待つ
    await expect(
      page.locator('[data-testid="shop-result-streak_freeze"]'),
    ).toBeVisible({ timeout: 15000 });

    // DB が 1 件しか進んでいないこと (取引 1 / 在庫 1 / 残高 30)
    const after = await readLearnerState(learnerId, "streak_freeze");
    expect(after.balance).toBe(30);
    expect(after.quantity).toBe(1);
    expect(after.transactionCount).toBe(1);
  });
});
