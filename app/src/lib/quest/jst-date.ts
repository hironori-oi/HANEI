/**
 * HANEI - JST Quest Date Helper (W10-T3)
 *
 * Daily Quest の「今日」境界を JST 6:00 で切るためのヘルパ。
 *
 * 設計:
 *   - 0:00 区切りでは「夜更かしして 23:59 にクエスト達成 → 0:01 に bonus 受領忘れ」
 *     のような体験のすり減りが起こりやすい。
 *   - DEC-024 罰則ゼロ哲学に沿って「朝 6:00 にリフレッシュ」とすることで、
 *     昨日の取り損ね/今日の取り直しの境目を子どもの体感とそろえる。
 *
 * 厳密ルール:
 *   - 入力 now (UTC instant) を JST (+09:00) で見て、6:00 未満なら「前日」、
 *     6:00 以降なら「当日」を quest_date とする。
 *   - 戻り値は 'YYYY-MM-DD' 形式 (ISO local date 部分のみ)。
 *   - 純関数 (DB I/O なし / "use server" なし)。
 */

const JST_OFFSET_MIN = 9 * 60;
const QUEST_BOUNDARY_HOUR_JST = 6;

/**
 * 与えられた瞬間 (now) における JST 上の Quest 日付 'YYYY-MM-DD' を返す。
 *
 * 例 (JST):
 *   - 2026-04-30 05:59 → '2026-04-29'
 *   - 2026-04-30 06:00 → '2026-04-30'
 *   - 2026-05-01 02:30 → '2026-04-30'
 */
export function getJstQuestDate(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("[jst-date] now must be a valid Date");
  }
  // UTC ミリ秒 + 9h で JST のタイムスタンプを擬似生成し、
  // そこから 6h を引くと 0:00 = 6:00 JST 境界の「日」が抽出できる。
  const jstMs = now.getTime() + JST_OFFSET_MIN * 60 * 1000;
  const shiftedMs = jstMs - QUEST_BOUNDARY_HOUR_JST * 60 * 60 * 1000;
  const d = new Date(shiftedMs);
  // d は UTC で扱うと「JST 6:00 を 0:00 にずらした日」になっている。
  // UTC の年月日を取り出せば JST 上の Quest 日付として正しい。
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 'YYYY-MM-DD' 形式の妥当性チェック (純関数 / アプリ層 validate 用)。
 */
export function isQuestDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * テスト用に「JST 6:00 境界をまたいだ 1 日」をシミュレートするヘルパ。
 * 与えた quest_date (YYYY-MM-DD) の JST 6:00 を UTC Date で返す。
 */
export function jstQuestDayStartUtc(questDate: string): Date {
  if (!isQuestDateString(questDate)) {
    throw new TypeError("[jst-date] invalid questDate");
  }
  // JST 6:00 = UTC (+9h offset を引いて) 21:00 of previous UTC day
  // 2026-04-30 06:00 JST = 2026-04-29 21:00 UTC
  const parts = questDate.split("-").map((s) => Number.parseInt(s, 10));
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  // UTC の (y-m-d) 06:00 を作り、9h 引いて JST 6:00 / UTC 21:00 of (d-1) にする
  const utc6 = Date.UTC(y, m - 1, d, 6, 0, 0);
  return new Date(utc6 - JST_OFFSET_MIN * 60 * 1000);
}
