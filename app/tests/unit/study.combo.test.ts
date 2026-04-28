/**
 * study.combo.test.ts (W8-T2)
 *
 * 純関数のユニットテスト:
 *   - calculateComboMultiplier: tier 境界 (0 / 3 / 5 / 10) と倍率
 *   - nextComboCount: 正解 +1 / 不正解 0 リセット
 *   - applyComboToXp: XP に乗算
 *   - isComboTierUpgrade: tier 上昇瞬間検知
 */

import { describe, it, expect } from "vitest";
import {
  calculateComboMultiplier,
  nextComboCount,
  applyComboToXp,
  isComboTierUpgrade,
  COMBO_THRESHOLD_TIER1,
  COMBO_THRESHOLD_TIER2,
  COMBO_THRESHOLD_TIER3,
} from "@/lib/study/combo";

describe("calculateComboMultiplier()", () => {
  it("0/1/2 連は tier 0 / 1.0x", () => {
    expect(calculateComboMultiplier(0)).toEqual({ multiplier: 1.0, tier: 0 });
    expect(calculateComboMultiplier(1)).toEqual({ multiplier: 1.0, tier: 0 });
    expect(calculateComboMultiplier(2)).toEqual({ multiplier: 1.0, tier: 0 });
  });

  it("3 連で tier 1 / 1.5x", () => {
    expect(calculateComboMultiplier(COMBO_THRESHOLD_TIER1)).toEqual({
      multiplier: 1.5,
      tier: 1,
    });
    expect(calculateComboMultiplier(4)).toEqual({ multiplier: 1.5, tier: 1 });
  });

  it("5 連で tier 2 / 2.0x", () => {
    expect(calculateComboMultiplier(COMBO_THRESHOLD_TIER2)).toEqual({
      multiplier: 2.0,
      tier: 2,
    });
    expect(calculateComboMultiplier(7)).toEqual({ multiplier: 2.0, tier: 2 });
    expect(calculateComboMultiplier(9)).toEqual({ multiplier: 2.0, tier: 2 });
  });

  it("10 連で tier 3 / 3.0x", () => {
    expect(calculateComboMultiplier(COMBO_THRESHOLD_TIER3)).toEqual({
      multiplier: 3.0,
      tier: 3,
    });
    expect(calculateComboMultiplier(50)).toEqual({ multiplier: 3.0, tier: 3 });
  });

  it("負数 / NaN は tier 0 (防御的)", () => {
    expect(calculateComboMultiplier(-1)).toEqual({ multiplier: 1.0, tier: 0 });
    expect(calculateComboMultiplier(Number.NaN)).toEqual({
      multiplier: 1.0,
      tier: 0,
    });
  });
});

describe("nextComboCount()", () => {
  it("正解で +1", () => {
    expect(nextComboCount(0, true)).toBe(1);
    expect(nextComboCount(4, true)).toBe(5);
    expect(nextComboCount(9, true)).toBe(10);
  });

  it("不正解で 0 リセット", () => {
    expect(nextComboCount(0, false)).toBe(0);
    expect(nextComboCount(7, false)).toBe(0);
    expect(nextComboCount(20, false)).toBe(0);
  });

  it("負数 / NaN previous は 0 として扱う", () => {
    expect(nextComboCount(-5, true)).toBe(1);
    expect(nextComboCount(Number.NaN, true)).toBe(1);
  });
});

describe("applyComboToXp()", () => {
  it("baseXp=10, combo=0 -> 10 XP / 1.0x", () => {
    const r = applyComboToXp(10, 0);
    expect(r.xp).toBe(10);
    expect(r.multiplier).toBe(1.0);
    expect(r.tier).toBe(0);
  });

  it("baseXp=10, combo=3 -> 15 XP / tier 1", () => {
    const r = applyComboToXp(10, 3);
    expect(r.xp).toBe(15);
    expect(r.multiplier).toBe(1.5);
    expect(r.tier).toBe(1);
  });

  it("baseXp=10, combo=5 -> 20 XP / tier 2", () => {
    const r = applyComboToXp(10, 5);
    expect(r.xp).toBe(20);
    expect(r.tier).toBe(2);
  });

  it("baseXp=10, combo=10 -> 30 XP / tier 3", () => {
    const r = applyComboToXp(10, 10);
    expect(r.xp).toBe(30);
    expect(r.tier).toBe(3);
  });

  it("baseXp=1 (不正解 fallback) は combo に依らず 1", () => {
    expect(applyComboToXp(1, 0).xp).toBe(1);
    // 仕様: 不正解時は呼び出し側で combo を使わない方針だが、
    // 関数自体は素直に 1 * 倍率 を計算する (tier 0 なら 1)
    expect(applyComboToXp(1, 2).xp).toBe(1);
  });

  it("baseXp が 0 / 負数 / NaN の場合は 0 XP", () => {
    expect(applyComboToXp(0, 5).xp).toBe(0);
    expect(applyComboToXp(-3, 5).xp).toBe(0);
    expect(applyComboToXp(Number.NaN, 5).xp).toBe(0);
  });

  it("丸め: baseXp=7, combo=3 -> 7*1.5=10.5 -> 11 (round)", () => {
    expect(applyComboToXp(7, 3).xp).toBe(11);
  });
});

describe("isComboTierUpgrade()", () => {
  it("2 -> 3 は tier 0 -> 1 で upgrade=true", () => {
    expect(isComboTierUpgrade(2, 3)).toBe(true);
  });

  it("4 -> 5 は tier 1 -> 2 で upgrade=true", () => {
    expect(isComboTierUpgrade(4, 5)).toBe(true);
  });

  it("9 -> 10 は tier 2 -> 3 で upgrade=true", () => {
    expect(isComboTierUpgrade(9, 10)).toBe(true);
  });

  it("3 -> 4 は同じ tier 1 で upgrade=false", () => {
    expect(isComboTierUpgrade(3, 4)).toBe(false);
  });

  it("0 -> 0 (不正解 連続) は upgrade=false", () => {
    expect(isComboTierUpgrade(0, 0)).toBe(false);
  });

  it("5 -> 0 (不正解で reset) は downgrade なので upgrade=false", () => {
    expect(isComboTierUpgrade(5, 0)).toBe(false);
  });
});
