/**
 * /shop - ハネキン Shop (W10-T2 / DEC-056 案B)
 *
 * 2 category のみ:
 *   1. Streak アイテム (Streak Freeze)
 *   2. ことだまトリのエサ (普通 / 特上 / 雨の日)
 *
 * アクセサリ category は出さない (W9-B 解禁条件のみが唯一の獲得経路 / DEC-052 slot mutex 維持)。
 * 代わりに「アクセサリは ことだまトリと一緒にがんばると もらえるよ」のヘルプテキスト + /accessories 内部リンク。
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - resolveActiveLearner (?learner= から family scoped で解決)
 *   - requireLearnerOwner (SQL 再確認 / 改ざん防御)
 *
 * Server Action (purchaseShopItem) は ShopCategorySection (client) で closure-bound learnerId で wrap される。
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  SparklesIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LearnerSwitcherTabs } from "@/components/learner/learner-switcher-tabs";
import { HanekinBalanceHeader } from "@/components/economy/HanekinBalanceHeader";
import { ShopCategorySection } from "@/components/shop/ShopCategorySection";

import {
  requireAuth,
  getFamilyIdForUser,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { getLearnersForParent } from "@/lib/learner/repository";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import { getCoinBalance } from "@/lib/actions/coins";
import {
  getInventoryFor,
  purchaseShopItem,
  type PurchaseShopItemResult,
} from "@/lib/actions/shop";
import {
  SHOP_CATEGORY_LABEL_JA,
  SHOP_ITEMS_BY_CATEGORY,
  type ShopItemType,
} from "@/lib/economy/shop-prices";

export const metadata = {
  title: "ショップ",
};

interface ShopPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  // 1. 認可
  const session = await requireAuth();
  const familyId = await getFamilyIdForUser(session.userId);
  if (!familyId) {
    redirect("/onboarding/learner");
  }

  // 2. learners + active 解決
  const learners = await getLearnersForParent(session.userId);
  if (learners.length === 0) {
    redirect("/onboarding/learner");
  }
  const sp = (await searchParams) ?? {};
  const resolved = resolveActiveLearner({
    learners: learners.map((l) => ({ id: l.id, nickname: l.nickname })),
    rawQuery: sp.learner,
  });
  const activeId = resolved.active?.id;
  if (!activeId) {
    redirect("/onboarding/learner");
  }

  // 3. 三層認可第二層 (SQL レベル)
  await requireLearnerOwner(session.userId, activeId);

  // 4. 残高 + 在庫を並列取得
  const [balance, inventory] = await Promise.all([
    getCoinBalance(activeId),
    getInventoryFor(activeId),
  ]);

  // 5. Server Action wrapper (learnerId を closure で束ね、client は itemType + referenceId だけ送る)
  async function purchaseFromClient(
    itemType: ShopItemType,
    referenceId: string,
  ): Promise<PurchaseShopItemResult> {
    "use server";
    return purchaseShopItem({
      learnerId: activeId!,
      itemType,
      referenceId,
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      {/* 戻る + 学習者スイッチャー */}
      <div className="mb-6 flex items-start justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link
            href={
              resolved.active
                ? `/home?learner=${encodeURIComponent(resolved.active.id)}`
                : "/home"
            }
            className="inline-flex items-center gap-1"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            ホームへ
          </Link>
        </Button>
        {learners.length > 1 && resolved.active ? (
          <LearnerSwitcherTabs
            learners={learners.map((l) => ({
              id: l.id,
              nickname: l.nickname,
              avatarId: "kotodama_tori",
            }))}
            activeLearnerId={resolved.active.id}
          />
        ) : null}
      </div>

      <header className="mb-6 space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <ShoppingBagIcon
            className="h-7 w-7 text-[#B97F18] dark:text-[#F2A93A]"
            aria-hidden="true"
          />
          ショップ
        </h1>
        <p className="text-sm text-muted-foreground">
          がんばって ためた ハネキンで、おたのしみ アイテムを 買えるよ。
        </p>
      </header>

      {/* ページ上部 大表示残高 (HanekinBalanceHeader) */}
      <div className="mb-8">
        <HanekinBalanceHeader balance={balance} />
      </div>

      {/* 2 category */}
      <div className="space-y-10">
        <ShopCategorySection
          title={SHOP_CATEGORY_LABEL_JA.streak.label}
          description={SHOP_CATEGORY_LABEL_JA.streak.description}
          items={SHOP_ITEMS_BY_CATEGORY.streak}
          balance={balance}
          inventoryByType={inventory.byType}
          learnerId={activeId}
          purchase={purchaseFromClient}
        />
        <ShopCategorySection
          title={SHOP_CATEGORY_LABEL_JA.feed.label}
          description={SHOP_CATEGORY_LABEL_JA.feed.description}
          items={SHOP_ITEMS_BY_CATEGORY.feed}
          balance={balance}
          inventoryByType={inventory.byType}
          learnerId={activeId}
          purchase={purchaseFromClient}
        />
      </div>

      {/* アクセサリは購入できない (DEC-056 §W9-B との切り分け) */}
      <Card className="mt-10 bg-muted/30" data-testid="shop-accessories-help">
        <CardHeader>
          <SparklesIcon
            className="mb-2 h-7 w-7 text-primary"
            aria-hidden="true"
          />
          <CardTitle className="text-base">アクセサリは どこ？</CardTitle>
          <CardDescription>
            アクセサリは ことだまトリと いっしょに がんばると もらえるよ。
            ショップでは 買えない けれど、まいにち がんばると しぜんに ふえていきます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm" className="min-h-tap-cta">
            <Link
              href={`/settings/accessories?learner=${encodeURIComponent(activeId)}`}
              className="inline-flex items-center gap-2"
            >
              <SparklesIcon className="h-5 w-5" aria-hidden="true" />
              <span>アクセサリの ようすを みる</span>
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
