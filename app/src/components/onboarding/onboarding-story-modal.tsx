"use client";

/**
 * HANEI - DEC-088 Plan B (項目 4): Onboarding ストーリー モーダル
 *
 * 初回 /home 訪問時に 1 度だけ表示される 3 ページストーリー.
 *  - Page 1: 「ようこそ！」+ Hero (hina) + 「ぼく、ことだまトリ。一緒に英語の旅に出よう！」
 *  - Page 2: 「進化のしくみ」+ 5 進化段階 SVG 横並び + 「学べば学ぶほど、ぼくが大きくなるよ」
 *  - Page 3: 「準備できた？」+ 「学習をはじめる」CTA → close + flag set
 *
 * 制御:
 *  - 表示判定は呼出側 (home page or 専用 wrapper) が isOnboardingShown() で事前評価.
 *  - 本コンポーネントは「mount したら必ず表示」する presentational. close で markOnboardingShown.
 *  - スキップ可能: 右上 ×ボタン / Escape キー.
 *
 * 罰則ゼロ哲学 (DEC-024):
 *  - 文言は「楽しく学ぼう」中立トーン / プレッシャー語ゼロ.
 *
 * WCAG 2.1 AA:
 *  - role="dialog" + aria-modal="true" + aria-labelledby
 *  - prefers-reduced-motion: reduce 時は stagger を 0 で表示 (即座出現)
 *  - Tab フォーカス制御: 簡易実装で「次へ」/「閉じる」/ CTA に Tab 移動可能
 */

import * as React from "react";
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { XMarkIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { KotodamaHinaSvg } from "@/components/character/kotodama-stages/hina";
import { KotodamaWakatoriSvg } from "@/components/character/kotodama-stages/wakatori";
import { KotodamaSeityoSvg } from "@/components/character/kotodama-stages/seityo";
import { KotodamaKenzyaSvg } from "@/components/character/kotodama-stages/kenzya";
import { KotodamaSyugosinSvg } from "@/components/character/kotodama-stages/syugosin";
import { markOnboardingShown } from "@/lib/onboarding/storage";

interface Props {
  /** モーダル close ハンドラ (親が unmount を制御する場合に通知) */
  onClose?: () => void;
  /** 学習者ニックネーム (Page 1 文言で利用 / 任意) */
  learnerNickname?: string;
}

const TOTAL_PAGES = 3;

export function OnboardingStoryModal(props: Props) {
  return (
    <LazyMotion features={domAnimation} strict>
      <OnboardingStoryModalInner {...props} />
    </LazyMotion>
  );
}

function OnboardingStoryModalInner({ onClose, learnerNickname }: Props) {
  const reduce = useReducedMotion();
  const [page, setPage] = React.useState<number>(0);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);

  const dismiss = React.useCallback(() => {
    markOnboardingShown();
    onClose?.();
  }, [onClose]);

  // Escape キーで close
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dismiss]);

  // 初回 mount 時に閉じるボタンへ focus を寄せる (a11y)
  React.useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const handleNext = () => {
    if (page < TOTAL_PAGES - 1) {
      setPage((p) => p + 1);
    } else {
      dismiss();
    }
  };

  const handleSkip = () => {
    dismiss();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-story-title"
      data-testid="onboarding-story-modal"
      data-page={page}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
    >
      <m.div
        initial={reduce ? false : { opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 22 }
        }
        className="relative w-full max-w-lg rounded-2xl border-2 border-primary/30 bg-card p-6 shadow-2xl"
      >
        {/* 閉じるボタン (右上) */}
        <button
          ref={closeRef}
          type="button"
          aria-label="閉じる"
          data-testid="onboarding-close"
          onClick={handleSkip}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
        </button>

        <AnimatePresence mode="wait">
          {page === 0 && (
            <PageWrapper key="page-0" reduce={reduce ?? false}>
              <h2
                id="onboarding-story-title"
                className="font-display text-2xl font-bold text-primary"
              >
                ようこそ！
              </h2>
              <div className="my-4 flex items-center justify-center">
                <KotodamaHinaSvg size={140} label="ことだまトリ ひな" />
              </div>
              <p className="text-center text-base leading-relaxed text-foreground">
                {learnerNickname ? `${learnerNickname} さん、` : ""}
                ぼく、ことだまトリ。
                <br />
                いっしょに 英語の たびに でようね！
              </p>
            </PageWrapper>
          )}

          {page === 1 && (
            <PageWrapper key="page-1" reduce={reduce ?? false}>
              <h2 className="font-display text-2xl font-bold text-primary">
                しんかの しくみ
              </h2>
              <div className="my-4 flex flex-wrap items-end justify-center gap-2">
                <KotodamaHinaSvg size={64} label="ひな" />
                <KotodamaWakatoriSvg size={68} label="わかとり" />
                <KotodamaSeityoSvg size={72} label="せいちょう" />
                <KotodamaKenzyaSvg size={72} label="けんじゃ" />
                <KotodamaSyugosinSvg size={72} label="しゅごしん" />
              </div>
              <p className="text-center text-base leading-relaxed text-foreground">
                まなべば まなぶほど、ぼくが 大きく なるよ。
                <br />
                5 だんかいの しんかを たのしもう。
              </p>
            </PageWrapper>
          )}

          {page === 2 && (
            <PageWrapper key="page-2" reduce={reduce ?? false}>
              <h2 className="font-display text-2xl font-bold text-primary">
                じゅんびは できた？
              </h2>
              <div className="my-4 flex items-center justify-center">
                <KotodamaWakatoriSvg
                  size={140}
                  label="ことだまトリ わかとり"
                />
              </div>
              <p className="text-center text-base leading-relaxed text-foreground">
                まずは すきなところから はじめよう。
                <br />
                きょうも たのしく まなぼうね。
              </p>
              <div className="mt-5 flex justify-center">
                <Button
                  type="button"
                  size="lg"
                  className="min-h-tap-cta"
                  data-testid="onboarding-start-cta"
                  onClick={handleNext}
                >
                  がくしゅうを はじめる
                  <ArrowRightIcon
                    className="ml-2 h-4 w-4"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </PageWrapper>
          )}
        </AnimatePresence>

        {/* footer: ページインジケータ + 次へ ボタン (page 0/1 のみ) */}
        <div className="mt-4 flex items-center justify-between">
          <div
            className="flex items-center gap-1.5"
            aria-label={`ページ ${page + 1} / ${TOTAL_PAGES}`}
          >
            {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={
                  i === page
                    ? "h-2 w-6 rounded-full bg-primary transition-all"
                    : "h-2 w-2 rounded-full bg-muted-foreground/30 transition-all"
                }
              />
            ))}
          </div>
          {page < TOTAL_PAGES - 1 ? (
            <Button
              type="button"
              size="default"
              variant="outline"
              data-testid="onboarding-next"
              onClick={handleNext}
            >
              つぎへ
              <ArrowRightIcon
                className="ml-2 h-4 w-4"
                aria-hidden="true"
              />
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </m.div>
    </div>
  );
}

/** ページ切替時の stagger fade-up wrapper. */
function PageWrapper({
  children,
  reduce,
}: {
  children: React.ReactNode;
  reduce: boolean;
}) {
  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -12 }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className="space-y-2"
    >
      {children}
    </m.div>
  );
}
