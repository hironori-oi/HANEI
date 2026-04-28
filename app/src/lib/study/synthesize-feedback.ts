/**
 * HANEI - 効果音 oscillator 合成 (W8-T3)
 *
 * Web Audio API の OscillatorNode で楽器系のクリーンな効果音を合成する。
 * 実音源 mp3 を持たない環境でも音響フィードバック体験を提供できる。
 *
 * 設計原則 (CLAUDE.md / 計画書 W8-T3):
 *   - ピコピコ系 (8bit) を避け、sine/triangle 波で柔らかい鈴 / 拍手 / 上昇音階を作る
 *   - 各音 0.4 秒以下 (子供の集中を切らさない)
 *   - 振幅は 0.0 → peak → 0.0 でエンベロープし、ブツ切れ感を消す
 *
 * 4 種:
 *   - correct:    880Hz → 1320Hz 上昇 (鈴の音)、0.20 秒
 *   - incorrect:  440Hz → 330Hz 下降 (優しい "あれっ" 音)、0.30 秒
 *   - combo:      880Hz triple-tap (拍手のリズム)、0.30 秒
 *   - level-up:   C5-E5-G5 アルペジオ (ファンファーレ短縮版)、0.40 秒
 */

export type FeedbackKind = "correct" | "incorrect" | "combo" | "level-up";

/** 各 kind の合成パラメータ (純データ — テスト容易性のため export) */
export interface SynthSpec {
  /** 各部分の周波数 (Hz) */
  frequencies: number[];
  /** 各部分の duration (秒) */
  durations: number[];
  /** 波形 — 楽器系を選ぶこと (sine / triangle) */
  waveType: OscillatorType;
  /** 全体の振幅最大値 (0..1) — 過剰音圧防止のため 0.3 を上限 */
  peakGain: number;
}

export const SYNTH_SPECS: Record<FeedbackKind, SynthSpec> = {
  correct: {
    frequencies: [880, 1320],
    durations: [0.08, 0.12],
    waveType: "sine",
    peakGain: 0.25,
  },
  incorrect: {
    frequencies: [440, 330],
    durations: [0.12, 0.18],
    waveType: "triangle",
    peakGain: 0.18,
  },
  combo: {
    // triple-tap の拍手感: 同じ高さで 3 回弾ませる
    frequencies: [880, 880, 880],
    durations: [0.08, 0.08, 0.14],
    waveType: "triangle",
    peakGain: 0.22,
  },
  "level-up": {
    // C5 / E5 / G5 (Major chord arpeggio)
    frequencies: [523.25, 659.25, 783.99],
    durations: [0.12, 0.12, 0.16],
    waveType: "sine",
    peakGain: 0.28,
  },
};

/**
 * spec の合計再生時間 (秒) を計算する純関数 (test 用途)。
 */
export function totalDurationSec(spec: SynthSpec): number {
  return spec.durations.reduce((acc, d) => acc + d, 0);
}

/**
 * AudioContext を受け取り、指定 kind の音を合成して再生する。
 * 副作用しかないので unit test では context をモックして oscillator 呼び出し回数を検証する。
 *
 * 完了 (= 全 oscillator stop) 時に resolve する Promise を返す。
 */
export function playSynthFeedback(
  ctx: AudioContext,
  kind: FeedbackKind,
): Promise<void> {
  const spec = SYNTH_SPECS[kind];
  const totalSec = totalDurationSec(spec);
  const startTime = ctx.currentTime;

  // 1 つの GainNode で全体エンベロープを作る
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0001, startTime);
  // attack 5ms
  masterGain.gain.exponentialRampToValueAtTime(spec.peakGain, startTime + 0.005);
  // release: 末尾で 0.0001 に向かって減衰 (ブツ切れ防止)
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + totalSec);
  masterGain.connect(ctx.destination);

  // 各 frequency で oscillator を順次起動
  let cursor = startTime;
  for (let i = 0; i < spec.frequencies.length; i++) {
    const freq = spec.frequencies[i];
    const dur = spec.durations[i];
    if (typeof freq !== "number" || typeof dur !== "number") continue;

    const osc = ctx.createOscillator();
    osc.type = spec.waveType;
    osc.frequency.setValueAtTime(freq, cursor);
    osc.connect(masterGain);
    osc.start(cursor);
    osc.stop(cursor + dur);
    cursor += dur;
  }

  return new Promise<void>((resolve) => {
    // setTimeout で stop 通知 (browser 互換 / test 容易)
    const ms = Math.ceil(totalSec * 1000) + 20;
    setTimeout(() => resolve(), ms);
  });
}
