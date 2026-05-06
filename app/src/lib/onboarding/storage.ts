/**
 * HANEI - DEC-088 Plan B (項目 4): Onboarding ストーリー演出 / localStorage flag 管理
 *
 * 目的:
 *  - 初回 `/home` 訪問時に Onboarding 3 ページストーリーを 1 度だけ表示するための flag.
 *  - **DB 永続化なし** (mutation +0 維持) / localStorage で完結.
 *  - SSR 安全 (window 不在で常に "shown" 扱い = 再表示を抑制).
 *
 * 罰則ゼロ哲学 (DEC-024):
 *  - flag 名は "shown" 中立。「skipped」「未完了」等のネガ語は使わない.
 *  - flag 未設定の場合のみ表示する保守的フォールバック.
 */

const STORAGE_KEY = "hanei.onboarding.shown" as const;

/** 「Onboarding を既に表示した」flag が立っているか確認する. */
export function isOnboardingShown(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // localStorage が拒否された (private mode 等): 安全側で表示済扱い (再表示しない)
    return true;
  }
}

/** 「Onboarding を表示完了」を flag に保存する. */
export function markOnboardingShown(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // 書込失敗は silent (再訪問時にもう一度表示される程度の影響)
  }
}

/** test / debug 用 reset. */
export function __resetOnboardingForTest(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silent
  }
}

/** 現在の storage key (test / debug 用に export). */
export const ONBOARDING_STORAGE_KEY = STORAGE_KEY;
