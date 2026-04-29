/**
 * Unit tests for accessory unlock-engine (W9-T2).
 *
 * 純関数のみテスト対象:
 *  - isAccessoryUnlocked / isCodeUnlocked
 *  - checkUnlocks
 */

import { describe, expect, it } from "vitest";
import { ACCESSORY_CATALOG } from "@/lib/accessories/catalog";
import {
  checkUnlocks,
  isAccessoryUnlocked,
  isCodeUnlocked,
  type UnlockStats,
} from "@/lib/accessories/unlock-engine";

const ZERO_STATS: UnlockStats = {
  level: 1,
  totalXp: 0,
  currentStreak: 0,
  badgeCodes: [],
};

describe("ACCESSORY_CATALOG", () => {
  it("12 種すべて定義されている (3 slot × 4 種)", () => {
    expect(ACCESSORY_CATALOG).toHaveLength(12);
  });

  it("各 slot は 4 種ずつ", () => {
    const bySlot = ACCESSORY_CATALOG.reduce<Record<string, number>>(
      (acc, a) => {
        acc[a.slot] = (acc[a.slot] ?? 0) + 1;
        return acc;
      },
      {},
    );
    expect(bySlot.hat).toBe(4);
    expect(bySlot.scarf).toBe(4);
    expect(bySlot.wing_charm).toBe(4);
  });
});

describe("isAccessoryUnlocked", () => {
  it("level 条件: level >= 必要値 で true", () => {
    const def = ACCESSORY_CATALOG.find((a) => a.code === "hat_school_cap")!;
    expect(isAccessoryUnlocked(def, { ...ZERO_STATS, level: 4 })).toBe(false);
    expect(isAccessoryUnlocked(def, { ...ZERO_STATS, level: 5 })).toBe(true);
  });

  it("streak 条件: currentStreak >= 必要値 で true", () => {
    const def = ACCESSORY_CATALOG.find((a) => a.code === "hat_sakura_crown")!;
    expect(
      isAccessoryUnlocked(def, { ...ZERO_STATS, currentStreak: 6 }),
    ).toBe(false);
    expect(
      isAccessoryUnlocked(def, { ...ZERO_STATS, currentStreak: 7 }),
    ).toBe(true);
  });

  it("xp 条件: totalXp >= 必要値 で true", () => {
    const def = ACCESSORY_CATALOG.find((a) => a.code === "hat_guardian_crown")!;
    expect(isAccessoryUnlocked(def, { ...ZERO_STATS, totalXp: 4999 })).toBe(
      false,
    );
    expect(isAccessoryUnlocked(def, { ...ZERO_STATS, totalXp: 5000 })).toBe(
      true,
    );
  });

  it("badge 条件: badgeCodes 内に該当 code があれば true", () => {
    const def = ACCESSORY_CATALOG.find((a) => a.code === "hat_eiken_pass")!;
    expect(
      isAccessoryUnlocked(def, { ...ZERO_STATS, badgeCodes: [] }),
    ).toBe(false);
    expect(
      isAccessoryUnlocked(def, {
        ...ZERO_STATS,
        badgeCodes: ["first_mock_exam"],
      }),
    ).toBe(true);
  });
});

describe("isCodeUnlocked", () => {
  it("初期状態は wing_charm_bell のみ解禁 (level 1)", () => {
    expect(isCodeUnlocked("wing_charm_bell", ZERO_STATS)).toBe(true);
    expect(isCodeUnlocked("hat_school_cap", ZERO_STATS)).toBe(false);
  });

  it("不正な code は false", () => {
    // @ts-expect-error invalid code
    expect(isCodeUnlocked("nonexistent", ZERO_STATS)).toBe(false);
  });
});

describe("checkUnlocks", () => {
  it("初期状態: wing_charm_bell のみ newly unlock", () => {
    const r = checkUnlocks(ZERO_STATS, []);
    expect(r.newlyUnlocked).toEqual(["wing_charm_bell"]);
    expect(r.allUnlocked).toEqual(["wing_charm_bell"]);
  });

  it("既 unlock は newlyUnlocked から除外", () => {
    const r = checkUnlocks(ZERO_STATS, ["wing_charm_bell"]);
    expect(r.newlyUnlocked).toEqual([]);
    expect(r.allUnlocked).toEqual(["wing_charm_bell"]);
  });

  it("全条件達成時: 12 種全部解禁", () => {
    const r = checkUnlocks(
      {
        level: 99,
        totalXp: 100000,
        currentStreak: 365,
        badgeCodes: ["first_mock_exam", "sakura_keeper"],
      },
      [],
    );
    expect(r.newlyUnlocked).toHaveLength(12);
    expect(r.allUnlocked).toHaveLength(12);
  });

  it("level 5 + streak 7: hat 2 種 + scarf 1 種 + wing_charm 1 種 = 4 種 unlock", () => {
    const r = checkUnlocks(
      {
        level: 5,
        totalXp: 0,
        currentStreak: 7,
        badgeCodes: [],
      },
      [],
    );
    expect(r.newlyUnlocked).toContain("hat_school_cap");
    expect(r.newlyUnlocked).toContain("hat_sakura_crown");
    expect(r.newlyUnlocked).toContain("scarf_red");
    expect(r.newlyUnlocked).toContain("wing_charm_bell");
  });
});
