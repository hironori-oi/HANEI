/**
 * HANEI - 学習フィードバック効果音 (W8-T3)
 *
 * 4 種: correct / incorrect / combo / level-up
 * 実音源 mp3 を持たないため Web Audio API の oscillator で合成する
 * (詳細: synthesize-feedback.ts)。
 *
 * ブラウザ自動再生ポリシー対応:
 *   - AudioContext は 必ず最初のユーザー操作 (click) 後に initAudioContext() で生成すること
 *   - context 未初期化または suspended の場合は silently skip
 *
 * 学習者 mute 設定 (preferences.soundEnabled = false) は setAudioEnabled(false) で反映する。
 *
 * 設計原則 (CLAUDE.md):
 *   - 絵文字禁止 / AI 感を出さない
 *   - ピコピコ系 8bit 音は使わない (synthesize-feedback.ts で sine/triangle 波)
 */

import {
  playSynthFeedback,
  type FeedbackKind,
} from "./synthesize-feedback";

/** モジュール内 state (singleton) */
interface AudioFeedbackState {
  context: AudioContext | null;
  enabled: boolean;
}

const state: AudioFeedbackState = {
  context: null,
  enabled: true,
};

/**
 * AudioContext を取得 (test / SSR で安全に no-op する)。
 * Window 上で AudioContext 系コンストラクタが見つからない環境では null を返す。
 */
function resolveAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * 最初のユーザー操作 (例: ボタンクリック) 後に呼ぶこと。
 * autoplay policy 上、これより前に AudioContext を作っても suspended のまま音が出ない。
 *
 * 既に初期化済みの場合は冪等で何もしない。
 */
export function initAudioContext(): void {
  if (state.context) return;
  const Ctor = resolveAudioContextCtor();
  if (!Ctor) return;
  try {
    state.context = new Ctor();
  } catch {
    // browser が拒否した場合 (Safari の特殊条件など) は silently skip
    state.context = null;
  }
}

/**
 * 学習者 / 保護者の mute 設定を反映する。
 * preferences.soundEnabled の真偽値をそのまま渡す。
 */
export function setAudioEnabled(enabled: boolean): void {
  state.enabled = enabled;
}

/**
 * 現在の audio enabled / context 状態を取得する (test / debug 用)。
 */
export function getAudioFeedbackState(): {
  enabled: boolean;
  contextReady: boolean;
} {
  return {
    enabled: state.enabled,
    contextReady: state.context !== null,
  };
}

/**
 * テスト用: state を初期化し、optional に context を inject する。
 * (vitest 内で window.AudioContext が無い前提で動かすため)
 */
export function __resetAudioFeedbackForTest(
  injectedContext: AudioContext | null = null,
  enabled = true,
): void {
  state.context = injectedContext;
  state.enabled = enabled;
}

/**
 * 効果音を再生する。
 *
 * - 無効化されている (enabled=false): 何もしない (Promise resolve)
 * - context 未初期化: 何もしない (initAudioContext がまだ呼ばれていない / browser 制限)
 * - context が "suspended" 状態: 自動 resume を試み、失敗時は silently skip
 *
 * いずれの fallback も throw しない (UX を壊さないため)。
 */
export async function playFeedback(kind: FeedbackKind): Promise<void> {
  if (!state.enabled) return;
  const ctx = state.context;
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => undefined);
    }
    if (ctx.state !== "running") return;
    await playSynthFeedback(ctx, kind);
  } catch {
    // 再生失敗は学習体験を壊さない
  }
}
