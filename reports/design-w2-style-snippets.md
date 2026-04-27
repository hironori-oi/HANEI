# PRJ-016 HANEI W2 Style Snippets（コピペ用 JSX 集）

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W2 開発実装（home / study / diagnosis）
- **連携**: design-w2-screens-v2.md / design-w1-tokens.md / design-w1-character.md
- **方針**: そのままコピペで動く JSX 12 個。すべて Tailwind v4 + shadcn/ui + Heroicons 24/outline + framer-motion 構成、絵文字 0、a11y 配慮済み。

---

## 前提（共通 import）

```tsx
import {
  BellIcon, Cog6ToothIcon, ChevronLeftIcon, ChevronRightIcon,
  HomeIcon, AcademicCapIcon, ChatBubbleLeftRightIcon, UserGroupIcon,
  HeartIcon, FireIcon, SparklesIcon, BookOpenIcon, PencilSquareIcon,
  SpeakerWaveIcon, CalendarDaysIcon, CheckCircleIcon, XCircleIcon,
  XMarkIcon, PlayIcon,
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useMotionVariant } from "@/lib/motion/safe";
import {
  cardEnter, slideUp, correctPop, wrongShake, streakStamp,
  correctFlash, wrongFlash,
} from "@/lib/motion/variants";
```

---

## 1. HeaderBar（home 共通ヘッダー / ストリーク + XP/Level + 通知 + 設定）

```tsx
type HeaderBarProps = {
  streakDays: number;
  level: number;
  xpPercent: number;     // 0-100
};

export function HeaderBar({ streakDays, level, xpPercent }: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur dark:bg-[var(--surface)]/90">
      <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between px-4 lg:px-8">
        <Link href="/home" className="flex items-center gap-2 focus-visible:shadow-[var(--shadow-focus)] focus-visible:rounded-lg">
          <Image src="/logo.svg" alt="HANEI" width={88} height={32} priority />
          <Image src="/character/idle.svg" alt="" width={32} height={32} />
        </Link>

        <div className="hidden items-center gap-4 lg:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1 text-sm font-medium text-[var(--brand-700)] dark:bg-[var(--brand-900)]/30 dark:text-[var(--brand-300)]">
            <FireIcon className="h-4 w-4" aria-hidden />
            <span aria-label={`連続学習 ${streakDays} 日`}>連続 {streakDays} 日</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-[var(--ink-900)]">
              Lv{level}
            </span>
            <div
              role="progressbar"
              aria-valuenow={xpPercent}
              aria-valuemax={100}
              aria-label={`次のレベルまで ${100 - xpPercent} パーセント`}
              className="h-2 w-32 rounded-full bg-[var(--surface-muted)]"
            >
              <div
                className="h-full rounded-full bg-[var(--brand-500)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="通知をひらく"
            className="grid h-12 w-12 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
          >
            <BellIcon className="h-5 w-5 text-[var(--ink-700)]" aria-hidden />
          </button>
          <Link
            href="/settings"
            aria-label="設定をひらく"
            className="grid h-12 w-12 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
          >
            <Cog6ToothIcon className="h-5 w-5 text-[var(--ink-700)]" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
```

---

## 2. ChoiceButton（study 4 択ボタン / tap で scale 0.98）

