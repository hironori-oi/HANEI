/**
 * Unit tests: src/lib/study/family-streak-rollover.ts (W11-T1 / 家族のれんぞく)
 *
 * 純関数の不変条件 (DEC-024 罰則ゼロ哲学 / DEC-055 idempotency / 兄弟救済の本旨整合):
 *   - 同日 2 回目: shouldUpdate=false (兄弟救済の冪等性)
 *   - 連続日 (= lastFamilyActiveDate が前日): newDays = prev + 1
 *   - lastFamilyActiveDate=null (初学習): newDays = 1
 *   - 1 日空き (前々日 active): reset → newDays = 1
 *   - 複数日空き: reset → newDays = 1
 *   - JST 境界跨ぎ: getJstQuestDate と整合 (前日演算は dateStr 単位の引き算なので OK)
 */

import { describe, expect, it } from "vitest";

import {
  computeFamilyStreakRollover,
  previousQuestDate,
} from "@/lib/study/family-streak-rollover";
import { getJstQuestDate, jstQuestDayStartUtc } from "@/lib/quest/jst-date";

describe("previousQuestDate", () => {
  it("通常日の前日を返す", () => {
    expect(previousQuestDate("2026-05-01")).toBe("2026-04-30");
    expect(previousQuestDate("2026-05-15")).toBe("2026-05-14");
  });
  it("月跨ぎ", () => {
    expect(previousQuestDate("2026-06-01")).toBe("2026-05-31");
    expect(previousQuestDate("2026-03-01")).toBe("2026-02-28");
  });
  it("年跨ぎ", () => {
    expect(previousQuestDate("2026-01-01")).toBe("2025-12-31");
  });
  it("うるう年跨ぎ", () => {
    expect(previousQuestDate("2024-03-01")).toBe("2024-02-29");
  });
  it("invalid 形式は throw", () => {
    expect(() => previousQuestDate("2026-5-1")).toThrow();
    expect(() => previousQuestDate("invalid")).toThrow();
    expect(() => previousQuestDate("")).toThrow();
  });
});

describe("computeFamilyStreakRollover", () => {
  it("同日 2 回目は no-op (shouldUpdate=false / 兄弟救済の冪等性)", () => {
    const result = computeFamilyStreakRollover(
      { familyStreakDays: 5, lastFamilyActiveDate: "2026-05-01" },
      "2026-05-01",
    );
    expect(result.newDays).toBe(5);
    expect(result.shouldUpdate).toBe(false);
  });

  it("同日 2 回目 (streak=1) も no-op", () => {
    const result = computeFamilyStreakRollover(
      { familyStreakDays: 1, lastFamilyActiveDate: "2026-05-01" },
      "2026-05-01",
    );
    expect(result.newDays).toBe(1);
    expect(result.shouldUpdate).toBe(false);
  });

  it("連続日 (前日 active) は +1 / shouldUpdate=true", () => {
    const result = computeFamilyStreakRollover(
      { familyStreakDays: 3, lastFamilyActiveDate: "2026-04-30" },
      "2026-05-01",
    );
    expect(result.newDays).toBe(4);
    expect(result.shouldUpdate).toBe(true);
  });

  it("連続日 (1 日目 → 2 日目)", () => {
    const result = computeFamilyStreakRollover(
      { familyStreakDays: 1, lastFamilyActiveDate: "2026-04-30" },
      "2026-05-01",
    );
    expect(result.newDays).toBe(2);
    expect(result.shouldUpdate).toBe(true);
  });

  it("初回 (lastFamilyActiveDate=null) → 1 / shouldUpdate=true", () => {
    const result = computeFamilyStreakRollover(
      { familyStreakDays: 0, lastFamilyActiveDate: null },
      "2026-05-01",
    );
    expect(result.newDays).toBe(1);
    expect(result.shouldUpdate).toBe(true);
  });

  it("1 日空き (前々日 active) は reset → 1 / shouldUpdate=true", () => {
    const result = computeFamilyStreakRollover(
      { familyStreakDays: 7, lastFamilyActiveDate: "2026-04-29" },
      "2026-05-01",
    );
    expect(result.newDays).toBe(1);
    expect(result.shouldUpdate).toBe(true);
  });

  it("複数日空き reset → 1", () => {
    const result = computeFamilyStreakRollover(
      { familyStreakDays: 30, lastFamilyActiveDate: "2026-04-15" },
      "2026-05-01",
    );
    expect(result.newDays).toBe(1);
    expect(result.shouldUpdate).toBe(true);
  });

  it("JST 境界跨ぎ: getJstQuestDate と previousQuestDate が連続性を保つ", () => {
    // JST 6:00 を境に「前日」「当日」が切り替わる. 連続として扱える境界条件.
    // 2026-04-30 06:00 JST = 2026-04-29 21:00 UTC → quest_date = '2026-04-30'
    const todayJst6 = jstQuestDayStartUtc("2026-04-30");
    const todayDate = getJstQuestDate(todayJst6);
    expect(todayDate).toBe("2026-04-30");

    // 前日 (= 2026-04-29 06:00 JST) に学習していたとして +1 を期待
    const yesterdayDate = getJstQuestDate(jstQuestDayStartUtc("2026-04-29"));
    expect(yesterdayDate).toBe("2026-04-29");

    const result = computeFamilyStreakRollover(
      { familyStreakDays: 2, lastFamilyActiveDate: yesterdayDate },
      todayDate,
    );
    expect(result.newDays).toBe(3);
    expect(result.shouldUpdate).toBe(true);
  });

  it("JST 5:59 直前は前日扱い (= 翌日として +1 にならない)", () => {
    // 5:59 JST は前日 quest_date. 「同日」の扱いになる境界条件.
    // last=前日 quest_date / now=5:59 JST → quest_date が同じ前日 → no-op (同日 2 回目)
    // 2026-05-01 05:59 JST = 2026-04-30 20:59 UTC → quest_date = '2026-04-30'
    const fiveFiftyNineJst = new Date(
      Date.UTC(2026, 4, 1, 5, 59, 0) - 9 * 60 * 60 * 1000,
    );
    expect(getJstQuestDate(fiveFiftyNineJst)).toBe("2026-04-30");
  });

  it("invalid todayDate は throw", () => {
    expect(() =>
      computeFamilyStreakRollover(
        { familyStreakDays: 0, lastFamilyActiveDate: null },
        "invalid",
      ),
    ).toThrow();
    expect(() =>
      computeFamilyStreakRollover(
        { familyStreakDays: 0, lastFamilyActiveDate: null },
        "2026-5-1",
      ),
    ).toThrow();
  });

  it("負値 familyStreakDays は 0 floor (防御的)", () => {
    const result = computeFamilyStreakRollover(
      { familyStreakDays: -5, lastFamilyActiveDate: "2026-05-01" },
      "2026-05-01",
    );
    expect(result.newDays).toBe(0);
    expect(result.shouldUpdate).toBe(false);
  });
});
