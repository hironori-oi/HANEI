/**
 * HANEI W10-T3: lib/quest/jst-date.ts 純関数の単体テスト。
 *
 * 戦略:
 *   - JST 6:00 境界の前後で quest_date が翌日に切り替わることを検証
 *   - 純関数 (DB I/O ゼロ)
 *   - 子ども × 朝起きてから取り組むという生活リズム前提の境界仕様
 */

import { describe, it, expect } from "vitest";
import {
  getJstQuestDate,
  isQuestDateString,
  jstQuestDayStartUtc,
} from "@/lib/quest/jst-date";

describe("quest/jst-date", () => {
  describe("getJstQuestDate", () => {
    it("JST 6:00 境界より前 (5:59 JST) は前日扱い", () => {
      // 2026-04-30 05:59 JST = 2026-04-29 20:59 UTC
      const utc = new Date(Date.UTC(2026, 3, 29, 20, 59, 0));
      expect(getJstQuestDate(utc)).toBe("2026-04-29");
    });

    it("JST 6:00 ちょうどは当日扱い", () => {
      // 2026-04-30 06:00 JST = 2026-04-29 21:00 UTC
      const utc = new Date(Date.UTC(2026, 3, 29, 21, 0, 0));
      expect(getJstQuestDate(utc)).toBe("2026-04-30");
    });

    it("JST 23:59 は当日のままで日付が変わらない", () => {
      // 2026-04-30 23:59 JST = 2026-04-30 14:59 UTC
      const utc = new Date(Date.UTC(2026, 3, 30, 14, 59, 0));
      expect(getJstQuestDate(utc)).toBe("2026-04-30");
    });

    it("JST 翌日 5:59 (深夜まで起きていた場合) もまだ前日扱い", () => {
      // 2026-05-01 05:59 JST = 2026-04-30 20:59 UTC
      const utc = new Date(Date.UTC(2026, 3, 30, 20, 59, 0));
      expect(getJstQuestDate(utc)).toBe("2026-04-30");
    });

    it("JST 翌日 6:00 でようやく日付が次に切り替わる", () => {
      // 2026-05-01 06:00 JST = 2026-04-30 21:00 UTC
      const utc = new Date(Date.UTC(2026, 3, 30, 21, 0, 0));
      expect(getJstQuestDate(utc)).toBe("2026-05-01");
    });

    it("月またぎでも正しく日付が切り替わる", () => {
      // 2026-05-01 06:00 JST → '2026-05-01'
      const utc = new Date(Date.UTC(2026, 3, 30, 21, 0, 0));
      expect(getJstQuestDate(utc)).toBe("2026-05-01");
    });

    it("年またぎでも正しく日付が切り替わる", () => {
      // 2027-01-01 06:00 JST = 2026-12-31 21:00 UTC
      const utc = new Date(Date.UTC(2026, 11, 31, 21, 0, 0));
      expect(getJstQuestDate(utc)).toBe("2027-01-01");
    });

    it("無効な Date を渡すと TypeError", () => {
      expect(() => getJstQuestDate(new Date("not-a-date"))).toThrow(TypeError);
    });
  });

  describe("isQuestDateString", () => {
    it("'YYYY-MM-DD' 形式のみ true", () => {
      expect(isQuestDateString("2026-04-30")).toBe(true);
      expect(isQuestDateString("2026-4-30")).toBe(false);
      expect(isQuestDateString("2026/04/30")).toBe(false);
      expect(isQuestDateString("")).toBe(false);
      expect(isQuestDateString(null)).toBe(false);
      expect(isQuestDateString(undefined)).toBe(false);
      expect(isQuestDateString(123)).toBe(false);
    });
  });

  describe("jstQuestDayStartUtc", () => {
    it("'2026-04-30' に対する quest 日の境界は JST 06:00 = UTC 21:00 of previous day", () => {
      const start = jstQuestDayStartUtc("2026-04-30");
      // expected: 2026-04-29 21:00 UTC
      expect(start.toISOString()).toBe("2026-04-29T21:00:00.000Z");
    });

    it("無効な date string は TypeError", () => {
      expect(() => jstQuestDayStartUtc("invalid")).toThrow(TypeError);
    });

    it("getJstQuestDate と双対 (start + 1ms 後は当該日の Quest 日付)", () => {
      const date = "2026-04-30";
      const startUtc = jstQuestDayStartUtc(date);
      const justAfter = new Date(startUtc.getTime() + 1);
      expect(getJstQuestDate(justAfter)).toBe(date);
      const justBefore = new Date(startUtc.getTime() - 1);
      expect(getJstQuestDate(justBefore)).not.toBe(date);
    });
  });
});