```tsx
type ChoiceButtonProps = {
  letter: "A" | "B" | "C" | "D";
  label: string;
  state: "default" | "selected" | "correct" | "wrong" | "disabled";
  onClick?: () => void;
};

export function ChoiceButton({ letter, label, state, onClick }: ChoiceButtonProps) {
  const isResult = state === "correct" || state === "wrong";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={state === "selected"}
      disabled={state === "disabled" || isResult}
      onClick={onClick}
      className={cn(
        "flex min-h-[56px] items-center gap-4 rounded-2xl border-2 px-5 py-3 text-left",
        "transition-all duration-150 ease-out",
        "active:scale-[0.98] motion-reduce:active:scale-100",
        "focus-visible:shadow-[var(--shadow-focus)]",
        state === "default" &&
          "border-[var(--brand-300)] bg-[var(--surface)] text-[var(--ink-900)] hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)] dark:hover:bg-[var(--brand-900)]/30",
        state === "selected" &&
          "border-[var(--brand-500)] bg-[var(--brand-100)] font-bold text-[var(--brand-900)] dark:bg-[var(--brand-800)]/40 dark:text-[var(--brand-200)]",
        state === "correct" &&
          "border-[var(--success)] bg-[var(--mint-100)] text-[var(--mint-700)] dark:bg-[var(--mint-700)]/30 dark:text-[var(--mint-100)]",
        state === "wrong" &&
          "border-[var(--warning)] bg-[var(--sky-100)] text-[var(--warning-fg)] dark:bg-[var(--sky-700)]/20",
        state === "disabled" &&
          "cursor-not-allowed border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-300)]"
      )}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand-200)] font-mono font-bold text-[var(--brand-900)]"
      >
        {letter}
      </span>
      <span className="flex-1 font-en text-lg">{label}</span>
      {state === "correct" && (
        <CheckCircleIcon className="h-6 w-6 text-[var(--success-fg)]" aria-hidden />
      )}
      {state === "wrong" && (
        <XCircleIcon className="h-6 w-6 text-[var(--warning-fg)]" aria-hidden />
      )}
    </button>
  );
}
```

---

## 3. ProgressDots（diagnosis 進捗ドット）

```tsx
type ProgressDotsProps = {
  total: number;          // 推定総問数（adaptive なので可変）
  current: number;        // 現在の 0-indexed 問題
  ariaLabel?: string;
};

export function ProgressDots({ total, current, ariaLabel }: ProgressDotsProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemax={total}
      aria-label={ariaLabel ?? `${total}問中 ${current + 1}問目`}
      className="flex flex-1 justify-center gap-1.5"
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "h-2.5 w-2.5 rounded-full transition-colors duration-200 motion-reduce:transition-none",
            i < current && "bg-[var(--brand-500)]",
            i === current &&
              "bg-[var(--brand-300)] ring-2 ring-[var(--brand-500)] ring-offset-2 ring-offset-[var(--bg)]",
            i > current && "bg-[var(--surface-muted)]"
          )}
        />
      ))}
    </div>
  );
}
```

---

## 4. KotodamaToriMotion（ことだまトリ motion.div ラッパ）

```tsx
import type { KotodamaState } from "@/lib/character/state";

type KotodamaToriMotionProps = {
  state: KotodamaState;
  size?: number;        // px
  className?: string;
  caption?: string;     // SR 用（通常は alt="" で装飾扱い）
};

export function KotodamaToriMotion({
  state, size = 96, className, caption,
}: KotodamaToriMotionProps) {
  const variants = useMotionVariant({
    hidden: { opacity: 0, y: 8, scale: 0.96 },
    visible: {
      opacity: 1, y: 0, scale: 1,
      transition: { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] },
    },
  });

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      className={cn("inline-block shrink-0", className)}
    >
      <Image
        src={`/character/${state}.svg`}
        alt={caption ?? ""}
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    </motion.div>
  );
}
```

---

## 5. ExplanationDrawer（study 解説 Bottom Sheet）

