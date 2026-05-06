"use client";

/**
 * Learner Study Target Form (DEC-090 項目 3 / 設定画面拡張)
 *
 * 親が learner の 1 日の学習時間目標 (分) を inline edit できる form
 * (3 枚カード stack の 2 枚目).
 *
 * 既存 mutation 流用 (mutation +0):
 *   - `updateLearnerStudyTarget(learnerId, { dailyMinutesTarget })` (既存 top-level Server Action #9)
 *   - reauth_required の場合は ParentReauthDialog を open (既存 notifications-form.tsx 同パターン)
 *
 * 設計原則:
 *   - 罰則ゼロ哲学 (DEC-024): 「変更しました」中立 toast / 喪失語ゼロ.
 *   - tap target ≥ 44px / aria-label / 0-180 分整数 入力範囲 (既存 schema 準拠).
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
import { updateLearnerStudyTarget } from "@/lib/actions/learner-study-target";

interface Props {
  learnerId: string;
  initialDailyMinutesTarget: number;
}

export function LearnerStudyTargetForm({
  learnerId,
  initialDailyMinutesTarget,
}: Props) {
  const router = useRouter();
  const [minutes, setMinutes] = useState<number>(initialDailyMinutesTarget);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pendingRef = useRef<number | null>(null);

  async function callMutation(newMinutes: number): Promise<void> {
    setError(null);
    setSuccess(null);
    const result = await updateLearnerStudyTarget(learnerId, {
      dailyMinutesTarget: newMinutes,
    });
    if (result.ok) {
      setSuccess("変更しました");
      pendingRef.current = null;
      router.refresh();
      return;
    }
    if (result.reason === "reauth_required") {
      pendingRef.current = newMinutes;
      setReauthOpen(true);
      return;
    }
    setError(
      result.message ?? "保存に失敗しました。時間をおいて再度お試しください。",
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 180) {
      setError("0 - 180 分の範囲で入力してください。");
      return;
    }
    if (Math.floor(minutes) === initialDailyMinutesTarget) {
      setSuccess("変更はありません");
      setError(null);
      return;
    }
    startTransition(async () => {
      await callMutation(Math.floor(minutes));
    });
  }

  function handleReauthSuccess(): void {
    const m = pendingRef.current;
    if (m == null) return;
    startTransition(async () => {
      await callMutation(m);
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">学習目標</CardTitle>
          <CardDescription>
            1 日に学ぶ時間の目標を 分 で設定します。0 - 180 分。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            data-testid="learner-study-target-form"
          >
            <div className="space-y-2">
              <Label htmlFor="learner-study-target-input">
                1 日の学習時間 (分)
              </Label>
              <Input
                id="learner-study-target-input"
                name="dailyMinutesTarget"
                type="number"
                min={0}
                max={180}
                step={1}
                value={Number.isFinite(minutes) ? minutes : 0}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setMinutes(Number.isFinite(n) ? n : 0);
                }}
                data-testid="learner-study-target-input"
                disabled={isPending}
                aria-invalid={error ? "true" : "false"}
                inputMode="numeric"
              />
            </div>

            {error ? (
              <p
                role="alert"
                data-testid="learner-study-target-error"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            {success ? (
              <p
                role="status"
                data-testid="learner-study-target-success"
                className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary"
              >
                <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                {success}
              </p>
            ) : null}

            <Button
              type="submit"
              data-testid="learner-study-target-submit"
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
        description="学習目標の変更には、親のパスワード再入力が必要です。一度確認すると 5 分間有効です。"
      />
    </>
  );
}
