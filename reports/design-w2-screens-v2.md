# PRJ-016 HANEI W2 画面実装ガイド v2（home / study / diagnosis）

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W2 開発実装（home / study / diagnosis 3 画面の精緻化）
- **W1 連携**: design-w1-tokens.md / design-w1-character.md / design-w1-screens.md / design-w1-microcopy.md
- **DEC 連携**: DEC-004（HANEI / Amber Gold / ことだまトリ）/ DEC-008（K-1 タップ領域）/ DEC-012（無料運用）
- **方針**: v1 を**精緻化（拡張）**するもので置き換えではない。Tailwind v4 + shadcn/ui + Heroicons 24/outline + framer-motion 構成、絵文字 0、ふりがなは必要箇所のみ HTML `<ruby>`。

---

## § 1. 概要（v1 からの差分）

### 1.1 v1 → v2 の主な追加・精緻化

| 項目 | v1（design-w1-screens.md） | v2（本ガイド） |
|---|---|---|
| home | 構造 + Hero/Tasks/Coach/Streak の 4 セクション | XP/レベルゲージ + 受験日 CTA 未登録時分岐 + バッジ通知 + 親リンクフッター + ふきだしマイクロコピー連携を追加 |
| study | 構造 + Word カード + 正解/不正解 Bottom Sheet | プログレスバー詳細 + 4 択 motion variants + キーボード操作 + ARIA live region + 解説ドロワー（slide-up）+ セット完了サマリーを追加 |
| diagnosis | v1 では `/diagnostic` 15 問固定の構造のみ | adaptive flow chart + IRT theta 推定遷移図 + 中断/再開保存戦略 + 終了時推奨スタート級 + 受験日入力 CTA を追加 |
| ことだまトリ 状態 | 7 表情 + 6 ポーズ | **10 状態マッピング表**を新設（waiting / cheering / thinking / explaining / sad / proud / sleepy / excited / curious / celebrating） |
| マイクロコピー | 86 例文 | **W2 で 30 例追加**（home ふきだし / study 解説 / diagnosis ガイド） |
| アクセシビリティ | 各画面 a11y チェック | コントラスト比 / フォーカスリング / SR / 動きを減らす を**章として独立** |

### 1.2 v2 で守る制約（再確認）

- 絵文字 0、Heroicons 24/outline のみ
- 主要 CTA `min-h-[56px]`、副次 `min-h-[48px]`、隣接要素間隔 8px 以上
- 本文 16-18px、行間 1.6 以上、字間 0.02em（学習文は line-height 1.7-1.8）
- ふりがなはアプリ全体ではなく**必要箇所のみ** `<ruby>`
- ダークモード対応（`dark:` 接頭辞）
- `prefers-reduced-motion` 必須
- 全コントラスト比 WCAG AA 以上（design-w1-tokens.md §1 マトリクスに準拠）

### 1.3 採用技術判断（v2 確定）

- **framer-motion 採用**: 正解/不正解フィードバック・ドロワー slide-up・カウントダウンの過度な演出抑制に variants が有効
- **shadcn/ui 追加コンポーネント**: `progress` `sheet` `tabs` を W2 で追加 install（v1 では button/card/input/label のみ）
- **Tailwind v4 構文**: `bg-amber-500/10` 等の opacity modifier、`@theme` 変数参照は `[var(--brand-500)]` 任意角括弧で統一

---

## § 2. home 画面 v2（`/home`）

### 2.1 画面構成（モバイル基準・`sm:` 以上 2 カラム）

```
Screen: home
├─ HeaderBar（拡張）
│  ├─ LeftCluster: HANEI ロゴ + ことだまトリ アイコン (32×32)
│  ├─ CenterCluster (lg+): ストリーク Pill + XP/Level ゲージ
│  └─ RightCluster: NotificationButton + Cog6ToothIcon（設定）
│
├─ Section A: HeroCountdown（受験日カウントダウン）
│  ├─ exam_date 登録済み: 「英検3級まで あと XX 日」
│  └─ exam_date 未登録: CTA「受験日をきめる」
│
├─ Section B: TodaysPlan
│  └─ Card × 4: 語彙 / 文法 / リスニング / ライティング（45 分配分）
│
├─ Section C: KotodamaCoachBubble
│  └─ ふきだしで「きょうもがんばろうね」等の マイクロコピー
│
├─ Section D: BadgeAndStreakNotice
│  └─ バッジ取得時のみ表示 / streakStamp variant
│
└─ Footer: 4 タブ
   ├─ HomeIcon「ホーム」
   ├─ AcademicCapIcon「学習」
   ├─ ChatBubbleLeftRightIcon「コーチ」
   └─ UserGroupIcon「保護者」
```

### 2.2 完全 JSX サンプル + Tailwind class フル指定

