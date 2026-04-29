"use client";

/**
 * ConfirmPurchaseDialog - 購入確認 dialog (W10-T2 / DEC-056)
 *
 * - 購入前に「○○を ☓☓ ハネキンで 買う？」+ 購入後の残高プレビューを表示
 * - 「やめる」/「買う」ボタン
 * - useTransition で submit 中の disabled 制御
 * - 子ども向け語感 / aria-label 日本語固定
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ShopItemDef } from "@/lib/economy/shop-prices";
import type { PurchaseShopItemResult } from "@/lib/actions/shop";

interface ConfirmPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ShopItemDef;
  currentBalance: number;
  currentQuantity: number;
  onConfirm: () => Promise<PurchaseShopItemResult>;
}

export function ConfirmPurchaseDialog({
  open,
  onOpenChange,
  item,
  currentBalance,
  currentQuantity,
  onConfirm,
}: ConfirmPurchaseDialogProps) {
  const [pending, setPending] = React.useState(false);
  const previewBalance = Math.max(0, currentBalance - item.price);
  const previewQuantity = currentQuantity + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid={`shop-confirm-dialog-${item.type}`}
        aria-label={`${item.name}の 購入確認`}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">かいものの かくにん</DialogTitle>
          <DialogDescription>
            <ruby>
              {item.name}
              <rt className="text-[10px]">{item.furigana}</rt>
            </ruby>{" "}
            を <span className="font-bold tabular-nums">{item.price}</span>{" "}
            ハネキンで 買いますか？
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md bg-muted/40 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">かいもの あとの ざんだか</span>
            <span className="font-bold tabular-nums">
              {previewBalance.toLocaleString("ja-JP")} ハネキン
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">あたらしい もちもの</span>
            <span className="font-bold tabular-nums">{previewQuantity} 個</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            aria-label="購入を やめる"
            className="min-h-tap-cta"
          >
            やめる
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
              } finally {
                setPending(false);
              }
            }}
            aria-label={`${item.name}を ${item.price} ハネキンで 買う`}
            data-testid={`shop-confirm-button-${item.type}`}
            className="min-h-tap-cta"
          >
            {pending ? "買っています…" : "買う"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
