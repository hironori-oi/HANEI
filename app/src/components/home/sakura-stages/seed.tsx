/**
 * 桜の木 1 段階目: たね (seed)
 * - 茶色の小さな種が土に置かれている
 */
import { SAKURA_COLORS, SAKURA_VIEWBOX, type SakuraSvgProps } from "./colors";

export function SakuraSeedSvg({ size = 120, className, label }: SakuraSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={SAKURA_VIEWBOX}
      role="img"
      aria-label={label ?? "桜のたね"}
      className={className}
    >
      <title>{label ?? "桜のたね"}</title>
      {/* 土 */}
      <ellipse cx="60" cy="100" rx="36" ry="6" fill={SAKURA_COLORS.soil} opacity="0.55" />
      <ellipse cx="60" cy="100" rx="28" ry="4" fill={SAKURA_COLORS.brownSeed} opacity="0.4" />

      {/* 種 (中央): やや楕円形 / 茶 */}
      <ellipse cx="60" cy="92" rx="9" ry="11" fill={SAKURA_COLORS.brownSeed} />
      {/* 種のハイライト */}
      <ellipse cx="57" cy="88" rx="2.5" ry="3.5" fill={SAKURA_COLORS.white} opacity="0.35" />
      {/* 種の縦線 (双葉が出る位置の凹み) */}
      <line
        x1="60"
        y1="84"
        x2="60"
        y2="98"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="0.8"
        opacity="0.6"
      />
    </svg>
  );
}
