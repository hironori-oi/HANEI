/**
 * Unit tests for badge-engine (W9-T3).
 *
 * 純関数のみテスト対象:
 *  - isBadgeAchieved
 *  - checkBadgeAchievements
 *  - badgeProgressRatio
 */

import { describe, expect, it } from "vitest";
import {
  badgeProgressRatio,
  checkBadgeAchievements,
  isBadgeAchieved,
  type LearnerBadgeStats,
} from "@/lib/badges/badge-engine";

const ZERO_STATS: LearnerBadgeStats = {
  totalAnswerCount: 0,
  currentStreak: 0,
  skillMasteryCounts: {
    vocabulary: 0,
    grammar: 0,
    reading: 0,
    listening: 0,
  },
  mockExamCount: 0,
};

describe("isBadgeAchieved", () => {
  it("初期 stats では何も達成していない", () => {
    expect(isBadgeAchieved("first_flight", ZERO_STATS)).toBe(false);
    expect(isBadgeAchieved("streak_keeper", ZERO_STATS)).toBe(false);
  });

  it("first_flight: answer_count >= 1 で達成", () => {
    expect(
      isBadgeAchieved("first_flight", { ...ZERO_STATS, totalAnswerCount: 1 }),
    ).toBe(true);
  });

  it("streak_keeper: currentStreak >= 7 で達成", () => {
    expect(
      isBadgeAchieved("streak_keeper", { ...ZERO_STATS, currentStreak: 7 }),
    ).toBe(true);
    expect(
      isBadgeAchieved("streak_keeper", { ...ZERO_STATS, currentStreak: 6 }),
    ).toBe(false);
  });

  it("vocab_master: vocabulary mastery >= 100 で達成", () => {
    expect(
      isBadgeAchieved("vocab_master", {
        ...ZERO_STATS,
        skillMasteryCounts: {
          ...ZERO_STATS.skillMasteryCounts,
          vocabulary: 100,
        },
      }),
    ).toBe(true);
  });

  it("first_mock_exam: mockExamCount >= 1 で達成", () => {
    expect(
      isBadgeAchieved("first_mock_exam", { ...ZERO_STATS, mockExamCount: 1 }),
    ).toBe(true);
  });

  it("sakura_keeper: currentStreak >= 30 で達成", () => {
    expect(
      isBadgeAchieved("sakura_keeper", { ...ZERO_STATS, currentStreak: 30 }),
    ).toBe(true);
  });

  it("不正なコードは false", () => {
    // @ts-expect-error invalid code
    expect(isBadgeAchieved("nonexistent_badge", ZERO_STATS)).toBe(false);
  });
});

describe("checkBadgeAchievements", () => {
  it("初期 stats では何も解放されない", () => {
    const result = checkBadgeAchievements("learner-1", ZERO_STATS, []);
    expect(result.newlyEarned).toEqual([]);
    expect(result.allEarned).toEqual([]);
  });

  it("first_flight 達成時に newlyEarned に含まれる", () => {
    const result = checkBadgeAchievements(
      "learner-1",
      { ...ZERO_STATS, totalAnswerCount: 1 },
      [],
    );
    expect(result.newlyEarned).toContain("first_flight");
    expect(result.allEarned).toContain("first_flight");
  });

  it("既 earned は newlyEarned に含めない", () => {
    const result = checkBadgeAchievements(
      "learner-1",
      { ...ZERO_STATS, totalAnswerCount: 1 },
      ["first_flight"],
    );
    expect(result.newlyEarned).not.toContain("first_flight");
    expect(result.allEarned).toContain("first_flight");
  });

  it("複数同時解放を一括判定", () => {
    const result = checkBadgeAchievements(
      "learner-1",
      {
        totalAnswerCount: 1,
        currentStreak: 7,
        skillMasteryCounts: {
          vocabulary: 100,
          grammar: 100,
          reading: 50,
          listening: 50,
        },
        mockExamCount: 1,
      },
      [],
    );
    // 7 種 (sakura_keeper だけ未達)
    expect(result.newlyEarned).toContain("first_flight");
    expect(result.newlyEarned).toContain("streak_keeper");
    expect(result.newlyEarned).toContain("vocab_master");
    expect(result.newlyEarned).toContain("grammar_master");
    expect(result.newlyEarned).toContain("reading_master");
    expect(result.newlyEarned).toContain("listening_master");
    expect(result.newlyEarned).toContain("first_mock_exam");
    expect(result.newlyEarned).not.toContain("sakura_keeper");
  });
});

describe("badgeProgressRatio", () => {
  it("first_flight 未達は ratio < 1, achieved=false", () => {
    const r = badgeProgressRatio("first_flight", ZERO_STATS);
    expect(r.achieved).toBe(false);
    expect(r.current).toBe(0);
    expect(r.total).toBe(1);
    expect(r.ratio).toBe(0);
  });

  it("streak_keeper 進捗 50%", () => {
    const r = badgeProgressRatio("streak_keeper", {
      ...ZERO_STATS,
      currentStreak: 3,
    });
    expect(r.achieved).toBe(false);
    expect(r.current).toBe(3);
    expect(r.total).toBe(7);
    expect(r.ratio).toBeCloseTo(3 / 7, 2);
  });

  it("達成済は ratio=1, achieved=true", () => {
    const r = badgeProgressRatio("streak_keeper", {
      ...ZERO_STATS,
      currentStreak: 7,
    });
    expect(r.ratio).toBe(1);
    expect(r.achieved).toBe(true);
  });

  it("超過しても ratio は 1 を超えない", () => {
    const r = badgeProgressRatio("streak_keeper", {
      ...ZERO_STATS,
      currentStreak: 100,
    });
    expect(r.ratio).toBe(1);
  });
});
