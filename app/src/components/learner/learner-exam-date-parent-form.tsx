"use client";

/**
 * Learner Exam Date (Parent) Form (DEC-090 項目 3 / 設定画面拡張)
 *
 * 親が learner の受験日を inline edit できる form (3 枚カード stack の 3 枚目).
 *
 * 既存 mutation 流用 (mutation +0):
 *   - `updateExamDate({ learnerId, level, examDate, allowOverwrite })` (既存 Server Action)
 *   - parent path は既に internal 二系統認可で吸収済 (DEC-076).
 *
 * 既存 LearnerExamDateForm との差異:
 *   - 学習者本人 self-edit 用 (`/home/exam-date`) ではなく親設定画面 inline 用.
 *   - 成功後 /home へ redirect しない. router.refresh() で同 page を更新.
 *   - 成功 toast は中立「変更しました」.
 *
 * 設計原則:
 *   - 罰則ゼロ哲学 (DEC-024) / 喪失語ゼロ.
 *   - tap target ≥ 44px / aria-label / type="date" / min={today} OS native ピッカー.
 *   - 「ですます調」親向け.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateExamDate } from "@/lib/actions/exam-date";
import {
  validateExamDate,
  type ExamLevel,
  type UpdateExamDateResult,
} from "@/lib/actions/exam-date-validation";

interface Props {
  learnerId: string;
  initialDate: string | null;
  level: ExamLevel;
}

type Stage =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; date: string }
  | {
      kind: "confirm_overwrite";
      newDate: string;
      existingDate: string;
    }
  | { kind: "error"; message: string };

export function LearnerExamDateParentForm({
  learnerId,
  initialDate,
  level,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate ?? "");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const today = formatToday();

  const reset = () => setStage({ kind: "idle" });

  async function handleSubmit(allowOverwrite: boolean): Promise<void> {
    const v = validateExamDate(date);
    if (!v.ok) {
      setStage({
        kind: "error",
        message:
          v.reason === "past_date_not_allowed"
            ? "受験日は今日以降の日付を入力してください。"
            : "日付の形式が正しくありません。",
      });
      return;
    }

    setStage({ kind: "saving" });
    const result: UpdateExamDateResult = await updateExamDate({
      learnerId,
      level,
      examDate: date,
      allowOverwrite,
    });

    if (result.ok) {
      setStage({ kind: "saved", date: result.examDate });
      startTransition(() => {
        router.refresh();
      });
      return;
    }

    if (result.reason === "overwrite_required") {
      setStage({
        kind: "confirm_overwrite",
        newDate: date,
        existingDate: result.existingDate ?? "",
      });
      return;
    }

    setStage({ kind: "error", message: messageForReason(result.reason) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">受験日</CardTitle>
        <CardDescription>
          英検 {level} 級 / 今日以降の日付のみ登録できます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (stage.kind === "saving") return;
            void handleSubmit(false);
          }}
          className="space-y-4"
          data-testid="learner-exam-date-parent-form"
        >
          <div className="space-y-2">
            <Label htmlFor="learner-exam-date-parent-input">受験日</Label>
            <Input
              id="learner-exam-date-parent-input"
              name="exam_date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (e.target.value && e.target.value < today) {
                  setStage({
                    kind: "error",
                    message: "受験日は今日以降の日付を入力してください。",
                  });
                } else if (stage.kind === "error") {
                  reset();
                }
              }}
              disabled={stage.kind === "saving"}
              data-testid="learner-exam-date-parent-input"
              aria-invalid={stage.kind === "error" ? "true" : "false"}
              aria-describedby="learner-exam-date-parent-help"
            />
            <p
              id="learner-exam-date-parent-help"
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <CalendarDaysIcon className="h-3 w-3" aria-hidden="true" />
              ホームと保護者ダッシュボードの両方に反映されます。
            </p>
          </div>

          {stage.kind === "error" ? (
            <div
              role="alert"
              data-testid="learner-exam-date-parent-error"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <ExclamationTriangleIcon
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{stage.message}</span>
            </div>
          ) : null}

          {stage.kind === "saved" ? (
            <div
              role="status"
              aria-live="polite"
              data-testid="learner-exam-date-parent-saved"
              className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary"
            >
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              <span>変更しました ({stage.date})。</span>
            </div>
          ) : null}

          {stage.kind === "confirm_overwrite" ? (
            <div
              role="alertdialog"
              aria-labelledby="learner-exam-date-parent-overwrite-title"
              data-testid="learner-exam-date-parent-overwrite"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            >
              <p
                id="learner-exam-date-parent-overwrite-title"
                className="font-medium text-foreground"
              >
                既に登録された受験日があります。
              </p>
              <p className="mt-1 text-muted-foreground">
                現在: {stage.existingDate} → 新しい日付: {stage.newDate}
                <br />
                上書きして保存しますか？
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void handleSubmit(true);
                  }}
                  data-testid="learner-exam-date-parent-confirm-overwrite"
                >
                  上書きして保存
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={reset}
                >
                  やめる
                </Button>
              </div>
            </div>
          ) : null}

          {stage.kind !== "confirm_overwrite" ? (
            <Button
              type="submit"
              data-testid="learner-exam-date-parent-submit"
              disabled={
                !date ||
                stage.kind === "saving" ||
                stage.kind === "error"
              }
              className="min-h-tap-cta"
            >
              {stage.kind === "saving" ? "保存中..." : "変更"}
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function formatToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function messageForReason(reason: string | undefined): string {
  switch (reason) {
    case "invalid_date_format":
      return "日付の形式が正しくありません。";
    case "past_date_not_allowed":
      return "受験日は今日以降の日付を入力してください。";
    case "invalid_level":
      return "級の指定が正しくありません。";
    case "learner_not_owned":
      return "この受験日にはアクセスできません。";
    default:
      return "保存に失敗しました。時間をおいて再度お試しください。";
  }
}
