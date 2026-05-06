"use client";

/**
 * Learner Nickname Form (DEC-090 項目 3 / 設定画面拡張)
 *
 * 親が learner の nickname のみを inline edit できる form (study-target / exam-date と並ぶ
 * 3 枚カード stack の 1 枚目).
 *
 * 既存 mutation 流用 (mutation +0):
 *   - `updateLearnerProfile(learnerId, { nickname })` (既存 top-level Server Action)
 *   - reauth_required の場合は ParentReauthDialog を open (既存 account-form.tsx 同パターン)
 *
 * 設計原則:
 *   - 罰則ゼロ哲学 (DEC-024): 「変更しました」中立 toast / 喪失語ゼロ.
 *   - tap target ≥ 44px / aria-label / role="alert" / autoComplete="off".
 *   - 「ですます調」親向け.
 *
 * 既存 settings-smoke / account E2E selector を保護するため, account-form.tsx と
 * data-testid は分離 (`learner-nickname-*` prefix).
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

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
import { ParentReauthDialog } from "@/components/auth/parent-reauth-dialog";
import { updateLearnerProfile } from "@/lib/actions/learner-settings";

interface Props {
  learnerId: string;
  initialNickname: string;
}

export function LearnerNicknameForm({ learnerId, initialNickname }: Props) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pendingRef = useRef<string | null>(null);

  const trimmedChanged = (): string | null => {
    const t = nickname.trim();
    if (!t) return null;
    if (t === initialNickname) return null;
    return t;
  };

  async function callMutation(newNickname: string): Promise<void> {
    setError(null);
    setSuccess(null);
    const result = await updateLearnerProfile(learnerId, {
      nickname: newNickname,
    });
    if (result.ok) {
      setSuccess("変更しました");
      pendingRef.current = null;
      router.refresh();
      return;
    }
    if (result.reason === "reauth_required") {
      pendingRef.current = newNickname;
      setReauthOpen(true);
      return;
    }
    setError(
      result.message ?? "保存に失敗しました。時間をおいて再度お試しください。",
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const t = trimmedChanged();
    if (!t) {
      setSuccess("変更はありません");
      setError(null);
      return;
    }
    startTransition(async () => {
      await callMutation(t);
    });
  }

  function handleReauthSuccess(): void {
    const t = pendingRef.current;
    if (!t) return;
    startTransition(async () => {
      await callMutation(t);
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ニックネーム</CardTitle>
          <CardDescription>
            ホーム画面などに表示されます。1 - 20 文字。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            data-testid="learner-nickname-form"
          >
            <div className="space-y-2">
              <Label htmlFor="learner-nickname-input">ニックネーム</Label>
              <Input
                id="learner-nickname-input"
                name="nickname"
                type="text"
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                data-testid="learner-nickname-input"
                autoComplete="off"
                required
                disabled={isPending}
              />
            </div>

            {error ? (
              <p
                role="alert"
                data-testid="learner-nickname-error"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            {success ? (
              <p
                role="status"
                data-testid="learner-nickname-success"
                className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary"
              >
                <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                {success}
              </p>
            ) : null}

            <Button
              type="submit"
              data-testid="learner-nickname-submit"
              disabled={isPending}
              className="min-h-tap-cta"
            >
              {isPending ? "保存中..." : "変更"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ParentReauthDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        onSuccess={handleReauthSuccess}
        description="ニックネームの変更には、親のパスワード再入力が必要です。一度確認すると 5 分間有効です。"
      />
    </>
  );
}
