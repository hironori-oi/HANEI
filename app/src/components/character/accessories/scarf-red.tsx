/**
 * ScarfRed (W9-T2 / マフラー: 赤マフラー)
 *
 * レベル 3 で解禁。深紅 #C71F37 のシンプルなマフラー。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export function ScarfRed({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "赤マフラー" };

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
      {/* マフラー本体 (首巻き) */}
      <path
        d="M14 30 Q40 38 66 30 L66 44 Q40 52 14 44 Z"
        fill="#C71F37"
        stroke="#8C0F25"
        strokeWidth="1.2"
      />
      {/* 編み目ハイライト */}
      <path
        d="M14 36 Q40 44 66 36"
        stroke="#E94560"
        strokeWidth="1"
        fill="none"
        opacity="0.7"
      />
      {/* 垂れ (左) */}
      <path
        d="M22 44 L18 70 L28 70 L30 46 Z"
        fill="#C71F37"
        stroke="#8C0F25"
        strokeWidth="1"
      />
      {/* フリンジ */}
      <line x1="20" y1="70" x2="20" y2="74" stroke="#8C0F25" strokeWidth="1.2" />
      <line x1="23" y1="70" x2="23" y2="75" stroke="#8C0F25" strokeWidth="1.2" />
      <line x1="26" y1="70" x2="26" y2="74" stroke="#8C0F25" strokeWidth="1.2" />
      {/* 垂れ (右) */}
      <path
        d="M50 46 L52 70 L62 70 L58 44 Z"
        fill="#C71F37"
        stroke="#8C0F25"
        strokeWidth="1"
      />
      <line x1="54" y1="70" x2="54" y2="74" stroke="#8C0F25" strokeWidth="1.2" />
      <line x1="57" y1="70" x2="57" y2="75" stroke="#8C0F25" strokeWidth="1.2" />
      <line x1="60" y1="70" x2="60" y2="74" stroke="#8C0F25" strokeWidth="1.2" />
    </svg>
  );
}