```tsx
// app/(app)/home/page.tsx
"use client";

import {
  BellIcon,
  Cog6ToothIcon,
  HomeIcon,
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  BookOpenIcon,
  PencilSquareIcon,
  SpeakerWaveIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  SparklesIcon,
  FireIcon,
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { cardEnter, slideUp, streakStamp } from "@/lib/motion/variants";
import { useMotionVariant } from "@/lib/motion/safe";

export default function HomePage({ user }: { user: HomeUser }) {
  const cardV = useMotionVariant(cardEnter);
  const stampV = useMotionVariant(streakStamp);

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      {/* === HeaderBar === */}
      <header className="sticky top-0 z-40 h-16 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur dark:bg-[var(--surface)]/90">
        <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between px-4 lg:px-8">
          <Link href="/home" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="HANEI" width={88} height={32} priority />
            <Image src="/character/idle.svg" alt="" width={32} height={32} />
          </Link>

          {/* CenterCluster: ストリーク + XP ゲージ */}
          <div className="hidden items-center gap-4 lg:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1 text-sm font-medium text-[var(--brand-700)] dark:bg-[var(--brand-900)]/30 dark:text-[var(--brand-300)]">
              <FireIcon className="h-4 w-4" />
              連続 {user.streakDays} 日
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[var(--ink-900)]">
                Lv{user.level}
              </span>
              <div
                className="h-2 w-32 rounded-full bg-[var(--surface-muted)]"
                role="progressbar"
                aria-valuenow={user.xpPercent}
                aria-valuemax={100}
                aria-label={`次のレベルまで ${100 - user.xpPercent}%`}
              >
                <div
                  className="h-full rounded-full bg-[var(--brand-500)] transition-[width] duration-500"
                  style={{ width: `${user.xpPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="通知"
              className="grid h-12 w-12 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
            >
              <BellIcon className="h-5 w-5 text-[var(--ink-700)]" />
            </button>
            <Link
              href="/settings"
              aria-label="設定"
              className="grid h-12 w-12 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
            >
              <Cog6ToothIcon className="h-5 w-5 text-[var(--ink-700)]" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl space-y-6 px-4 py-6 lg:px-8">
        {/* === Section A: HeroCountdown === */}
        <motion.section
          className="rounded-3xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] p-6 shadow-[var(--shadow-card)] sm:p-8 dark:from-[var(--brand-900)]/20 dark:to-[var(--brand-800)]/20"
          variants={cardV}
          initial="hidden"
          animate="visible"
        >
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Image
              src="/character/cheer.svg"
              alt=""
              width={160}
              height={160}
              className="h-32 w-32 sm:h-40 sm:w-40"
            />
            <div className="flex-1 text-center sm:text-left">
              <h1 className="font-heading text-2xl font-bold text-[var(--ink-900)] sm:text-3xl">
                今日のミッション
              </h1>
              {user.examDate ? (
                <>
                  <div className="mt-2 flex flex-wrap items-baseline justify-center gap-2 sm:justify-start">
                    <span className="text-base text-[var(--ink-700)]">
                      <ruby>英検<rt>えいけん</rt></ruby>3<ruby>級<rt>きゅう</rt></ruby>まで
                    </span>
                    <time
                      dateTime={user.examDate}
                      className="font-mono text-4xl font-bold text-[var(--brand-700)] sm:text-5xl"
                    >
                      あと {user.daysUntilExam} 日
                    </time>
                  </div>
                  <p className="mt-1 text-sm text-[var(--mint-700)] dark:text-[var(--mint-300)]">
                    1日 45 分で間に合うペースです。
                  </p>
                </>
              ) : (
                <div className="mt-3">
                  <p className="text-base text-[var(--ink-700)]">
                    受験日をきめると、ぴったりのペースで進められます。
                  </p>
                  <Link
                    href="/onboarding/exam-date"
                    className="mt-3 inline-flex min-h-[56px] items-center gap-2 rounded-xl bg-[var(--brand-600)] px-5 text-base font-bold text-white shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)]"
                  >
                    <CalendarDaysIcon className="h-5 w-5" />
                    受験日をきめる
                    <ChevronRightIcon className="h-5 w-5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* === Section B: TodaysPlan === */}
        <section aria-labelledby="todays-plan-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2
              id="todays-plan-heading"
              className="font-heading text-xl font-bold text-[var(--ink-900)]"
            >
              きょうのべんきょう（45分）
            </h2>
            <span className="text-sm text-[var(--ink-500)]">
              {user.completedTasks}/4 完了
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {user.todayTasks.map((task) => (
              <motion.article
                key={task.skillCode}
                variants={cardV}
                initial="hidden"
                animate="visible"
                className="rounded-3xl bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"
              >
                <Link
                  href={`/study/${task.levelCode}/${task.skillCode}`}
                  className="block min-h-[160px] focus-visible:shadow-[var(--shadow-focus)] focus-visible:rounded-3xl"
                >
                  <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-100)] dark:bg-[var(--brand-900)]/30">
                    {task.skillCode === "vocab" && <BookOpenIcon className="h-6 w-6 text-[var(--brand-700)]" />}
                    {task.skillCode === "grammar" && <PencilSquareIcon className="h-6 w-6 text-[var(--brand-700)]" />}
                    {task.skillCode === "listening" && <SpeakerWaveIcon className="h-6 w-6 text-[var(--brand-700)]" />}
                    {task.skillCode === "writing" && <PencilSquareIcon className="h-6 w-6 text-[var(--brand-700)]" />}
                  </div>
                  <h3 className="text-base font-bold text-[var(--ink-900)]">
                    {task.title}
                  </h3>
                  <p className="text-sm text-[var(--ink-500)]">{task.duration}分</p>
                  <div
                    className="mt-3 h-2 rounded-full bg-[var(--surface-muted)]"
                    role="progressbar"
                    aria-valuenow={task.progressPercent}
                    aria-valuemax={100}
                    aria-label={`${task.title} の進捗 ${task.progressPercent}パーセント`}
                  >
                    <div
                      className="h-full rounded-full bg-[var(--mint-500)]"
                      style={{ width: `${task.progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[var(--ink-500)]">
                    {task.statusLabel}
                  </p>
                </Link>
              </motion.article>
            ))}
          </div>
        </section>

        {/* === Section C: KotodamaCoachBubble === */}
        <motion.section
          variants={useMotionVariant(slideUp)}
          initial="hidden"
          animate="visible"
          className="flex items-start gap-4 rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]"
        >
          <Image
            src="/character/support.svg"
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 shrink-0"
          />
          <div className="relative flex-1">
            <div className="rounded-2xl bg-[var(--brand-50)] px-4 py-3 dark:bg-[var(--brand-900)]/30">
              <p className="text-base leading-relaxed text-[var(--ink-700)]">
                {user.coachMessage /* 例: 「きょうもがんばろうね。きのう覚えた『decide』、今日も復習に出しますね。」 */}
              </p>
            </div>
            <Link
              href="/coach"
              className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-[var(--brand-700)] hover:underline focus-visible:shadow-[var(--shadow-focus)] focus-visible:rounded"
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              コーチと話す
            </Link>
          </div>
        </motion.section>

        {/* === Section D: BadgeAndStreakNotice === */}
        {user.newBadge && (
          <motion.aside
            variants={stampV}
            initial="hidden"
            animate="visible"
            role="status"
            aria-live="polite"
            className="flex items-center gap-4 rounded-3xl border-2 border-[var(--brand-300)] bg-[var(--surface-overlay)] p-5 shadow-[var(--shadow-pop)]"
          >
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--badge-bronze)]">
              <SparklesIcon className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--brand-700)]">
                新しいバッジ
              </p>
              <p className="mt-1 text-base font-bold text-[var(--ink-900)]">
                {user.newBadge.name}
              </p>
              <p className="mt-1 text-sm text-[var(--ink-500)]">
                {user.newBadge.description}
              </p>
            </div>
          </motion.aside>
        )}
      </main>

      {/* === Footer Tab === */}
      <nav
        aria-label="メインナビゲーション"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-screen-xl items-stretch justify-around">
          {[
            { href: "/home", label: "ホーム", icon: HomeIcon },
            { href: "/study", label: "学習", icon: AcademicCapIcon },
            { href: "/coach", label: "コーチ", icon: ChatBubbleLeftRightIcon },
            { href: "/parent", label: "保護者", icon: UserGroupIcon },
          ].map((tab) => (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-xs text-[var(--ink-500)] hover:text-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:rounded-xl aria-[current=page]:text-[var(--brand-700)]"
              >
                <tab.icon className="h-6 w-6" />
                <span>{tab.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
```

### 2.3 状態遷移図（home）

```
[初回ログイン]
    │
    ├─ exam_date あり? ──Yes──→ HeroCountdown「あと XX 日」表示
    │                          │
    │                          └─ 残日数 ≤ 30: countdown.ts F カテゴリ表示
    │
    └─ No ──→ HeroCTA「受験日をきめる」押下 → /onboarding/exam-date
                          │
                          └─ 保存後 home リダイレクト

[TodaysPlan カード押下]
    │
    └─ /study/[levelCode]/[skillCode] へ遷移
       └─ 完了後 home に戻り task.progressPercent が 0 → 100

[BadgeAndStreakNotice]
    │
    ├─ 初回バッジ取得 7日/30日/90日 達成日に表示
    └─ 表示後 24h で自動非表示 + dismiss 可能

[KotodamaCoachBubble]
    │
    └─ user.coachMessage は 1 日 1 回更新（朝 5:00 JST）
       └─ design-w1-microcopy.md G/J/K カテゴリから seed=日付 で安定選択
```

### 2.4 a11y 注釈（home）

- ストリーク Pill: `<span>` だが意味的に進捗 → `aria-label` で「連続学習 12 日目」を別途付与
- XP/Level ゲージ: `role="progressbar"` + `aria-valuenow/aria-valuemax/aria-label` 必須
- `<time dateTime="2026-07-22">` で受験日を機械可読化
- コーチふきだし: `<p>` タグ、画像は `alt=""`（装飾）。SR 利用者にはセリフ本文のみ届く
- 通知 / 設定ボタン: `aria-label` で 動詞付与（「通知をひらく」「設定をひらく」）
- フッター タブ: 現在タブに `aria-current="page"`、Tailwind 側で `aria-[current=page]:` 修飾

---

## § 3. study 画面 v2（`/study/[levelCode]/[skillCode]`）

### 3.1 画面構成

```
Screen: study 4択演習
├─ TopBar
│  ├─ BackButton: ChevronLeftIcon (48×48) aria-label="学習を中断して戻る"
│  ├─ ProgressBar: 「4/10 問目」role=progressbar
│  └─ HeartsRow: HeartIcon × 残ライフ数
│
├─ QuestionCard
│  ├─ Setup: 「次の英文の (   ) に入る言葉を選んでください。」
│  ├─ StudyEnglish: 28-32px / font-en font-bold / line-height 1.7
│  └─ KotodamaTori: idle / waiting ポーズ（図像なし時）
│
├─ ChoiceGrid（4 択 縦 4 列）
│  └─ ChoiceButton × 4: 56px 高 / Amber Gold ボーダー / tap で scale 0.98
│
├─ AnswerFooter（選択後表示）
│  └─ 「答える」CTA min-h-[56px]
│
├─ FeedbackOverlay（回答後）
│  ├─ 正解: Mint 背景フラッシュ 600ms + correctPop + 「やったね、せいかい！」
│  └─ 誤答: Sky 背景フラッシュ + wrongShake + 「おしいね、いっしょにみてみよう」
│
├─ ExplanationDrawer（誤答時 / 正解時の解説）
│  └─ Bottom Sheet: slide-up 220ms / 「正解の理由」「間違えやすい理由」「ことだまトリ ひとこと」
│
└─ SetCompleteSummary（10 問終了時）
   └─ 正答率 / 獲得 XP / SRS 次回出現日 / バッジ獲得有無
```

### 3.2 完全 JSX サンプル

```tsx
// app/(app)/study/[levelCode]/[skillCode]/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronLeftIcon,
  HeartIcon,
  CheckCircleIcon,
  XCircleIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { correctPop, wrongShake, slideUp } from "@/lib/motion/variants";
import { useMotionVariant } from "@/lib/motion/safe";
import { selectMessage } from "@/lib/copy/select";

export default function StudyPage({ session }: { session: StudySession }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<"answering" | "feedback" | "explanation">("answering");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const popV = useMotionVariant(correctPop);
  const shakeV = useMotionVariant(wrongShake);
  const drawerV = useMotionVariant(slideUp);

  const current = session.questions[session.currentIndex];
  const isCorrect = selected !== null && current.choices[selected].isAnswer;

  // キーボード操作: 1-4 で選択 / Enter で答える / Esc で中断
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== "answering") return;
      if (["1", "2", "3", "4"].includes(e.key)) {
        setSelected(Number(e.key) - 1);
      }
      if (e.key === "Enter" && selected !== null) {
        submitAnswer();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, selected]);

  const submitAnswer = () => {
    setPhase("feedback");
    if (liveRef.current) {
      liveRef.current.textContent = isCorrect
        ? selectMessage("correct", current.id)
        : selectMessage("wrong", current.id);
    }
    setTimeout(() => setDrawerOpen(true), 600);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      {/* === TopBar === */}
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-label="学習を中断して戻る"
          onClick={() => history.back()}
          className="grid h-12 w-12 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
        >
          <ChevronLeftIcon className="h-6 w-6 text-[var(--ink-700)]" />
        </button>
        <div
          className="flex-1"
          role="progressbar"
          aria-valuenow={session.currentIndex + 1}
          aria-valuemax={session.questions.length}
          aria-label={`${session.questions.length}問中 ${session.currentIndex + 1}問目`}
        >
          <div className="h-2 rounded-full bg-[var(--surface-muted)]">
            <motion.div
              className="h-full rounded-full bg-[var(--brand-500)]"
              initial={{ width: 0 }}
              animate={{ width: `${((session.currentIndex + 1) / session.questions.length) * 100}%` }}
              transition={{ duration: reduceMotion ? 0.01 : 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="mt-1 text-center font-mono text-xs text-[var(--ink-500)]">
            {session.currentIndex + 1} / {session.questions.length} 問目
          </p>
        </div>
        <div className="flex gap-1" aria-label={`残りライフ ${session.hearts}`}>
          {Array.from({ length: 3 }).map((_, i) => (
            <HeartIcon
              key={i}
              className={cn(
                "h-6 w-6",
                i < session.hearts ? "text-[var(--brand-500)]" : "text-[var(--surface-muted)]"
              )}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4">
        {/* === QuestionCard === */}
        <motion.section
          key={current.id}
          variants={popV}
          initial="hidden"
          animate={phase === "feedback" && isCorrect ? "visible" : "hidden"}
          className={cn(
            "rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] sm:p-8",
            phase === "feedback" && isCorrect && "bg-[var(--mint-100)] dark:bg-[var(--mint-700)]/30",
            phase === "feedback" && !isCorrect && "bg-[var(--sky-100)] dark:bg-[var(--sky-700)]/30"
          )}
        >
          <p className="text-sm font-medium text-[var(--ink-500)]">
            問題 {session.currentIndex + 1}
          </p>
          <p className="mt-2 text-base leading-relaxed text-[var(--ink-700)]">
            {current.prompt}
          </p>

          {/* 学習文（28-32px） */}
          <div className="mt-5 rounded-2xl bg-[var(--brand-50)] p-5 dark:bg-[var(--brand-900)]/20">
            <p className="text-center font-en text-3xl font-bold leading-[1.7] text-[var(--ink-900)] sm:text-4xl">
              {current.studyEnglish}
            </p>
            {current.audioUrl && (
              <button
                type="button"
                aria-label="発音を聞く"
                className="mx-auto mt-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--surface)] hover:bg-[var(--brand-100)] focus-visible:shadow-[var(--shadow-focus)]"
              >
                <SpeakerWaveIcon className="h-5 w-5 text-[var(--brand-700)]" />
              </button>
            )}
          </div>

          {/* ことだまトリ idle/waiting */}
          {!current.imageUrl && (
            <div className="mt-4 flex justify-center">
              <Image
                src="/character/idle.svg"
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 opacity-80"
              />
            </div>
          )}
        </motion.section>

        {/* === ChoiceGrid === */}
        <motion.div
          variants={shakeV}
          initial="hidden"
          animate={phase === "feedback" && !isCorrect ? "visible" : "hidden"}
          className="mt-6 flex flex-col gap-3"
          role="radiogroup"
          aria-label="回答の選択肢"
        >
          {current.choices.map((choice, i) => {
            const isSelected = selected === i;
            const showResult = phase !== "answering";
            const isThisCorrect = choice.isAnswer;
            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={phase !== "answering"}
                onClick={() => setSelected(i)}
                className={cn(
                  "flex min-h-[56px] items-center gap-4 rounded-2xl border-2 px-5 py-3 text-left transition-all duration-150",
                  "active:scale-[0.98] focus-visible:shadow-[var(--shadow-focus)]",
                  !showResult && !isSelected &&
                    "border-[var(--brand-300)] bg-[var(--surface)] text-[var(--ink-900)] hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)] dark:hover:bg-[var(--brand-900)]/30",
                  !showResult && isSelected &&
                    "border-[var(--brand-500)] bg-[var(--brand-100)] font-bold text-[var(--brand-900)] dark:bg-[var(--brand-800)]/40 dark:text-[var(--brand-200)]",
                  showResult && isThisCorrect &&
                    "border-[var(--success)] bg-[var(--mint-100)] text-[var(--mint-700)] dark:bg-[var(--mint-700)]/30 dark:text-[var(--mint-100)]",
                  showResult && isSelected && !isThisCorrect &&
                    "border-[var(--warning)] bg-[var(--sky-100)] text-[var(--warning-fg)] dark:bg-[var(--sky-700)]/20"
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand-200)] font-mono font-bold text-[var(--brand-900)]">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1 font-en text-lg">{choice.label}</span>
                {showResult && isThisCorrect && (
                  <CheckCircleIcon className="h-6 w-6 text-[var(--success-fg)]" />
                )}
                {showResult && isSelected && !isThisCorrect && (
                  <XCircleIcon className="h-6 w-6 text-[var(--warning-fg)]" />
                )}
              </button>
            );
          })}
        </motion.div>

        {/* === AnswerFooter === */}
        {phase === "answering" && (
          <div className="sticky bottom-0 mt-auto bg-[var(--surface)]/95 py-4 backdrop-blur">
            <button
              type="button"
              disabled={selected === null}
              onClick={submitAnswer}
              className="w-full min-h-[56px] rounded-xl bg-[var(--brand-600)] text-lg font-bold text-white shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-300)] disabled:shadow-none"
            >
              答える
            </button>
          </div>
        )}

        {/* === ARIA live region === */}
        <div
          ref={liveRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />
      </main>

      {/* === ExplanationDrawer === */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.aside
            variants={drawerV}
            initial="hidden"
            animate="visible"
            exit="hidden"
            role="dialog"
            aria-modal="false"
            aria-labelledby="explanation-title"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[var(--surface-overlay)] p-6 shadow-[var(--shadow-modal)]"
          >
            <div className="mx-auto max-w-2xl">
              <div className="mb-4 flex items-start gap-4">
                <Image
                  src={isCorrect ? "/character/cheer.svg" : "/character/gentle-correct.svg"}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0"
                />
                <div className="flex-1">
                  <h2
                    id="explanation-title"
                    className="font-heading text-lg font-bold text-[var(--ink-900)]"
                  >
                    {isCorrect ? "やったね、せいかい！" : "おしいね、いっしょにみてみよう"}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--ink-700)]">
                    正解: <span className="font-bold">{current.choices.find(c => c.isAnswer)?.label}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <details className="rounded-2xl bg-[var(--surface)] p-4" open>
                  <summary className="cursor-pointer text-sm font-bold text-[var(--brand-700)]">
                    1. 正解はなぜそうなるか
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-700)]">
                    {current.explanation.whyCorrect}
                  </p>
                </details>
                <details className="rounded-2xl bg-[var(--surface)] p-4">
                  <summary className="cursor-pointer text-sm font-bold text-[var(--brand-700)]">
                    2. なぜ間違えやすいか
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-700)]">
                    {current.explanation.whyConfusing}
                  </p>
                </details>
                <div className="rounded-2xl bg-[var(--brand-50)] p-4 dark:bg-[var(--brand-900)]/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand-700)]">
                    ことだまトリ ひとこと
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-700)]">
                    {current.explanation.kotodamaTip}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => goToNext()}
                className="mt-5 w-full min-h-[56px] rounded-xl bg-[var(--brand-600)] text-lg font-bold text-white shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)]"
              >
                次の問題へ
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 3.3 framer-motion variants（study 専用追加）

```ts
// lib/motion/variants.ts に追記
export const correctFlash: Variants = {
  hidden: { backgroundColor: "var(--surface)" },
  visible: {
    backgroundColor: ["var(--surface)", "var(--mint-100)", "var(--surface)"],
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export const wrongFlash: Variants = {
  hidden: { backgroundColor: "var(--surface)" },
  visible: {
    backgroundColor: ["var(--surface)", "var(--sky-100)", "var(--surface)"],
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export const choiceTap: Variants = {
  rest: { scale: 1 },
  pressed: { scale: 0.98, transition: { duration: 0.12 } },
};
```

### 3.4 状態遷移図（study）

```
[answering]
   │ (Choice 押下)
   ↓
[selected]   ←─── 1-4 キーボード入力でも遷移
   │ (「答える」押下 or Enter)
   ↓
[feedback] (600ms)
   │
   ├─ isCorrect=true  → correctFlash + correctPop + ARIA live「やったね、せいかい！」
   └─ isCorrect=false → wrongFlash + wrongShake + ARIA live「おしいね、いっしょにみてみよう」
   │
   ↓ (600ms 後 自動)
[explanation drawer open]
   │ (「次の問題へ」押下)
   ↓
[next question] currentIndex++ → 戻って [answering]
   │
   └─ session.questions.length に到達した場合
      ↓
[set complete summary]
   ├─ 正答率 ◯/10
   ├─ 獲得 XP +N
   ├─ SRS 次回出現日
   └─ バッジ獲得有無
```

### 3.5 セット完了サマリー JSX 抜粋

```tsx
function SetCompleteSummary({ result }: { result: StudyResult }) {
  return (
    <section className="mx-auto max-w-md rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
      <div className="text-center">
        <Image src="/character/proud.svg" alt="" width={120} height={120} className="mx-auto" />
        <h2 className="mt-4 font-heading text-2xl font-bold text-[var(--ink-900)]">
          セット完了です
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-500)]">
          きょうもよくがんばりましたね。
        </p>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[var(--mint-100)] p-4">
          <dt className="text-xs font-medium text-[var(--mint-700)]">正答率</dt>
          <dd className="mt-1 font-mono text-3xl font-bold text-[var(--mint-700)]">
            {result.correctCount}/{result.totalCount}
          </dd>
        </div>
        <div className="rounded-2xl bg-[var(--brand-50)] p-4">
          <dt className="text-xs font-medium text-[var(--brand-700)]">獲得 XP</dt>
          <dd className="mt-1 font-mono text-3xl font-bold text-[var(--brand-700)]">
            +{result.earnedXP}
          </dd>
        </div>
      </dl>
      <p className="mt-4 rounded-xl bg-[var(--surface-muted)] p-3 text-center text-xs text-[var(--ink-700)]">
        次の復習: {result.nextReviewDate}
      </p>
      {result.newBadge && (
        <div className="mt-3 rounded-xl border-2 border-[var(--brand-300)] bg-[var(--surface-overlay)] p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand-700)]">
            新しいバッジ
          </p>
          <p className="mt-1 text-sm font-bold">{result.newBadge.name}</p>
        </div>
      )}
    </section>
  );
}
```

### 3.6 キーボード操作対応（study）

| キー | 動作 |
|---|---|
| `1` `2` `3` `4` | 選択肢 A/B/C/D を選ぶ |
| `Enter` | 「答える」 / 解説後「次の問題へ」 |
| `Esc` | 中断ダイアログ |
| `Tab` | 選択肢 → 答えるボタン → 解説 details へ |
| `Shift+Tab` | 逆方向 |

### 3.7 a11y 注釈（study）

- ChoiceGrid: `role="radiogroup"` + 各ボタン `role="radio" aria-checked`
- 結果は `<div role="status" aria-live="polite">` で読み上げ
- ProgressBar: `role="progressbar"` + `aria-valuenow/max/label`
- 解説 drawer: `role="dialog" aria-modal="false"`（ページ全体ロックしない）+ `aria-labelledby`
- フォーカス管理: drawer 開時に最初の summary に `autoFocus`、閉時に発火元 button に戻す
- 学習文 `<ruby>` は **使わない**（28-32px 英文に ふりがな は視覚過密）

---

## § 4. diagnosis 画面 v2（`/onboarding/diagnosis`）

### 4.1 画面構成

```
Screen: diagnosis
├─ Phase 1: イントロ
│  ├─ ことだまトリ "support" (128×128)
│  ├─ H1: 「いまのレベルをはかろう」
│  ├─ Subtitle: 「だいたい 10 ぷんで終わります」
│  └─ CTA: 「はじめる」min-h-[56px]
│
├─ Phase 2: 適応出題ループ
│  ├─ TopBar (study と同形): 中断 + 進捗ドット表示
│  ├─ QuestionCard: 5級 → 4級 → 3級 を adaptive に
│  └─ ChoiceGrid + 「わからない・スキップ」option
│
├─ Phase 3: 中断確認
│  └─ Dialog: 「ここまでの結果を保存しますか？」
│
└─ Phase 4: 結果
   ├─ 推奨スタート級（5/4/3 級）
   ├─ 学習プラン雛形（45 分配分）
   └─ 受験日入力 CTA
```

### 4.2 完全 JSX サンプル

```tsx
// app/(onboarding)/diagnosis/page.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayIcon,
  XMarkIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { cardEnter, slideUp } from "@/lib/motion/variants";
import { useMotionVariant } from "@/lib/motion/safe";

type Phase = "intro" | "running" | "pausing" | "result";

export default function DiagnosisPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [theta, setTheta] = useState(0);    // IRT theta 推定値
  const [questionIndex, setQuestionIndex] = useState(0);
  const [resumeKey, setResumeKey] = useState<string | null>(null);
  const cardV = useMotionVariant(cardEnter);

  // 中断時保存（localStorage + supabase）
  const persistState = async () => {
    const state = { theta, questionIndex, timestamp: Date.now() };
    localStorage.setItem("hanei-diagnosis-state", JSON.stringify(state));
    await fetch("/api/diagnosis/save", { method: "POST", body: JSON.stringify(state) });
  };

  if (phase === "intro") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-8">
        <motion.div variants={cardV} initial="hidden" animate="visible" className="text-center">
          <Image
            src="/character/support.svg"
            alt=""
            width={128}
            height={128}
            className="mx-auto h-32 w-32"
          />
          <h1 className="mt-6 font-heading text-3xl font-bold text-[var(--ink-900)]">
            いまのレベルをはかろう
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[var(--ink-700)]">
            だいたい 10 ぷんで終わります。<br />
            むずかしい問題が出ても、わからなければスキップして大丈夫です。
          </p>
          <div className="mt-6 rounded-2xl bg-[var(--brand-50)] p-4 dark:bg-[var(--brand-900)]/30">
            <p className="text-sm leading-relaxed text-[var(--ink-700)]">
              ことだまトリ:「気楽にやろうね。途中でやめても、ここまでの結果はちゃんと残るよ。」
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPhase("running")}
            className="mt-6 inline-flex w-full min-h-[56px] items-center justify-center gap-2 rounded-xl bg-[var(--brand-600)] text-lg font-bold text-white shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)]"
          >
            <PlayIcon className="h-5 w-5" />
            はじめる
          </button>
          {resumeKey && (
            <button
              type="button"
              onClick={() => resumeFromSaved(resumeKey)}
              className="mt-3 min-h-[48px] w-full text-sm font-medium text-[var(--brand-700)] hover:underline focus-visible:shadow-[var(--shadow-focus)] focus-visible:rounded"
            >
              前回の続きから再開する
            </button>
          )}
        </motion.div>
      </main>
    );
  }

  if (phase === "running") {
    return (
      <DiagnosisRunningView
        theta={theta}
        questionIndex={questionIndex}
        onAnswer={(correct, irtParams) => {
          // theta 更新（adaptive）
          const newTheta = updateTheta(theta, correct, irtParams);
          setTheta(newTheta);
          setQuestionIndex(questionIndex + 1);
          persistState();

          // 終了判定: 標準誤差 < 0.4 or 最大 20 問
          if (questionIndex >= 19 || stdErrorOf(newTheta) < 0.4) {
            setPhase("result");
          }
        }}
        onPause={() => setPhase("pausing")}
      />
    );
  }

  if (phase === "pausing") {
    return (
      <DiagnosisPauseDialog
        onResume={() => setPhase("running")}
        onSaveAndExit={async () => {
          await persistState();
          window.location.href = "/home";
        }}
      />
    );
  }

  // phase === "result"
  return <DiagnosisResultView theta={theta} />;
}

function DiagnosisRunningView({ theta, questionIndex, onAnswer, onPause }: DiagnosisRunningProps) {
  const totalEstimate = 10;
  const dots = Array.from({ length: totalEstimate });

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-label="中断する"
          onClick={onPause}
          className="grid h-12 w-12 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
        >
          <XMarkIcon className="h-6 w-6 text-[var(--ink-700)]" />
        </button>
        <div
          className="flex flex-1 justify-center gap-1.5"
          role="progressbar"
          aria-valuenow={questionIndex + 1}
          aria-valuemax={totalEstimate}
          aria-label={`診断テスト ${questionIndex + 1}問目（推定 ${totalEstimate}問中）`}
        >
          {dots.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors",
                i < questionIndex
                  ? "bg-[var(--brand-500)]"
                  : i === questionIndex
                  ? "bg-[var(--brand-300)] ring-2 ring-[var(--brand-500)] ring-offset-2 ring-offset-[var(--bg)]"
                  : "bg-[var(--surface-muted)]"
              )}
            />
          ))}
        </div>
        <span className="font-mono text-xs text-[var(--ink-500)]">
          {questionIndex + 1}
        </span>
      </header>

      {/* QuestionCard は study と同構造 */}
      {/* ChoiceGrid + SkipButton */}
      <div className="mt-4 px-4">
        <button
          type="button"
          onClick={() => onAnswer(false, currentIRT)}
          className="min-h-[48px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--ink-500)] hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
        >
          わからない・スキップ
        </button>
      </div>
    </div>
  );
}

