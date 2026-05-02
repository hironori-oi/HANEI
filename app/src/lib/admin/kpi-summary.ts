/**
 * HANEI - Admin KPI Dashboard Pure Helper (W12-T1 / DEC-065)
 *
 * Phase 2 W12-T1: 内部運営向け KPI ダッシュボード `/admin/kpi` に表示する 6 系統の
 * 集計値を **純関数で view-model 化** する.
 *
 * 不変条件 (Turbopack `"use server"` sync export ban / 6 度目適用):
 *   - 純関数のみ / DB I/O ゼロ / "use server" 一切なし.
 *   - server-only モジュール (kpi.ts) からのみ import される.
 *   - W11-T1 / W11-T3 / W11-T2 / W11-T5 / W11-T5 で確立した「純関数を server-only ファイル外に
 *     隔離する」パターンの 6 度目再適用.
 *
 * 設計指針 (DEC-024 罰則ゼロ哲学 / DEC-065):
 *   - admin 向けでも数値は中立トーン. 「最下位」「ペナルティ」「失敗」等の罰語は label / fallback
 *     文字列に一切含めない (構造的に発生し得ない設計).
 *   - 0 件 / NaN / 取得失敗 (undefined) は「——」 fallback 文字列で前向きに穴埋めする.
 *   - 全ての数値 KPI は 「正規化 → 整形」の 2 段階で view-model に変換する.
 *
 * 認可境界 (DEC-003 三層認可 / 構造的担保):
 *   - 入力 raw counters は SQL レベル aggregate のみ (= 個別 family / learner row は flow しない).
 *   - 純関数は family scope を意識しなくてよい (構造データ + プリミティブのみ受け取る).
 */

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** Day-N retention 集計の入力 (cohort 起点 + retained 数) */
export interface RetentionRaw {
  /** cohort 起点 (= 過去 N 日に signup した users の数) */
  cohortSize: number;
  /** retention 達成 user 数 (= 「signup から N 日後 〜 N+1 日後」の間に answer_logs > 0) */
  retainedCount: number;
}

/** 平均セッション時間 (直近 7 日) の入力 */
export interface AvgSessionMinutesRaw {
  /** 終了済 study_sessions の総数 (NULL endedAt は除外) */
  totalSessions: number;
  /** 終了済 study_sessions の合計分 (= sum (endedAt - startedAt) / 60) */
  totalMinutes: number;
}

/** Streak 中央値 + Streak Freeze 使用率 の入力 */
export interface StreakStatsRaw {
  /** streak 中央値計算用の生 currentStreak 配列 (家族 / learner 単位は問わずアプリ全体) */
  currentStreaks: ReadonlyArray<number>;
  /** streak_freeze の使用回数 (= coin_transactions reason='freeze_purchase' or learner_inventory.lastUsedAt) */
  freezeUsageCount: number;
  /** streak_freeze の配布 / 取得回数 (= 同 inventory acquired 累計) */
  freezeAcquiredCount: number;
}

/** Daily Quest 完了率 (直近 7 日) の入力 */
export interface DailyQuestCompletionRaw {
  /** 直近 7 日に作成された daily_quests の総行数 */
  totalQuests: number;
  /** completed (= progress >= target) になった行数. claimed 含む. */
  completedQuests: number;
}

/** バッジ獲得分布 (上位 5 件) の入力 row */
export interface BadgeDistributionRaw {
  badgeId: string;
  /** badges.code or display name. 取得不能なら空文字 / 「——」 fallback */
  label: string;
  /** user_badges に対する GROUP BY badge_id の COUNT(*) */
  earnedCount: number;
}

/** 親→子メッセージ送信頻度 (直近 7 日) の入力 */
export interface FamilyMessageFrequencyRaw {
  /** parent_messages.createdAt >= now - 7d の COUNT(*) */
  totalMessagesLast7Days: number;
}

/**
 * Experiment cohort 集計 (W12-T2 / DEC-066) の入力 row.
 *
 *  - distribution: variant 別 cohort サイズ (= 割当済 learner 数 / aggregate-only)
 *  - streakAvg: 同 variant 別の current_streak 平均 (= 効果指標 / aggregate-only)
 *  - 全て SQL レベル aggregate のみで learner_id / family_id は flow しない (DEC-003).
 */
