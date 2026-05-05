"use client";

/**
 * Learner Exam Date Form (W12-T2 / DEC-076)
 *
 * 学習者本人が自分の受験日を編集する Client Component。
 *
 * 仕様:
 *  - <input type="date"> + min={today} で OS native ピッカーが過去日を構造的に弾く
 *  - submit 時に validateExamDate(...) で再検証 (sync helper / 二重防御)
 *  - 罰則ゼロ哲学 (DEC-024): エラーメッセージは丁寧日本語のみ
 *  - 親 path と異なり、初期級 (level) は learnerProfiles.targetEikenLevel から確定済として
 *      Server Component 側で props 渡し (学習者本人が級を選び直す UX は本 atomic では含まない)
 *  - 成功時: useTransition + router.replace('/home') で /home に戻る
 *      revalidatePath は Server Action 側で発行済 (双方向同期)
 *  - DEC-074 §reauth 哲学に従い、本 form の submit は親パスワード reauth 不要
 *      (学習者本人による自己編集 / 親操作の sensitive 系とは区別)
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateExamDate } from "@/lib/actions/exam-date";
import {
  validateExamDate,
  type ExamLevel,
  type UpdateExamDateResult,
} from "@/lib/actions/exam-date-validation";

interface LearnerExamDateFormProps {
  learnerId: string;
  learnerNickname: string;
  /** 既定値 (現在登録されている受験日) */
  initialDate: string | null;
  /** learnerProfiles.targetEikenLevel から確定 */
  level: ExamLevel;
}

type Stage =
  | { kind: "idle" }
  | {
      kind: "confirm_overwrite";
      newDate: string;
      existingDate: string;
    }
  | { kind: "saving" }
  | { kind: "saved"; date: string }
  | { kind: "error"; message: string };

export function LearnerExamDateForm({
  learnerId,
  learnerNickname,
  initialDate,
  level,
}: LearnerExamDateFormProps) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate ?? "");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [, startTransition] = useTransition();

  const today = formatToday();

  function reset(): void {
    setStage({ kind: "idle" });
  }

  async function handleSubmit(allowOverwrite: boolean): Promise<void> {
    // 1 次クライアントバリデーション (UX 上の即時フィードバック / Server 側でも再検証)
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
      // 成功表示を 1 秒見せてから /home に戻す
      setTimeout(() => {
        startTransition(() => {
          router.replace("/home");
          router.refresh();
        });
      }, 1000);
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

    setStage({
      kind: "error",
      message: messageForReason(result.reason),
    });
  }

  return (
    <form
      data-testid="learner-exam-date-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (stage.kind === "saving") return;
        void handleSubmit(false);
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="learner-exam-date">受験日</Label>
        <Input
          id="learner-exam-date"
          name="exam_date"
          type="date"
          min={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            // 入力ガード即時 feedback: 過去日入力時はエラーを inline 表示
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
          data-testid="learner-exam-date-input"
          aria-invalid={stage.kind === "error" ? "true" : "false"}
          aria-describedby="learner-exam-date-help"
        />
        <p
          id="learner-exam-date-help"
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          <CalendarDaysIcon className="h-3 w-3" aria-hidden="true" />
          今日以降の日付のみ登録できます。{learnerNickname}さんの目標日を入れましょう。
        </p>
      </div>

      {stage.kind === "error" ? (
        <div
          role="alert"
          data-testid="learner-exam-date-error"
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
          data-testid="learner-exam-date-saved"
          className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary"
        >
          <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
          <span>保存しました ({stage.date})。ホームに戻ります。</span>
        </div>
      ) : null}

      {stage.kind === "confirm_overwrite" ? (
        <div
          role="alertdialog"
          aria-labelledby="learner-overwrite-confirm-title"
          data-testid="learner-exam-date-overwrite"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <p
            id="learner-overwrite-confirm-title"
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
              data-testid="learner-exam-date-confirm-overwrite"
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

      <div className="flex flex-wrap gap-3">
        {stage.kind !== "confirm_overwrite" ? (
          <Button
            type="submit"
            size="lg"
            disabled={
              !date ||
              stage.kind === "saving" ||
              stage.kind === "saved" ||
              stage.kind === "error"
            }
            data-testid="learner-exam-date-submit"
            className="min-h-tap-cta"
          >
            {stage.kind === "saving" ? "保存中..." : "保存する"}
          </Button>
        ) : null}
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => {
            startTransition(() => {
              router.replace("/home");
            });
          }}
          disabled={stage.kind === "saving"}
          className="min-h-tap-cta"
        >
          ホームに戻る
        </Button>
      </div>
    </form>
  );
}

function formatToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function messageForReason(reason: string): string {
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
