"use client";

/**
 * SessionPicker - 学習セッション 5/7/10 分 時間選択 UI (W10-T4)
 *
 * Client Component:
 *  - 3 択カード (5 / 7 / 10 分) - 子ども向け文言 / aria-label
 *  - 「いつもの長さでいい」: localStorage に保存された前回 duration を 1 click で再選択
 *  - 選択 → /study/[levelCode]/[skillCode]?dur=<minutes>&session=<uuid> に遷移
 *  - URL に `session` (UUID) と `dur` を載せて Phase 2 plan §W10-T4 のセッション識別を可能に
 *
 * 罰則ゼロ哲学 (DEC-024) 整合: 全文言肯定形 / 否定形なし。
 * K-1 / K-2 整合: タップ領域 56px / ふりがな寄せ + 数字半角.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ClockIcon,
  PlayCircleIcon,
  StarIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import {
  LAST_SESSION_DURATION_STORAGE_KEY,
  SESSION_DURATION_OPTIONS,
  type SessionDurationMinutes,
  composeStudySession,
  getSessionCopy,
  isSessionDurationMinutes,
  writeLastSessionDurationToStorage,
} from "@/lib/study/session-composer";
import { setPreferredSessionMinutes } from "@/lib/actions/learner-preferences";

interface SessionPickerProps {
  learnerId: string;
  /** 開始 URL (例: "/study/eiken-5/vocab"). 既存 page と互換 */
  studyTargetPath: string;
  /**
   * W10-T5: cross-device「いつもの長さ」 (server-rendered).
   * - learner_preferences.preferences.preferredSessionMinutes から下ろす
   * - null = 未設定 (この場合は localStorage の値にフォールバック)
   * - 5/7/10 が来た場合は localStorage より優先される (cross-device 一貫性)
   */
  initialPreferredMinutes?: 5 | 7 | 10 | null;
}

function generateSessionId(): string {
  // crypto.randomUUID は client / server で利用可能 (Phase 1 動作環境前提)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (古い環境向け / Phase 1 では到達しない想定)
  return `sess-${Math.random().toString(36).slice(2, 12)}-${Date.now()}`;
}

/**
 * useSyncExternalStore subscriber: localStorage の StorageEvent を購読する。
 * 他タブで「いつもの長さ」が変わった際にもライブで反映される副次効果あり。
 */
function subscribeToLastSessionStorage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === LAST_SESSION_DURATION_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/**
 * useSyncExternalStore getSnapshot: SSR では呼ばれない (server snapshot は別).
 * 戻り値は安定参照 (5/7/10|null の primitive のみ) のため getSnapshot 多重呼びでも OK.
 */
function getLastSessionDurationSnapshot(): SessionDurationMinutes | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_SESSION_DURATION_STORAGE_KEY);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return isSessionDurationMinutes(n) ? n : null;
  } catch {
    return null;
  }
}

export function SessionPicker(props: SessionPickerProps) {
  const { learnerId, studyTargetPath, initialPreferredMinutes = null } = props;
  const router = useRouter();

  // useSyncExternalStore で localStorage を購読 (storage event で他タブ反映 / SSR null fallback)
  // → effect 内の setState 回避 (react-hooks/set-state-in-effect 整合)
  const localLastDuration = React.useSyncExternalStore(
    subscribeToLastSessionStorage,
    getLastSessionDurationSnapshot,
    () => null,
  );

  // W10-T5: server からの preferredSessionMinutes (cross-device) を localStorage より優先
  // - server に値があれば server 値 (cross-device 一貫性 / 別端末でも同じ既定)
  // - server が null の場合は localStorage fallback (legacy 互換)
  const lastDuration: SessionDurationMinutes | null =
    initialPreferredMinutes ?? localLastDuration;

  const start = React.useCallback(
    (duration: SessionDurationMinutes) => {
      if (typeof window !== "undefined") {
        writeLastSessionDurationToStorage(window.localStorage, duration);
      }
      // W10-T5: server にも cross-device 永続化 (silent fail-safe / UX を阻害しない)
      void setPreferredSessionMinutes(learnerId, duration).catch(() => {});
      const sessionId = generateSessionId();
      const target = `${studyTargetPath}?dur=${duration}&session=${encodeURIComponent(sessionId)}`;
      router.push(target);
    },
    [router, studyTargetPath, learnerId],
  );

  return (
    <section data-testid="session-picker" className="space-y-6">
      <header className="space-y-2">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <ClockIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          きょうは どれくらい やる？
        </h2>
        <p className="text-sm text-muted-foreground">
          すきな じかんを えらぼう。とちゅうで おしまいに しても だいじょうぶ。
        </p>
      </header>

      {lastDuration ? (
        <div data-testid="session-picker-last" className="flex justify-start">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="min-h-tap-cta"
            onClick={() => start(lastDuration)}
            aria-label={`いつもの長さ (${lastDuration} 分) ではじめる`}
            data-testid="session-picker-last-cta"
          >
            <StarIcon className="h-5 w-5" aria-hidden="true" />
            <span className="ml-2">
              いつもの ながさ ({lastDuration} ふん) で はじめる
            </span>
          </Button>
        </div>
      ) : null}

      <div
        className="grid gap-4 sm:grid-cols-3"
        role="radiogroup"
        aria-label="セッションの長さ"
      >
        {SESSION_DURATION_OPTIONS.map((d) => (
          <SessionOptionCard
            key={d}
            learnerId={learnerId}
            duration={d}
            onChoose={start}
            isLast={lastDuration === d}
          />
        ))}
      </div>
    </section>
  );
}

interface SessionOptionCardProps {
  learnerId: string;
  duration: SessionDurationMinutes;
  isLast: boolean;
  onChoose: (d: SessionDurationMinutes) => void;
}

function SessionOptionCard({
  learnerId,
  duration,
  isLast,
  onChoose,
}: SessionOptionCardProps) {
  // 表示用 plan preview (deterministic / UI に問題数の目安を表示)
  // SSR mismatch を避けるため now を渡さない (default = client-side new Date())
  const preview = React.useMemo(
    () =>
      composeStudySession({
        learnerId,
        durationMinutes: duration,
      }),
    [learnerId, duration],
  );
  const copy = getSessionCopy(duration);

  return (
    <Card
      data-testid={`session-option-${duration}`}
      data-duration={duration}
      data-plan-size={preview.planSize}
      className={
        isLast
          ? "border-2 border-primary bg-primary/5"
          : "border border-border bg-card"
      }
    >
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold tabular-nums">{copy.headline}</p>
          {isLast ? (
            <span
              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
              aria-label="前回 選んだ ながさ"
            >
              いつもの
            </span>
          ) : null}
        </div>
        <p className="text-sm text-foreground">{copy.subtext}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          もんだい {preview.planSize} もんを めやすに
        </p>
        <Button
          type="button"
          size="lg"
          className="min-h-tap-cta w-full"
          onClick={() => onChoose(duration)}
          role="radio"
          aria-checked={isLast}
          aria-label={copy.ariaLabel}
          data-testid={`session-option-cta-${duration}`}
        >
          <PlayCircleIcon className="h-5 w-5" aria-hidden="true" />
          <span className="ml-2">これで はじめる</span>
        </Button>
      </CardContent>
    </Card>
  );
}