export interface ExperimentCohortRaw {
  /** experiment 識別子 (例: "streak_freeze_monthly_grant") */
  experimentKey: string;
  /** 内部運営向け説明 (中立トーン / catalog から転記) */
  description: string;
  /** variant 別 cohort 数 */
  distribution: ReadonlyArray<{ variantKey: string; count: number }>;
  /** variant 別 current_streak 平均 (n は streaks JOIN 後の母数) */
  streakAvg: ReadonlyArray<{
    variantKey: string;
    avgStreak: number;
    n: number;
  }>;
}

/**
 * 模試結果分布 (直近 30 日 / W12-T1.5 / DEC-068) の入力.
 *
 *  - 級別 (5 / 4 / 3) の COUNT と AVG(score / max_score) を SQL aggregate-only で集計.
 *  - 母数 0 件 (= 該当級の受験 0 件) は SQL 結果から自然脱落 → 配列に出さない.
 *  - learner_id / 個別 score は flow しない (DEC-003 第三層 / aggregate-only).
 */
export interface MockExamDistributionRaw {
  /** 級別の集計 row (= 母数 0 件は含まない) */
  byLevel: ReadonlyArray<{
    /** 模試対象級 (5 / 4 / 3) */
    level: "5" | "4" | "3";
    /** 該当級の受験件数 (直近 30 日) */
    count: number;
    /** 該当級の平均得点率 (= AVG(score / max_score) / 0..1) */
    avgRatio: number;
  }>;
}

/**
 * kotodama-tori メッセージ表示 (直近 7 日 / W12-T1.5 / DEC-068) の入力.
 *
 *  - parent_messages.createdAt >= cutoff の COUNT(*) (送信総数)
 *    + その内 readAt IS NOT NULL の COUNT (表示済).
 *  - SQL aggregate-only で family_id / from_user_id / to_learner_id を flow させない.
 */
export interface KotodamaMessageDeliveryRaw {
  /** 送信総数 (直近 7 日) */
  totalSent: number;
  /** 表示 (= 子端末で readAt が立った) 件数 */
  totalRead: number;
}

/** view-model に渡る完成済 raw 構造体 */
export interface KpiDashboardRaw {
  retentionDay1: RetentionRaw | undefined;
  retentionDay7: RetentionRaw | undefined;
  retentionDay30: RetentionRaw | undefined;
  avgSessionMinutes: AvgSessionMinutesRaw | undefined;
  streakStats: StreakStatsRaw | undefined;
  dailyQuestCompletion: DailyQuestCompletionRaw | undefined;
  badgeDistribution: ReadonlyArray<BadgeDistributionRaw> | undefined;
  familyMessageFrequency: FamilyMessageFrequencyRaw | undefined;
  /** W12-T2 (DEC-066): A/B test cohort raw (1 experiment = 1 raw / 拡張時は配列化検討) */
  experimentCohort: ExperimentCohortRaw | undefined;
  /** W12-T1.5 (DEC-068): 模試結果分布 (直近 30 日 / 級別 COUNT + 平均得点率) */
  mockExamDistribution: MockExamDistributionRaw | undefined;
  /** W12-T1.5 (DEC-068): kotodama-tori メッセージ表示率 (直近 7 日) */
  kotodamaMessageDelivery: KotodamaMessageDeliveryRaw | undefined;
  /** 計算基準時刻 (server now / unit テストで固定) */
  generatedAt: Date;
}

/** 1 つの KPI Card の view-model */
export interface KpiCardView {
  /** data-kpi-id 属性値 (E2E hook) */
  kpiId: string;
  /** 表示タイトル (admin 向け中立トーン) */
  title: string;
  /** メイン数値 (フォーマット済 string / 取得失敗時は "——") */
  primaryValue: string;
  /** メイン数値の補足ラベル (期間や母数 / 取得失敗時は中立 fallback) */
  secondaryLabel: string;
  /** Heroicon 名 (UI 側で実体に解決) */
  iconName:
    | "ChartBarIcon"
    | "UsersIcon"
    | "FireIcon"
    | "TrophyIcon"
    | "SparklesIcon"
    | "ChatBubbleLeftEllipsisIcon"
    | "ClockIcon"
    | "BeakerIcon";
  /** バッジ分布など補助 row 表示が必要な card 用 (= バッジ KPI のみ非空) */
  rows?: ReadonlyArray<{ id: string; label: string; value: string }>;
}

