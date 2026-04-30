/**
 * /parent/dashboard - 保護者ダッシュボード骨組み (W3 / T-2)
 *
 * セクション構成:
 *  1. 今週の学習サマリー (streak / 解答数 / 正答率 / XP)
 *  2. 受験日カウントダウン (exam_dates から最も近い英検日)
 *  3. 学習停止リマインド送信フック (Sheet 内に「今すぐリマインド」ボタン)
 *  4. 直近の誤答 TOP 5
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - requireParent(userId) (第二層 - parent でなければ throw)
 *   - requireFamilyMember(userId, familyId) (第二層 - 家族メンバー再確認)
 *   - scopedQueries(familyId) (第三層 - SQL レベル絞り込み)
 *   - 生 db.select() は禁止 (ESLint で弾かれる)
 *
 * デザイン: design-w2-screens-v2.md の Amber Gold tone を踏襲。
 *           shadcn/ui の Progress / Card / Sheet を使用。
 */

import Link from "next/link";
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  FireIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

import {
  requireAuth,
  requireParent,
  requireFamilyMember,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { scopedQueries } from "@/lib/db/scoped";
import { db } from "@/lib/db/client";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import { ExamDateDialog } from "../../components/exam-date-dialog";
import {
  getWeeklySummary,
  getNearestExamCountdown,
  getRecentMistakes,
  shouldSendInactivityReminder,
} from "@/lib/study/aggregations";
import { getTodayLearningSeconds } from "@/lib/actions/study-sessions";
import { describeTodayMinutes } from "@/lib/study/study-time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { sendInactivityReminderNow } from "@/lib/actions/parent-dashboard";

export const metadata = {
  title: "保護者ダッシュボード",
};

interface DashboardProps {
  searchParams?: Promise<{ learner?: string | string[] }>;
}

export default async function ParentDashboardPage({
  searchParams,
}: DashboardProps) {
  // 1. 三層認可
  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);
  await requireFamilyMember(session.userId, familyId);

  // 2. scoped query で家族の learner 一覧
  const scoped = scopedQueries(familyId);
  const learnersRaw = await scoped.listLearners();
  const learnersLite = learnersRaw.map((l) => ({
    id: l.id,
    nickname: l.nickname,
  }));
  const sp = searchParams ? await searchParams : {};
  const { active } = resolveActiveLearner({
    learners: learnersLite,
    rawQuery: sp.learner,
  });
  const learner = active
    ? learnersRaw.find((l) => l.id === active.id) ?? learnersRaw[0]
    : undefined;

  if (!learner) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">保護者ダッシュボード</h1>
          <p className="mt-2 text-muted-foreground">
            お子さまの学習プロフィールがまだ登録されていません。
          </p>
        </header>
        <Link href="/onboarding/learner" className="text-primary underline">
          学習者プロフィールを作成する
        </Link>
      </main>
    );
  }

  // 3. URL ?learner= 経由のアクセスは requireLearnerOwner で再検証
  await requireLearnerOwner(session.userId, learner.id);

  // 4. 集計 (並列)
  const [summary, exam, mistakes, inactivity, todayLearningSeconds] =
    await Promise.all([
      getWeeklySummary(db, learner.id),
      getNearestExamCountdown(db, learner.id),
      getRecentMistakes(db, learner.id, 5),
      shouldSendInactivityReminder(db, learner.id, 7),
      // W10-T5: 「今日 X 分」 (study_sessions の cumulative_seconds を JST 6:00 境界で集計)
      getTodayLearningSeconds(learner.id),
    ]);
  const todayLabel = describeTodayMinutes(todayLearningSeconds);

  const accuracyPct =
    summary.weeklyAccuracy === null
      ? null
      : Math.round(summary.weeklyAccuracy * 100);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {learner.nickname} さんの学習状況
          </p>
          <h1 className="text-3xl font-bold">保護者ダッシュボード</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="default" className="min-h-tap-cta">
            <Link
              href={`/parent/messages/new?learner=${encodeURIComponent(learner.id)}`}
              className="inline-flex items-center gap-2"
            >
              <EnvelopeIcon className="h-4 w-4" aria-hidden="true" />
              メッセージを 送る
            </Link>
          </Button>
          <Link
            href="/home"
            className="text-sm text-muted-foreground underline"
          >
            学習画面へ
          </Link>
        </div>
      </header>

      {/* W10-T5: 今日の学習時間 (過学習防止 / 30 分 nudge / 60 分 hard_limit のソース) */}
      <section aria-labelledby="today-learning" className="mb-8">
        <h2
          id="today-learning"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <ClockIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          今日の学習時間
        </h2>
        <Card
          data-testid="today-learning-card"
          data-today-minutes={todayLabel.minutes}
          data-today-tone={todayLabel.tone}
          className={
            todayLabel.tone === "celebrate"
              ? "border-2 border-primary bg-primary/5"
              : todayLabel.tone === "warm"
                ? "border-warning/40 bg-warning/5"
                : ""
          }
        >
          <CardHeader>
            <CardTitle className="text-base">{todayLabel.primary}</CardTitle>
            <CardDescription>{todayLabel.hint}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tabular-nums text-primary">
              {todayLabel.minutes} <span className="text-xl">ふん</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              30 分で「ひと休み」を提案、60 分で「きょうは じゅうぶん」と区切ります (DEC-024 罰則ゼロ哲学)。
            </p>
          </CardContent>
        </Card>
      </section>

      {/* セクション 1: 今週の学習サマリー */}
      <section aria-labelledby="weekly-summary" className="mb-10">
        <h2
          id="weekly-summary"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <ChartBarIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          今週の学習サマリー
        </h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader>
              <FireIcon
                className="mb-1 h-6 w-6 text-warning"
                aria-hidden="true"
              />
              <CardTitle className="text-sm font-medium">
                連続学習日数
              </CardTitle>
              <CardDescription>
                streak が長いほど習慣が定着しています。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.currentStreak} 日</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <AcademicCapIcon
                className="mb-1 h-6 w-6 text-primary"
                aria-hidden="true"
              />
              <CardTitle className="text-sm font-medium">
                今週の解答数
              </CardTitle>
              <CardDescription>直近 7 日間の合計</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.weeklyAnswers} 問</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ChartBarIcon
                className="mb-1 h-6 w-6 text-accent"
                aria-hidden="true"
              />
              <CardTitle className="text-sm font-medium">正答率</CardTitle>
              <CardDescription>直近 7 日間の平均</CardDescription>
            </CardHeader>
            <CardContent>
              {accuracyPct === null ? (
                <p className="text-sm text-muted-foreground">
                  まだ解答がありません
                </p>
              ) : (
                <>
                  <p className="mb-2 text-3xl font-bold">{accuracyPct} %</p>
                  <Progress
                    value={accuracyPct}
                    aria-label={`今週の正答率 ${accuracyPct}%`}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">XP 増加</CardTitle>
              <CardDescription>
                累計 {summary.totalXp} XP / 今週 +{summary.weeklyXpDelta}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">
                +{summary.weeklyXpDelta}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* セクション 2: 受験日カウントダウン */}
      <section aria-labelledby="exam-countdown" className="mb-10">
        <h2
          id="exam-countdown"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <CalendarDaysIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          受験日カウントダウン
        </h2>
        {exam ? (
          <Card>
            <CardHeader>
              <CardTitle>
                英検 {exam.level} 級 / {exam.examDate}
              </CardTitle>
              <CardDescription>
                目標日まで毎日コツコツ進めましょう。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-primary">
                あと {exam.daysUntil} 日
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="mb-4 text-sm text-muted-foreground">
                受験日はまだ登録されていません。下のボタンから登録できます。
              </p>
              <ExamDateDialog
                learnerId={learner.id}
                learnerName={learner.nickname}
              />
            </CardContent>
          </Card>
        )}
        {exam ? (
          <div className="mt-3">
            <ExamDateDialog
              learnerId={learner.id}
              learnerName={learner.nickname}
              initialLevel={exam.level}
              initialDate={exam.examDate}
            />
          </div>
        ) : null}
      </section>

      {/* セクション 3: 学習停止リマインド送信フック */}
      <section aria-labelledby="inactivity-reminder" className="mb-10">
        <h2
          id="inactivity-reminder"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <EnvelopeIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          学習停止リマインド
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {inactivity.shouldSend
                ? `直近 ${inactivity.daysSinceLastActive ?? "7+"} 日間、学習が止まっています。`
                : "今週は順調に学習が続いています。"}
            </CardTitle>
            <CardDescription>
              「今すぐリマインド」を押すと、保護者の方のメールアドレス宛にやさしいリマインドメールを送ります。日次 cron 自動送信は W4 以降に実装予定です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">リマインド設定を開く</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>リマインドの送信</SheetTitle>
                  <SheetDescription>
                    {learner.nickname} さん宛のリマインドを保護者メールに送ります。
                    {inactivity.shouldSend
                      ? " 直近 7 日学習が止まっているため、送信が推奨されます。"
                      : " 直近 7 日以内に学習されているため、いま送信しても効果は限定的です。"}
                  </SheetDescription>
                </SheetHeader>
                <form
                  className="mt-6 space-y-3"
                  action={async () => {
                    "use server";
                    await sendInactivityReminderNow(learner.id);
                  }}
                >
                  <Button type="submit" className="w-full">
                    今すぐリマインドを送る
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Resend が未設定の環境では、メール送信はスキップされ、コンソールにログのみ記録されます。
                  </p>
                </form>
              </SheetContent>
            </Sheet>
          </CardContent>
        </Card>
      </section>

      {/* セクション 4: 直近の誤答 TOP 5 */}
      <section aria-labelledby="recent-mistakes" className="mb-10">
        <h2
          id="recent-mistakes"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <ExclamationTriangleIcon
            className="h-6 w-6 text-warning"
            aria-hidden="true"
          />
          直近の誤答 TOP 5
        </h2>
        {mistakes.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                直近の誤答はありません。素晴らしいです。
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {mistakes.map((m) => (
              <li
                key={`${m.problemId}_${m.answeredAt.toISOString()}`}
                className="rounded-md border bg-card p-4"
              >
                <p className="text-sm font-medium">問題 ID: {m.problemId}</p>
                <p className="text-sm text-muted-foreground">
                  選んだ答え: {m.userAnswer}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.answeredAt.toLocaleString("ja-JP")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
