/**
 * WingCharmMoonlight (W9-T2 / 羽飾り: 月光ペンダント)
 *
 * 10000 XP 達成で解禁。三日月モチーフ + 銀色 + 金線アクセント + 星のきらめき。
 * Amber Gold をサブとし、夜空の銀 (#D9E6F2) を主軸にしたプレミアム感。
 */

interface AccessorySvgProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

const MOON_SILVER = "#D9E6F2";
const MOON_SILVER_DEEP = "#7E96A8";
const NIGHT_BLUE = "#1B2A45";
const AMBER_GOLD = "#F2A93A";
const STAR_WHITE = "#FFFFFF";

export function WingCharmMoonlight({
  className,
  decorative = false,
  size = 80,
}: AccessorySvgProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "月光ペンダント" };

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
        {/* 月の銀色グラデーション */}
        <radialGradient id="moonlight-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={STAR_WHITE} />
          <stop offset="60%" stopColor={MOON_SILVER} />
          <stop offset="100%" stopColor={MOON_SILVER_DEEP} />
        </radialGradient>
        {/* 夜空の暈 (背景) */}
        <radialGradient id="moonlight-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={NIGHT_BLUE} stopOpacity="0.55" />
          <stop offset="100%" stopColor={NIGHT_BLUE} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 紐 */}
      <path
        d="M40 6 L40 24"
        stroke={AMBER_GOLD}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M36 6 Q40 2 44 6"
        stroke={AMBER_GOLD}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />

      {/* 夜空の暈 (ペンダントの背景) */}
      <circle cx="40" cy="48" r="26" fill="url(#moonlight-aura)" />

      {/* ペンダントの外輪 (Amber Gold の細リング) */}
      <circle
        cx="40"
        cy="48"
        r="20"
        fill="none"
        stroke={AMBER_GOLD}
        strokeWidth="1.6"
      />
      <circle
        cx="40"
        cy="48"
        r="18.5"
        fill={NIGHT_BLUE}
        opacity="0.85"
      />

      {/* 三日月本体 (中央) */}
      <path
        d="M 33 38
           C 28 42, 27 54, 33 58
           C 30 56, 28.5 53, 28.5 48
           C 28.5 43, 30 40, 33 38 Z"
        fill="url(#moonlight-grad)"
        stroke={MOON_SILVER_DEEP}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M 33 38
           C 41 38, 48 43, 48 48
           C 48 53, 41 58, 33 58
           C 38 54, 41 51, 41 48
           C 41 45, 38 42, 33 38 Z"
        fill={NIGHT_BLUE}
        opacity="0.0"
      />

      {/* 星 (きらめき / 3 個) */}
      <g>
        {/* 星 1 (右上) */}
        <path
          d="M 50 36 L 51 38.5 L 53.5 39 L 51.3 40.4 L 51.7 43 L 50 41.5 L 48.3 43 L 48.7 40.4 L 46.5 39 L 49 38.5 Z"
          fill={STAR_WHITE}
          opacity="0.9"
        />
        {/* 星 2 (左下) */}
        <path
          d="M 28 60 L 28.7 61.5 L 30.3 61.8 L 29 62.7 L 29.3 64.3 L 28 63.4 L 26.7 64.3 L 27 62.7 L 25.7 61.8 L 27.3 61.5 Z"
          fill={STAR_WHITE}
          opacity="0.85"
        />
        {/* 星 3 (中央上 / 小) */}
        <circle cx="44" cy="34" r="0.9" fill={STAR_WHITE} opacity="0.95" />
        {/* 月の表面の微光 */}
        <circle cx="34" cy="44" r="1.2" fill={STAR_WHITE} opacity="0.7" />
      </g>

      {/* 上部留具 (Amber Gold) */}
      <ellipse cx="40" cy="26" rx="3.6" ry="2" fill={AMBER_GOLD} />
      <ellipse cx="40" cy="25.4" rx="2.6" ry="1.2" fill="#FFD700" />

      {/* 月光が漏れる光 (細い 4 線) */}
      <g stroke={STAR_WHITE} strokeWidth="0.8" strokeLinecap="round" opacity="0.55">
        <line x1="40" y1="20" x2="40" y2="22" />
        <line x1="58" y1="48" x2="60" y2="48" />
        <line x1="20" y1="48" x2="22" y2="48" />
        <line x1="40" y1="74" x2="40" y2="76" />
      </g>
    </svg>
  );
}
