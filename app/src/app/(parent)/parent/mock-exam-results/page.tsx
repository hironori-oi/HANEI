/**
 * /parent/mock-exam-results - 保護者向け 模試結果画面 (W4 / T-1)
 *
 * セクション構成:
 *  1. 過去模試一覧 (直近 10 件 / 日付降順 / 合格・不合格バッジ)
 *  2. レーダーチャート (直近 1 回の 4 技能スコア)
 *  3. 弱点 TOP 3 (過去 3 回平均で低い順)
 *  4. AI コーチ提案 (固定テンプレ + 弱点パラメータ / gpt-5-mini 実呼び出しせず)
 *  5. 次回受験日カウントダウン
 *
 * 認可: requireAuth → requireParent → requireFamilyMember → scopedQueries(familyId)
 *       生 db.select() 禁止
 *
 * デザイン: design-w3-parent-dashboard.md の保護者トーン (敬語 / フラット / 線で区切る) を継承。
 *           shadcn Card + Progress + Tabs (学習者切替) + Dialog (受験日設定) を使用。
 */

import Link from "next/link";
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

import {
  requireAuth,
  requireParent,
  requireFamilyMember,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { scopedQueries } from "@/lib/db/scoped";
import { db } from "@/lib/db/client";
import {
  getMockExamResults,
  getNearestExamCountdown,
  computeWeakestSkills,
  buildCoachSuggestionForWeakSkills,
  type MockExamRow,
} from "@/lib/study/aggregations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import { SkillRadarChart } from "../../components/skill-radar-chart";
import { ExamDateDialog } from "../../components/exam-date-dialog";

export const metadata = {
  title: "模試結果",
};

interface PageProps {
  searchParams: Promise<{ learner?: string | string[] }>;
}

export default async function MockExamResultsPage({ searchParams }: PageProps) {
  // 1. 三層認可
  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);
  await requireFamilyMember(session.userId, familyId);

  // 2. 家族の learner 一覧
  const scoped = scopedQueries(familyId);
  const learnersRaw = await scoped.listLearners();
  const learners = learnersRaw.map((l) => ({ id: l.id, nickname: l.nickname }));

  const sp = await searchParams;
  const { active } = resolveActiveLearner({
    learners,
    rawQuery: sp.learner,
  });

  if (!active) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">模試結果</h1>
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

  // 3. ?learner= 経由のアクセスは requireLearnerOwner で再検証 (URL 改ざん対策)
  await requireLearnerOwner(session.userId, active.id);

  // 4. データ取得 (並列)
  const [results, exam] = await Promise.all([
    getMockExamResults(db, active.id, 10),
    getNearestExamCountdown(db, active.id),
  ]);

  const latest: MockExamRow | undefined = results[0];
  // 弱点は直近 3 回平均
  const recent3 = results.slice(0, 3);
  const weakest = computeWeakestSkills(recent3, 3);
  const coachSuggestion = buildCoachSuggestionForWeakSkills(weakest);

  // 学習者プロフィールから既存受験日 (countdown と同じ)
  const initialDate = exam?.examDate;
  const initialLevel = exam?.level;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">
          {active.nickname} さんの模試結果
        </p>
        <h1 className="text-3xl font-bold">模試結果</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          直近の模試スコアと、AI
          コーチによる弱点別の学習プランをこちらでご確認いただけます。
        </p>
      </header>

      {/* セクション 1: 過去模試一覧 */}
      <section aria-labelledby="exam-history" className="mb-10">
        <h2
          id="exam-history"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <AcademicCapIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          過去の模試 (直近 10 件)
        </h2>

        {results.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                まだ模試の受験記録がありません。学習画面から模試モードを 1
                度受けると、こちらに結果が反映されます。
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {results.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-md border bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    英検 {r.level} 級 / {r.examDate.toLocaleDateString("ja-JP")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    スコア {r.score} / {r.maxScore} (
                    {Math.round((r.score / r.maxScore) * 100)}%)
                  </p>
                </div>
                {r.passFlag ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                    合格ライン
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    <ExclamationTriangleIcon
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                    要復習
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* セクション 2 & 3: レーダーチャート + 弱点 TOP 3 (横並び) */}
      <section aria-labelledby="skill-analysis" className="mb-10">
        <h2
          id="skill-analysis"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <ChartBarIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          4 技能 分析
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">直近 1 回の 4 技能スコア</CardTitle>
              <CardDescription>
                {latest
                  ? `${latest.examDate.toLocaleDateString("ja-JP")} 受験 / 英検 ${latest.level} 級`
                  : "受験記録がまだありません"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latest ? (
                <div className="flex justify-center text-foreground">
                  <SkillRadarChart scores={latest.skills} size={260} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  受験を 1 度すると、ここに 4 技能のバランスが表示されます。
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">弱点 TOP 3 (過去 3 回平均)</CardTitle>
              <CardDescription>
                直近 3 回の平均スコアが低い順に並んでいます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weakest.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  受験回数が不足しているため、まだ弱点判定はできません。
                </p>
              ) : (
                <ol className="space-y-3">
                  {weakest.map((w, i) => (
                    <li
                      key={w.skill}
                      className="flex items-center justify-between rounded-md border bg-background p-3"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                          {i + 1}
                        </span>
                        {labelForSkill(w.skill)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        平均 {Math.round(w.averageScore * 100)}%
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* セクション 4: AI コーチ提案 */}
      <section aria-labelledby="coach-suggestion" className="mb-10">
        <h2
          id="coach-suggestion"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <ChatBubbleLeftRightIcon
            className="h-6 w-6 text-primary"
            aria-hidden="true"
          />
          AI コーチからの提案
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {active.nickname}さん向け 学習プラン
            </CardTitle>
            <CardDescription>
              直近 3 回の模試結果から、弱点強化の優先順位をご提案します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {coachSuggestion}
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* セクション 5: 次回受験日カウントダウン + 受験日設定 Dialog */}
      <section aria-labelledby="next-exam" className="mb-10">
        <h2
          id="next-exam"
          className="mb-4 flex items-center gap-2 text-xl font-semibold"
        >
          <CalendarDaysIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          次回受験日
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>
              {exam
                ? `英検 ${exam.level} 級 / ${exam.examDate}`
                : "受験日が未登録です"}
            </CardTitle>
            <CardDescription>
              {exam
                ? `本日からあと ${exam.daysUntil} 日です。学習計画はダッシュボード側でご確認いただけます。`
                : "右の「受験日を設定する」から、目標とする英検級と受験日を登録してください。"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {exam ? (
              <p className="mb-4 text-4xl font-bold text-primary">
                あと {exam.daysUntil} 日
              </p>
            ) : null}
            <ExamDateDialog
              learnerId={active.id}
              learnerName={active.nickname}
              initialLevel={initialLevel}
              initialDate={initialDate}
            />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function labelForSkill(skill: "vocab" | "grammar" | "reading" | "listening"): string {
  switch (skill) {
    case "vocab":
      return "語彙";
    case "grammar":
      return "文法";
    case "reading":
      return "読解";
    case "listening":
      return "リスニング";
  }
}
