"use client";

/**
 * Notifications Form (W12-T1 / Phase 3 第 1 波 / DEC-074 + W12-T4 / DEC-078 拡張)
 *
 * 親が学習者の通知 / リマインド / 学習時間目標を編集する Client Component.
 *
 * 連携フロー:
 *   - submit / toggle → updateLearnerSettings (top-level Server Action #1, reauth 不要)
 *   - 学習時間目標 section の submit → updateLearnerStudyTarget (top-level Server Action #9, reauth 必須)
 *   - reauth_required の場合 → ParentReauthDialog を open → 成功で自動リトライ
 *
 * 設計原則:
 *   - 絵文字ゼロ / Heroicons / 罰語ゼロ (DEC-024)
 *   - tap target ≥ 44px / role="switch" / aria-checked
 */

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParentReauthDialog } from "@/components/auth/parent-reauth-dialog";
import { updateLearnerSettings } from "@/lib/actions/learner-settings";
import { updateLearnerStudyTarget } from "@/lib/actions/learner-study-target";

interface NotificationsFormProps {
  learnerId: string;
  initialNotificationsEnabled: boolean;
  initialDailyReminderTime: string | null;
  initialSoundEnabled: boolean;
  // W12-T4 / DEC-078: 学習時間目標 section
  initialDailyMinutesTarget: number;
  initialStudyTargetReminderEnabled: boolean;
  initialStudyTargetReminderTime: string;
}

interface StudyTargetPatch {
  dailyMinutesTarget?: number;
  reminderEnabled?: boolean;
  reminderTime?: string;
}

