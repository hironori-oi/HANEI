/**
 * Badge Icon: 連続学習者 (streak_keeper) — silver
 * 連続炎と桜の融合 (flame + sakura petal fusion)。
 */
import { BADGE_VIEWBOX, BADGE_TIER_PALETTE, SAKURA_PINK, SAKURA_PINK_DEEP, AMBER_GOLD, type BadgeSvgProps } from "./palette";
import { MedallionFrameDefs, MedallionBody } from "./medallion-frame";

export function StreakKeeperBadgeIcon({
  size = 96,
  className,
  earned = true,
  label,
  idPrefix = "bg-sk",
}: BadgeSvgProps) {
  const tier = "silver" as const;
  const p = BADGE_TIER_PALETTE[tier];
  return (
    <svg
      width={size}
      height={size}
      viewBox={BADGE_VIEWBOX}
      role="img"
      aria-label={label ?? "連続学習者 バッジ"}
      className={className}
      style={!earned ? { filter: "grayscale(1)", opacity: 0.55 } : undefined}
    >
      <title>{label ?? "連続学習者 バッジ"}</title>
      <MedallionFrameDefs tier={tier} idPrefix={idPrefix} />
      <MedallionBody tier={tier} idPrefix={idPrefix} />
      {/* 炎の本体 (Amber Gold) */}
      <g>
        <path
          d="M 48 28 C 54 36 60 42 58 52 C 56 60 50 64 48 64 C 46 64 40 60 38 52 C 36 42 42 36 48 28 Z"
          fill={AMBER_GOLD}
          stroke={p.accentDeep}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* 炎の内側 (淡い桜色 / 連続を桜に重ねる) */}
        <path
          d="M 48 36 C 52 42 55 46 54 53 C 53 58 49 60 48 60 C 47 60 43 58 42 53 C 41 46 44 42 48 36 Z"
          fill={SAKURA_PINK}
          opacity="0.95"
        />
        {/* 桜花弁 (3 枚 / 炎の周りを舞う) */}
        <ellipse cx="34" cy="42" rx="3" ry="2" fill={SAKURA_PINK_DEEP} transform="rotate(-30 34 42)" opacity="0.85" />
        <ellipse cx="62" cy="42" rx="3" ry="2" fill={SAKURA_PINK_DEEP} transform="rotate(30 62 42)" opacity="0.85" />
        <ellipse cx="48" cy="68" rx="3" ry="2" fill={SAKURA_PINK_DEEP} opacity="0.85" />
        {/* 中心ハイライト */}
        <circle cx="48" cy="50" r="2" fill="#FFFFFF" opacity="0.6" />
      </g>
    </svg>
  );
}
