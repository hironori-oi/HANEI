/**
 * /parent/settings/account - アカウント設定 (W12-T1 / Phase 3 第 1 波 / DEC-074)
 *
 * 親が学習者の表示名 / 学年 (英検目標級) を変更する page.
 * sensitive 操作 = 親パスワード reauth dialog 必須 (5 分間 grace).
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - requireParent (第二層)
 *   - requireLearnerOwner (active learner に対する SQL 再確認)
 *
 * mutation 経路:
 *   - <AccountSettingsForm> client → updateLearnerProfile (top-level Server Action #1)
 *   - reauth_required の場合は ParentReauthDialog を open
 *
 * 設計原則: 絵文字ゼロ / Heroicons / 罰語ゼロ (DEC-024).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, UserCircleIcon } from "@heroicons/react/24/outline";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  requireAuth,
  requireParent,
  requireLearnerOwner,
  getFamilyIdForUser,
} from "@/lib/auth/guards";
import { getLearnersForParent } from "@/lib/learner/repository";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import { AccountSettingsForm } from "./account-form";

export const metadata = {
  title: "アカウント設定",
};

interface AccountPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ParentSettingsAccountPage({
  searchParams,
}: AccountPageProps): Promise<React.ReactElement> {
  // 三層認可
  const session = await requireAuth();
  await requireParent(session.userId);
  const familyId = await getFamilyIdForUser(session.userId);
  if (!familyId) {
    redirect("/onboarding/learner");
  }

  // 学習者解決
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

  await requireLearnerOwner(session.userId, activeId);
  const learner = learners.find((l) => l.id === activeId)!;

  return (
    <main
      data-testid="parent-settings-account"
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8"
    >
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link
            href="/parent/settings"
            className="inline-flex items-center gap-1"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            設定に戻る
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <UserCircleIcon
            className="mb-2 h-8 w-8 text-primary"
            aria-hidden="true"
          />
          <CardTitle className="text-2xl">アカウント設定</CardTitle>
          <CardDescription>
            学習者の表示名と 学年 (目標とする 英検の級) を 変更できます。
            セキュリティのため、変更時に 親のパスワード再確認が必要です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <dt className="text-muted-foreground">親メール</dt>
              <dd className="col-span-2" data-testid="parent-email">
                {session.email}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            親メールの変更は本リリース時点では サポートされていません。変更が必要な場合は
            運営までご連絡ください。(将来 atomic で追加予定)
          </p>
        </CardContent>
      </Card>

      <AccountSettingsForm
        learnerId={learner.id}
        initialNickname={learner.nickname}
        initialTargetLevel={learner.targetEikenLevel}
      />
    </main>
  );
}
