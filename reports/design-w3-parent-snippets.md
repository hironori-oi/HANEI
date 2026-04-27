# PRJ-016 HANEI W3 Parent Dashboard JSX スニペット集

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W3 開発実装（保護者向け `/parent/dashboard` 画面）
- **連携**: design-w3-parent-dashboard.md（本体ガイド）/ design-w1-tokens.md / design-w2-style-snippets.md
- **方針**: そのままコピペで動く JSX スニペット 8 個。すべて Tailwind v4 + shadcn/ui + Heroicons 24/outline + framer-motion 構成、絵文字 0、課金 UI 0、敬語ベース、a11y 配慮済み。

---

## 前提（共通 import）

```tsx
import {
  BellIcon, Cog6ToothIcon, CalendarDaysIcon, ChevronRightIcon,
  HomeIcon, ChartBarIcon, ArrowRightOnRectangleIcon,
  FireIcon, CheckCircleIcon, XCircleIcon, SparklesIcon,
  PaperAirplaneIcon, ChatBubbleBottomCenterTextIcon,
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogTrigger, DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useMotionVariant } from "@/lib/motion/safe";
import { cardEnter } from "@/lib/motion/variants";
import { usePrefersReducedMotion } from "@/lib/a11y/use-prefers-reduced-motion";
```

> 上記 import は各スニペットで使用するもの全集合。実装時は必要なものだけ抜粋してください。

---

## 1. ParentHeaderBar（保護者用ヘッダー / 学習者切替 + 受験カウント + 通知 + 設定）

**何の表示か**: 保護者画面共通のスティッキーヘッダー。HANEI ロゴ + 「保護者画面」識別バッジ、学習者切替プルダウン（複数子家族対応）、今日の日付、受験日カウントダウン Pill、通知ベル、設定 Cog の 6 機能を集約。

**依存する props**:
```ts
type ParentHeaderBarProps = {
  learners: { id: string; name: string; grade: string }[];
  currentLearnerId: string;
  onLearnerChange: (id: string) => void;
  todayJpFormatted: string;   // "2026年4月26日（日）"
  daysUntilExam: number | null;  // null なら受験日未登録
};
```

```tsx
export function ParentHeaderBar({
  learners, currentLearnerId, onLearnerChange,
  todayJpFormatted, daysUntilExam,
}: ParentHeaderBarProps) {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur dark:bg-[var(--surface)]/90">
      <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between gap-2 px-4 lg:px-8">
        {/* LeftCluster */}
        <Link href="/parent/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:shadow-[var(--shadow-focus)]">
          <Image src="/logo.svg" alt="HANEI" width={88} height={32} priority />
          <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--ink-700)] sm:inline-block">
            保護者画面
          </span>
        </Link>

        {/* CenterCluster: 学習者切替 */}
        <Select value={currentLearnerId} onValueChange={onLearnerChange}>
          <SelectTrigger
            aria-label="学習者を切り替える"
            className="h-10 w-44 rounded-xl border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--ink-900)] focus-visible:shadow-[var(--shadow-focus)]">
            <SelectValue placeholder="学習者を選択" />
          </SelectTrigger>
          <SelectContent>
            {learners.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}（{l.grade}）
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* RightCluster */}
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-[var(--ink-700)] md:inline">
            {todayJpFormatted}
          </span>
          {daysUntilExam !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1 text-sm font-medium text-[var(--brand-700)] dark:bg-[var(--brand-900)]/30 dark:text-[var(--brand-300)]">
              <CalendarDaysIcon className="h-4 w-4" aria-hidden />
              受験まで {daysUntilExam} 日
            </span>
          )}
          <button type="button" aria-label="通知をひらく"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]">
            <BellIcon className="h-5 w-5 text-[var(--ink-700)]" aria-hidden />
          </button>
          <Link href="/parent/settings" aria-label="設定をひらく"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]">
            <Cog6ToothIcon className="h-5 w-5 text-[var(--ink-700)]" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
```

---

## 2. GreetingBanner（保護者向け挨拶 + ことだまトリ parent-greeting）

**何の表示か**: 保護者画面の最上部に配置する挨拶バナー。ことだまトリ parent-greeting 状態 96px + 「お疲れさまです」+ 学習者の今週の活動サマリーを敬語で表示。

**依存する props**:
```ts
type GreetingBannerProps = {
  parentName: string;
  learnerName: string;
  activeDaysThisWeek: number;  // 0-7
};
```

