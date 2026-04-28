/**
 * 桜の木 6 段階目: まんかい (fullbloom)
 * - 樹形が大きくなり、花が密に咲き誇っている
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
      <circle cx={cx} cy={cy - r * 0.95} r={r * 0.9} fill={SAKURA_COLORS.pink} />
      <circle cx={cx + r * 0.9} cy={cy - r * 0.3} r={r * 0.9} fill={SAKURA_COLORS.pink} />
      <circle cx={cx + r * 0.55} cy={cy + r * 0.75} r={r * 0.9} fill={SAKURA_COLORS.pink} />
      <circle cx={cx - r * 0.55} cy={cy + r * 0.75} r={r * 0.9} fill={SAKURA_COLORS.pink} />
      <circle cx={cx - r * 0.9} cy={cy - r * 0.3} r={r * 0.9} fill={SAKURA_COLORS.pink} />
      <circle cx={cx} cy={cy} r={r * 0.5} fill={SAKURA_COLORS.pinkDeep} />
      <circle cx={cx} cy={cy} r={r * 0.2} fill={SAKURA_COLORS.white} opacity="0.9" />
    </g>
  );
}

export function SakuraFullBloomSvg({ size = 120, className, label }: SakuraSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={SAKURA_VIEWBOX}
      role="img"
      aria-label={label ?? "桜のまんかい"}
      className={className}
    >
      <title>{label ?? "桜のまんかい"}</title>
      {/* 土 */}
      <ellipse cx="60" cy="104" rx="46" ry="6" fill={SAKURA_COLORS.soil} opacity="0.55" />

      {/* 太い幹 */}
      <path
        d="M 60 104 Q 56 84 54 64 Q 54 46 58 30"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* 多数の枝 */}
      <path d="M 56 64 Q 38 56 22 50" stroke={SAKURA_COLORS.trunk} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M 56 52 Q 72 48 92 42" stroke={SAKURA_COLORS.trunk} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M 56 42 Q 46 30 36 18" stroke={SAKURA_COLORS.trunk} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 58 30 Q 64 18 72 12" stroke={SAKURA_COLORS.trunk} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 56 60 Q 60 48 60 38" stroke={SAKURA_COLORS.trunk} strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* 桜の花 (密) */}
      <Flower cx={20} cy={48} size={4} />
      <Flower cx={30} cy={36} size={4.5} />
      <Flower cx={40} cy={26} size={4} />
      <Flower cx={36} cy={18} size={3.5} />
      <Flower cx={50} cy={16} size={4} />
      <Flower cx={60} cy={10} size={4.5} />
      <Flower cx={70} cy={14} size={4} />
      <Flower cx={80} cy={22} size={4.5} />
      <Flower cx={90} cy={32} size={4} />
      <Flower cx={94} cy={42} size={3.5} />
      <Flower cx={50} cy={42} size={3.5} />
      <Flower cx={66} cy={36} size={4} />
      <Flower cx={48} cy={56} size={3.5} />
      <Flower cx={72} cy={52} size={3.5} />
      <Flower cx={32} cy={50} size={3.5} />
      <Flower cx={84} cy={50} size={3.5} />
    </svg>
  );
}