export function NotificationsForm({
  learnerId,
  initialNotificationsEnabled,
  initialDailyReminderTime,
  initialSoundEnabled,
  initialDailyMinutesTarget,
  initialStudyTargetReminderEnabled,
  initialStudyTargetReminderTime,
}: NotificationsFormProps) {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    initialNotificationsEnabled,
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    initialDailyReminderTime !== null,
  );
  const [reminderTime, setReminderTime] = useState(
    initialDailyReminderTime ?? "19:00",
  );
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // W12-T4 / DEC-078: 学習時間目標 section state
  const [dailyMinutesTarget, setDailyMinutesTarget] = useState<number>(
    initialDailyMinutesTarget,
  );
  const [studyTargetReminderEnabled, setStudyTargetReminderEnabled] = useState(
    initialStudyTargetReminderEnabled,
  );
  const [studyTargetReminderTime, setStudyTargetReminderTime] = useState(
    initialStudyTargetReminderTime,
  );
  const [studyTargetError, setStudyTargetError] = useState<string | null>(null);
  const [studyTargetSuccess, setStudyTargetSuccess] = useState<string | null>(
    null,
  );
  const [reauthOpen, setReauthOpen] = useState(false);
  const [isStudyTargetPending, startStudyTargetTransition] = useTransition();

  // pending mutation を保持して reauth 成功時にリトライする
  const pendingStudyTargetPatchRef = useRef<StudyTargetPatch | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const dailyReminderTime: string | null = reminderEnabled
      ? reminderTime
      : null;

    startTransition(async () => {
      const result = await updateLearnerSettings(learnerId, {
        notificationsEnabled,
        dailyReminderTime,
        soundEnabled,
      });
      if (result.ok) {
        setSuccess("変更を保存しました");
        router.refresh();
        return;
      }
      setError(
        result.message ??
          "保存に失敗しました。時間をおいて再度お試しください。",
      );
    });
  }

  // W12-T4 / DEC-078: 学習時間目標 section submit (sensitive = reauth 必須)
  async function callStudyTargetMutation(patch: StudyTargetPatch): Promise<void> {
    setStudyTargetError(null);
    setStudyTargetSuccess(null);

    const result = await updateLearnerStudyTarget(learnerId, patch);
    if (result.ok) {
      setStudyTargetSuccess("学習時間目標を保存しました");
      pendingStudyTargetPatchRef.current = null;
      router.refresh();
      return;
    }
    if (result.reason === "reauth_required") {
      pendingStudyTargetPatchRef.current = patch;
      setReauthOpen(true);
      return;
    }
    setStudyTargetError(
      result.message ??
        "保存に失敗しました。時間をおいて再度お試しください。",
    );
  }

  function handleStudyTargetSubmit(
    e: React.FormEvent<HTMLFormElement>,
  ): void {
    e.preventDefault();
    const patch: StudyTargetPatch = {
      dailyMinutesTarget,
      reminderEnabled: studyTargetReminderEnabled,
      reminderTime: studyTargetReminderTime,
    };
    startStudyTargetTransition(async () => {
      await callStudyTargetMutation(patch);
    });
  }

  function handleReauthSuccess(): void {
    const patch = pendingStudyTargetPatchRef.current;
    if (!patch) return;
    startStudyTargetTransition(async () => {
      await callStudyTargetMutation(patch);
    });
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-6"
        data-testid="notifications-form"
      >
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">メール通知</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                週次の学習レポートなどを 親メール宛に送信します。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsEnabled}
              aria-label="メール通知の ON / OFF"
              data-testid="notifications-toggle"
              onClick={() => setNotificationsEnabled((v) => !v)}
              disabled={isPending}
              className={[
                "min-h-tap-cta inline-flex w-20 items-center justify-center rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-all",
                notificationsEnabled
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50",
              ].join(" ")}
            >
              {notificationsEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">毎日のリマインド</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                指定した時刻に学習をうながす通知を送ります。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reminderEnabled}
              aria-label="毎日のリマインド の ON / OFF"
              data-testid="reminder-toggle"
              onClick={() => setReminderEnabled((v) => !v)}
              disabled={isPending}
              className={[
                "min-h-tap-cta inline-flex w-20 items-center justify-center rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-all",
                reminderEnabled
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50",
              ].join(" ")}
            >
              {reminderEnabled ? "ON" : "OFF"}
            </button>
          </div>

          {reminderEnabled ? (
            <div className="space-y-2">
              <Label htmlFor="reminder-time">時刻 (24 時間制)</Label>
              <Input
                id="reminder-time"
                name="dailyReminderTime"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                data-testid="reminder-time-input"
                disabled={isPending}
                required
              />
            </div>
          ) : null}
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">効果音</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                学習中の正解時 効果音の ON / OFF (端末側でも切替可能)。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={soundEnabled}
              aria-label="効果音の ON / OFF"
              data-testid="sound-server-toggle"
              onClick={() => setSoundEnabled((v) => !v)}
              disabled={isPending}
              className={[
                "min-h-tap-cta inline-flex w-20 items-center justify-center rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-all",
                soundEnabled
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50",
              ].join(" ")}
            >
              {soundEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </section>

        {error ? (
          <p
            role="alert"
            data-testid="notifications-error"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {success ? (
          <p
            role="status"
            data-testid="notifications-success"
            className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary"
          >
            <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
            {success}
          </p>
        ) : null}

        <Button
          type="submit"
          data-testid="notifications-submit"
          disabled={isPending}
        >
          {isPending ? "保存中..." : "保存する"}
        </Button>
      </form>

      {/* W12-T4 / DEC-078: 学習時間目標 section (sensitive = reauth 必須) */}
      <form
        onSubmit={handleStudyTargetSubmit}
        className="mt-8 space-y-4 rounded-lg border-2 border-primary/30 bg-card p-4"
        data-testid="study-target-form"
      >
        <div>
          <h3 className="text-sm font-semibold">学習時間目標</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            お子さまの 1 日あたりの学習時間目標と、目標未達時の優しいリマインドを設定します。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="daily-minutes-target">
            1 日の目標時間 (分 / 0 - 180)
          </Label>
          <Input
            id="daily-minutes-target"
            name="dailyMinutesTarget"
            type="number"
            min={0}
            max={180}
            step={1}
            value={dailyMinutesTarget}
            onChange={(e) =>
              setDailyMinutesTarget(Math.max(0, Math.min(180, Math.floor(Number(e.target.value) || 0))))
            }
            data-testid="daily-minutes-target-input"
            disabled={isStudyTargetPending}
            required
          />
          <p className="text-xs text-muted-foreground">
            0 分 = 目標を設定しない。15 分が目安です。
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/50 p-3">
          <div>
            <p className="text-sm font-medium">学習時間 リマインド</p>
            <p className="mt-1 text-xs text-muted-foreground">
              目標未達の日の夜に、優しい呼びかけ通知を送ります。
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={studyTargetReminderEnabled}
            aria-label="学習時間 リマインドの ON / OFF"
            data-testid="study-target-reminder-toggle"
            onClick={() => setStudyTargetReminderEnabled((v) => !v)}
            disabled={isStudyTargetPending}
            className={[
              "min-h-tap-cta inline-flex w-20 items-center justify-center rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-all",
              studyTargetReminderEnabled
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted text-muted-foreground",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
          >
            {studyTargetReminderEnabled ? "ON" : "OFF"}
          </button>
        </div>

        {studyTargetReminderEnabled ? (
          <div className="space-y-2">
            <Label htmlFor="study-target-reminder-time">
              リマインド時刻 (24 時間制)
            </Label>
            <Input
              id="study-target-reminder-time"
              name="studyTargetReminderTime"
              type="time"
              value={studyTargetReminderTime}
              onChange={(e) => setStudyTargetReminderTime(e.target.value)}
              data-testid="study-target-reminder-time-input"
              disabled={isStudyTargetPending}
              required
            />
          </div>
        ) : null}

        {studyTargetError ? (
          <p
            role="alert"
            data-testid="study-target-error"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {studyTargetError}
          </p>
        ) : null}

        {studyTargetSuccess ? (
          <p
            role="status"
            data-testid="study-target-success"
            className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary"
          >
            <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
            {studyTargetSuccess}
          </p>
        ) : null}

        <Button
          type="submit"
          data-testid="study-target-submit"
          disabled={isStudyTargetPending}
        >
          {isStudyTargetPending ? "保存中..." : "学習時間目標を保存する"}
        </Button>
      </form>

      <ParentReauthDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        onSuccess={handleReauthSuccess}
        description="学習時間目標の変更には、親のパスワード再入力が必要です。一度確認すると 5 分間有効です。"
      />
    </>
  );
}
