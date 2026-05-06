"use client";

/**
 * HANEI - DEC-087 Plan A: Home Hero に登場する大型ことだまトリ (項目 4)
 *
 * /home の上部 Hero エリアに、現在の進化段階に応じた kotodama-tori SVG を
 * 画面下部から spring で登場させる。吹き出し「今日もがんばろう！」を Mochiy Pop One。
 * クリックで bounce 反応 (whileTap scale 0.95 + 微小 rotate)。
 *
 * - 既存 `KotodamaStageDisplay` の SVG を再利用 (5 進化段階を props で受ける)
 * - 既存 home page.tsx の data-testid="kotodama-stage-display" 等は触らない
 *   (新規追加 / 既存 Card は維持)
 * - prefers-reduced-motion: reduce 時は静止 SVG fallback (no entrance animation, no bounce)
 *
 * WCAG:
 *  - aria-label / role="button" は KotodamaTouchable に付与
 *  - キーボード Enter/Space で同じ bounce 起動 (tabindex=0)
 *  - 罰則ゼロ哲学: 吹き出しテキストは「責める」「叱る」一切なし
 */

import * as React from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import {
  describeKotodamaStage,
  type KotodamaStage,
  type KotodamaStageInput,
} from "@/lib/study/kotodama-tori-stage";
import { KotodamaHinaSvg } from "@/components/character/kotodama-stages/hina";
import { KotodamaWakatoriSvg } from "@/components/character/kotodama-stages/wakatori";
import { KotodamaSeityoSvg } from "@/components/character/kotodama-stages/seityo";
import { KotodamaKenzyaSvg } from "@/components/character/kotodama-stages/kenzya";
import { KotodamaSyugosinSvg } from "@/components/character/kotodama-stages/syugosin";
import type { KotodamaStageSvgProps } from "@/components/character/kotodama-stages/colors";

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

interface Props {
  /** 進化判定入力 (現 stage / progressToNext を内部で算出) */
  input: KotodamaStageInput;
  /** 学習者ニックネーム (吹き出し文言で利用) */
  learnerNickname: string;
  /** SVG サイズ (default 140) */
  svgSize?: number;
}

export function HeroKotodamaTori({
  input,
  learnerNickname,
  svgSize = 140,
}: Props) {
  return (
    <LazyMotion features={domAnimation} strict>
      <HeroInner
        input={input}
        learnerNickname={learnerNickname}
        svgSize={svgSize}
      />
    </LazyMotion>
  );
}

function HeroInner({ input, learnerNickname, svgSize }: Required<Props>) {
  const info = describeKotodamaStage(input);
  const Svg = STAGE_COMPONENTS[info.stage];
  const reduce = useReducedMotion();
  const [bounceKey, setBounceKey] = React.useState(0);

  // クリック / Enter / Space で「ぽよん」と一瞬反応する。
  // bounceKey を更新して whileTap が消えても変化を検知できるよう state 駆動で再アニメ。
  const triggerBounce = () => {
    setBounceKey((k) => k + 1);
  };

  return (
    <section
      aria-label="ことだまトリ ヒーロー"
      data-testid="hero-kotodama-tori"
      data-stage={info.stage}
      className="relative isolate flex flex-col items-center justify-center gap-3 py-2 sm:flex-row sm:items-end sm:gap-6"
    >
      {/* 吹き出し */}
      <m.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.45, duration: 0.5 }}
        className="relative max-w-[18rem] rounded-2xl border border-primary/30 bg-card px-4 py-3 text-center shadow-sm sm:max-w-xs sm:text-left"
      >
        <p className="font-display text-base leading-relaxed text-foreground sm:text-lg">
          {learnerNickname} さん、きょうも がんばろう！
        </p>
        {/* 吹き出しの「しっぽ」(三角) */}
        <span
          aria-hidden="true"
          className="absolute -bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-primary/30 bg-card sm:-right-1.5 sm:bottom-3 sm:left-auto sm:translate-x-0"
        />
      </m.div>

      {/* キャラ本体: 画面下から spring で登場 + click で bounce */}
      <m.button
        type="button"
        aria-label={`ことだまトリ ${info.label} を なでる`}
        onClick={triggerBounce}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerBounce();
          }
        }}
        className="rounded-full bg-transparent p-1 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        initial={reduce ? false : { y: 64, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 120, damping: 12, delay: 0.05 }
        }
        whileTap={reduce ? undefined : { scale: 0.95, rotate: -2 }}
        // bounceKey で再アニメをトリガするための key
        key={`tap-${bounceKey}`}
      >
        <m.div
          // ぽよん (1 回限り) を bounceKey 変化で再生
          animate={
            reduce
              ? undefined
              : {
                  scale: [1, 1.06, 0.98, 1],
                  rotate: [0, 1.5, -1.5, 0],
                }
          }
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <Svg
            size={svgSize}
            progress={info.progressToNext}
            label={`ことだまトリ ${info.label}`}
            expression="idle"
          />
        </m.div>
      </m.button>
    </section>
  );
}
