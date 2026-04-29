/**
 * HANEI - Badge Medallion Frame (W9-T3)
 *
 * 8 種 SVG で共通使用するメダル枠 + drop-shadow filter + ring gradient。
 * 各 icon はこの中央 (32, 32) 〜 (64, 64) の 32x32 領域にシンボルを描画する。
 *
 * 設計:
 *   - viewBox 96x96 統一
 *   - 外輪 = 二重 (太枠 + 細枠) → メダルらしさ
 *   - 中央背景 = radial gradient (光の集中)
 *   - drop-shadow filter で立体感 (transform/opacity のみで再 paint コスト最小)
 */

import { BADGE_TIER_PALETTE } from "./palette";
import type { BadgeTier } from "@/lib/badges/badge-codes";

interface Props {
  tier: BadgeTier;
  /** <defs> 内 id 衝突回避 */
  idPrefix: string;
}

export function MedallionFrameDefs({ tier, idPrefix }: Props) {
  const p = BADGE_TIER_PALETTE[tier];
  const ringId = `${idPrefix}-ring`;
  const bgId = `${idPrefix}-bg`;
  const shadowId = `${idPrefix}-shadow`;
  const sheenId = `${idPrefix}-sheen`;
  return (
    <defs>
      {/* 外輪 linear (上から光) */}
      <linearGradient id={ringId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={p.ringHi} />
        <stop offset="55%" stopColor={p.ringMain} />
        <stop offset="100%" stopColor={p.ringShade} />
      </linearGradient>
      {/* 中央背景 radial (光の集中) */}
      <radialGradient id={bgId} cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor={p.bgStartA} />
        <stop offset="100%" stopColor={p.bgStartB} />
      </radialGradient>
      {/* drop-shadow filter (立体感) */}
      <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
        <feOffset dx="0" dy="1.5" result="offsetblur" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.45" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* 上ハイライトの細い弧 (光沢) */}
      <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

/** メダル本体 (中央背景 + リング + 光沢) を描画する。シンボルは呼び出し側で重ねる。 */
export function MedallionBody({ tier, idPrefix }: Props) {
  const ringId = `${idPrefix}-ring`;
  const bgId = `${idPrefix}-bg`;
  const shadowId = `${idPrefix}-shadow`;
  const sheenId = `${idPrefix}-sheen`;
  const p = BADGE_TIER_PALETTE[tier];
  return (
    <g filter={`url(#${shadowId})`}>
      {/* 外輪 (太枠) */}
      <circle cx="48" cy="48" r="40" fill={`url(#${ringId})`} />
      {/* 内輪 (細枠) */}
      <circle
        cx="48"
        cy="48"
        r="34"
        fill={`url(#${bgId})`}
        stroke={p.ringShade}
        strokeWidth="0.6"
        opacity="0.96"
      />
      {/* 上方光沢 (4-5 時方向に薄い弧) */}
      <path
        d="M 18 30 A 30 30 0 0 1 78 30"
        stroke={`url(#${sheenId})`}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}
