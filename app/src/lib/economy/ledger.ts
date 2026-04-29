/**
 * HANEI - ハネキン (はね金) 経済 元帳純関数 (W10-T1)
 *
 * Server Actions (lib/actions/coins.ts) から呼ばれる純関数モジュール。
 * - 取引額の計算 / バリデーション / 残高検証 / 報酬定数
 * - DB I/O / "use server" を含まないので unit test しやすい
 *
 * 不変条件:
 *   - amount > 0  : 獲得 (lesson / streak / badge / quest / level_up / manual_adjust)
 *   - amount < 0  : 消費 (shop_purchase / freeze_purchase / feed_purchase / manual_adjust)
 *   - amount = 0  : 不正 (validateAmount で reject)
 *   - balance + amount >= 0 : 消費後も残高は非負 (validateSpend で保証)
 *
 * 課金システム化禁止 (DEC-012): 外部購入導線ゼロの閉じた経済。
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoinReason =
  | "lesson"
  | "streak"
  | "badge"
  | "quest"
  | "level_up"
  | "shop_purchase"
  | "freeze_purchase"
  | "feed_purchase"
  | "manual_adjust";

export const COIN_REASONS = [
  "lesson",
  "streak",
  "badge",
  "quest",
  "level_up",
  "shop_purchase",
  "freeze_purchase",
  "feed_purchase",
  "manual_adjust",
] as const satisfies ReadonlyArray<CoinReason>;

export function isCoinReason(value: string): value is CoinReason {
  return (COIN_REASONS as ReadonlyArray<string>).includes(value);
}

/** 獲得 (amount > 0) として許される reason */
export const EARN_REASONS: ReadonlyArray<CoinReason> = [
  "lesson",
  "streak",
  "badge",
  "quest",
  "level_up",
  "manual_adjust",
];

/** 消費 (amount < 0) として許される reason */
export const SPEND_REASONS: ReadonlyArray<CoinReason> = [
  "shop_purchase",
  "freeze_purchase",
  "feed_purchase",
  "manual_adjust",
];

// ---------------------------------------------------------------------------
// 報酬定数 (default earnings)
// ---------------------------------------------------------------------------

/**
 * 獲得経路ごとの基礎報酬。子ども向けに「がんばったね」が伝わるよう小銭多め設計。
 *
 *   1 日 60 分学習 (≒ 30 問正解) → ≒ 60 ハネキン獲得 = アクセサリ小物 1 つ買える
 *
 * 価格 (W10-T2 Shop UI):
 *   - 30〜60 ハネキン  : 軽い装飾 (リボン / 紙のクラウン)
 *   - 80〜150 ハネキン : 中堅装飾 (まとう布 / シルクスカーフ)
 *   - 200 ハネキン     : Streak Freeze 1 枚追加購入
 */
export const COIN_REWARDS = {
  /** 問題 1 問正解 (writing_essay 含む) */
  LESSON_CORRECT: 2,
  /** 問題不正解 — 罰則ゼロ (DEC-024 親メッセージ哲学と整合 / 励まし主軸) */
  LESSON_INCORRECT: 0,

  /** 1 日連続記録達成 (毎日付与 / streak ≥ 1) */
  STREAK_DAY: 5,
  /** 7 日連続達成ボーナス (週 1 度) */
  STREAK_WEEK: 20,
  /** 30 日連続達成ボーナス (月 1 度) */
  STREAK_MONTH: 100,

  /** バッジ獲得時 — tier ごとに加算 */
  BADGE_BRONZE: 30,
  BADGE_SILVER: 60,
  BADGE_GOLD: 100,
  BADGE_PLATINUM: 200,

  /** Daily Quest (W10-T3) 1 件完了 */
  QUEST_COMPLETE: 15,
  /** Daily Quest 3 件全完了の bonus */
  QUEST_ALL_DONE: 30,

  /** レベル昇格 (任意の追加報酬) */
  LEVEL_UP: 50,
} as const;

