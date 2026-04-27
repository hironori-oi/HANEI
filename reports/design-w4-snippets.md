# PRJ-016 HANEI W4 JSX スニペット集

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W4 開発実装、コピペで動く JSX スニペット
- **W4 ガイド対**:
  - design-w4-mock-exam-results.md（D-1）
  - design-w4-exam-date-modal.md（D-2）
  - design-w4-learner-switch.md（D-3）
- **方針**: 各スニペットは Tailwind v4 + shadcn/ui + Heroicons 24/outline + framer-motion 構成。Dev はそのままコンポーネント化できる粒度で記載

---

## § 1. PastMockExamCard（過去模試カード）

```tsx
// components/parent/PastMockExamCard.tsx
import { CheckCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

type Props = {
  examDate: string; // ISO
  level: "5" | "4" | "3" | "pre2";
  totalScore: number; // 0-100
  passed: boolean;
};

const LEVEL_LABEL: Record<Props["level"], string> = {
  "5": "5 級",
  "4": "4 級",
  "3": "3 級",
  pre2: "準 2 級",
};

export function PastMockExamCard({ examDate, level, totalScore, passed }: Props) {
  return (
    <article
      aria-label={`${LEVEL_LABEL[level]} 模試 ${formatDate(examDate)} ${totalScore}点 ${passed ? "合格" : "もう一歩"}`}
      className="min-w-[220px] shrink-0 snap-start rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:min-w-0"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-sm text-[var(--ink-500)]">{formatDate(examDate)}</span>
        <span className="rounded-full bg-[var(--brand-50)] px-2.5 py-0.5 text-xs font-medium text-[var(--brand-700)]">
          {LEVEL_LABEL[level]}
        </span>
      </div>
      <p className="mt-3 font-mono text-3xl font-bold text-[var(--ink-900)]">
        {totalScore}
        <span className="ml-1 text-sm font-medium text-[var(--ink-500)]">/ 100</span>
      </p>
      <div className="mt-3">
        {passed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mint-100)] px-2.5 py-0.5 text-xs font-medium text-[var(--mint-700)]">
            <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden />
            合格
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-2.5 py-0.5 text-xs font-medium text-[var(--warning-fg)]">
            <ArrowPathIcon className="h-3.5 w-3.5" aria-hidden />
            もう一歩
          </span>
        )}
      </div>
    </article>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
```

---

## § 2. RadarChart4Skills（4 技能レーダーチャート SVG 自作版）

