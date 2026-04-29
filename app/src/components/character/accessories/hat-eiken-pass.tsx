/**
 * HatEikenPass (W9-T2 / 帽子: 受験合格鉢巻)
 *
 * 模試デビュー badge で解禁。深紅 #C71F37 に金文字「合」。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export function HatEikenPass({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "受験合格鉢巻" };

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
      {/* 鉢巻本体 */}
      <rect x="6" y="34" width="68" height="14" rx="2" fill="#FFFFFF" stroke="#C71F37" strokeWidth="1.5" />
      <rect x="6" y="34" width="68" height="3" fill="#C71F37" />
      <rect x="6" y="45" width="68" height="3" fill="#C71F37" />

      {/* 結び目 (左) */}
      <path d="M2 36 L8 38 L8 44 L2 46 Z" fill="#C71F37" />
      <path d="M0 30 L4 36 L0 42 Z" fill="#A01829" />
      <path d="M0 50 L4 44 L0 38 Z" fill="#A01829" />

      {/* 結び目 (右) */}
      <path d="M78 36 L72 38 L72 44 L78 46 Z" fill="#C71F37" />
      <path d="M80 30 L76 36 L80 42 Z" fill="#A01829" />
      <path d="M80 50 L76 44 L80 38 Z" fill="#A01829" />

      {/* 中央「合」 */}
      <text
        x="40"
        y="46"
        textAnchor="middle"
        fontFamily="'Hiragino Mincho ProN', serif"
        fontSize="13"
        fontWeight="bold"
        fill="#F2A93A"
      >
        合
      </text>
    </svg>
  );
}