```tsx
export function GreetingBanner({ parentName, learnerName, activeDaysThisWeek }: GreetingBannerProps) {
  // 学習頻度の文言マッピング（保護者敬語トーン）
  const frequencyText =
    activeDaysThisWeek >= 7 ? "毎日" :
    activeDaysThisWeek >= 5 ? "ほぼ毎日" :
    activeDaysThisWeek >= 3 ? "定期的に" :
    activeDaysThisWeek >= 1 ? "マイペースに" :
    "今週はまだ";

  const cardV = useMotionVariant(cardEnter);

  return (
    <motion.section
      variants={cardV}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand-50)] to-[var(--surface)] p-5 sm:p-6 dark:from-[var(--brand-900)]/15 dark:to-[var(--surface)]"
    >
      <div className="flex items-center gap-4 sm:gap-6">
        <Image
          src="/character/parent-greeting.svg"
          alt=""
          width={96}
          height={96}
          className="h-20 w-20 shrink-0 sm:h-24 sm:w-24"
        />
        <div className="flex-1">
          <p className="text-base font-medium text-[var(--ink-900)] sm:text-lg">
            {parentName}さん、お疲れさまです。
          </p>
          <p className="mt-1 text-sm text-[var(--ink-700)] sm:text-base">
            {learnerName}さんは今週、{frequencyText}学習されています。
          </p>
        </div>
      </div>
    </motion.section>
  );
}
```

---

## 3. SummaryCard（WeeklySummary 4 枚共通カード）

**何の表示か**: 今週の学習サマリー数値カード。kind により streak / answers / accuracy / xp の 4 種類を切替。先週比 diff を ± 表示。

**依存する props**:
```ts
type SummaryCardKind = "streak" | "answers" | "accuracy" | "xp";
type SummaryCardProps = {
  kind: SummaryCardKind;
  value: number;
  diff: number;        // 先週との差分
  unit?: string;       // "日" "問" "%" "XP"
  // xp の場合のみ
  currentLevel?: number;
  nextLevelPercent?: number;
};
```

```tsx
const KIND_META: Record<SummaryCardKind, { Icon: typeof FireIcon; label: string; color: string }> = {
  streak:   { Icon: FireIcon,        label: "連続学習日数", color: "text-[var(--brand-500)]" },
  answers:  { Icon: CheckCircleIcon, label: "今週の解答数", color: "text-[var(--mint-600)]" },
  accuracy: { Icon: ChartBarIcon,    label: "今週の正答率", color: "text-[var(--sky-600)]" },
  xp:       { Icon: SparklesIcon,    label: "今週のXP増加", color: "text-[var(--brand-700)]" },
};

export function SummaryCard({
  kind, value, diff, unit, currentLevel, nextLevelPercent,
}: SummaryCardProps) {
  const { Icon, label, color } = KIND_META[kind];
  const diffText =
    diff > 0 ? `先週比 +${diff}${unit ?? ""}` :
    diff < 0 ? `先週比 ${diff}${unit ?? ""}` :
    "先週比 ±0";
  const diffColor =
    diff > 0 ? "text-[var(--mint-700)]" :
    diff < 0 ? "text-[var(--warning-fg)]" :
    "text-[var(--ink-500)]";

  return (
    <Card className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-[var(--shadow-card)] motion-reduce:transition-none">
      <div className="flex items-start justify-between">
        <Icon className={cn("h-5 w-5", color)} aria-hidden />
        <span className={cn("text-xs font-medium", diffColor)}>
          {diffText}
        </span>
      </div>
      <p className="mt-3 text-sm text-[var(--ink-500)]">{label}</p>
      <p className="mt-1 font-mono text-3xl font-bold text-[var(--ink-900)] tabular-nums">
        {kind === "xp" && "+"}{value}
        {unit && <span className="ml-1 text-base font-medium text-[var(--ink-700)]">{unit}</span>}
      </p>
      {kind === "xp" && currentLevel !== undefined && nextLevelPercent !== undefined && (
        <p className="mt-2 text-xs text-[var(--ink-500)]">
          Lv {currentLevel} → Lv {currentLevel + 1} まで {nextLevelPercent}%
        </p>
      )}
    </Card>
  );
}

// 使用例:
// <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
//   <SummaryCard kind="streak"   value={14} diff={+2} unit="日" />
//   <SummaryCard kind="answers"  value={142} diff={+18} unit="問" />
//   <SummaryCard kind="accuracy" value={78} diff={+4} unit="%" />
//   <SummaryCard kind="xp"       value={520} diff={+80} unit="XP" currentLevel={7} nextLevelPercent={62} />
// </div>
```

