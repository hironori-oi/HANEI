/**
 * 桜の木 7 段階目: さくらなみき (grove)
 * - 複数の桜の木が並ぶ。HANEI のゴール (半年で英検合格) を象徴。
 * - amber gold のアクセントを薄く加える (HANEI ブランド統合)。
 */
import { SAKURA_COLORS, SAKURA_VIEWBOX, type SakuraSvgProps } from "./colors";

interface FlowerProps {
  cx: number;
  cy: number;
  size?: number;
}

function Flower({ cx, cy, size = 3 }: FlowerProps) {
  const r = size;
  return (
    <g>
      <circle cx={cx} cy={cy - r * 0.95} r={r * 0.9} fill={SAKURA_COLORS.pink} />
      <circle cx={cx + r * 0.9} cy={cy - r * 0.3} r={r * 0.9} fill={SAKURA_COLORS.pink} />
      <circle cx={cx + r * 0.55} cy={cy + r * 0.75} r={r * 0.9} fill={SAKURA_COLORS.pink} />
      <circle cx={cx - r * 0.55} cy={cy + r * 0.75} r={r * 0.9} fill={SAKURA_COLORS.pink} />
      <circle cx={cx - r * 0.9} cy={cy - r * 0.3} r={r * 0.9} fill={SAKURA_COLORS.pink} />
      <circle cx={cx} cy={cy} r={r * 0.5} fill={SAKURA_COLORS.pinkDeep} />
    </g>
  );
}

interface TreeProps {
  cx: number;
  scale: number;
}

function MiniTree({ cx, scale }: TreeProps) {
  return (
    <g transform={`translate(${cx} 0) scale(${scale})`}>
      {/* 幹 */}
      <path
        d="M 0 60 Q -2 44 -3 28 Q -3 18 0 10"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        transform="translate(0 40)"
      />
      {/* 枝 */}
      <path
        d="M -2 78 Q -10 70 -16 64"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M -2 70 Q 8 64 16 60"
        stroke={SAKURA_COLORS.trunk}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* 花 */}
      <Flower cx={-16} cy={62} size={3} />
      <Flower cx={-8} cy={56} size={3.5} />
      <Flower cx={0} cy={48} size={3.5} />
      <Flower cx={8} cy={52} size={3.5} />
      <Flower cx={16} cy={58} size={3} />
      <Flower cx={-4} cy={62} size={3} />
      <Flower cx={4} cy={62} size={3} />
    </g>
  );
}

export function SakuraGroveSvg({ size = 120, className, label }: SakuraSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={SAKURA_VIEWBOX}
      role="img"
      aria-label={label ?? "桜なみき"}
      className={className}
    >
      <title>{label ?? "桜なみき"}</title>

      {/* 遠景の山稜 (薄い amber gold アクセント) */}
      <path
        d="M 0 88 Q 30 78 60 84 Q 90 78 120 88 L 120 120 L 0 120 Z"
        fill={SAKURA_COLORS.amberGold}
        opacity="0.12"
      />

      {/* 土 */}
      <ellipse cx="60" cy="108" rx="56" ry="5" fill={SAKURA_COLORS.soil} opacity="0.5" />

      {/* 3 本の桜 */}
      <MiniTree cx={26} scale={0.85} />
      <MiniTree cx={60} scale={1.0} />
      <MiniTree cx={94} scale={0.85} />

      {/* 散り花びら 数枚 */}
      <circle cx="14" cy="78" r="1.6" fill={SAKURA_COLORS.pink} />
      <circle cx="50" cy="86" r="1.4" fill={SAKURA_COLORS.pink} />
      <circle cx="80" cy="82" r="1.6" fill={SAKURA_COLORS.pink} />
      <circle cx="106" cy="80" r="1.4" fill={SAKURA_COLORS.pink} />
    </svg>
  );
}
