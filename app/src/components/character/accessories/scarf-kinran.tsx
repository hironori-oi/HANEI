/**
 * ScarfKinran (W9-T2 / マフラー: 金襴マフラー)
 *
 * 3000 XP で解禁。金糸織り = Gold #FFD700 + Amber #F2A93A の華やかな織物。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export function ScarfKinran({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "金襴マフラー" };

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
      <defs>
        <linearGradient id="kinran-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F2A93A" />
          <stop offset="50%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#F2A93A" />
        </linearGradient>
      </defs>
      {/* マフラー本体 */}
      <path
        d="M14 30 Q40 38 66 30 L66 46 Q40 54 14 46 Z"
        fill="url(#kinran-gradient)"
        stroke="#A87018"
        strokeWidth="1.2"
      />
      {/* 横縞 (金糸織り) */}
      <path d="M14 34 Q40 42 66 34" stroke="#FFD700" strokeWidth="0.6" fill="none" />
      <path d="M14 38 Q40 46 66 38" stroke="#A87018" strokeWidth="0.5" fill="none" opacity="0.5" />
      <path d="M14 42 Q40 50 66 42" stroke="#FFD700" strokeWidth="0.6" fill="none" />
      {/* 菱形紋様 */}
      {[24, 36, 48, 56].map((x, i) => (
        <g key={i} transform={`translate(${x} 38)`}>
          <path d="M0 -2 L2 0 L0 2 L-2 0 Z" fill="#A87018" opacity="0.85" />
          <path d="M0 -1 L1 0 L0 1 L-1 0 Z" fill="#FFD700" />
        </g>
      ))}
      {/* 垂れ (左) */}
      <path
        d="M22 46 L18 70 L28 70 L30 48 Z"
        fill="url(#kinran-gradient)"
        stroke="#A87018"
        strokeWidth="1"
      />
      <line x1="20" y1="70" x2="20" y2="74" stroke="#A87018" strokeWidth="1.2" />
      <line x1="23" y1="70" x2="23" y2="75" stroke="#A87018" strokeWidth="1.2" />
      <line x1="26" y1="70" x2="26" y2="74" stroke="#A87018" strokeWidth="1.2" />
      {/* 垂れ (右) */}
      <path
        d="M50 48 L52 70 L62 70 L58 46 Z"
        fill="url(#kinran-gradient)"
        stroke="#A87018"
        strokeWidth="1"
      />
      <line x1="54" y1="70" x2="54" y2="74" stroke="#A87018" strokeWidth="1.2" />
      <line x1="57" y1="70" x2="57" y2="75" stroke="#A87018" strokeWidth="1.2" />
      <line x1="60" y1="70" x2="60" y2="74" stroke="#A87018" strokeWidth="1.2" />
    </svg>
  );
}