---

## 4. ProgressChart（学習推移 / Recharts 二重折れ線）

**何の表示か**: 直近 7 / 30 / 90 日の日次解答数（左軸）と正答率%（右軸）の二重折れ線。Tabs で期間切替、prefers-reduced-motion で animation 停止。

**依存する props**:
```ts
type ChartPoint = { date: string; answers: number; accuracy: number };
type ProgressChartProps = {
  data7d: ChartPoint[];
  data30d: ChartPoint[];
  data90d: ChartPoint[];
  summary: string;  // aria-label 用要約文
};
```

```tsx
export function ProgressChart({ data7d, data30d, data90d, summary }: ProgressChartProps) {
  const [range, setRange] = React.useState<"7" | "30" | "90">("30");
  const prefersReducedMotion = usePrefersReducedMotion();

  const data = range === "7" ? data7d : range === "30" ? data30d : data90d;
  const ariaLabel = `直近${range}日の日次解答数と正答率の推移グラフ。${summary}`;

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-5 lg:p-6">
        <h2 className="text-lg font-semibold text-[var(--ink-900)]">学習推移</h2>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Image src="/character/parent-greeting.svg" alt="" width={64} height={64} className="h-16 w-16 opacity-60" />
          <p className="text-sm text-[var(--ink-500)]">学習データが集まり次第、グラフが表示されます。</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--ink-900)]">学習推移</h2>
        <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <TabsList className="grid grid-cols-3 rounded-lg bg-[var(--surface-muted)] p-1">
            <TabsTrigger value="7"  className="rounded-md px-3 text-sm data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--brand-700)] data-[state=active]:shadow-sm">7日</TabsTrigger>
            <TabsTrigger value="30" className="rounded-md px-3 text-sm data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--brand-700)] data-[state=active]:shadow-sm">30日</TabsTrigger>
            <TabsTrigger value="90" className="rounded-md px-3 text-sm data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--brand-700)] data-[state=active]:shadow-sm">90日</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div role="img" aria-label={ariaLabel}
        className="mt-4 h-64 w-full sm:h-72 lg:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="var(--ink-500)" fontSize={12} tickMargin={6} />
            <YAxis yAxisId="left"  stroke="var(--brand-600)" fontSize={12} tickMargin={4} />
            <YAxis yAxisId="right" orientation="right" stroke="var(--mint-600)" fontSize={12} tickMargin={4} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
              }}
              labelStyle={{ color: "var(--ink-900)", fontWeight: 600 }}
            />
            <Line yAxisId="left"  type="monotone" dataKey="answers"
              stroke="var(--brand-500)" strokeWidth={2}
              dot={{ r: 3, fill: "var(--brand-500)" }} activeDot={{ r: 5 }}
              isAnimationActive={!prefersReducedMotion}
              name="解答数" />
            <Line yAxisId="right" type="monotone" dataKey="accuracy"
              stroke="var(--mint-600)" strokeWidth={2}
              dot={{ r: 3, fill: "var(--mint-600)" }} activeDot={{ r: 5 }}
              isAnimationActive={!prefersReducedMotion}
              name="正答率(%)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--ink-700)]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-[var(--brand-500)]" />
          解答数（左軸）
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-[var(--mint-600)]" />
          正答率（右軸 0-100%）
        </span>
      </div>
    </Card>
  );
}
```

---

## 5. RecentMistakes（直近の誤答 TOP 5）

**何の表示か**: 学習者が最近間違えた問題 5 件を、問題タイトル + 学習者の選んだ誤答 + 正解 + AI コーチの一言で表示。

**依存する props**:
```ts
type Mistake = {
  id: string;
  problemTitle: string;
  selectedAnswer: string;
  correctAnswer: string;
  coachComment: string;
};
type RecentMistakesProps = { mistakes: Mistake[] };
```

