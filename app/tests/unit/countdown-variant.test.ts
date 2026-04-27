/**
 * countdown-variant.test.ts (W6 / F-4)
 *
 * pickCountdownVariant の境界値テスト。
 *
 * variant 境界:
 *  - null → "far"
 *  - daysUntil < 0 → "after"
 *  - 0 → "today"
 *  - 1 → "final1"
 *  - 2..3 → "final3"
 *  - 4..7 → "week"
 *  - 8..30 → "month"
 *  - 31+ → "far"
 */

import { describe, it, expect } from "vitest";

import { pickCountdownVariant } from "@/lib/study/countdown-variant";

describe("pickCountdownVariant()", () => {
  it("null は 'far' (未設定 = 余裕扱い)", () => {
    expect(pickCountdownVariant(null)).toBe("far");
  });

  it("負の値は 'after' (受験日後)", () => {
    expect(pickCountdownVariant(-1)).toBe("after");
    expect(pickCountdownVariant(-30)).toBe("after");
  });

  it("0 は 'today' (当日)", () => {
    expect(pickCountdownVariant(0)).toBe("today");
  });

  it("1 は 'final1' (明日が本番)", () => {
    expect(pickCountdownVariant(1)).toBe("final1");
  });

  it("2 と 3 は 'final3'", () => {
    expect(pickCountdownVariant(2)).toBe("final3");
    expect(pickCountdownVariant(3)).toBe("final3");
  });

  it("4 〜 7 は 'week'", () => {
    expect(pickCountdownVariant(4)).toBe("week");
    expect(pickCountdownVariant(7)).toBe("week");
  });

  it("8 と 30 は 'month'", () => {
    expect(pickCountdownVariant(8)).toBe("month");
    expect(pickCountdownVariant(30)).toBe("month");
  });

  it("31 以上は 'far'", () => {
    expect(pickCountdownVariant(31)).toBe("far");
    expect(pickCountdownVariant(100)).toBe("far");
    expect(pickCountdownVariant(365)).toBe("far");
  });

  it("マイルストーン境界の一貫性: D-7 → 'week' / D-8 → 'month'", () => {
    expect(pickCountdownVariant(7)).toBe("week");
    expect(pickCountdownVariant(8)).toBe("month");
  });

  it("マイルストーン境界の一貫性: D-3 → 'final3' / D-4 → 'week'", () => {
    expect(pickCountdownVariant(3)).toBe("final3");
    expect(pickCountdownVariant(4)).toBe("week");
  });

  it("マイルストーン境界の一貫性: D-30 → 'month' / D-31 → 'far'", () => {
    expect(pickCountdownVariant(30)).toBe("month");
    expect(pickCountdownVariant(31)).toBe("far");
  });
});
