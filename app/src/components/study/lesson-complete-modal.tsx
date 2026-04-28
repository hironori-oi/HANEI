"use client";

/**
 * HANEI - レッスン完了 modal (W8-T4)
 *
 * トリガー: 5 問以上連続正解後の終了 / レッスンクリア時
 * 演出:
 *   - kotodama-tori celebration mood
 *   - canvas-confetti (intensity=medium / heavy は連続正解 10 以上で)
 *   - prefers-reduced-motion 環境では gradient overlay にフォールバック (CSS のみ)
 *   - audio-feedback 連動 (playFeedback("level-up"))
 *
 * 設計原則 (CLAUDE.md):
 *   - 絵文字禁止 (Heroicons + マイクロコピーのみ)
 *   - AI 感を出さない: シンプルな日本語マイクロコピー
 */

import { useEffect } from "react";
import { SparklesIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { triggerConfetti, isMotionReduced } from "@/lib/study/confetti";
import { playFeedback } from "@/lib/study/audio-feedback";

interface Props {
  open: boolean;
  /** 連続正解数 (intensity 決定に使う) */
  streak: number;
  /** 獲得 XP 累積 */
  earnedXp?: number;
  onContinue: () => void;
  onClose?: () => void;
}

function pickIntensity(streak: number): "light" | "medium" | "heavy" {
  if (streak >= 10) return "heavy";
  if (streak >= 5) return "medium";
  return "light";
}

export function LessonCompleteModal(props: Props) {
  const { open, streak, earnedXp, onContinue, onClose } = props;

  useEffect(() => {
    if (!open) return;
    // 並列で confetti と level-up 音を発動 (両方とも settings で無効化される可能性あり)
    void triggerConfetti(pickIntensity(streak));
    void playFeedback("level-up");
  }, [open, streak]);

  if (!open) return null;

  const motionReduced = isMotionReduced();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-complete-title"
      data-testid="lesson-complete-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      {/* prefers-reduced-motion 時の代替: 静的 gradient overlay */}
      {motionReduced && (
        <div
          aria-hidden="true"
          data-testid="lesson-complete-static-overlay"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15"
        />
      )}

      <div
        className="relative w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <SparklesIcon
            className="h-7 w-7 text-primary motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <h2
            id="lesson-complete-title"
            className="text-2xl font-bold text-primary"
          >
            レッスン クリア
          </h2>
        </div>

        <p className="mb-1 text-sm leading-relaxed text-foreground">
          {streak >= 10
            ? `すごい！ ${streak} 問れんぞくせいかいだよ。ことだまトリも びっくり。`
            : streak >= 5
              ? `${streak} 問れんぞくせいかい！ いいちょうしだね。`
              : "きょうも がんばったね。ことだまトリも うれしそう。"}
        </p>

        {typeof earnedXp === "number" && earnedXp > 0 && (
          <p className="mb-4 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
            <SparklesIcon className="h-4 w-4" aria-hidden="true" />+{earnedXp}{" "}
            XP かくとく
          </p>
        )}

        <Button
          onClick={onContinue}
          size="lg"
          className="min-h-tap-cta w-full"
          data-testid="lesson-complete-continue"
        >
          つぎへすすむ
          <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
