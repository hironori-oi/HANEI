"use server";

/**
 * HANEI - Daily Quest Server Actions (W10-T3)
 *
 * `/quests` ページ + `/home` リボンから呼ばれる:
 *   - getOrGenerateTodayQuests : Lazy generation (cron 不使用 / Vercel Hobby plan 整合)
 *   - claimQuestReward         : 達成済 quest の報酬を 1 件受領 (atomic + idempotent)
 *   - incrementQuestProgress   : submitAnswer hook から呼ばれて progress += 1
 *   - claimAllBonusIfReady     : 3 件全完了 bonus を 1 度だけ受領 (idempotent)
 *
 * 三層認可:
 *   - 全 SQL に learner_id スコープ
 *   - 各 Server Action 内で再度 requireAuth + requireLearnerOwner (FormData 改ざん防御)
 *
 * 冪等性:
 *   - getOrGenerateTodayQuests: UNIQUE (learner_id, quest_date, quest_type) で二重 INSERT 防止
 *   - claimQuestReward: status='claimed' に遷移済なら no-op (skipped=true)
 *   - claimAllBonusIfReady: coin_transactions の (reason='quest', referenceId='all_done_<date>') で冪等
 *   - incrementQuestProgress: 1 解答 = 1 increment (重複呼び出し時は SQL の WHERE で no-op)
 *
 * 罰則ゼロ哲学 (DEC-024): 未達でも streak は減らさない / マイナス UI 演出なし。
 */

import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import {
  dailyQuests,
  learnerProfiles,
  coinTransactions,
  type DailyQuest,
} from "@/lib/db/schema";
import { requireAuth, requireLearnerOwner } from "@/lib/auth/guards";
import { COIN_REWARDS } from "@/lib/economy/ledger";
import { getJstQuestDate } from "@/lib/quest/jst-date";
import {
  generateDailyQuests,
  type GeneratedQuest,
} from "@/lib/quest/quest-generator";
import {
  shouldIncrementForAnswer,
  type QuestType,
} from "@/lib/quest/quest-templates";

// ---------------------------------------------------------------------------
// 共通: 進捗 % 等を Quest row に付与した view 型
// ---------------------------------------------------------------------------

export interface DailyQuestView {
  id: string;
  questType: QuestType;
  title: string;
  target: number;
  progress: number;
  rewardCoins: number;
  /** 'in_progress' / 'claimed' */
  status: "in_progress" | "claimed";
  /** progress >= target かどうか (UI の「うけとる」ボタン活性化条件) */
  isCompleted: boolean;
  /** 達成済 + status='in_progress' の場合に true (= claim 可能) */
  isClaimable: boolean;
}

export interface QuestSummary {
  /** 'YYYY-MM-DD' (JST) */
  questDate: string;
  /** 当日のクエスト一覧 (UI 表示順) */
  quests: ReadonlyArray<DailyQuestView>;
  /** 達成 (progress >= target) 件数 */
  completedCount: number;
  /** 受領済 (status='claimed') 件数 */
  claimedCount: number;
  /** 全体件数 */
  totalCount: number;
  /** 全 claim + bonus も受領済か */
  allBonusClaimed: boolean;
}

function toView(row: DailyQuest): DailyQuestView {
  const target = Number(row.target ?? 0);
  const progress = Math.max(0, Number(row.progress ?? 0));
  const isCompleted = progress >= target && target > 0;
  return {
    id: row.id,
    questType: row.questType,
    title: row.title,
    target,
    progress,
    rewardCoins: Number(row.rewardCoins ?? 0),
    status: row.status,
    isCompleted,
    isClaimable: isCompleted && row.status === "in_progress",
  };
}

// ---------------------------------------------------------------------------
// 1. Lazy generation: 今日のクエスト 3 件を取得 (なければ生成して保存)
// ---------------------------------------------------------------------------

/**
 * `/home` および `/quests` の Server Component から呼ばれる入口。
 *  - 同 (learnerId, today) で行があればそれを返す
 *  - なければ deterministic に生成し、3 行 INSERT してから読み直す
 *  - UNIQUE 制約で複数 tab 同時アクセスも安全 (onConflictDoNothing)
 */
