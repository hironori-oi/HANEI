/**
 * Badge Icon: 初飛行 (first_flight) — bronze
 * 飛び立つ翼 (paper plane / wing motif)。Amber Gold アクセント。
 */
import { BADGE_VIEWBOX, BADGE_TIER_PALETTE, type BadgeSvgProps } from "./palette";
import { MedallionFrameDefs, MedallionBody } from "./medallion-frame";

export function FirstFlightBadgeIcon({
  size = 96,
  className,
  earned = true,
  label,
  idPrefix = "bg-ff",
}: BadgeSvgProps) {
  const tier = "bronze" as const;
  const p = BADGE_TIER_PALETTE[tier];
  return (
    <svg
      width={size}
      height={size}
      viewBox={BADGE_VIEWBOX}
      role="img"
      aria-label={label ?? "初飛行 バッジ"}
      className={className}
      style={!earned ? { filter: "grayscale(1)", opacity: 0.55 } : undefined}
    >
      <title>{label ?? "初飛行 バッジ"}</title>
      <MedallionFrameDefs tier={tier} idPrefix={idPrefix} />
      <MedallionBody tier={tier} idPrefix={idPrefix} />
      {/* 翼 / 紙飛行機 (右上方向に飛び立つ) */}
      <g>
        {/* 主翼 */}
        <path
          d="M 30 56 L 64 30 L 60 50 L 50 48 Z"
          fill={p.accent}
          stroke={p.accentDeep}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* 副翼 (折り返し / 影) */}
        <path
          d="M 50 48 L 60 50 L 52 60 Z"
          fill={p.accentDeep}
          opacity="0.85"
        />
        {/* 飛跡 (短い 3 本ライン / 動き) */}
        <line x1="34" y1="64" x2="42" y2="58" stroke={p.accent} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        <line x1="32" y1="68" x2="38" y2="64" stroke={p.accent} strokeWidth="1" strokeLinecap="round" opacity="0.45" />
        <line x1="30" y1="72" x2="34" y2="69" stroke={p.accent} strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      </g>
    </svg>
  );
}