```tsx
// components/parent/RadarChart4Skills.tsx
import { useMemo } from "react";

type Skill = "vocab" | "grammar" | "reading" | "listening";

type Props = {
  scores: Record<Skill, number>; // 0-100
  totalScore: number; // 0-100
  size?: number; // px (default 360)
};

const SKILL_LABEL: Record<Skill, string> = {
  vocab: "語彙",
  grammar: "文法",
  reading: "読解",
  listening: "リスニング",
};

const SKILL_ORDER: Skill[] = ["vocab", "grammar", "reading", "listening"];

export function RadarChart4Skills({ scores, totalScore, size = 360 }: Props) {
  const center = size / 2;
  const radius = size * 0.36;
  const labelOffset = size * 0.46;

  // 4 軸: 12 時、3 時、6 時、9 時 = -90°, 0°, 90°, 180°
  const angles = [-90, 0, 90, 180].map((d) => (d * Math.PI) / 180);

  // 各頂点座標（スコアに応じた距離）
  const points = SKILL_ORDER.map((skill, i) => {
    const score = scores[skill];
    const r = (score / 100) * radius;
    return {
      x: center + r * Math.cos(angles[i]),
      y: center + r * Math.sin(angles[i]),
      score,
    };
  });

  // 軸ラベル座標
  const labelPositions = SKILL_ORDER.map((skill, i) => ({
    x: center + labelOffset * Math.cos(angles[i]),
    y: center + labelOffset * Math.sin(angles[i]),
    skill,
  }));

  const polygonPoints = useMemo(
    () => points.map((p) => `${p.x},${p.y}`).join(" "),
    [points],
  );

  // 同心円（25/50/75/100%）
  const rings = [0.25, 0.5, 0.75, 1.0];

  // 軸ライン
  const axisLines = SKILL_ORDER.map((_, i) => ({
    x1: center,
    y1: center,
    x2: center + radius * Math.cos(angles[i]),
    y2: center + radius * Math.sin(angles[i]),
  }));

  const ariaLabel = `最新模試のスキル別スコア。語彙${scores.vocab}点、文法${scores.grammar}点、読解${scores.reading}点、リスニング${scores.listening}点。総合${totalScore}点。`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div role="img" aria-label={ariaLabel}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="h-auto w-full max-w-[360px]"
          aria-hidden="true"
        >
          {/* 同心円 */}
          {rings.map((r, i) => (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius * r}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          ))}

          {/* 軸ライン */}
          {axisLines.map((line, i) => (
            <line
              key={i}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="var(--border)"
              strokeWidth="1"
            />
          ))}

          {/* データ多角形 */}
          <polygon
            points={polygonPoints}
            fill="var(--brand-500)"
            fillOpacity="0.2"
            stroke="var(--brand-600)"
            strokeWidth="2"
            className="motion-safe:[animation:radar-draw_0.6s_ease-out]"
          />

          {/* 各頂点ドット */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="var(--brand-600)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          ))}

          {/* 中心の総合スコア */}
          <text
            x={center}
            y={center - 6}
            textAnchor="middle"
            className="fill-[var(--ink-900)] font-mono text-[28px] font-bold"
          >
            {totalScore}
          </text>
          <text
            x={center}
            y={center + 14}
            textAnchor="middle"
            className="fill-[var(--ink-500)] text-[10px]"
          >
            総合スコア
          </text>

          {/* 軸ラベル */}
          {labelPositions.map((lp, i) => (
            <g key={i}>
              <text
                x={lp.x}
                y={lp.y - 4}
                textAnchor="middle"
                className="fill-[var(--ink-700)] text-sm font-medium"
              >
                {SKILL_LABEL[lp.skill]}
              </text>
              <text
                x={lp.x}
                y={lp.y + 12}
                textAnchor="middle"
                className="fill-[var(--ink-500)] font-mono text-xs"
              >
                {scores[lp.skill]}/100
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* SR / 視覚障害向けスコア表組み（視覚的にも併記） */}
      <table className="w-full max-w-[320px] text-sm">
        <caption className="sr-only">最新模試のスキル別スコア表</caption>
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th scope="col" className="pb-2 text-left font-medium text-[var(--ink-500)]">
              技能
            </th>
            <th scope="col" className="pb-2 text-right font-medium text-[var(--ink-500)]">
              スコア
            </th>
          </tr>
        </thead>
        <tbody>
          {SKILL_ORDER.map((skill) => (
            <tr key={skill} className="border-b border-[var(--border)] last:border-0">
              <th scope="row" className="py-2 text-left font-medium text-[var(--ink-900)]">
                {SKILL_LABEL[skill]}
              </th>
              <td className="py-2 text-right font-mono font-semibold text-[var(--ink-900)]">
                {scores[skill]}
                <span className="ml-1 text-xs font-normal text-[var(--ink-500)]">/100</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

CSS（`globals.css` に追加）:

```css
@layer utilities {
  @keyframes radar-draw {
    from {
      transform: scale(0);
      transform-origin: center;
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
}
```

---

## § 3. WeakPointTop3Item（弱点 TOP 3 項目）

```tsx
// components/parent/WeakPointTop3Item.tsx
type Props = {
  rank: 1 | 2 | 3;
  skill: "vocab" | "grammar" | "reading" | "listening";
  averageScore: number; // 0-100
  proposalText: string;
};

const SKILL_LABEL = {
  vocab: "語彙",
  grammar: "文法",
  reading: "読解",
  listening: "リスニング",
} as const;

export function WeakPointTop3Item({ rank, skill, averageScore, proposalText }: Props) {
  return (
    <li role="listitem" className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--brand-100)] font-mono text-sm font-bold text-[var(--brand-700)]"
        >
          {rank}
        </span>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-semibold text-[var(--ink-900)]">
              {SKILL_LABEL[skill]}
            </h3>
            <span className="font-mono text-sm text-[var(--ink-500)]">
              平均 {averageScore}/100
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-700)]">{proposalText}</p>
        </div>
      </div>
    </li>
  );
}
```

---

## § 4. CoachMessageCard（AI コーチからの一言）

```tsx
// components/parent/CoachMessageCard.tsx
import Image from "next/image";

