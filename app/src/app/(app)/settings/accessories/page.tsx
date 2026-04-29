/**
 * /settings/accessories - アクセサリ コレクション (W9-B)
 *
 * 12 種 accessories を 3 スロット (hat / scarf / wing_charm) ごとに grid 表示する
 * Server Component。
 *  - 解禁済 → カラー + 「つける / はずす」ボタン (Server Action)
 *  - 未解禁 → グレースケール + 解禁条件
 *  - 装着中の overlay を CharacterWithAccessories で同ページ上部にプレビュー
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - resolveActiveLearner (?learner= から family scoped で解決)
 *   - requireLearnerOwner (SQL 再確認 / 改ざん防御)
 *   - toggleEquippedAccessory: 内部でも requireAuth + requireLearnerOwner を再実行
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  SparklesIcon,
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
import {
  ACCESSORIES_BY_SLOT,
  ACCESSORY_SLOTS,
  SLOT_LABELS,
  isAccessoryCode,
  type AccessoryCode,
} from "@/lib/accessories/catalog";
import { AccessoryCard } from "@/components/character/accessories/accessory-card";
import { CharacterWithAccessories } from "@/components/character/accessories/character-with-accessories";
import {
  requireAuth,
  getFamilyIdForUser,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { getLearnersForParent } from "@/lib/learner/repository";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import {
  loadAccessoriesPageData,
  toggleEquippedAccessory,
} from "@/lib/actions/accessories";

export const metadata = {
  title: "アクセサリ",
};

interface AccessoriesPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccessoriesPage({
  searchParams,
}: AccessoriesPageProps) {
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

  // 4. データ取得
  const data = await loadAccessoriesPageData(activeId);
  const unlockedSet = new Set<AccessoryCode>(
    data.unlocked.map((u) => u.code),
  );
  const unlockedCount = unlockedSet.size;
  const totalCount = data.allCodes.length;

  // 5. Server Action (toggleEquipped) を form action としてバインドする closure
  //    activeId をクロージャで束縛 (URL 改ざん不可)
  async function toggleAction(formData: FormData): Promise<void> {
    "use server";
    const raw = formData.get("code");
    if (typeof raw !== "string" || !isAccessoryCode(raw)) return;
    // toggleEquippedAccessory 内部で requireAuth + requireLearnerOwner を再実行する
    // → URL に learner= を改ざんされても閉じる前の activeId に対して動く
    await toggleEquippedAccessory(activeId!, raw);
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

      <Card className="mb-6">
        <CardHeader>
          <SparklesIcon
            className="mb-2 h-8 w-8 text-primary"
            aria-hidden="true"
          />
          <CardTitle className="text-2xl">アクセサリ コレクション</CardTitle>
          <CardDescription>
            ことだまトリに アクセサリを つけられます。
            学習を つづけて あたらしい アクセサリを 解禁しましょう。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-center sm:items-start">
            <p
              className="text-sm text-muted-foreground"
              aria-live="polite"
              data-testid="accessories-summary"
            >
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {unlockedCount}
              </span>
              <span className="ml-1">/ {totalCount} 解禁</span>
            </p>
          </div>
          <CharacterWithAccessories
            input={{
              totalXp: data.stats.totalXp,
              currentStreak: data.stats.currentStreak,
              badgeCount: data.stats.badgeCodes.length,
              badgeCodes: data.stats.badgeCodes,
            }}
            equippedBySlot={data.equippedBySlot}
            svgSize={200}
          />
        </CardContent>
      </Card>

      {/* 3 スロット × 4 種 */}
      <div className="space-y-8" data-testid="accessory-slots">
        {ACCESSORY_SLOTS.map((slot) => {
          const accs = ACCESSORIES_BY_SLOT[slot];
          return (
            <section
              key={slot}
              data-testid={`accessory-slot-${slot}`}
              data-slot={slot}
            >
              <h2 className="mb-3 text-base font-bold text-foreground">
                {SLOT_LABELS[slot]}
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {accs.map((a) => {
                  const unlocked = unlockedSet.has(a.code);
                  const equipped = data.equippedBySlot[slot] === a.code;
                  return (
                    <li key={a.code}>
                      <AccessoryCard
                        code={a.code}
                        unlocked={unlocked}
                        equipped={equipped}
                        toggleAction={toggleAction}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
