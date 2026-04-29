/**
 * HANEI - Badge SVG Palette (W9-T3)
 *
 * 8 種 inline SVG で共通使用する color tokens / viewBox / 共通 props 定義。
 * Tier 別 palette を定義し、各 icon ファイルから import する。
 */

import type { BadgeTier } from "@/lib/badges/badge-codes";

export const BADGE_VIEWBOX = "0 0 96 96" as const;

export interface BadgeSvgProps {
  /** 表示サイズ (px) */
  size?: number;
  className?: string;
  /** 取得済かどうか (false 時は呼び出し側でグレースケール filter を当てる) */
  earned?: boolean;
  /** aria-label (sr-only / 取得済 badge 名) */
  label?: string;
  /** SVG 内 <defs> の id 衝突回避用 prefix (gradient / filter id) */
  idPrefix?: string;
}

/**
 * Tier 別の palette。各 icon は Tier に対応する色相を主軸に描画する。
 * Amber Gold (#F2A93A) が HANEI ブランドの主軸 → bronze / gold で多用。
 */
export const BADGE_TIER_PALETTE: Readonly<
  Record<
    BadgeTier,
    {
      /** 外輪 / メダルの主色 */
      ringMain: string;
      /** 外輪のハイライト */
      ringHi: string;
      /** 外輪の影 */
      ringShade: string;
      /** 中央背景 (gradient stop A) */
      bgStartA: string;
      /** 中央背景 (gradient stop B) */
      bgStartB: string;
      /** アクセント (シンボル / 数字 / 線) */
      accent: string;
      /** アクセント強調 */
      accentDeep: string;
    }
  >
> = {
  bronze: {
    ringMain: "#CD7F32",
    ringHi: "#F2A93A",
    ringShade: "#8C5A22",
    bgStartA: "#FCEAC2",
    bgStartB: "#F2A93A",
    accent: "#5A3712",
    accentDeep: "#2E1A06",
  },
  silver: {
    ringMain: "#C0C0C0",
    ringHi: "#FFFFFF",
    ringShade: "#7F7F7F",
    bgStartA: "#F4F4F4",
    bgStartB: "#C0C0C0",
    accent: "#3A3A3A",
    accentDeep: "#1F1F1F",
  },
  gold: {
    ringMain: "#F2A93A",
    ringHi: "#FFD700",
    ringShade: "#A77118",
    bgStartA: "#FFE9A8",
    bgStartB: "#F2A93A",
    accent: "#5A3712",
    accentDeep: "#2E1A06",
  },
  platinum: {
    ringMain: "#E5E4E2",
    ringHi: "#FFFFFF",
    ringShade: "#A1A0A0",
    bgStartA: "#FFFFFF",
    bgStartB: "#F8E1E7",
    accent: "#9A4D6A",
    accentDeep: "#603145",
  },
};

/** 桜ピンクのアクセント色 (platinum や sakura_keeper の petals) */
export const SAKURA_PINK = "#FFB7C5" as const;
export const SAKURA_PINK_DEEP = "#F198A9" as const;
/** Amber Gold (HANEI ブランド主軸) */
export const AMBER_GOLD = "#F2A93A" as const;