type Props = {
  passed: boolean;
  coachMessage: string;
  learningPlan: string;
};

export function CoachMessageCard({ passed, coachMessage, learningPlan }: Props) {
  const characterSrc = passed
    ? "/character/parent-celebrate.svg"
    : "/character/parent-encouraging.svg";

  return (
    <section
      aria-labelledby="coach-msg-heading"
      className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand-50)] to-[var(--surface)] p-5 sm:p-6 dark:from-[var(--brand-900)]/15 dark:to-[var(--surface)]"
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        <Image
          src={characterSrc}
          alt=""
          width={96}
          height={96}
          className="h-20 w-20 shrink-0 sm:h-24 sm:w-24"
        />
        <div className="flex-1">
          <h2
            id="coach-msg-heading"
            className="text-lg font-semibold text-[var(--ink-900)]"
          >
            ことだまトリより
          </h2>
          <p className="mt-2 text-base leading-relaxed text-[var(--ink-700)]">
            {coachMessage}
          </p>
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-3 text-sm">
            <p className="font-medium text-[var(--ink-900)]">学習プランの提案</p>
            <p className="mt-1 text-[var(--ink-700)]">{learningPlan}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

---

## § 5. NextExamCta（次回受験 + CTA）

```tsx
// components/parent/NextExamCta.tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarDaysIcon, PlayCircleIcon } from "@heroicons/react/24/outline";

type Props = {
  learnerName: string;
  nextExamDate: string;
  daysUntilNext: number;
};

export function NextExamCta({ learnerName, nextExamDate, daysUntilNext }: Props) {
  return (
    <section
      aria-labelledby="next-exam-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2
            id="next-exam-heading"
            className="text-sm text-[var(--ink-500)]"
          >
            次回受験予定日
          </h2>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="font-mono text-2xl font-bold text-[var(--ink-900)]">
              {formatDate(nextExamDate)}
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1 text-sm font-medium text-[var(--brand-700)]">
              <CalendarDaysIcon className="h-4 w-4" aria-hidden />
              残り {daysUntilNext} 日
            </span>
          </div>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-[var(--brand-500)] px-6 font-semibold text-[var(--ink-900)] hover:bg-[var(--brand-600)] hover:text-white focus-visible:shadow-[var(--shadow-focus)]"
            >
              <PlayCircleIcon className="h-5 w-5" aria-hidden />
              模試を実施する
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[var(--ink-900)]">
                模試を実施しますか
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-[var(--ink-700)]">
                模試の実施には 5〜10 分かかります。{learnerName}さんの集中できる時間に合わせて、開始してください。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 gap-2">
              {/* 実施処理は cron 起動 / 保留状態（Phase 2） */}
              <button
                type="button"
                className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-medium text-[var(--ink-900)] hover:bg-[var(--surface-muted)]"
              >
                あとで
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-xl bg-[var(--brand-500)] px-5 font-semibold text-[var(--ink-900)] hover:bg-[var(--brand-600)] hover:text-white"
              >
                開始する
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <p className="mt-3 text-sm text-[var(--ink-500)]">
        {learnerName}さんの学習進捗を見て、最適な実施タイミングをお知らせします。
      </p>
    </section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
```

---

## § 6. ExamDateModal（受験日設定モーダル本体 / D-2）

