/**
 * /home - 学習者ホーム (W5 / G-1 + G-3 + W6 / F-3 + F-4)
 *
 * W6 拡張:
 *  - F-3: 親が複数 learner を持つ家族向け Tabs (1 名のみなら非表示)
 *  - F-4: 受験日カウントダウンのマイルストーン演出 (D-30 / D-7 / D-3 / D-1 / D-0)
 *
 * W5 既存:
 *  - examDate / daysUntilExam: learnerProfiles.examDate
 *  - todaysMission: answer_logs から「今日のスキル別解答数」を集計
 *  - target: learnerProfiles.dailyMinutesTarget を 4 スキルに均等配分し、1 分 = 1 問換算
 *  - streak: streaks.currentStreak
 *  - xp / level: xp_levels.totalXp / xp_levels.level
 *  - 級別進捗バー: getMasteryCoverage(...) で 4 スキル分集計
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - getLearnersForParent (parent userId → family scoped learners)
 *   - resolveActiveLearner (URL クエリ ?learner= を learners に照合 / 改ざん時は default fallback)
 *   - requireLearnerOwner (選択された learnerId が family 所属であることを SQL 再確認)
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LearnerSwitcherTabs } from "@/components/learner/learner-switcher-tabs";
import { StreakShieldBadge } from "@/components/home/streak-shield-badge";
import { SakuraStreakDisplay } from "@/components/home/sakura-streak-display";
import { DailyGoalRing } from "@/components/home/daily-goal-ring";
import { CharacterWithAccessories } from "@/components/character/accessories/character-with-accessories";

import {
  requireAuth,
  getFamilyIdForUser,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  getDailySkillCounts,
  getMasteryCoverage,
  getCurrentStreak,
} from "@/lib/study/aggregations";
import { getDailyProgress } from "@/lib/study/daily-goal";
import { getKotodamaStageInput } from "@/lib/study/kotodama-stage-resolver";
import { describeKotodamaStage } from "@/lib/study/kotodama-tori-stage";
import { eq } from "drizzle-orm";
import { xpLevels, streaks } from "@/lib/db/schema";
import { getLearnersForParent } from "@/lib/learner/repository";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import {
  pickCountdownVariant,
  type CountdownVariant,
} from "@/lib/study/countdown-variant";
import { loadAccessoriesPageData } from "@/lib/actions/accessories";
import {
  getMessagesForLearner,
  markMessageRead,
} from "@/lib/actions/parent-messages";
import {
  findOldestUnreadMessage,
  getMessageSenderName,
} from "@/lib/messages/parent-messages-server";
import { KotodamaToriModal } from "@/components/messages/kotodama-tori-modal";
import { getOrGenerateTodayQuests } from "@/lib/actions/quests";
import { DailyQuestSummaryRibbon } from "@/components/quest/DailyQuestSummaryRibbon";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { cn } from "@/lib/utils";

/**
 * W12-T3-B (DEC-070): β feedback ボタンの kill switch 評価.
 *  - default 表示 / "false" 設定時のみ非表示.
 *  - server component 評価のため client bundle に env が漏れない.
 */
function isBetaFeedbackEnabled(): boolean {
  return process.env.BETA_FEEDBACK_ENABLED !== "false";
}

export const metadata = {
  title: "ホーム",
};

interface MissionTuple {
  label: string;
  done: number;
  target: number;
}

const SKILL_LABEL_JA: Record<
  "vocabulary" | "grammar" | "reading" | "listening",
  { label: string; furigana: string }
