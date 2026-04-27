/**
 * Skill Radar Chart (W4 / T-1)
 *
 * 4 技能 (vocab / grammar / reading / listening) を 0-1 で受け取り、
 * SVG のレーダーチャートに描画する。
 *
 * 仕様:
 *  - 外部 chart ライブラリ追加不可 (W4 制約)
 *  - 4 軸 (90 度等分) で SVG <polygon> を描画
 *  - aria-label で "語彙 70%, 文法 60%, 読解 50%, リスニング 40%" を読み上げ
 *  - 配色は Amber Gold tone (DEC-004)
 *
 * Server Component (interaction なし)
 */

import type { SkillScores } from "@/lib/study/aggregations";

interface SkillRadarChartProps {
  scores: SkillScores;
  /** SVG の viewBox サイズ。レスポンシブには className 経由で width/height を指定する。 */
  size?: number;
}

const LABELS: Array<{ key: keyof SkillScores; label: string }> = [
  { key: "vocab", label: "語彙" },
  { key: "grammar", label: "文法" },
  { key: "reading", label: "読解" },
  { key: "listening", label: "リスニング" },
];

export function SkillRadarChart({ scores, size = 240 }: SkillRadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.7;

  // 4 軸: 上 / 右 / 下 / 左 (vocab / grammar / reading / listening)
  const angles = [
    -Math.PI / 2, // top
    0, // right
    Math.PI / 2, // bottom
    Math.PI, // left
  ];

  const points = LABELS.map((L, i) => {
    const score = clamp01(scores[L.key]);
    const angle = angles[i] ?? 0;
    const r = radius * score;
    return {
      key: L.key,
      label: L.label,
      score,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      labelX: cx + Math.cos(angle) * (radius + 14),
      labelY: cy + Math.sin(angle) * (radius + 14),
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // 25% / 50% / 75% / 100% のガイド
  const guideRadii = [0.25, 0.5, 0.75, 1].map((f) => radius * f);

  // Axis lines
  const axisLines = angles.map((angle, i) => ({
    key: i,
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  }));

  const ariaLabel = LABELS.map(
    (L) => `${L.label} ${Math.round(clamp01(scores[L.key]) * 100)}%`,
  ).join(", ");

  return (
    <svg
      role="img"
      aria-label={`4技能スコア: ${ariaLabel}`}
      viewBox={`0 0 ${size} ${size}`}
      className="h-auto w-full max-w-xs"
    >
      {/* Guide circles */}
      {guideRadii.map((r, i) => (
        <circle
          key={`guide-${i}`}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {axisLines.map((a) => (
        <line
          key={`axis-${a.key}`}
          x1={cx}
          y1={cy}
          x2={a.x}
          y2={a.y}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
        />
      ))}

      {/* Score polygon */}
      <polygon
        points={polygonPoints}
        fill="rgb(242 169 58 / 0.4)"
        stroke="rgb(242 169 58)"
        strokeWidth={2}
      />

      {/* Score points */}
      {points.map((p) => (
        <circle
          key={`pt-${p.key}`}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill="rgb(242 169 58)"
        />
      ))}

      {/* Labels */}
      {points.map((p) => (
        <text
          key={`lbl-${p.key}`}
          x={p.labelX}
          y={p.labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fill="currentColor"
          aria-hidden="true"
        >
          {p.label} {Math.round(p.score * 100)}%
        </text>
      ))}
    </svg>
  );
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
