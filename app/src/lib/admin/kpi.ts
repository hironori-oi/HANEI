/**
 * HANEI - Admin KPI Dashboard Read-only Server-only Helper (W12-T1 / DEC-065)
 *
 * Phase 2 W12-T1 (DEC-065): 内部運営向け KPI ダッシュボード `/admin/kpi` で表示する
 * 6 系統の集計値を **SQL レベル aggregate のみ** で取得する read-only server-only helper.
 * 副作用なし / write 一切なし / 新規 server action 一切なし / mutation 一切なし.
 *
 * "use server" ではない通常の server-only モジュール:
 *   - Server Component (`/admin/kpi/page.tsx`) から直接 import する.
 *   - 認可は呼び出し元で `requireAdmin()` 済 (DEC-065 §2 / 第二層).
 *   - 集計は SQL レベル aggregate (`COUNT` / `AVG` / `GROUP BY` / 個別 row 返却なし) で
 *     COPPA 準拠の「個別 family / learner 露出ゼロ」を構造的に保証 (DEC-003 / DEC-065 §5).
 *
 * 純関数分離 (Turbopack `"use server"` sync export ban / 6 度目適用):
 *   - view-model 計算は `kpi-summary.ts` (純関数モジュール) に隔離.
 *   - 本ファイルは DB I/O + 入力整形 + 純関数 dispatch のみ.
 *
 * エラー耐性:
 *   - 6 系統 SQL は `Promise.all` で並列実行する.
 *   - 各 task は per-task try/catch で wrap し、一部失敗で全体を落とさない (DEC-024 前向き fallback).
 *   - 取得失敗した KPI は raw を `undefined` にし、純関数 view-model 側で「——」 fallback を返す.
 */

import { sql, gte, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  studySessions,
  streaks,
  coinTransactions,
  learnerInventory,
  dailyQuests,
  userBadges,
  badges,
  parentMessages,
  mockExamResults,
} from "@/lib/db/schema";
import {
  composeKpiDashboardView,
  type AvgSessionMinutesRaw,
  type BadgeDistributionRaw,
  type DailyQuestCompletionRaw,
  type ExperimentCohortRaw,
  type FamilyMessageFrequencyRaw,
  type KotodamaMessageDeliveryRaw,
  type KpiDashboardRaw,
  type KpiDashboardView,
  type MockExamDistributionRaw,
  type RetentionRaw,
  type StreakStatsRaw,
} from "@/lib/admin/kpi-summary";
import {
  EXPERIMENTS,
  getCohortDistribution,
  getCohortStreakAvg,
} from "@/lib/experiments/assignment";

// ---------------------------------------------------------------------------
// 内部ユーティリティ
// ---------------------------------------------------------------------------

