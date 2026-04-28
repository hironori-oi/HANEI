/**
 * study.confetti.test.ts (W8-T4)
 *
 * canvas-confetti を mock し、intensity / motion-reduced / disabled の挙動を検証。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// canvas-confetti は default export 関数。spy できるよう vi.mock で差し替える
const confettiSpy = vi.fn((..._args: unknown[]): unknown => null);
vi.mock("canvas-confetti", () => ({
  default: (opts: unknown) => confettiSpy(opts),
}));

import {
  __resetConfettiForTest,
  getConfettiOptions,
  getConfettiState,
  isMotionReduced,
  setConfettiEnabled,
  triggerConfetti,
} from "@/lib/study/confetti";

describe("getConfettiOptions / intensity マッピング", () => {
  it("light は particleCount=40", () => {
    expect(getConfettiOptions("light").particleCount).toBe(40);
  });

  it("medium は particleCount=90", () => {
    expect(getConfettiOptions("medium").particleCount).toBe(90);
  });

  it("heavy は particleCount=160", () => {
    expect(getConfettiOptions("heavy").particleCount).toBe(160);
  });

  it("colors に桜ピンクが含まれる (和テイスト)", () => {
    const opts = getConfettiOptions("medium");
    expect(opts.colors).toEqual(
      expect.arrayContaining(["#FFB7C5", "#F7CAD0"]),
    );
  });

  it("HANEI brand color (#F2A93A / #6FE7C9) が含まれる", () => {
    const opts = getConfettiOptions("light");
    expect(opts.colors).toEqual(
      expect.arrayContaining(["#F2A93A", "#6FE7C9"]),
    );
  });
});

describe("isMotionReduced (純関数)", () => {
  beforeEach(() => {
    confettiSpy.mockClear();
  });

  it("window 未定義時 (SSR / vitest node 環境): true (安全側)", () => {
    // node 環境のデフォルト = window 未定義 = true
    expect(isMotionReduced()).toBe(true);
  });
});

describe("triggerConfetti / state controls", () => {
  beforeEach(() => {
    confettiSpy.mockClear();
    __resetConfettiForTest(true);
  });

  it("初期状態は enabled=true", () => {
    expect(getConfettiState().enabled).toBe(true);
  });

  it("setConfettiEnabled(false) → triggerConfetti は skip (confetti() 呼ばれない)", async () => {
    setConfettiEnabled(false);
    await triggerConfetti("medium");
    expect(confettiSpy).not.toHaveBeenCalled();
  });

  it("motion-reduced 時は skip (window 未定義 = true)", async () => {
    __resetConfettiForTest(true);
    // node 環境 = window 未定義 = isMotionReduced returns true
    await triggerConfetti("light");
    expect(confettiSpy).not.toHaveBeenCalled();
  });

  it("window があり motion-reduce ではない場合のみ confetti が呼ばれる", async () => {
    __resetConfettiForTest(true);
    // window をテスト内だけ生やす + matchMedia=false
    const orig = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      matchMedia: (q: string) => ({
        matches: false,
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    };
    try {
      await triggerConfetti("medium");
      expect(confettiSpy).toHaveBeenCalledTimes(1);
      const call = confettiSpy.mock.calls[0];
      expect(call?.[0]).toEqual(
        expect.objectContaining({ particleCount: 90 }),
      );
    } finally {
      if (orig === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = orig;
      }
    }
  });

  it("triggerConfetti: 内部 throw が UX に伝播しない", async () => {
    confettiSpy.mockImplementationOnce(() => {
      throw new Error("simulated rendering failure");
    });
    const orig = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      matchMedia: () => ({ matches: false }),
    };
    try {
      await expect(triggerConfetti("heavy")).resolves.toBeUndefined();
    } finally {
      if (orig === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = orig;
      }
    }
  });

  it("default intensity は medium", async () => {
    __resetConfettiForTest(true);
    const orig = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      matchMedia: () => ({ matches: false }),
    };
    try {
      await triggerConfetti();
      expect(confettiSpy).toHaveBeenCalledTimes(1);
      expect((confettiSpy.mock.calls[0] as unknown[] | undefined)?.[0]).toEqual(
        expect.objectContaining({ particleCount: 90 }),
      );
    } finally {
      if (orig === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = orig;
      }
    }
  });
});
