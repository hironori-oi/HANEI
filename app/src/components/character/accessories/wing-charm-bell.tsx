/**
 * WingCharmBell (W9-T2 / 羽飾り: 鈴)
 *
 * 初期所持アクセサリ。Amber Gold の鈴 + 朱赤の紐。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export function WingCharmBell({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "鈴" };

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
      <path d="M40 8 L40 30" stroke="#C71F37" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 8 Q40 4 44 8" stroke="#C71F37" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* 鈴の本体 */}
      <path
        d="M40 30
           C 24 30, 18 42, 18 52
           C 18 60, 24 64, 40 64
           C 56 64, 62 60, 62 52
           C 62 42, 56 30, 40 30 Z"
        fill="#F2A93A"
        stroke="#A87018"
        strokeWidth="1.5"
      />
      {/* ハイライト */}
      <ellipse cx="32" cy="42" rx="6" ry="3" fill="#FFD700" opacity="0.6" />
      {/* 中央の切れ目 */}
      <path d="M22 54 L58 54" stroke="#A87018" strokeWidth="1.5" />
      {/* 縦切れ目 */}
      <path d="M40 54 L40 64" stroke="#A87018" strokeWidth="1.2" />
      {/* 鈴の輪 (上部) */}
      <ellipse cx="40" cy="30" rx="6" ry="2" fill="#A87018" />
      <ellipse cx="40" cy="29" rx="5" ry="1.4" fill="#F2A93A" />
      {/* 鈴の打ち子 (下) */}
      <circle cx="40" cy="68" r="3.5" fill="#FFD700" stroke="#A87018" strokeWidth="0.8" />
    </svg>
  );
}
