/**
 * HANEI - ことだまトリ 進化進捗 円弧 (W9-T1)
 *
 * 各 stage SVG の周囲に配置する「次段階まであと N XP」の円弧 progress glow。
 * Stage SVG 内部に <ProgressArc/> を埋め込んで利用する。
 *
 * - SVG path の strokeDasharray でドーナツ円弧を描画
 * - 0..1 の progress に応じて達成弧を amber で塗る
 * - ベース弧は base 色 (透明感)
 * - 60fps: 単純な path / 動的 strokeDashoffset のみ (再描画は React 側が制御)
 */

import { KOTODAMA_COLORS } from "./colors";

interface Props {
  /** 円の中心 x */
  cx: number;
  /** 円の中心 y */
  cy: number;
  /** 円の半径 */
  r: number;
  /** 0..1 の進捗 */
  progress: number;
  /** 弧の太さ */
  strokeWidth?: number;
  /** 達成色 (default: Amber Gold) */
  fillColor?: string;
}

export function ProgressArc({
  cx,
  cy,
  r,
  progress,
  strokeWidth = 4,
  fillColor = KOTODAMA_COLORS.progressFill,
}: Props) {
  const safe = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const circumference = 2 * Math.PI * r;
  // 上を 12 時方向に揃える: -90deg 回転 (transform で実現)
  return (
    <g transform={`rotate(-90 ${cx} ${cy})`} opacity="0.85">
      {/* track (未達成) */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={KOTODAMA_COLORS.progressTrack}
        strokeWidth={strokeWidth}
        strokeOpacity={0.35}
        strokeLinecap="round"
      />
      {/* fill (達成) */}
      {safe > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * safe} ${circumference}`}
        />
      )}
    </g>
  );
}
