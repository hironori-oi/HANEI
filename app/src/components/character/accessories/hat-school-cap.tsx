/**
 * HatSchoolCap (W9-T2 / 帽子: 学帽)
 *
 * inline JSX SVG / viewBox 0 0 80 80 / Amber Gold 主軸。
 * character SVG 240px の top-center に重ねる前提で 80×80 の小サイズ。
 * decorative=true 時は role="img" + aria-label を付けない (親 SVG の一部)。
 */

interface AccessorySvgProps {
  className?: string;
  /** 一覧表示用 (true) / character 上での装着 (false) */
  decorative?: boolean;
  size?: number;
}

export function HatSchoolCap({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "学帽" };

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
      {/* 鍔 */}
      <ellipse cx="40" cy="55" rx="32" ry="6" fill="#1A1A2E" />
      <ellipse cx="40" cy="53" rx="32" ry="4" fill="#2D2D44" />
      {/* 帽子本体 */}
      <path
        d="M14 50 Q14 22 40 18 Q66 22 66 50 Z"
        fill="#1A4F8F"
        stroke="#0F3A6B"
        strokeWidth="1.5"
      />
      {/* ハイライト */}
      <path
        d="M22 44 Q22 26 40 23"
        stroke="#3A7FBF"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      {/* 校章 (Amber Gold 桜花) */}
      <circle cx="40" cy="38" r="6" fill="#F2A93A" stroke="#C4831F" strokeWidth="1" />
      <path
        d="M40 34 L41 37 L44 37 L41.5 39 L42.5 42 L40 40 L37.5 42 L38.5 39 L36 37 L39 37 Z"
        fill="#FFD700"
      />
    </svg>
  );
}
