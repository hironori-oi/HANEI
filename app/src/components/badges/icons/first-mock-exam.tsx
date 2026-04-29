/**
 * Badge Icon: 受験者 (first_mock_exam) — gold
 * 試験合格鉢巻 (hachimaki / exam pass headband).
 */
import { BADGE_VIEWBOX, BADGE_TIER_PALETTE, AMBER_GOLD, type BadgeSvgProps } from "./palette";
import { MedallionFrameDefs, MedallionBody } from "./medallion-frame";

export function FirstMockExamBadgeIcon({
  size = 96,
  className,
  earned = true,
  label,
  idPrefix = "bg-fme",
}: BadgeSvgProps) {
  const tier = "gold" as const;
  const p = BADGE_TIER_PALETTE[tier];
  const HACHIMAKI_RED = "#D24A52";
  const HACHIMAKI_RED_DEEP = "#9A2E36";
  return (
    <svg
      width={size}
      height={size}
      viewBox={BADGE_VIEWBOX}
      role="img"
      aria-label={label ?? "受験者 バッジ"}
      className={className}
      style={!earned ? { filter: "grayscale(1)", opacity: 0.55 } : undefined}
    >
      <title>{label ?? "受験者 バッジ"}</title>
      <MedallionFrameDefs tier={tier} idPrefix={idPrefix} />
      <MedallionBody tier={tier} idPrefix={idPrefix} />
      <g>
        {/* 鉢巻の本体 (額に巻く帯) */}
        <rect x="28" y="42" width="40" height="10" fill={HACHIMAKI_RED} stroke={HACHIMAKI_RED_DEEP} strokeWidth="0.8" rx="1" />
        {/* 鉢巻の中央の日の丸 */}
        <circle cx="48" cy="47" r="3.5" fill="#FFFFFF" stroke={HACHIMAKI_RED_DEEP} strokeWidth="0.5" />
        <circle cx="48" cy="47" r="2.5" fill={HACHIMAKI_RED} />
        {/* 鉢巻の左ひも (たれる帯) */}
        <path
          d="M 28 52 L 24 64 L 28 66 L 32 54 Z"
          fill={HACHIMAKI_RED}
          stroke={HACHIMAKI_RED_DEEP}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* 鉢巻の右ひも */}
        <path
          d="M 68 52 L 72 64 L 68 66 L 64 54 Z"
          fill={HACHIMAKI_RED}
          stroke={HACHIMAKI_RED_DEEP}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* "合格" の漢字 (中央 / 強調) */}
        <text
          x="40"
          y="40"
          textAnchor="middle"
          fontSize="7"
          fontWeight="800"
          fill={HACHIMAKI_RED_DEEP}
          fontFamily="serif"
        >
          合
        </text>
        <text
          x="56"
          y="40"
          textAnchor="middle"
          fontSize="7"
          fontWeight="800"
          fill={HACHIMAKI_RED_DEEP}
          fontFamily="serif"
        >
          格
        </text>
        {/* 星 (Amber Gold / 上に輝く) */}
        <polygon
          points="48,28 49.5,32 53.8,32 50.2,34.5 51.7,38.5 48,36 44.3,38.5 45.8,34.5 42.2,32 46.5,32"
          fill={AMBER_GOLD}
          stroke={p.accentDeep}
          strokeWidth="0.6"
        />
      </g>
    </svg>
  );
}
