/**
 * Badge Icon: 文法マスター (grammar_master) — silver
 * 設計図 + ペン (blueprint grid with pen).
 */
import { BADGE_VIEWBOX, BADGE_TIER_PALETTE, AMBER_GOLD, type BadgeSvgProps } from "./palette";
import { MedallionFrameDefs, MedallionBody } from "./medallion-frame";

export function GrammarMasterBadgeIcon({
  size = 96,
  className,
  earned = true,
  label,
  idPrefix = "bg-gm",
}: BadgeSvgProps) {
  const tier = "silver" as const;
  const p = BADGE_TIER_PALETTE[tier];
  return (
    <svg
      width={size}
      height={size}
      viewBox={BADGE_VIEWBOX}
      role="img"
      aria-label={label ?? "文法マスター バッジ"}
      className={className}
      style={!earned ? { filter: "grayscale(1)", opacity: 0.55 } : undefined}
    >
      <title>{label ?? "文法マスター バッジ"}</title>
      <MedallionFrameDefs tier={tier} idPrefix={idPrefix} />
      <MedallionBody tier={tier} idPrefix={idPrefix} />
      <g>
        {/* 設計図の用紙 (背景) */}
        <rect x="30" y="32" width="36" height="32" fill="#F5F8FA" stroke={p.accentDeep} strokeWidth="0.8" rx="1" />
        {/* グリッド線 (縦 4 / 横 3) */}
        <g stroke={p.accent} strokeWidth="0.5" opacity="0.55">
          <line x1="38" y1="32" x2="38" y2="64" />
          <line x1="46" y1="32" x2="46" y2="64" />
          <line x1="54" y1="32" x2="54" y2="64" />
          <line x1="62" y1="32" x2="62" y2="64" />
          <line x1="30" y1="40" x2="66" y2="40" />
          <line x1="30" y1="48" x2="66" y2="48" />
          <line x1="30" y1="56" x2="66" y2="56" />
        </g>
        {/* SVO のチェックマーク (3 つ) */}
        <path d="M 33 42 L 35 44 L 38 39" stroke={AMBER_GOLD} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 41 50 L 43 52 L 46 47" stroke={AMBER_GOLD} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 49 58 L 51 60 L 54 55" stroke={AMBER_GOLD} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* ペン (右下から斜め) */}
        <g transform="rotate(35 60 56)">
          <rect x="58" y="44" width="3" height="16" fill={p.accent} stroke={p.accentDeep} strokeWidth="0.6" />
          <polygon points="58,44 61,44 59.5,40" fill={AMBER_GOLD} stroke={p.accentDeep} strokeWidth="0.6" />
          <rect x="58" y="58" width="3" height="2" fill={p.accentDeep} />
        </g>
      </g>
    </svg>
  );
}