```tsx
export function RecentMistakes({ mistakes }: RecentMistakesProps) {
  if (mistakes.length === 0) {
    return (
      <Card className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--ink-900)]">直近の誤答 TOP 5</h2>
        <p className="mt-4 text-sm text-[var(--ink-500)]">
          直近の誤答はありません。問題なく学習が進んでいます。
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-lg font-semibold text-[var(--ink-900)]">直近の誤答 TOP 5</h2>
      <ul className="mt-4 divide-y divide-[var(--border)]">
        {mistakes.slice(0, 5).map((m) => (
          <li key={m.id} className="py-4 first:pt-0 last:pb-0">
            <p className="text-base font-medium text-[var(--ink-900)]">{m.problemTitle}</p>
            <div className="mt-2 flex flex-col gap-1 text-sm sm:flex-row sm:gap-4">
              <span className="inline-flex items-center gap-1.5 text-[var(--warning-fg)]">
                <XCircleIcon className="h-4 w-4 shrink-0" aria-hidden />
                <span>選択: {m.selectedAnswer}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[var(--success-fg)]">
                <CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden />
                <span>正解: {m.correctAnswer}</span>
              </span>
            </div>
            <p className="mt-2 inline-flex items-start gap-2 rounded-lg bg-[var(--brand-50)] p-3 text-sm text-[var(--ink-700)] dark:bg-[var(--brand-900)]/15">
              <ChatBubbleBottomCenterTextIcon className="h-4 w-4 shrink-0 text-[var(--brand-700)]" aria-hidden />
              <span>ことだまトリより: {m.coachComment}</span>
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
```

---

## 6. InactivityReminder（学習停止リマインド + 励ましメール送信）

**何の表示か**: 7 日以上学習が止まったときに表示する警告セクション。ことだまトリ parent-alert 状態 + 「励ましメールを送る」CTA + Resend API 連携。

**依存する props**:
```ts
type InactivityReminderProps = {
  learnerName: string;
  daysSinceLast: number;     // 7 以上で表示する想定（呼び出し側で条件判定）
  onSendMail: () => Promise<void>;
};
```

```tsx
export function InactivityReminder({ learnerName, daysSinceLast, onSendMail }: InactivityReminderProps) {
  const [sent, setSent] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const handleClick = async () => {
    if (sent || sending) return;
    setSending(true);
    try {
      await onSendMail();
      setSent(true);
    } catch (e) {
      console.error(e);
      // トースト表示は呼び出し側で
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      role="region"
      aria-labelledby="inactivity-heading"
      className="flex flex-col gap-4 rounded-l-md rounded-r-2xl border border-[var(--border)] border-l-4 border-l-[var(--warning)] bg-[var(--warning-bg)]/20 p-5 sm:flex-row sm:items-center dark:bg-[var(--warning)]/10"
    >
      <Image src="/character/parent-alert.svg" alt="" width={80} height={80}
        className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
      <div className="flex-1">
        <h3 id="inactivity-heading" className="text-base font-semibold text-[var(--warning-fg)] sm:text-lg">
          {learnerName}さんが {daysSinceLast} 日学習されていません。
        </h3>
        <p className="mt-1 text-sm text-[var(--ink-700)]">
          お忙しい時期かもしれません。励ましのメールを送って、ことだまトリから一言お届けすることもできます。
        </p>
      </div>
      <button type="button"
        onClick={handleClick}
        disabled={sent || sending}
        aria-describedby="reminder-desc"
        className={cn(
          "inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl px-5 font-semibold focus-visible:shadow-[var(--shadow-focus)]",
          "bg-[var(--brand-500)] text-[var(--ink-900)] hover:bg-[var(--brand-600)] hover:text-white",
          "disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-500)] disabled:hover:bg-[var(--surface-muted)]",
        )}
      >
        <PaperAirplaneIcon className="h-5 w-5" aria-hidden />
        {sent ? "送信済み" : sending ? "送信中..." : "励ましメールを送る"}
      </button>
      <span id="reminder-desc" className="sr-only">
        {learnerName}さんに励ましメールを送ります。Resend 経由で保護者アドレスから配信されます。送信後 24 時間は再送できません。
      </span>
    </section>
  );
}
```

---

## 7. CoachingSettings（学習時間目安 / リマインド ON-OFF / 受験予定日）

**何の表示か**: 保護者がコーチング設定を行うカード。Slider（1日の学習時間目安）+ Switch（リマインド通知）+ Dialog トリガー（受験予定日変更）の 3 項目。

**依存する props**:
```ts
type CoachingSettingsProps = {
  initialMinutes: number;
  initialRemindOn: boolean;
  examDateFormatted: string;  // "2026年6月14日（日）"
  onMinutesChange: (m: number) => void;
  onRemindToggle: (on: boolean) => void;
};
```

