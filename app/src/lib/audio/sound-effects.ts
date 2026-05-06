/**
 * HANEI - DEC-088 Plan B (項目 2): サウンドエフェクト 8 種 (Howler.js)
 *
 * `correct` / `wrong` / `levelup` / `combo` / `coin` / `streak` / `complete` / `tap`
 * の 8 種を Howl singleton で lazy 生成し、`playSoundEffect(name)` を一行で呼べる
 * 共通エンジン。
 *
 * 統合先 (W12 / Plan B):
 *  - StudyClient `submitChoiceValue` 後 (correct / wrong)
 *  - EvolutionCelebrationModal mount (levelup)
 *  - ComboCounter tier 上昇瞬間 (combo)
 *  - LessonCompleteModal mount (complete)
 *  - MotionButton tap (tap) — 任意 props
 *  - 既存 streak / coin gain (streak / coin) — 将来呼出予定
 *
 * 罰則ゼロ哲学 (DEC-024):
 *  - 全 8 種の mp3 は CC0 / royalty-free 短尺 0.3〜1.5s / Amber Gold 系優しい音色を別途投入
 *  - 本 atomic は枠だけ実装 (placeholder = 約 100ms 無音 mp3) / コード経路は完成
 *  - 不正解音 (wrong) も「叱責音」ではなく「うーん」音色想定
 *
 * SSR 安全 / 学習者 preferences (audio_enabled) と統合 / prefers-reduced-motion: reduce 時も停止.
 *
 * 既存 `lib/study/audio-feedback.ts` (Web Audio API oscillator 合成) は破壊しない。
 * 本モジュールは「将来の royalty-free mp3 を直接再生する」ための独立エンジン。
 * 既存 oscillator は引き続き fallback / a11y 補助として動作する.
 */

import type { Howl as HowlType } from "howler";

export type SoundName =
  | "correct"
  | "wrong"
  | "levelup"
  | "combo"
  | "coin"
  | "streak"
  | "complete"
  | "tap";

const SOUND_FILES: Record<SoundName, string> = {
  correct: "/sounds/correct.mp3",
  wrong: "/sounds/wrong.mp3",
  levelup: "/sounds/levelup.mp3",
  combo: "/sounds/combo.mp3",
  coin: "/sounds/coin.mp3",
  streak: "/sounds/streak.mp3",
  complete: "/sounds/complete.mp3",
  tap: "/sounds/tap.mp3",
};

interface SoundEffectsState {
  /** Howl singleton キャッシュ */
  howls: Partial<Record<SoundName, HowlType>>;
  /** preferences.soundEnabled (既存 audio-feedback と二重防御で同期) */
  enabled: boolean;
  /** howler 動的 import の進行中 / 完了状態 */
  loadPromise: Promise<typeof import("howler") | null> | null;
}

const state: SoundEffectsState = {
  howls: {},
  enabled: true,
  loadPromise: null,
};

/** preferences.soundEnabled を反映する (既存 setAudioEnabled と並列で呼ぶ). */
export function setSoundEffectsEnabled(enabled: boolean): void {
  state.enabled = enabled;
}

/** test / debug 用 state 取得. */
export function getSoundEffectsState(): {
  enabled: boolean;
  loadedNames: SoundName[];
} {
  return {
    enabled: state.enabled,
    loadedNames: (Object.keys(state.howls) as SoundName[]).filter(
      (k) => state.howls[k] !== undefined,
    ),
  };
}

/** test 用 reset. */
export function __resetSoundEffectsForTest(enabled = true): void {
  state.howls = {};
  state.enabled = enabled;
  state.loadPromise = null;
}

/** prefers-reduced-motion: reduce を確認 (SSR 安全). */
function isMotionReduced(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * howler を dynamic import で初回のみロードする (LCP 影響を最小化).
 * SSR / test 環境で window が無い場合は null を返す.
 */
async function ensureHowlerLoaded(): Promise<typeof import("howler") | null> {
  if (typeof window === "undefined") return null;
  if (state.loadPromise) return state.loadPromise;
  state.loadPromise = import("howler").catch(() => null);
  return state.loadPromise;
}

/**
 * 効果音を再生する.
 *
 * - audio 無効 (preferences): silent skip
 * - prefers-reduced-motion: reduce: silent skip (DEC-088 §2 仕様)
 * - SSR / window 不在: silent skip
 * - howler ロード失敗 / 再生失敗: silent skip (UX を壊さない)
 *
 * 戻り値: 何らかの理由で再生がスキップされた場合 false / 再生開始できた場合 true.
 */
export async function playSoundEffect(name: SoundName): Promise<boolean> {
  if (!state.enabled) return false;
  if (typeof window === "undefined") return false;
  if (isMotionReduced()) return false;

  const howler = await ensureHowlerLoaded();
  if (!howler) return false;

  try {
    let howl = state.howls[name];
    if (!howl) {
      howl = new howler.Howl({
        src: [SOUND_FILES[name]],
        // Amber Gold 系優しい音色: 音量は 0.6 (大音量警告ゼロ / 罰則ゼロ哲学)
        volume: 0.6,
        // placeholder mp3 は短尺なので preload は false / 初回再生で読み込み
        preload: false,
        html5: false,
      });
      state.howls[name] = howl;
    }
    howl.play();
    return true;
  } catch {
    // 再生失敗は学習体験を壊さない
    return false;
  }
}
