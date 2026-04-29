"use client";

/**
 * ShopCategorySection - カテゴリ単位のグリッド表示 (W10-T2 / DEC-056)
 *
 * Server Action (purchaseShopItem) を closure-bound learnerId で wrap し、
 * 各 ShopItemCard に渡す Client Component。
 */

import * as React from "react";
import { ShopItemCard } from "./ShopItemCard";
import type {
  ShopItemDef,
  ShopItemType,
} from "@/lib/economy/shop-prices";
import type { PurchaseShopItemResult } from "@/lib/actions/shop";

interface ShopCategorySectionProps {
  title: string;
  description: string;
  items: ReadonlyArray<ShopItemDef>;
  balance: number;
  inventoryByType: Readonly<Record<ShopItemType, number>>;
  learnerId: string;
  /**
   * Server Action wrapper: parent server component で
   * `purchaseShopItem({ learnerId, itemType, referenceId })` をクロージャで束ねた関数を渡す。
   * client は (itemType, referenceId) → result という単純化された signature で呼ぶ。
   */
  purchase: (
    itemType: ShopItemType,
    referenceId: string,
  ) => Promise<PurchaseShopItemResult>;
}

export function ShopCategorySection({
  title,
  description,
  items,
  balance,
  inventoryByType,
  learnerId,
  purchase,
}: ShopCategorySectionProps) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <ShopItemCard
            key={item.type}
            item={item}
            currentBalance={balance}
            currentQuantity={inventoryByType[item.type] ?? 0}
            learnerId={learnerId}
            onPurchase={(referenceId) => purchase(item.type, referenceId)}
          />
        ))}
      </div>
    </section>
  );
}