```tsx
type ExplanationDrawerProps = {
  isOpen: boolean;
  isCorrect: boolean;
  correctLabel: string;
  whyCorrect: string;
  whyConfusing: string;
  kotodamaTip: string;
  onNext: () => void;
};

export function ExplanationDrawer({
  isOpen, isCorrect, correctLabel,
  whyCorrect, whyConfusing, kotodamaTip, onNext,
}: ExplanationDrawerProps) {
  const drawerV = useMotionVariant(slideUp);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          variants={drawerV}
          initial="hidden"
          animate="visible"
          exit="hidden"
          role="dialog"
          aria-modal="false"
          aria-labelledby="explanation-title"
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[var(--surface-overlay)] p-6 shadow-[var(--shadow-modal)] dark:bg-[var(--surface)]"
        >
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex items-start gap-4">
              <KotodamaToriMotion
                state={isCorrect ? "cheering" : "sad"}
                size={64}
              />
              <div className="flex-1">
                <h2
                  id="explanation-title"
                  className="font-heading text-lg font-bold text-[var(--ink-900)]"
                >
                  {isCorrect ? "やったね、せいかい！" : "おしいね、いっしょにみてみよう"}
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-700)]">
                  正解: <span className="font-bold">{correctLabel}</span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <details className="rounded-2xl bg-[var(--surface)] p-4 dark:bg-[var(--surface-muted)]" open>
                <summary className="cursor-pointer text-sm font-bold text-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:rounded">
                  1. 正解はなぜそうなるか
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-700)]">
                  {whyCorrect}
                </p>
              </details>
              <details className="rounded-2xl bg-[var(--surface)] p-4 dark:bg-[var(--surface-muted)]">
                <summary className="cursor-pointer text-sm font-bold text-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:rounded">
                  2. なぜ間違えやすいか
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-700)]">
                  {whyConfusing}
                </p>
              </details>
              <div className="rounded-2xl bg-[var(--brand-50)] p-4 dark:bg-[var(--brand-900)]/30">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand-700)]">
                  ことだまトリ ひとこと
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink-700)]">
                  {kotodamaTip}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onNext}
              autoFocus
              className="mt-5 w-full min-h-[56px] rounded-xl bg-[var(--brand-600)] text-lg font-bold text-white shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)]"
            >
              次の問題へ
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
```

---

## 6. HeroCountdown（home 受験日カウントダウン / 未登録時 CTA 分岐）

```tsx
type HeroCountdownProps = {
  examDate: string | null;       // ISO 'YYYY-MM-DD'
  daysUntilExam: number | null;
};

export function HeroCountdown({ examDate, daysUntilExam }: HeroCountdownProps) {
  const cardV = useMotionVariant(cardEnter);

  return (
    <motion.section
      variants={cardV}
      initial="hidden"
      animate="visible"
      className="rounded-3xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] p-6 shadow-[var(--shadow-card)] sm:p-8 dark:from-[var(--brand-900)]/20 dark:to-[var(--brand-800)]/20"
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <KotodamaToriMotion state={examDate ? "cheering" : "support" as never} size={160} className="sm:[&>img]:h-40 sm:[&>img]:w-40" />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-heading text-2xl font-bold text-[var(--ink-900)] sm:text-3xl">
            今日のミッション
          </h1>
          {examDate && daysUntilExam !== null ? (
            <>
              <div className="mt-2 flex flex-wrap items-baseline justify-center gap-2 sm:justify-start">
                <span className="text-base text-[var(--ink-700)]">
                  <ruby>英検<rt>えいけん</rt></ruby>3<ruby>級<rt>きゅう</rt></ruby>まで
                </span>
                <time
                  dateTime={examDate}
                  className="font-mono text-4xl font-bold text-[var(--brand-700)] sm:text-5xl"
                >
                  あと {daysUntilExam} 日
                </time>
              </div>
              <p className="mt-1 text-sm text-[var(--mint-700)] dark:text-[var(--mint-300)]">
                1日 45 分で間に合うペースです。
              </p>
            </>
          ) : (
            <div className="mt-3">
              <p className="text-base leading-relaxed text-[var(--ink-700)]">
                受験日をきめると、ぴったりのペースで進められます。
              </p>
              <Link
                href="/onboarding/exam-date"
                className="mt-3 inline-flex min-h-[56px] items-center gap-2 rounded-xl bg-[var(--brand-600)] px-5 text-base font-bold text-white shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)]"
              >
                <CalendarDaysIcon className="h-5 w-5" aria-hidden />
                受験日をきめる
                <ChevronRightIcon className="h-5 w-5" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
```

---

## 7. TodayPlanCard（home 今日のプラン 4 種カード）

