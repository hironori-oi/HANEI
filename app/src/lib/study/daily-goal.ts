/**
 * HANEI - 自己選択日次ゴール (W8-T5)
 *
 * 4 段階:
 *   - 10 XP (軽い / 約 5 分)
 *   - 20 XP (ふつう / 約 10 分) — default
 *   - 30 XP (がんばる / 約 15 分)
 *   - 50 XP (本気 / 約 25 分)
 *
 * SDT (Self-Determination Theory) の Autonomy 充足:
 *   - 「与えられた目標」より「自分で選んだ目標」のほうが達成率が高い (Locke & Latham 1990)
 *   - Duolingo retention の主軸 (公式 talk 2023)
 *
 * 三層認可: getDailyProgress は learnerId スコープの純関数 + DB 集計関数 (本ファイル) のみで、
 *           呼び出し前に requireAuth + requireLearnerOwner で family 所属を確認する前提。
 */

import { eq, and, sql } from "drizzle-orm";
import { answerLogs, learnerProfiles } from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// 型 / 定数
// ---------------------------------------------------------------------------

/** 日次ゴール XP の選択肢 (UI とテストで共通参照) */
export const DAILY_GOAL_XP_OPTIONS = [10, 20, 30, 50] as const;
export type DailyGoalXp = (typeof DAILY_GOAL_XP_OPTIONS)[number];

export const DAILY_GOAL_DEFAULT_XP: DailyGoalXp = 20;

export interface DailyGoalChoice {
  /** XP 値 */
  xp: DailyGoalXp;
  /** UI ラベル (日本語 / ですます調) */
  label: string;
  /** 想定所要時間 (分) */
  estimatedMinutes: number;
  /** 推奨マイクロコピー */
  description: string;
}

/**
 * 日次ゴール 4 段階の表示メタデータ。
 * UI / settings / onboarding / 完了モーダルで共有。
 * 「ですます調 / 絵文字なし / 小学生向け」を厳守。
 */
export const DAILY_GOAL_CHOICES: ReadonlyArray<DailyGoalChoice> = [
  { xp: 10, label: "かるく", estimatedMinutes: 5, description: "1日 5分くらい / 軽くつづけたい日に" },
  { xp: 20, label: "ふつう", estimatedMinutes: 10, description: "1日 10分くらい / おすすめ" },
  { xp: 30, label: "がんばる", estimatedMinutes: 15, description: "1日 15分くらい / しっかり積み上げ" },
  { xp: 50, label: "本気", estimatedMinutes: 25, description: "1日 25分くらい / 受験まぢか" },
] as const;

export interface DailyProgress {
  /** 設定中の日次ゴール XP */
  goalXp: number;
  /** 今日獲得した XP */
  earnedXp: number;
  /** 残り XP (達成済なら 0) */
  remainingXp: number;
  /** 進捗率 0-1 (達成済は 1) */
  ratio: number;
  /** ゴール達成済か */
  achieved: boolean;
}

// ---------------------------------------------------------------------------
// 純関数: 進捗計算
// ---------------------------------------------------------------------------

/**
 * 純関数版: goalXp と earnedXp から DailyProgress を計算する。
 * UI の celebration 判定 / SSR / unit test で再利用可能。
 */
export function computeDailyProgress(
  goalXp: number,
  earnedXp: number,
): DailyProgress {
  const safeGoal = Math.max(1, Math.floor(goalXp));
  const safeEarned = Math.max(0, Math.floor(earnedXp));
  const remaining = Math.max(0, safeGoal - safeEarned);
  const rawRatio = safeEarned / safeGoal;
  const ratio = rawRatio > 1 ? 1 : Number(rawRatio.toFixed(4));
  return {
    goalXp: safeGoal,
    earnedXp: safeEarned,
    remainingXp: remaining,
    ratio,
    achieved: safeEarned >= safeGoal,
  };
}

/**
 * XP 値から「ふつう」など label を解決する。未知の値は default ラベル。
 */
export function describeDailyGoal(xp: number): DailyGoalChoice {
  const found = DAILY_GOAL_CHOICES.find((c) => c.xp === xp);
  return found ?? DAILY_GOAL_CHOICES[1]!; // default = ふつう
}

/**
 * 候補値かどうか (settings update 時の validation で利用)。
 */
export function isValidDailyGoalXp(value: unknown): value is DailyGoalXp {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    DAILY_GOAL_XP_OPTIONS.some((v) => v === value)
  );
}

// ---------------------------------------------------------------------------
// DB 関数
// ---------------------------------------------------------------------------

/**
 * その日 (ローカル日付 = JST 想定) に学習者が獲得した XP を集計する。
 * XP ルール (xpSummary と整合):
 *   - 正解 1 問 = 10 XP
 *   - 不正解 1 問 = 1 XP
 */
export async function getDailyEarnedXp(
  db: Db,
  learnerId: string,
  now = new Date(),
): Promise<number> {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const startUnix = Math.floor(startOfDay.getTime() / 1000);
  const endUnix = Math.floor(endOfDay.getTime() / 1000);

  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済 (呼び出し前 requireLearnerOwner)
  const rows = await db
    .select({
      delta: sql<number>`COALESCE(
        SUM(CASE WHEN ${answerLogs.isCorrect} THEN 10 ELSE 1 END), 0)`,
    })
    .from(answerLogs)
    .where(
      and(
        eq(answerLogs.learnerId, learnerId),
        sql`${answerLogs.answeredAt} >= ${startUnix}`,
        sql`${answerLogs.answeredAt} < ${endUnix}`,
      ),
    );
  return Number(rows[0]?.delta ?? 0);
}

/**
 * 学習者の日次ゴール XP を取得する (learner_profiles.daily_goal_xp)。
 * レコード未取得時は default。
 */
export async function getDailyGoalXp(
  db: Db,
  learnerId: string,
): Promise<DailyGoalXp> {
  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済 (呼び出し前 requireLearnerOwner)
  const rows = await db
    .select({ goal: learnerProfiles.dailyGoalXp })
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);
  const raw = rows[0]?.goal ?? DAILY_GOAL_DEFAULT_XP;
  if (isValidDailyGoalXp(raw)) return raw;
  return DAILY_GOAL_DEFAULT_XP;
}

/**
 * 日次ゴール進捗を取得 (learnerProfiles + answer_logs 集計)。
 * /home / 完了モーダル / settings preview の主データ源。
 */
export async function getDailyProgress(
  db: Db,
  learnerId: string,
  now: Date = new Date(),
): Promise<DailyProgress> {
  const [goalXp, earnedXp] = await Promise.all([
    getDailyGoalXp(db, learnerId),
    getDailyEarnedXp(db, learnerId, now),
  ]);
  return computeDailyProgress(goalXp, earnedXp);
}
