"use client";

/**
 * HANEI - 学習者効果音 / 紙吹雪 ON-OFF トグル (W8-T3 / W8-T4)
 *
 * settings の「学習設定」セクションに配置する。保護者が制御する想定。
 * 内部で server action `updateLearnerPreferences` を呼び、preferences を永続化する。
 *
 * 認可:
 *   server action 側 (requireLearnerOwner) で家族外アクセスを完全防御する。
 *   このコンポーネントは UI 表示と楽観更新のみ。
 *
 * 設計原則 (CLAUDE.md):
 *   - 絵文字禁止: ON / OFF は文字 + Heroicons (SpeakerWave / SpeakerXMark) で表現
 *   - AI 感を出さない: 標準的な checkbox role + キーボード操作対応
 */

import { useState, useTransition } from "react";
import {
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  setAudioEnabled,
} from "@/lib/study/audio-feedback";
import { setConfettiEnabled } from "@/lib/study/confetti";
import { setSoundEffectsEnabled } from "@/lib/audio/sound-effects";
import { updateLearnerPreferences } from "@/lib/actions/learner-preferences";

interface Props {
  learnerId: string;
  initialSoundEnabled: boolean;
  initialConfettiEnabled: boolean;
}

export function SoundConfettiToggle(props: Props) {
  const { learnerId, initialSoundEnabled, initialConfettiEnabled } = props;
  const [soundEnabled, setSoundLocal] = useState(initialSoundEnabled);
  const [confettiEnabled, setConfettiLocal] = useState(initialConfettiEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const persist = (next: { soundEnabled: boolean; confettiEnabled: boolean }) => {
    startTransition(async () => {
      try {
        await updateLearnerPreferences(learnerId, next);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
        // ロールバック
        setSoundLocal((s) => !s);
      }
    });
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundLocal(next);
    setAudioEnabled(next);
    // DEC-088 Plan B 項目 2: Howler エンジンの mute も同期
    setSoundEffectsEnabled(next);
    persist({ soundEnabled: next, confettiEnabled });
  };

  const toggleConfetti = () => {
    const next = !confettiEnabled;
    setConfettiLocal(next);
    setConfettiEnabled(next);
    persist({ soundEnabled, confettiEnabled: next });
  };

  return (
    <section
      data-testid="sound-confetti-toggle"
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <h3 className="text-sm font-semibold">学習設定</h3>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {soundEnabled ? (
            <SpeakerWaveIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          ) : (
            <SpeakerXMarkIcon
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span className="text-sm">
            こうかおん
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={soundEnabled}
          aria-label="効果音の ON / OFF"
          data-testid="sound-toggle-button"
          onClick={toggleSound}
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

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SparklesIcon
            className={`h-5 w-5 ${
              confettiEnabled ? "text-primary" : "text-muted-foreground"
            }`}
            aria-hidden="true"
          />
          <span className="text-sm">
            おいわい えんしゅつ
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={confettiEnabled}
          aria-label="お祝い演出の ON / OFF"
          data-testid="confetti-toggle-button"
          onClick={toggleConfetti}
          disabled={isPending}
          className={[
            "min-h-tap-cta inline-flex w-20 items-center justify-center rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-all",
            confettiEnabled
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
        >
          {confettiEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
