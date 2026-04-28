"use client";

/**
 * ComboCounter (W8-T2)
 *
 * 学習画面の右上に固定表示する連続正解カウンター。
 * combo 3/5/10 で倍率発動 + tier 別の色 + 数字が踊る animation。
 *
 * 設計原則:
 *  - Heroicons BoltIcon を使用 (絵文字禁止)
 *  - prefers-reduced-motion 対応 (CSS @media で animation を無効化)
 *  - サーバ側で multiplier を計算する (このコンポーネントは表示のみ)
 *
 * 表示条件:
 *  - tier === 0 / count < 3 -> 非表示
 *  - tier >= 1 -> 右上に固定表示
 */

import { BoltIcon } from "@heroicons/react/24/solid";

import {
  calculateComboMultiplier,
  type ComboTier,
} from "@/lib/study/combo";
import { cn } from "@/lib/utils";

export interface ComboCounterProps {
  /** 現在の連続正解数 */
  comboCount: number;
  /** tier 上昇を検知した場合 true (animation 起動用) */
  justUpgraded?: boolean;
  className?: string;
}

const TIER_STYLE: Record<ComboTier, { container: string; icon: string }> = {
  0: { container: "", icon: "" },
  1: {
    container: "border-accent/40 bg-accent/10 text-accent-foreground",
    icon: "text-accent",
  },
  2: {
    container: "border-primary/50 bg-primary/15 text-primary-foreground",
    icon: "text-primary",
  },
  3: {
    container:
      "border-success/60 bg-gradient-to-br from-success/20 to-primary/20 text-success-foreground",
    icon: "text-success",
  },
};

export function ComboCounter(props: ComboCounterProps) {
  const { comboCount, justUpgraded = false, className } = props;
  const { multiplier, tier } = calculateComboMultiplier(comboCount);

  if (tier === 0) return null;

  const style = TIER_STYLE[tier];

  return (
    <div
      data-testid="combo-counter"
      data-combo-tier={tier}
      data-combo-count={comboCount}
      aria-live="polite"
      aria-label={`コンボ ${comboCount} 連続正解 / XP ${multiplier} 倍`}
      className={cn(
        "fixed right-4 top-20 z-40 flex items-center gap-2 rounded-full border-2 px-3 py-2 shadow-md backdrop-blur-sm",
        style.container,
        // tier 上昇時のみ pulse animation を起動 (prefers-reduced-motion で自動オフ)
        justUpgraded ? "hanei-combo-pulse" : "",
        className,
      )}
    >
      <BoltIcon className={cn("h-5 w-5", style.icon)} aria-hidden="true" />
      <div className="flex items-baseline gap-1">
        <span
          data-testid="combo-count-value"
          className="text-lg font-bold tabular-nums"
        >
          {comboCount}
        </span>
        <span className="text-xs font-semibold">コンボ</span>
      </div>
      <span
        data-testid="combo-multiplier"
        className="ml-1 inline-flex items-center rounded-full bg-card/60 px-2 py-0.5 text-xs font-bold tabular-nums"
      >
        {multiplier.toFixed(1)}x
      </span>
    </div>
  );
}
