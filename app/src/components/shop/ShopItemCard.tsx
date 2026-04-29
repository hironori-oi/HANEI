"use client";

/**
 * ShopItemCard - 各 shop item の表示カード (W10-T2 / DEC-056)
 *
 * Client Component (購入 dialog 起動 + state 管理を担う):
 * - アイテム名 / 価格 / 在庫 / 「買う」CTA
 * - 残高が price 未満なら「ハネキンが X 個 たりないよ」+「クエストで貯める」CTA に切替
 * - 在庫が maxQuantity に達していれば「もう十分 もっているよ」表示
 * - 「買う」押下で ConfirmPurchaseDialog を起動 → 購入後 toast 風メッセージ
 *
 * 子ども × 親観察前提:
 * - 課金導線を増やさない (達成導線が主軸)
 * - aria-label は日本語固定 / 価格に「ハネキン」明示
 */

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckBadgeIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import type { ShopItemDef } from "@/lib/economy/shop-prices";
import { ConfirmPurchaseDialog } from "./ConfirmPurchaseDialog";
import type { PurchaseShopItemResult } from "@/lib/actions/shop";

interface ShopItemCardProps {
  item: ShopItemDef;
  currentBalance: number;
  currentQuantity: number;
  /** クエスト遷移用 learnerId (未指定なら /quests) */
  learnerId?: string | undefined;
  /** Server Action 呼び出し: client から purchaseShopItem({...}) を呼ぶ wrapper */
  onPurchase: (
    referenceId: string,
  ) => Promise<PurchaseShopItemResult>;
}

export function ShopItemCard({
  item,
  currentBalance,
  currentQuantity,
  learnerId,
  onPurchase,
}: ShopItemCardProps) {
  const [open, setOpen] = React.useState(false);
  const [resultMessage, setResultMessage] = React.useState<string | null>(null);

  const insufficient = currentBalance < item.price;
  const shortfall = insufficient ? item.price - currentBalance : 0;
  const atMax =
    item.maxQuantity !== null && currentQuantity >= item.maxQuantity;

  const questsHref = learnerId
    ? `/quests?learner=${encodeURIComponent(learnerId)}`
    : "/quests";

  return (
    <Card
      data-testid={`shop-item-${item.type}`}
      data-price={item.price}
      data-quantity={currentQuantity}
      className="flex flex-col"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">
            <ruby>
              {item.name}
              <rt className="text-[10px]">{item.furigana}</rt>
            </ruby>
          </CardTitle>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF5DC] px-2.5 py-1 text-sm font-bold text-[#B97F18] dark:bg-[#3A2A0A] dark:text-[#F2A93A]"
            aria-label={`値段 ${item.price} ハネキン`}
          >
            <span className="tabular-nums">{item.price}</span>
            <span className="text-xs">ハネキン</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {item.description}
        </p>

        <div className="space-y-2">
          <p
            className="text-xs text-muted-foreground"
            aria-label={`いまの もちもの ${currentQuantity} 個${
              item.maxQuantity !== null ? ` / 上限 ${item.maxQuantity} 個` : ""
            }`}
          >
            <span className="font-medium text-foreground tabular-nums">
              {currentQuantity}
            </span>
            {item.maxQuantity !== null ? (
              <>
                <span> / </span>
                <span className="tabular-nums">{item.maxQuantity}</span>
                <span> もっている</span>
              </>
            ) : (
              <span> 個 もっている</span>
            )}
          </p>

          {atMax ? (
            <div
              className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm"
              role="status"
            >
              <CheckBadgeIcon
                className="h-5 w-5 text-primary"
                aria-hidden="true"
              />
              <span>もう じゅうぶん もっているよ。</span>
            </div>
          ) : insufficient ? (
            <div className="space-y-2">
              <p
                className="text-sm text-amber-700 dark:text-amber-400"
                role="status"
                data-testid={`shop-shortfall-${item.type}`}
              >
                ハネキンが{" "}
                <span className="font-bold tabular-nums">{shortfall}</span> 個
                たりないよ
              </p>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="min-h-tap-cta w-full"
              >
                <Link href={questsHref} aria-label="クエストで ハネキンを ためる">
                  クエストで ためる
                </Link>
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              className="min-h-tap-cta w-full"
              onClick={() => {
                setResultMessage(null);
                setOpen(true);
              }}
              aria-label={`${item.name}を ${item.price} ハネキンで 買う`}
              data-testid={`shop-buy-button-${item.type}`}
            >
              <ShoppingBagIcon className="h-5 w-5" aria-hidden="true" />
              <span>買う</span>
            </Button>
          )}

          {resultMessage ? (
            <p
              className="text-xs text-emerald-700 dark:text-emerald-400"
              role="status"
              aria-live="polite"
              data-testid={`shop-result-${item.type}`}
            >
              {resultMessage}
            </p>
          ) : null}
        </div>
      </CardContent>

      <ConfirmPurchaseDialog
        open={open}
        onOpenChange={setOpen}
        item={item}
        currentBalance={currentBalance}
        currentQuantity={currentQuantity}
        onConfirm={async () => {
          // client-generated UUID で冪等性を担保 (DEC-056 §冪等性)
          const referenceId =
            typeof globalThis.crypto?.randomUUID === "function"
              ? globalThis.crypto.randomUUID()
              : `purchase_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const result = await onPurchase(referenceId);
          if (result.ok) {
            setResultMessage(
              result.skipped
                ? "もう 受け取りずみだよ。"
                : `ありがとう！ ${item.name}を 1 個 もらいました。`,
            );
          } else if (result.reason === "insufficient_balance") {
            setResultMessage("ハネキンが たりないみたい。");
          } else if (result.reason === "max_quantity") {
            setResultMessage("もう じゅうぶん もっているよ。");
          } else {
            setResultMessage(
              "もういちど ためしてみてね。うまくいかないときは おうちの人に きいてみよう。",
            );
          }
          setOpen(false);
          return result;
        }}
      />
    </Card>
  );
}
