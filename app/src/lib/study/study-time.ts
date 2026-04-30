/**
 * HANEI - 過学習防止 (Overlearning Prevention) Pure Helpers (W10-T5)
 *
 * 当日累計学習時間 (秒) に基づく 2 段階の閾値判定 + 表示用フォーマッタ。
 *
 * 不変条件:
 *   - 純関数 / DB I/O ゼロ / "use server" なし
 *   - DEC-024 罰則ゼロ哲学整合: 閾値到達は「祝福 + 休憩促し」であり減点ではない。
 *     hard limit (60 分) でも streak は守られる。これは streak 計算ロジック (`streak.ts`) が
 *     「その日に 1 問でも解いたか」のみを見ており、本モジュールが streak に介入しないことで
 *     構造的に保証される。
 *   - DEC-006 / DEC-012 整合: 外部課金 / 罰則 / マイナス pop 一切なし。
 *
 * 「なぜ 30 / 60 分か」:
 *   - 子供の連続集中は 12-36 分が概ね上限 (Pacer モデル). 30 分は「もうひと息」と思える境目.
 *   - 60 分 = 学校の 1 コマ相当. 連続 1 時間以上の学習は、学習効率より「続けてしまった」感の
 *     方が強くなりやすい. ここで強制終了 (= ホームへ戻す) ことで「やりすぎ」を防ぐ.
 *   - hard limit 到達でも streak は守られる (= その日の学習日数としてカウントされる).
 */

// ---------------------------------------------------------------------------
// 閾値定数
// ---------------------------------------------------------------------------

/**
 * 「もうすこしで 30 分 / きょうは ここで きゅうけい しよう」 nudge 閾値 (秒).
 * 当日累計 = この値以上で 1 度だけ穏やかな提案 modal を表示する.
 */
export const OVERLEARNING_NUDGE_THRESHOLD_SECONDS = 30 * 60;

/**
 * 強制終了 (hard limit) 閾値 (秒).
 * 当日累計 = この値以上で modal を出して /home へ navigate する.
 * 表示は祝福調 (DEC-024) / streak は守られる.
 */
export const OVERLEARNING_HARD_LIMIT_SECONDS = 60 * 60;

/**
 * 1 回の heartbeat で増加させる秒数の上限.
 * client tab を放置しても server 側で過大に加算されないようにする防御.
 */
export const HEARTBEAT_MAX_DELTA_SECONDS = 60;

/**
 * 1 回の study_session が累積できる秒数の上限 (1 日 hard limit + safety margin).
 * 1 セッションの cumulative_seconds が極端に膨らむ事故を防ぐ (overnight tab 等).
 */
export const SESSION_CUMULATIVE_HARD_CAP_SECONDS = 4 * 60 * 60;

// ---------------------------------------------------------------------------
// 閾値判定
// ---------------------------------------------------------------------------

/**
 * 累計学習秒が「もうすこしで 30 分」 nudge 閾値以上か.
 * negative / NaN は false に倒す (UI の早期 trigger 防止).
 */
export function hasReachedOverlearningNudge(
  cumulativeSeconds: number,
): boolean {
  if (!Number.isFinite(cumulativeSeconds) || cumulativeSeconds < 0) return false;
  return cumulativeSeconds >= OVERLEARNING_NUDGE_THRESHOLD_SECONDS;
}

/**
 * 累計学習秒が hard limit (60 分) 以上か.
 * negative / NaN は false に倒す.
 */
export function hasReachedOverlearningHardLimit(
  cumulativeSeconds: number,
): boolean {
  if (!Number.isFinite(cumulativeSeconds) || cumulativeSeconds < 0) return false;
  return cumulativeSeconds >= OVERLEARNING_HARD_LIMIT_SECONDS;
}

/**
 * 1 回の heartbeat 加算秒数を `[0, HEARTBEAT_MAX_DELTA_SECONDS]` に clamp する純関数.
 * - 負値 / NaN / Infinity は 0
 * - HEARTBEAT_MAX_DELTA_SECONDS 超過は cap
 */
export function clampHeartbeatDeltaSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(Math.floor(seconds), HEARTBEAT_MAX_DELTA_SECONDS);
}

/**
 * 1 セッションの累積秒数を `[0, SESSION_CUMULATIVE_HARD_CAP_SECONDS]` に clamp する純関数.
 */
export function clampSessionCumulativeSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(Math.floor(seconds), SESSION_CUMULATIVE_HARD_CAP_SECONDS);
}

// ---------------------------------------------------------------------------
// 表示フォーマッタ
// ---------------------------------------------------------------------------

/**
 * 累計秒を「今日 X ふん」表示用の minutes に変換する純関数.
 * - floor(seconds / 60) を返す (端数切り捨て)
 * - negative / NaN は 0
 */
export function todayMinutesFromSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.floor(seconds / 60);
}

/**
 * 「今日 X ふん」label を返す純関数 (保護者ダッシュボード / 学習画面で共有).
 * - 0 分の時は「まだ きょうは していないよ」
 * - 30 分以上の時は「やすみつつ つづけてね」suffix
 * - 60 分以上の時は「きょうは おつかれさま」suffix
 */
export interface TodayMinutesLabel {
  minutes: number;
  /** メイン表示文 (例: "きょう 25 ふん") */
  primary: string;
  /** 補足文 (例: "やすみつつ つづけてね") */
  hint: string;
  /** UI 配色トーン (parent dashboard / study UI 共通) */
  tone: "neutral" | "warm" | "celebrate";
}

export function describeTodayMinutes(seconds: number): TodayMinutesLabel {
  const minutes = todayMinutesFromSeconds(seconds);
  if (minutes <= 0) {
    return {
      minutes: 0,
      primary: "きょうは まだ これから",
      hint: "ちょっとだけでも はじめてみよう",
      tone: "neutral",
    };
  }
  if (seconds >= OVERLEARNING_HARD_LIMIT_SECONDS) {
    return {
      minutes,
      primary: `きょう ${minutes} ふん がんばった`,
      hint: "きょうは じゅうぶん。あした また あおうね",
      tone: "celebrate",
    };
  }
  if (seconds >= OVERLEARNING_NUDGE_THRESHOLD_SECONDS) {
    return {
      minutes,
      primary: `きょう ${minutes} ふん`,
      hint: "やすみつつ つづけてね",
      tone: "warm",
    };
  }
  return {
    minutes,
    primary: `きょう ${minutes} ふん`,
    hint: "ちょうど いい ペースだよ",
    tone: "neutral",
  };
}

// ---------------------------------------------------------------------------
// 「いつもの長さ」 (preferred session minutes) サニタイズ
// ---------------------------------------------------------------------------

/**
 * preferences JSON 由来の preferredSessionMinutes 値を 5 / 7 / 10 / null に正規化する純関数.
 * - 不正値 (string / 6 / 0 / NaN / null / undefined) は null に倒す.
 */
export function sanitizePreferredSessionMinutes(
  raw: unknown,
): 5 | 7 | 10 | null {
  if (raw === 5 || raw === 7 || raw === 10) return raw;
  return null;
}
