/**
 * StreakShieldBadge (W8-T1)
 *
 * /home の Streak 表示横に「保護シールド」アイコン + 残り枚数を表示する。
 * Heroicons ShieldCheckIcon を使用し、`title` 属性 + `aria-label` でツールチップを提供する。
 *
 * 設計原則:
 *  - 絵文字禁止 / Heroicons のみ
 *  - AI 感を出さないため「保護シールド」「連続日数を守ってくれます」などの自然な日本語
 *  - prefers-reduced-motion 環境でもアクセシブルな静的表示
 */

import { ShieldCheckIcon } from "@heroicons/react/24/outline";

import { cn } from "@/lib/utils";

export interface StreakShieldBadgeProps {
  /** 残り freeze ticket 枚数 (0-2) */
  count: number;
  /** 受験日 (YYYY-MM-DD) / null 可。ツールチップ文言の調整に使う */
  examDate?: string | null;
  className?: string;
}

export function StreakShieldBadge(props: StreakShieldBadgeProps) {
  const { count, examDate, className } = props;
  const safeCount = Math.max(0, Math.min(count, 2));

  // ツールチップ本文 (受験日があれば「○○まで」と日付を入れる、無ければ汎用)
  const tooltip = examDate
    ? `${examDate} まで連続日数を守ってくれます`
    : "連続日数を守ってくれます";

  // 0 枚でも UI 上は表示する (子供に「いま保護がない」を理解してもらうため)
  // ただし色味は控えめに
  const isActive = safeCount > 0;

  return (
    <span
      data-testid="streak-shield-badge"
      data-shield-count={safeCount}
      title={tooltip}
      aria-label={`保護シールド ${safeCount} 枚 / ${tooltip}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
        isActive
          ? "border-accent/40 bg-accent/10 text-accent-foreground"
          : "border-muted bg-muted/30 text-muted-foreground",
        className,
      )}
    >
      <ShieldCheckIcon
        className={cn("h-4 w-4", isActive ? "text-accent" : "text-muted-foreground")}
        aria-hidden="true"
      />
      <span>
        <span className="sr-only">保護シールド </span>
        {safeCount}
      </span>
    </span>
  );
}
