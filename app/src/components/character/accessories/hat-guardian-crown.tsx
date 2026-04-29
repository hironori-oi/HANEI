/**
 * HatGuardianCrown (W9-T2 / 帽子: 守護神冠)
 *
 * 5000 XP で解禁。Amber Gold + Gold #FFD700 で「神々しさ」を表現。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export function HatGuardianCrown({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "守護神冠" };

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
      {/* 後光 */}
      <circle cx="40" cy="40" r="34" fill="#FFD700" opacity="0.12" />
      <circle cx="40" cy="40" r="26" fill="#FFD700" opacity="0.18" />

      {/* 冠の台座 */}
      <path
        d="M12 54 L68 54 L66 60 L14 60 Z"
        fill="#F2A93A"
        stroke="#A87018"
        strokeWidth="1.2"
      />
      <rect x="14" y="58" width="52" height="2" fill="#FFD700" />

      {/* 5 つの尖頭 */}
      <path
        d="M14 54 L20 28 L26 46 L32 22 L40 50 L48 22 L54 46 L60 28 L66 54 Z"
        fill="#F2A93A"
        stroke="#A87018"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* 宝玉 */}
      <circle cx="20" cy="32" r="2" fill="#FFD700" />
      <circle cx="32" cy="26" r="2.2" fill="#C71F37" />
      <circle cx="40" cy="22" r="3" fill="#FFD700" stroke="#A87018" strokeWidth="0.8" />
      <circle cx="48" cy="26" r="2.2" fill="#1A4F8F" />
      <circle cx="60" cy="32" r="2" fill="#FFD700" />

      {/* 中央の輝き */}
      <path
        d="M40 18 L41 20 L43 20 L41.5 21.5 L42 24 L40 23 L38 24 L38.5 21.5 L37 20 L39 20 Z"
        fill="#FFFFFF"
        opacity="0.85"
      />
    </svg>
  );
}
