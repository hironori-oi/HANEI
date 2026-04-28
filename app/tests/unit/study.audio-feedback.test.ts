/**
 * study.audio-feedback.test.ts (W8-T3)
 *
 * audio-feedback / synthesize-feedback の純関数 + 副作用境界をテストする。
 * vitest 環境は node のため、AudioContext を明示モックで注入する。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  __resetAudioFeedbackForTest,
  getAudioFeedbackState,
  initAudioContext,
  playFeedback,
  setAudioEnabled,
} from "@/lib/study/audio-feedback";
import {
  SYNTH_SPECS,
  totalDurationSec,
  playSynthFeedback,
} from "@/lib/study/synthesize-feedback";

/** 最小限の AudioContext モック (oscillator / gain 呼び出しを記録) */
function createMockAudioContext(initialState: AudioContextState = "running") {
  const oscillators: Array<{
    type: OscillatorType;
    freq: number;
    startedAt: number;
    stoppedAt: number;
  }> = [];

  const gains: Array<{ gainCalls: string[] }> = [];

  let state: AudioContextState = initialState;
  const ctx = {
    currentTime: 0,
    get state() {
      return state;
    },
    resume: vi.fn(async () => {
      state = "running";
    }),
    createOscillator: vi.fn(() => {
      const rec = {
        type: "sine" as OscillatorType,
        freq: 0,
        startedAt: 0,
        stoppedAt: 0,
      };
      oscillators.push(rec);
      return {
        get type() {
          return rec.type;
        },
        set type(v: OscillatorType) {
          rec.type = v;
        },
        frequency: {
          setValueAtTime: (v: number) => {
            rec.freq = v;
          },
        },
        connect: vi.fn(),
        start: (t: number) => {
          rec.startedAt = t;
        },
        stop: (t: number) => {
          rec.stoppedAt = t;
        },
      };
    }),
    createGain: vi.fn(() => {
      const calls: string[] = [];
      gains.push({ gainCalls: calls });
      return {
        gain: {
          setValueAtTime: () => calls.push("setValueAtTime"),
          exponentialRampToValueAtTime: () =>
            calls.push("exponentialRampToValueAtTime"),
        },
        connect: vi.fn(),
      };
    }),
    destination: {} as AudioDestinationNode,
  };

  return { ctx: ctx as unknown as AudioContext, oscillators, gains };
}

describe("synthesize-feedback / SYNTH_SPECS", () => {
  it("4 種すべての spec が定義されている", () => {
    expect(SYNTH_SPECS.correct).toBeDefined();
    expect(SYNTH_SPECS.incorrect).toBeDefined();
    expect(SYNTH_SPECS.combo).toBeDefined();
    expect(SYNTH_SPECS["level-up"]).toBeDefined();
  });

  it("各 spec の合計再生時間は 0.4 秒以下 (子供の集中切らさない)", () => {
    for (const kind of ["correct", "incorrect", "combo", "level-up"] as const) {
      const total = totalDurationSec(SYNTH_SPECS[kind]);
      expect(total).toBeLessThanOrEqual(0.4);
      expect(total).toBeGreaterThan(0);
    }
  });

  it("peakGain は 0.3 以下 (過剰音圧防止)", () => {
    for (const kind of ["correct", "incorrect", "combo", "level-up"] as const) {
      expect(SYNTH_SPECS[kind].peakGain).toBeLessThanOrEqual(0.3);
    }
  });

  it("waveType は楽器系のみ (sine / triangle, 8bit を避ける)", () => {
    for (const kind of ["correct", "incorrect", "combo", "level-up"] as const) {
      expect(["sine", "triangle"]).toContain(SYNTH_SPECS[kind].waveType);
    }
  });

  it("playSynthFeedback は frequencies.length 個の oscillator を作る", async () => {
    const { ctx, oscillators } = createMockAudioContext();
    // setTimeout を即解決にする
    vi.useFakeTimers();
    const promise = playSynthFeedback(ctx, "level-up");
    vi.runAllTimers();
    await promise;
    vi.useRealTimers();
    expect(oscillators).toHaveLength(SYNTH_SPECS["level-up"].frequencies.length);
    // 最初の周波数 = C5 = 523.25
    expect(oscillators[0]?.freq).toBeCloseTo(523.25, 1);
  });
});

describe("audio-feedback / module state", () => {
  beforeEach(() => {
    __resetAudioFeedbackForTest(null, true);
  });

  it("初期状態: enabled=true / contextReady=false", () => {
    const s = getAudioFeedbackState();
    expect(s.enabled).toBe(true);
    expect(s.contextReady).toBe(false);
  });

  it("setAudioEnabled(false) で enabled が反映される", () => {
    setAudioEnabled(false);
    expect(getAudioFeedbackState().enabled).toBe(false);
  });

  it("initAudioContext は SSR 環境 (window 未定義) で no-op", () => {
    // node 環境では window 不在 = ctor が解決されない
    initAudioContext();
    expect(getAudioFeedbackState().contextReady).toBe(false);
  });

  it("playFeedback: enabled=false なら context があっても何もせず resolve", async () => {
    const { ctx } = createMockAudioContext();
    __resetAudioFeedbackForTest(ctx, false);
    await playFeedback("correct");
    // disabled なので createOscillator は呼ばれない
    expect((ctx.createOscillator as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  it("playFeedback: context 未初期化なら silent skip", async () => {
    __resetAudioFeedbackForTest(null, true);
    await expect(playFeedback("correct")).resolves.toBeUndefined();
  });

  it("playFeedback: state=suspended なら resume を呼んで再生", async () => {
    const { ctx } = createMockAudioContext("suspended");
    __resetAudioFeedbackForTest(ctx, true);
    vi.useFakeTimers();
    const p = playFeedback("correct");
    await vi.runAllTimersAsync();
    await p;
    vi.useRealTimers();
    expect((ctx.resume as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("playFeedback: state=closed なら何もせず resolve (throw しない)", async () => {
    const { ctx } = createMockAudioContext("closed");
    __resetAudioFeedbackForTest(ctx, true);
    await expect(playFeedback("incorrect")).resolves.toBeUndefined();
  });

  it("playFeedback: kind ごとに正しい oscillator 数を作る (running 時)", async () => {
    const { ctx, oscillators } = createMockAudioContext("running");
    __resetAudioFeedbackForTest(ctx, true);
    vi.useFakeTimers();
    const p = playFeedback("combo");
    await vi.runAllTimersAsync();
    await p;
    vi.useRealTimers();
    expect(oscillators).toHaveLength(SYNTH_SPECS.combo.frequencies.length);
  });

  it("playFeedback: 内部 throw が UX に伝播しない (try-catch)", async () => {
    const ctx = {
      currentTime: 0,
      state: "running" as AudioContextState,
      resume: vi.fn(),
      createOscillator: () => {
        throw new Error("simulated browser failure");
      },
      createGain: () => ({
        gain: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        connect: () => undefined,
      }),
      destination: {} as AudioDestinationNode,
    } as unknown as AudioContext;
    __resetAudioFeedbackForTest(ctx, true);
    await expect(playFeedback("correct")).resolves.toBeUndefined();
  });

  it("playFeedback: 全 4 種 kind を順次叩いても safe", async () => {
    const { ctx } = createMockAudioContext("running");
    __resetAudioFeedbackForTest(ctx, true);
    vi.useFakeTimers();
    const ps = Promise.all([
      playFeedback("correct"),
      playFeedback("incorrect"),
      playFeedback("combo"),
      playFeedback("level-up"),
    ]);
    await vi.runAllTimersAsync();
    await ps;
    vi.useRealTimers();
  });
});
