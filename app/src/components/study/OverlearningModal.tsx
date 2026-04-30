"use client";

/**
 * OverlearningModal - 過学習防止 modal (W10-T5)
 *
 * 2 つの variant:
 *   - "nudge" (30 分到達): 穏やかな promise.「もうすこしで 30 ぷん。きょうは ここで きゅうけい しよう」
 *     - 「おやすみ する」 (主推奨 / /home へ) と「もうすこし やる」 (副推奨 / 続行) の 2 択
 *     - 1 度 dismiss されると同 session 内では再表示しない (StudyClient で one-shot 制御)
 *     - 背景クリックでは閉じない (DEC-024 / 罰則ゼロでもなお「能動的に選んだ」体験を担保)
 *   - "hard_limit" (60 分到達): 強制終了.「きょうは じゅうぶん。あした また あおうね」
 *     - 「ホームへ もどる」のみ (= 続行不可)
 *     - 背景クリック / Esc では閉じない
 *     - DEC-024 / streak は守られる (本 modal は streak を減算しない)
 *
 * デザインガイド:
 *   - K-1: タップ領域 56px (min-h-tap-cta)
 *   - K-2: ふりがな寄せ + 数字半角 + 否定形なし
 *   - aria-modal / aria-labelledby
 *   - role="dialog"
 */

import { ClockIcon, HomeIcon, PlayCircleIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";

export type OverlearningModalVariant = "nudge" | "hard_limit";

interface Props {
  open: boolean;
  variant: OverlearningModalVariant;
  /** 当日累計分数 (本 modal の本文に表示) */
  todayMinutes: number;
  /** 「おやすみ する」 (= /home へ) コールバック */
  onRest: () => void;
  /** nudge 時のみ使われる「もうすこし やる」 (= modal を閉じて続行) */
  onContinueStudy?: () => void;
}

export function OverlearningModal(props: Props) {
  const { open, variant, todayMinutes, onRest, onContinueStudy } = props;
  if (!open) return null;

  const isHardLimit = variant === "hard_limit";

  const headline = isHardLimit
    ? "きょうは じゅうぶん"
    : "もうすこしで 30 ぷん";
  const body = isHardLimit
    ? `きょうは ${todayMinutes} ふん がんばったね。あした また あおうね。`
    : `きょう ${todayMinutes} ふん がんばったよ。きゅうけいすると あたまが すっきりするよ。`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlearning-modal-title"
      data-testid="overlearning-modal"
      data-variant={variant}
      data-today-minutes={todayMinutes}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={(e) => {
        // どちらの variant でも背景クリックでは閉じない (DEC-024 / 能動的選択を担保)
        e.stopPropagation();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          {isHardLimit ? (
            <SparklesIcon
              className="h-7 w-7 text-primary motion-safe:animate-pulse"
              aria-hidden="true"
            />
          ) : (
            <ClockIcon
              className="h-7 w-7 text-primary motion-safe:animate-pulse"
              aria-hidden="true"
            />
          )}
          <h2
            id="overlearning-modal-title"
            className="text-2xl font-bold text-primary"
          >
            {headline}
          </h2>
        </div>

        <p className="mb-4 text-base leading-relaxed text-foreground">{body}</p>

        {isHardLimit ? (
          <Button
            onClick={onRest}
            size="lg"
            className="min-h-tap-cta w-full"
            data-testid="overlearning-rest-cta"
            aria-label="ホームへ もどる"
          >
            <HomeIcon className="mr-1 h-5 w-5" aria-hidden="true" />
            ホームへ もどる
          </Button>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={onContinueStudy}
              size="lg"
              variant="outline"
              className="min-h-tap-cta"
              data-testid="overlearning-continue-cta"
              aria-label="もうすこし やる"
            >
              <PlayCircleIcon className="mr-1 h-5 w-5" aria-hidden="true" />
              もうすこし やる
            </Button>
            <Button
              onClick={onRest}
              size="lg"
              className="min-h-tap-cta"
              data-testid="overlearning-rest-cta"
              aria-label="おやすみ する"
            >
              <HomeIcon className="mr-1 h-5 w-5" aria-hidden="true" />
              おやすみ する
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