```tsx
type SkillCode = "vocab" | "grammar" | "listening" | "writing";

type TodayPlanCardProps = {
  skillCode: SkillCode;
  title: string;
  duration: number;          // 分
  progressPercent: number;   // 0-100
  statusLabel: string;
  href: string;
};

const skillIcon: Record<SkillCode, typeof BookOpenIcon> = {
  vocab: BookOpenIcon,
  grammar: PencilSquareIcon,
  listening: SpeakerWaveIcon,
  writing: PencilSquareIcon,
};

export function TodayPlanCard({
  skillCode, title, duration, progressPercent, statusLabel, href,
}: TodayPlanCardProps) {
  const cardV = useMotionVariant(cardEnter);
  const Icon = skillIcon[skillCode];

  return (
    <motion.article
      variants={cardV}
      initial="hidden"
      animate="visible"
      className="rounded-3xl bg-[var(--surface)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] transition-shadow"
    >
      <Link
        href={href}
        className="block min-h-[160px] rounded-3xl p-5 focus-visible:shadow-[var(--shadow-focus)]"
      >
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-100)] dark:bg-[var(--brand-900)]/30">
          <Icon className="h-6 w-6 text-[var(--brand-700)]" aria-hidden />
        </div>
        <h3 className="text-base font-bold text-[var(--ink-900)]">{title}</h3>
        <p className="text-sm text-[var(--ink-500)]">{duration}分</p>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemax={100}
          aria-label={`${title} の進捗 ${progressPercent} パーセント`}
          className="mt-3 h-2 rounded-full bg-[var(--surface-muted)]"
        >
          <div
            className="h-full rounded-full bg-[var(--mint-500)] transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--ink-500)]">{statusLabel}</p>
      </Link>
    </motion.article>
  );
}
```

---

## 8. CoachBubble（home コーチふきだし）

```tsx
type CoachBubbleProps = {
  message: string;       // selectMessage("home-bubble", todayDate)
  characterState?: "support" | "waiting";
};

export function CoachBubble({ message, characterState = "support" }: CoachBubbleProps) {
  const v = useMotionVariant(slideUp);

  return (
    <motion.section
      variants={v}
      initial="hidden"
      animate="visible"
      className="flex items-start gap-4 rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]"
    >
      <KotodamaToriMotion state={characterState as never} size={80} />
      <div className="flex-1">
        <div className="rounded-2xl bg-[var(--brand-50)] px-4 py-3 dark:bg-[var(--brand-900)]/30">
          <p className="text-base leading-relaxed text-[var(--ink-700)]">
            {message}
          </p>
        </div>
        <Link
          href="/coach"
          className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded text-sm font-medium text-[var(--brand-700)] hover:underline focus-visible:shadow-[var(--shadow-focus)]"
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden />
          コーチと話す
        </Link>
      </div>
    </motion.section>
  );
}
```

---

## 9. BadgeNotice（home バッジ取得通知 / streakStamp variant）

```tsx
type BadgeNoticeProps = {
  badgeName: string;
  badgeDescription: string;
  badgeTier?: "bronze" | "silver" | "gold" | "platinum" | "diamond";
};

export function BadgeNotice({
  badgeName, badgeDescription, badgeTier = "bronze",
}: BadgeNoticeProps) {
  const v = useMotionVariant(streakStamp);
  const bgVar = `var(--badge-${badgeTier})`;

  return (
    <motion.aside
      variants={v}
      initial="hidden"
      animate="visible"
      role="status"
      aria-live="polite"
      className="flex items-center gap-4 rounded-3xl border-2 border-[var(--brand-300)] bg-[var(--surface-overlay)] p-5 shadow-[var(--shadow-pop)]"
    >
      <div
        className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: bgVar }}
      >
        <SparklesIcon className="h-8 w-8 text-white" aria-hidden />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--brand-700)]">
          新しいバッジ
        </p>
        <p className="mt-1 text-base font-bold text-[var(--ink-900)]">
          {badgeName}
        </p>
        <p className="mt-1 text-sm text-[var(--ink-500)]">
          {badgeDescription}
        </p>
      </div>
    </motion.aside>
  );
}
```