/** /admin/kpi に渡る完成 view-model */
export interface KpiDashboardView {
  generatedAtIsoUtc: string;
  cards: ReadonlyArray<KpiCardView>;
}

// ---------------------------------------------------------------------------
// 数値正規化ユーティリティ
// ---------------------------------------------------------------------------

/** 任意値を「有限非負整数」に正規化. NaN / 負値 / undefined は 0. */
export function safeNonNegInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  return Math.floor(value);
}

/** 任意値を「有限実数」に正規化. NaN / undefined は 0. */
export function safeFiniteNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value;
}

/**
 * 中央値を計算する純関数. 偶数件は中央 2 件の平均.
 *
 *  - 入力が空配列なら undefined を返す (「データ無し」 fallback hook).
 *  - 非数値要素は除外して計算する (防御正規化).
 *  - 元の配列は破壊しない (slice + sort).
 */
export function median(values: ReadonlyArray<number>): number | undefined {
  if (!Array.isArray(values)) {
    throw new TypeError("[admin/kpi-summary] median: values must be an array");
  }
  const filtered = values.filter(
    (v) => typeof v === "number" && Number.isFinite(v),
  );
  if (filtered.length === 0) return undefined;
  const sorted = [...filtered].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] as number;
  }
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** 比率を 0..1 で返す純関数. denominator 0 / NaN は undefined. */
export function safeRatio(
  numerator: number,
  denominator: number,
): number | undefined {
  if (
    typeof numerator !== "number" ||
    typeof denominator !== "number" ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return undefined;
  }
  if (numerator < 0) return undefined;
  return numerator / denominator;
}

/** 比率を「XX.X%」形式で整形する. undefined 入力は "——". */
export function formatPercentage(ratio: number | undefined): string {
  if (ratio === undefined || !Number.isFinite(ratio)) return "——";
  const clamped = Math.max(0, Math.min(1, ratio));
  return `${(clamped * 100).toFixed(1)}%`;
}

/** 整数を「N」形式で整形する. undefined / NaN は "——". */
export function formatCount(value: number | undefined): string {
  if (value === undefined || typeof value !== "number" || !Number.isFinite(value)) {
    return "——";
  }
  return Math.max(0, Math.floor(value)).toLocaleString("ja-JP");
}

/** 分単位を「N.N 分」形式で整形する. undefined / NaN は "——". */
export function formatMinutes(value: number | undefined): string {
  if (value === undefined || typeof value !== "number" || !Number.isFinite(value)) {
    return "——";
  }
  if (value <= 0) return "0.0 分";
  return `${value.toFixed(1)} 分`;
}

// ---------------------------------------------------------------------------
// 各 KPI の純関数 builder (1 KPI = 1 KpiCardView)
// ---------------------------------------------------------------------------

function buildRetentionCard(
  kpiId: "retention-day-1" | "retention-day-7" | "retention-day-30",
  title: string,
  raw: RetentionRaw | undefined,
): KpiCardView {
  if (!raw || raw.cohortSize <= 0) {
    return {
      kpiId,
      title,
      primaryValue: "——",
      secondaryLabel: "母数 0 (まだ集計対象 cohort なし)",
      iconName: "UsersIcon",
    };
  }
  const ratio = safeRatio(raw.retainedCount, raw.cohortSize);
  return {
    kpiId,
    title,
    primaryValue: formatPercentage(ratio),
    secondaryLabel: `cohort ${formatCount(raw.cohortSize)} 名 / 継続 ${formatCount(raw.retainedCount)} 名`,
    iconName: "UsersIcon",
  };
}

