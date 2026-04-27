/**
 * study.audio-gate.test.ts (W5 / G-2)
 *
 * listening 音声 UI 表示判定 + replay 上限の純関数テスト。
 */

import { describe, it, expect } from "vitest";
import { shouldShowAudioUi, canReplay, MAX_REPLAY } from "@/lib/study/audio-gate";

describe("shouldShowAudioUi()", () => {
  it("listening + audioUrl ありで true", () => {
    expect(shouldShowAudioUi("https://r2/foo.mp3", "listening")).toBe(true);
  });

  it("listening + audioUrl なし (null) で false", () => {
    expect(shouldShowAudioUi(null, "listening")).toBe(false);
  });

  it("listening + audioUrl なし (undefined) で false", () => {
    expect(shouldShowAudioUi(undefined, "listening")).toBe(false);
  });

  it("listening + audioUrl 空文字で false", () => {
    expect(shouldShowAudioUi("", "listening")).toBe(false);
  });

  it("vocabulary 等の他 skill では audioUrl があっても false", () => {
    expect(shouldShowAudioUi("https://r2/foo.mp3", "vocabulary")).toBe(false);
    expect(shouldShowAudioUi("https://r2/foo.mp3", "grammar")).toBe(false);
    expect(shouldShowAudioUi("https://r2/foo.mp3", "reading")).toBe(false);
  });

  it("skill が undefined / null でも false", () => {
    expect(shouldShowAudioUi("https://r2/foo.mp3", undefined)).toBe(false);
    expect(shouldShowAudioUi("https://r2/foo.mp3", null)).toBe(false);
  });
});

describe("canReplay()", () => {
  it("0 回時点では再生可能", () => {
    expect(canReplay(0)).toBe(true);
  });

  it("MAX_REPLAY-1 回まで再生可能", () => {
    expect(canReplay(MAX_REPLAY - 1)).toBe(true);
  });

  it("MAX_REPLAY 回到達で再生不可", () => {
    expect(canReplay(MAX_REPLAY)).toBe(false);
    expect(canReplay(MAX_REPLAY + 5)).toBe(false);
  });

  it("MAX_REPLAY は 3 (Phase 1 設計値)", () => {
    expect(MAX_REPLAY).toBe(3);
  });
});