export async function getOrGenerateTodayQuests(
  learnerId: string,
  now: Date = new Date(),
): Promise<QuestSummary> {
  // ---- 認可 ----
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, learnerId);

  const questDate = getJstQuestDate(now);

  // 既存行を取得 (lazy gen の冪等性: 1 度生成済なら再生成しない)
  const existing = await readQuestsForDate(learnerId, questDate);
  if (existing.length > 0) {
    return buildSummary(learnerId, questDate, existing);
  }

  // ---- 3 件 deterministic 生成 ----
  const generated: ReadonlyArray<GeneratedQuest> = generateDailyQuests({
    learnerId,
    questDate,
    count: 3,
  });

  if (generated.length === 0) {
    // 生成不可 (defensive: selectable types が空)
    return {
      questDate,
      quests: [],
      completedCount: 0,
      claimedCount: 0,
      totalCount: 0,
      allBonusClaimed: false,
    };
  }

  // ---- INSERT (UNIQUE 衝突は onConflictDoNothing で無視) ----
  const rowsToInsert = generated.map((g) => ({
    id: `dq_${randomUUID()}`,
    learnerId,
    questDate,
    questType: g.questType,
    title: g.title,
    target: g.target,
    progress: 0,
    rewardCoins: g.rewardCoins,
    status: "in_progress" as const,
  }));
  await db
    .insert(dailyQuests)
    .values(rowsToInsert)
    .onConflictDoNothing({
      target: [
        dailyQuests.learnerId,
        dailyQuests.questDate,
        dailyQuests.questType,
      ],
    });

  // 読み直し (race 後でも UNIQUE で 3 件に確定)
  const stored = await readQuestsForDate(learnerId, questDate);
  return buildSummary(learnerId, questDate, stored);
}

async function readQuestsForDate(
  learnerId: string,
  questDate: string,
): Promise<DailyQuest[]> {
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり
  const rows = await db
    .select()
    .from(dailyQuests)
    .where(
      and(
        eq(dailyQuests.learnerId, learnerId),
        eq(dailyQuests.questDate, questDate),
      ),
    );
  return rows;
}

async function buildSummary(
  learnerId: string,
  questDate: string,
  rows: ReadonlyArray<DailyQuest>,
): Promise<QuestSummary> {
  const views = rows.map(toView);
  // UI 表示順: streak_keep を最初、次に未受領 (in_progress)、最後に claimed
  const sorted = views.slice().sort((a, b) => {
    if (a.questType === "streak_keep" && b.questType !== "streak_keep") return -1;
    if (a.questType !== "streak_keep" && b.questType === "streak_keep") return 1;
    if (a.status === b.status) return a.questType.localeCompare(b.questType);
    return a.status === "claimed" ? 1 : -1;
  });
  const completedCount = sorted.filter((q) => q.isCompleted).length;
  const claimedCount = sorted.filter((q) => q.status === "claimed").length;

  // 全 bonus 受領済か (coin_transactions の reason='quest', reference='all_done_<date>')
  let allBonusClaimed = false;
  if (sorted.length > 0 && claimedCount >= sorted.length) {
    allBonusClaimed = await hasAllDoneBonusFor(learnerId, questDate);
  }

  return {
    questDate,
    quests: sorted,
    completedCount,
    claimedCount,
    totalCount: sorted.length,
    allBonusClaimed,
  };
}

