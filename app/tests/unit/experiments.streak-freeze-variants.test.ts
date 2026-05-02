/**
 * experiments.streak-freeze-variants.test.ts (W12-T2.5 / DEC-067)
 *
 * 純関数のユニットテスト:
 *   - STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT 完全列挙 (control = 1 / variant_a = 2)
 *   - resolveStreakFreezeGrantTickets: 既知 / 未知 / 空文字 / fallback safety
 *   - catalog ↔ variants map 一貫性ガード (将来 catalog 拡張時の構造担保)
 */

import { describe, it, expect } from "vitest";
import {
  STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT,
  resolveStreakFreezeGrantTickets,
} from "@/lib/experiments/streak-freeze-variants";
import { EXPERIMENTS } from "@/lib/experiments/experiments-catalog";

describe("STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT", () => {
  it("control = 1 / variant_a = 2 のみ存在 (完全列挙)", () => {
    expect(STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT).toEqual({
      control: 1,
      variant_a: 2,
    });
    expect(Object.keys(STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT)).toHaveLength(2);
  });

  it("値は全て 1 以上 2 以下の整数 (FREEZE_MAX_TICKETS=2 上限尊重)", () => {
    for (const value of Object.values(STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(2);
    }
  });
});

describe("resolveStreakFreezeGrantTickets", () => {
  it('"control" -> 1 枚', () => {
    expect(resolveStreakFreezeGrantTickets("control")).toBe(1);
  });

  it('"variant_a" -> 2 枚', () => {
    expect(resolveStreakFreezeGrantTickets("variant_a")).toBe(2);
  });

  it('未知 variant ("unknown_variant") -> 1 枚 fallback (control 互換 / 安全側)', () => {
    expect(resolveStreakFreezeGrantTickets("unknown_variant")).toBe(1);
  });

  it("空文字 -> 1 枚 fallback", () => {
    expect(resolveStreakFreezeGrantTickets("")).toBe(1);
  });

  it("prototype 系 key (toString / __proto__) は fallback 1 枚 (prototype-pollution 防御)", () => {
    expect(resolveStreakFreezeGrantTickets("toString")).toBe(1);
    expect(resolveStreakFreezeGrantTickets("__proto__")).toBe(1);
    expect(resolveStreakFreezeGrantTickets("hasOwnProperty")).toBe(1);
  });
});

describe("catalog ↔ variants map 一貫性ガード", () => {
  it("EXPERIMENTS.streak_freeze_monthly_grant.variants の各 key が STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT に全件存在する", () => {
    const catalogVariantKeys =
      EXPERIMENTS.streak_freeze_monthly_grant.variants.map((v) => v.key);
    expect(catalogVariantKeys.length).toBeGreaterThan(0);
    for (const variantKey of catalogVariantKeys) {
      expect(
        Object.prototype.hasOwnProperty.call(
          STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT,
          variantKey,
        ),
      ).toBe(true);
    }
  });

  it("catalog の default variant key も map に存在する", () => {
    const defaultKey = EXPERIMENTS.streak_freeze_monthly_grant.default;
    expect(
      Object.prototype.hasOwnProperty.call(
        STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT,
        defaultKey,
      ),
    ).toBe(true);
  });
});
