/**
 * HANEI - Family Streak Rollover Pure Helpers (W11-T1 / 家族のれんぞく)
 *
 * 当該 family が「今日 学習したか」 → 家族 streak の次状態を計算する純関数.
 *
 * 不変条件 (Turbopack 制約):
 *   - 純関数のみ / DB I/O ゼロ / "use server" 一切なし.
 *   - 本モジュールは "use server" ファイル外に置く. server action からは import して使う.
 *     (Next.js 16 Turbopack は "use server" ファイルからの sync export を拒否するため.)
 *
 * 設計指針 (DEC-024 / DEC-055 / DEC-060):
 *   - 同日 2 回目の呼び出しは no-op (shouldUpdate=false). 兄弟救済の冪等性を支える.
 *   - 連続日 (= lastFamilyActiveDate が前日) は +1.
 *   - 1 日以上空けば reset して 1 から再スタート (罰メッセージはここで出さず UI 側で前向きコピー).
 *   - lastFamilyActiveDate=null は初学習扱いで 1 を返す.
 */

// ---------------------------------------------------------------------------
// 日付計算ヘルパ ('YYYY-MM-DD' 文字列の前日計算 / JST 境界整合)
// ---------------------------------------------------------------------------

/**
 * 'YYYY-MM-DD' 形式の日付の前日を返す純関数.
 *
 * JST 境界整合: 入力が getJstQuestDate(now) 由来であれば、戻り値も同じ JST 6:00 境界の前日になる.
 * (内部は UTC date math で計算するが、 'YYYY-MM-DD' のローカル日付演算なので時差影響なし.)
 */
export function previousQuestDate(dateStr: string): string {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new TypeError("[family-streak-rollover] invalid date string");
  }
  const parts = dateStr.split("-").map((s) => Number.parseInt(s, 10));
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  // UTC で 1 日減算 (JST/UTC 関係なく日付の引き算として動く)
  const utc = Date.UTC(y, m - 1, d);
  const prev = new Date(utc - 24 * 60 * 60 * 1000);
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  return `${py}-${pm}-${pd}`;
}

// ---------------------------------------------------------------------------
// Roll-over 計算
// ---------------------------------------------------------------------------

export interface FamilyStreakState {
  /** 現在の家族 streak 日数 */
  familyStreakDays: number;
  /** 直近で家族 streak が更新された日付 ('YYYY-MM-DD'), null = 未学習 */
  lastFamilyActiveDate: string | null;
}

export interface FamilyStreakRolloverResult {
  /** 次の家族 streak 日数 */
  newDays: number;
  /** DB UPDATE が必要か (false = 同日 2 回目以降の no-op) */
  shouldUpdate: boolean;
}

/**
 * 家族 streak の roll-over を計算する純関数.
 *
 * - lastFamilyActiveDate === todayDate → 同日 2 回目: { newDays: prev.familyStreakDays, shouldUpdate: false }
 * - lastFamilyActiveDate === yesterday  → 連続日 +1: { newDays: prev.familyStreakDays + 1, shouldUpdate: true }
 * - lastFamilyActiveDate === null       → 初学習: { newDays: 1, shouldUpdate: true }
 * - その他 (1 日以上空き)               → reset:  { newDays: 1, shouldUpdate: true }
 *
 * @param prev - 現在の DB 上の family streak 状態
 * @param todayDate - getJstQuestDate(now) で得た 'YYYY-MM-DD' (JST 6:00 境界)
 */
export function computeFamilyStreakRollover(
  prev: FamilyStreakState,
  todayDate: string,
): FamilyStreakRolloverResult {
  if (typeof todayDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(todayDate)) {
    throw new TypeError("[family-streak-rollover] invalid todayDate");
  }
  const last = prev.lastFamilyActiveDate;
  // 同日 2 回目以降 (兄弟救済の冪等性 / DEC-055)
  if (last === todayDate) {
    return {
      newDays: Math.max(0, prev.familyStreakDays | 0),
      shouldUpdate: false,
    };
  }
  // 初学習
  if (last === null || last === undefined) {
    return { newDays: 1, shouldUpdate: true };
  }
  // 連続日 (= 昨日までに学習している)
  const yesterday = previousQuestDate(todayDate);
  if (last === yesterday) {
    return {
      newDays: Math.max(0, prev.familyStreakDays | 0) + 1,
      shouldUpdate: true,
    };
  }
  // 1 日以上空き → reset (前向きコピーは UI 側 / DEC-024)
  return { newDays: 1, shouldUpdate: true };
}
