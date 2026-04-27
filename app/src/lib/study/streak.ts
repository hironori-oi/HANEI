/**
 * HANEI - running streak helper (W5 / G-5 ことだまトリ mood 用)
 *
 * "use server" モジュールには非 async 関数を export できないため、
 * 純関数はこのモジュールに分離する。
 */

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
