/**
 * HANEI - 達成 burst / Confetti (W8-T4)
 *
 * canvas-confetti を使った達成演出。
 * - intensity: light / medium / heavy
 * - 桜の花びら混在の和テイスト (kotodama-tori と一貫)
 * - prefers-reduced-motion 対応 (静止 gradient overlay にフォールバック)
 * - 学習者 preferences.confettiEnabled で制御
 *
 * 発動タイミング (StudyClient / lesson-complete-modal が呼ぶ):
 *   - レッスン完了時 (5 問以上連続正解後の終了)
 *   - バッジ獲得時 (W9 で実装、本モジュールは trigger function を提供するのみ)
 *   - 受験日カウントダウン milestone 時 (30 / 7 / 1 日)
 */

import confetti from "canvas-confetti";

export type ConfettiIntensity = "light" | "medium" | "heavy";

interface ConfettiState {
  enabled: boolean;
}

const state: ConfettiState = { enabled: true };

/** 学習者 / 保護者の preferences を反映 */
export function setConfettiEnabled(enabled: boolean): void {
  state.enabled = enabled;
}

export function getConfettiState(): { enabled: boolean } {
  return { enabled: state.enabled };
}

/** テスト用 reset */
export function __resetConfettiForTest(enabled = true): void {
  state.enabled = enabled;
}

/**
 * prefers-reduced-motion を尊重するか判定 (純関数 / テスト容易)
 * - SSR / window 不在: false (安全側で confetti 抑制)
 * - matchMedia 未対応: false
 */
export function isMotionReduced(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** intensity ごとの particle count / spread を一定マッピングで返す (テスト容易) */
export function getConfettiOptions(
  intensity: ConfettiIntensity,
): confetti.Options {
  const base: confetti.Options = {
    // 桜の花びら寄りの色: 桜ピンク / Mint / Amber Gold (HANEI brand)
    colors: ["#FFB7C5", "#F7CAD0", "#6FE7C9", "#F2A93A", "#FFFFFF"],
    // 上方向に少し打ち上げる
    angle: 90,
    startVelocity: 35,
    gravity: 0.7,
    scalar: 0.9,
    ticks: 200,
    origin: { x: 0.5, y: 0.7 },
  };

  switch (intensity) {
    case "light":
      return { ...base, particleCount: 40, spread: 60, ticks: 150 };
    case "medium":
      return { ...base, particleCount: 90, spread: 80, ticks: 200 };
    case "heavy":
      return { ...base, particleCount: 160, spread: 100, ticks: 260 };
  }
}

/**
 * Confetti を発動する。
 *
 * - 学習者が無効化 (preferences.confettiEnabled=false): silently skip
 * - prefers-reduced-motion: silently skip (代替の static gradient overlay は modal 側で表示)
 * - canvas-confetti が SSR で利用不可: silently skip
 *
 * いずれも throw しない。
 */
export async function triggerConfetti(
  intensity: ConfettiIntensity = "medium",
): Promise<void> {
  if (!state.enabled) return;
  if (isMotionReduced()) return;
  if (typeof window === "undefined") return;

  const options = getConfettiOptions(intensity);
  try {
    const result = confetti(options) as unknown;
    // canvas-confetti は Promise<null> | null を返す。Promise なら await する
    if (
      result &&
      typeof (result as { then?: unknown }).then === "function"
    ) {
      await (result as Promise<unknown>);
    }
  } catch {
    // 描画失敗は UX を壊さない
  }
}
