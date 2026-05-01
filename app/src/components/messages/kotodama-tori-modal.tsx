"use client";

/**
 * HANEI - Kotodama-tori 代読 Modal (W11-T2 / DEC-062)
 *
 * 学習者が /home を訪れたとき、未読の親メッセージが 1 件以上あれば
 * **kotodama-tori が代読する push 型 modal** として最古の 1 件を表示する.
 *
 * 設計指針 (DEC-062 §4):
 *   - 子供向け (小学生 K-1 / K-2 準拠 / 平仮名中心 / 56px tap area)
 *   - 背景クリックで誤閉じ抑制 (W10-T5 / W11-T1 と同パターン)
 *   - Esc は受け付けない (子供が偶発的に閉じない設計)
 *   - 「ありがとう」button で markMessageRead → close. 失敗時はモダル維持.
 *   - 学習者が未読のまま離脱 → 次回 /home 訪問でも同じ最古未読が再 push される
 *     (= server side で最古未読 1 件を pick / read_at IS NULL の間は毎回 push).
 *
 * 絵文字禁止 (CLAUDE.md): Heroicons + ことだまトリ既存 SVG のみ使用.
 *
 * 認可: markMessageRead 内部で requireAuth + requireParent + family scope を
 *       SQL レベルで再確認するため、本 client component は認可情報を持たない.
 */

import { useState, useTransition } from "react";
import { HeartIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KotodamaWakatoriSvg } from "@/components/character/kotodama-stages/wakatori";

interface Props {
  /** 既読対象 messageId (markMessageRead の引数) */
  messageId: string;
  /** 表示する親メッセージ本文 (placeholder 解決済) */
  body: string;
  /** 受信者 learner の nickname (代読対象) */
  learnerNickname: string;
  /** 送信者 (親) の表示名 */
  fromName: string;
  /** Server Action: messageId を form-data 経由で渡す既読更新 action */
  markReadAction: (formData: FormData) => Promise<void>;
}

export function KotodamaToriModal({
  messageId,
  body,
  learnerNickname,
  fromName,
  markReadAction,
}: Props) {
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleConfirm(formData: FormData): void {
    startTransition(async () => {
      try {
        await markReadAction(formData);
      } finally {
        // markReadAction 内部の Server Action は idempotent (already_read OK).
        // 失敗してもユーザ操作はブロックしないが、ネットワーク完全失敗時は
        // 次回 /home でまた同じ未読が再 push される (= 安全側)
        setOpen(false);
      }
    });
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    // DEC-062 / W10-T5 / W11-T1: 背景クリックで誤閉じしない.
    // currentTarget === target でも close しない (= 明示的「ありがとう」のみ閉じる)
    if (e.target === e.currentTarget) {
      // 何もしない (誤閉じ抑制)
      return;
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`family-message-modal-title-${messageId}`}
      data-testid="family-message-modal"
      data-message-id={messageId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl",
          "ring-2 ring-primary/30",
        )}
        // 内側クリックは伝播しても背景判定に影響なし (= 上の if で除外)
      >
        {/* ことだまトリ (代読アイコン) */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30">
            <KotodamaWakatoriSvg
              size={120}
              label="ことだまトリ が だいどく しています"
            />
          </div>

          <h2
            id={`family-message-modal-title-${messageId}`}
            className="text-center text-base font-bold leading-relaxed text-foreground"
          >
            {learnerNickname} さんに、{fromName} から メッセージだよ
          </h2>
        </div>

        {/* 本文 (whitespace-pre-line で改行保持) */}
        <p
          className="mt-4 whitespace-pre-line break-words rounded-md border border-dashed border-border bg-muted/30 p-4 text-base leading-relaxed text-foreground"
          data-testid="family-message-body"
        >
          {body}
        </p>

        {/* ありがとう button (56px tap area / K-1 準拠) */}
        <form action={handleConfirm} className="mt-5 flex justify-center">
          <input type="hidden" name="messageId" value={messageId} />
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            data-testid="family-message-thanks-btn"
            className="min-h-tap-cta px-8"
          >
            <HeartIcon className="mr-2 h-5 w-5" aria-hidden="true" />
            ありがとう
          </Button>
        </form>
      </div>
    </div>
  );
}