export type CoinRewardKey = keyof typeof COIN_REWARDS;

/**
 * バッジ tier から獲得ハネキンを返す。未知 tier は 0 (安全側)。
 */
export function rewardForBadgeTier(
  tier: "bronze" | "silver" | "gold" | "platinum",
): number {
  switch (tier) {
    case "bronze":
      return COIN_REWARDS.BADGE_BRONZE;
    case "silver":
      return COIN_REWARDS.BADGE_SILVER;
    case "gold":
      return COIN_REWARDS.BADGE_GOLD;
    case "platinum":
      return COIN_REWARDS.BADGE_PLATINUM;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// バリデーション
// ---------------------------------------------------------------------------

export interface ValidateAmountResult {
  ok: boolean;
  reason?: "zero" | "non_integer" | "out_of_range";
}

/**
 * amount が取引値として妥当か検証する。
 * - 0 は不正
 * - 整数でなければ不正
 * - |amount| > 100000 は防御的に拒否 (バグ / 不正アクセスでの暴騰防止)
 */
export function validateAmount(amount: number): ValidateAmountResult {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return { ok: false, reason: "non_integer" };
  }
  if (amount === 0) {
    return { ok: false, reason: "zero" };
  }
  if (Math.abs(amount) > 100000) {
    return { ok: false, reason: "out_of_range" };
  }
  return { ok: true };
}

export interface ValidateSpendResult {
  ok: boolean;
  reason?: "non_positive_cost" | "insufficient_balance";
  /** 残高不足の場合の不足分 (ok=false かつ reason=insufficient_balance のみ) */
  shortfall?: number;
}

/**
 * 消費 (cost ハネキン) 可否を判定する純関数。
 * - cost > 0 必須 (cost <= 0 は不正)
 * - 残高 (currentBalance) >= cost 必須
 */
export function validateSpend(
  currentBalance: number,
  cost: number,
): ValidateSpendResult {
  if (!Number.isFinite(cost) || !Number.isInteger(cost) || cost <= 0) {
    return { ok: false, reason: "non_positive_cost" };
  }
  if (!Number.isFinite(currentBalance) || currentBalance < cost) {
    return {
      ok: false,
      reason: "insufficient_balance",
      shortfall: Math.max(0, cost - Math.max(0, currentBalance)),
    };
  }
  return { ok: true };
}

/**
 * 残高 + amount を計算する。amount が負 (消費) の場合、結果が 0 未満になるなら null。
 * (純関数 / DB I/O なし)
 */
export function computeNewBalance(
  currentBalance: number,
  amount: number,
): number | null {
  if (!Number.isFinite(currentBalance) || !Number.isInteger(currentBalance)) {
    return null;
  }
  const next = currentBalance + amount;
  if (next < 0) return null;
  return next;
}

/**
 * reason と amount の符号一致を検証 (earn 用 reason に負額 / spend 用 reason に正額は不正)。
 */
export function validateReasonAmountSign(
  reason: CoinReason,
  amount: number,
): { ok: boolean; reason?: "sign_mismatch" } {
  // manual_adjust は両方向 OK (運営サポート用)
  if (reason === "manual_adjust") return { ok: true };
  if (EARN_REASONS.includes(reason) && amount > 0) return { ok: true };
  if (SPEND_REASONS.includes(reason) && amount < 0) return { ok: true };
  return { ok: false, reason: "sign_mismatch" };
}

// ---------------------------------------------------------------------------
// 集計用ヘルパー
// ---------------------------------------------------------------------------

export interface TransactionRowLike {
  amount: number;
}

/** 取引一覧から残高を再計算する (denormalized cache 検証用 / unit test 用)。 */
export function reduceTransactionsToBalance(
  rows: ReadonlyArray<TransactionRowLike>,
): number {
  let total = 0;
  for (const r of rows) {
    if (Number.isInteger(r.amount)) total += r.amount;
  }
  return total;
}
