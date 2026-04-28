"use client";

/**
 * HANEI - 学習者 自己選択日次ゴール 切替 (W8-T5 / settings)
 *
 * 4 段階 (10 / 20 / 30 / 50 XP) を radio 風の button group で選ぶ。
 * 内部で server action `updateDailyGoal` を呼び永続化する。
 *
 * 認可:
 *   server action 側 (requireAuth + requireLearnerOwner) で家族外アクセスを完全防御。
 *   このコンポーネントは UI 表示と楽観更新のみ。
 *
 * 設計原則:
 *   - 絵文字禁止
 *   - 「ですます調 / 小学生にも読める」マイクロコピー
 *   - tap target ≥ 44px / aria-pressed で SR 対応
 */

import { useState, useTransition } from "react";
import { FlagIcon } from "@heroicons/react/24/outline";
import {
  DAILY_GOAL_CHOICES,
  isValidDailyGoalXp,
  type DailyGoalXp,
} from "@/lib/study/daily-goal";
import { updateDailyGoal } from "@/lib/actions/learner-preferences";

interface Props {
  learnerId: string;
  initialDailyGoalXp: DailyGoalXp;
}

export function DailyGoalToggle({ learnerId, initialDailyGoalXp }: Props) {
  const [current, setCurrent] = useState<DailyGoalXp>(initialDailyGoalXp);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (xp: number) => {
    if (!isValidDailyGoalXp(xp)) return;
    if (xp === current) return;
    const prev = current;
    setCurrent(xp);
    setError(null);
    startTransition(async () => {
      try {
        await updateDailyGoal(learnerId, xp);
      } catch (e) {
        setCurrent(prev);
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  };

  return (
    <section
      data-testid="daily-goal-toggle"
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <FlagIcon className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">きょうの ゴール</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        1日の めあて です。あとから かえる ことが できます。
      </p>

      <div role="radiogroup" aria-label="日次ゴール XP の選択" className="grid gap-2 sm:grid-cols-2">
        {DAILY_GOAL_CHOICES.map((choice) => {
          const selected = choice.xp === current;
          return (
            <button
              key={choice.xp}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`daily-goal-toggle-${choice.xp}`}
              onClick={() => handleSelect(choice.xp)}
              disabled={isPending}
              className={[
                "min-h-tap-cta flex flex-col items-start rounded-md border-2 p-3 text-left transition-all",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/50",
                "disabled:cursor-not-allowed disabled:opacity-60",
              ].join(" ")}
            >
              <span className="text-sm font-bold">
                {choice.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {choice.xp} XP / 約 {choice.estimatedMinutes} 分
                </span>
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                {choice.description}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