```tsx
// components/parent/ExamDateModal.tsx
"use client";
import { useState } from "react";
import Image from "next/image";
import { addDays, isBefore } from "date-fns";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { CalendarDaysIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learnerName: string;
  currentExamDate?: string;
  currentLevel?: "5" | "4" | "3" | "pre2";
  onSave: (level: string, date: Date) => Promise<void>;
};

const LEVEL_LABEL = {
  "5": "5 級",
  "4": "4 級",
  "3": "3 級",
  pre2: "準 2 級",
} as const;

export function ExamDateModal({
  open,
  onOpenChange,
  learnerName,
  currentExamDate,
  currentLevel,
  onSave,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = addDays(today, 730);

  const [level, setLevel] = useState<string>(currentLevel ?? "");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    currentExamDate ? new Date(currentExamDate) : undefined,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const isPast = selectedDate ? isBefore(selectedDate, today) : false;
  const canSave = !!level && !!selectedDate && !isPast;

  function handleSaveClick() {
    if (!canSave) return;
    if (currentExamDate) {
      setConfirmOpen(true);
    } else {
      doSave();
    }
  }

  async function doSave() {
    if (!level || !selectedDate) return;
    await onSave(level, selectedDate);
    toast({
      title: "受験予定日を更新しました",
      description: `${LEVEL_LABEL[level as keyof typeof LEVEL_LABEL]} の受験日を ${formatDate(selectedDate)} に設定しました`,
      duration: 4000,
    });
    setConfirmOpen(false);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[80vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[var(--ink-900)]">
              受験予定日を設定する
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-[var(--ink-700)]">
              受験予定日を変更すると、{learnerName}さんのホーム画面のカウントダウンと
              1 日の推奨学習時間が自動で更新されます。
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            {currentExamDate && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs text-[var(--ink-500)]">現在の受験予定日</p>
                <p className="mt-0.5 font-mono text-base font-semibold text-[var(--ink-900)]">
                  {formatDate(new Date(currentExamDate))}
                </p>
              </div>
            )}

            <div>
              <Label
                htmlFor="exam-level"
                className="text-sm font-medium text-[var(--ink-900)]"
              >
                受験する級
              </Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger
                  id="exam-level"
                  className="mt-1.5 h-11 rounded-xl border-[var(--border)]"
                >
                  <SelectValue placeholder="級を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 級</SelectItem>
                  <SelectItem value="4">4 級</SelectItem>
                  <SelectItem value="3">3 級</SelectItem>
                  <SelectItem value="pre2">準 2 級</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex-1">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => isBefore(date, today) || date > maxDate}
                  fromMonth={today}
                  toMonth={maxDate}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                  classNames={{
                    day_selected:
                      "bg-[var(--brand-500)] text-[var(--ink-900)] hover:bg-[var(--brand-600)] hover:text-white focus:bg-[var(--brand-600)]",
                    day_today:
                      "bg-[var(--brand-50)] text-[var(--brand-700)] font-semibold",
                    day_disabled:
                      "text-[var(--ink-300)] opacity-50 cursor-not-allowed line-through",
                    day_outside: "text-[var(--ink-300)] opacity-40",
                    head_cell: "text-[var(--ink-500)] font-medium text-xs",
                    caption_label: "text-base font-semibold text-[var(--ink-900)]",
                    nav_button:
                      "h-9 w-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]",
                  }}
                />
              </div>
              <Image
                src="/character/parent-planning.svg"
                alt=""
                width={80}
                height={80}
                className="hidden h-20 w-20 shrink-0 self-center sm:block"
              />
            </div>

            <p className="text-xs text-[var(--ink-500)]">
              本日以降〜2 年先までの日付を選択できます。過去の日付はグレーで表示されます。
            </p>
          </div>

          <DialogFooter className="mt-6 gap-2 sm:gap-3">
            <DialogClose asChild>
              <button
                type="button"
                className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-medium text-[var(--ink-900)] hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
              >
                キャンセル
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={!canSave}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-500)] px-5 font-semibold text-[var(--ink-900)] hover:bg-[var(--brand-600)] hover:text-white focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-500)]"
            >
              <CalendarDaysIcon className="h-4 w-4" aria-hidden />
              この日付で保存
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 上書き確認 AlertDialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-[var(--ink-900)]">
              受験予定日を変更しますか
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-2 text-sm text-[var(--ink-700)]">
              {currentExamDate && selectedDate && (
                <>
                  {LEVEL_LABEL[level as keyof typeof LEVEL_LABEL]} の受験予定日を{" "}
                  <span className="font-mono text-[var(--ink-900)]">
                    {formatDate(new Date(currentExamDate))}
                  </span>{" "}
                  から{" "}
                  <span className="font-mono font-semibold text-[var(--brand-700)]">
                    {formatDate(selectedDate)}
                  </span>{" "}
                  に変更します。{learnerName}さんのホーム画面のカウントダウンも自動で更新されます。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="min-h-[44px] rounded-xl">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={doSave}
              className="min-h-[44px] rounded-xl bg-[var(--brand-500)] font-semibold text-[var(--ink-900)] hover:bg-[var(--brand-600)] hover:text-white"
            >
              変更する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
```