```tsx
export function CoachingSettings({
  initialMinutes, initialRemindOn, examDateFormatted,
  onMinutesChange, onRemindToggle,
}: CoachingSettingsProps) {
  const [minutes, setMinutes] = React.useState(initialMinutes);
  const [remindOn, setRemindOn] = React.useState(initialRemindOn);

  return (
    <Card className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-lg font-semibold text-[var(--ink-900)]">コーチング設定</h2>
      <div className="mt-4 divide-y divide-[var(--border)]">

        {/* 1. 1日の学習時間目安 */}
        <div className="py-4 first:pt-0">
          <Label htmlFor="study-minutes" className="text-base font-medium text-[var(--ink-900)]">
            1日の学習時間目安
          </Label>
          <p className="mt-1 text-sm text-[var(--ink-500)]">
            お子様の集中力に合わせてご調整ください。
          </p>
          <div className="mt-3 flex items-center gap-4">
            <Slider id="study-minutes"
              min={15} max={90} step={5}
              value={[minutes]}
              onValueChange={([v]) => { setMinutes(v); onMinutesChange(v); }}
              className="flex-1"
              aria-label={`1日の学習時間目安 現在 ${minutes} 分`} />
            <span className="font-mono text-2xl font-bold tabular-nums text-[var(--brand-700)]">
              {minutes}<span className="ml-1 text-sm font-medium text-[var(--ink-700)]">分</span>
            </span>
          </div>
        </div>

        {/* 2. リマインド通知 */}
        <div className="flex items-start justify-between gap-4 py-4">
          <div className="flex-1">
            <Label htmlFor="reminder-toggle" className="text-base font-medium text-[var(--ink-900)]">
              学習が止まったときに、メールで通知する
            </Label>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              7日間学習がない場合に、保護者の方へお知らせをお送りします。
            </p>
          </div>
          <Switch id="reminder-toggle"
            checked={remindOn}
            onCheckedChange={(v) => { setRemindOn(v); onRemindToggle(v); }}
            aria-label="学習停止リマインド通知" />
        </div>

        {/* 3. 受験予定日 */}
        <div className="py-4 last:pb-0">
          <p className="text-base font-medium text-[var(--ink-900)]">受験予定日</p>
          <p className="mt-1 text-sm text-[var(--ink-500)]">
            変更すると、お子様のホーム画面のカウントダウンも更新されます。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-base text-[var(--ink-900)]">
              <CalendarDaysIcon className="h-5 w-5 text-[var(--brand-600)]" aria-hidden />
              {examDateFormatted}
            </span>
            <Dialog>
              <DialogTrigger asChild>
                <button type="button"
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--ink-900)] hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]">
                  日付を変更
                  <ChevronRightIcon className="h-4 w-4" aria-hidden />
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                {/* W4 で実装: shadcn Calendar + バリデーション + 確認ダイアログ */}
                <p className="text-sm text-[var(--ink-700)]">
                  受験日変更モーダル（W4 で実装）
                </p>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </Card>
  );
}
```

---

## 8. ParentDashboardPage（全体統合 / page.tsx 雛形）

**何の表示か**: `/parent/dashboard` のページ全体。本ガイドの全コンポーネントを組み合わせた page.tsx 雛形。

**依存する props**: ServerComponent ベース、データは `getDashboardData()` で取得想定（Dev 実装）。

