"use client";

/**
 * HANEI - ことだまトリ 進化セレブレーション modal (W9-T1)
 *
 * 進化トリガー時 (hina -> wakatori, ... syugosin) にフルスクリーン modal で
 * 2.5 秒のアニメ演出を行う。
 *
 * 演出フロー:
 *   ① 古い stage が薄れる (300ms)
 *   ② 桜吹雪 + 光柱 (500ms)
 *   ③ 新 stage が現れる + 名前テキスト fade-in (700ms)
 *   ④ 「○○ に なりました」+ ご褒美テキスト (1000ms)
 *
 * 設計:
 *  - 60fps: CSS transform / opacity のみ (Tailwind の motion-safe + CSS keyframes)
 *  - prefers-reduced-motion: 全アニメスキップ → 静止画 + 名前のみ表示
 *  - W8 confetti を流用 (light / medium / heavy)
 *  - audio-feedback で level-up 音を発火
 *  - 絵文字禁止 / Heroicons + inline JSX SVG
 */

import { useEffect } from "react";
import { SparklesIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { triggerConfetti, isMotionReduced } from "@/lib/study/confetti";
import { playFeedback } from "@/lib/study/audio-feedback";
import {
  describeKotodamaStage,
  getKotodamaStageLabel,
  type KotodamaStage,
} from "@/lib/study/kotodama-tori-stage";
import { KotodamaHinaSvg } from "./kotodama-stages/hina";
import { KotodamaWakatoriSvg } from "./kotodama-stages/wakatori";
import { KotodamaSeityoSvg } from "./kotodama-stages/seityo";
import { KotodamaKenzyaSvg } from "./kotodama-stages/kenzya";
import { KotodamaSyugosinSvg } from "./kotodama-stages/syugosin";
import type { KotodamaStageSvgProps } from "./kotodama-stages/colors";

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
  open: boolean;
  /** 進化前 stage (薄れて消える) */
  fromStage: KotodamaStage;
  /** 進化先 stage (新たに現れる) */
  toStage: KotodamaStage;
  onContinue: () => void;
  onClose?: () => void;
}

function pickConfettiIntensity(stage: KotodamaStage): "light" | "medium" | "heavy" {
  // 守護神 = heavy / 賢者・成鳥 = medium / 若鳥 = light
  if (stage === "syugosin") return "heavy";
  if (stage === "kenzya" || stage === "seityo") return "medium";
  return "light";
}

const REWARD_MESSAGE: Record<KotodamaStage, string> = {
  hina: "あたらしい たびの はじまりです。",
  wakatori:
    "りりしい わかどりに なりました。あなたの まなびが みのっています。",
  seityo:
    "せいちょうの すがたに なりました。つばさを ひろげて とびましょう。",
  kenzya:
    "ちせいの まなざしを そなえた けんじゃに なりました。",
  syugosin:
    "さくらの しんれいに なりました。きんいろの ひかりが あなたを まもります。",
};

export function EvolutionCelebrationModal(props: Props) {
  const { open, fromStage, toStage, onContinue, onClose } = props;

  useEffect(() => {
    if (!open) return;
    void triggerConfetti(pickConfettiIntensity(toStage));
    void playFeedback("level-up");
  }, [open, toStage]);

  if (!open) return null;

  const motionReduced = isMotionReduced();

  const FromSvg = STAGE_COMPONENTS[fromStage];
  const ToSvg = STAGE_COMPONENTS[toStage];

  // ToInfo を組み立て (進化判定用 dummy input ではなく label を直接取得)
  const toLabel = getKotodamaStageLabel(toStage);
  // toStage の furigana は describeKotodamaStage を使用するため input が必要
  // 進化条件最低値で safe に作る
  const toInfo = describeKotodamaStage({
    totalXp:
      toStage === "syugosin"
        ? 5000
        : toStage === "kenzya"
          ? 1500
          : toStage === "seityo"
            ? 500
            : toStage === "wakatori"
              ? 100
              : 0,
    currentStreak: 0,
    badgeCount: 0,
    badgeCodes: toStage === "syugosin" ? ["sakura_keeper"] : [],
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="evolution-title"
      data-testid="evolution-celebration-modal"
      data-from-stage={fromStage}
      data-to-stage={toStage}
      data-motion-reduced={motionReduced ? "true" : "false"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
      onClick={onClose}
    >
      {/* 光柱 (motion 非削減時のみ) — CSS keyframe で透明度上昇 */}
      {!motionReduced && (
        <div
          aria-hidden="true"
          data-testid="evolution-light-beam"
          className="pointer-events-none absolute inset-0 motion-safe:animate-pulse"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(242, 169, 58, 0.45) 0%, rgba(255, 183, 197, 0.25) 35%, transparent 70%)",
          }}
        />
      )}

      <div
        className="relative w-full max-w-lg rounded-2xl border-2 border-primary/40 bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <SparklesIcon
            className="h-7 w-7 text-primary motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <h2
            id="evolution-title"
            className="text-2xl font-bold text-primary"
          >
            しんか！
          </h2>
        </div>

        <div className="my-4 flex items-center justify-center gap-3">
          {/* 旧 stage (薄れて消える) */}
          {!motionReduced ? (
            <div
              data-testid="evolution-from-svg"
              className="motion-safe:animate-evolution-fade-out"
              style={{
                opacity: 0,
                animation: motionReduced
                  ? undefined
                  : "evolution-fade-out 300ms ease-out forwards",
              }}
            >
              <FromSvg size={120} progress={1} label={getKotodamaStageLabel(fromStage)} />
            </div>
          ) : (
            <div data-testid="evolution-from-static" aria-hidden="true">
              <FromSvg size={80} progress={1} label={getKotodamaStageLabel(fromStage)} />
            </div>
          )}

          <ArrowRightIcon
            className="h-6 w-6 text-primary"
            aria-hidden="true"
          />

          {/* 新 stage */}
          <div
            data-testid="evolution-to-svg"
            style={{
              animation: motionReduced
                ? undefined
                : "evolution-fade-in 700ms ease-out 800ms backwards",
            }}
          >
            <ToSvg
              size={160}
              progress={1}
              label={toInfo.label}
              animate={!motionReduced}
            />
          </div>
        </div>

        <div
          className="mb-2 text-center"
          style={{
            animation: motionReduced
              ? undefined
              : "evolution-fade-in 1000ms ease-out 1500ms backwards",
          }}
        >
          <p className="text-lg font-bold text-primary">
            <ruby>
              {toInfo.furigana}
              <rt>{toLabel}</rt>
            </ruby>{" "}
            に なりました
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {REWARD_MESSAGE[toStage]}
          </p>
        </div>

        <Button
          onClick={onContinue}
          size="lg"
          className="mt-4 min-h-tap-cta w-full"
          data-testid="evolution-continue"
        >
          すすむ
          <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* CSS keyframes (component-local / Tailwind v4 の @keyframes 直接記述代替) */}
      <style>{`
        @keyframes evolution-fade-out {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.85); }
        }
        @keyframes evolution-fade-in {
          0% { opacity: 0; transform: scale(0.85) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