> = {
  vocabulary: { label: "ごい", furigana: "語彙" },
  grammar: { label: "ぶんぽう", furigana: "文法" },
  reading: { label: "どっかい", furigana: "読解" },
  listening: { label: "リスニング", furigana: "リスニング" },
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
  // 当日 = 0 / 過去 = 負数 を保持 (variant 判定で利用)
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

interface CountdownPresentation {
  title: string;
  message: string;
  /** 「あと N 日」を表示するか (after では非表示) */
  showDaysNumber: boolean;
  /** Card に重ねる Tailwind クラス (枠 + 背景の強調) */
  cardClass: string;
  /** 数字本体の Tailwind クラス */
  numberClass: string;
  /** keyframe アニメ用クラス (prefers-reduced-motion で自動オフ) */
  animationClass: string;
}

function presentCountdown(
  variant: CountdownVariant,
  daysUntil: number | null,
): CountdownPresentation {
  switch (variant) {
    case "today":
      return {
        title: "今日が受験日！",
        message: "ここまでの がんばりを 信じて 楽しんできましょう。",
        showDaysNumber: false,
        cardClass: "border-primary ring-2 ring-primary/40 bg-primary/10",
        numberClass: "text-primary",
        animationClass: "hanei-countdown-today",
      };
    case "final1":
      return {
        title: "明日が本番！",
        message: "今日は はやめに ねて 体ちょうを ととのえましょう。",
        showDaysNumber: true,
        cardClass: "border-primary ring-2 ring-primary/40 bg-primary/10",
        numberClass: "text-primary",
        animationClass: "hanei-countdown-final1",
      };
    case "final3":
      return {
        title: "あと 3 日！",
        message: "ふりかえりの 時間です。にがてな ところを 1 つだけ おさらい。",
        showDaysNumber: true,
        cardClass: "border-primary/70 bg-primary/10",
        numberClass: "text-primary",
        animationClass: "hanei-countdown-final3",
      };
    case "week":
      return {
        title: "いよいよ 1 週間！",
        message: "毎日 すこしずつ つみかさねれば だいじょうぶです。",
        showDaysNumber: true,
        cardClass: "border-primary/50 bg-primary/5",
        numberClass: "text-primary",
        animationClass: "hanei-countdown-week",
      };
    case "month":
      return {
        title: "あと 30 日！",
        message: "毎日 コツコツ がんばりましょう。",
        showDaysNumber: true,
        cardClass: "border-primary/30 bg-primary/[0.04]",
        numberClass: "text-primary",
        animationClass: "",
      };
    case "after":
      return {
        title: "けっか まちです",
        message:
          daysUntil === null
            ? "受験日を プロフィールに 登録しましょう。"
            : "受験 おつかれさまでした。けっかを たのしみに まちましょう。",
        showDaysNumber: false,
        cardClass: "",
        numberClass: "text-muted-foreground",
        animationClass: "",
      };
    case "far":
    default:
      return {
        title: "受験日まで",
        message: "毎日の つみかさねが 力に なります。",
        showDaysNumber: true,
        cardClass: "",
        numberClass: "text-primary",
        animationClass: "",
      };
  }
}

/**
 * targetEikenLevel ("5"|"4"|"3") を G-3 進捗バー用 levelId に変換 (Phase 1 = "5" 固定運用)
 */
function pickLevelId(target: "5" | "4" | "3"): "5" | "4" | "3" {
  return target;
}

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // 1. 認可 + family 解決
  const session = await requireAuth();
  const familyId = await getFamilyIdForUser(session.userId);
  if (!familyId) {
    redirect("/onboarding/learner");
  }

  // 2. F-3: 親が所属する family 配下の全 learner を取得
  const learners = await getLearnersForParent(session.userId);
  if (learners.length === 0) {
    redirect("/onboarding/learner");
  }

  // 3. F-3: URL クエリ ?learner= から active learner を解決
  const sp = (await searchParams) ?? {};
  const resolved = resolveActiveLearner({
    learners: learners.map((l) => ({ id: l.id, nickname: l.nickname })),
    rawQuery: sp.learner,
  });
  const activeId = resolved.active?.id;
  if (!activeId) {
    redirect("/onboarding/learner");
  }

  // 4. SQL レベルでの所有確認 (URL 改ざんによる第二防御)
  await requireLearnerOwner(session.userId, activeId);

  const learner = learners.find((l) => l.id === activeId);
  if (!learner) {
    redirect("/onboarding/learner");
  }

  // 5. データ集計 (並列)
  const levelId = pickLevelId(learner.targetEikenLevel);
  const [
    streak,
    dailyCounts,
    coverage,
    xpRows,
    streakRows,
    dailyGoalProgress,
    kotodamaInput,
    accessoriesPageData,
    messages,
    questSummary,
  ] = await Promise.all([
    getCurrentStreak(db, learner.id),
    getDailySkillCounts(db, learner.id),
    getMasteryCoverage(db, learner.id, levelId),
    // eslint-disable-next-line no-restricted-syntax -- 認可済 (familyId スコープ + learner.id 解決済み)
    db
      .select({ totalXp: xpLevels.totalXp, level: xpLevels.level })
      .from(xpLevels)
      .where(eq(xpLevels.learnerId, learner.id))
      .limit(1),
    // eslint-disable-next-line no-restricted-syntax -- 認可済 (familyId スコープ + learner.id 解決済み)
    db
      .select({ freezeTickets: streaks.freezeTickets })
      .from(streaks)
      .where(eq(streaks.learnerId, learner.id))
      .limit(1),
    // W8-T5: 自己選択日次ゴール 進捗
    getDailyProgress(db, learner.id),
    // W9-T1: ことだまトリ 5 段階進化 入力 (totalXp + currentStreak + badge)
    getKotodamaStageInput(db, learner.id),
    // W9-Polish: アクセサリ装着状況 + 解禁数 (12 種中 N 種)
    loadAccessoriesPageData(learner.id),
    // W9-Polish: 親メッセージ一覧 (未読数 / 受信総数のため)
    getMessagesForLearner(learner.id),
    // W10-T3: Daily Quest 今日の 3 件 (lazy generation 入口)
    // W10-T4 / review M-4: クエスト生成失敗時に /home が 500 にならないよう
    // try-catch で握りつぶし null fallback (リボンは null チェックで非表示)
    getOrGenerateTodayQuests(learner.id).catch((err) => {
      console.error("[home] getOrGenerateTodayQuests failed:", err);
      return null;
    }),
  ]);

  const xp = xpRows[0] ?? { totalXp: 0, level: 1 };
  const freezeTickets = streakRows[0]?.freezeTickets ?? 0;
  const daysUntilExam = computeDaysUntil(learner.examDate);
  const variant = pickCountdownVariant(daysUntilExam);
  const cd = presentCountdown(variant, daysUntilExam);

  // W9-Polish: 統合 /home 用集計値
  const stageInfo = describeKotodamaStage(kotodamaInput);
  const accessoriesUnlockedCount = accessoriesPageData.unlocked.length;
  const ACCESSORIES_TOTAL = 12;
  const unreadMessagesCount = messages.filter((m) => m.readAt === null).length;

  // W10-T3: Daily Quest 集計 (questSummary が null の場合はリボン非表示)
  const questClaimableCount = questSummary
    ? questSummary.quests.filter((q) => q.isClaimable).length
    : 0;

  // 6. todaysMission target 配分 (1 分 = 1 問換算 / 4 スキル均等)
  const totalDailyMinutes = learner.dailyMinutesTarget ?? 60;
  const perSkillTarget = Math.max(1, Math.floor(totalDailyMinutes / 4));
  const missions: ReadonlyArray<MissionTuple> = [
    { label: "語彙", done: dailyCounts.vocabulary, target: perSkillTarget },
    { label: "文法", done: dailyCounts.grammar, target: perSkillTarget },
    { label: "リスニング", done: dailyCounts.listening, target: perSkillTarget },
    { label: "ライティング", done: dailyCounts.writing, target: perSkillTarget },
  ];

  // 表示用残日数 (after の場合は |days|)
  const displayDays =
    daysUntilExam === null ? null : Math.max(0, daysUntilExam);

  // W11-T2 / DEC-062: 最古の未読 1 件を pick → kotodama-tori 代読 modal で push.
  // messages は desc (新着が先頭) で返るため、findOldestUnreadMessage で末尾から走査.
  const oldestUnread = findOldestUnreadMessage(messages);
  let modalSenderName: string | null = null;
  if (oldestUnread) {
    modalSenderName = await getMessageSenderName(oldestUnread.id, familyId);
  }

  // /home から呼ぶ既読更新 server-bound action (formData -> messageId).
  // 認可は markMessageRead 内部で SQL レベル再確認 (DEC-003 三層認可).
  async function homeMarkReadAction(formData: FormData): Promise<void> {
    "use server";
    const messageId = formData.get("messageId");
    if (typeof messageId !== "string" || messageId.length === 0) {
      return;
    }
    await markMessageRead(messageId);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 space-y-3">
        {/* F-3: 学習者切替 Tabs (2 名以上の場合のみ表示) */}
        {learners.length > 1 ? (
          <LearnerSwitcherTabs
            learners={learners.map((l) => ({
              id: l.id,
              nickname: l.nickname,
              avatarId: l.avatarId,
            }))}
            activeLearnerId={learner.id}
          />
        ) : null}
        <p className="text-sm text-muted-foreground">
          こんにちは、{learner.nickname} さん
        </p>
        <h1 className="text-3xl font-bold">きょうのミッション</h1>
      </header>

      <div className="grid gap-6 sm:grid-cols-3">
        {/* 受験日カウントダウン (W6 / F-4 マイルストーン演出) */}
        <Card
          data-countdown-variant={variant}
          className={cn(cd.cardClass, cd.animationClass)}
        >
          <CardHeader>
            <CalendarDaysIcon
              className="mb-2 h-8 w-8 text-primary"
              aria-hidden="true"
            />
            <CardTitle className="text-base">{cd.title}</CardTitle>
            <CardDescription>
              {learner.examDate ?? "未設定"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {daysUntilExam === null ? (
              <p className="text-sm text-muted-foreground">
                受験日をプロフィールに登録しましょう。
              </p>
            ) : cd.showDaysNumber && displayDays !== null ? (
              <>
                <p
                  className={cn("text-3xl font-bold", cd.numberClass)}
                  aria-live="polite"
                >
                  あと {displayDays} 日
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {cd.message}
                </p>
              </>
            ) : (
              <p className="text-sm text-foreground" aria-live="polite">
                {cd.message}
              </p>
            )}
            {/* W12-T2 / DEC-076: 学習者本人による受験日 自己編集 link
                罰則ゼロ哲学 (DEC-024) に基づき、リンク文言は丁寧日本語のみ */}
            <Link
              href={`/home/exam-date?learner=${encodeURIComponent(activeId)}`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
              data-testid="home-exam-date-edit-link"
            >
              <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
              受験日を変更する
            </Link>
          </CardContent>
        </Card>

        {/* 連続記録: W8-T6 桜の木メタファ (Duolingo 流の炎アイコンを置換) */}
        <div className="space-y-2">
          <SakuraStreakDisplay streakDays={streak} svgSize={88} />
          {/* freeze ticket 残数バッジは桜カードの下に補助表示 */}
          <div className="flex items-center justify-end px-1">
            <StreakShieldBadge
              count={freezeTickets}
              examDate={learner.examDate}
            />
          </div>
        </div>

        {/* XP / レベル */}
        <Card>
          <CardHeader>
            <TrophyIcon
              className="mb-2 h-8 w-8 text-accent"
              aria-hidden="true"
            />
            <CardTitle className="text-base">レベル</CardTitle>
            <CardDescription>
              累計 {xp.totalXp} XP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">Lv. {xp.level}</p>
          </CardContent>
        </Card>
      </div>

      {/* W8-T5: 今日のゴール プログレスリング */}
      <section className="mt-8">
        <DailyGoalRing progress={dailyGoalProgress} />
      </section>

      {/* 今日の学習プラン */}
      <section className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <AcademicCapIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          きょうの学習プラン ({totalDailyMinutes}分目安)
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {missions.map((m) => (
            <MissionCard
              key={m.label}
              label={m.label}
              done={m.done}
              target={m.target}
            />
          ))}
        </div>
      </section>

      {/* G-3: 級別進捗バー (4 スキル) */}
      <section className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <ChartBarIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          英検{levelId}級の進捗
        </h2>
        <Card>
          <CardHeader>
            <CardDescription>
              マスター済み = 一度でも正解した問題。出題対象は解説が用意できているものに限ります。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {coverage.map((c) => {
              const meta = SKILL_LABEL_JA[c.skill];
              const pct =
                c.total > 0 ? Math.floor((c.mastered / c.total) * 100) : 0;
              return (
                <div key={c.skill} className="space-y-1">
                  <div className="flex items-end justify-between text-sm">
                    <span className="font-medium">
                      <ruby>
                        {meta.furigana}
                        <rt>{meta.label}</rt>
                      </ruby>
                    </span>
                    <span
                      className="tabular-nums text-muted-foreground"
                      aria-label={`${meta.furigana} ${c.mastered} / ${c.total} 問 (${pct}%)`}
                    >
                      {c.mastered} / {c.total} 問 ({pct}%)
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    aria-label={`${meta.furigana} の進捗 ${pct}%`}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* W9-Polish: ことだまトリ 5 段階進化 + 装着アクセサリ overlay 統合表示
          (W9-T1 stage info + W9-B equipped accessories) */}
      <section className="mt-10">
        <Card
          data-testid="kotodama-stage-display"
          data-stage={stageInfo.stage}
          data-progress-to-next={stageInfo.progressToNext}
        >
          <CardHeader>
            <CardTitle className="text-base">ことだまトリ</CardTitle>
            <CardDescription>
              いま:{" "}
              <ruby>
                {stageInfo.furigana}
                <rt>{stageInfo.label}</rt>
              </ruby>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="flex shrink-0 items-center justify-center rounded-md bg-muted/30 p-2">
                <CharacterWithAccessories
                  input={kotodamaInput}
                  equippedBySlot={accessoriesPageData.equippedBySlot}
                  svgSize={160}
                />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {stageInfo.description}
                </p>
                {stageInfo.nextStageHint && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-bold text-primary">
                      {stageInfo.nextStageHint}
                    </span>
                  </p>
                )}
                {stageInfo.nextStage === null && (
                  <p className="text-xs text-muted-foreground">
                    さいこうの だんかいに とうたつしました。
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* W10-T3: Daily Quest サマリ リボン (4 ボタン群の上に配置 / 罰則ゼロ哲学)
          W10-T4 / review M-4: 生成失敗時 (questSummary === null) はリボン自体を非表示 */}
      {questSummary ? (
        <section className="mt-6">
          <DailyQuestSummaryRibbon
            learnerId={activeId}
            totalCount={questSummary.totalCount}
            completedCount={questSummary.completedCount}
            claimedCount={questSummary.claimedCount}
            claimableCount={questClaimableCount}
            allBonusClaimed={questSummary.allBonusClaimed}
          />
        </section>
      ) : null}

      {/* W9-C / W9-B / W9-D + W10-T2: バッジ + アクセサリ + メッセージ + ショップ 4 ボタン構成 */}
      <section className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild variant="outline" size="lg" className="min-h-tap-cta">
          <Link
            href={`/badges?learner=${encodeURIComponent(activeId)}`}
            className="inline-flex items-center gap-2"
          >
            <TrophyIcon className="h-5 w-5" aria-hidden="true" />
            <span>
              バッジ
              <span className="ml-2 tabular-nums text-muted-foreground">
                ({kotodamaInput.badgeCount} / 8)
              </span>
            </span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="min-h-tap-cta">
          <Link
            href={`/settings/accessories?learner=${encodeURIComponent(activeId)}`}
            className="inline-flex items-center gap-2"
          >
            <SparklesIcon className="h-5 w-5" aria-hidden="true" />
            <span>
              アクセサリ
              <span className="ml-2 tabular-nums text-muted-foreground">
                ({accessoriesUnlockedCount} / {ACCESSORIES_TOTAL})
              </span>
            </span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="min-h-tap-cta">
          <Link
            href={`/messages?learner=${encodeURIComponent(activeId)}`}
            className="inline-flex items-center gap-2"
            data-testid="home-messages-link"
            data-unread={unreadMessagesCount}
          >
            <EnvelopeIcon className="h-5 w-5" aria-hidden="true" />
            <span>
              おうえん メッセージ
              {unreadMessagesCount > 0 ? (
                <span
                  className="ml-2 inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-bold tabular-nums text-primary-foreground"
                  aria-label={`未読 ${unreadMessagesCount} 通`}
                >
                  {unreadMessagesCount} 通
                </span>
              ) : (
                <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                  (未読 0 通)
                </span>
              )}
            </span>
          </Link>
        </Button>
        {/* W10-T2: ショップ ボタン (DEC-056 4 ボタン構成) */}
        <Button asChild variant="outline" size="lg" className="min-h-tap-cta">
          <Link
            href={`/shop?learner=${encodeURIComponent(activeId)}`}
            className="inline-flex items-center gap-2"
            data-testid="home-shop-link"
          >
            <ShoppingBagIcon className="h-5 w-5" aria-hidden="true" />
            <span>ショップ</span>
          </Link>
        </Button>
      </section>

      {/* AI コーチ ひとこと */}
      <section className="mt-10">
        <Card>
          <CardHeader>
            <ChatBubbleLeftRightIcon
              className="mb-2 h-8 w-8 text-accent"
              aria-hidden="true"
            />
            <CardTitle className="text-base">コーチから</CardTitle>
            <CardDescription>ことだまトリのひとこと</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {streak > 0
                ? `${streak} 日連続学習中です。きょうもいっしょにがんばりましょう。`
                : "まずは語彙からはじめてみましょう。"}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* W11-T2 / DEC-062: 親→子 応援メッセージ kotodama-tori 代読 modal
          最古の未読 1 件があれば push 表示. ありがとう click で markMessageRead → close.
          学習者が未読のまま離脱した場合も、次回 /home 訪問でまた表示される (read_at IS NULL の間). */}
      {oldestUnread && modalSenderName ? (
        <KotodamaToriModal
          messageId={oldestUnread.id}
          body={oldestUnread.body}
          learnerNickname={learner.nickname}
          fromName={modalSenderName}
          markReadAction={homeMarkReadAction}
        />
      ) : null}

      <section className="mt-10 rounded-md border bg-muted/30 p-6 text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          きょうのミッションをはじめましょう。
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {/* W10-T4: メイン CTA は /study に変えて時間選択を経由させる */}
          <Button asChild size="lg" className="min-h-tap-cta">
            <Link
              href={`/study?learner=${encodeURIComponent(activeId)}`}
              data-testid="home-start-study-cta"
            >
              がくしゅうを はじめる
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-h-tap-cta">
            <Link href={`/study/eiken-${levelId}/vocab`}>
              語彙(英検{levelId}級)をはじめる
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-h-tap-cta">
            <Link href={`/study/eiken-${levelId}/grammar`}>
              文法(英検{levelId}級)
            </Link>
          </Button>
        </div>
      </section>

      {/* W12-T3-B (DEC-070): β feedback 収集動線
          目立たない位置 = ページ最下部に小型 outline ボタン.
          parent role 認可は requireAuth + getFamilyIdForUser で既に通過済 = ここに到達した時点で
          parent 確定. learner UI には出さない設計 (DEC-070 §2). */}
      {isBetaFeedbackEnabled() ? (
        <footer className="mt-10 flex justify-center pb-4">
          <FeedbackButton userEmail={session.email} />
        </footer>
      ) : null}
    </main>
  );
}

function MissionCard({
  label,
  target,
  done,
}: {
  label: string;
  target: number;
  done: number;
}) {
  const pct = target > 0 ? Math.min(100, Math.floor((done / target) * 100)) : 0;
  const status = done >= target ? "達成" : done > 0 ? "進行中" : "未着手";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>
          {done} / {target} 問 ・ {status}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={pct} aria-label={`${label} の進捗 ${pct}%`} />
      </CardContent>
    </Card>
  );
}
