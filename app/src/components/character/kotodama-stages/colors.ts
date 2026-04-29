/**
 * HANEI - ことだまトリ 5 段階 SVG パレット (W9-T1)
 *
 * 5 段階で一貫使用する color palette。
 * Amber Gold #F2A93A 主軸 / 過剰演出禁止 / 和の美意識。
 *
 * 60fps を維持するため SVG 内 animate は CSS transform / opacity 相当に限定。
 */
export const KOTODAMA_COLORS = {
  /** ベース羽色 (Amber Gold light) */
  base: "#F4D08C",
  /** 主体色 (HANEI Amber Gold) */
  primary: "#F2A93A",
  /** 強調色 (深茶 / 嘴 / 足) */
  accent: "#7B4F1B",
  /** 影 (羽の陰影) */
  shadow: "#C98A2E",
  /** 守護神 accent (gold) */
  gold: "#FFD700",
  /** 守護神 オーラ (淡 amber / 桜寄り) */
  aura: "#FFE7A0",
  /** 桜ピンク (進化アクセント / 守護神) */
  sakura: "#FFB7C5",
  /** 葉緑 (賢者の巻物紐 / 装飾) */
  green: "#6FA868",
  /** 白 (ハイライト) */
  white: "#FFFFFF",
  /** 黒 (目 / 線) */
  black: "#2A1B0A",
  /** プログレス円弧 (未達成部分) */
  progressTrack: "#F4D08C",
  /** プログレス円弧 (達成部分) */
  progressFill: "#F2A93A",
} as const;

export const KOTODAMA_VIEWBOX = "0 0 240 240" as const;

export interface KotodamaStageSvgProps {
  /** 表示サイズ (px) */
  size?: number;
  className?: string;
  /** aria-label / sr-only ラベル */
  label?: string;
  /**
   * 進化判定時の特別アニメーション (1.5s) を発火させるか。
   * - false (default): 静止 / 通常 idle
   * - true: SVG 内 <animate> で羽ばたき / 光のオーラを 1 周再生
   * prefers-reduced-motion 環境では呼び出し側で false に倒す。
   */
  animate?: boolean;
  /** 0..1 の進捗 (次段階までの達成度) — 円弧 progress glow に反映 */
  progress?: number;
}
