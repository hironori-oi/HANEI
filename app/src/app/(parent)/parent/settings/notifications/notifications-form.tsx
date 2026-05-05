"use client";

/**
 * Notifications Form (W12-T1 / Phase 3 第 1 波 / DEC-074)
 *
 * 親が学習者の通知 / リマインド設定を編集する Client Component.
 *
 * 連携フロー:
 *   - submit / toggle → updateLearnerSettings (top-level Server Action #1)
 *   - notifications 系は reauth 不要 (DEC-074 §(d) account のみ sensitive)
 *
 * 設計原則:
 *   - 絵文字ゼロ / Heroicons / 罰語ゼロ (DEC-024)
 *   - tap target ≥ 44px / role="switch" / aria-checked
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLearnerSettings } from "@/lib/actions/learner-settings";

interface NotificationsFormProps {
  learnerId: string;
  initialNotificationsEnabled: boolean;
  initialDailyReminderTime: string | null;
  initialSoundEnabled: boolean;
}

export function NotificationsForm({
  learnerId,
  initialNotificationsEnabled,
  initialDailyReminderTime,
  initialSoundEnabled,
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

  return (
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
  );
}
