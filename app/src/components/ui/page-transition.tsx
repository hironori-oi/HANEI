"use client";

/**
 * HANEI - DEC-087 Plan A: ページ遷移 stagger fade-up (項目 10)
 *
 * 子要素を 50ms 間隔で flow-in (translateY 12px → 0 + opacity 0 → 1) させるラッパ。
 *
 * 使用方法:
 *   <PageTransition>
 *     <Card>...</Card>
 *     <Card>...</Card>
 *   </PageTransition>
 *
 * 制約:
 *  - WCAG 2.1 AA: prefers-reduced-motion: reduce 時は即時表示 (initial=animate=visible)
 *  - Server Component を children に渡しても透過 (motion.div 自体は client / 子は transparent)
 *  - data-testid 等の既存セレクタは触らないため、E2E ハッピーパスを破壊しない
 */

import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import {
  Children,
  isValidElement,
  type ReactNode,
} from "react";

interface PageTransitionProps {
  children: ReactNode;
  /** 個々の child 間の出現遅延 (default 50ms / DEC-087 §10) */
  staggerMs?: number;
  /** 親 wrapper のクラス */
  className?: string;
}

export function PageTransition({
  children,
  staggerMs = 50,
  className,
}: PageTransitionProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <PageTransitionInner staggerMs={staggerMs} className={className}>
        {children}
      </PageTransitionInner>
    </LazyMotion>
  );
}

function PageTransitionInner({
  children,
  staggerMs,
  className,
}: Required<Omit<PageTransitionProps, "className">> & { className?: string }) {
  const reduce = useReducedMotion();
  const items = Children.toArray(children).filter((c) => isValidElement(c) || typeof c === "string");

  if (reduce) {
    // WCAG fallback: 即時表示 (アニメ無効)
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: staggerMs / 1000 },
        },
      }}
    >
      {items.map((child, idx) => (
        <m.div
          key={idx}
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { type: "spring", stiffness: 110, damping: 18 },
            },
          }}
        >
          {child}
        </m.div>
      ))}
    </m.div>
  );
}
