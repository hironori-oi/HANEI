/**
 * HANEI - Learner Preferences 正規化純関数 (W8 / W10-T5)
 *
 * `src/lib/actions/learner-preferences.ts` は `"use server"` ファイルなので
 * 同期関数や型を `export` できない (Turbopack: "Server Actions must be async functions").
 * 純関数 / 型定義は当ファイルに切り出し、unit test と server action の両方から参照する.
 *
 * - DEFAULT_PREFS: ログイン直後の learner_profiles.preferences が NULL のときの fallback
 * - NormalizedLearnerPreferences: 正規化後の concrete 型 (boolean は必須化, preferred は 5/7/10/null)
 * - normalizePreferences(raw): unknown を NormalizedLearnerPreferences に倒し込む純関数
 */

export type NormalizedLearnerPreferences = {
  soundEnabled: boolean;
  confettiEnabled: boolean;
  preferredSessionMinutes: 5 | 7 | 10 | null;
};

export const DEFAULT_PREFS: NormalizedLearnerPreferences = {
  soundEnabled: true,
  confettiEnabled: true,
  preferredSessionMinutes: null,
};

/**
 * preferences JSON を normalize する純関数 (テスト容易)。
 * - undefined / null / 不正型は default に倒す
 * - 余計なキーは捨てる
 * - preferredSessionMinutes は 5 / 7 / 10 のみ許容 (それ以外は null)
 */
export function normalizePreferences(
  raw: unknown,
): NormalizedLearnerPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFS };
  const obj = raw as Record<string, unknown>;
  const rawPreferred = obj.preferredSessionMinutes;
  const preferredSessionMinutes: 5 | 7 | 10 | null =
    rawPreferred === 5 || rawPreferred === 7 || rawPreferred === 10
      ? rawPreferred
      : null;
  return {
    soundEnabled:
      typeof obj.soundEnabled === "boolean"
        ? obj.soundEnabled
        : DEFAULT_PREFS.soundEnabled,
    confettiEnabled:
      typeof obj.confettiEnabled === "boolean"
        ? obj.confettiEnabled
        : DEFAULT_PREFS.confettiEnabled,
    preferredSessionMinutes,
  };
}
