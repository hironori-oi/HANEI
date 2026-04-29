/**
 * HANEI - Parent Message Card (W9-D / /messages 受信箱)
 *
 * 親→子メッセージ 1 件を表示する Server Component。
 *  - 未読 → カラー + 未読バッジ + 「読みました」ボタン (Server Action)
 *  - 既読 → やや薄め + 取得日表示
 *
 * 絵文字禁止 / Heroicons + 和の色 (Amber Gold rim) / ふりがな表記対応。
 */

import { EnvelopeIcon, EnvelopeOpenIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABEL_JA,
  type MessageCategory,
} from "@/lib/messages/template-catalog";

export interface ParentMessageCardProps {
  id: string;
  body: string;
  category: MessageCategory | null;
  /** 受信日時 (Date or unix sec) */
  createdAt: Date | number;
  /** 既読日時 (null なら未読) */
  readAt: Date | number | null;
  /** 既読更新 form action (markMessageRead を呼ぶ Server Action) */
  markReadAction?: (formData: FormData) => Promise<void>;
  className?: string;
}

function formatJaDateTime(input: Date | number): string {
  const ms =
    input instanceof Date
      ? input.getTime()
      : Number(input) > 1e12
        ? Number(input)
        : Number(input) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export function ParentMessageCard({
  id,
  body,
  category,
  createdAt,
  readAt,
  markReadAction,
  className,
}: ParentMessageCardProps) {
  const isUnread = readAt === null || readAt === undefined;
  const Icon = isUnread ? EnvelopeIcon : EnvelopeOpenIcon;
  const categoryLabel = category ? CATEGORY_LABEL_JA[category]?.label : null;

  return (
    <Card
      data-testid={`parent-message-${id}`}
      data-unread={isUnread ? "true" : "false"}
      className={cn(
        "relative flex flex-col gap-3 p-4",
        isUnread
          ? "ring-2 ring-primary/60 bg-primary/5"
          : "bg-card/80",
        className,
      )}
    >
      {/* 未読バッジ */}
      {isUnread && (
        <span
          className="absolute -right-1 -top-1 inline-flex h-5 items-center rounded-full bg-primary px-2 text-[10px] font-bold text-primary-foreground shadow"
          aria-label="未読"
        >
          NEW
        </span>
      )}

      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "h-6 w-6 shrink-0",
            isUnread ? "text-primary" : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
        <div className="flex-1 space-y-1">
          {categoryLabel && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {categoryLabel}
            </p>
          )}
          <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">
            {body}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {formatJaDateTime(createdAt)} に とどきました
            {!isUnread && readAt ? (
              <span className="ml-2">/ {formatJaDateTime(readAt)} 既読</span>
            ) : null}
          </p>
        </div>
      </div>

      {isUnread && markReadAction ? (
        <form action={markReadAction} className="self-end">
          <input type="hidden" name="messageId" value={id} />
          <Button
            type="submit"
            size="sm"
            variant="default"
            data-testid={`mark-read-${id}`}
          >
            読みました
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
