"use client";

/**
 * HANEI - Badge Celebration Modal (W9-C)
 *
 * 新規バッジ取得時の演出 modal。
 *  - tier 別 confetti 強度 / glow / 桜吹雪 (platinum)
 *  - prefers-reduced-motion → 静的 gradient + scale=1
 *  - aria-live="assertive" でスクリーンリーダ通知
 *  - audio-feedback "level-up" 再生
 *
 * 設計原則:
 *  - 絵文字禁止 / Heroicons + inline SVG
 *  - ESC / 背景タップで閉じる
 *  - 連続して複数バッジが解放された場合は呼び出し側で順次表示する想定 (本 modal は 1 件専用)
 */

import { useEffect } from "react";
import { SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { triggerConfetti, isMotionReduced } from "@/lib/study/confetti";
import { playFeedback } from "@/lib/study/audio-feedback";
import { type BadgeCode } from "@/lib/badges/badge-codes";
import { BADGE_BY_CODE } from "@/lib/badges/catalog";
import {
  getCelebrationPlan,
  reduceMotionPlan,
} from "@/lib/badges/celebration";
import { BADGE_ICON_BY_CODE, FirstFlightBadgeIcon } from "./icons";

interface Props {
  open: boolean;
  code: BadgeCode | null;
  onClose: () => void;
}

export function BadgeCelebrationModal({ open, code, onClose }: Props) {
  useEffect(() => {
    if (!open || !code) return;
    const meta = BADGE_BY_CODE[code];
    if (!meta) return;
    const motionReduced = isMotionReduced();
    const plan = motionReduced
      ? reduceMotionPlan(getCelebrationPlan(meta.tier))
      : getCelebrationPlan(meta.tier);
    if (!motionReduced) {
      void triggerConfetti(plan.confettiIntensity);
    }
    void playFeedback("level-up");
  }, [open, code]);

  // ESC でクローズ
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !code) return null;
  const meta = BADGE_BY_CODE[code];
  if (!meta) return null;
  const Icon = BADGE_ICON_BY_CODE[code] ?? FirstFlightBadgeIcon;
  const motionReduced = isMotionReduced();
  const plan = motionReduced
    ? reduceMotionPlan(getCelebrationPlan(meta.tier))
    : getCelebrationPlan(meta.tier);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-celebration-title"
      aria-live="assertive"
      data-testid="badge-celebration-modal"
      data-tier={meta.tier}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      {/* prefers-reduced-motion 時の静的 gradient overlay */}
      {motionReduced && (
        <div
          aria-hidden="true"
          data-testid="badge-celebration-static-overlay"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20"
        />
      )}

      <div
        className={`relative w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl ${plan.ringColorClass} ring-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="とじる"
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="mb-2 flex items-center gap-2">
          <SparklesIcon
            className="h-7 w-7 text-primary motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <h2
            id="badge-celebration-title"
            className="text-2xl font-bold text-primary"
          >
            バッジ かくとく
          </h2>
        </div>

        <div className="my-4 flex flex-col items-center gap-3">
          <div
            className="motion-safe:animate-[badge-pop_0.7s_ease-out]"
            style={{
              transform: motionReduced
                ? "scale(1)"
                : `scale(${plan.peakScale})`,
              transition: motionReduced ? "none" : "transform 600ms ease-out",
            }}
          >
            <Icon size={144} earned={true} label={`${meta.name} バッジ`} />
          </div>
          <p className="text-xl font-bold text-foreground">{meta.name}</p>
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            {meta.earnedHeadline}
          </p>
        </div>

        <Button
          onClick={onClose}
          size="lg"
          className="min-h-tap-cta w-full"
          data-testid="badge-celebration-continue"
        >
          つづける
        </Button>
      </div>

      {/* keyframe (Tailwind utilities では補足できないバウンス) */}
      <style>{`@keyframes badge-pop {
        0%   { transform: scale(0.4); opacity: 0; }
        60%  { transform: scale(${plan.peakScale + 0.05}); opacity: 1; }
        100% { transform: scale(${plan.peakScale}); opacity: 1; }
      }`}</style>
    </div>
  );
}