function buildAvgSessionMinutesCard(
  raw: AvgSessionMinutesRaw | undefined,
): KpiCardView {
  if (!raw || raw.totalSessions <= 0) {
    return {
      kpiId: "avg-session-minutes",
      title: "平均セッション時間 (直近 7 日)",
      primaryValue: "——",
      secondaryLabel: "終了済 session 0 件",
      iconName: "ClockIcon",
    };
  }
  const avg = safeRatio(raw.totalMinutes, raw.totalSessions);
  return {
    kpiId: "avg-session-minutes",
    title: "平均セッション時間 (直近 7 日)",
    primaryValue: formatMinutes(avg),
    secondaryLabel: `終了済 ${formatCount(raw.totalSessions)} session を集計`,
    iconName: "ClockIcon",
  };
}

function buildStreakMedianCard(raw: StreakStatsRaw | undefined): KpiCardView {
  if (!raw || raw.currentStreaks.length === 0) {
    return {
      kpiId: "streak-median",
      title: "Streak 中央値",
      primaryValue: "——",
      secondaryLabel: "対象 learner 0 名",
      iconName: "FireIcon",
    };
  }
  const med = median(raw.currentStreaks);
  return {
    kpiId: "streak-median",
    title: "Streak 中央値",
    primaryValue:
      med === undefined ? "——" : `${med.toFixed(1)} 日`,
    secondaryLabel: `対象 learner ${formatCount(raw.currentStreaks.length)} 名`,
    iconName: "FireIcon",
  };
}

function buildStreakFreezeUsageCard(
  raw: StreakStatsRaw | undefined,
): KpiCardView {
  if (!raw || raw.freezeAcquiredCount <= 0) {
    return {
      kpiId: "streak-freeze-usage",
      title: "Streak Freeze 使用率",
      primaryValue: "——",
      secondaryLabel: "Freeze 取得 0 件 (まだ配布 / 購入なし)",
      iconName: "SparklesIcon",
    };
  }
  const ratio = safeRatio(raw.freezeUsageCount, raw.freezeAcquiredCount);
  return {
    kpiId: "streak-freeze-usage",
    title: "Streak Freeze 使用率",
    primaryValue: formatPercentage(ratio),
    secondaryLabel: `使用 ${formatCount(raw.freezeUsageCount)} / 取得 ${formatCount(raw.freezeAcquiredCount)}`,
    iconName: "SparklesIcon",
  };
}

function buildDailyQuestCompletionCard(
  raw: DailyQuestCompletionRaw | undefined,
): KpiCardView {
  if (!raw || raw.totalQuests <= 0) {
    return {
      kpiId: "daily-quest-completion-rate",
      title: "Daily Quest 完了率 (直近 7 日)",
      primaryValue: "——",
      secondaryLabel: "対象 quest 0 件",
      iconName: "TrophyIcon",
    };
  }
  const ratio = safeRatio(raw.completedQuests, raw.totalQuests);
  return {
    kpiId: "daily-quest-completion-rate",
    title: "Daily Quest 完了率 (直近 7 日)",
    primaryValue: formatPercentage(ratio),
    secondaryLabel: `完了 ${formatCount(raw.completedQuests)} / 全 ${formatCount(raw.totalQuests)}`,
    iconName: "TrophyIcon",
  };
}

/**
 * バッジ獲得分布 (上位 5 件) の card builder.
 *
 *  - earnedCount 降順 + 同数タイ badgeId 昇順安定で並べる.
 *  - 6 件以上の入力でも先頭 5 件のみ rows に格納する.
 *  - 0 件 / undefined は中立 fallback.
 */
