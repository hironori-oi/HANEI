/**
 * /parent/settings/notifications - 通知 / リマインド (W12-T1 / Phase 3 第 1 波 / DEC-074)
 *
 * 親がメール通知 (notificationsEnabled) と毎日のリマインド時刻 (dailyReminderTime) を管理する.
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - requireParent (第二層)
 *   - requireLearnerOwner (active learner SQL 再確認)
 *
 * mutation 経路:
 *   - <NotificationsForm> client → updateLearnerSettings (top-level Server Action #1)
 *   - notifications 系は reauth 不要 (DEC-074 §(d) account のみ sensitive)
 *
 * 設計原則: 絵文字ゼロ / Heroicons / 罰語ゼロ (DEC-024).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, BellIcon } from "@heroicons/react/24/outline";

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
import { getLearnerSettings } from "@/lib/actions/learner-settings";
import { getLearnerStudyTarget } from "@/lib/actions/learner-study-target";
import { NotificationsForm } from "./notifications-form";

export const metadata = {
  title: "通知 / リマインド",
};

interface NotificationsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ParentSettingsNotificationsPage({
  searchParams,
}: NotificationsPageProps): Promise<React.ReactElement> {
  const session = await requireAuth();
  await requireParent(session.userId);
  const familyId = await getFamilyIdForUser(session.userId);
  if (!familyId) {
    redirect("/onboarding/learner");
  }

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
  const [settings, studyTarget] = await Promise.all([
    getLearnerSettings(activeId),
    getLearnerStudyTarget(activeId),
  ]);

  return (
    <main
      data-testid="parent-settings-notifications"
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
          <BellIcon
            className="mb-2 h-8 w-8 text-primary"
            aria-hidden="true"
          />
          <CardTitle className="text-2xl">通知 / リマインド</CardTitle>
          <CardDescription>
            メール通知の ON / OFF と、毎日のリマインド時刻を設定します。お子さまが学習を続けやすくなります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationsForm
            learnerId={activeId}
            initialNotificationsEnabled={settings.notificationsEnabled}
            initialDailyReminderTime={settings.dailyReminderTime}
            initialSoundEnabled={settings.soundEnabled}
            initialDailyMinutesTarget={studyTarget.dailyMinutesTarget}
            initialStudyTargetReminderEnabled={studyTarget.reminderEnabled}
            initialStudyTargetReminderTime={studyTarget.reminderTime}
          />
        </CardContent>
      </Card>
    </main>
  );
}
