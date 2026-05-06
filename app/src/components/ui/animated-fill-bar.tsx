"use client";

/**
 * HANEI - DEC-087 Plan A: XP / コインバー smooth fill (項目 8)
 *
 * 数値の前回値 → 現在値の差分を spring physics で fill する汎用バー。
 * - 増加時: overshoot 5% + settle (わずかに飛び越えて柔らかく着地)
 * - 減少時: 同じ spring で柔らかく短くなる (罰則ゼロ哲学: 減少も叱責のない描写)
 * - prefers-reduced-motion: reduce 時は瞬時遷移 (no animation)
 *
 * `prevValue` は ref で保持するので、props には現在値 (value / max) のみ渡せばよい。
 */

import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AnimatedFillBarProps {
  /** 現在値 */
  value: number;
  /** 最大値 (% 計算用) */
  max: number;
  /** track のクラス (背景) */
  className?: string;
  /** fill 部分の追加クラス (色など) */
  fillClassName?: string;
  /** ARIA ラベル */
  ariaLabel?: string;
  /** test id */
  testId?: string;
}

export function AnimatedFillBar(props: AnimatedFillBarProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatedFillBarInner {...props} />
    </LazyMotion>
  );
}

function AnimatedFillBarInner({
  value,
  max,
  className,
  fillClassName,
  ariaLabel,
  testId,
}: AnimatedFillBarProps) {
  const reduce = useReducedMotion();
  const safeMax = Math.max(1, max);
  const currentPct = Math.min(100, Math.max(0, (value / safeMax) * 100));

  // framer-motion の `animate` は前回 prop からの遷移を内部で管理してくれるため、
  // initial を {width: 0} で 1 度だけ取り、以後は animate 値の変化に追従させる。
  // (前回値 ref を render 中に読むのは react-hooks/refs 違反のため避ける)
  return (
    <div
      data-testid={testId}
      role="progressbar"
      aria-label={ariaLabel ?? "進捗バー"}
      aria-valuenow={Math.round(currentPct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <m.div
        initial={{ width: "0%" }}
        animate={{ width: `${currentPct}%` }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                type: "spring",
                stiffness: 80,
                damping: 15,
                // 5% overshoot 風: damping 低めの spring で自然に oscillation
              }
        }
        className={cn(
          "h-full rounded-full bg-primary",
          fillClassName,
        )}
      />
    </div>
  );
}
