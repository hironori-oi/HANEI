/**
 * 桜の木 2 段階目: め (sprout)
 * - 緑の小さな双葉が土から出ている
 */
import { SAKURA_COLORS, SAKURA_VIEWBOX, type SakuraSvgProps } from "./colors";

export function SakuraSproutSvg({ size = 120, className, label }: SakuraSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={SAKURA_VIEWBOX}
      role="img"
      aria-label={label ?? "桜のめ"}
      className={className}
    >
      <title>{label ?? "桜のめ"}</title>
      {/* 土 */}
      <ellipse cx="60" cy="100" rx="36" ry="6" fill={SAKURA_COLORS.soil} opacity="0.55" />

      {/* 茎 */}
      <line
        x1="60"
        y1="100"
        x2="60"
        y2="74"
        stroke={SAKURA_COLORS.green}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* 左の双葉 */}
      <ellipse
        cx="51"
        cy="74"
        rx="9"
        ry="6"
        fill={SAKURA_COLORS.green}
        transform="rotate(-25 51 74)"
      />
      {/* 葉脈 (左) */}
      <line
        x1="60"
        y1="76"
        x2="44"
        y2="69"
        stroke={SAKURA_COLORS.greenDeep}
        strokeWidth="0.6"
        opacity="0.7"
      />

      {/* 右の双葉 */}
      <ellipse
        cx="69"
        cy="74"
        rx="9"
        ry="6"
        fill={SAKURA_COLORS.green}
        transform="rotate(25 69 74)"
      />
      {/* 葉脈 (右) */}
      <line
        x1="60"
        y1="76"
        x2="76"
        y2="69"
        stroke={SAKURA_COLORS.greenDeep}
        strokeWidth="0.6"
        opacity="0.7"
      />

      {/* 種の名残 */}
      <ellipse cx="60" cy="98" rx="3.5" ry="2" fill={SAKURA_COLORS.brownSeed} opacity="0.6" />
    </svg>
  );
}
