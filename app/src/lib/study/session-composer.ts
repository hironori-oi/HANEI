/**
 * HANEI - 5-7 分セッション自動設計 (W10-T4)
 *
 * 学習セッション開始時に「5 分 / 7 分 / 10 分」のいずれかを選び、
 * その時間内で最適な問題セット数とその構成比を deterministic に決定する純関数。
 *
 * 不変条件:
 *   - 純関数 / DB I/O ゼロ / "use server" なし
 *   - 同一 (learnerId, durationMinutes, now の YYYY-MM-DD) で何度呼んでも同じ planSize
 *     と同じ構成比を返す (再現性 100% / AI 呼び出しゼロ)
 *   - すべて子ども向けに「ちょうどよい量」をベースに設計 (Pacer モデル準拠)
 *   - DEC-024 罰則ゼロ哲学整合: 1 問もできなくても reward 減算なし / pop なし
 *   - DEC-006 / DEC-012 整合: 外部課金導線ゼロ
 *
 * 構成比の根拠:
 *   - 既習 review : 新規 : 弱点 = ratio (Phase 2 plan §W10-T4 / 推定問題数表)
 *   - 5 分: 5〜8 問 / ratio (2:2:1 〜 3:3:2)
 *   - 7 分: 8〜12 問 / ratio (3:3:2 〜 5:4:3)
 *   - 10 分: 12〜18 問 / ratio (5:4:3 〜 7:6:5)
 *
 * 「最適」の指標 = 子供の集中時間 12-36 分 にフィット + Pacer > Binge ユーザの
 * retention 高い (Duolingo 公式) を構造的に再現すること。
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * セッション選択肢 (5 / 7 / 10 分の 3 択)。
 *  - 数字は半角 (子ども向け a11y / aria-label に直結)
 *  - 値は分単位 / API では integer
 */
export type SessionDurationMinutes = 5 | 7 | 10;

export const SESSION_DURATION_OPTIONS: ReadonlyArray<SessionDurationMinutes> = [
  5,
  7,
  10,
];

export function isSessionDurationMinutes(
  value: unknown,
): value is SessionDurationMinutes {
  return value === 5 || value === 7 || value === 10;
}

/**
 * 各 duration に紐づくコピー (子ども向け語感 / DEC-024 罰則ゼロ整合 / 否定形なし)。
 */
export interface SessionDurationCopy {
  /** 大見出し (e.g. "5 ふん") */
  headline: string;
  /** 補助テキスト (e.g. "ちょっとだけ がんばってみる") */
  subtext: string;
  /** aria-label (read-aloud / VoiceOver 用) */
  ariaLabel: string;
}

const SESSION_COPY: Readonly<Record<SessionDurationMinutes, SessionDurationCopy>> =
  {
    5: {
      headline: "5 ふん",
      subtext: "ちょっとだけ がんばってみる",
      ariaLabel: "5 分セッション (ちょっとだけ がんばる)",
    },
    7: {
      headline: "7 ふん",
      subtext: "ちょうどいい りょうで すすめる",
      ariaLabel: "7 分セッション (ちょうどいい りょうで すすめる)",
    },
    10: {
      headline: "10 ぷん",
      subtext: "しっかり やって おわらせる",
      ariaLabel: "10 分セッション (しっかり やって おわらせる)",
    },
  };

export function getSessionCopy(
  duration: SessionDurationMinutes,
): SessionDurationCopy {
  return SESSION_COPY[duration];
}

/**
 * 「ちょうどよさ」の overtime threshold ratio。
 * 経過時間が選択時間 * (1 + threshold) を超えると、
 * 「もうすこしだけ ありがとう、おしまいに できるよ」モーダルを表示する候補となる。
 * 強制終了は **しない** (DEC-024 罰則ゼロ哲学整合)。
 */
export const SESSION_OVERTIME_RATIO = 0.5; // = +50%

/**
 * 経過秒数が選択時間の overtime threshold を超えたか判定する純関数。
 * - 5 分 → 7.5 分 (450 秒)
 * - 7 分 → 10.5 分 (630 秒)
 * - 10 分 → 15 分 (900 秒)
 */
export function hasReachedOvertime(
  duration: SessionDurationMinutes,
  elapsedSeconds: number,
): boolean {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return false;
  const limitSec = Math.floor(duration * 60 * (1 + SESSION_OVERTIME_RATIO));
  return elapsedSeconds >= limitSec;
}

// ---------------------------------------------------------------------------
// 構成比 (review : new : weakness) と plan size の決定論的決定
// ---------------------------------------------------------------------------

