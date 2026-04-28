/**
 * 桜の木 3 段階目: わかば (leaves)
 * - 細い幹に若い緑の葉が複数枚ひろがっている
 */
import { SAKURA_COLORS, SAKURA_VIEWBOX, type SakuraSvgProps } from "./colors";

export function SakuraLeavesSvg({ size = 120, className, label }: SakuraSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={SAKURA_VIEWBOX}
      role="img"
      aria-label={label ?? "桜のわかば"}
      className={className}
    >
      <title>{label ?? "桜のわかば"}</title>
      {/* 土 */}
      <ellipse cx="60" cy="100" rx="38" ry="6" fill={SAKURA_COLORS.soil} opacity="0.55" />

      {/* 細い幹 */}
      <path
        d="M 60 100 Q 60 80 58 60 Q 56 50 58 44"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* 細い枝 */}
      <line
        x1="58"
        y1="60"
        x2="44"
        y2="50"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="58"
        y1="55"
        x2="74"
        y2="48"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 葉 5 枚: 緑の楕円を散らす */}
      <ellipse cx="44" cy="48" rx="7" ry="4.5" fill={SAKURA_COLORS.green} transform="rotate(-30 44 48)" />
      <ellipse cx="58" cy="42" rx="7" ry="4.5" fill={SAKURA_COLORS.green} transform="rotate(0 58 42)" />
      <ellipse cx="74" cy="46" rx="7" ry="4.5" fill={SAKURA_COLORS.green} transform="rotate(30 74 46)" />
      <ellipse cx="50" cy="58" rx="6" ry="4" fill={SAKURA_COLORS.greenDeep} transform="rotate(-15 50 58)" />
      <ellipse cx="68" cy="58" rx="6" ry="4" fill={SAKURA_COLORS.greenDeep} transform="rotate(15 68 58)" />

      {/* 中央葉のハイライト */}
      <line x1="58" y1="40" x2="58" y2="44" stroke={SAKURA_COLORS.greenDeep} strokeWidth="0.6" opacity="0.7" />
    </svg>
  );
}