function buildBadgeDistributionCard(
  raw: ReadonlyArray<BadgeDistributionRaw> | undefined,
): KpiCardView {
  const safeRaw = Array.isArray(raw) ? raw : [];
  if (safeRaw.length === 0) {
    return {
      kpiId: "badge-distribution",
      title: "バッジ獲得分布 (上位 5 件)",
      primaryValue: "——",
      secondaryLabel: "獲得バッジ 0 件",
      iconName: "TrophyIcon",
      rows: [],
    };
  }
  const sorted = [...safeRaw]
    .filter((r) => r && typeof r.badgeId === "string")
    .sort((a, b) => {
      const ac = safeNonNegInt(a.earnedCount);
      const bc = safeNonNegInt(b.earnedCount);
      if (bc !== ac) return bc - ac;
      return a.badgeId.localeCompare(b.badgeId);
    })
    .slice(0, 5);
  const totalShown = sorted.reduce(
    (acc, r) => acc + safeNonNegInt(r.earnedCount),
    0,
  );
  return {
    kpiId: "badge-distribution",
    title: "バッジ獲得分布 (上位 5 件)",
    primaryValue: formatCount(totalShown),
    secondaryLabel: "上位 5 件の累計獲得数",
    iconName: "TrophyIcon",
    rows: sorted.map((r) => ({
      id: r.badgeId,
      label:
        typeof r.label === "string" && r.label.length > 0 ? r.label : "——",
      value: formatCount(r.earnedCount),
    })),
  };
}

/**
 * A/B test cohort 分布 (W12-T2 / DEC-066) の card builder.
 *
 *  - experiment 1 件 (= streak_freeze_monthly_grant) を 1 card に集約.
 *  - rows = variant 別「cohort 数 + 平均 streak」の文字列 (1 行 1 variant).
 *  - 同 variant 内 distribution / streakAvg のキー突合は variantKey で merge.
 *  - 0 件 / undefined / 全 variant 未割当 は中立 fallback (罰語ゼロ).
 *  - primaryValue = 全 variant 合計 cohort 数 (= 割当済 learner 総数).
 *  - secondaryLabel = description (catalog の中立コピー).
 */
export function buildExperimentCohortCard(
  raw: ExperimentCohortRaw | undefined,
): KpiCardView {
  if (!raw || typeof raw !== "object") {
    return {
      kpiId: "experiment-streak-freeze-cohort",
      title: "A/B test cohort 分布",
      primaryValue: "——",
      secondaryLabel: "実験データ未取得 (前向き fallback)",
      iconName: "BeakerIcon",
      rows: [],
    };
  }

  const description =
    typeof raw.description === "string" && raw.description.length > 0
      ? raw.description
      : "実験 cohort 集計";

  const safeDistribution = Array.isArray(raw.distribution)
    ? raw.distribution.filter(
        (d) =>
          d &&
          typeof d.variantKey === "string" &&
          d.variantKey.length > 0,
      )
    : [];
  const safeStreakAvg = Array.isArray(raw.streakAvg)
    ? raw.streakAvg.filter(
        (s) =>
          s &&
          typeof s.variantKey === "string" &&
          s.variantKey.length > 0,
      )
    : [];

  const totalCohort = safeDistribution.reduce(
    (acc, d) => acc + safeNonNegInt(d.count),
    0,
  );

  if (safeDistribution.length === 0 || totalCohort === 0) {
    return {
      kpiId: "experiment-streak-freeze-cohort",
      title: "A/B test cohort 分布",
      primaryValue: "——",
      secondaryLabel: `${description} / 割当 0 名 (まだ cohort なし)`,
      iconName: "BeakerIcon",
      rows: [],
    };
  }

  // variantKey で merge: cohort 数 + 平均 streak (n).
  const streakByVariant = new Map<
    string,
    { avgStreak: number; n: number }
  >();
  for (const s of safeStreakAvg) {
    streakByVariant.set(s.variantKey, {
      avgStreak: safeFiniteNumber(s.avgStreak),
      n: safeNonNegInt(s.n),
    });
  }

  // variant 行は variantKey 昇順で安定 (e.g. "control" < "variant_a")
  const sorted = [...safeDistribution].sort((a, b) =>
    a.variantKey.localeCompare(b.variantKey),
  );

  const rows = sorted.map((d) => {
    const variantKey = d.variantKey;
    const cohort = safeNonNegInt(d.count);
    const streak = streakByVariant.get(variantKey);
    const avgPart =
      streak && streak.n > 0
        ? `平均 streak ${streak.avgStreak.toFixed(1)} 日 (n=${formatCount(streak.n)})`
        : "平均 streak 集計待ち";
    return {
      id: variantKey,
      label: variantKey,
      value: `cohort ${formatCount(cohort)} 名 / ${avgPart}`,
    };
  });

  return {
    kpiId: "experiment-streak-freeze-cohort",
    title: "A/B test cohort 分布",
    primaryValue: formatCount(totalCohort),
    secondaryLabel: description,
    iconName: "BeakerIcon",
    rows,
  };
}

