/**
 * 桜の木 4 段階目: つぼみ (bud)
 * - 緑の葉に加え、ピンクの蕾がいくつか出始める
 */
import { SAKURA_COLORS, SAKURA_VIEWBOX, type SakuraSvgProps } from "./colors";

export function SakuraBudSvg({ size = 120, className, label }: SakuraSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={SAKURA_VIEWBOX}
      role="img"
      aria-label={label ?? "桜のつぼみ"}
      className={className}
    >
      <title>{label ?? "桜のつぼみ"}</title>
      {/* 土 */}
      <ellipse cx="60" cy="100" rx="40" ry="6" fill={SAKURA_COLORS.soil} opacity="0.55" />

      {/* 幹 (やや太く) */}
      <path
        d="M 60 100 Q 58 78 56 56 Q 56 44 60 36"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {/* 枝 */}
      <path
        d="M 58 56 Q 48 50 38 44"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 58 50 Q 70 46 80 40"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 60 38 Q 64 32 70 28"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* 葉 (緑) */}
      <ellipse cx="42" cy="46" rx="6" ry="4" fill={SAKURA_COLORS.green} transform="rotate(-25 42 46)" />
      <ellipse cx="78" cy="42" rx="6" ry="4" fill={SAKURA_COLORS.green} transform="rotate(25 78 42)" />
      <ellipse cx="50" cy="38" rx="5.5" ry="3.5" fill={SAKURA_COLORS.greenDeep} transform="rotate(-10 50 38)" />

      {/* 蕾 (ピンク) 4 つ */}
      <circle cx="38" cy="44" r="3.5" fill={SAKURA_COLORS.pinkDeep} />
      <circle cx="38" cy="42" r="2.2" fill={SAKURA_COLORS.pink} />

      <circle cx="80" cy="40" r="3.5" fill={SAKURA_COLORS.pinkDeep} />
      <circle cx="80" cy="38" r="2.2" fill={SAKURA_COLORS.pink} />

      <circle cx="62" cy="32" r="3.5" fill={SAKURA_COLORS.pinkDeep} />
      <circle cx="62" cy="30" r="2.2" fill={SAKURA_COLORS.pink} />

      <circle cx="70" cy="26" r="3" fill={SAKURA_COLORS.pinkDeep} />
      <circle cx="70" cy="25" r="1.8" fill={SAKURA_COLORS.pink} />
    </svg>
  );
}
