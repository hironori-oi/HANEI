/**
 * WingCharmSakura (W9-T2 / 羽飾り: 桜花飾り)
 *
 * 桜守 badge で解禁。桜色 #F8E1E7 + Amber Gold の中心。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export function WingCharmSakura({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "桜花飾り" };

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
      {/* 紐 */}
      <path d="M40 8 L40 32" stroke="#D88BA5" strokeWidth="2" strokeLinecap="round" />

      {/* 大きな桜花 (5 弁) */}
      <g transform="translate(40 50)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <ellipse
              cx="0"
              cy="-12"
              rx="9"
              ry="14"
              fill="#F8E1E7"
              stroke="#D88BA5"
              strokeWidth="1.2"
            />
            {/* 花弁の切れ込み */}
            <path
              d="M0 -22 L-2 -19 L0 -16 L2 -19 Z"
              fill="#D88BA5"
              opacity="0.4"
            />
          </g>
        ))}
        {/* 雄しべ (Amber 中心) */}
        <circle cx="0" cy="0" r="5" fill="#F2A93A" stroke="#A87018" strokeWidth="0.8" />
        {[0, 72, 144, 216, 288].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <line x1="0" y1="0" x2="0" y2="-7" stroke="#FFD700" strokeWidth="0.8" />
            <circle cx="0" cy="-7" r="0.9" fill="#FFD700" />
          </g>
        ))}
      </g>

      {/* 葉 (緑) */}
      <ellipse cx="56" cy="36" rx="5" ry="2.4" fill="#6FE7C9" transform="rotate(40 56 36)" stroke="#3DA88E" strokeWidth="0.6" />
    </svg>
  );
}
