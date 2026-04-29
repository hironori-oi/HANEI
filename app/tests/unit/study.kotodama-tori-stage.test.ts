/**
 * Unit tests for kotodama-tori 5-stage evolution (W9-T1).
 *
 * 純関数のみテスト対象:
 *  - getKotodamaStage: input -> stage
 *  - detectEvolution:  prev/curr -> EvolutionDelta
 *  - describeKotodamaStage: input -> KotodamaStageInfo
 */

import { describe, expect, it } from "vitest";
import {
  describeKotodamaStage,
  detectEvolution,
  getAllKotodamaStages,
  getKotodamaStage,
  getKotodamaStageLabel,
} from "@/lib/study/kotodama-tori-stage";
import {
  FIRST_MOCK_EXAM_BADGE_CODE,
  SAKURA_KEEPER_BADGE_CODE,
} from "@/lib/badges/badge-codes";

describe("getKotodamaStage", () => {
  it("初期値は hina", () => {
    expect(
      getKotodamaStage({ totalXp: 0, currentStreak: 0, badgeCount: 0 }),
    ).toBe("hina");
  });

  it("XP=100 で wakatori に進化", () => {
    expect(
      getKotodamaStage({ totalXp: 100, currentStreak: 0, badgeCount: 0 }),
    ).toBe("wakatori");
  });

  it("streak=3 でも wakatori に進化", () => {
    expect(
      getKotodamaStage({ totalXp: 0, currentStreak: 3, badgeCount: 0 }),
    ).toBe("wakatori");
  });

  it("XP=500 で seityo に進化", () => {
    expect(
      getKotodamaStage({ totalXp: 500, currentStreak: 0, badgeCount: 0 }),
    ).toBe("seityo");
  });

  it("badgeCount=4 でも seityo に進化", () => {
    expect(
      getKotodamaStage({ totalXp: 0, currentStreak: 0, badgeCount: 4 }),
    ).toBe("seityo");
  });

  it("XP=1500 で kenzya に進化", () => {
    expect(
      getKotodamaStage({ totalXp: 1500, currentStreak: 0, badgeCount: 0 }),
    ).toBe("kenzya");
  });

  it("streak=30 でも kenzya に進化", () => {
    expect(
      getKotodamaStage({ totalXp: 0, currentStreak: 30, badgeCount: 0 }),
    ).toBe("kenzya");
  });

  it("first_mock_exam badge でも kenzya に進化", () => {
    expect(
      getKotodamaStage({
        totalXp: 0,
        currentStreak: 0,
        badgeCount: 1,
        badgeCodes: [FIRST_MOCK_EXAM_BADGE_CODE],
      }),
    ).toBe("kenzya");
  });

  it("XP=5000 + sakura_keeper badge で syugosin に進化", () => {
    expect(
      getKotodamaStage({
        totalXp: 5000,
        currentStreak: 30,
        badgeCount: 8,
        badgeCodes: [SAKURA_KEEPER_BADGE_CODE],
      }),
    ).toBe("syugosin");
  });

  it("XP=5000 だけでは syugosin にならない (sakura_keeper 必須)", () => {
    expect(
      getKotodamaStage({
        totalXp: 5000,
        currentStreak: 0,
        badgeCount: 0,
        badgeCodes: [],
      }),
    ).toBe("kenzya");
  });

  it("不正な数値 (NaN, 負数) は 0 として扱う", () => {
    expect(
      getKotodamaStage({
        totalXp: Number.NaN,
        currentStreak: -1,
        badgeCount: -10,
      }),
    ).toBe("hina");
  });
});

describe("detectEvolution", () => {
  it("hina → wakatori で進化判定", () => {
    expect(detectEvolution("hina", "wakatori")).toEqual({
      evolved: true,
      toStage: "wakatori",
      fromStage: "hina",
    });
  });

  it("同段階は進化しない", () => {
    expect(detectEvolution("seityo", "seityo")).toEqual({
      evolved: false,
      toStage: null,
      fromStage: "seityo",
    });
  });

  it("退行は false (非対応)", () => {
    expect(detectEvolution("kenzya", "wakatori")).toEqual({
      evolved: false,
      toStage: null,
      fromStage: "kenzya",
    });
  });

  it("previousStage=null は hina として扱う", () => {
    expect(detectEvolution(null, "hina")).toEqual({
      evolved: false,
      toStage: null,
      fromStage: "hina",
    });
    expect(detectEvolution(undefined, "wakatori")).toEqual({
      evolved: true,
      toStage: "wakatori",
      fromStage: "hina",
    });
  });
});

describe("describeKotodamaStage", () => {
  it("hina の進捗ヒントは wakatori 達成 XP 残り", () => {
    const info = describeKotodamaStage({
      totalXp: 50,
      currentStreak: 0,
      badgeCount: 0,
    });
    expect(info.stage).toBe("hina");
    expect(info.nextStage).toBe("wakatori");
    expect(info.nextStageHint).toContain("50 XP");
    expect(info.progressToNext).toBeGreaterThanOrEqual(0);
    expect(info.progressToNext).toBeLessThanOrEqual(1);
  });

  it("syugosin (最終段階) は nextStage=null", () => {
    const info = describeKotodamaStage({
      totalXp: 5000,
      currentStreak: 30,
      badgeCount: 8,
      badgeCodes: [SAKURA_KEEPER_BADGE_CODE],
    });
    expect(info.stage).toBe("syugosin");
    expect(info.nextStage).toBeNull();
    expect(info.nextStageHint).toBeNull();
    expect(info.progressToNext).toBe(1);
  });

  it("ふりがな / ラベル / 説明が含まれる", () => {
    const info = describeKotodamaStage({
      totalXp: 200,
      currentStreak: 0,
      badgeCount: 0,
    });
    expect(info.label).toBe("わかとり");
    expect(info.furigana).toBe("若鳥");
    expect(info.description.length).toBeGreaterThan(0);
  });
});

describe("getAllKotodamaStages / getKotodamaStageLabel", () => {
  it("5 段階を進化順に返す", () => {
    expect(getAllKotodamaStages()).toEqual([
      "hina",
      "wakatori",
      "seityo",
      "kenzya",
      "syugosin",
    ]);
  });

  it("各 stage に日本語ラベルがある", () => {
    expect(getKotodamaStageLabel("hina")).toBe("ひな");
    expect(getKotodamaStageLabel("syugosin")).toBe("しゅごしん");
  });
});
