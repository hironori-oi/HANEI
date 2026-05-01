/**
 * HANEI - Family Weekly XP Ranking Pure Helper (W11-T3 / 家族内ランキング)
 *
 * 同一 family 内の learner ごとの週間 XP 集計値から順位を計算する純関数.
 *
 * 不変条件 (Turbopack 制約):
 *   - 純関数のみ / DB I/O ゼロ / "use server" 一切なし.
 *   - 本モジュールは "use server" ファイル外に置く. server-only モジュールは import して使う.
 *     (Next.js 16 Turbopack は "use server" ファイルからの sync export を拒否するため.)
 *
 * 設計指針 (DEC-024 / DEC-061):
 *   - 同 XP は同順位 (= 1224 ranking. 1 位タイ → 次は 3 位).
 *   - 全員 0 XP でも順位は 1, 1, 1... (全員同順位 / UI 側で「今週はまだ」表示に切替).
 *   - 単独 learner は 1 位 (UI 側で「最下位」「ビリ」を絶対に出さない).
 *   - 罰メッセージはここでは出さず、UI 側の前向きコピーに任せる.
 */

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export interface WeeklyXpRow {
  learnerId: string;
  nickname: string;
  weeklyXp: number;
  /** 任意: kotodama-tori の現在 stage (UI 表示用). undefined 可 */
  kotodamaToriStage?:
    | "hina"
    | "wakatori"
    | "seityo"
    | "kenzya"
    | "syugosin"
    | undefined;
}

export interface RankedWeeklyXpRow extends WeeklyXpRow {
  rank: number;
}

// ---------------------------------------------------------------------------
// ランキング計算
// ---------------------------------------------------------------------------

/**
 * 家族内 weekly XP ランキングを計算する純関数.
 *
 * ルール:
 *   - weeklyXp 降順でソート.
 *   - 同 XP は同順位 (1224 ranking スタイル: A=10/B=10/C=5 → 1, 1, 3).
 *   - 安定ソート: 同 XP 内では learnerId 昇順 (再現性確保).
 *   - 不正な入力 (負値 / NaN / 文字列 weeklyXp) は防御的に 0 へ正規化.
 *
 * @param rows 家族内 learner ごとの週間 XP 集計
 * @returns rank プロパティを付与した row 配列 (降順)
 */
export function computeWeeklyXpRanking(
  rows: ReadonlyArray<WeeklyXpRow>,
): RankedWeeklyXpRow[] {
  if (!Array.isArray(rows)) {
    throw new TypeError("[family-leaderboard-ranking] rows must be an array");
  }
  // 防御的正規化
  const normalized: WeeklyXpRow[] = rows
    .filter(
      (r): r is WeeklyXpRow => Boolean(r) && typeof r.learnerId === "string",
    )
    .map((r) => ({
      learnerId: r.learnerId,
      nickname: typeof r.nickname === "string" ? r.nickname : "",
      weeklyXp:
        Number.isFinite(r.weeklyXp) && (r.weeklyXp as number) > 0
          ? Math.floor(r.weeklyXp as number)
          : 0,
      kotodamaToriStage: r.kotodamaToriStage,
    }));

  // 安定ソート: weeklyXp 降順, 同点 learnerId 昇順
  const sorted = [...normalized].sort((a, b) => {
    if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
    return a.learnerId.localeCompare(b.learnerId);
  });

  // 1224 ranking
  const ranked: RankedWeeklyXpRow[] = [];
  let lastXp = Number.NaN;
  let lastRank = 0;
  sorted.forEach((row, idx) => {
    const rank = row.weeklyXp === lastXp ? lastRank : idx + 1;
    ranked.push({ ...row, rank });
    lastXp = row.weeklyXp;
    lastRank = rank;
  });
  return ranked;
}

/**
 * 全員 0 XP かを判定するヘルパ (UI が前向きコピーに切替えるため).
 */
export function isAllZeroXp(rows: ReadonlyArray<WeeklyXpRow>): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return true;
  return rows.every(
    (r) => !Number.isFinite(r.weeklyXp) || (r.weeklyXp as number) <= 0,
  );
}
