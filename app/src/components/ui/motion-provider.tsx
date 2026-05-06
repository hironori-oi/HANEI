"use client";

/**
 * HANEI - DEC-087 Plan A: framer-motion 共通 LazyMotion provider
 *
 * 目的:
 *  - framer-motion 12.x の LazyMotion + domAnimation で初期バンドルを最小化する
 *    (`motion.*` の全機能ではなく、basic animation のみ load する)
 *  - WCAG 2.1 AA: `useReducedMotion()` を意識する個別コンポーネント側で fallback
 *  - 子コンポーネントは <m.div> を使う (motion.* ではなく m.* を強制 / strict mode)
 *
 * Note:
 *  - 本 provider はクライアント境界。Server Component から子経由で Server Component
 *    を渡すのは framer-motion 制約上問題なし (LazyMotion は children を transparent に渡す)。
 */

import { LazyMotion, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function MotionProvider({ children }: Props) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
