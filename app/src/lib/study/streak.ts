/**
 * HANEI - running streak helper (W5 / G-5 ことだまトリ mood 用) +
 *          day streak freeze 統合 (W8-T1)
 *
 * "use server" モジュールには非 async 関数を export できないため、
 * 純関数はこのモジュールに分離する。
 */

import {
  applyStreakFreeze,
  formatIsoDate,
  type StreakFreezeResult,
} from "@/lib/study/streak-freeze";

/**
 * answer_logs を新しい順 (desc) に並べた配列の末尾から走査し、
 * 連続して正解だった件数を返す。最新が不正解なら 0。
 */
export function computeRunningStreak(
  recentLogs: ReadonlyArray<{ isCorrect: boolean }>,
): number {
  let count = 0;
  for (const log of recentLogs) {
    if (!log.isCorrect) break;
    count += 1;
  }
  return count;
}

/**
 * 学習者が今日学習した時の streak 更新 + freeze 救済を一括で計算する純関数。
 *
 * 「学習した日」に呼ぶ場合は freeze 消費は発生しない (diff=0 か diff=1 で正常維持)。
 * 「学習しなかった日」を判定したい場合は applyStreakFreeze を直接呼ぶ。
 *
 * 仕様:
 *  - lastActiveDate が今日と同じ -> streak 据え置き (重複学習)
 *  - lastActiveDate が昨日 -> streak +1
 *  - lastActiveDate が 2 日前 + freeze>0 -> freeze 1 枚消費 + streak +1 (救済 + 今日の +1)
 *  - lastActiveDate が 2 日前 + freeze=0 -> streak リセットして 1 (今日 = 新スタート)
 *  - lastActiveDate が 3 日以上前 -> streak リセットして 1
 *  - lastActiveDate が null -> streak = 1 (初学習)
 */
export interface OnLearnInput {
  lastActiveDate: string | null;
  todayIso: string;
  currentStreak: number;
  freezeTickets: number;
}

export interface OnLearnResult {
  newStreak: number;
  newLongestStreak: number;
  newFreezeTickets: number;
  newLastActiveDate: string;
  freezeConsumed: boolean;
}

export function applyLearnDayUpdate(
  input: OnLearnInput,
  longestStreak: number,
): OnLearnResult {
  const { lastActiveDate, todayIso, currentStreak, freezeTickets } = input;

  // 同日重複学習: 据え置き
  if (lastActiveDate === todayIso) {
    return {
      newStreak: currentStreak,
      newLongestStreak: Math.max(longestStreak, currentStreak),
      newFreezeTickets: freezeTickets,
      newLastActiveDate: todayIso,
      freezeConsumed: false,
    };
  }

  // 初学習者
  if (!lastActiveDate) {
    return {
      newStreak: 1,
      newLongestStreak: Math.max(longestStreak, 1),
      newFreezeTickets: freezeTickets,
      newLastActiveDate: todayIso,
      freezeConsumed: false,
    };
  }

  // 「サボった日」分の判定を applyStreakFreeze に委譲
  const freezeRes: StreakFreezeResult = applyStreakFreeze({
    lastActiveDate,
    todayIso,
    currentStreak,
    freezeTickets,
  });

  // 今日学習する -> +1 (freeze で救済 or 維持された streak の上に +1)
  // ただし broken=true なら新スタートで 1
  const baseStreak = freezeRes.broken ? 0 : freezeRes.newStreak;
  const newStreak = baseStreak + 1;

  return {
    newStreak,
    newLongestStreak: Math.max(longestStreak, newStreak),
    newFreezeTickets: freezeRes.newFreezeTickets,
    newLastActiveDate: todayIso,
    freezeConsumed: freezeRes.consumed,
  };
}

// re-export for convenience
export { formatIsoDate, applyStreakFreeze };
