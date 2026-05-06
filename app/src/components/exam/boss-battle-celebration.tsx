"use client";

/**
 * HANEI - DEC-089 Plan C 項目 2: ボス戦演出 (模試結果モーダル)
 *
 * 模試 (mock exam) 結果表示時に「ことだまトリと挑む試練」中立コピーで
 * フルスクリーン take-over するセレブレーション modal.
 *
 * 設計 (DEC-024 罰則ゼロ厳守):
 *  - 合格 (pass=true): 多色 confetti + ことだまトリ "happy" + 「やり抜いたね！」中立労い
 *  - 不合格 (pass=false): confetti なし / 「次にむけて 作戦を たてよう」**罰則ゼロ** copy
 *    赤色 / 叱責語 / 涙 / 怒り / 鎖 / バツ印 0
 *  - prefers-reduced-motion: reduce → アニメ skip / 静止表示
 *  - audio_enabled / playSoundEffect 既存パターン流用
 *  - 既存模試 UI ページ (parent 側) には wire しない: standalone reusable component として
 *    将来 learner 側模試結果ページから import 可能にする (DEC-006 page 数 +1 ガード回避).
 *
 * API (既存 evolution-celebration.tsx と同等の dialog modal pattern):
 *   <BossBattleCelebrationModal
 *     open
 *     pass={true}
 *     score={42}
 *     maxScore={50}
 *     levelLabel="英検 3 級"
 *     onContinue={...}
 *     onClose={...}
 *   />
 */