function DiagnosisPauseDialog({ onResume, onSaveAndExit }: PauseProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--ink-900)]/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        className="w-full max-w-sm rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--shadow-modal)]"
      >
        <h2 id="pause-title" className="font-heading text-xl font-bold text-[var(--ink-900)]">
          ここまでの結果を保存しますか？
        </h2>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          つづきからまた始められます。
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={onResume}
            className="min-h-[56px] w-full rounded-xl bg-[var(--brand-600)] text-base font-bold text-white shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)]"
          >
            つづける
          </button>
          <button
            type="button"
            onClick={onSaveAndExit}
            className="min-h-[48px] w-full rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--surface-muted)]"
          >
            保存して終わる
          </button>
        </div>
      </div>
    </div>
  );
}

function DiagnosisResultView({ theta }: { theta: number }) {
  const recommendedLevel = recommendLevel(theta);

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Image
        src="/character/celebrating.svg"
        alt=""
        width={120}
        height={120}
        className="mx-auto h-30 w-30"
      />
      <h1 className="mt-4 text-center font-heading text-2xl font-bold text-[var(--ink-900)]">
        診断おわりました
      </h1>

      <section className="mt-6 rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-medium text-[var(--ink-500)]">おすすめのスタート級</p>
        <p className="mt-1 font-heading text-4xl font-bold text-[var(--brand-700)]">
          英検 {recommendedLevel} 級
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-700)]">
          ことだまトリ:「{recommendedLevelMessage(recommendedLevel)}」
        </p>
      </section>

      <section className="mt-4 rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-heading text-lg font-bold text-[var(--ink-900)]">
          学習プラン雛形（1日 45 分）
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--ink-700)]">
          <li className="flex justify-between">
            <span>語彙</span><span className="font-mono">15 分</span>
          </li>
          <li className="flex justify-between">
            <span>文法</span><span className="font-mono">10 分</span>
          </li>
          <li className="flex justify-between">
            <span>リスニング</span><span className="font-mono">10 分</span>
          </li>
          <li className="flex justify-between">
            <span>ライティング</span><span className="font-mono">10 分</span>
          </li>
        </ul>
      </section>

      <Link
        href="/onboarding/exam-date"
        className="mt-6 inline-flex w-full min-h-[56px] items-center justify-center gap-2 rounded-xl bg-[var(--brand-600)] text-lg font-bold text-white shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)]"
      >
        <CalendarDaysIcon className="h-5 w-5" />
        受験日をきめる
        <ChevronRightIcon className="h-5 w-5" />
      </Link>
    </main>
  );
}
```

### 4.3 adaptive flow chart（diagnosis）

```
[intro 表示]
    │ (はじめる 押下)
    ↓
