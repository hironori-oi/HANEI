/**
 * HANEI - 自己選択日次ゴール ラジオセレクタ (W8-T5 / onboarding)
 *
 * 4 段階の日次ゴール XP (10 / 20 / 30 / 50) を radio で選ばせる。
 * Server Component から直接埋め込み可能 (form action と組み合わせる)。
 *
 * 設計原則:
 *   - 絵文字禁止
 *   - 「ですます調 / 小学生にも読める」マイクロコピー
 *   - キーボード操作対応 (radio だけで完結)
 *   - tap target ≥ 44px
 */

import { DAILY_GOAL_CHOICES } from "@/lib/study/daily-goal";

interface Props {
  /** 選択中の値 (XP)。未指定なら default の 20。 */
  defaultValue?: number;
  /** form の name (デフォルト "daily_goal_xp") */
  name?: string;
}

export function DailyGoalSelector({
  defaultValue = 20,
  name = "daily_goal_xp",
}: Props) {
  return (
    <fieldset
      className="space-y-2 rounded-md border border-border p-3"
      data-testid="daily-goal-selector"
    >
      <legend className="px-1 text-sm font-semibold">
        1日の がんばり目標
      </legend>
      <p className="px-1 text-xs text-muted-foreground">
        毎日の めあて です。あとから かえる ことが できます。
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {DAILY_GOAL_CHOICES.map((choice) => {
          const id = `daily-goal-${choice.xp}`;
          const isDefault = choice.xp === defaultValue;
          return (
            <label
              key={choice.xp}
              htmlFor={id}
              className="flex min-h-tap-cta cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              data-testid={`daily-goal-option-${choice.xp}`}
            >
              <input
                type="radio"
                id={id}
                name={name}
                value={String(choice.xp)}
                defaultChecked={isDefault}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span className="flex-1">
                <span className="block text-sm font-bold">
                  {choice.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {choice.xp} XP / 約 {choice.estimatedMinutes} 分
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {choice.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
