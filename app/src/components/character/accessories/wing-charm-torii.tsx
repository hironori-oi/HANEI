/**
 * WingCharmTorii (W9-T2 / 羽飾り: 鳥居型お守り)
 *
 * 21 日連続学習で解禁。朱色 #C71F37 の鳥居型シルエット。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export function WingCharmTorii({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "鳥居型お守り" };

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
      <path d="M40 4 L40 16" stroke="#A87018" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="14" r="2.5" fill="#F2A93A" />

      {/* お守り台座 (角丸長方形) */}
      <rect
        x="14"
        y="20"
        width="52"
        height="56"
        rx="4"
        fill="#C71F37"
        stroke="#8C0F25"
        strokeWidth="1.5"
      />
      {/* 内枠の金線 */}
      <rect
        x="18"
        y="24"
        width="44"
        height="48"
        rx="2"
        fill="none"
        stroke="#FFD700"
        strokeWidth="1"
        opacity="0.6"
      />

      {/* 鳥居シルエット */}
      <g transform="translate(40 50)">
        {/* 笠木 (上部の最上段) */}
        <rect x="-18" y="-16" width="36" height="3" fill="#F2A93A" />
        <path d="M-22 -16 L-18 -16 L-18 -13 L-22 -13 Z" fill="#A87018" />
        <path d="M22 -16 L18 -16 L18 -13 L22 -13 Z" fill="#A87018" />
        {/* 島木 */}
        <rect x="-15" y="-11" width="30" height="2" fill="#F2A93A" />
        {/* 柱 (左右) */}
        <rect x="-12" y="-9" width="3.5" height="20" fill="#F2A93A" />
        <rect x="8.5" y="-9" width="3.5" height="20" fill="#F2A93A" />
        {/* 貫 (下の横棒) */}
        <rect x="-13" y="-3" width="26" height="2" fill="#F2A93A" />
      </g>

      {/* 「守」文字 */}
      <text
        x="40"
        y="70"
        textAnchor="middle"
        fontFamily="'Hiragino Mincho ProN', serif"
        fontSize="9"
        fontWeight="bold"
        fill="#FFD700"
      >
        守
      </text>
    </svg>
  );
}