[questionIndex=0, theta=0]
    │
    ↓
[出題: theta に最も近い IRT b パラメータの問題を選択]
    │
    ├─ 5級 範囲: theta ∈ [-2.0, -0.5]
    ├─ 4級 範囲: theta ∈ [-0.5,  1.0]
    └─ 3級 範囲: theta ∈ [ 1.0,  2.5]
    │
    ↓
[ユーザー回答 / スキップ]
    │
    ↓
[theta 更新（MLE / EAP）]
    │   newTheta = update(theta, correct, IRT.a, IRT.b, IRT.c)
    │
    ↓
[終了判定]
    │
    ├─ 標準誤差(theta) < 0.4 → [result] へ
    ├─ questionIndex >= 20    → [result] へ
    └─ それ以外               → 次問へ（戻る）
    │
    ↓
[result]
    │
    ├─ recommendedLevel = recommendLevel(theta)
    │     theta < -0.5 → 5級
    │     -0.5≤theta<1.0 → 4級
    │     theta ≥ 1.0   → 3級
    │
    └─ 学習プラン雛形 + 受験日 CTA 表示

[中断時] (Pause Dialog)
    │
    ├─ 「つづける」 → [running] 戻る
    └─ 「保存して終わる」
       ├─ localStorage["hanei-diagnosis-state"] = {theta, questionIndex, ts}
       ├─ POST /api/diagnosis/save → Supabase に永続化
       └─ /home へリダイレクト

