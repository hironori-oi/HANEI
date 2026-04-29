/**
 * /badges - 獲得バッジ一覧 (W9-C)
 *
 * 8 種 badges を grid で表示する Server Component。
 * - 取得済 → カラー + ring + 取得日
 * - 未取得 → グレースケール + 進捗バー
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - resolveActiveLearner (?learner= から family scoped で解決)
 *   - requireLearnerOwner (SQL 再確認 / 改ざん防御)
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, TrophyIcon } from "@heroicons/react/24/outline";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LearnerSwitcherTabs } from "@/components/learner/learner-switcher-tabs";
import { BadgeGrid } from "@/components/badges/badge-grid";
import {
  requireAuth,
  getFamilyIdForUser,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { getLearnersForParent } from "@/lib/learner/repository";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import { loadBadgesPageData } from "@/lib/actions/badges";

export const metadata = {
  title: "バッジ",
};

interface BadgesPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BadgesPage({ searchParams }: BadgesPageProps) {
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
  const data = await loadBadgesPageData(activeId);
  const earnedCount = data.earned.length;
  const totalCount = data.allCodes.length;

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
          <TrophyIcon
            className="mb-2 h-8 w-8 text-primary"
            aria-hidden="true"
          />
          <CardTitle className="text-2xl">バッジ コレクション</CardTitle>
          <CardDescription>
            学習を つづけると、バッジが ふえていきます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p
            className="text-sm text-muted-foreground"
            aria-live="polite"
            data-testid="badges-summary"
          >
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {earnedCount}
            </span>
            <span className="ml-1">/ {totalCount} 取得</span>
          </p>
        </CardContent>
      </Card>

      <BadgeGrid earned={data.earned} stats={data.stats} />
    </main>
  );
}