async function hasAllDoneBonusFor(
  learnerId: string,
  questDate: string,
): Promise<boolean> {
  // eslint-disable-next-line no-restricted-syntax -- 三重スコープ条件
  const rows = await db
    .select({ id: coinTransactions.id })
    .from(coinTransactions)
    .where(
      and(
        eq(coinTransactions.learnerId, learnerId),
        eq(coinTransactions.reason, "quest"),
        eq(coinTransactions.referenceId, `all_done_${questDate}`),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// 2. claimQuestReward: 1 件分の報酬を受領
// ---------------------------------------------------------------------------

export interface ClaimQuestRewardInput {
  learnerId: string;
  questId: string;
}

export interface ClaimQuestRewardResult {
  ok: boolean;
  /** 受領後の残高 (ok=true / skipped=true のみ正確) */
  newBalance: number;
  reward: number;
  reason?:
    | "validation"
    | "not_found"
    | "not_completed"
    | "internal_error";
  /** 既に claimed 済 → no-op */
  skipped?: boolean;
  /** 受領で 3/3 完了になった場合に bonus を受領済か */
  allDoneBonusGranted?: boolean;
  bonusAmount?: number;
}

/**
 * 達成済 quest の報酬を 1 件受領する (W10-T3 atomic action)。
 *
 * 流れ:
 *   1. 認可 (requireAuth + requireLearnerOwner)
 *   2. 該当 quest 取得 (learner_id スコープ)
 *   3. status='claimed' なら skipped=true で返す (冪等)
 *   4. progress >= target でなければ not_completed
 *   5. quest.status='claimed' へ atomic UPDATE (WHERE status='in_progress')
 *      → rowsAffected=0 なら他 tab で先取りされた / skipped に倒す
 *   6. coin_transactions INSERT + learner_profiles.coin_balance UPDATE
 *      (referenceId='quest_<questId>' で冪等)
 *   7. 同日 3 件全 claimed なら 'all_done_<date>' の bonus を受領
 *   8. revalidatePath('/quests') + '/home'
 */
export async function claimQuestReward(
  input: ClaimQuestRewardInput,
): Promise<ClaimQuestRewardResult> {
  // ---- 認可 ----
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, input.learnerId);

  // ---- バリデーション ----
  if (!input.questId || typeof input.questId !== "string") {
    return { ok: false, newBalance: 0, reward: 0, reason: "validation" };
  }

  // ---- 該当 quest 取得 (learner_id スコープ) ----
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり
  const rows = await db
    .select()
    .from(dailyQuests)
    .where(
      and(
        eq(dailyQuests.id, input.questId),
        eq(dailyQuests.learnerId, input.learnerId),
      ),
    )
    .limit(1);
  const quest = rows[0];
  if (!quest) {
    return { ok: false, newBalance: 0, reward: 0, reason: "not_found" };
  }
  if (quest.status === "claimed") {
    const balance = await getCoinBalanceInline(input.learnerId);
    return {
      ok: true,
      newBalance: balance,
      reward: Number(quest.rewardCoins ?? 0),
      skipped: true,
    };
  }
  const target = Number(quest.target ?? 0);
  const progress = Number(quest.progress ?? 0);
  if (target <= 0 || progress < target) {
    const balance = await getCoinBalanceInline(input.learnerId);
    return {
      ok: false,
      newBalance: balance,
      reward: Number(quest.rewardCoins ?? 0),
      reason: "not_completed",
    };
  }

  const now = new Date();
  const reward = Number(quest.rewardCoins ?? COIN_REWARDS.QUEST_COMPLETE);

  // ---- 1. quest.status='claimed' に atomic UPDATE (WHERE status='in_progress') ----
  // 他 tab / 連打耐性: rowsAffected=0 なら他フローで claim 済 / skipped に倒す
  const upd = await db
    .update(dailyQuests)
    .set({
      status: "claimed",
      claimedAt: now,
      completedAt: quest.completedAt ?? now,
      updatedAt: now,
    })
    .where(
      and(
        eq(dailyQuests.id, quest.id),
        eq(dailyQuests.learnerId, input.learnerId),
        eq(dailyQuests.status, "in_progress"),
      ),
    );

  // libsql/drizzle の rowsAffected は driver により undefined もある
  const affected = (upd as { rowsAffected?: number }).rowsAffected ?? null;
  if (affected !== null && affected === 0) {
    // 並行 claim が先に成功 / skipped に倒す
    const balance = await getCoinBalanceInline(input.learnerId);
    return {
      ok: true,
      newBalance: balance,
      reward,
      skipped: true,
    };
  }

  // ---- 2. coin_transactions INSERT (idempotent: reference='quest_<questId>') ----
  const refId = `quest_${quest.id}`;
  // 重複防御 (UPDATE 成功後にも race 念のため)
  // eslint-disable-next-line no-restricted-syntax -- 三重スコープ条件
  const dup = await db
    .select({ id: coinTransactions.id })
    .from(coinTransactions)
    .where(
      and(
        eq(coinTransactions.learnerId, input.learnerId),
        eq(coinTransactions.reason, "quest"),
        eq(coinTransactions.referenceId, refId),
      ),
    )
    .limit(1);

  if (dup.length === 0) {
    const txnId = `ct_${randomUUID()}`;
    await db.insert(coinTransactions).values({
      id: txnId,
      learnerId: input.learnerId,
      amount: reward,
      reason: "quest",
      referenceId: refId,
      memo: `Daily Quest: ${quest.title}`,
    });
    await db
      .update(learnerProfiles)
      .set({
        coinBalance: sql`${learnerProfiles.coinBalance} + ${reward}`,
        updatedAt: now,
      })
      .where(eq(learnerProfiles.id, input.learnerId));
  }

  // ---- 3. all-done bonus check ----
  // 同日の 3 件が全 claimed か確認 → bonus 1 度だけ
  let allDoneBonusGranted = false;
  let bonusAmount: number | undefined;
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり
  const today = await db
    .select({
      total: sql<number>`COUNT(*)`,
      claimed: sql<number>`SUM(CASE WHEN ${dailyQuests.status} = 'claimed' THEN 1 ELSE 0 END)`,
    })
    .from(dailyQuests)
    .where(
      and(
        eq(dailyQuests.learnerId, input.learnerId),
        eq(dailyQuests.questDate, quest.questDate),
      ),
    );
  const tot = Number(today[0]?.total ?? 0);
  const cla = Number(today[0]?.claimed ?? 0);
  if (tot > 0 && cla >= tot) {
    const bonusRef = `all_done_${quest.questDate}`;
    // eslint-disable-next-line no-restricted-syntax -- 三重スコープ条件
    const bonusDup = await db
      .select({ id: coinTransactions.id })
      .from(coinTransactions)
      .where(
        and(
          eq(coinTransactions.learnerId, input.learnerId),
          eq(coinTransactions.reason, "quest"),
          eq(coinTransactions.referenceId, bonusRef),
        ),
      )
      .limit(1);
    if (bonusDup.length === 0) {
      bonusAmount = COIN_REWARDS.QUEST_ALL_DONE;
      const bonusId = `ct_${randomUUID()}`;
      await db.insert(coinTransactions).values({
        id: bonusId,
        learnerId: input.learnerId,
        amount: bonusAmount,
        reason: "quest",
        referenceId: bonusRef,
        memo: `Daily Quest 3/3 bonus (${quest.questDate})`,
      });
      await db
        .update(learnerProfiles)
        .set({
          coinBalance: sql`${learnerProfiles.coinBalance} + ${bonusAmount}`,
          updatedAt: now,
        })
        .where(eq(learnerProfiles.id, input.learnerId));
      allDoneBonusGranted = true;
    }
  }

  // ---- 4. UI 即時反映 ----
  revalidatePath("/quests");
  revalidatePath("/home");

  const newBalance = await getCoinBalanceInline(input.learnerId);
  return {
    ok: true,
    newBalance,
    reward,
    allDoneBonusGranted,
    bonusAmount,
  };
}

// ---------------------------------------------------------------------------
// 3. incrementQuestProgress: submitAnswer hook から呼ばれる進捗反映
// ---------------------------------------------------------------------------

export interface IncrementQuestProgressInput {
  learnerId: string;
  /** 'vocabulary' / 'grammar' / 'listening' / 'reading' / 'writing' */
  skill: "vocabulary" | "grammar" | "listening" | "reading" | "writing";
  isCorrect: boolean;
  /** 解答時刻 (UTC) — JST quest_date 計算に使う */
  now?: Date;
}

export interface IncrementQuestProgressResult {
  /** 進捗が +1 された quest の id 一覧 (UI で「達成! しゅうりょう」演出に使える) */
  incrementedQuestIds: ReadonlyArray<string>;
  /** その結果として「達成 (progress >= target)」に到達した quest の id 一覧 */
  newlyCompletedQuestIds: ReadonlyArray<string>;
}

/**
 * 1 解答 (skill, isCorrect) を受けて、当日のクエスト進捗を加算する。
 * - submitAnswer (lib/actions/study.ts) から best-effort で呼ばれる
 * - 例外は上位で握り潰される (学習体験を中断しない)
 * - 認可: 内部で再度 requireLearnerOwner (二重防御)
 */
export async function incrementQuestProgress(
  input: IncrementQuestProgressInput,
): Promise<IncrementQuestProgressResult> {
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, input.learnerId);

  const questDate = getJstQuestDate(input.now ?? new Date());

  // 当日の quest 行を取得 (なければ何もしない / lazy gen は /home or /quests 訪問時に発火)
  const rows = await readQuestsForDate(input.learnerId, questDate);
  if (rows.length === 0) {
    return { incrementedQuestIds: [], newlyCompletedQuestIds: [] };
  }

  const incremented: string[] = [];
  const completed: string[] = [];
  const now = new Date();

  for (const row of rows) {
    if (row.status === "claimed") continue;
    const target = Number(row.target ?? 0);
    const progress = Number(row.progress ?? 0);
    if (target <= 0) continue;
    if (progress >= target) continue; // 既に達成

    const should = shouldIncrementForAnswer(row.questType, {
      skill: input.skill,
      isCorrect: input.isCorrect,
    });
    if (!should) continue;

    // streak_keep は最大 1 回まで (= 0 → 1 に立ち上げて以降は no-op)
    const newProgress = Math.min(target, progress + 1);
    const reachedTarget = newProgress >= target;

    // WHERE progress < target で「並行 hook が target を超えて進める」事故を防ぐ
    await db
      .update(dailyQuests)
      .set({
        progress: newProgress,
        completedAt: reachedTarget ? (row.completedAt ?? now) : row.completedAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(dailyQuests.id, row.id),
          eq(dailyQuests.learnerId, input.learnerId),
          sql`${dailyQuests.progress} < ${target}`,
        ),
      );

    incremented.push(row.id);
    if (reachedTarget) completed.push(row.id);
  }

  if (incremented.length > 0) {
    revalidatePath("/quests");
    revalidatePath("/home");
  }

  return {
    incrementedQuestIds: incremented,
    newlyCompletedQuestIds: completed,
  };
}

// ---------------------------------------------------------------------------
// 4. 内部ヘルパ
// ---------------------------------------------------------------------------

async function getCoinBalanceInline(learnerId: string): Promise<number> {
  // eslint-disable-next-line no-restricted-syntax -- learner_id スコープ条件あり / Server Action 内部
  const rows = await db
    .select({ b: learnerProfiles.coinBalance })
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);
  return Number(rows[0]?.b ?? 0);
}