/**
 * 模試結果分布 (直近 30 日 / 級別 / W12-T1.5 / DEC-068) の card builder.
 *
 *  - 級コード昇順固定 (5 → 4 → 3) で rows を構築.
 *  - 母数 0 件級は SQL 結果から脱落しているため配列に含まれない (= 表示しない).
 *  - 全級母数 0 / undefined → primaryValue "——" / rows: [].
 *  - primaryValue = 全級合計受験件数 / secondaryLabel = 中立コピー.
 *  - DEC-024 罰語ゼロ (中立トーン: 「平均得点率 X.X%」のみ).
 */
export function buildMockExamDistributionCard(
  raw: MockExamDistributionRaw | undefined,
): KpiCardView {
  type ValidLevelRow = {
    level: "5" | "4" | "3";
    count: number;
    avgRatio: number;
  };
  const safeByLevel: ValidLevelRow[] = Array.isArray(raw?.byLevel)
    ? raw!.byLevel.filter(
        (r): r is ValidLevelRow =>
          !!r &&
          (r.level === "5" || r.level === "4" || r.level === "3") &&
          safeNonNegInt(r.count) > 0,
      )
    : [];

  if (safeByLevel.length === 0) {
    return {
      kpiId: "mock-exam-distribution",
      title: "模試結果分布 (直近 30 日)",
      primaryValue: "——",
      secondaryLabel: "対象 受験 0 件",
      iconName: "ChartBarIcon",
      rows: [],
    };
  }

  // 級コード昇順固定 (5 → 4 → 3) で安定ソート.
  const LEVEL_ORDER: Record<"5" | "4" | "3", number> = { "5": 0, "4": 1, "3": 2 };
  const sorted = [...safeByLevel].sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level],
  );

  const totalCount = sorted.reduce(
    (acc, r) => acc + safeNonNegInt(r.count),
    0,
  );

  const rows = sorted.map((r) => {
    const cnt = safeNonNegInt(r.count);
    const ratio = safeFiniteNumber(r.avgRatio);
    return {
      id: `level-${r.level}`,
      label: `${r.level} 級`,
      value: `${formatCount(cnt)} 件 / 平均 ${formatPercentage(
        ratio >= 0 && ratio <= 1 ? ratio : undefined,
      )}`,
    };
  });

  return {
    kpiId: "mock-exam-distribution",
    title: "模試結果分布 (直近 30 日)",
    primaryValue: formatCount(totalCount),
    secondaryLabel: "4/5/3 級別の件数 + 平均得点率",
    iconName: "ChartBarIcon",
    rows,
  };
}

/**
 * kotodama-tori メッセージ表示率 (直近 7 日 / W12-T1.5 / DEC-068) の card builder.
 *
 *  - primaryValue = totalRead / totalSent (= 表示率 / 母数 0 → "——").
 *  - secondaryLabel = "送信 N 件 / 表示 M 件" (内訳が見える中立コピー).
 *  - 全 raw undefined / totalSent=0 → 中立 fallback.
 *  - DEC-024 罰語ゼロ (中立トーン: 「未読」「無視」等は使わない).
 */
