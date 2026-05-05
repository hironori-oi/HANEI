/**
 * /home/exam-date - 学習者本人による受験日 自己編集 page (W12-T2 / DEC-076)
 *
 * 役割:
 *   - 学習者画面 (/home) から「受験日を変更する」link で遷移
 *   - 現在の受験日 / 残日数を表示し、`<LearnerExamDateForm>` で編集
 *   - submit → 既存 `updateExamDate` Server Action (mutation +0) → 双方向同期
 *
 * 認可:
 *   - 第一層 (proxy.ts) で session cookie 必須
 *   - 第二層 (本ページ): requireAuth + getFamilyIdForUser (parent / learner どちらでも可)
 *     - 親代理 (現行 Phase 1〜2 の主経路): requireLearnerOwner で family 所属を SQL 再確認
 *     - 学習者本人 (forward-compat): updateExamDate 内部で requireSelfLearner を発火
 *   - 第三層 (DB scoped): updateExamDate 内部で SQL レベル再検証
 *
 * 罰語ゼロ (DEC-024) / DEC-074 §reauth: 学習者本人 self-edit は reauth 不要。
 * page route count: 23 → 24 (+1 / DEC-006 拡張版上限 32 内 / margin 8)
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDaysIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LearnerExamDateForm } from "@/components/learner/learner-exam-date-form";

import {
  requireAuth,
  getFamilyIdForUser,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { getLearnersForParent } from "@/lib/learner/repository";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import type { ExamLevel } from "@/lib/actions/exam-date-validation";

export const metadata = {
  title: "受験日を変更する",
};

function computeDaysUntil(
  examDateIso: string | null,
  now = new Date(),
): number | null {
  if (!examDateIso) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const exam = new Date(`${examDateIso}T00:00:00`);
  if (Number.isNaN(exam.getTime())) return null;
  const diffMs = exam.getTime() - today.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

interface LearnerExamDatePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LearnerExamDatePage({
  searchParams,
}: LearnerExamDatePageProps) {
  // 1. 認可 (第二層)
  const session = await requireAuth();
  const familyId = await getFamilyIdForUser(session.userId);
  if (!familyId) {
    redirect("/onboarding/learner");
  }

  // 2. family 配下の learner 列挙 + 切替対象決定 (/home と同パターン)
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

  // 3. SQL レベルでの所有確認 (URL 改ざんによる第二防御)
  await requireLearnerOwner(session.userId, activeId);

  const learner = learners.find((l) => l.id === activeId);
  if (!learner) {
    redirect("/onboarding/learner");
  }

  const daysUntil = computeDaysUntil(learner.examDate);
  const level = learner.targetEikenLevel as ExamLevel;

  return (
    <main
      className="mx-auto max-w-2xl px-6 py-10"
      data-testid="learner-exam-date-page"
    >
      <header className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-3">
          <Link
            href="/home"
            className="inline-flex items-center gap-1"
            data-testid="learner-exam-date-back-link"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            ホームに戻る
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarDaysIcon
            className="h-6 w-6 text-primary"
            aria-hidden="true"
          />
          受験日を変更する
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {learner.nickname}さんの英検{level}級の受験日を更新できます。
        </p>
      </header>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">いまの受験日</CardTitle>
          <CardDescription>
            英検 {level} 級
          </CardDescription>
        </CardHeader>
        <CardContent>
          {learner.examDate ? (
            <div className="space-y-1">
              <p
                className="text-2xl font-bold text-primary tabular-nums"
                data-testid="learner-exam-date-current"
              >
                {learner.examDate}
              </p>
              {daysUntil !== null ? (
                <p className="text-sm text-muted-foreground">
                  {daysUntil > 0
                    ? `あと ${daysUntil} 日`
                    : daysUntil === 0
                      ? "今日が受験日です"
                      : `${Math.abs(daysUntil)} 日前に終わりました`}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              まだ登録されていません。下のフォームから登録できます。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新しい受験日を入力</CardTitle>
          <CardDescription>
            今日以降の日付を選んでください。保存すると、ホームと保護者ダッシュボードの両方に反映されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LearnerExamDateForm
            learnerId={learner.id}
            learnerNickname={learner.nickname}
            initialDate={learner.examDate}
            level={level}
          />
        </CardContent>
      </Card>
    </main>
  );
}
