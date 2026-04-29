/**
 * HatSakuraCrown (W9-T2 / 帽子: 桜花冠)
 *
 * 桜の花を編んだ冠。7 日連続学習で解禁。
 * Amber Gold 主軸 + 桜色 #F8E1E7。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

function SakuraPetal({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  // 5 弁桜
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx="0"
          cy={-r * 0.8}
          rx={r * 0.5}
          ry={r * 0.85}
          fill="#F8E1E7"
          stroke="#E8A0B5"
          strokeWidth="0.6"
          transform={`rotate(${deg})`}
        />
      ))}
      <circle cx="0" cy="0" r={r * 0.32} fill="#F2A93A" />
    </g>
  );
}

export function HatSakuraCrown({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "桜花冠" };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...a11y}
    >
      {/* 冠の輪 (Amber Gold) */}
      <path
        d="M14 50 Q40 32 66 50"
        stroke="#F2A93A"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M14 52 Q40 36 66 52"
        stroke="#C4831F"
        strokeWidth="1"
        fill="none"
      />
      {/* 桜花 5 輪 */}
      <SakuraPetal cx={20} cy={48} r={6} />
      <SakuraPetal cx={32} cy={38} r={6.5} />
      <SakuraPetal cx={44} cy={34} r={7} />
      <SakuraPetal cx={56} cy={38} r={6.5} />
      <SakuraPetal cx={64} cy={48} r={6} />
    </svg>
  );
}
