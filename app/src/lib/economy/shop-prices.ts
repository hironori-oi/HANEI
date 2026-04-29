/**
 * HANEI - Shop 価格 + アイテム定義 (W10-T2 / DEC-056 案B)
 *
 * `/shop` ページで購入できる 2 category × 4 item の価格 / 説明 / 上限を定数化。
 * 将来の価格調整 (β feedback / W10-T3 Daily Quest 報酬とのバランス調整) を容易にする。
 *
 * 不変条件:
 *   - SHOP_ITEMS のキーは learner_inventory.item_type の enum と完全一致
 *   - SHOP_ITEMS の reason は coin_transactions.reason の enum と一致
 *     (freeze_purchase / feed_purchase のいずれか)
 *   - price は正の整数 / maxQuantity は 1 以上 (またはアイテム種に応じた上限)
 *
 * DEC-056 アクセサリ category は出さない (W9-B 解禁条件のみが唯一の獲得経路)。
 */

import type { CoinReason } from "./ledger";

// ---------------------------------------------------------------------------
// アイテム種 / カテゴリ
// ---------------------------------------------------------------------------

export const SHOP_ITEM_TYPES = [
  "streak_freeze",
  "kotodama_feed_normal",
  "kotodama_feed_premium",
  "kotodama_feed_rainy",
] as const;

export type ShopItemType = (typeof SHOP_ITEM_TYPES)[number];

export function isShopItemType(value: string): value is ShopItemType {
  return (SHOP_ITEM_TYPES as ReadonlyArray<string>).includes(value);
}

export const SHOP_CATEGORIES = ["streak", "feed"] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export const SHOP_CATEGORY_LABEL_JA: Readonly<
  Record<ShopCategory, { label: string; furigana: string; description: string }>
> = {
  streak: {
    label: "Streak アイテム",
    furigana: "ストリーク アイテム",
    description: "毎日 れんぞくの きろくを まもる アイテム",
  },
  feed: {
    label: "ことだまトリの エサ",
    furigana: "ことだまトリの エサ",
    description: "ことだまトリの きぶんが よくなる エサ",
  },
};

// ---------------------------------------------------------------------------
// アイテム定義
// ---------------------------------------------------------------------------

export interface ShopItemDef {
  /** 在庫テーブル / Server Action で使う識別子 */
  type: ShopItemType;
  /** 表示カテゴリ */
  category: ShopCategory;
  /** 表示名 (子ども向け語感 / ふりがな込みも可) */
  name: string;
  /** ふりがな (ruby 用 / aria-label 用) */
  furigana: string;
  /** 子ども向け説明 (1〜2 文 / ふりがな簡易) */
  description: string;
  /** 価格 (ハネキン) / 正の整数 */
  price: number;
  /**
   * 1 学習者あたりの最大保持数。null の場合は実質無制限 (feed は使い切り想定)。
   */
  maxQuantity: number | null;
  /** 取引 reason (coin_transactions.reason に記録される) */
  reason: Extract<CoinReason, "freeze_purchase" | "feed_purchase">;
}

/**
 * Shop で販売される全アイテム (DEC-056 §価格設計)。
 *
 *   - Streak Freeze: 30 ハネキン / 1 個 (max 5 個)
 *   - 普通エサ:     5 ハネキン / 1 個 (mood +1)
 *   - 特上エサ:     20 ハネキン / 1 個 (mood +3 + 24h 持続)
 *   - 雨の日エサ:   15 ハネキン / 1 個 (Phase 3 / 価格枠だけ確保)
 */
export const SHOP_ITEMS: Readonly<Record<ShopItemType, ShopItemDef>> = {
  streak_freeze: {
    type: "streak_freeze",
    category: "streak",
    name: "Streak Freeze",
    furigana: "ストリーク フリーズ",
    description:
      "1 にち がんばれなくても、れんぞくきろくが きえないように まもる アイテム。",
    price: 30,
    maxQuantity: 5,
    reason: "freeze_purchase",
  },
  kotodama_feed_normal: {
    type: "kotodama_feed_normal",
    category: "feed",
    name: "ふつうの エサ",
    furigana: "ふつうの エサ",
    description: "ことだまトリの きぶんが ちょっぴり よくなる ふつうの エサ。",
    price: 5,
    maxQuantity: null,
    reason: "feed_purchase",
  },
  kotodama_feed_premium: {
    type: "kotodama_feed_premium",
    category: "feed",
    name: "とくじょうの エサ",
    furigana: "とくじょうの エサ",
    description: "ことだまトリが おおよろこびする エサ。きぶんアップが 24 じかん つづく。",
    price: 20,
    maxQuantity: null,
    reason: "feed_purchase",
  },
  kotodama_feed_rainy: {
    type: "kotodama_feed_rainy",
    category: "feed",
    name: "あめの日 エサ",
    furigana: "あめの日 エサ",
    description: "あめの日に ぴったりの エサ。これからの アップデートで つかえるよ。",
    price: 15,
    maxQuantity: null,
    reason: "feed_purchase",
  },
};

/**
 * カテゴリごとの表示順序 (固定)。/shop ページのレイアウトで使う。
 */
export const SHOP_ITEMS_BY_CATEGORY: Readonly<
  Record<ShopCategory, ReadonlyArray<ShopItemDef>>
> = {
  streak: [SHOP_ITEMS.streak_freeze],
  feed: [
    SHOP_ITEMS.kotodama_feed_normal,
    SHOP_ITEMS.kotodama_feed_premium,
    SHOP_ITEMS.kotodama_feed_rainy,
  ],
};

/**
 * 1 個追加で購入できるか判定 (maxQuantity を超えないこと)。
 * - maxQuantity が null の場合は常に true
 * - currentQuantity が maxQuantity 未満なら true
 */
export function canPurchaseAdditional(
  itemType: ShopItemType,
  currentQuantity: number,
): boolean {
  const def = SHOP_ITEMS[itemType];
  if (!def) return false;
  if (def.maxQuantity === null) return true;
  return currentQuantity < def.maxQuantity;
}