```tsx
// app/(parent)/parent/dashboard/page.tsx
import { ParentHeaderBar } from "@/components/parent/parent-header-bar";
import { GreetingBanner } from "@/components/parent/greeting-banner";
import { SummaryCard } from "@/components/parent/summary-card";
import { ProgressChart } from "@/components/parent/progress-chart";
import { RecentMistakes } from "@/components/parent/recent-mistakes";
import { InactivityReminder } from "@/components/parent/inactivity-reminder";
import { CoachingSettings } from "@/components/parent/coaching-settings";
import { ParentFooterTabs } from "@/components/parent/parent-footer-tabs";
import { getDashboardData } from "@/lib/parent/dashboard-data";

export default async function ParentDashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 md:pb-8">
      <a href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:shadow-[var(--shadow-focus)]">
        本文へスキップ
      </a>

      <ParentHeaderBar
        learners={data.learners}
        currentLearnerId={data.currentLearner.id}
        onLearnerChange={(id) => { /* router.push(`?learner_id=${id}`) */ }}
        todayJpFormatted={data.todayJpFormatted}
        daysUntilExam={data.daysUntilExam}
      />

      <main id="main" className="mx-auto max-w-screen-xl space-y-6 px-4 py-6 lg:space-y-8 lg:px-8">

        {/* Section 0: 挨拶 */}
        <GreetingBanner
          parentName={data.parent.name}
          learnerName={data.currentLearner.name}
          activeDaysThisWeek={data.summary.activeDaysThisWeek}
        />

        {/* Section 1: 今週の学習サマリー */}
        <section aria-label="今週の学習サマリー">
          <h2 className="sr-only">今週の学習サマリー</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <SummaryCard kind="streak"   value={data.summary.streakDays}     diff={data.summary.streakDiff}   unit="日" />
            <SummaryCard kind="answers"  value={data.summary.answersThisWeek} diff={data.summary.answersDiff}  unit="問" />
            <SummaryCard kind="accuracy" value={data.summary.accuracy}        diff={data.summary.accuracyDiff} unit="%" />
            <SummaryCard kind="xp"       value={data.summary.xpGain}          diff={data.summary.xpDiff}       unit="XP"
              currentLevel={data.summary.currentLevel}
              nextLevelPercent={data.summary.nextLevelPercent} />
          </div>
        </section>

        {/* Section 2: 学習推移グラフ */}
        <ProgressChart
          data7d={data.chart.d7}
          data30d={data.chart.d30}
          data90d={data.chart.d90}
          summary={data.chart.summary}
        />

        {/* Section 4: 学習停止リマインド（条件付き） */}
        {data.summary.daysSinceLast >= 7 && (
          <InactivityReminder
            learnerName={data.currentLearner.name}
            daysSinceLast={data.summary.daysSinceLast}
            onSendMail={data.actions.sendEncourageMail}
          />
        )}

        {/* Section 3 + 5: 誤答リスト + 設定（タブレット以上で 2 カラム） */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RecentMistakes mistakes={data.mistakes} />
          <CoachingSettings
            initialMinutes={data.settings.targetMinutes}
            initialRemindOn={data.settings.remindOn}
            examDateFormatted={data.settings.examDateFormatted}
            onMinutesChange={data.actions.updateMinutes}
            onRemindToggle={data.actions.updateRemindToggle}
          />
        </div>
      </main>

      <ParentFooterTabs />
    </div>
  );
}
```

---

## 補足: ParentFooterTabs（モバイル下部固定タブ）

**何の表示か**: モバイル時のみ表示する保護者用 4 タブ。デスクトップ（md:）以上では非表示。

```tsx
const PARENT_TABS = [
  { href: "/parent/dashboard",     Icon: HomeIcon,                    label: "ホーム" },
  { href: "/parent/reports",       Icon: ChartBarIcon,                label: "レポート" },
  { href: "/parent/settings",      Icon: Cog6ToothIcon,               label: "設定" },
  { href: "/home",                 Icon: ArrowRightOnRectangleIcon,   label: "学習者画面" },
];

export function ParentFooterTabs() {
  const pathname = usePathname();
  return (
    <nav role="navigation" aria-label="保護者ナビゲーション"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-screen-xl grid-cols-4">
        {PARENT_TABS.map(({ href, Icon, label }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs",
                  active
                    ? "text-[var(--brand-700)]"
                    : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
                )}>
                <Icon className="h-5 w-5" aria-hidden />
                {label}
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

## 実装メモ

- **shadcn 追加 install** (W3 着手時):
  - `npx shadcn@latest add select` （未追加なら）
  - `npx shadcn@latest add slider`
  - `npx shadcn@latest add switch`
  - `npx shadcn@latest add dialog`
- **Recharts** 追加: `npm i recharts`
- **Resend** 追加: `npm i resend`（既に W2 で導入済みなら不要）
- **a11y フック** 新規: `src/lib/a11y/use-prefers-reduced-motion.ts` を本ガイド §4.3 のコードで作成
- **キャラ SVG** 新規: `/public/character/parent-greeting.svg` `/parent-alert.svg` `/parent-celebrate.svg` の 3 ファイル

---

以上、W3 保護者ダッシュボード JSX スニペット集 8 個（ParentHeaderBar / GreetingBanner / SummaryCard / ProgressChart / RecentMistakes / InactivityReminder / CoachingSettings / ParentDashboardPage + 補足 ParentFooterTabs）。実装時はこのファイルから直接コピペして組み立て可能。