[再開時]
    │
    ├─ localStorage 確認 → あれば「前回の続きから再開する」CTA 表示
    └─ Supabase から最新 state pull（端末越え再開）
```

### 4.4 中断時の保存戦略

| 保存先 | 内容 | 用途 |
|---|---|---|
| `localStorage["hanei-diagnosis-state"]` | `{theta, questionIndex, timestamp}` | 同一端末の即時再開 |
| Supabase `diagnosis_sessions` | 同上 + user_id | 端末越え再開 / 進捗永続化 |
| 自動保存タイミング | 1 問回答ごと | 中断ボタンを押さなくても安全 |
| 古い state の扱い | timestamp が 7 日以上前は破棄 | データ陳腐化防止 |

### 4.5 a11y 注釈（diagnosis）

- 進捗ドット: `role="progressbar"` + 全ドットに `aria-hidden="true"`、ラッパに `aria-valuenow/max/label`
- スキップボタン: Tab 順最後（誤操作回避）、`aria-label="この問題をスキップする"`
- Pause Dialog: `role="dialog" aria-modal="true"` + フォーカストラップ + Esc で閉じる
- 結果画面: `<h1>` で「診断おわりました」、推奨級は `<strong>` で強調 + SR で読み上げ確認

---

## § 5. ことだまトリ 状態マッピング表（10 状態）

> design-w1-character.md の 7 表情 × 6 ポーズ を W2 で実装利用する**抽象状態 10 種**にマッピング。各状態は SVG アセット名・想定セリフカテゴリ・利用画面を一覧化。

| 状態 | アセット | w1 表情/ポーズ | 想定セリフ | 利用画面 |
|---|---|---|---|---|
| `waiting` | `/character/idle.svg` | idle / standing | （無言・小さくまばたき） | study 出題中（図像なし時）/ home 待機 |
| `cheering` | `/character/cheer.svg` | cheer / flying | 「やったね、せいかい！」 / correct.ts | study 正解時 / home Hero |
| `thinking` | `/character/thinking.svg` | thinking / sitting-on-card | 「うーん、いっしょに考えてみよう」 | コーチ AI 応答待ち（W3）/ ヒント表示 |
| `explaining` | `/character/explaining.svg` | gentle-correct / pointing | 「ここがポイントだよ」 | study 解説 drawer / 文法解説 |
| `sad` | `/character/gentle-correct.svg` | gentle-correct / standing | 「おしいね、いっしょにみてみよう」 / wrong.ts | study 誤答時（**「悲しみ」ではなく「やさしい寄り添い」表情を使う**） |
| `proud` | `/character/proud.svg` | support / standing | 「ここまでよくがんばりました」 / streak.ts | study セット完了 / レベルアップ |
| `sleepy` | `/character/sleepy.svg` | sleepy / curled-up | 「きょうもおつかれさま」 / greeting.ts H | 夜のログアウト / 休憩促し |
| `excited` | `/character/excited.svg` | level-up / flying | 「Lv {N} になりました」 / levelup.ts | レベルアップ祝賀 |
| `curious` | `/character/curious.svg` | thinking / pointing | 「これ、知ってる？」 | diagnosis 出題前 / 新単語紹介 |
| `celebrating` | `/character/celebrating.svg` | level-up / flying + 紙吹雪 | 「90日続いた今日は、とくべつな日です」 | バッジ取得 / 受験日達成 |

### 5.1 状態切替ロジック例

```ts
// lib/character/state.ts
export type KotodamaState =
  | "waiting" | "cheering" | "thinking" | "explaining" | "sad"
  | "proud" | "sleepy" | "excited" | "curious" | "celebrating";

