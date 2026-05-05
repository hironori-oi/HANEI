"use client";

/**
 * Account Settings Form (W12-T1 / Phase 3 第 1 波 / DEC-074)
 *
 * 親が学習者の表示名 / 学年 (英検目標級) を編集する Client Component.
 *
 * 連携フロー:
 *   - submit → updateLearnerProfile (top-level Server Action #2)
 *   - reauth_required の場合 → ParentReauthDialog を open
 *   - dialog 成功 → 自動的に再度 updateLearnerProfile を呼ぶ (リトライ)
 *   - 成功 → success message 表示 + router.refresh()
 *
 * 設計原則:
 *   - 絵文字ゼロ / Heroicons / 罰語ゼロ (DEC-024)
 *   - tap target ≥ 44px / aria-label / role="alert" / autoComplete 付き
 *   - 「ですます調」親向け
 */

import { useState, useTransition, useRef } from "react";
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

interface AccountSettingsFormProps {
  learnerId: string;
  initialNickname: string;
  initialTargetLevel: "5" | "4" | "3";
}

const LEVEL_LABELS: Record<"5" | "4" | "3", string> = {
  "5": "英検 5 級",
  "4": "英検 4 級",
  "3": "英検 3 級",
};

export function AccountSettingsForm({
  learnerId,
  initialNickname,
  initialTargetLevel,
}: AccountSettingsFormProps) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [targetLevel, setTargetLevel] = useState<"5" | "4" | "3">(
    initialTargetLevel,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // pending mutation を保持して reauth 成功時にリトライする
  const pendingPatchRef = useRef<{
    nickname?: string;
    targetEikenLevel?: "5" | "4" | "3";
  } | null>(null);

  function buildPatch(): {
    nickname?: string;
    targetEikenLevel?: "5" | "4" | "3";
  } {
    const patch: {
      nickname?: string;
      targetEikenLevel?: "5" | "4" | "3";
    } = {};
    const trimmed = nickname.trim();
    if (trimmed && trimmed !== initialNickname) {
      patch.nickname = trimmed;
    }
    if (targetLevel !== initialTargetLevel) {
      patch.targetEikenLevel = targetLevel;
    }
    return patch;
  }

  async function callMutation(patch: {
    nickname?: string;
    targetEikenLevel?: "5" | "4" | "3";
  }): Promise<void> {
    setError(null);
    setSuccess(null);

    if (!patch.nickname && !patch.targetEikenLevel) {
      setSuccess("変更はありません");
      return;
    }

    const result = await updateLearnerProfile(learnerId, patch);
    if (result.ok) {
      setSuccess("変更を保存しました");
      pendingPatchRef.current = null;
      router.refresh();
      return;
    }
    if (result.reason === "reauth_required") {
      pendingPatchRef.current = patch;
      setReauthOpen(true);
      return;
    }
    setError(
      result.message ?? "保存に失敗しました。時間をおいて再度お試しください。",
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const patch = buildPatch();
    startTransition(async () => {
      await callMutation(patch);
    });
  }

  function handleReauthSuccess(): void {
    const patch = pendingPatchRef.current;
    if (!patch) return;
    startTransition(async () => {
      await callMutation(patch);
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">プロフィール</CardTitle>
          <CardDescription>
            変更後、保存ボタンを押すと反映されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            data-testid="account-form"
          >
            <div className="space-y-2">
              <Label htmlFor="nickname">表示名</Label>
              <Input
                id="nickname"
                name="nickname"
                type="text"
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                data-testid="account-nickname-input"
                autoComplete="off"
                required
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                1 - 20 文字。ホーム画面などに表示されます。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetEikenLevel">学年 (目標とする 英検の級)</Label>
              <select
                id="targetEikenLevel"
                name="targetEikenLevel"
                value={targetLevel}
                onChange={(e) =>
                  setTargetLevel(e.target.value as "5" | "4" | "3")
                }
                data-testid="account-level-select"
                disabled={isPending}
                className="min-h-tap-cta flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {(["5", "4", "3"] as const).map((lv) => (
                  <option key={lv} value={lv}>
                    {LEVEL_LABELS[lv]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                出題される問題の難易度に影響します。
              </p>
            </div>

            {error ? (
              <p
                role="alert"
                data-testid="account-error"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            {success ? (
              <p
                role="status"
                data-testid="account-success"
                className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary"
              >
                <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                {success}
              </p>
            ) : null}

            <Button
              type="submit"
              data-testid="account-submit"
              disabled={isPending}
            >
              {isPending ? "保存中..." : "保存する"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ParentReauthDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        onSuccess={handleReauthSuccess}
        description="アカウント情報の変更には、親のパスワード再入力が必要です。一度確認すると 5 分間有効です。"
      />
    </>
  );
}
