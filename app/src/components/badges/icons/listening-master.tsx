/**
 * Badge Icon: リスニングマスター (listening_master) — gold
 * 響く音波 (radiating sound waves with ear motif).
 */
import { BADGE_VIEWBOX, BADGE_TIER_PALETTE, AMBER_GOLD, type BadgeSvgProps } from "./palette";
import { MedallionFrameDefs, MedallionBody } from "./medallion-frame";

export function ListeningMasterBadgeIcon({
  size = 96,
  className,
  earned = true,
  label,
  idPrefix = "bg-lm",
}: BadgeSvgProps) {
  const tier = "gold" as const;
  const p = BADGE_TIER_PALETTE[tier];
  return (
    <svg
      width={size}
      height={size}
      viewBox={BADGE_VIEWBOX}
      role="img"
      aria-label={label ?? "リスニングマスター バッジ"}
      className={className}
      style={!earned ? { filter: "grayscale(1)", opacity: 0.55 } : undefined}
    >
      <title>{label ?? "リスニングマスター バッジ"}</title>
      <MedallionFrameDefs tier={tier} idPrefix={idPrefix} />
      <MedallionBody tier={tier} idPrefix={idPrefix} />
      <g>
        {/* 音源 (ヘッドフォン形 / 中央) */}
        <path
          d="M 36 50 C 36 40 42 34 48 34 C 54 34 60 40 60 50"
          stroke={p.accentDeep}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        {/* 左イヤーカップ */}
        <rect x="32" y="48" width="8" height="14" rx="3" fill={AMBER_GOLD} stroke={p.accentDeep} strokeWidth="0.8" />
        <rect x="33" y="50" width="6" height="10" rx="2" fill={p.accent} opacity="0.6" />
        {/* 右イヤーカップ */}
        <rect x="56" y="48" width="8" height="14" rx="3" fill={AMBER_GOLD} stroke={p.accentDeep} strokeWidth="0.8" />
        <rect x="57" y="50" width="6" height="10" rx="2" fill={p.accent} opacity="0.6" />
        {/* 音波 (左 / 3 本の弧) */}
        <g stroke={AMBER_GOLD} strokeWidth="1.2" fill="none" strokeLinecap="round">
          <path d="M 28 50 C 26 52 26 58 28 60" opacity="0.85" />
          <path d="M 24 48 C 22 52 22 58 24 62" opacity="0.6" />
          <path d="M 20 46 C 18 52 18 58 20 64" opacity="0.4" />
        </g>
        {/* 音波 (右 / 3 本の弧) */}
        <g stroke={AMBER_GOLD} strokeWidth="1.2" fill="none" strokeLinecap="round">
          <path d="M 68 50 C 70 52 70 58 68 60" opacity="0.85" />
          <path d="M 72 48 C 74 52 74 58 72 62" opacity="0.6" />
          <path d="M 76 46 C 78 52 78 58 76 64" opacity="0.4" />
        </g>
      </g>
    </svg>
  );
}