---

## § 7. LearnerSwitcher（学習者切替 / D-3）

```tsx
// components/parent/LearnerSwitcher.tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserIcon,
  ChevronDownIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

type Learner = {
  id: string;
  name: string;
  grade: string;
};

type Props = {
  learners: Learner[];
  currentLearnerId: string;
};

export function LearnerSwitcher({ learners, currentLearnerId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentLearner =
    learners.find((l) => l.id === currentLearnerId) ?? learners[0];

  function handleSwitch(newId: string) {
    const learner = learners.find((l) => l.id === newId);
    if (!learner) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("learner", newId);
    router.push(`${pathname}?${params.toString()}`);
    announceLearnerSwitch(learner.name);
  }

  if (learners.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
        <UserIcon
          className="h-4 w-4 text-[var(--ink-500)]"
          aria-hidden
        />
        <span className="text-sm font-medium text-[var(--ink-900)]">
          {currentLearner.name}（{currentLearner.grade}）
        </span>
      </div>
    );
  }

  if (learners.length === 2) {
    return (
      <Tabs value={currentLearnerId} onValueChange={handleSwitch}>
        <TabsList
          aria-label="学習者を切り替え"
          className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-muted)] p-1"
        >
          {learners.map((l) => (
            <TabsTrigger
              key={l.id}
              value={l.id}
              className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-[var(--ink-700)] data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--brand-700)] data-[state=active]:shadow-[var(--shadow-sm)]"
            >
              {l.name}
              <span className="ml-1.5 text-xs text-[var(--ink-500)]">
                {l.grade}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    );
  }

  // 3 名以上: DropdownMenu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`学習者を切り替え（現在: ${currentLearner.name}）`}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink-900)] hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
        >
          <UserIcon
            className="h-4 w-4 text-[var(--ink-500)]"
            aria-hidden
          />
          {currentLearner.name}
          <span className="text-xs text-[var(--ink-500)]">
            {currentLearner.grade}
          </span>
          <ChevronDownIcon
            className="h-4 w-4 text-[var(--ink-500)]"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
      >
        <DropdownMenuLabel className="px-3 py-1.5 text-xs text-[var(--ink-500)]">
          学習者を選択
        </DropdownMenuLabel>
        {learners.map((l) => (
          <DropdownMenuItem
            key={l.id}
            onSelect={() => handleSwitch(l.id)}
            className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-[var(--ink-900)] data-[highlighted]:bg-[var(--brand-50)] data-[highlighted]:text-[var(--brand-700)]"
          >
            {l.id === currentLearnerId && (
              <CheckIcon
                className="h-4 w-4 text-[var(--brand-600)]"
                aria-hidden
              />
            )}
            <span
              className={cn(
                l.id === currentLearnerId ? "font-semibold" : "",
              )}
            >
              {l.name}
            </span>
            <span className="ml-auto text-xs text-[var(--ink-500)]">
              {l.grade}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function announceLearnerSwitch(learnerName: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("learner-switch", {
      detail: `学習者を ${learnerName} に切り替えました`,
    }),
  );
}
```

---

## § 8. LearnerSwitchAnnouncer（aria-live 切替アナウンサー）

