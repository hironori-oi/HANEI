/**
 * audio.sound-effects.test.ts (DEC-088 Plan B / 項目 2)
 *
 * `lib/audio/sound-effects` の Howler ラッパを検証する.
 *
 * 環境: node 環境 (vitest default) で window を minimal polyfill する.
 *  - jsdom を依存に追加しない方針
 *  - module は window / matchMedia / dynamic import("howler") に依存
 *
 * 検証ポイント:
 *  1. setSoundEffectsEnabled(false) で playSoundEffect が false (silent skip)
 *  2. prefers-reduced-motion: reduce で false
 *  3. enabled + non-reduced + howler ロード成功 → true / Howl 生成 / play 呼出
 *  4. 同名 sound は Howl singleton 再利用
 *  5. 異なる name は別 Howl 生成
 *  6. Howl コンストラクタが throw しても false (silent fail)
 *  7. SSR (window 不在) で false
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// howler を mock
const playSpy = vi.fn();
const HowlMock = vi.fn().mockImplementation(() => ({
  play: playSpy,
}));

vi.mock("howler", () => ({
  Howl: HowlMock,
}));

import {
  playSoundEffect,
  setSoundEffectsEnabled,
  getSoundEffectsState,
  __resetSoundEffectsForTest,
} from "@/lib/audio/sound-effects";

function installWindow(opts: { reduced?: boolean } = {}) {
  const { reduced = false } = opts;
  // @ts-expect-error - test 用 minimal window stub
  globalThis.window = {
    matchMedia: (query: string) => ({
      matches: reduced && query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  };
}

function uninstallWindow() {
  // @ts-expect-error - test cleanup
  delete globalThis.window;
}

describe("sound-effects - setSoundEffectsEnabled / playSoundEffect", () => {
  beforeEach(() => {
    __resetSoundEffectsForTest(true);
    HowlMock.mockClear();
    playSpy.mockClear();
    installWindow({ reduced: false });
  });

  afterEach(() => {
    uninstallWindow();
  });

  it("disabled (= false) なら silent skip → false を返す", async () => {
    setSoundEffectsEnabled(false);
    const ok = await playSoundEffect("correct");
    expect(ok).toBe(false);
    expect(HowlMock).not.toHaveBeenCalled();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("prefers-reduced-motion: reduce なら silent skip → false", async () => {
    setSoundEffectsEnabled(true);
    installWindow({ reduced: true });
    const ok = await playSoundEffect("correct");
    expect(ok).toBe(false);
    expect(HowlMock).not.toHaveBeenCalled();
  });

  it("enabled + non-reduced で Howl が生成され play される (true)", async () => {
    setSoundEffectsEnabled(true);
    const ok = await playSoundEffect("correct");
    expect(ok).toBe(true);
    expect(HowlMock).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalledTimes(1);
    // 罰則ゼロ哲学: volume=0.6 (大音量警告ゼロ)
    expect(HowlMock).toHaveBeenCalledWith(
      expect.objectContaining({ volume: 0.6 }),
    );
  });

  it("同名 sound の 2 回目以降は Howl singleton 再利用 (Howl 生成は 1 回のみ)", async () => {
    setSoundEffectsEnabled(true);
    await playSoundEffect("correct");
    await playSoundEffect("correct");
    await playSoundEffect("correct");
    expect(HowlMock).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalledTimes(3);
  });

  it("異なる name は別 Howl が生成される", async () => {
    setSoundEffectsEnabled(true);
    await playSoundEffect("correct");
    await playSoundEffect("wrong");
    await playSoundEffect("levelup");
    expect(HowlMock).toHaveBeenCalledTimes(3);
  });

  it("getSoundEffectsState で loaded 一覧を取得できる", async () => {
    setSoundEffectsEnabled(true);
    await playSoundEffect("correct");
    await playSoundEffect("complete");
    const s = getSoundEffectsState();
    expect(s.enabled).toBe(true);
    expect(new Set(s.loadedNames)).toEqual(new Set(["correct", "complete"]));
  });

  it("Howl コンストラクタが throw しても silent skip (false 返却 / 学習体験を壊さない)", async () => {
    setSoundEffectsEnabled(true);
    HowlMock.mockImplementationOnce(() => {
      throw new Error("audio context blocked");
    });
    const ok = await playSoundEffect("correct");
    expect(ok).toBe(false);
  });
});

describe("sound-effects - SSR (window 不在)", () => {
  beforeEach(() => {
    __resetSoundEffectsForTest(true);
    uninstallWindow();
  });

  it("window 不在では false (Howl 不生成)", async () => {
    const ok = await playSoundEffect("correct");
    expect(ok).toBe(false);
  });
});
