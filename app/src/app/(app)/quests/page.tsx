/**
 * /quests - Daily Quest 一覧 (W10-T3)
 *
 * Server Component:
 *   - getOrGenerateTodayQuests で今日の 3 件を取得 (lazy generation 入口)
 *   - 残高 (HanekinBalanceHeader) + 3 件カード + 全完了 bonus 表示
 *   - claim Server Action は closure-bound learnerId で client wrapper 化
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - resolveActiveLearner (?learner= から family scoped で解決)
 *   - requireLearnerOwner (SQL 再確認 / 改ざん防御)
 *
 * 罰則ゼロ哲学 (DEC-024): 未達でも streak は減らさない / マイナス pop なし。
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ClipboardDocumentCheckIcon,
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
import { DailyQuestCard } from "@/components/quest/DailyQuestCard";

import {
  requireAuth,
  getFamilyIdForUser,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { getLearnersForParent } from "@/lib/learner/repository";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import { getCoinBalance } from "@/lib/actions/coins";
import {
  getOrGenerateTodayQuests,
  claimQuestReward,
  type ClaimQuestRewardResult,
} from "@/lib/actions/quests";

export const metadata = {
  title: "クエスト",
};

interface QuestsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function QuestsPage({ searchParams }: QuestsPageProps) {
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

  // 4. クエストデータ + 残高を並列取得 (getOrGenerateTodayQuests が lazy gen 入口)
  const [summary, balance] = await Promise.all([
    getOrGenerateTodayQuests(activeId),
    getCoinBalance(activeId),
  ]);

  // 5. claim Server Action wrapper (learnerId を closure で束ねる)
  async function claimFromClient(
    questId: string,
  ): Promise<ClaimQuestRewardResult> {
    "use server";
    return claimQuestReward({
      learnerId: activeId!,
      questId,
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      {/* 戻る + 学習者スイッチャー */}
      <div className="mb-6 flex items-start justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link
            href={`/home?learner=${encodeURIComponent(activeId)}`}
            className="inline-flex items-center gap-1"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            ホームへ
          </Link>
        </Button>
        {learners.length > 1 ? (
          <LearnerSwitcherTabs
            learners={learners.map((l) => ({
              id: l.id,
              nickname: l.nickname,
              avatarId: "kotodama_tori",
            }))}
            activeLearnerId={activeId}
          />
        ) : null}
      </div>

      <header className="mb-6 space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <ClipboardDocumentCheckIcon
            className="h-7 w-7 text-[#B97F18] dark:text-[#F2A93A]"
            aria-hidden="true"
          />
          クエスト
        </h1>
        <p className="text-sm text-muted-foreground">
          きょうの クエストを クリアすると、ハネキンが もらえるよ。
        </p>
      </header>

      {/* 残高大表示 */}
      <div className="mb-8">
        <HanekinBalanceHeader balance={balance} />
      </div>

      {/* 進捗サマリ */}
      <div
        className="mb-6 rounded-md border bg-amber-50/40 px-4 py-3 text-sm dark:bg-amber-900/10"
        data-testid="quests-summary-line"
        data-completed-count={summary.completedCount}
        data-claimed-count={summary.claimedCount}
        data-total-count={summary.totalCount}
      >
        <p>
          きょうの クエスト ({summary.questDate}):{" "}
          <span className="font-bold tabular-nums">{summary.claimedCount}</span>
          {" / "}
          <span className="tabular-nums">{summary.totalCount}</span> うけとり
          ずみ
        </p>
      </div>

      {summary.allBonusClaimed ? (
        <Card
          className="mb-6 border-[#F2A93A] bg-[#FFF8E5] dark:bg-amber-900/30"
          data-testid="quests-all-done-banner"
        >
          <CardHeader>
            <CardTitle className="text-base">
              きょうは ぜんぶ クリア！
            </CardTitle>
            <CardDescription>
              ボーナス ハネキンも うけとりずみ。あした また あたらしい クエストが
              でてくるよ。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {summary.quests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            きょうの クエストは まだ じゅんびちゅう です。すこし たってから また みてみてね。
          </CardContent>
        </Card>
      ) : (
        <section
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="quests-grid"
        >
          {summary.quests.map((q) => (
            <DailyQuestCard key={q.id} quest={q} onClaim={claimFromClient} />
          ))}
        </section>
      )}
    </main>
  );
}
