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
import confetti from "canvas-confetti";
import { SparklesIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { triggerConfetti, isMotionReduced } from "@/lib/study/confetti";
import { playFeedback } from "@/lib/study/audio-feedback";
import { playSoundEffect } from "@/lib/audio/sound-effects";
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
    // DEC-088 Plan B 項目 2: Howler エンジンでも進化音を並列再生
    void playSoundEffect("levelup");

    // DEC-087 §11: 多色 4 色 burst (Amber Gold + Sky Blue + Lavender + Mint Green)
    // canvas-confetti 既存 dep / prefers-reduced-motion 時は skip
    if (!isMotionReduced() && typeof window !== "undefined") {
      try {
        const result = confetti({
          particleCount: 140,
          spread: 100,
          startVelocity: 42,
          gravity: 0.65,
          scalar: 1.0,
          ticks: 260,
          origin: { x: 0.5, y: 0.55 },
          colors: [
            "#F2A93A", // Amber Gold
            "#FFD27A",
            "#4FB6E5", // Sky Blue
            "#B8A4E0", // Lavender
            "#6FCF8E", // Mint Green
            "#FFFFFF",
          ],
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
    }

    // DEC-087 §11: 4 秒後に自動 dismiss (タップ即 dismiss は既存 onClick={onClose})
    if (typeof window !== "undefined") {
      const t = window.setTimeout(() => {
        onClose?.();
      }, 4000);
      return () => window.clearTimeout(t);
    }
  }, [open, toStage, onClose]);

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

  // DEC-087 §11: フルスクリーン take-over + backdrop-blur + キラキラ particle
  // (既存 props / data-testid / onClose / onContinue API は完全保持)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="evolution-title"
      data-testid="evolution-celebration-modal"
      data-from-stage={fromStage}
      data-to-stage={toStage}
      data-motion-reduced={motionReduced ? "true" : "false"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
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

      {/* DEC-087 §11: キラキラ particle (8 個 / rotate + scale で拡散) */}
      {!motionReduced && (
        <div
          aria-hidden="true"
          data-testid="evolution-sparkle-particles"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="absolute h-2 w-2 rounded-full"
              style={{
                background: [
                  "#F2A93A",
                  "#4FB6E5",
                  "#B8A4E0",
                  "#6FCF8E",
                  "#FFD27A",
                  "#FFFFFF",
                  "#F2A93A",
                  "#B8A4E0",
                ][i],
                transform: `rotate(${i * 45}deg) translateY(-140px)`,
                animation: `evolution-sparkle 2.4s ease-out ${i * 0.08}s infinite`,
                opacity: 0.85,
              }}
            />
          ))}
        </div>
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
            className="font-display text-2xl font-bold text-primary"
          >
            しんかしたよ！
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
              expression="happy"
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
          <p className="font-display text-xl font-bold text-primary">
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
        /* DEC-087 §11: キラキラ particle 拡散 */
        @keyframes evolution-sparkle {
          0% {
            opacity: 0;
            transform: rotate(var(--r, 0deg)) translateY(0) scale(0.4);
          }
          30% {
            opacity: 0.95;
          }
          100% {
            opacity: 0;
            transform: rotate(var(--r, 0deg)) translateY(-180px) scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
