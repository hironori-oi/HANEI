/**
 * Badge Icon: 読解マスター (reading_master) — gold
 * 開かれた書 (open book with rays of insight).
 */
import { BADGE_VIEWBOX, BADGE_TIER_PALETTE, AMBER_GOLD, type BadgeSvgProps } from "./palette";
import { MedallionFrameDefs, MedallionBody } from "./medallion-frame";

export function ReadingMasterBadgeIcon({
  size = 96,
  className,
  earned = true,
  label,
  idPrefix = "bg-rm",
}: BadgeSvgProps) {
  const tier = "gold" as const;
  const p = BADGE_TIER_PALETTE[tier];
  return (
    <svg
      width={size}
      height={size}
      viewBox={BADGE_VIEWBOX}
      role="img"
      aria-label={label ?? "読解マスター バッジ"}
      className={className}
      style={!earned ? { filter: "grayscale(1)", opacity: 0.55 } : undefined}
    >
      <title>{label ?? "読解マスター バッジ"}</title>
      <MedallionFrameDefs tier={tier} idPrefix={idPrefix} />
      <MedallionBody tier={tier} idPrefix={idPrefix} />
      <g>
        {/* 光線 (背景 / 知恵の発散) */}
        <g stroke={AMBER_GOLD} strokeWidth="1" opacity="0.55" strokeLinecap="round">
          <line x1="48" y1="22" x2="48" y2="28" />
          <line x1="32" y1="28" x2="36" y2="32" />
          <line x1="64" y1="28" x2="60" y2="32" />
          <line x1="26" y1="36" x2="32" y2="38" />
          <line x1="70" y1="36" x2="64" y2="38" />
        </g>
        {/* 本の中央の谷 */}
        <path
          d="M 48 38 L 48 64"
          stroke={p.accentDeep}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* 左ページ */}
        <path
          d="M 48 38 C 42 36 36 36 30 38 L 30 62 C 36 60 42 60 48 62 Z"
          fill="#FFFAF0"
          stroke={p.accentDeep}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* 右ページ */}
        <path
          d="M 48 38 C 54 36 60 36 66 38 L 66 62 C 60 60 54 60 48 62 Z"
          fill="#FFFAF0"
          stroke={p.accentDeep}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* 左ページのテキスト行 */}
        <line x1="34" y1="44" x2="44" y2="44" stroke={p.accent} strokeWidth="0.8" />
        <line x1="34" y1="48" x2="44" y2="48" stroke={p.accent} strokeWidth="0.8" />
        <line x1="34" y1="52" x2="42" y2="52" stroke={p.accent} strokeWidth="0.8" />
        {/* 右ページのテキスト行 */}
        <line x1="52" y1="44" x2="62" y2="44" stroke={p.accent} strokeWidth="0.8" />
        <line x1="52" y1="48" x2="62" y2="48" stroke={p.accent} strokeWidth="0.8" />
        <line x1="52" y1="52" x2="60" y2="52" stroke={p.accent} strokeWidth="0.8" />
        {/* 栞 (Amber Gold) */}
        <path
          d="M 56 38 L 56 50 L 58 47 L 60 50 L 60 38 Z"
          fill={AMBER_GOLD}
          stroke={p.accentDeep}
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