export const stateToAsset = (s: KotodamaState) => `/character/${s}.svg`;

export const stateForContext = (ctx: {
  screen: "home" | "study" | "diagnosis" | "coach";
  event?: "correct" | "wrong" | "complete" | "levelup" | "badge" | "intro";
  hour?: number;
}): KotodamaState => {
  if (ctx.event === "correct") return "cheering";
  if (ctx.event === "wrong") return "sad";       // 表情は gentle-correct
  if (ctx.event === "complete") return "proud";
  if (ctx.event === "levelup") return "excited";
  if (ctx.event === "badge") return "celebrating";
  if (ctx.event === "intro" && ctx.screen === "diagnosis") return "curious";
  if (ctx.hour !== undefined && ctx.hour >= 22) return "sleepy";
  return "waiting";
};
```

### 5.2 注意

- 「sad」は字面通りの「悲しみ顔」を **使わない**（design-w1-character.md §4.1 NG ワード「sad / crying / disappointed」遵守）。やさしく寄り添う `gentle-correct` 表情を割り当てる。
- 全アセットは PNG/SVG どちらでも可（W1 §9 で SVG 化方針）。`<Image>` の `alt=""` 付与（装飾扱い）が原則。

---

## § 6. マイクロコピー追加 30 例（W1 の 86 例文に追加）

> design-w1-microcopy.md §2 に追加。原則「ですます調」「絵文字 0」「子どもへ寄り添う」「比較相手は過去の自分」を継承。

### N. home ふきだし「きょうもがんばろうね」系（10 例）

1. きょうも来てくれましたね。さっそくはじめましょう。
2. ことだまトリも、きょうの学習をたのしみに待っていました。
3. きょうのミッションは 45 分です。むりせず、すきな順番で進めましょう。
4. きのう覚えた言葉、もういちど顔をだしますね。たぶん、おぼえています。
5. すこしずつでいいです。きょうの 5 分が、半年後の力になります。
6. むずかしい日もあります。そんな日は、語彙だけでもだいじょうぶです。
7. 連続記録は気にしすぎなくていいです。続けたい日に、続ければいいんです。
8. きょうは何からはじめますか。気分でえらんでみましょう。
9. ここまで歩いてきた距離、ことだまトリは見ていました。
10. きょうもとなりにいます。なにかあったら、コーチにきいてくださいね。

### O. study 解説「ことだまトリ ひとこと」系（10 例）

1. この言葉、形ににたものが多いから、ペアで覚えると忘れにくいですよ。
2. 「s」が入る入らないで意味がかわります。ここがポイントです。
3. この文の動きの形、よく出てきます。3 級でもう一度会いますよ。
4. 似た意味の言葉、これで 3 つ目ですね。きょうで仲間入りです。
5. 今のあなたなら、もう一度出てきても答えられそうな顔をしていますよ。
6. ここはまよう人が多い場所です。気づけたあなたは、もう一歩先にいます。
7. このパターン、リスニングでも出てきます。耳でも覚えておきましょう。
8. 短い文ですが、3 つの大事な要素が入っています。順番を見てみてください。
9. これを覚えると、似た言葉が一気に分かりやすくなりますよ。
10. むずかしい問題でしたね。ここまで来たあなたなら、次は分かります。

### P. diagnosis ガイド「気楽にやろう」系（10 例）

1. これは点数をつけるテストではありません。今のあなたを知るためのものです。
2. わからない問題はスキップしてだいじょうぶです。むしろ、それも大事な情報です。
3. むずかしい問題が出てきたら、感覚で答えてみてもいいです。
4. 全問正解を目指す必要はありません。今のレベルがちょうど分かるくらいがいいんです。
5. 途中で疲れたら、いつでも保存して終われます。続きはまた今度で大丈夫です。
6. 速く答える必要はありません。ゆっくり読んでみてください。
7. ここまで答えてくれて、ありがとうございます。あと少しで終わりです。
8. これくらいで分かったので、ここで終わりにしましょう。
9. ことだまトリは、あなたのレベルを見ながら、ちょうどいい問題を出しています。
10. 終わったあと、おすすめのスタート級と、勉強の組み立てを伝えますね。

---

## § 7. アクセシビリティチェック（W2 共通）

### 7.1 コントラスト比（実測値・design-w1-tokens.md §1.1〜1.4 と整合）

| 用途 | 文字色 | 背景 | コントラスト | 判定 |
|---|---|---|---|---|
| 本文（Light） | `--ink-900` `#1F1B16` | `--surface` `#FFF` | 14.9:1 | AAA |
| 本文（Light） | `--ink-700` `#3A3530` | `--bg` `#FAF6EE` | 10.2:1 | AAA |
| 補助テキスト | `--ink-500` `#5A5247` | `--surface` `#FFF` | 6.0:1 | AA |
| Primary CTA 文字 | `#FFFFFF` | `--brand-600` `#D78A1A` | 4.7:1 | AA |
| 正解バッジ文字 | `--mint-700` `#1F7A60` | `--mint-100` `#D6F7EC` | 7.0:1 | AAA |
| 誤答 / 注意文字 | `--warning-fg` `#B45309` | `--sky-100` `#D6EFFD` | 5.5:1 | AA |
| 進捗ゲージ track | `--brand-500` `#F2A93A` | `--surface-muted` `#F2EDE0` | 1.8:1 | 装飾のみ可（テキスト不可） |
| Dark 本文 | `--ink-900` `#F4EFE3` | `--surface` `#1C1F26` | 13.1:1 | AAA |

