/**
 * Badge Icon: 桜守 (sakura_keeper) — platinum
 * 桜並木の守護 (sakura tree branch with full bloom).
 */
import {
  BADGE_VIEWBOX,
  SAKURA_PINK,
  SAKURA_PINK_DEEP,
  AMBER_GOLD,
  type BadgeSvgProps,
} from "./palette";
import { MedallionFrameDefs, MedallionBody } from "./medallion-frame";

interface PetalProps {
  cx: number;
  cy: number;
  r: number;
  rotate?: number;
}

function SakuraPetal({ cx, cy, r, rotate = 0 }: PetalProps) {
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotate})`}>
      <path
        d={`M 0 ${-r} C ${r * 0.55} ${-r * 0.5} ${r * 0.55} ${r * 0.3} 0 ${r} C ${-r * 0.55} ${r * 0.3} ${-r * 0.55} ${-r * 0.5} 0 ${-r} Z`}
        fill={SAKURA_PINK}
        stroke={SAKURA_PINK_DEEP}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      {/* 花弁先端の切れ込み */}
      <path
        d={`M -${r * 0.18} ${-r * 0.85} L 0 ${-r * 0.65} L ${r * 0.18} ${-r * 0.85}`}
        stroke={SAKURA_PINK_DEEP}
        strokeWidth="0.5"
        fill="none"
      />
    </g>
  );
}

interface FlowerProps {
  cx: number;
  cy: number;
  r: number;
}

function SakuraFlower({ cx, cy, r }: FlowerProps) {
  return (
    <g>
      {/* 5 枚花弁 */}
      <SakuraPetal cx={cx} cy={cy - r * 0.75} r={r * 0.7} rotate={0} />
      <SakuraPetal cx={cx + r * 0.7} cy={cy - r * 0.22} r={r * 0.7} rotate={72} />
      <SakuraPetal cx={cx + r * 0.45} cy={cy + r * 0.62} r={r * 0.7} rotate={144} />
      <SakuraPetal cx={cx - r * 0.45} cy={cy + r * 0.62} r={r * 0.7} rotate={216} />
      <SakuraPetal cx={cx - r * 0.7} cy={cy - r * 0.22} r={r * 0.7} rotate={288} />
      {/* 花芯 */}
      <circle cx={cx} cy={cy} r={r * 0.18} fill={AMBER_GOLD} stroke={SAKURA_PINK_DEEP} strokeWidth="0.4" />
    </g>
  );
}

export function SakuraKeeperBadgeIcon({
  size = 96,
  className,
  earned = true,
  label,
  idPrefix = "bg-sak",
}: BadgeSvgProps) {
  const tier = "platinum" as const;
  const BRANCH_COLOR = "#5A3712";
  return (
    <svg
      width={size}
      height={size}
      viewBox={BADGE_VIEWBOX}
      role="img"
      aria-label={label ?? "桜守 バッジ"}
      className={className}
      style={!earned ? { filter: "grayscale(1)", opacity: 0.55 } : undefined}
    >
      <title>{label ?? "桜守 バッジ"}</title>
      <MedallionFrameDefs tier={tier} idPrefix={idPrefix} />
      <MedallionBody tier={tier} idPrefix={idPrefix} />
      <g>
        {/* 桜の枝 (主軸 / 斜め) */}
        <path
          d="M 26 64 C 36 60 44 50 56 38 C 60 34 64 30 70 28"
          stroke={BRANCH_COLOR}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        {/* 細い小枝 */}
        <path d="M 38 56 C 36 54 34 52 32 50" stroke={BRANCH_COLOR} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M 50 44 C 52 42 54 40 56 38" stroke={BRANCH_COLOR} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M 60 36 C 58 34 56 32 54 30" stroke={BRANCH_COLOR} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* 桜の花 (5 輪 / 枝に並べる) */}
        <SakuraFlower cx={32} cy={50} r={5} />
        <SakuraFlower cx={42} cy={54} r={6} />
        <SakuraFlower cx={50} cy={44} r={5} />
        <SakuraFlower cx={58} cy={36} r={6} />
        <SakuraFlower cx={66} cy={30} r={5} />
        {/* 散り桜 (3 枚 / 中央背景に舞う) */}
        <SakuraPetal cx={36} cy={66} r={3} rotate={20} />
        <SakuraPetal cx={56} cy={68} r={3} rotate={-30} />
        <SakuraPetal cx={70} cy={56} r={2.5} rotate={45} />
      </g>
    </svg>
  );
}
