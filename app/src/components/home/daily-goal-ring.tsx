/**
 * HANEI - 今日のゴール プログレスリング (W8-T5 / /home)
 *
 * SVG circle stroke-dasharray でプログレスリングを描画する純表示コンポーネント。
 * Server Component から直接埋め込み可能 (state 持たない)。
 *
 * 達成 (achieved=true) 時:
 *   - リング色を success / amber gold アクセントに切替
 *   - 「きょうのゴール 達成！」マイクロコピー
 *   - aria-live="polite" でスクリーンリーダ通知
 *   - confetti 発動は別 client component (LessonCompleteModal 等) が担う。
 *     ここは静的な「達成済み」状態の表示のみ。
 *
 * 設計原則:
 *   - 絵文字禁止: Heroicons (CheckCircleIcon / FlagIcon) のみ
 *   - prefers-reduced-motion: SVG transition は CSS transform animation を使わない
 */

import { CheckCircleIcon, FlagIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { describeDailyGoal, type DailyProgress } from "@/lib/study/daily-goal";

interface Props {
  progress: DailyProgress;
  className?: string;
}

const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function DailyGoalRing({ progress, className }: Props) {
  const { goalXp, earnedXp, remainingXp, ratio, achieved } = progress;
  const choice = describeDailyGoal(goalXp);
  const dashOffset = RING_CIRCUMFERENCE * (1 - ratio);
  const pct = Math.round(ratio * 100);

  return (
    <Card
      data-testid="daily-goal-ring"
      data-achieved={achieved ? "true" : "false"}
      className={cn(achieved ? "border-success/60 bg-success/5" : undefined, className)}
    >
      <CardHeader>
        <FlagIcon
          className={cn(
            "mb-2 h-8 w-8",
            achieved ? "text-success" : "text-primary",
          )}
          aria-hidden="true"
        />
        <CardTitle className="text-base">きょうの ゴール</CardTitle>
        <CardDescription>
          {choice.label} ({goalXp} XP / 約 {choice.estimatedMinutes} 分)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <svg
            viewBox="0 0 100 100"
            className="h-24 w-24 shrink-0 -rotate-90"
            role="img"
            aria-label={`今日のゴール 進捗 ${pct} パーセント`}
          >
            <title>{`今日のゴール ${earnedXp} / ${goalXp} XP`}</title>
            {/* 背景リング */}
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/40"
            />
            {/* 進捗リング */}
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              className={cn(
                "motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500",
                achieved ? "text-success" : "text-primary",
              )}
            />
          </svg>

          <div className="flex-1 space-y-1" aria-live="polite">
            {achieved ? (
              <>
                <p className="flex items-center gap-1 text-base font-bold text-success">
                  <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
                  きょうの ゴール 達成！
                </p>
                <p className="text-xs text-muted-foreground">
                  {earnedXp} XP かくとく ({pct}%)
                </p>
                <p className="text-xs text-muted-foreground">
                  ここからは ボーナス。むりせず つづけましょう。
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {earnedXp} <span className="text-sm font-normal text-muted-foreground">/ {goalXp} XP</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  あと {remainingXp} XP で きょうの ゴール！
                </p>
                <p className="text-xs text-muted-foreground">{pct}%</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