### 7.2 フォーカスリング

- グローバル `:focus-visible` で `box-shadow: var(--shadow-focus)`（Amber Gold 3px、コントラスト 3.8:1）
- 全 interactive 要素（`button` / `a` / `input` / `radio` 等）でリング視認可能
- リング色は背景に対して常に 3:1 以上（Light/Dark 両対応）

### 7.3 スクリーンリーダー

| 要素 | 配慮 |
|---|---|
| ことだまトリ画像 | `alt=""`（装飾扱い）。セリフは `<p>` で別個に読み上げ |
| 進捗バー | `role="progressbar"` + `aria-valuenow/max/label` |
| 4 択 | `role="radiogroup"` + 各ボタン `role="radio" aria-checked` |
| 結果通知 | `<div role="status" aria-live="polite">` で動的読み上げ |
| 数字 | `<span className="font-mono">` + `<time dateTime>` で機械可読化 |
| 中断ダイアログ | `role="dialog" aria-modal="true"` + フォーカストラップ |
| アイコンボタン | `aria-label` で動詞付与（「設定をひらく」等） |

### 7.4 動きを減らす（`prefers-reduced-motion`）

- `globals.css` グローバル `@media (prefers-reduced-motion: reduce)` で `animation/transition-duration: 0.01ms !important`
- `lib/motion/safe.ts` の `useMotionVariant()` で variants を fade のみに縮退（W1 §4.4 で実装済）
- 個別: 進捗バーの幅トランジションも `useReducedMotion()` で 0.01ms 化
- Bottom Sheet drawer の slide-up は fade-only に縮退
- 紙吹雪・celebration アニメは表示なし（`AnimatePresence` で skip）

