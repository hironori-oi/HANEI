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
  BookOpenIcon,
  CalendarDaysIcon,
  FireIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
  HeartIcon,
  SparklesIcon,
  TrophyIcon,
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
import { getFamilyStreak } from "@/lib/study/family-streak";
import { getFamilyWeeklyLeaderboard } from "@/lib/study/family-leaderboard";
import { isAllZeroXp } from "@/lib/study/family-leaderboard-ranking";
import { getFamilyWeeklyDigest } from "@/lib/study/family-weekly-digest";
import { getKotodamaStageLabel } from "@/lib/study/kotodama-tori-stage";
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
  const [
    summary,
    exam,
    mistakes,
    inactivity,
    todayLearningSeconds,
    familyStreak,
    leaderboard,
    weeklyDigest,
  ] = await Promise.all([
    getWeeklySummary(db, learner.id),
    getNearestExamCountdown(db, learner.id),
    getRecentMistakes(db, learner.id, 5),
    shouldSendInactivityReminder(db, learner.id, 7),
    // W10-T5: 「今日 X 分」 (study_sessions の cumulative_seconds を JST 6:00 境界で集計)
    getTodayLearningSeconds(learner.id),
    // W11-T1: 家族のれんぞく X 日 (1 人でも当日学習すれば family streak 維持 / 兄弟救済)
    getFamilyStreak(familyId),
    // W11-T3: 家族内ランキング (直近 7 日 / 同 family 内のみ可視 / COPPA 準拠 / DEC-024 罰則ゼロ)
    getFamilyWeeklyLeaderboard(familyId),
    // W11-T5: 今週のハイライト Weekly Digest (家族 streak 集約 + 各子今週 XP + Top 3 単元 + 励ましコピー)
    getFamilyWeeklyDigest(familyId),
  ]);

  // W11-T3: 全員 0 XP 判定 + 単独 learner 判定 (UI コピー切替に使用 / 罰語ゼロ保証)
  const leaderboardAllZero = isAllZeroXp(leaderboard);
  const leaderboardSolo = leaderboard.length === 1;
  const todayLabel = describeTodayMinutes(todayLearningSeconds);

  // W11-T1: 家族 streak の表示コピーを罰則ゼロ哲学 (DEC-024) で組み立てる
  //   - days >= 1 + isAlive=true     → 「家族のれんぞく X 日 — 今日もみんなでつながったね」
  //   - days === 0 + isAlive=false   → 「今日 1 日目をはじめよう」 (前向き / 罰なし)
  //   - days >= 1 + isAlive=false    → 切れている表示。前向きコピーで「またいつでも始められるよ」
  //     (現状 getFamilyStreak は切れた瞬間 days=0 を返すため、ここは days>=1 単独になることはない)
  const familyStreakHeadline =
    familyStreak.days > 0
      ? `家族のれんぞく ${familyStreak.days} 日`
      : "家族のれんぞく";
  const familyStreakHint =
    familyStreak.days > 0 && familyStreak.isAlive
      ? "今日も みんなで つながったね"
      : familyStreak.days > 0
        ? "またいつでも はじめられるよ"
        : "今日 1 日目を はじめよう";

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

      {/* W11-T1: 家族のれんぞく (1 人でも当日学習すれば家族 streak 維持 / 兄弟救済) */}
      <section aria-labelledby="family-streak" className="mb-8">
        <h2
          id="family-streak"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <HeartIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          家族のれんぞく
        </h2>
        <Card
          data-testid="family-streak-card"
          data-family-streak-days={familyStreak.days}
          data-family-streak-alive={familyStreak.isAlive ? "1" : "0"}
          aria-label={`家族のれんぞく ${familyStreak.days} 日`}
          className={
            familyStreak.isAlive && familyStreak.days > 0
              ? "border-2 border-primary bg-primary/5"
              : ""
          }
        >
          <CardHeader>
            <CardTitle className="text-base">{familyStreakHeadline}</CardTitle>
            <CardDescription>{familyStreakHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tabular-nums text-primary">
              {familyStreak.days} <span className="text-xl">日</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              ひとりでも 学習したら 家族の れんぞくが つながります (兄弟救済 / DEC-024 罰則ゼロ)。
            </p>
          </CardContent>
        </Card>
      </section>

      {/* W11-T3: 家族内ランキング (直近 7 日 / 同 family 内のみ可視 / COPPA 準拠 / DEC-024 罰則ゼロ)
          - 単独 learner: 「今週も N XP がんばってるね」(「最下位」を構造的に出さない)
          - 全員 0 XP: 「今週はまだ。今日 はじめよう」(前向きコピー)
          - 通常: 「みんなで がんばってるね」+ 1 位は TrophyIcon, 2 位以下は数字のみ */}
      <section aria-labelledby="family-leaderboard" className="mb-8">
        <h2
          id="family-leaderboard"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <TrophyIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          みんなで がんばってるね
        </h2>
        <Card data-testid="family-leaderboard-card">
          <CardHeader>
            <CardTitle className="text-base">
              {leaderboardSolo
                ? `今週も ${leaderboard[0]?.weeklyXp ?? 0} XP がんばってるね`
                : leaderboardAllZero
                  ? "今週はまだ。今日 はじめよう"
                  : "直近 7 日の 家族の がんばり"}
            </CardTitle>
            <CardDescription>
              家族の中で みんなが それぞれ つみあげた XP を しょうかいします (COPPA 準拠 / 家族内のみ)。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                家族の メンバーが まだ 登録されていません。
              </p>
            ) : (
              <ol className="space-y-2" aria-label="家族の 週間 XP ランキング">
                {leaderboard.map((row) => {
                  const stageLabel = row.kotodamaToriStage
                    ? getKotodamaStageLabel(row.kotodamaToriStage)
                    : null;
                  // 全員 0 XP のときは 1 位の冠を出さない (= 健全な前向き表示)
                  const isFirst = row.rank === 1 && !leaderboardAllZero;
                  return (
                    <li
                      key={row.learnerId}
                      data-leaderboard-rank={row.rank}
                      data-learner-id={row.learnerId}
                      data-weekly-xp={row.weeklyXp}
                      data-kotodama-stage={row.kotodamaToriStage ?? ""}
                      aria-label={`${row.rank} 位: ${row.nickname}、今週 ${row.weeklyXp} XP`}
                      className={
                        isFirst
                          ? "flex min-h-tap-cta items-center gap-3 rounded-md border-2 border-primary bg-primary/5 px-4 py-3"
                          : "flex min-h-tap-cta items-center gap-3 rounded-md border bg-card px-4 py-3"
                      }
                    >
                      <span className="inline-flex h-6 w-8 items-center justify-center text-sm font-bold tabular-nums text-primary">
                        {row.rank}
                      </span>
                      {isFirst ? (
                        <TrophyIcon
                          className="h-5 w-5 text-primary"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="flex-1 text-sm font-medium">
                        {row.nickname}
                      </span>
                      {stageLabel ? (
                        <span
                          className="text-xs text-muted-foreground"
                          aria-label={`ことだまトリ: ${stageLabel}`}
                        >
                          {stageLabel}
                        </span>
                      ) : null}
                      <span className="text-sm font-bold tabular-nums text-primary">
                        {row.weeklyXp} XP
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              直近 7 日の 正解数を 集計しています。みんなで つみあげていきましょう (DEC-024 罰則ゼロ)。
            </p>
          </CardContent>
        </Card>
      </section>

      {/* W11-T5: 今週の ハイライト (Weekly Digest Card / DEC-063 / DEC-024 罰則ゼロ)
          - 家族 streak 集約コピー
          - 各子の今週 XP (leaderboard rank 順)
          - Top 3 単元 (家族全体の直近 7 日 / answer_logs × problems × skills)
          - 来週の励ましコピー (pre-curated catalog 8 件 / week-of-year + familyId で deterministic) */}
      <section aria-labelledby="family-weekly-digest" className="mb-8">
        <h2
          id="family-weekly-digest"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <SparklesIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          今週の ハイライト
        </h2>
        <Card
          data-testid="family-weekly-digest-card"
          data-week-encouragement-key={weeklyDigest.encouragement.key}
          data-top-skills-count={weeklyDigest.topSkills.length}
          data-family-streak-days={weeklyDigest.familyStreakDays}
        >
          <CardHeader>
            <CardTitle className="text-base">
              {weeklyDigest.familyStreakHeadline}
            </CardTitle>
            <CardDescription>
              直近 7 日の 家族の つみあげを まとめました (家族内のみ / COPPA 準拠)。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* ピース 2: 各子の今週 XP ミニリスト (leaderboard の rank 順を維持) */}
            <div>
              <p className="mb-2 text-sm font-medium">
                家族の 今週の つみあげ
              </p>
              {weeklyDigest.perLearnerXp.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  家族メンバーが まだ 登録されていません
                </p>
              ) : (
                <ul
                  className="space-y-1"
                  aria-label="家族の 今週の XP ミニリスト"
                >
                  {weeklyDigest.perLearnerXp.map((row) => (
                    <li
                      key={row.learnerId}
                      data-digest-learner-id={row.learnerId}
                      data-digest-weekly-xp={row.weeklyXp}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{row.nickname}</span>
                      <span className="font-bold tabular-nums text-primary">
                        {row.weeklyXp} XP
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ピース 3: Top 3 単元 (家族全体 / answer_logs × problems × skills) */}
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <BookOpenIcon
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                よく とりくんだ 単元 トップ 3
              </p>
              {weeklyDigest.topSkills.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  来週から 単元別の つみあげが 集まっていきます
                </p>
              ) : (
                <ol
                  className="space-y-1"
                  aria-label="家族の 今週 トップ 3 単元"
                >
                  {weeklyDigest.topSkills.map((s, idx) => (
                    <li
                      key={s.skillId}
                      data-digest-top-skill-id={s.skillId}
                      data-digest-top-skill-rank={idx + 1}
                      data-digest-top-skill-count={s.answerCount}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center text-xs font-bold tabular-nums text-primary">
                          {idx + 1}
                        </span>
                        <span className="font-medium">{s.displayName}</span>
                      </span>
                      <span className="font-bold tabular-nums text-primary">
                        {s.answerCount} 問
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* ピース 4: 来週の励ましコピー (pre-curated catalog / 罰語ゼロ) */}
            <div className="rounded-md border-2 border-primary/40 bg-primary/5 px-4 py-3">
              <p
                data-digest-encouragement-copy
                className="text-sm font-medium text-primary"
              >
                {weeklyDigest.encouragement.copy}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              励まし コピーは 同じ 週は 安定して 同じ 文を 出します (DEC-024 罰則ゼロ)。
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
