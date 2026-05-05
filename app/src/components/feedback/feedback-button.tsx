"use client";

/**
 * HANEI - β feedback 収集動線 ボタン + Dialog (W12-T3-B / DEC-070)
 *
 * 親 (parent role) UI 上に小さく配置される「ご意見を送る」ボタン.
 * クリックで shadcn `Dialog` を開き、textarea 入力 + Sentry.captureFeedback で送信.
 *
 * 設計指針:
 *  - DEC-024 罰則ゼロ: 文言全て中立 (「不具合」「クレーム」「失敗」等の罰語禁止)
 *    - ボタン: 「ご意見を送る」
 *    - dialog title: 「ご意見・気になったこと」
 *    - submit: 「送信する」
 *    - cancel: 「閉じる」
 *    - thanks: 「ご意見を送信しました。ありがとうございます。」
 *    - error: 「送信できませんでした。少し時間を置いて再度お試しください。」
 *  - DEC-006 不変: 新規 mutation 0 / 新規 server action 0 / Sentry SDK は外部送信.
 *  - DEC-055 idempotency: submitting state で二重送信抑止.
 *  - DEC-070 §1 受容性: textarea required / 1000 文字 max / `data-testid` 4 種付与.
 *
 * Sentry SDK:
 *  - DSN 未設定環境では `enabled: Boolean(dsn)` で SDK 内部的に no-op 化される
 *    ため、E2E (DSN 未設定) でも本物の Sentry.captureFeedback を呼んで OK
 *    (envelope は飛ばない / 例外も throw しない).
 *
 * 絵文字禁止 (CLAUDE.md): Heroicons (ChatBubbleLeftRightIcon) のみ使用.
 */

import { useState, useId } from "react";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";

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
import {
  FEEDBACK_MAX_LENGTH,
  submitFeedback,
  validateFeedbackMessage,
} from "@/lib/feedback/submit";

interface FeedbackButtonProps {
  /** 親の表示名 (Sentry に optional ヒントとして渡す / 任意) */
  userName?: string;
  /** 親のメール (Sentry プロジェクト UI で返信運用するため / 任意) */
  userEmail?: string;
}

export function FeedbackButton({
  userName,
  userEmail,
}: FeedbackButtonProps): React.JSX.Element {
  const textareaId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function resetState(): void {
    setText("");
    setSubmitting(false);
    setDone(false);
    setErrorMsg(null);
  }

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) {
      // dialog close で state 完全 reset (cancel / X ボタン / 背景クリック / Esc 共通)
      resetState();
    }
  }

  function handleSubmit(): void {
    setErrorMsg(null);
    const validated = validateFeedbackMessage(text);
    if (!validated.ok) {
      // textarea required + maxLength で UI 側もガードしているが多層防御.
      // 中立文言で通知 (DEC-024 罰則ゼロ).
      if (validated.reason === "empty") {
        setErrorMsg("ご意見をご入力ください。");
      } else {
        setErrorMsg(
          `${FEEDBACK_MAX_LENGTH} 文字以内でご入力ください。`,
        );
      }
      return;
    }

    setSubmitting(true);
    try {
      // Sentry.captureFeedback は同期 (sentry/core feedback.js / scope.captureEvent
      // 経由 = Promise ではない). DSN 未設定時は SDK 内で no-op 化される.
      submitFeedback({
        message: validated.message,
        name: userName,
        email: userEmail,
      });
      setDone(true);
    } catch (err) {
      // Sentry SDK が throw する経路は通常無いが多層防御 (DEC-024 罰則ゼロ文言).
      console.error("[feedback-button] submitFeedback failed", err);
      setErrorMsg(
        "送信できませんでした。少し時間を置いて再度お試しください。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-2"
          data-testid="beta-feedback-button"
        >
          <ChatBubbleLeftRightIcon
            className="h-4 w-4"
            aria-hidden="true"
          />
          <span>ご意見を送る</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        data-testid="beta-feedback-dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>ご意見・気になったこと</DialogTitle>
          <DialogDescription>
            HANEI を よりよく するために、お気づきの点を お聞かせください。
            返信が 必要な場合は、ご登録の メールアドレスへ ご連絡することがあります。
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div
            data-testid="beta-feedback-thanks"
            className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-foreground"
            role="status"
            aria-live="polite"
          >
            ご意見を送信しました。ありがとうございます。
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-3"
          >
            <label
              htmlFor={textareaId}
              className="block text-sm font-medium text-foreground"
            >
              ご意見・気になったこと
            </label>
            <textarea
              id={textareaId}
              data-testid="beta-feedback-textarea"
              required
              maxLength={FEEDBACK_MAX_LENGTH}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={submitting}
              rows={5}
              className="block w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="例) 〇〇の画面で 〇〇が 気になりました"
            />
            <p
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              {text.length} / {FEEDBACK_MAX_LENGTH} 文字
            </p>

            {errorMsg ? (
              <p
                role="alert"
                className="text-sm text-destructive"
                data-testid="beta-feedback-error"
              >
                {errorMsg}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                閉じる
              </Button>
              <Button
                type="submit"
                disabled={submitting || text.trim().length === 0}
                data-testid="beta-feedback-submit"
              >
                {submitting ? "送信中..." : "送信する"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
