"use client";

/**
 * HANEI - DEC-087 Plan A + DEC-088 Plan B: Study 画面の正解 / 不正解 演出
 *
 * 1. 正解時:
 *    - 学習者の現在の進化段階に応じた kotodama-tori SVG を画面右下から spring bounce 登場
 *    - 表情は "happy" (にこにこ) に切替
 *    - 拍手 (rotate 微小揺れ) + 連続正解 3+ で多色 confetti を発射
 *    - 罰則ゼロ哲学: 「できた」喜びのみ / 罰語ゼロ
 *
 * 2. 不正解時:
 *    - キャラが「うーん」首を傾ける (rotate -8deg / 8deg / 0 / 1 cycle)
 *    - 表情は "thinking" (考え中) に切替
 *    - **赤色未使用** (Amber Gold soft / 中立)
 *    - 「もう一度考えてみよう」の文言は呼出側で表示 / 本コンポーネントは演出のみ
 *
 * 親コンポーネント (StudyClient) は <AnswerFeedbackEffects key={...} variant="correct"|"wrong" comboCount=N stage="hina" />
 * を feedback 表示の都度マウントし、unmount で次回はクリーン状態にする (key 駆動)。
 *
 * - prefers-reduced-motion: reduce 時はキャラ表示なし (no entrance)
 * - confetti は既存 lib/study/confetti を流用 (依存追加なし)
 * - SVG は学習者の進化段階 (KotodamaStage) に応じて 5 種から自動選択 (Plan B / DEC-088 §1)
 */

import * as React from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { isMotionReduced } from "@/lib/study/confetti";
import { KotodamaHinaSvg } from "@/components/character/kotodama-stages/hina";
import { KotodamaWakatoriSvg } from "@/components/character/kotodama-stages/wakatori";
import { KotodamaSeityoSvg } from "@/components/character/kotodama-stages/seityo";
import { KotodamaKenzyaSvg } from "@/components/character/kotodama-stages/kenzya";
import { KotodamaSyugosinSvg } from "@/components/character/kotodama-stages/syugosin";
import type { KotodamaStage } from "@/lib/study/kotodama-tori-stage";
import type {
  KotodamaExpression,
  KotodamaStageSvgProps,
} from "@/components/character/kotodama-stages/colors";

interface Props {
  variant: "correct" | "wrong";
  /** 連続正解数 (3+ で多色 confetti / Plan A の §5 連続 3+ 多色 confetti) */
  comboCount?: number;
  /**
   * 現在の進化段階 (Plan B / DEC-088 §1).
   * 未指定時は "hina" (後方互換).
   */
  stage?: KotodamaStage;
}

/**
 * Plan A 罰則ゼロカラー: Amber Gold + Sky Blue + Lavender + Mint Green
 * (赤系を 1 色も含めない / DEC-024)
 */
const PLAN_A_CONFETTI_COLORS = [
  "#F2A93A", // Amber Gold
  "#FFD27A", // Amber light
  "#4FB6E5", // Sky Blue (--accent-coach)
  "#B8A4E0", // Lavender (--accent-badge)
  "#6FCF8E", // Mint Green (--accent-correct)
  "#FFFFFF",
];

const STAGE_COMPONENTS: Record<
  KotodamaStage,
  (props: KotodamaStageSvgProps) => React.JSX.Element
> = {
  hina: KotodamaHinaSvg,
  wakatori: KotodamaWakatoriSvg,
  seityo: KotodamaSeityoSvg,
  kenzya: KotodamaKenzyaSvg,
  syugosin: KotodamaSyugosinSvg,
};

export function AnswerFeedbackEffects(props: Props) {
  return (
    <LazyMotion features={domAnimation} strict>
      <AnswerFeedbackEffectsInner {...props} />
    </LazyMotion>
  );
}

function AnswerFeedbackEffectsInner({
  variant,
  comboCount = 0,
  stage = "hina",
}: Props) {
  const reduce = useReducedMotion();

  // 連続正解 3+ で多色 confetti を 1 度だけ発射
  React.useEffect(() => {
    if (variant !== "correct") return;
    if (comboCount < 3) return;
    if (isMotionReduced()) return;
    if (typeof window === "undefined") return;

    try {
      // DEC-090 項目 1: confetti を軽量化 (particleCount 90→70 / ticks 220→140)
      // - CPU contention を減らし、router.refresh() RSC fetch 並走時のフレーム落ちを抑制
      // - 視覚的祝福感は維持 (粒数 70 でも十分華やか / 罰則ゼロ哲学変わらず)
      const result = confetti({
        particleCount: 70,
        spread: 80,
        startVelocity: 38,
        gravity: 0.75,
        scalar: 0.95,
        ticks: 140,
        origin: { x: 0.5, y: 0.7 },
        colors: PLAN_A_CONFETTI_COLORS,
      }) as unknown;
      if (
        result &&
        typeof (result as { then?: unknown }).then === "function"
      ) {
        void (result as Promise<unknown>);
      }
    } catch {
      // silent: 描画失敗は UX を壊さない
    }
  }, [variant, comboCount]);

  // 設計: prefers-reduced-motion 環境では「演出キャラ」自体を出さない (静的 UI のみで通る)
  if (reduce) return null;

  const Svg = STAGE_COMPONENTS[stage] ?? KotodamaHinaSvg;
  const expression: KotodamaExpression =
    variant === "correct" ? "happy" : "thinking";

  if (variant === "correct") {
    return (
      <m.div
        data-testid="answer-correct-effect"
        data-stage={stage}
        data-expression={expression}
        aria-hidden="true"
        className="pointer-events-none fixed bottom-4 right-4 z-40"
        initial={{ y: 80, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        // DEC-090 項目 1: spring を一段だけ硬くする (stiffness 220→320 / damping 16→17)
        // 体感登場時間 ~280ms → ~170ms / 「サクサク」感を出しつつ bounce は維持
        transition={{ type: "spring", stiffness: 320, damping: 17 }}
      >
        <m.div
          // 拍手の rotate 微小揺れ (DEC-090 項目 1: 0.9s → 0.5s に短縮 / cleanup 早期化)
          animate={{ rotate: [0, -6, 6, -3, 3, 0] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Svg
            size={84}
            label="ことだまトリ せいかい おめでとう"
            expression={expression}
          />
        </m.div>
      </m.div>
    );
  }

  // wrong: キャラが「うーん」首をかしげる (rotate のみ / 罰則ゼロ)
  return (
    <m.div
      data-testid="answer-wrong-effect"
      data-stage={stage}
      data-expression={expression}
      aria-hidden="true"
      className="pointer-events-none fixed bottom-4 right-4 z-40"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      // DEC-090 項目 1: spring 一段硬く (stiffness 200→300 / damping 18→18)
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
    >
      <m.div
        // DEC-090 項目 1: 0.9s → 0.5s に短縮
        animate={{ rotate: [0, -8, 8, 0] }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Svg
          size={72}
          label="ことだまトリ いっしょに かんがえる"
          expression={expression}
        />
      </m.div>
    </m.div>
  );
}
