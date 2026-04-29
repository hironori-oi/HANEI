/**
 * ScarfKasuri (W9-T2 / マフラー: 紺絣マフラー)
 *
 * 14 日連続で解禁。藍染めの絣模様。Navy #1A4F8F + ベージュ。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export function ScarfKasuri({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "紺絣マフラー" };

  // 絣 (kasuri) パターン: 十字模様の繰り返し
  const kasuri: { x: number; y: number }[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      kasuri.push({ x: 18 + col * 8, y: 32 + row * 6 });
    }
  }

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
      {/* マフラー本体 */}
      <path
        d="M14 30 Q40 38 66 30 L66 46 Q40 54 14 46 Z"
        fill="#1A4F8F"
        stroke="#0F3A6B"
        strokeWidth="1.2"
      />
      {/* 絣模様 (十字) */}
      {kasuri.map((p, i) => (
        <g key={i}>
          <rect x={p.x - 1.5} y={p.y - 0.4} width="3" height="0.8" fill="#F2E8C9" opacity="0.85" />
          <rect x={p.x - 0.4} y={p.y - 1.5} width="0.8" height="3" fill="#F2E8C9" opacity="0.85" />
        </g>
      ))}
      {/* 垂れ (左) */}
      <path
        d="M22 46 L18 70 L28 70 L30 48 Z"
        fill="#1A4F8F"
        stroke="#0F3A6B"
        strokeWidth="1"
      />
      <rect x="22" y="58" width="3" height="0.8" fill="#F2E8C9" />
      <rect x="23" y="56" width="0.8" height="3" fill="#F2E8C9" />
      {/* フリンジ */}
      <line x1="20" y1="70" x2="20" y2="74" stroke="#0F3A6B" strokeWidth="1.2" />
      <line x1="23" y1="70" x2="23" y2="75" stroke="#0F3A6B" strokeWidth="1.2" />
      <line x1="26" y1="70" x2="26" y2="74" stroke="#0F3A6B" strokeWidth="1.2" />
      {/* 垂れ (右) */}
      <path
        d="M50 48 L52 70 L62 70 L58 46 Z"
        fill="#1A4F8F"
        stroke="#0F3A6B"
        strokeWidth="1"
      />
      <rect x="55" y="58" width="3" height="0.8" fill="#F2E8C9" />
      <rect x="56" y="56" width="0.8" height="3" fill="#F2E8C9" />
      <line x1="54" y1="70" x2="54" y2="74" stroke="#0F3A6B" strokeWidth="1.2" />
      <line x1="57" y1="70" x2="57" y2="75" stroke="#0F3A6B" strokeWidth="1.2" />
      <line x1="60" y1="70" x2="60" y2="74" stroke="#0F3A6B" strokeWidth="1.2" />
    </svg>
  );
}