/** 任意の Promise を「resolved value | undefined」に変換 (失敗を黙殺してログだけ残す). */
async function safeAggregate<T>(
  taskName: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    // admin 向け診断ログ. Sentry にも自動取り込まれる (運用で気付けるように).
    if (process.env.NODE_ENV !== "production" || process.env.DB_DEBUG === "1") {
      console.warn(
        `[admin/kpi] ${taskName} aggregation failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return undefined;
  }
}

function unixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

// ---------------------------------------------------------------------------
// 個別 KPI 取得関数 (SQL レベル aggregate のみ / 個別 row は flow しない)
// ---------------------------------------------------------------------------

/**
 * Day-N retention を cohort 計算で返す.
 *
 * 定義 (W12-T1 minimal):
 *   - cohort = 「signup から ちょうど N 日前 〜 (N+1) 日前」の users (= cohortSize)
 *   - retained = その cohort のうち「signup から N 日後 〜 (N+1) 日後」の窓に
 *     answer_logs >= 1 件あった users.id の DISTINCT 数
 *
 * 集約のみ (個別 user.id は返さない). retention 計算用 user-id 集合の DISTINCT count
 * のみ取り出す.
 */
async function getRetentionDayN(
  dayN: number,
  now: Date,
): Promise<RetentionRaw> {
  const cohortStart = unixSeconds(
    new Date(now.getTime() - (dayN + 1) * 24 * 60 * 60 * 1000),
  );
  const cohortEnd = unixSeconds(
    new Date(now.getTime() - dayN * 24 * 60 * 60 * 1000),
  );
  // retention 観測窓 = cohort signup 後 dayN 〜 dayN+1 日 = 直近 0 〜 1 日
  // (= 「signup 日から見て N 日後にも戻ってきたか」)
  const observeStart = unixSeconds(
    new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  );
  const observeEnd = unixSeconds(now);

  // cohortSize: 集約 COUNT (* / id を返さない)
  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-065)
  const cohortRows = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(users)
    .where(
      sql`${users.createdAt} >= ${cohortStart} AND ${users.createdAt} < ${cohortEnd}`,
    );
  const cohortSize = Number(cohortRows[0]?.cnt ?? 0);

  if (cohortSize === 0) {
    return { cohortSize: 0, retainedCount: 0 };
  }

  // retained: cohort 期間に signup した user の中で、観測窓に answer_logs を
  // 1 件以上残した learner を保有する user_id の DISTINCT count.
  // learner_profiles.user_id 経由で answer_logs に接続するが、SQL 内で集約 COUNT のみ
  // 返すので個別 user_id は flow しない.
  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-065)
  const retainedRows = await db
    .select({
      cnt: sql<number>`COUNT(DISTINCT u.id)`,
    })
    .from(sql`${users} u`)
    .where(
      sql`u.created_at >= ${cohortStart} AND u.created_at < ${cohortEnd}
        AND EXISTS (
          SELECT 1 FROM learner_profiles lp
          INNER JOIN answer_logs al ON al.learner_id = lp.id
          WHERE lp.user_id = u.id
            AND al.answered_at >= ${observeStart}
            AND al.answered_at < ${observeEnd}
        )`,
    );
  const retainedCount = Number(retainedRows[0]?.cnt ?? 0);

  return { cohortSize, retainedCount };
}

/** 終了済 study_sessions の総数 + 合計分 (直近 7 日 / aggregate のみ). */
async function getAvgSessionMinutesLast7Days(
  now: Date,
): Promise<AvgSessionMinutesRaw> {
  const cutoff = unixSeconds(
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  );
  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-065)
  const rows = await db
    .select({
      total: sql<number>`COUNT(*)`,
      // SQLite julianday: ended_at - started_at は秒単位 (unix epoch なので).
      // 単位を分 (= /60.0) に揃え、終了済のみ (ended_at IS NOT NULL) を集計.
      sumMinutes: sql<number>`COALESCE(
        SUM(CAST((${studySessions.endedAt} - ${studySessions.startedAt}) AS REAL) / 60.0),
        0
      )`,
    })
    .from(studySessions)
    .where(
      sql`${studySessions.endedAt} IS NOT NULL
        AND ${studySessions.startedAt} >= ${cutoff}`,
    );
  const r = rows[0];
  return {
    totalSessions: Number(r?.total ?? 0),
    totalMinutes: Number(r?.sumMinutes ?? 0),
  };
}

/**
 * Streak 中央値 (currentStreak) と Streak Freeze 使用 / 取得カウント.
 *
 *  - 中央値: SQL の `percentile_cont` は SQLite に無いため、currentStreak の数値
 *    のみを SELECT して JS 側 (純関数 `median`) で計算する. プライバシー上は
 *    learner_id を返さず currentStreak の値のみ flow するため OK (個別特定不可).
 *  - Freeze 使用 / 取得は `coin_transactions` の reason='freeze_purchase' で 1 セットの
 *    集約 COUNT のみ取る (= 取得).  実消費は `learner_inventory.lastUsedAt IS NOT NULL`
 *    の COUNT (= 使用済) で代替.
 */
async function getStreakStats(): Promise<StreakStatsRaw> {
  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-065)
  const streakRows = await db
    .select({
      currentStreak: streaks.currentStreak,
    })
    .from(streaks);
  const currentStreaks: number[] = streakRows.map((r) =>
    Number(r.currentStreak ?? 0),
  );

  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-065)
  const acquiredRows = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(coinTransactions)
    .where(sql`${coinTransactions.reason} = 'freeze_purchase'`);
  const freezeAcquiredCount = Number(acquiredRows[0]?.cnt ?? 0);

  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-065)
  const usedRows = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(learnerInventory)
    .where(
      sql`${learnerInventory.itemType} = 'streak_freeze'
        AND ${learnerInventory.lastUsedAt} IS NOT NULL`,
    );
  const freezeUsageCount = Number(usedRows[0]?.cnt ?? 0);

  return {
    currentStreaks,
    freezeUsageCount,
    freezeAcquiredCount,
  };
}

/** Daily Quest 完了率 (直近 7 日 / aggregate のみ). */
async function getDailyQuestCompletionLast7Days(
  now: Date,
): Promise<DailyQuestCompletionRaw> {
  const cutoff = unixSeconds(
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  );
  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-065)
  const rows = await db
    .select({
      total: sql<number>`COUNT(*)`,
      completed: sql<number>`COALESCE(
        SUM(CASE WHEN ${dailyQuests.progress} >= ${dailyQuests.target} THEN 1 ELSE 0 END),
        0
      )`,
    })
    .from(dailyQuests)
    .where(gte(dailyQuests.createdAt, new Date(cutoff * 1000)));
  const r = rows[0];
  return {
    totalQuests: Number(r?.total ?? 0),
    completedQuests: Number(r?.completed ?? 0),
  };
}

/** バッジ獲得分布 (上位 5 件 GROUP BY / aggregate のみ). */
async function getBadgeDistributionTop5(): Promise<
  BadgeDistributionRaw[]
> {
  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-065)
  const rows = await db
    .select({
      badgeId: userBadges.badgeId,
      label: badges.name,
      cnt: sql<number>`COUNT(*)`,
    })
    .from(userBadges)
    .leftJoin(badges, sql`${badges.id} = ${userBadges.badgeId}`)
    .groupBy(userBadges.badgeId, badges.name)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(5);
  return rows.map((r) => ({
    badgeId: String(r.badgeId ?? ""),
    label: typeof r.label === "string" ? r.label : "",
    earnedCount: Number(r.cnt ?? 0),
  }));
}

/**
 * A/B test cohort 集計 (W12-T2 / DEC-066) を catalog 1 件 (= streak_freeze_monthly_grant)
 * 分だけまとめて返す server-only helper.
 *
 *  - 内部で `getCohortDistribution` + `getCohortStreakAvg` を `Promise.all` で並列取得.
 *  - 1 関数 1 raw に集約し、kpi-summary.ts の `ExperimentCohortRaw` に直接マップする.
 *  - SQL レベル aggregate のみ (= learner_id / family_id を構造的に flow させない / DEC-003).
 *  - DEC-066 §4 の指示通り、catalog の experimentKey を catalog 経由で参照する
 *    (= magic string ハードコードしない / 拡張時に catalog 追加だけで済む構造).
 */
async function getExperimentCohortRaw(): Promise<ExperimentCohortRaw> {
  const def = EXPERIMENTS.streak_freeze_monthly_grant;
  const [distribution, streakAvg] = await Promise.all([
    getCohortDistribution(def.key),
    getCohortStreakAvg(def.key),
  ]);
  return {
    experimentKey: def.key,
    description: def.description,
    distribution,
    streakAvg,
  };
}

/**
 * 模試結果分布 (直近 30 日 / 級別 / W12-T1.5 / DEC-068).
 *
 *  - 級 (5 / 4 / 3) ごとに COUNT(*) と AVG(score / max_score) を集計.
 *  - 母数 0 級は SQL 結果に出ないため自然に脱落.
 *  - learner_id / 個別 score は SELECT 句から構造的排除 (DEC-003 第三層 / aggregate-only).
 */
async function getMockExamDistribution(
  now: Date,
): Promise<MockExamDistributionRaw> {
  const cutoff = unixSeconds(
    new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
  );
  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-068)
  const rows = await db
    .select({
      level: mockExamResults.level,
      cnt: sql<number>`COUNT(*)`,
      avgRatio: sql<number>`AVG(CAST(${mockExamResults.score} AS REAL) / NULLIF(${mockExamResults.maxScore}, 0))`,
    })
    .from(mockExamResults)
    .where(sql`${mockExamResults.takenAt} >= ${cutoff}`)
    .groupBy(mockExamResults.level);

  const byLevel: MockExamDistributionRaw["byLevel"] = rows
    .filter(
      (r): r is { level: "5" | "4" | "3"; cnt: number; avgRatio: number } =>
        r.level === "5" || r.level === "4" || r.level === "3",
    )
    .map((r) => ({
      level: r.level,
      count: Number(r.cnt ?? 0),
      avgRatio: Number(r.avgRatio ?? 0),
    }))
    .filter((r) => r.count > 0);

  return { byLevel };
}

/**
 * kotodama-tori メッセージ表示率 (直近 7 日 / W12-T1.5 / DEC-068).
 *
 *  - parent_messages の createdAt >= cutoff の COUNT(*) (送信総数) +
 *    SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) (表示済).
 *  - family_id / from_user_id / to_learner_id を SELECT 句から構造的排除 (DEC-003 第三層).
 */
async function getKotodamaMessageDeliveryLast7Days(
  now: Date,
): Promise<KotodamaMessageDeliveryRaw> {
  const cutoff = unixSeconds(
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  );
  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-068)
  const rows = await db
    .select({
      totalSent: sql<number>`COUNT(*)`,
      totalRead: sql<number>`COALESCE(
        SUM(CASE WHEN ${parentMessages.readAt} IS NOT NULL THEN 1 ELSE 0 END),
        0
      )`,
    })
    .from(parentMessages)
    .where(sql`${parentMessages.createdAt} >= ${cutoff}`);

  const r = rows[0];
  return {
    totalSent: Number(r?.totalSent ?? 0),
    totalRead: Number(r?.totalRead ?? 0),
  };
}

/** 親→子メッセージ送信頻度 (直近 7 日 / aggregate のみ). */
async function getFamilyMessageFrequencyLast7Days(
  now: Date,
): Promise<FamilyMessageFrequencyRaw> {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  // eslint-disable-next-line no-restricted-syntax -- admin aggregate-only (DEC-003 / DEC-065)
  const rows = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(parentMessages)
    .where(
      sql`${parentMessages.createdAt} >= ${unixSeconds(cutoff)}
        AND ${parentMessages.createdAt} < ${unixSeconds(now)}`,
    );
  return {
    totalMessagesLast7Days: Number(rows[0]?.cnt ?? 0),
  };
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

/**
 * /admin/kpi の view-model を返す server-only 関数.
 *
 * 認可: 呼び出し元 (`/admin/kpi/page.tsx`) で `requireAdmin()` 済 (第二層 / DEC-065).
 *       本関数は SQL レベル aggregate のみ実行し、個別 family / learner row は構造的に
 *       flow しない (第三層相当 / COPPA 準拠 / DEC-003).
 *
 * エラー耐性: 6 系統並列取得 + per-task try/catch で部分失敗を吸収 (DEC-024 前向き fallback).
 */
export async function getKpiDashboard(now?: Date): Promise<KpiDashboardView> {
  const generatedAt = now ?? new Date();

  const [
    retentionDay1,
    retentionDay7,
    retentionDay30,
    avgSessionMinutes,
    streakStats,
    dailyQuestCompletion,
    badgeDistribution,
    familyMessageFrequency,
    experimentCohort,
    mockExamDistribution,
    kotodamaMessageDelivery,
  ] = await Promise.all([
    safeAggregate("retentionDay1", () => getRetentionDayN(1, generatedAt)),
    safeAggregate("retentionDay7", () => getRetentionDayN(7, generatedAt)),
    safeAggregate("retentionDay30", () => getRetentionDayN(30, generatedAt)),
    safeAggregate("avgSessionMinutes", () =>
      getAvgSessionMinutesLast7Days(generatedAt),
    ),
    safeAggregate("streakStats", () => getStreakStats()),
    safeAggregate("dailyQuestCompletion", () =>
      getDailyQuestCompletionLast7Days(generatedAt),
    ),
    safeAggregate("badgeDistribution", () => getBadgeDistributionTop5()),
    safeAggregate("familyMessageFrequency", () =>
      getFamilyMessageFrequencyLast7Days(generatedAt),
    ),
    // W12-T2 (DEC-066): A/B test cohort 9 個目要素 (10 → 11 個目要素は W12-T1.5 / DEC-068)
    // (内部で 2 SQL を Promise.all で並列取得)
    safeAggregate("experimentCohort", () => getExperimentCohortRaw()),
    // W12-T1.5 (DEC-068): 模試結果分布 10 個目要素 (直近 30 日 / 級別 aggregate)
    safeAggregate("mockExamDistribution", () =>
      getMockExamDistribution(generatedAt),
    ),
    // W12-T1.5 (DEC-068): kotodama-tori メッセージ表示率 11 個目要素 (直近 7 日 / aggregate)
    safeAggregate("kotodamaMessageDelivery", () =>
      getKotodamaMessageDeliveryLast7Days(generatedAt),
    ),
  ]);

  const raw: KpiDashboardRaw = {
    retentionDay1,
    retentionDay7,
    retentionDay30,
    avgSessionMinutes,
    streakStats,
    dailyQuestCompletion,
    badgeDistribution,
    familyMessageFrequency,
    experimentCohort,
    mockExamDistribution,
    kotodamaMessageDelivery,
    generatedAt,
  };

  return composeKpiDashboardView(raw);
}
