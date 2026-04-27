"use client";

/**
 * Exam Date Dialog (W4 / T-2)
 *
 * 受験日設定モーダル。
 *
 * 仕様:
 *  - shadcn Dialog (W3 で導入済)
 *  - <input type="date"> を採用 (Calendar component 追加せず依存最小化 / shadcn Calendar
 *    導入は OS 標準ピッカーが今日以降フィルタ + キーボード対応十分なため Phase 1 では
 *    不採用。W5 以降 Designer 連動で再検討)
 *  - クライアント側で「過去日不可」+「level 必須」をバリデーション
 *  - 既存日付があり overwrite_required が返ってきたら確認ダイアログ → 再送信
 *  - 成功時はインライン div で「保存しました」表示 (Sonner 等の追加依存なし)
 */

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateExamDate } from "@/lib/actions/exam-date";
import {
  validateExamDate,
  type ExamLevel,
  type UpdateExamDateResult,
} from "@/lib/actions/exam-date-validation";

interface ExamDateDialogProps {
  learnerId: string;
  learnerName: string;
  /** 初期値 (現在登録されている受験日) */
  initialLevel?: ExamLevel;
  initialDate?: string;
}

type Stage =
  | { kind: "idle" }
  | { kind: "validating"; level: ExamLevel; date: string }
  | { kind: "confirm_overwrite"; level: ExamLevel; date: string; existingDate: string }
  | { kind: "saving" }
  | { kind: "saved"; date: string }
  | { kind: "error"; message: string };

export function ExamDateDialog({
  learnerId,
  learnerName,
  initialLevel,
  initialDate,
}: ExamDateDialogProps) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<ExamLevel>(initialLevel ?? "5");
  const [date, setDate] = useState(initialDate ?? "");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [, startTransition] = useTransition();

  // input[type=date] の min は今日 (YYYY-MM-DD)
  const today = formatToday();

  function reset(): void {
    setStage({ kind: "idle" });
  }

  async function handleSubmit(allowOverwrite: boolean): Promise<void> {
    // クライアント側 1 次バリデーション
    const v = validateExamDate(date);
    if (!v.ok) {
      setStage({
        kind: "error",
        message:
          v.reason === "past_date_not_allowed"
            ? "過去の日付は登録できません。今日以降の日付を選択してください。"
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
      // 1.5 秒後に閉じる
      setTimeout(() => {
        setOpen(false);
        reset();
        startTransition(() => {
          // SSR 再読み込みのため軽く router refresh 相当を促す。Next.js App Router の
          // router.refresh() を呼ぶには useRouter が必要だが、Server Action 側で
          // revalidate しないため、ここでは Dialog を閉じるのみ → ユーザーがリロード or
          // 親の useEffect 等で取得し直す前提とする (W4 段階で十分)。
        });
      }, 1500);
      return;
    }

    if (result.reason === "overwrite_required") {
      setStage({
        kind: "confirm_overwrite",
        level,
        date,
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          受験日を設定する
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>受験日の設定</DialogTitle>
          <DialogDescription>
            {learnerName}さんが目標とする英検の級と受験日をご登録ください。
            登録した日付はダッシュボードのカウントダウンに反映されます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exam-level">受検級</Label>
            <select
              id="exam-level"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={level}
              onChange={(e) => setLevel(e.target.value as ExamLevel)}
              disabled={stage.kind === "saving"}
            >
              <option value="5">英検 5 級</option>
              <option value="4">英検 4 級</option>
              <option value="3">英検 3 級</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exam-date">受験日</Label>
            <Input
              id="exam-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={stage.kind === "saving"}
            />
            <p className="text-xs text-muted-foreground">
              本日以降の日付のみ登録できます。
            </p>
          </div>

          {stage.kind === "error" ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {stage.message}
            </div>
          ) : null}

          {stage.kind === "saved" ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary"
            >
              保存しました ({stage.date})
            </div>
          ) : null}

          {stage.kind === "confirm_overwrite" ? (
            <div
              role="alertdialog"
              aria-labelledby="overwrite-confirm-title"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            >
              <p id="overwrite-confirm-title" className="font-medium">
                既に登録された日付があります。
              </p>
              <p className="mt-1 text-muted-foreground">
                現在: {stage.existingDate} → 新規: {stage.date}
                <br />
                上書きしてよろしいですか?
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSubmit(true)}
                >
                  上書きして保存
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={reset}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {stage.kind !== "confirm_overwrite" ? (
            <Button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={!date || stage.kind === "saving" || stage.kind === "saved"}
            >
              {stage.kind === "saving" ? "保存中..." : "保存する"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      return "過去の日付は登録できません。今日以降の日付を選択してください。";
    case "invalid_level":
      return "級の指定が正しくありません。";
    case "learner_not_owned":
      return "この学習者にはアクセスできません。";
    default:
      return "保存に失敗しました。時間をおいて再度お試しください。";
  }
}
