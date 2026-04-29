/**
 * Unit tests for message placeholder resolver (W9-T5).
 *
 * 純関数のみテスト対象:
 *  - resolvePlaceholders
 *  - hasPlaceholder
 */

import { describe, expect, it } from "vitest";
import {
  hasPlaceholder,
  resolvePlaceholders,
} from "@/lib/messages/resolve-placeholders";

describe("resolvePlaceholders", () => {
  it("{exam_days} を数値で置換", () => {
    expect(
      resolvePlaceholders("しけんまで あと {exam_days} 日。", { examDays: 7 }),
    ).toBe("しけんまで あと 7 日。");
  });

  it("{streak_days} を数値で置換", () => {
    expect(
      resolvePlaceholders("いま {streak_days} 日 つづいています。", {
        streakDays: 14,
      }),
    ).toBe("いま 14 日 つづいています。");
  });

  it("{streak_days} が 0 / null は「きょう」に置換", () => {
    expect(
      resolvePlaceholders("れんぞく {streak_days} 日。", { streakDays: 0 }),
    ).toBe("れんぞく きょう 日。");
    expect(
      resolvePlaceholders("れんぞく {streak_days} 日。", { streakDays: null }),
    ).toBe("れんぞく きょう 日。");
  });

  it("{exam_days} が null は「もうすぐ」に置換", () => {
    expect(
      resolvePlaceholders("あと {exam_days} 日。", { examDays: null }),
    ).toBe("あと もうすぐ 日。");
  });

  it("{exam_days} が負数は 0 (当日扱い)", () => {
    expect(
      resolvePlaceholders("あと {exam_days} 日。", { examDays: -3 }),
    ).toBe("あと 0 日。");
  });

  it("複数 placeholder を全て置換", () => {
    expect(
      resolvePlaceholders(
        "{streak_days} 日 つづいてる。しけんまで {exam_days} 日。",
        { streakDays: 5, examDays: 30 },
      ),
    ).toBe("5 日 つづいてる。しけんまで 30 日。");
  });

  it("同じ placeholder 複数回出現も全て置換", () => {
    expect(
      resolvePlaceholders("{exam_days} 日 / {exam_days} 日。", {
        examDays: 10,
      }),
    ).toBe("10 日 / 10 日。");
  });

  it("未知の placeholder は元のまま", () => {
    expect(
      resolvePlaceholders("{unknown} と {exam_days}。", { examDays: 1 }),
    ).toBe("{unknown} と 1。");
  });

  it("ctx 未指定は両方フォールバック", () => {
    expect(
      resolvePlaceholders("{streak_days} 日 / {exam_days} 日"),
    ).toBe("きょう 日 / もうすぐ 日");
  });

  it("body が文字列以外は空文字を返す", () => {
    // @ts-expect-error invalid type
    expect(resolvePlaceholders(null, {})).toBe("");
    // @ts-expect-error invalid type
    expect(resolvePlaceholders(undefined, {})).toBe("");
  });

  it("Infinity / NaN は安全にフォールバック", () => {
    expect(
      resolvePlaceholders("{streak_days} 日。", { streakDays: Number.NaN }),
    ).toBe("きょう 日。");
    expect(
      resolvePlaceholders("{exam_days} 日。", { examDays: Number.POSITIVE_INFINITY }),
    ).toBe("もうすぐ 日。");
  });
});

describe("hasPlaceholder", () => {
  it("{streak_days} を含むと true", () => {
    expect(hasPlaceholder("いま {streak_days} 日。")).toBe(true);
  });

  it("{exam_days} を含むと true", () => {
    expect(hasPlaceholder("あと {exam_days} 日。")).toBe(true);
  });

  it("placeholder なしは false", () => {
    expect(hasPlaceholder("おうえんしています。")).toBe(false);
  });

  it("文字列以外は false", () => {
    // @ts-expect-error invalid type
    expect(hasPlaceholder(null)).toBe(false);
    // @ts-expect-error invalid type
    expect(hasPlaceholder(123)).toBe(false);
  });
});
