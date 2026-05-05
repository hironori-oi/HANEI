/**
 * study.audio-gate.eiken3.test.ts (W12-T5 / DEC-079)
 *
 * eiken-3 listening の audio_url が L3-XXX-nova.mp3 形式で
 * shouldShowAudioUi gate を通ることを確認する補強テスト。
 *
 * 既存 study.audio-gate.test.ts (W5 / G-2) は一般的な truthy / skill check を
 * カバーしているため、本ファイルでは β 開始 19 項目判定 (DEC-074 §6) の
 * 「リスニング音源最低 1 セット seed 投入」前提で生成される実 URL 形式と
 * skill (listening) の組み合わせのみを集中検査する。
 */

import { describe, it, expect } from "vitest";
import { shouldShowAudioUi } from "@/lib/study/audio-gate";

describe("shouldShowAudioUi() / eiken-3 listening (DEC-079)", () => {
  it("L3-001-nova.mp3 形式 + listening で true", () => {
    expect(
      shouldShowAudioUi(
        "https://example.com/tts/v1/L3-001-nova.mp3",
        "listening",
      ),
    ).toBe(true);
  });

  it("L3-020-nova.mp3 形式 + listening で true", () => {
    expect(
      shouldShowAudioUi(
        "https://example.com/tts/v1/L3-020-nova.mp3",
        "listening",
      ),
    ).toBe(true);
  });

  it("空文字 + listening で false", () => {
    expect(shouldShowAudioUi("", "listening")).toBe(false);
  });

  it("L3-XXX-nova.mp3 形式 + vocabulary では false (skill gate)", () => {
    expect(
      shouldShowAudioUi(
        "https://example.com/tts/v1/L3-001-nova.mp3",
        "vocabulary",
      ),
    ).toBe(false);
  });

  it("null + listening で false", () => {
    expect(shouldShowAudioUi(null, "listening")).toBe(false);
  });
});
