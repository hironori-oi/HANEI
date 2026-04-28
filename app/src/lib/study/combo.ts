/**
 * HANEI - Combo (連続正解) ロジック (W8-T2)
 *
 * 「連続正解」を 1 セッション内で追跡し、3 / 5 / 10 連続で XP 倍率を発動する。
 * 倍率発動はサーバ側で計算する (cheating 不可)。クライアントは見た目演出のみ。
 *
 * 関連:
 *  - src/lib/actions/study.ts: submitAnswer 内で XP 計算に使用
 *  - src/components/study/combo-counter.tsx: 右上 fixed UI
 *  - src/lib/study/streak.ts: computeRunningStreak (DB ベース) と連動可能
 */

/** combo 倍率 tier (0=未発動, 1/2/3 = 1.5x/2x/3x) */
export type ComboTier = 0 | 1 | 2 | 3;

export const COMBO_THRESHOLD_TIER1 = 3; // 1.5x
export const COMBO_THRESHOLD_TIER2 = 5; // 2x
export const COMBO_THRESHOLD_TIER3 = 10; // 3x

export interface ComboResult {
  multiplier: number;
  tier: ComboTier;
}

/**
 * combo カウントから tier + multiplier を決定する。
 *
 * - 0..2 -> 0 倍率 1.0x
 * - 3..4 -> tier 1, 1.5x
 * - 5..9 -> tier 2, 2.0x
 * - 10+  -> tier 3, 3.0x
 *
 * 負数は 0 として扱う (防御的)。
 */
export function calculateComboMultiplier(comboCount: number): ComboResult {
  const c = Number.isFinite(comboCount) && comboCount > 0 ? comboCount : 0;
  if (c >= COMBO_THRESHOLD_TIER3) return { multiplier: 3.0, tier: 3 };
  if (c >= COMBO_THRESHOLD_TIER2) return { multiplier: 2.0, tier: 2 };
  if (c >= COMBO_THRESHOLD_TIER1) return { multiplier: 1.5, tier: 1 };
  return { multiplier: 1.0, tier: 0 };
}

/**
 * 1 解答後の combo を更新する純関数。
 *
 * - correct=true -> previous + 1
 * - correct=false -> 0 (リセット)
 *
 * 学習セッション終了時にもクライアント側で 0 リセットすることを推奨。
 */
export function nextComboCount(
  previous: number,
  correct: boolean,
): number {
  if (!correct) return 0;
  const base = Number.isFinite(previous) && previous > 0 ? previous : 0;
  return base + 1;
}

/**
 * XP 計算 + combo 適用。
 * baseXp に倍率をかけ、Math.round で整数化して返す。
 *
 * 例: baseXp=10, combo=3 -> tier 1 -> 1.5x -> 15
 *     baseXp=10, combo=5 -> tier 2 -> 2x -> 20
 *     baseXp=10, combo=10 -> tier 3 -> 3x -> 30
 *     baseXp=1 (不正解), combo=0 -> 1.0x -> 1
 */
export function applyComboToXp(
  baseXp: number,
  comboCount: number,
): { xp: number; multiplier: number; tier: ComboTier } {
  const safeBase = Number.isFinite(baseXp) && baseXp > 0 ? baseXp : 0;
  const { multiplier, tier } = calculateComboMultiplier(comboCount);
  return {
    xp: Math.round(safeBase * multiplier),
    multiplier,
    tier,
  };
}

/**
 * combo tier が「いま発動した瞬間か」を判定する (UI でアニメ起動などに使用)。
 *
 * 例: previousCount=2, newCount=3 -> tier が 0 -> 1 に上がった瞬間 = true
 */
export function isComboTierUpgrade(
  previousCount: number,
  newCount: number,
): boolean {
  const prev = calculateComboMultiplier(previousCount).tier;
  const next = calculateComboMultiplier(newCount).tier;
  return next > prev;
}
