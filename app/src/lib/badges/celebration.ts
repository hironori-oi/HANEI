/**
 * HANEI - Badge Celebration logic (W9-T3 演出ロジック)
 *
 * 純関数のみ。Tier から celebration の各パラメータを決定する。
 * UI (badge-celebration-modal.tsx) はここから値を受け取り、
 * CSS / canvas-confetti / Reduced-Motion を組み合わせて演出する。
 */

import {
  BADGE_TIER_RANK,
  BADGE_TIER_TO_CONFETTI,
  type BadgeTier,
} from "./badge-codes";

export interface CelebrationPlan {
  tier: BadgeTier;
  /** Confetti 強度 (W8 confetti と同じ enum) */
  confettiIntensity: "light" | "medium" | "heavy";
  /** ピーク時の scale (1.0 = 等倍) */
  peakScale: number;
  /** 演出全体の長さ (ms) */
  durationMs: number;
  /** 輝きエフェクトの種類 */
  glowKind: "amber" | "silver" | "rays" | "petals_and_rays";
  /** 桜吹雪を併発するか */
  sakuraPetals: boolean;
  /** Tier 別 ring color (Tailwind 色 or HSL) */
  ringColorClass: string;
}

/** Tier から完全な演出プランを返す純関数 (W9-T3 演出仕様の単一 source-of-truth) */
export function getCelebrationPlan(tier: BadgeTier): CelebrationPlan {
  const rank = BADGE_TIER_RANK[tier];
  const confettiIntensity = BADGE_TIER_TO_CONFETTI[tier];

  switch (tier) {
    case "bronze":
      return {
        tier,
        confettiIntensity,
        peakScale: 1.15,
        durationMs: 2400,
        glowKind: "amber",
        sakuraPetals: false,
        ringColorClass: "ring-amber-400/50",
      };
    case "silver":
      return {
        tier,
        confettiIntensity,
        peakScale: 1.18,
        durationMs: 2700,
        glowKind: "silver",
        sakuraPetals: false,
        ringColorClass: "ring-zinc-300/60",
      };
    case "gold":
      return {
        tier,
        confettiIntensity,
        peakScale: 1.2,
        durationMs: 3000,
        glowKind: "rays",
        sakuraPetals: false,
        ringColorClass: "ring-amber-400/70",
      };
    case "platinum":
      return {
        tier,
        confettiIntensity,
        peakScale: 1.22,
        durationMs: 3300,
        glowKind: "petals_and_rays",
        sakuraPetals: true,
        ringColorClass: "ring-pink-300/70",
      };
    default: {
      // 網羅性チェック
      const _exhaustive: never = tier;
      void _exhaustive;
      // 防御: rank-based fallback (実行されないはず)
      void rank;
      return {
        tier: "bronze",
        confettiIntensity: "light",
        peakScale: 1.15,
        durationMs: 2400,
        glowKind: "amber",
        sakuraPetals: false,
        ringColorClass: "ring-amber-400/50",
      };
    }
  }
}

/**
 * prefers-reduced-motion 時の plan へ変換する純関数。
 * - peakScale = 1.0 (静止)
 * - durationMs はテキスト fade-in 最小限の 800ms に圧縮
 * - confetti / 桜吹雪 / ring glow は呼び出し側で抑制 (本関数は plan を返すだけ)
 */
export function reduceMotionPlan(plan: CelebrationPlan): CelebrationPlan {
  return {
    ...plan,
    peakScale: 1.0,
    durationMs: 800,
    sakuraPetals: false,
  };
}