```tsx
// components/parent/LearnerSwitchAnnouncer.tsx
"use client";
import { useEffect, useState } from "react";

export function LearnerSwitchAnnouncer() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>;
      setMessage(ce.detail);
      // メッセージをクリアして再発火可能にする（同じ内容を連続切替したとき用）
      const timer = setTimeout(() => setMessage(""), 1000);
      return () => clearTimeout(timer);
    };
    window.addEventListener("learner-switch", handler);
    return () => window.removeEventListener("learner-switch", handler);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
```

---

## § 9. ParentHeaderBar（W3 拡張版 / D-3 統合）

```tsx
// components/parent/ParentHeaderBar.tsx
import Link from "next/link";
import Image from "next/image";
import {
  BellIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";
import { LearnerSwitcher } from "./LearnerSwitcher";
import { LearnerSwitchAnnouncer } from "./LearnerSwitchAnnouncer";

type Learner = { id: string; name: string; grade: string };

type Props = {
  learners: Learner[];
  currentLearnerId: string;
  daysUntilExam?: number;
};

export function ParentHeaderBar({
  learners,
  currentLearnerId,
  daysUntilExam,
}: Props) {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur dark:bg-[var(--surface)]/90">
      <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between gap-3 px-4 lg:px-8">
        {/* Left: Logo + 保護者画面バッジ */}
        <Link
          href="/parent/dashboard"
          className="flex items-center gap-2"
        >
          <Image
            src="/logo.svg"
            alt="HANEI"
            width={88}
            height={32}
            priority
          />
          <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--ink-700)] sm:inline-block">
            保護者画面
          </span>
        </Link>

        {/* Center: 学習者切替 */}
        <div className="flex max-w-md flex-1 justify-center">
          <LearnerSwitcher
            learners={learners}
            currentLearnerId={currentLearnerId}
          />
        </div>

        {/* Right: 受験日カウント + Bell + Cog */}
        <div className="flex items-center gap-2">
          {daysUntilExam !== undefined && (
            <span className="hidden items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1 text-sm font-medium text-[var(--brand-700)] md:inline-flex">
              <CalendarDaysIcon className="h-4 w-4" aria-hidden />
              受験まで {daysUntilExam} 日
            </span>
          )}
          <button
            type="button"
            aria-label="通知をひらく"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
          >
            <BellIcon
              className="h-5 w-5 text-[var(--ink-700)]"
              aria-hidden
            />
          </button>
          <Link
            href="/parent/settings"
            aria-label="設定"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
          >
            <Cog6ToothIcon
              className="h-5 w-5 text-[var(--ink-700)]"
              aria-hidden
            />
          </Link>
        </div>
      </div>

      <LearnerSwitchAnnouncer />
    </header>
  );
}
```

---

## § 10. MockExamResultsPage（画面全体の統合例 / D-1）