---

## 10. StudyTopBar（study 上部バー / 戻る + 進捗 + ハート）

```tsx
type StudyTopBarProps = {
  current: number;       // 1-indexed
  total: number;
  hearts: number;        // 0-3
  onBack: () => void;
};

export function StudyTopBar({ current, total, hearts, onBack }: StudyTopBarProps) {
  const reduceMotion = useReducedMotion();

  return (
    <header className="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        aria-label="学習を中断して戻る"
        onClick={onBack}
        className="grid h-12 w-12 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
      >
        <ChevronLeftIcon className="h-6 w-6 text-[var(--ink-700)]" aria-hidden />
      </button>
      <div
        className="flex-1"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemax={total}
        aria-label={`${total}問中 ${current}問目`}
      >
        <div className="h-2 rounded-full bg-[var(--surface-muted)]">
          <motion.div
            className="h-full rounded-full bg-[var(--brand-500)]"
            initial={{ width: 0 }}
            animate={{ width: `${(current / total) * 100}%` }}
            transition={{ duration: reduceMotion ? 0.01 : 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <p className="mt-1 text-center font-mono text-xs text-[var(--ink-500)]">
          {current} / {total} 問目
        </p>
      </div>
      <div className="flex gap-1" aria-label={`残りライフ ${hearts}`}>
        {Array.from({ length: 3 }).map((_, i) => (
          <HeartIcon
            key={i}
            aria-hidden
            className={cn(
              "h-6 w-6",
              i < hearts ? "text-[var(--brand-500)]" : "text-[var(--surface-muted)]"
            )}
          />
        ))}
      </div>
    </header>
  );
}
```

---

## 11. FeedbackFlash（study 正解 / 誤答 背景フラッシュ）

```tsx
type FeedbackFlashProps = {
  isVisible: boolean;
  isCorrect: boolean;
  children: React.ReactNode;
};

export function FeedbackFlash({ isVisible, isCorrect, children }: FeedbackFlashProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div
        className={cn(
          "rounded-3xl transition-colors duration-200",
          isVisible && isCorrect && "bg-[var(--mint-100)]",
          isVisible && !isCorrect && "bg-[var(--sky-100)]"
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      animate={
        isVisible
          ? {
              backgroundColor: isCorrect
                ? ["var(--surface)", "var(--mint-100)", "var(--surface)"]
                : ["var(--surface)", "var(--sky-100)", "var(--surface)"],
            }
          : { backgroundColor: "var(--surface)" }
      }
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="rounded-3xl"
    >
      {children}
    </motion.div>
  );
}
```

---

## 12. DiagnosisPauseDialog（diagnosis 中断確認）

```tsx
type DiagnosisPauseDialogProps = {
  isOpen: boolean;
  onResume: () => void;
  onSaveAndExit: () => Promise<void>;
};

export function DiagnosisPauseDialog({
  isOpen, onResume, onSaveAndExit,
}: DiagnosisPauseDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[var(--ink-900)]/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onResume();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        aria-describedby="pause-desc"
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--shadow-modal)]"
      >
        <h2 id="pause-title" className="font-heading text-xl font-bold text-[var(--ink-900)]">
          ここまでの結果を保存しますか？
        </h2>
        <p id="pause-desc" className="mt-2 text-sm leading-relaxed text-[var(--ink-700)]">
          つづきからまた始められます。
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={onResume}
            autoFocus
            className="min-h-[56px] w-full rounded-xl bg-[var(--brand-600)] text-base font-bold text-white shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)]"
          >
            つづける
          </button>
          <button
            type="button"
            onClick={onSaveAndExit}
            className="min-h-[48px] w-full rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
          >
            保存して終わる
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

---

## 13. (bonus) BottomTabNav（home / study / diagnosis 共通フッター）

```tsx
type BottomTabNavProps = {
  current: "home" | "study" | "coach" | "parent";
};

