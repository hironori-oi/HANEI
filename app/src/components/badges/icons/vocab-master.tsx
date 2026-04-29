/**
 * Badge Icon: 語彙マスター (vocab_master) — silver
 * 巻物 + 文字 (rolled scroll with characters)。
 */
import { BADGE_VIEWBOX, BADGE_TIER_PALETTE, type BadgeSvgProps } from "./palette";
import { MedallionFrameDefs, MedallionBody } from "./medallion-frame";

export function VocabMasterBadgeIcon({
  size = 96,
  className,
  earned = true,
  label,
  idPrefix = "bg-vm",
}: BadgeSvgProps) {
  const tier = "silver" as const;
  const p = BADGE_TIER_PALETTE[tier];
  return (
    <svg
      width={size}
      height={size}
      viewBox={BADGE_VIEWBOX}
      role="img"
      aria-label={label ?? "語彙マスター バッジ"}
      className={className}
      style={!earned ? { filter: "grayscale(1)", opacity: 0.55 } : undefined}
    >
      <title>{label ?? "語彙マスター バッジ"}</title>
      <MedallionFrameDefs tier={tier} idPrefix={idPrefix} />
      <MedallionBody tier={tier} idPrefix={idPrefix} />
      {/* 巻物本体 (中央の紙面) */}
      <g>
        <rect x="32" y="36" width="32" height="24" fill="#FAF6E8" stroke={p.accentDeep} strokeWidth="0.8" rx="1" />
        {/* 文字行 (3 本) */}
        <line x1="36" y1="42" x2="60" y2="42" stroke={p.accent} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="36" y1="48" x2="56" y2="48" stroke={p.accent} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="36" y1="54" x2="58" y2="54" stroke={p.accent} strokeWidth="1.2" strokeLinecap="round" />
        {/* 左側の巻き軸 */}
        <ellipse cx="32" cy="48" rx="4" ry="12" fill="#D4A85A" stroke={p.accentDeep} strokeWidth="0.8" />
        <ellipse cx="32" cy="48" rx="2" ry="10" fill="#A77118" opacity="0.5" />
        {/* 右側の巻き軸 */}
        <ellipse cx="64" cy="48" rx="4" ry="12" fill="#D4A85A" stroke={p.accentDeep} strokeWidth="0.8" />
        <ellipse cx="64" cy="48" rx="2" ry="10" fill="#A77118" opacity="0.5" />
        {/* "ABC" 強調文字 (見える程度) */}
        <text
          x="48"
          y="51"
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill={p.accentDeep}
          fontFamily="serif"
        >
          ABC
        </text>
      </g>
    </svg>
  );
}
