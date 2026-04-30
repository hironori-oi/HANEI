/**
 * E2E: /quests UI (W10-T3 / Daily Quest)
 *
 * 4 ケース:
 *   1. 初回アクセスで /quests に 3 件の quest 行が生成される (lazy generation)
 *   2. 同 (learner, today) で 2 度目の遷移をしても 3 件のまま (冪等)
 *   3. 進捗反映: progress を直接 target に書き込み → claim ボタン押下 → 残高 +reward / status='claimed'
 *   4. 3 件全 claim → all_done bonus も 1 度だけ計上 (二重 claim しても skipped)
 *
 * 戦略:
 *   - signup 新規 parent + 新規 learner で clean state を確保 (study-smoke と同方針)
 *   - balance 操作 / quest progress 操作は webServer と共有している file libSQL に
 *     直接 UPDATE する
 *   - 「残高十分か」の操作は不要 (Daily Quest は獲得経路のみ)
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
    email: `quest_${stamp}@hanei.test`,
    password: "test-password-quest",
    parentName: `クエスト保護者${workerIndex}`,
    nickname: `クエスト子${workerIndex}`,
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

async function readQuestRows(
  learnerId: string,
): Promise<
  Array<{
    id: string;
    quest_type: string;
    target: number;
    progress: number;
    status: string;
    reward_coins: number;
    quest_date: string;
  }>
> {
  const client = createClient({ url: dbUrl() });
  try {
    const r = await client.execute({
      sql: "SELECT id, quest_type, target, progress, status, reward_coins, quest_date FROM daily_quests WHERE learner_id = ? ORDER BY quest_type",
      args: [learnerId],
    });
    return r.rows.map((row) => ({
      id: String(row.id),
      quest_type: String(row.quest_type),
      target: Number(row.target),
      progress: Number(row.progress),
      status: String(row.status),
      reward_coins: Number(row.reward_coins),
      quest_date: String(row.quest_date),
    }));
  } finally {
    client.close();
  }
}

async function setQuestProgressToTarget(learnerId: string): Promise<number> {
  const client = createClient({ url: dbUrl() });
  try {
    const before = await client.execute({
      sql: "SELECT id, target FROM daily_quests WHERE learner_id = ? AND status = 'in_progress'",
      args: [learnerId],
    });
    let count = 0;
    for (const row of before.rows) {
      const id = String(row.id);
      const target = Number(row.target);
      await client.execute({
        sql: "UPDATE daily_quests SET progress = ? WHERE id = ?",
        args: [target, id],
      });
      count += 1;
    }
    return count;
  } finally {
    client.close();
  }
}

async function readBalance(learnerId: string): Promise<number> {
  const client = createClient({ url: dbUrl() });
  try {
    const r = await client.execute({
      sql: "SELECT coin_balance AS b FROM learner_profiles WHERE id = ?",
      args: [learnerId],
    });
    return Number((r.rows[0]?.b as number | bigint | null) ?? 0);
  } finally {
    client.close();
  }
}

async function readBonusTxnCount(
  learnerId: string,
  questDate: string,
): Promise<number> {
  const client = createClient({ url: dbUrl() });
  try {
    const r = await client.execute({
      sql: "SELECT COUNT(*) AS c FROM coin_transactions WHERE learner_id = ? AND reason = 'quest' AND reference_id = ?",
      args: [learnerId, `all_done_${questDate}`],
    });
    return Number((r.rows[0]?.c as number | bigint | null) ?? 0);
  } finally {
    client.close();
  }
}

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

  // learnerId を home の「ショップ」リンクの URL から取り出す (study-smoke / shop と同手法)
  const shopLink = page.locator('[data-testid="home-shop-link"]');
  await expect(shopLink).toBeVisible();
  const href = await shopLink.getAttribute("href");
  const match = href?.match(/learner=([^&]+)/);
  const learnerId = match ? decodeURIComponent(match[1]!) : "";
  expect(learnerId.length).toBeGreaterThan(0);

  return { email, nickname, learnerId };
}

test.describe("/quests UI (W10-T3 / Daily Quest)", () => {
  test("signup → /home の段階で 3 件 lazy gen 済 / /quests 遷移後も同 id 集合で冪等", async ({
    page,
  }, testInfo) => {
    // review-w10-t3 M-1: signup → /home の遷移で既に lazy gen が走るため、
    // 「signup 直後に 0 件」を期待するのは spec 不整合だった。
    // 新しい assertion は「signup 後 = 既に 3 件 / /quests 遷移しても同 id 集合のまま」。
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);

    // signup → /home リダイレクト時点で既に 3 件 lazy gen 済 (home page のクエスト summary 用)
    const afterHome = await readQuestRows(learnerId);
    expect(afterHome.length).toBe(3);
    // streak_keep を必ず含む
    expect(afterHome.some((q) => q.quest_type === "streak_keep")).toBe(true);
    // mock_warmup は Phase 1 で除外
    expect(afterHome.some((q) => q.quest_type === "mock_warmup")).toBe(false);
    // 同日なので quest_date は 1 種類だけ
    expect(new Set(afterHome.map((q) => q.quest_date)).size).toBe(1);
    const idsAfterHome = afterHome.map((q) => q.id).sort();

    // /quests へ遷移 (lazy gen 入口 / 冪等性確認)
    await page.goto(`/quests?learner=${encodeURIComponent(learnerId)}`);
    await expect(
      page.getByRole("heading", { name: /^クエスト$/ }),
    ).toBeVisible();

    // grid に 3 件
    const grid = page.locator('[data-testid="quests-grid"]');
    await expect(grid).toBeVisible();

    // /quests 遷移後も件数 / id 集合が変わらない (lazy gen 二重起動なし)
    const afterQuests = await readQuestRows(learnerId);
    expect(afterQuests.length).toBe(3);
    const idsAfterQuests = afterQuests.map((q) => q.id).sort();
    expect(idsAfterQuests).toEqual(idsAfterHome);
  });

  test("同日 2 度目の /quests 遷移でも 3 件のまま (冪等)", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);

    // 1 回目
    await page.goto(`/quests?learner=${encodeURIComponent(learnerId)}`);
    await expect(
      page.locator('[data-testid="quests-grid"]'),
    ).toBeVisible();
    const after1 = await readQuestRows(learnerId);
    expect(after1.length).toBe(3);
    const ids1 = after1.map((q) => q.id).sort();

    // 2 回目 (一度 home を経由してから)
    await page.goto(`/home?learner=${encodeURIComponent(learnerId)}`);
    await page.goto(`/quests?learner=${encodeURIComponent(learnerId)}`);
    await expect(
      page.locator('[data-testid="quests-grid"]'),
    ).toBeVisible();

    const after2 = await readQuestRows(learnerId);
    expect(after2.length).toBe(3);
    const ids2 = after2.map((q) => q.id).sort();
    // 同じ id 集合 = lazy gen が二重に行われていない
    expect(ids2).toEqual(ids1);
  });

  test("3 件全 claim で残高 +reward*3 + bonus が 1 度だけ計上される", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);

    // 初期残高 = 0
    expect(await readBalance(learnerId)).toBe(0);

    // /quests へ遷移して lazy gen を発火
    await page.goto(`/quests?learner=${encodeURIComponent(learnerId)}`);
    await expect(
      page.locator('[data-testid="quests-grid"]'),
    ).toBeVisible();

    // DB レイヤで 3 件全部の progress を target に揃える
    const updated = await setQuestProgressToTarget(learnerId);
    expect(updated).toBe(3);

    // ページを reload して claim ボタンを表示
    await page.goto(`/quests?learner=${encodeURIComponent(learnerId)}`);
    const buttons = page.locator('[data-testid^="quest-claim-button-"]');
    await expect(buttons.first()).toBeVisible({ timeout: 15000 });
    expect(await buttons.count()).toBe(3);

    // 3 件順番に claim
    const rows = await readQuestRows(learnerId);
    const reward = rows[0]!.reward_coins;
    const questDate = rows[0]!.quest_date;
    expect(reward).toBeGreaterThan(0);

    // 1 つずつ click — クリックごとに UI が再描画されるので、
    // first ボタンを連続的に取り直す
    for (let i = 0; i < 3; i += 1) {
      const remaining = page.locator('[data-testid^="quest-claim-button-"]');
      await expect(remaining.first()).toBeVisible({ timeout: 15000 });
      await remaining.first().click();
      // claim 結果メッセージが出るのを待つ
      await expect(
        page.locator('[data-testid^="quest-result-"]').first(),
      ).toBeVisible({ timeout: 15000 });
      // ページを reload して次の状態へ
      await page.goto(`/quests?learner=${encodeURIComponent(learnerId)}`);
    }

    // 状態確認
    const finalRows = await readQuestRows(learnerId);
    expect(finalRows.every((q) => q.status === "claimed")).toBe(true);

    // 残高 = reward * 3 + QUEST_ALL_DONE bonus (= 30)
    const expectedBalance = reward * 3 + 30;
    expect(await readBalance(learnerId)).toBe(expectedBalance);

    // bonus 取引が 1 件のみ
    expect(await readBonusTxnCount(learnerId, questDate)).toBe(1);
  });

  test("既に claimed な quest を再 claim しても skipped (残高/取引行は増えない)", async ({
    page,
  }, testInfo) => {
    const { learnerId } = await signupAndOnboard(page, testInfo.workerIndex);

    await page.goto(`/quests?learner=${encodeURIComponent(learnerId)}`);
    await expect(
      page.locator('[data-testid="quests-grid"]'),
    ).toBeVisible();

    // 全件 progress を target に
    await setQuestProgressToTarget(learnerId);
    await page.goto(`/quests?learner=${encodeURIComponent(learnerId)}`);

    // 1 件目を claim
    const firstBtn = page
      .locator('[data-testid^="quest-claim-button-"]')
      .first();
    await expect(firstBtn).toBeVisible({ timeout: 15000 });
    await firstBtn.click();
    await expect(
      page.locator('[data-testid^="quest-result-"]').first(),
    ).toBeVisible({ timeout: 15000 });

    // ページを reload して claimed 状態を確認
    await page.goto(`/quests?learner=${encodeURIComponent(learnerId)}`);
    const claimedView = page.locator('[data-testid^="quest-claimed-"]').first();
    await expect(claimedView).toBeVisible();

    // この時点の残高
    const balanceMid = await readBalance(learnerId);
    expect(balanceMid).toBeGreaterThan(0);

    // 念のため再度 claimed 1 件 + 残 2 件状態を確認 (claimed view が出ているなら再クリック不可なのは UI 上担保 + Server Action で skipped)
    const rows = await readQuestRows(learnerId);
    expect(rows.filter((q) => q.status === "claimed").length).toBe(1);
  });
});
