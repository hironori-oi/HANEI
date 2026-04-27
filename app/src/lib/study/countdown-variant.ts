/**
 * HANEI - 受験日カウントダウン variant 純関数 (W6 / F-4)
 *
 * 受験日までの残日数 (daysUntil) からマイルストーン演出 variant を返す純関数。
 * UI / SSR / unit テストで共通利用する。
 *
 * variant 一覧:
 *  - "after"   : 受験日を過ぎた (D+1 以降, daysUntil < 0 か ただし当日は today)
 *  - "today"   : 当日 (D-0)
 *  - "final1"  : D-1 (明日が本番)
 *  - "final3"  : D-2 〜 D-3 (あと 3 日)
 *  - "week"    : D-4 〜 D-7 (1 週間以内)
 *  - "month"   : D-8 〜 D-30 (1 ヶ月以内)
 *  - "far"     : D-31 以上 / null (まだ余裕)
 *
 * mood と連動 (UI 側で使用):
 *  - far / month → cheerful
 *  - week / final3 → encouraging
 *  - final1 / today → celebrating
 *  - after → cheerful (結果待ち)
 */

export type CountdownVariant =
  | "far"
  | "month"
  | "week"
  | "final3"
  | "final1"
  | "today"
  | "after";

/**
 * 受験日までの残日数から variant を決定する。
 *
 * @param daysUntil - 0=当日 / 1=明日 / -1=昨日 / null=未設定。
 *   `null` なら "far" を返す (未設定 = まだ余裕扱い)。
 */
export function pickCountdownVariant(
  daysUntil: number | null,
): CountdownVariant {
  if (daysUntil === null) return "far";
  if (daysUntil < 0) return "after";
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "final1";
  if (daysUntil <= 3) return "final3";
  if (daysUntil <= 7) return "week";
  if (daysUntil <= 30) return "month";
  return "far";
}
