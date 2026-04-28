/**
 * 桜の木 5 段階目: かいか (bloom)
 * - 桜の花が複数咲いている。葉と花が混在。
 */
import { SAKURA_COLORS, SAKURA_VIEWBOX, type SakuraSvgProps } from "./colors";

interface FlowerProps {
  cx: number;
  cy: number;
  size?: number;
}

function Flower({ cx, cy, size = 4 }: FlowerProps) {
  const r = size;
  return (
    <g>
      {/* 5 枚の花びら (五角形配置) */}
      <circle cx={cx} cy={cy - r * 0.95} r={r * 0.85} fill={SAKURA_COLORS.pink} />
      <circle cx={cx + r * 0.9} cy={cy - r * 0.3} r={r * 0.85} fill={SAKURA_COLORS.pink} />
      <circle cx={cx + r * 0.55} cy={cy + r * 0.75} r={r * 0.85} fill={SAKURA_COLORS.pink} />
      <circle cx={cx - r * 0.55} cy={cy + r * 0.75} r={r * 0.85} fill={SAKURA_COLORS.pink} />
      <circle cx={cx - r * 0.9} cy={cy - r * 0.3} r={r * 0.85} fill={SAKURA_COLORS.pink} />
      {/* 中心 */}
      <circle cx={cx} cy={cy} r={r * 0.45} fill={SAKURA_COLORS.pinkDeep} />
      <circle cx={cx} cy={cy} r={r * 0.18} fill={SAKURA_COLORS.white} opacity="0.85" />
    </g>
  );
}

export function SakuraBloomSvg({ size = 120, className, label }: SakuraSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={SAKURA_VIEWBOX}
      role="img"
      aria-label={label ?? "桜のかいか"}
      className={className}
    >
      <title>{label ?? "桜のかいか"}</title>
      {/* 土 */}
      <ellipse cx="60" cy="102" rx="42" ry="6" fill={SAKURA_COLORS.soil} opacity="0.55" />

      {/* 幹 */}
      <path
        d="M 60 102 Q 56 80 56 60 Q 56 44 58 32"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* 主要枝 */}
      <path d="M 58 60 Q 44 52 30 42" stroke={SAKURA_COLORS.trunk} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 58 50 Q 74 46 88 38" stroke={SAKURA_COLORS.trunk} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 58 40 Q 50 28 42 20" stroke={SAKURA_COLORS.trunk} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 58 32 Q 64 22 72 16" stroke={SAKURA_COLORS.trunk} strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* 葉 (緑) - 控えめに */}
      <ellipse cx="40" cy="50" rx="5" ry="3" fill={SAKURA_COLORS.green} transform="rotate(-20 40 50)" />
      <ellipse cx="80" cy="44" rx="5" ry="3" fill={SAKURA_COLORS.green} transform="rotate(20 80 44)" />
      <ellipse cx="52" cy="36" rx="4" ry="2.5" fill={SAKURA_COLORS.greenDeep} transform="rotate(-10 52 36)" />

      {/* 桜の花 */}
      <Flower cx={32} cy={40} size={4} />
      <Flower cx={44} cy={28} size={3.5} />
      <Flower cx={58} cy={20} size={4.5} />
      <Flower cx={72} cy={28} size={4} />
      <Flower cx={86} cy={36} size={3.5} />
      <Flower cx={50} cy={50} size={3.5} />
      <Flower cx={70} cy={48} size={3.5} />
    </svg>
  );
}