```tsx
// app/(parent)/mock-exam-results/page.tsx
import { PastMockExamCard } from "@/components/parent/PastMockExamCard";
import { RadarChart4Skills } from "@/components/parent/RadarChart4Skills";
import { WeakPointTop3Item } from "@/components/parent/WeakPointTop3Item";
import { CoachMessageCard } from "@/components/parent/CoachMessageCard";
import { NextExamCta } from "@/components/parent/NextExamCta";
import {
  getMockExamResults,
  computeWeakPoints,
  buildCoachMessage,
} from "@/lib/server/mock-exam";

export default async function MockExamResultsPage({
  searchParams,
}: {
  searchParams: { learner?: string };
}) {
  const learnerId = searchParams.learner;
  const data = await getMockExamResults(learnerId);
  const latest = data.exams[0];
  const weakPoints = computeWeakPoints(data.exams.slice(0, 3));
  const { message, plan } = buildCoachMessage(latest, weakPoints, data.learnerName);

  return (
    <main
      id="main"
      className="mx-auto max-w-screen-xl px-4 pb-24 pt-6 md:px-6 lg:px-8 lg:pt-8"
    >
      <h1 className="sr-only">{data.learnerName}さんの模試結果</h1>

      <div className="space-y-6 md:space-y-8">
        {/* Section 1: 過去模試一覧 */}
        <section aria-labelledby="past-exams-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2
              id="past-exams-heading"
              className="text-lg font-semibold text-[var(--ink-900)]"
            >
              過去の模試結果
            </h2>
            <span className="text-sm text-[var(--ink-500)]">
              直近 {Math.min(data.exams.length, 10)} 件
            </span>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">
            {data.exams.slice(0, 10).map((exam) => (
              <PastMockExamCard
                key={exam.id}
                examDate={exam.examDate}
                level={exam.level}
                totalScore={exam.totalScore}
                passed={exam.passed}
              />
            ))}
          </div>
        </section>

        {/* Section 2: 最新模試レーダーチャート */}
        {latest && (
          <section
            aria-labelledby="latest-radar-heading"
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
          >
            <div className="mb-4 flex items-baseline justify-between">
              <h2
                id="latest-radar-heading"
                className="text-lg font-semibold text-[var(--ink-900)]"
              >
                最新模試のスキル別スコア
              </h2>
              <span className="font-mono text-sm text-[var(--ink-500)]">
                {formatDate(latest.examDate)}
              </span>
            </div>
            <div className="mx-auto max-w-[420px]">
              <RadarChart4Skills
                scores={{
                  vocab: latest.vocabScore,
                  grammar: latest.grammarScore,
                  reading: latest.readingScore,
                  listening: latest.listeningScore,
                }}
                totalScore={latest.totalScore}
              />
            </div>
          </section>
        )}

        {/* Section 3: 弱点 TOP 3 */}
        <section
          aria-labelledby="weak-points-heading"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
        >
          <h2
            id="weak-points-heading"
            className="text-lg font-semibold text-[var(--ink-900)]"
          >
            次に伸ばすと届きそうな 3 つ
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-500)]">
            直近 3 回の模試平均で、もう少し伸ばせそうな技能から順にお知らせします。
          </p>
          <ul role="list" className="mt-4 divide-y divide-[var(--border)]">
            {weakPoints.map((wp, idx) => (
              <WeakPointTop3Item
                key={wp.skill}
                rank={(idx + 1) as 1 | 2 | 3}
                skill={wp.skill}
                averageScore={wp.averageScore}
                proposalText={wp.proposalText}
              />
            ))}
          </ul>
        </section>

        {/* Section 4: AI コーチからの一言 */}
        <CoachMessageCard
          passed={latest?.passed ?? false}
          coachMessage={message}
          learningPlan={plan}
        />

        {/* Section 5: 次回受験 + CTA */}
        <NextExamCta
          learnerName={data.learnerName}
          nextExamDate={data.nextExamDate}
          daysUntilNext={data.daysUntilNext}
        />
      </div>
    </main>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
```

---

## § 11. 補足: cn ユーティリティ（既存利用想定）

W2 までで `lib/utils.ts` に shadcn 標準の `cn`（clsx + tailwind-merge）が定義済を前提とする。未定義の場合は以下を投入。

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## § 12. 受入チェック（W4 Snippets ゲート）

- [ ] PastMockExamCard が直近 10 件分繰り返し表示できる
- [ ] RadarChart4Skills が SVG 自作で 4 技能描画 + テーブル併記
- [ ] WeakPointTop3Item が 3 件繰り返し表示できる
- [ ] CoachMessageCard が合格 / 不合格で SVG 切替
- [ ] NextExamCta の Dialog が開閉できる
- [ ] ExamDateModal が Calendar + 上書き確認 + トースト連動
- [ ] LearnerSwitcher が 1 / 2 / 3+ 名で UI を切替
- [ ] LearnerSwitchAnnouncer が aria-live で SR 読み上げ
- [ ] ParentHeaderBar が W3 拡張版で動作（W3 既存 page を本ガイドの `LearnerSwitcher` に差し替え）
- [ ] MockExamResultsPage が data 取得 → 5 セクション描画

---

以上、W4 JSX スニペット集完成。
