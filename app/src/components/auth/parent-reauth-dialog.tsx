"use client";

/**
 * HANEI - Parent Reauth Dialog (W12-T1 / Phase 3 第 1 波 / T3 統合 / DEC-074)
 *
 * 親の sensitive 操作 (account / nickname / 学年 / 退会等) 前に、直近 5 分以内に
 * パスワード再確認 (reauth) を完了するための Modal Dialog.
 *
 * UX:
 *   - 親が account 編集を試みる → mutation が `{ ok: false, reason: 'reauth_required' }` を返す
 *   - account page 側がこの dialog を open
 *   - 親がパスワードを入力 → submit → verifyParentPasswordAndStartGrace
 *   - 成功 → 5 分間 grace cookie set / dialog close / mutation を再試行 (props onSuccess)
 *   - 失敗 → 丁寧なエラーメッセージで再入力を促す (罰語ゼロ)
 *
 * 設計原則 (PAT-007 / 子供向け UI 絵文字ゼロ哲学):
 *   - 絵文字ゼロ. アイコンは Heroicons.
 *   - shadcn/ui Dialog + Input + Label + Button のみ.
 *   - tap target ≥ 44px / aria-label / role / autoFocus 完備.
 */

import { useState, useTransition } from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { verifyParentPasswordAndStartGrace } from "@/lib/actions/parent-reauth";

interface ParentReauthDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** reauth 成功時の callback (再 mutation 等を呼ぶ) */
  onSuccess?: () => void;
  /** Description override (画面ごとに文言を変えたい場合) */
  description?: string;
}

export function ParentReauthDialog({
  open,
  onOpenChange,
  onSuccess,
  description,
}: ParentReauthDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!password) {
      setError("パスワードを入力してください");
      return;
    }
    setError(null);

    const fd = new FormData();
    fd.set("password", password);

    startTransition(async () => {
      try {
        const result = await verifyParentPasswordAndStartGrace(fd);
        if (result.ok) {
          setPassword("");
          onOpenChange(false);
          onSuccess?.();
          return;
        }
        if (result.reason === "invalid_password") {
          setError("パスワードが正しくありません。もう一度お試しください。");
        } else if (result.reason === "missing_password") {
          setError("パスワードを入力してください");
        } else {
          setError(
            "再認証に失敗しました。時間をおいて再度お試しください。",
          );
        }
      } catch {
        setError("再認証に失敗しました。時間をおいて再度お試しください。");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setPassword("");
          setError(null);
        }
      }}
    >
      <DialogContent data-testid="parent-reauth-dialog">
        <DialogHeader>
          <div className="mb-2 inline-flex items-center gap-2">
            <LockClosedIcon
              className="h-5 w-5 text-primary"
              aria-hidden="true"
            />
            <DialogTitle>親のパスワード再確認</DialogTitle>
          </div>
          <DialogDescription>
            {description ??
              "セキュリティのため、設定を変更する前に親のパスワードを再入力してください。一度確認すると 5 分間有効です。"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="parent-reauth-password">パスワード</Label>
            <Input
              id="parent-reauth-password"
              type="password"
              name="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="parent-reauth-password-input"
              disabled={isPending}
            />
          </div>

          {error ? (
            <p
              role="alert"
              data-testid="parent-reauth-error"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              data-testid="parent-reauth-submit"
              disabled={isPending || password.length === 0}
            >
              {isPending ? "確認中..." : "確認する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