import { useEffect } from "react";
import confetti from "canvas-confetti";
import {
  ShieldCheckIcon,
  SparklesIcon,
  ArrowRightIcon,
  MapIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { triggerConfetti, isMotionReduced } from "@/lib/study/confetti";
import { playFeedback } from "@/lib/study/audio-feedback";
import { playSoundEffect } from "@/lib/audio/sound-effects";
import { KotodamaSeityoSvg } from "@/components/character/kotodama-stages/seityo";

interface Props {
  open: boolean;
  /** 合格判定 (true: pass / false: 再挑戦) */
  pass: boolean;
  /** 取得スコア (0..maxScore). 表示専用. */
  score: number;
  /** 満点 */
  maxScore: number;
  /** 表示用の試練名 ("英検 3 級" 等) */
  levelLabel: string;
  /** 「次のステップに すすむ」CTA ハンドラ (合格時: 結果ページ / 不合格時: もう一度) */
  onContinue: () => void;
  /** 背景クリック / 自動 dismiss ハンドラ */
  onClose?: () => void;
  /** test override (E2E で confetti を強制 disable する用). 通常は省略. */
  disableConfettiForTest?: boolean;
}

/** 中立コピー (DEC-024 罰則ゼロ): 失敗 / だめ / 残念 等の語は不採用. */
const PASS_TITLE = "やり抜いたね！";
const PASS_SUBTITLE = "ことだまトリと いっしょに しれんを こえました。";
const RETRY_TITLE = "ここまで よく がんばったね";
const RETRY_SUBTITLE = "つぎに むけて さくせんを たてよう。";

export function BossBattleCelebrationModal(props: Props) {
  const {
    open,
    pass,
    score,
    maxScore,
    levelLabel,
    onContinue,
    onClose,
    disableConfettiForTest,
  } = props;

  useEffect(() => {
    if (!open) return;
    if (pass) {
      // 合格: medium intensity confetti + complete sound (positive)
      void triggerConfetti("medium");
      void playFeedback("level-up");
      void playSoundEffect("complete");

      // DEC-087 §11 多色 4 色 burst (Amber Gold + Sky Blue + Lavender + Mint Green)
      if (
        !disableConfettiForTest &&
        !isMotionReduced() &&
        typeof window !== "undefined"
      ) {
        try {
          const result = confetti({
            particleCount: 120,
            spread: 90,
            startVelocity: 38,
            gravity: 0.65,
            scalar: 1.0,
            ticks: 240,
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
    } else {
      // 不合格: confetti なし / 罰則ゼロ tone の中立 sound のみ
      // playSoundEffect("complete") は positive すぎるため、軽い "tap" でやさしい音
      void playSoundEffect("tap");
    }

    // 自動 dismiss なし: ユーザー操作で onContinue / onClose を明示する.
  }, [open, pass, disableConfettiForTest]);

  if (!open) return null;

  const motionReduced = isMotionReduced();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="boss-battle-title"
      aria-describedby="boss-battle-subtitle"
      data-testid="boss-battle-celebration-modal"
      data-pass={pass ? "true" : "false"}
      data-level-label={levelLabel}
      data-motion-reduced={motionReduced ? "true" : "false"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      {/* 合格時のみ 光柱 + キラキラ particle (motion 非削減時) */}
      {pass && !motionReduced && (
        <div
          aria-hidden="true"
          data-testid="boss-battle-light-beam"
          className="pointer-events-none absolute inset-0 motion-safe:animate-pulse"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(242, 169, 58, 0.35) 0%, rgba(111, 207, 142, 0.18) 35%, transparent 70%)",
          }}
        />
      )}

      {pass && !motionReduced && (
        <div
          aria-hidden="true"
          data-testid="boss-battle-sparkle-particles"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          {Array.from({ length: 6 }).map((_, i) => (
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
                ][i],
                transform: `rotate(${i * 60}deg) translateY(-130px)`,
                animation: `boss-battle-sparkle 2.4s ease-out ${i * 0.1}s infinite`,
                opacity: 0.85,
              }}
            />
          ))}
        </div>
      )}

      <div
        className="relative w-full max-w-lg rounded-2xl border-2 bg-card p-6 shadow-2xl"
        // 合格 = primary border / 不合格 = neutral muted-foreground border (赤未使用)
        style={{
          borderColor: pass
            ? "rgba(242, 169, 58, 0.55)"
            : "rgba(120, 120, 120, 0.30)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          {pass ? (
            <ShieldCheckIcon
              className="h-7 w-7 text-primary motion-safe:animate-pulse"
              aria-hidden="true"
            />
          ) : (
            <AcademicCapIcon
              className="h-7 w-7 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <h2
            id="boss-battle-title"
            className={
              pass
                ? "font-display text-2xl font-bold text-primary"
                : "font-display text-2xl font-bold text-muted-foreground"
            }
          >
            {pass ? PASS_TITLE : RETRY_TITLE}
          </h2>
        </div>

        <p className="mb-2 text-sm text-muted-foreground">
          ことだまトリと挑む試練
          <span className="ml-2 text-xs">{levelLabel}</span>
        </p>

        <div className="my-4 flex items-center justify-center gap-3">
          <div
            data-testid="boss-battle-character"
            style={{
              animation: motionReduced
                ? undefined
                : pass
                  ? "boss-battle-fade-in 700ms ease-out 100ms backwards"
                  : "boss-battle-fade-in 500ms ease-out 100ms backwards",
            }}
          >
            <KotodamaSeityoSvg
              size={140}
              progress={1}
              label="ことだまトリ"
              animate={!motionReduced}
              expression={pass ? "happy" : "thinking"}
            />
          </div>
        </div>

        <div
          id="boss-battle-subtitle"
          className="mb-2 text-center"
          style={{
            animation: motionReduced
              ? undefined
              : "boss-battle-fade-in 800ms ease-out 700ms backwards",
          }}
        >
          {pass ? (
            <p className="font-display text-xl font-bold text-primary">
              <SparklesIcon
                className="mr-1 inline-block h-5 w-5 align-text-bottom text-primary"
                aria-hidden="true"
              />
              {PASS_SUBTITLE}
            </p>
          ) : (
            <p className="font-display text-lg font-bold text-muted-foreground">
              {RETRY_SUBTITLE}
            </p>
          )}

          <p
            className="mt-3 text-sm leading-relaxed text-muted-foreground"
            data-testid="boss-battle-score"
          >
            <span className="font-bold tabular-nums">
              {score} / {maxScore}
            </span>{" "}
            <span className="ml-1">てん</span>
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={onContinue}
            size="lg"
            className="min-h-tap-cta w-full"
            data-testid="boss-battle-continue"
          >
            {pass ? (
              <>
                つぎの ぼうけんへ
                <MapIcon className="ml-2 h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                さくせんを たてる
                <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
          {onClose && (
            <Button
              onClick={onClose}
              size="lg"
              variant="outline"
              className="min-h-tap-cta w-full"
              data-testid="boss-battle-close"
            >
              とじる
            </Button>
          )}
        </div>
      </div>

      {/* CSS keyframes (component-local) */}
      <style>{`
        @keyframes boss-battle-fade-in {
          0% { opacity: 0; transform: scale(0.85) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes boss-battle-sparkle {
          0% {
            opacity: 0;
            transform: rotate(var(--r, 0deg)) translateY(0) scale(0.4);
          }
          30% {
            opacity: 0.95;
          }
          100% {
            opacity: 0;
            transform: rotate(var(--r, 0deg)) translateY(-170px) scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
