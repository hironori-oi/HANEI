/**
 * ScarfSakura (W9-T2 / マフラー: 桜柄スカーフ)
 *
 * 30 日連続学習 (桜守) で解禁。桜色 #F8E1E7 主軸 + 桜花散らし模様。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export function ScarfSakura({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "桜柄スカーフ" };

  const flowers = [
    { x: 22, y: 36 },
    { x: 32, y: 42 },
    { x: 44, y: 36 },
    { x: 56, y: 42 },
    { x: 22, y: 56 },
    { x: 56, y: 56 },
  ];

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
      {/* スカーフ本体 (桜色) */}
      <path
        d="M14 30 Q40 38 66 30 L66 46 Q40 54 14 46 Z"
        fill="#F8E1E7"
        stroke="#D88BA5"
        strokeWidth="1.2"
      />
      {/* 桜花散らし */}
      {flowers.map((f, i) => (
        <g key={i} transform={`translate(${f.x} ${f.y})`}>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse
              key={deg}
              cx="0"
              cy="-2.2"
              rx="1.4"
              ry="2.4"
              fill="#FFFFFF"
              stroke="#D88BA5"
              strokeWidth="0.4"
              transform={`rotate(${deg})`}
            />
          ))}
          <circle cx="0" cy="0" r="0.9" fill="#F2A93A" />
        </g>
      ))}
      {/* 垂れ (左) */}
      <path
        d="M22 46 L18 70 L28 70 L30 48 Z"
        fill="#F8E1E7"
        stroke="#D88BA5"
        strokeWidth="1"
      />
      {/* フリンジ */}
      <line x1="20" y1="70" x2="20" y2="74" stroke="#D88BA5" strokeWidth="1.2" />
      <line x1="23" y1="70" x2="23" y2="75" stroke="#D88BA5" strokeWidth="1.2" />
      <line x1="26" y1="70" x2="26" y2="74" stroke="#D88BA5" strokeWidth="1.2" />
      {/* 垂れ (右) */}
      <path
        d="M50 48 L52 70 L62 70 L58 46 Z"
        fill="#F8E1E7"
        stroke="#D88BA5"
        strokeWidth="1"
      />
      <line x1="54" y1="70" x2="54" y2="74" stroke="#D88BA5" strokeWidth="1.2" />
      <line x1="57" y1="70" x2="57" y2="75" stroke="#D88BA5" strokeWidth="1.2" />
      <line x1="60" y1="70" x2="60" y2="74" stroke="#D88BA5" strokeWidth="1.2" />
    </svg>
  );
}