export function buildKotodamaMessageDeliveryCard(
  raw: KotodamaMessageDeliveryRaw | undefined,
): KpiCardView {
  if (!raw) {
    return {
      kpiId: "kotodama-message-delivery",
      title: "kotodama-tori メッセージ表示率 (直近 7 日)",
      primaryValue: "——",
      secondaryLabel: "集計データ未取得 (前向き fallback)",
      iconName: "ChatBubbleLeftEllipsisIcon",
    };
  }
  const totalSent = safeNonNegInt(raw.totalSent);
  const totalRead = safeNonNegInt(raw.totalRead);
  if (totalSent <= 0) {
    return {
      kpiId: "kotodama-message-delivery",
      title: "kotodama-tori メッセージ表示率 (直近 7 日)",
      primaryValue: "——",
      secondaryLabel: "送信 0 件 / 表示 0 件",
      iconName: "ChatBubbleLeftEllipsisIcon",
    };
  }
  const ratio = safeRatio(totalRead, totalSent);
  return {
    kpiId: "kotodama-message-delivery",
    title: "kotodama-tori メッセージ表示率 (直近 7 日)",
    primaryValue: formatPercentage(ratio),
    secondaryLabel: `送信 ${formatCount(totalSent)} 件 / 表示 ${formatCount(totalRead)} 件`,
    iconName: "ChatBubbleLeftEllipsisIcon",
  };
}

function buildFamilyMessageFrequencyCard(
  raw: FamilyMessageFrequencyRaw | undefined,
): KpiCardView {
  if (!raw) {
    return {
      kpiId: "family-message-frequency",
      title: "親→子メッセージ送信数 (直近 7 日)",
      primaryValue: "——",
      secondaryLabel: "集計データ未取得 (前向き fallback)",
      iconName: "ChatBubbleLeftEllipsisIcon",
    };
  }
  const total = safeNonNegInt(raw.totalMessagesLast7Days);
  return {
    kpiId: "family-message-frequency",
    title: "親→子メッセージ送信数 (直近 7 日)",
    primaryValue: formatCount(total),
    secondaryLabel: "全 family 合算 (集約値のみ)",
    iconName: "ChatBubbleLeftEllipsisIcon",
  };
}

// ---------------------------------------------------------------------------
// composeKpiDashboardView: view-model 全体の組み立て (pure compose)
// ---------------------------------------------------------------------------

/**
 * raw counters を view-model にまとめる pure compose 関数.
 *
 *  - 入力が「未取得 (undefined)」の KPI も中立 fallback で必ず card を 1 枚返す
 *    → UI 側で「あるはずの card が消える」ことが構造的に発生しない.
 *  - cards の並び順は KPI 識別子の固定順 (E2E が data-kpi-id で stable に当てる).
 */
export function composeKpiDashboardView(
  raw: KpiDashboardRaw,
): KpiDashboardView {
  if (!raw || typeof raw !== "object") {
    throw new TypeError("[admin/kpi-summary] raw must be an object");
  }
  const generatedAt =
    raw.generatedAt instanceof Date && !Number.isNaN(raw.generatedAt.getTime())
      ? raw.generatedAt
      : new Date(0);

  const cards: KpiCardView[] = [
    buildRetentionCard(
      "retention-day-1",
      "Day-1 retention",
      raw.retentionDay1,
    ),
    buildRetentionCard(
      "retention-day-7",
      "Day-7 retention",
      raw.retentionDay7,
    ),
    buildRetentionCard(
      "retention-day-30",
      "Day-30 retention",
      raw.retentionDay30,
    ),
    buildAvgSessionMinutesCard(raw.avgSessionMinutes),
    buildStreakMedianCard(raw.streakStats),
    buildStreakFreezeUsageCard(raw.streakStats),
    buildDailyQuestCompletionCard(raw.dailyQuestCompletion),
    buildBadgeDistributionCard(raw.badgeDistribution),
    buildFamilyMessageFrequencyCard(raw.familyMessageFrequency),
    // W12-T2 (DEC-066): A/B test cohort 分布 を fixed-order 末尾に追加
    // (既存 9 card の順序は不変 / E2E が data-kpi-id で stable に当てる)
    buildExperimentCohortCard(raw.experimentCohort),
    // W12-T1.5 (DEC-068): 模試結果分布 (直近 30 日) を fixed-order 11 個目に追加.
    buildMockExamDistributionCard(raw.mockExamDistribution),
    // W12-T1.5 (DEC-068): kotodama-tori メッセージ表示率 (直近 7 日) を fixed-order 12 個目に追加.
    buildKotodamaMessageDeliveryCard(raw.kotodamaMessageDelivery),
  ];

  return {
    generatedAtIsoUtc: generatedAt.toISOString(),
    cards,
  };
}