/**
 * 各 quartet (duration / planSize / ratio) の table。
 *
 * Phase 2 plan §W10-T4 推定問題数表を内部 ratio バリアントとして展開:
 *   - 5 分 = 5/6/7/8 問 (4 variant)
 *   - 7 分 = 8/9/10/11/12 問 (5 variant)
 *   - 10 分 = 12/13/14/15/16/17/18 問 (7 variant)
 *
 * 各 variant の review : new : weakness ratio は plan の上限/下限 (2:2:1 ~ 7:6:5)
 * を線形補間して合計が planSize と一致するように調整。
 */
export interface SessionRatio {
  review: number;
  fresh: number;
  weakness: number;
}

export interface SessionPlanVariant {
  planSize: number;
  ratio: SessionRatio;
}

const PLAN_VARIANTS: Readonly<
  Record<SessionDurationMinutes, ReadonlyArray<SessionPlanVariant>>
> = {
  // 5 分: 5〜8 問 / ratio (2:2:1 〜 3:3:2)
  5: [
    { planSize: 5, ratio: { review: 2, fresh: 2, weakness: 1 } }, // 5
    { planSize: 6, ratio: { review: 2, fresh: 2, weakness: 2 } }, // 6
    { planSize: 7, ratio: { review: 3, fresh: 2, weakness: 2 } }, // 7
    { planSize: 8, ratio: { review: 3, fresh: 3, weakness: 2 } }, // 8
  ],
  // 7 分: 8〜12 問 / ratio (3:3:2 〜 5:4:3)
  7: [
    { planSize: 8, ratio: { review: 3, fresh: 3, weakness: 2 } }, // 8
    { planSize: 9, ratio: { review: 3, fresh: 3, weakness: 3 } }, // 9
    { planSize: 10, ratio: { review: 4, fresh: 3, weakness: 3 } }, // 10
    { planSize: 11, ratio: { review: 4, fresh: 4, weakness: 3 } }, // 11
    { planSize: 12, ratio: { review: 5, fresh: 4, weakness: 3 } }, // 12
  ],
  // 10 分: 12〜18 問 / ratio (5:4:3 〜 7:6:5)
  10: [
    { planSize: 12, ratio: { review: 5, fresh: 4, weakness: 3 } }, // 12
    { planSize: 13, ratio: { review: 5, fresh: 5, weakness: 3 } }, // 13
    { planSize: 14, ratio: { review: 6, fresh: 5, weakness: 3 } }, // 14
    { planSize: 15, ratio: { review: 6, fresh: 5, weakness: 4 } }, // 15
    { planSize: 16, ratio: { review: 6, fresh: 6, weakness: 4 } }, // 16
    { planSize: 17, ratio: { review: 7, fresh: 6, weakness: 4 } }, // 17
    { planSize: 18, ratio: { review: 7, fresh: 6, weakness: 5 } }, // 18
  ],
};

/**
 * duration の variant 一覧を返す (UI で「すこし」「ちょうどいい」を可視化したい時用 / Phase 2 拡張).
 */
export function getPlanVariantsFor(
  duration: SessionDurationMinutes,
): ReadonlyArray<SessionPlanVariant> {
  return PLAN_VARIANTS[duration];
}

// ---------------------------------------------------------------------------
// 決定論的 PRNG (mulberry32 / quest-generator と同方針)
// ---------------------------------------------------------------------------

/**
 * 32-bit seeded PRNG. 0 <= x < 1。
 * 同 seed なら同じ列を返す → 同 (learner, day, duration) で同じ planSize / ratio。
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToUint32(input: string): number {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

function localDateString(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("[session-composer] now must be a valid Date");
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * (learnerId, durationMinutes, now の YYYY-MM-DD) から deterministic な seed を作る。
 * 内部ヘルパ (export しない / 純粋に variant 選択にのみ使う)。
 */
function buildSessionSeed(
  learnerId: string,
  durationMinutes: SessionDurationMinutes,
  now: Date,
): number {
  return hashStringToUint32(
    `session|${learnerId}|${durationMinutes}|${localDateString(now)}`,
  );
}

// ---------------------------------------------------------------------------
// 公開: composeStudySession
// ---------------------------------------------------------------------------

export interface ComposeStudySessionInput {
  learnerId: string;
  durationMinutes: SessionDurationMinutes;
  /** 計算基準時刻 (default = new Date()) */
  now?: Date;
}

