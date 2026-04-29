"use client";

/**
 * HANEI - Template Picker (W9-D / /parent/messages/new)
 *
 * 30 種テンプレを 5 カテゴリ tab で表示し、選択した 1 件を
 * preview pane に出してから送信できる Client Component。
 *
 *  - tabs: 5 カテゴリ (encourage_start / celebrate / encourage_struggle / check_in / exam_countdown)
 *  - 各 tab の中身は 6 種テンプレを縦リスト
 *  - 選択中テンプレは ring + body プレビュー (placeholder は機械可読のまま表示)
 *  - 「カスタムせずに送る」ボタンで Server Action を form post (templateCode + toLearnerId)
 *  - 「文章をカスタムする」リンクは body を textarea に転写して別 form (sendCustomMessage) で送信
 *
 * 絵文字禁止 / Heroicons / Amber Gold tone。
 */

import { useState, useTransition } from "react";
import {
  HeartIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_ORDER,
  CATEGORY_LABEL_JA,
  MESSAGE_TEMPLATES,
  type MessageCategory,
  type MessageTemplateDef,
} from "@/lib/messages/template-catalog";

interface Props {
  /** 送信先 learner ID (closure-bound action 側で再検証される) */
  toLearnerId: string;
  /** Server Action: { templateCode, toLearnerId } を取って送信 */
  sendTemplateAction: (formData: FormData) => Promise<void>;
  /** Server Action: { body, toLearnerId } を取って送信 (custom) */
  sendCustomAction: (formData: FormData) => Promise<void>;
  /** body 最大長 (BODY_MAX = 200) */
  bodyMax?: number;
}

export function TemplatePicker({
  toLearnerId,
  sendTemplateAction,
  sendCustomAction,
  bodyMax = 200,
}: Props) {
  const [activeCategory, setActiveCategory] =
    useState<MessageCategory>("encourage_start");
  const [selected, setSelected] = useState<MessageTemplateDef | null>(null);
  const [customBody, setCustomBody] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);
  const [isPending, startTransition] = useTransition();

  const templatesInCategory: ReadonlyArray<MessageTemplateDef> =
    MESSAGE_TEMPLATES.filter((t) => t.category === activeCategory);

  function handleSelect(t: MessageTemplateDef) {
    setSelected(t);
    setCustomBody(t.body);
    setIsCustom(false);
  }

  function handleStartCustom() {
    setIsCustom(true);
  }

  return (
    <div className="space-y-6" data-testid="template-picker">
      {/* カテゴリ tabs */}
      <div
        role="tablist"
        aria-label="メッセージカテゴリ"
        className="flex flex-wrap gap-2"
      >
        {CATEGORY_ORDER.map((cat) => {
          const label = CATEGORY_LABEL_JA[cat]?.label ?? cat;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              role="tab"
              aria-selected={isActive}
              data-testid={`category-tab-${cat}`}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-bold transition",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow"
                  : "border-border bg-card text-foreground hover:border-primary/50",
              )}
              onClick={() => setActiveCategory(cat)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* テンプレ リスト */}
      <ul
        className="grid gap-2 sm:grid-cols-2"
        data-testid={`template-list-${activeCategory}`}
      >
        {templatesInCategory.map((t) => {
          const isSel = selected?.code === t.code;
          return (
            <li key={t.code}>
              <button
                type="button"
                onClick={() => handleSelect(t)}
                data-testid={`template-${t.code}`}
                className={cn(
                  "w-full rounded-lg border p-3 text-left text-sm leading-relaxed transition",
                  isSel
                    ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                <span className="mr-2 inline-flex items-center justify-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                  {t.code}
                </span>
                {t.body}
              </button>
            </li>
          );
        })}
      </ul>

      {/* プレビュー + 送信 */}
      {selected ? (
        <Card className="space-y-3 p-4" data-testid="template-preview">
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <SparklesIcon className="h-5 w-5" aria-hidden="true" />
            プレビュー (
            {CATEGORY_LABEL_JA[selected.category]?.label ?? selected.category})
          </div>

          {/* 編集 / 既定切替 */}
          {!isCustom ? (
            <p className="whitespace-pre-wrap break-words rounded-md border border-dashed border-border bg-muted/30 p-3 text-base leading-relaxed text-foreground">
              {selected.body}
            </p>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor="custom-body-field"
                className="text-xs font-bold text-foreground"
              >
                送信する 文章 (placeholder は そのまま 残せます)
              </label>
              <textarea
                id="custom-body-field"
                data-testid="custom-body-textarea"
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value.slice(0, bodyMax))}
                rows={4}
                maxLength={bodyMax}
                className="w-full resize-y rounded-md border border-border bg-background p-3 text-base leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p
                className="text-right text-[11px] tabular-nums text-muted-foreground"
                aria-live="polite"
              >
                {customBody.length} / {bodyMax}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {!isCustom ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleStartCustom}
                data-testid="start-custom-btn"
              >
                <PencilSquareIcon
                  className="mr-1 h-4 w-4"
                  aria-hidden="true"
                />
                文章を カスタムする
              </Button>
            ) : null}

            {!isCustom ? (
              <form
                action={(fd) => {
                  startTransition(() => {
                    sendTemplateAction(fd);
                  });
                }}
              >
                <input
                  type="hidden"
                  name="templateCode"
                  value={selected.code}
                />
                <input
                  type="hidden"
                  name="toLearnerId"
                  value={toLearnerId}
                />
                <Button
                  type="submit"
                  size="default"
                  variant="default"
                  disabled={isPending}
                  data-testid="send-template-btn"
                  className="min-h-tap-cta"
                >
                  <PaperAirplaneIcon
                    className="mr-1 h-4 w-4"
                    aria-hidden="true"
                  />
                  そのまま 送る
                </Button>
              </form>
            ) : (
              <form
                action={(fd) => {
                  startTransition(() => {
                    sendCustomAction(fd);
                  });
                }}
              >
                <input type="hidden" name="body" value={customBody} />
                <input
                  type="hidden"
                  name="toLearnerId"
                  value={toLearnerId}
                />
                <Button
                  type="submit"
                  size="default"
                  variant="default"
                  disabled={
                    isPending ||
                    customBody.length < 1 ||
                    customBody.length > bodyMax
                  }
                  data-testid="send-custom-btn"
                  className="min-h-tap-cta"
                >
                  <HeartIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                  カスタム 文章を 送る
                </Button>
              </form>
            )}
          </div>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          うえの リストから ひとつ えらんでください。
        </p>
      )}
    </div>
  );
}
