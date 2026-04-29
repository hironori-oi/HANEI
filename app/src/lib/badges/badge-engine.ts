/**
 * HANEI - Badge Engine (W9-T3)
 *
 * 純関数で「現在の学習者統計」から「解放可能な BadgeCode」を判定する。
 * Server Action / repository / unit test のいずれからでも呼び出せる純粋ロジック。
 *
 * 設計原則:
 *   - 副作用ゼロ (DB 書き込みは呼び出し側 / repository.ts 役割)
 *   - 既に earned のものは newlyEarned から除外
 *   - 統計入力は repository が SQL 集計済みの数値のみ受け取る (試験不能 ASCII 防止)
 *   - 8 種すべての分岐は catalog.ts.criteria の type で discriminated dispatch
 *
 * テスト容易性:
 *   - input/output が plain object のみ → in-memory で 16+ 本のシナリオを高速に回せる
 */

import { ALL_BADGE_CODES, type BadgeCode } from "./badge-codes";
import { BADGE_CATALOG } from "./catalog";

export interface SkillMasteryCounts {
  vocabulary: number;
  grammar: number;
  reading: number;
  listening: number;
}

export interface LearnerBadgeStats {
  /** answer_logs 累計 (W9-T3 first_flight 用) */
  totalAnswerCount: number;
  /** streaks.current_streak (W9-T3 streak_keeper / sakura_keeper 用) */
  currentStreak: number;
  /** skill 別 mastery count (= 当該 skill で正解した distinct 問題数) */
  skillMasteryCounts: SkillMasteryCounts;
  /** mock_exam_results 累計 (W9-T3 first_mock_exam 用) */
  mockExamCount: number;
}

export interface CheckBadgeAchievementsResult {
  /** 今回の入力で**新たに**解放されたコード (既 earned は除外) */
  newlyEarned: BadgeCode[];
  /** 今回の入力で earned 状態になっているコード (既存 + 新規) */
  allEarned: BadgeCode[];
}

/**
 * 1 件の BadgeCode について「現在 stats で達成済みか」を判定する純関数。
 * catalog.ts.criteria の discriminated union で dispatch する。
 */
export function isBadgeAchieved(
  code: BadgeCode,
  stats: LearnerBadgeStats,
): boolean {
  const meta = BADGE_CATALOG.find((b) => b.code === code);
  if (!meta) return false;

  switch (meta.criteria.type) {
    case "answer_count":
      return safeNum(stats.totalAnswerCount) >= meta.criteria.threshold;
    case "streak":
      return safeNum(stats.currentStreak) >= meta.criteria.threshold;
    case "mock_exam_count":
      return safeNum(stats.mockExamCount) >= meta.criteria.threshold;
    case "skill_mastery": {
      const counts = stats.skillMasteryCounts ?? {
        vocabulary: 0,
        grammar: 0,
        reading: 0,
        listening: 0,
      };
      const v = safeNum(counts[meta.criteria.skill]);
      return v >= meta.criteria.threshold;
    }
    default: {
      // 網羅性チェック (TS 4.x exhaustive)
      const _exhaustive: never = meta.criteria;
      void _exhaustive;
      return false;
    }
  }
}

/**
 * 全 8 種を一括判定し、(既 earned を除いた) newly earned と allEarned を返す純関数。
 *
 * - `alreadyEarned` には DB に既に user_badges 行がある BadgeCode を渡す
 * - 第一引数 `learnerId` は呼び出し側から渡されるが、本純関数は副作用ゼロなので
 *   実装上は使用しない (ロギング / テレメトリで参照するためのフック)
 */
export function checkBadgeAchievements(
  learnerId: string,
  stats: LearnerBadgeStats,
  alreadyEarned: ReadonlyArray<BadgeCode> = [],
): CheckBadgeAchievementsResult {
  void learnerId;
  const earnedSet = new Set<BadgeCode>(alreadyEarned);
  const newlyEarned: BadgeCode[] = [];
  const allEarned: BadgeCode[] = [];

  for (const code of ALL_BADGE_CODES) {
    const achieved = isBadgeAchieved(code, stats);
    if (achieved) {
      allEarned.push(code);
      if (!earnedSet.has(code)) {
        newlyEarned.push(code);
        earnedSet.add(code);
      }
    }
  }
  return { newlyEarned, allEarned };
}

/**
 * 進捗率 (0..1) を返す純関数。未解放 badge の "X / N" ヒント表示で使用。
 * - 解放済 = 1.0 / 未解放 = 現在値 / threshold (1 を超えない)
 */
export function badgeProgressRatio(
  code: BadgeCode,
  stats: LearnerBadgeStats,
): { current: number; total: number; ratio: number; achieved: boolean } {
  const meta = BADGE_CATALOG.find((b) => b.code === code);
  if (!meta) return { current: 0, total: 1, ratio: 0, achieved: false };

  let current = 0;
  switch (meta.criteria.type) {
    case "answer_count":
      current = safeNum(stats.totalAnswerCount);
      break;
    case "streak":
      current = safeNum(stats.currentStreak);
      break;
    case "mock_exam_count":
      current = safeNum(stats.mockExamCount);
      break;
    case "skill_mastery":
      current = safeNum(stats.skillMasteryCounts?.[meta.criteria.skill] ?? 0);
      break;
  }
  const total = Math.max(1, meta.progressDenominator);
  const ratio = Math.min(1, current / total);
  return {
    current: Math.max(0, current),
    total,
    ratio: Number(ratio.toFixed(4)),
    achieved: current >= total,
  };
}

function safeNum(v: number | undefined | null): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return 0;
  return Math.floor(v);
}