export interface ComposedStudySession {
  /** 選択時間 (再表示用 / そのまま返却) */
  durationMinutes: SessionDurationMinutes;
  /** 推定問題数 (= sum of ratio fields) */
  planSize: number;
  /** 構成比 (review : 新規 : 弱点 の問題数 / 合計 = planSize) */
  ratio: SessionRatio;
  /** UI 表示用コピー */
  copy: SessionDurationCopy;
  /**
   * overtime までの秒数 (経過時刻が この値を越えたら "もうすこしだけ" モーダル).
   * 強制終了はしない (罰則ゼロ哲学).
   */
  overtimeThresholdSeconds: number;
}

/**
 * 1 セッション分の構成 (planSize + ratio + copy) を deterministic に返す。
 *
 * 不変条件:
 *   - 同 (learnerId, durationMinutes, now の day) で同じ結果 (再現性)
 *   - planSize = ratio.review + ratio.fresh + ratio.weakness
 *   - planSize は plan §W10-T4 の推定問題数表の範囲内
 *   - 学習者違い / 日付違いで variant が異なりうる (飽き防止)
 */
export function composeStudySession(
  input: ComposeStudySessionInput,
): ComposedStudySession {
  if (!input.learnerId || typeof input.learnerId !== "string") {
    throw new TypeError("[session-composer] learnerId is required");
  }
  if (!isSessionDurationMinutes(input.durationMinutes)) {
    throw new TypeError("[session-composer] durationMinutes must be 5/7/10");
  }

  const duration = input.durationMinutes;
  const now = input.now ?? new Date();
  const variants = PLAN_VARIANTS[duration];

  // deterministic に variant を pick (同 (learner, day, duration) → 同 variant)
  const seed = buildSessionSeed(input.learnerId, duration, now);
  const rng = mulberry32(seed);
  const idx = Math.floor(rng() * variants.length);
  const variant = variants[Math.min(idx, variants.length - 1)] ?? variants[0]!;

  const overtimeThresholdSeconds = Math.floor(
    duration * 60 * (1 + SESSION_OVERTIME_RATIO),
  );

  return {
    durationMinutes: duration,
    planSize: variant.planSize,
    ratio: { ...variant.ratio },
    copy: getSessionCopy(duration),
    overtimeThresholdSeconds,
  };
}

// ---------------------------------------------------------------------------
// 進捗終了演出: 完了サマリ helpers (UI で使う非 PII 集計値)
// ---------------------------------------------------------------------------

export interface SessionOutcomeSummary {
  /** 完了問題数 */
  problemsAnswered: number;
  /** 正解数 */
  correctCount: number;
  /** 正答率 (0-100, 整数) */
  accuracyPercent: number;
  /** 獲得ハネキン (server から渡る合算値 / 未取得なら 0) */
  earnedCoins: number;
}

/**
 * answers 配列から完了サマリを計算 (純関数 / UI でリアルタイム反映).
 */
export function summarizeSession(
  answers: ReadonlyArray<{ correct: boolean }>,
  earnedCoins: number = 0,
): SessionOutcomeSummary {
  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  return {
    problemsAnswered: total,
    correctCount: correct,
    accuracyPercent: Math.min(100, Math.max(0, accuracy)),
    earnedCoins: Math.max(0, Math.floor(earnedCoins)),
  };
}

// ---------------------------------------------------------------------------
// 「いつもの長さでいい」: localStorage key
// ---------------------------------------------------------------------------

export const LAST_SESSION_DURATION_STORAGE_KEY = "hanei.session.lastDurationMin";

/**
 * localStorage に保存された前回 duration を SessionDurationMinutes として安全に取り出す。
 * - SSR / localStorage 不在 / 不正値 / 数字以外 → null
 * - Phase 1 では同一ブラウザ × 同一学習者 (端末) を前提 (account-bound 永続化は W11+)
 */
export function readLastSessionDurationFromStorage(
  storage: Pick<Storage, "getItem"> | null | undefined,
): SessionDurationMinutes | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LAST_SESSION_DURATION_STORAGE_KEY);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return isSessionDurationMinutes(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * localStorage に最終選択 duration を保存する (best-effort).
 */
export function writeLastSessionDurationToStorage(
  storage: Pick<Storage, "setItem"> | null | undefined,
  duration: SessionDurationMinutes,
): void {
  if (!storage) return;
  if (!isSessionDurationMinutes(duration)) return;
  try {
    storage.setItem(LAST_SESSION_DURATION_STORAGE_KEY, String(duration));
  } catch {
    // SafariPrivate / quotaExceeded — silently ignore
  }
}