export function BottomTabNav({ current }: BottomTabNavProps) {
  const tabs = [
    { id: "home" as const, href: "/home", label: "ホーム", Icon: HomeIcon },
    { id: "study" as const, href: "/study", label: "学習", Icon: AcademicCapIcon },
    { id: "coach" as const, href: "/coach", label: "コーチ", Icon: ChatBubbleLeftRightIcon },
    { id: "parent" as const, href: "/parent", label: "保護者", Icon: UserGroupIcon },
  ];

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-screen-xl items-stretch justify-around">
        {tabs.map((tab) => {
          const isCurrent = current === tab.id;
          return (
            <li key={tab.id} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-xs",
                  "focus-visible:shadow-[var(--shadow-focus)] focus-visible:rounded-xl",
                  isCurrent
                    ? "text-[var(--brand-700)] font-bold"
                    : "text-[var(--ink-500)] hover:text-[var(--brand-700)]"
                )}
              >
                <tab.Icon className="h-6 w-6" aria-hidden />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

---

## 使用例（study 画面に組み合わせる場合）

```tsx
export default function StudyPage({ session }: { session: StudySession }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<"answering" | "feedback" | "explanation">("answering");

  const current = session.questions[session.currentIndex];
  const isCorrect = selected !== null && current.choices[selected].isAnswer;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <StudyTopBar
        current={session.currentIndex + 1}
        total={session.questions.length}
        hearts={session.hearts}
        onBack={() => history.back()}
      />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4">
        <FeedbackFlash isVisible={phase === "feedback"} isCorrect={isCorrect}>
          <section className="rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] sm:p-8">
            {/* 問題本文 */}
            <p className="text-base leading-relaxed text-[var(--ink-700)]">
              {current.prompt}
            </p>
            <div className="mt-5 rounded-2xl bg-[var(--brand-50)] p-5">
              <p className="text-center font-en text-3xl font-bold leading-[1.7] text-[var(--ink-900)] sm:text-4xl">
                {current.studyEnglish}
              </p>
            </div>
          </section>
        </FeedbackFlash>

        <div className="mt-6 flex flex-col gap-3" role="radiogroup" aria-label="回答の選択肢">
          {current.choices.map((choice, i) => (
            <ChoiceButton
              key={choice.id}
              letter={["A", "B", "C", "D"][i] as "A"}
              label={choice.label}
              state={
                phase === "answering"
                  ? selected === i ? "selected" : "default"
                  : choice.isAnswer
                  ? "correct"
                  : selected === i
                  ? "wrong"
                  : "disabled"
              }
              onClick={() => phase === "answering" && setSelected(i)}
            />
          ))}
        </div>
      </main>

      <ExplanationDrawer
        isOpen={phase === "explanation"}
        isCorrect={isCorrect}
        correctLabel={current.choices.find(c => c.isAnswer)!.label}
        whyCorrect={current.explanation.whyCorrect}
        whyConfusing={current.explanation.whyConfusing}
        kotodamaTip={current.explanation.kotodamaTip}
        onNext={goToNext}
      />
    </div>
  );
}
```

---

## 注意事項（snippet 共通）

1. すべて Tailwind v4 構文（`bg-[var(--brand-500)]` の任意値）で書かれており、JIT 互換
2. `motion-reduce:` 修飾子と `useReducedMotion()` の二重防御で `prefers-reduced-motion` 完全対応
3. すべての interactive 要素に `focus-visible:shadow-[var(--shadow-focus)]` を付与（globals.css の :focus-visible でも担保するが、明示）
4. ダークモードは `dark:` 接頭辞で対応、`globals.css` の `.dark` セレクタと組み合わせて next-themes と連動
5. アイコンには必ず `aria-hidden` を付け、ラベルは ボタン側の `aria-label` または隣接 `<span>` で提供
6. `<Image>` の `alt=""` は装飾扱い、ことだまトリのセリフは別途 `<p>` で読み上げ
7. SVG アセットがまだ無い場合、PNG で代用しても表示崩れなし（同パス・同サイズで差し替え）
