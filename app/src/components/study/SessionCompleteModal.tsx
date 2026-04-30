"use client";

/**
 * SessionCompleteModal - 学習セッション完了 (W10-T4)
 *
 * トリガー条件 (StudyClient で判定):
 *  - 自然完了: planSize 問解き終わった瞬間
 *  - 手動終了: 「ここまでにする」ボタン押下
 *  - overtime 提案: 経過時間 > duration * 1.5 で「もうすこしだけ」モーダル
 *
 * 演出:
 *  - kotodama-tori celebration mood
 *  - confetti (intensity = accuracy / problemsAnswered で決定)
 *  - 「もんだい N 問」「せいかい M 問」「ハネキン +K」表示
 *  - Daily Quest 進捗連動は親 state ではなく onContinue 時に router.push("/home") で再取得
 *
 * DEC-024 罰則ゼロ哲学整合:
 *  - 0 問でも「がんばってね」ではなく「きょうも すこしだけ きてくれて ありがとう」
 *  - 不正解 0 でも責めない (おしい / でも 1 つ 学べたね 等)
 *  - 強制終了は **しない**
 */

import { useEffect } from "react";
import {
  SparklesIcon,
  ArrowRightIcon,
  HomeIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { triggerConfetti, isMotionReduced } from "@/lib/study/confetti";
import { playFeedback } from "@/lib/study/audio-feedback";

import type {
  SessionDurationMinutes,
  SessionOutcomeSummary,
} from "@/lib/study/session-composer";

interface Props {
  open: boolean;
  durationMinutes: SessionDurationMinutes;
  /** 純粋演算結果 (problemsAnswered / accuracyPercent / earnedCoins) */
  summary: SessionOutcomeSummary;
  /** "natural" = planSize に到達 / "abort" = ここまでボタン / "overtime" = +50% 経過提案 */
  reason: "natural" | "abort" | "overtime";
  onContinue: () => void;
  onClose?: () => void;
  /** overtime 時に「もうすこしだけ」を選んだ場合の継続コールバック (reason === "overtime" のみ使用) */
  onContinueStudy?: () => void;
}

function pickIntensity(
  reason: Props["reason"],
  summary: SessionOutcomeSummary,
): "light" | "medium" | "heavy" {
  if (reason === "overtime") return "light";
  if (summary.accuracyPercent >= 80 && summary.problemsAnswered >= 8)
    return "heavy";
  if (summary.problemsAnswered >= 5) return "medium";
  return "light";
}

function pickHeadline(
  reason: Props["reason"],
  summary: SessionOutcomeSummary,
): string {
  if (reason === "overtime") return "もうすこしだけ できる？";
  if (summary.problemsAnswered === 0)
    return "きょうも きてくれて ありがとう";
  if (summary.accuracyPercent >= 80) return "とてもよく がんばったね";
  if (summary.accuracyPercent >= 50) return "おつかれさま、よく できたね";
  return "きょうも 1 つ ふえたね";
}

function pickSubtext(
  reason: Props["reason"],
  summary: SessionOutcomeSummary,
): string {
  if (reason === "overtime")
    return "じかんが ながくなってきたよ。もうすこし やる？ それとも おしまいにする？";
  if (summary.problemsAnswered === 0)
    return "また あした、いっしょに やろうね。";
  return "ことだまトリも うれしそうに してるよ。";
}

export function SessionCompleteModal(props: Props) {
  const {
    open,
    durationMinutes,
    summary,
    reason,
    onContinue,
    onClose,
    onContinueStudy,
  } = props;

  useEffect(() => {
    if (!open) return;
    // overtime は祝福不要 (offer のみ) → confetti / sound は省略
    if (reason !== "overtime") {
      void triggerConfetti(pickIntensity(reason, summary));
      void playFeedback("level-up");
    }
  }, [open, reason, summary]);

  if (!open) return null;

  const motionReduced = isMotionReduced();
  const headline = pickHeadline(reason, summary);
  const subtext = pickSubtext(reason, summary);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-complete-title"
      data-testid="session-complete-modal"
      data-reason={reason}
      data-duration={durationMinutes}
      data-problems-answered={summary.problemsAnswered}
      data-correct={summary.correctCount}
      data-accuracy={summary.accuracyPercent}
      data-earned-coins={summary.earnedCoins}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      {motionReduced && (
        <div
          aria-hidden="true"
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
            id="session-complete-title"
            className="text-2xl font-bold text-primary"
          >
            {reason === "overtime" ? "もうすこし？" : "セッション かんりょう"}
          </h2>
        </div>

        <p className="mb-2 text-base font-semibold text-foreground">
          {headline}
        </p>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          {subtext}
        </p>

        {reason !== "overtime" ? (
          <dl
            className="mb-4 grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-3 text-center text-sm"
            data-testid="session-summary-grid"
          >
            <div>
              <dt className="text-xs text-muted-foreground">もんだい</dt>
              <dd className="text-lg font-bold tabular-nums">
                {summary.problemsAnswered}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">せいかい</dt>
              <dd className="text-lg font-bold tabular-nums">
                {summary.correctCount}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({summary.accuracyPercent}%)
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">ハネキン</dt>
              <dd className="inline-flex items-center justify-center gap-1 text-lg font-bold tabular-nums text-primary">
                <StarIcon className="h-4 w-4" aria-hidden="true" />+
                {summary.earnedCoins}
              </dd>
            </div>
          </dl>
        ) : null}

        {reason === "overtime" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={onContinueStudy ?? onContinue}
              size="lg"
              variant="outline"
              className="min-h-tap-cta"
              data-testid="session-overtime-continue"
            >
              もうすこし やる
            </Button>
            <Button
              onClick={onContinue}
              size="lg"
              className="min-h-tap-cta"
              data-testid="session-overtime-stop"
            >
              <HomeIcon className="mr-1 h-4 w-4" aria-hidden="true" />
              おしまいに する
            </Button>
          </div>
        ) : (
          <Button
            onClick={onContinue}
            size="lg"
            className="min-h-tap-cta w-full"
            data-testid="session-complete-continue"
          >
            ホームへ もどる
            <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