### 7.5 行間・字間

- 本文: `line-height: 1.7` / `letter-spacing: 0.01em`
- 学習文: `line-height: 1.7-1.8` / `letter-spacing: 0`
- 1.6 以上を全本文で達成（design-w1-tokens.md §2.2）

### 7.6 ふりがな

- 全文に ruby は付けない（視覚過密）
- 受験関連用語など必要箇所のみ `<ruby>英検<rt>えいけん</rt></ruby>`
- ふりがな is-on toggle は **Phase 2** 検討（W1 ではデフォルト OFF + 必要箇所だけ常時表示）

---

## § 8. Dev 申し送り

### 8.1 Tailwind 追加 utility（globals.css に追記候補）

```css
@layer utilities {
  /* タップ領域強制 */
  .tap-min { min-height: 48px; min-width: 48px; }
  .tap-cta { min-height: 56px; min-width: 56px; }

  /* SR-only 確実適用 */
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0;
    margin: -1px; overflow: hidden; clip: rect(0,0,0,0);
    white-space: nowrap; border: 0;
  }

  /* 学習文ベース */
  .study-en-lg {
    font-family: var(--font-en);
    font-weight: 700;
    font-size: 1.875rem; /* 30px */
    line-height: 1.7;
  }
}
```

### 8.2 shadcn/ui 追加コンポーネント要否

| Component | W1 | W2 追加 | 用途 |
|---|---|---|---|
| `button` | 済 | — | — |
| `card` | 済 | — | — |
| `input` | 済 | — | — |
| `label` | 済 | — | — |
| `progress` | — | **追加** | XP/Level ゲージ・study 進捗バー（独自実装でも可だが shadcn 流儀統一推奨） |
| `sheet` | — | **追加** | study 解説 drawer（slide-up Bottom Sheet） |
| `dialog` | — | **追加** | diagnosis 中断確認ダイアログ |
| `tabs` | — | **追加（任意）** | 保護者ビュー / 進捗の期間切替（home から派生する場面で利用） |

```bash
pnpm dlx shadcn@latest add progress sheet dialog tabs
```

### 8.3 framer-motion 採用可否

- **採用**（既に W1 で variants プリセット完備済 / `lib/motion/variants.ts`）
- W2 で追加する variants: `correctFlash` `wrongFlash` `choiceTap`（本ガイド §3.3）
- `useReducedMotion()` 連携の `useMotionVariant()` ラッパを **必ず使用**

### 8.4 アセット要件（W2 中に揃える）

| アセット | パス | サイズ |
|---|---|---|
| logo.svg | `/public/logo.svg` | 88×32 / 176×64@2x |
| character/idle.svg | 同上 | 64,80,128,160 |
| character/cheer.svg | 同上 | 80,128,160 |
| character/support.svg | 同上 | 80,128 |
| character/gentle-correct.svg | 同上 | 64,80 |
| character/proud.svg | 同上 | 80,120 |
| character/curious.svg | 同上 | 80,120 |
| character/celebrating.svg | 同上 | 120 |
| character/sleepy.svg | 同上 | 64,80 |
| character/thinking.svg | 同上 | 64,80 |
| character/excited.svg | 同上 | 80,120 |
| character/explaining.svg | 同上 | 64,80 |

> design-w1-character.md §3 のプロンプトで gpt-image-2 生成 → SVG 化 → `public/character/` 配置。

### 8.5 マイクロコピー連携

- W1 の 86 例文 + W2 追加 30 例 = **116 例文** を `app/lib/copy/` に配置
  - 追加: `home-bubble.ts`（N カテゴリ 10 例）/ `study-tip.ts`（O カテゴリ 10 例）/ `diagnosis-guide.ts`（P カテゴリ 10 例）
- `selectMessage("home-bubble", seed=todayDate)` で 1 日 1 回安定選択

### 8.6 受入基準（W2 画面ゲート）

- [ ] home / study / diagnosis 3 画面が本ガイドの構造で実装され、モバイル/PC で崩れなし
- [ ] 全 interactive 要素が tap-min(48px) または tap-cta(56px) を満たす
- [ ] `axe-core` で各画面 fail 0
- [ ] Lighthouse Accessibility ≥ 95（W7 で 100 達成）
- [ ] ダークモード切替で全画面崩れなし
- [ ] `prefers-reduced-motion` 時に correctFlash/wrongFlash/wrongShake/correctPop/slideUp が fade のみへ縮退
- [ ] キーボード操作: study で 1-4/Enter/Esc 動作確認、Tab 順正常
- [ ] diagnosis 中断 → localStorage 保存 → 再開フローが端末越えでも動作（Supabase 連携）
- [ ] ことだまトリ 10 状態すべての SVG が `public/character/` に存在
- [ ] マイクロコピー 116 例文すべて i18n キー化（絵文字混入 0 を `grep` で検証）

---

## § 9. 次アクション

1. Dev: 本ガイド §2-§4 の JSX をベースに `app/(app)/home/page.tsx` `app/(app)/study/[levelCode]/[skillCode]/page.tsx` `app/(onboarding)/diagnosis/page.tsx` を実装
2. Dev: `pnpm dlx shadcn@latest add progress sheet dialog tabs`
3. Dev: `lib/motion/variants.ts` に `correctFlash` `wrongFlash` `choiceTap` を追記
4. Dev: `lib/character/state.ts` を新規作成、ことだまトリ状態切替ロジック実装
5. Dev: `app/lib/copy/home-bubble.ts` `study-tip.ts` `diagnosis-guide.ts` 新規作成
6. Designer: ことだまトリ 10 状態の SVG を W2 中に納品（design-w1-character.md §3 プロンプトで生成）
7. Review: W2 完了時に axe-core / Lighthouse / キーボード操作 / SR の 4 観点でゲート判定
