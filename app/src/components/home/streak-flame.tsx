/**
 * HANEI - DEC-087 Plan A: Streak 炎アニメ (項目 7)
 *
 * 連続日数で表示分岐:
 *   - 1-2 日: 表示なし
 *   - 3 日:   小炎
 *   - 7 日:   中炎
 *   - 14 日+: 大炎 + 上昇 spark パーティクル
 *
 * - inline JSX SVG (絵文字禁止 / Heroicons 依存なし: 専用シンプル炎パスを自前で描画)
 * - flicker は CSS keyframe (`hanei-flame-flicker` / globals.css) で 60fps GPU
 * - prefers-reduced-motion: reduce 時は flicker を停止 (静止 SVG)
 *
 * 罰則ゼロ哲学: 「燃える」ではなく「達成の輝き」を表現する暖色 (Amber Gold) のみ。
 */

import { cn } from "@/lib/utils";

interface StreakFlameProps {
  streakDays: number;
  className?: string;
}

type FlameTier = "none" | "small" | "medium" | "large";

function pickTier(days: number): FlameTier {
  if (days >= 14) return "large";
  if (days >= 7) return "medium";
  if (days >= 3) return "small";
  return "none";
}

const TIER_SIZE: Record<Exclude<FlameTier, "none">, number> = {
  small: 20,
  medium: 28,
  large: 36,
};

export function StreakFlame({ streakDays, className }: StreakFlameProps) {
  const tier = pickTier(streakDays);
  if (tier === "none") return null;
  const size = TIER_SIZE[tier];

  return (
    <span
      data-testid="streak-flame"
      data-streak={streakDays}
      data-tier={tier}
      aria-label={`${streakDays} 日 連続記録の しるし`}
      className={cn(
        "relative inline-flex shrink-0 items-end justify-center",
        className,
      )}
      style={{ width: size, height: size + 4 }}
    >
      <FlameSvg size={size} className="hanei-flame-flicker" />
      {tier === "large" && (
        <>
          {/* 上昇 spark パーティクル (3 個 / opacity 差で順次上昇) */}
          <span
            aria-hidden="true"
            className="hanei-flame-spark absolute left-1/2 -top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#FFB05A]"
            style={{ animationDelay: "0s" }}
          />
          <span
            aria-hidden="true"
            className="hanei-flame-spark absolute left-[35%] -top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-[#FFD27A]"
            style={{ animationDelay: "0.5s" }}
          />
          <span
            aria-hidden="true"
            className="hanei-flame-spark absolute left-[70%] -top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-[#F2A93A]"
            style={{ animationDelay: "1s" }}
          />
        </>
      )}
    </span>
  );
}

function FlameSvg({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 36"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={`hanei-flame-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE7A0" />
          <stop offset="45%" stopColor="#F2A93A" />
          <stop offset="100%" stopColor="#B97F18" />
        </linearGradient>
      </defs>
      {/* 外炎 (柔らかい drop) */}
      <path
        d="M16 2 C 12 9 6 12 6 20 C 6 27 11 33 16 33 C 21 33 26 27 26 20 C 26 14 22 12 19 7 C 18 5 17 3 16 2 Z"
        fill={`url(#hanei-flame-${size})`}
      />
      {/* 内炎 (中心の白い揺らぎ) */}
      <path
        d="M16 12 C 14 16 11 18 11 24 C 11 28 13.5 31 16 31 C 18.5 31 21 28 21 24 C 21 19 18 17 16 12 Z"
        fill="#FFE7A0"
        opacity="0.85"
      />
    </svg>
  );
}
