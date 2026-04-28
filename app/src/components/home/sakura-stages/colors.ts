/**
 * HANEI - 桜の木 SVG パレット (W8-T6)
 *
 * 7 段階で一貫使用する color palette。
 * 和の美意識重視 / ポップすぎず / amber gold は最終段階のアクセントのみ。
 */
export const SAKURA_COLORS = {
  /** 桜ピンク (花びら / 蕾) */
  pink: "#FFB7C5",
  /** 桜濃ピンク (花の中心 / 影) */
  pinkDeep: "#F198A9",
  /** 葉緑 (葉 / 芽 / 若葉) */
  green: "#6FA868",
  /** 葉緑 (濃) */
  greenDeep: "#558851",
  /** 種茶 (種 / 樹皮の影) */
  brownSeed: "#8B5C2A",
  /** 幹茶 */
  trunk: "#654321",
  /** 土色 */
  soil: "#A47A4A",
  /** Amber gold (HANEI ブランド / 最終段階のアクセント) */
  amberGold: "#F2A93A",
  /** 白 (花の中心ハイライト) */
  white: "#FFFFFF",
} as const;

export const SAKURA_VIEWBOX = "0 0 120 120" as const;

export interface SakuraSvgProps {
  /** 表示サイズ (px) */
  size?: number;
  className?: string;
  /** aria-label / sr-only ラベル */
  label?: string;
}
