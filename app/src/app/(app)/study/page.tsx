/**
 * /study - 学習セッション 入口 (W10-T4)
 *
 * Server Component:
 *   - 三層認可 (requireAuth → resolveActiveLearner → requireLearnerOwner)
 *   - SessionPicker (Client Component) を埋め込み、5/7/10 分セッションを選択させる
 *   - 既存 /study/[levelCode]/[skillCode] 配下の Phase 1 ルートは維持しつつ、
 *     ここを new front-door として /home から誘導する
 *
 * 罰則ゼロ哲学 (DEC-024) 整合: 文言肯定形 / セッション中断は自由 (overtime も alarm でなく祝福)。
 * Phase 2 plan §W10-T4: 「子供が "ちょっとだけ" を選べる導線」の確保。
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, AcademicCapIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { LearnerSwitcherTabs } from "@/components/learner/learner-switcher-tabs";
import { SessionPicker } from "@/components/study/SessionPicker";

import {
  requireAuth,
  getFamilyIdForUser,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { getLearnersForParent } from "@/lib/learner/repository";
import { resolveActiveLearner } from "@/lib/study/learner-switch";

export const metadata = {
  title: "がくしゅうを はじめる",
};

interface StudyIndexPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StudyIndexPage({
  searchParams,
}: StudyIndexPageProps) {
  // 1. 認可
  const session = await requireAuth();
  const familyId = await getFamilyIdForUser(session.userId);
  if (!familyId) {
    redirect("/onboarding/learner");
  }

  // 2. learner 解決
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

  // 3. 三層認可第二層 (SQL レベル / 改ざん防御)
  await requireLearnerOwner(session.userId, activeId);
  const learner = learners.find((l) => l.id === activeId);
  if (!learner) {
    redirect("/onboarding/learner");
  }

  // 4. 開始 URL (Phase 1 既存ルートと整合 / 既定 skill = vocab)
  // 将来 skill picker を入れる場合はここを SessionPicker の props 化 / 別 step に分離
  const studyTargetPath = `/study/eiken-${learner.targetEikenLevel}/vocab`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
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
          <AcademicCapIcon
            className="h-7 w-7 text-primary"
            aria-hidden="true"
          />
          がくしゅう
        </h1>
        <p className="text-sm text-muted-foreground">
          {learner.nickname} さん、きょうも いっしょに やってみよう。
        </p>
      </header>

      <SessionPicker learnerId={activeId} studyTargetPath={studyTargetPath} />
    </main>
  );
}
