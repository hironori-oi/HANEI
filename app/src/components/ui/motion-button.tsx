"use client";

/**
 * HANEI - DEC-087 Plan A: ボタン micro-interactions (項目 9)
 *
 * 既存 `Button` (`button.tsx`) を破壊せずに hover / tap の spring を足す薄い wrapper。
 * `whileHover={{ scale: 1.03 }}` / `whileTap={{ scale: 0.97 }}` を spring back する。
 *
 * 既存 button.tsx の variant / size / asChild を全て継承するため、外側に inline-flex の
 * motion.div wrapper を 1 段挟み、内部の <Button> はそのまま forward する。E2E selector
 * (data-testid 等) も props として透過するので影響しない。
 *
 * WCAG: prefers-reduced-motion: reduce 時は scale をかけず (no-op) Tailwind の
 * `motion-reduce:transform-none` で多重防御。
 */

import * as React from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { Button, type ButtonProps } from "./button";

export interface MotionButtonProps extends ButtonProps {
  /** hover scale (default 1.03) */
  whileHoverScale?: number;
  /** tap scale (default 0.97) */
  whileTapScale?: number;
  /** wrapper の className (button 自体の className とは別軸) */
  wrapperClassName?: string;
}

export const MotionButton = React.forwardRef<
  HTMLButtonElement,
  MotionButtonProps
>(function MotionButton(props, ref) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionButtonInner {...props} forwardedRef={ref} />
    </LazyMotion>
  );
});

function MotionButtonInner({
  whileHoverScale = 1.03,
  whileTapScale = 0.97,
  wrapperClassName,
  forwardedRef,
  className,
  ...buttonProps
}: MotionButtonProps & {
  forwardedRef: React.ForwardedRef<HTMLButtonElement>;
}) {
  const reduce = useReducedMotion();
  const hover = reduce ? undefined : { scale: whileHoverScale };
  const tap = reduce ? undefined : { scale: whileTapScale };

  return (
    <m.div
      whileHover={hover}
      whileTap={tap}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      style={{ display: "inline-flex" }}
      className={
        wrapperClassName
          ? `motion-reduce:transform-none ${wrapperClassName}`
          : "motion-reduce:transform-none"
      }
    >
      <Button ref={forwardedRef} className={className} {...buttonProps} />
    </m.div>
  );
}
