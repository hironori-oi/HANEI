/**
 * study.daily-goal.test.ts (W8-T5)
 *
 * 自己選択日次ゴール (computeDailyProgress / isValidDailyGoalXp / describeDailyGoal /
 * getDailyEarnedXp / getDailyGoalXp / getDailyProgress) の境界値テスト。
 *
 * 検証ポイント (10+ ケース必須):
 *   1. computeDailyProgress: 達成判定 / ratio クランプ
 *   2. computeDailyProgress: 0 earned で remaining = goal
 *   3. computeDailyProgress: earned > goal で ratio = 1
 *   4. isValidDailyGoalXp: 4 段階値の境界
 *   5. isValidDailyGoalXp: 不正値 / 中間値の rejection
 *   6. describeDailyGoal: 既知値 / 未知値 (default fallback)
 *   7. getDailyGoalXp: 行が無ければ default 20
 *   8. getDailyGoalXp: DB 値が候補外なら default に矯正
 *   9. getDailyEarnedXp: 0 件で 0 / 集計値の forwarding
 *  10. getDailyProgress: 統合 (goal + earned から DailyProgress)
 *  11. DAILY_GOAL_XP_OPTIONS: 10/20/30/50 の 4 値であることを固定 lock
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// db client をモック
vi.mock("@/lib/db/client", () => ({
  db: { select: vi.fn() },
  schema: {},
}));

import { db } from "@/lib/db/client";
import {
  DAILY_GOAL_XP_OPTIONS,
  DAILY_GOAL_DEFAULT_XP,
  DAILY_GOAL_CHOICES,
  computeDailyProgress,
  describeDailyGoal,
  isValidDailyGoalXp,
  getDailyEarnedXp,
  getDailyGoalXp,
  getDailyProgress,
} from "@/lib/study/daily-goal";

function mockSelectChain(returnValue: unknown[]) {
  const limit = vi.fn().mockResolvedValue(returnValue);
  const where = vi.fn().mockReturnValue({
    limit,
    then: (resolve: (v: unknown[]) => unknown) => resolve(returnValue),
  });
  const from = vi.fn().mockReturnValue({ where, limit });
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });
}

function mockSelectChainSeq(returnValues: unknown[][]) {
  let i = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const idx = Math.min(i++, returnValues.length - 1);
    const value = returnValues[idx] ?? [];
    const limit = vi.fn().mockResolvedValue(value);
    const where = vi.fn().mockReturnValue({
      limit,
      then: (resolve: (v: unknown[]) => unknown) => resolve(value),
    });
    const from = vi.fn().mockReturnValue({ where, limit });
    return { from };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DAILY_GOAL_XP_OPTIONS lock", () => {
  it("4 段階値が固定: 10 / 20 / 30 / 50", () => {
    expect(DAILY_GOAL_XP_OPTIONS).toEqual([10, 20, 30, 50]);
  });

  it("default は 20 (ふつう)", () => {
    expect(DAILY_GOAL_DEFAULT_XP).toBe(20);
  });

  it("DAILY_GOAL_CHOICES が 4 段階分定義されている", () => {
    expect(DAILY_GOAL_CHOICES).toHaveLength(4);
    expect(DAILY_GOAL_CHOICES.map((c) => c.xp)).toEqual([10, 20, 30, 50]);
  });
});

describe("computeDailyProgress()", () => {
  it("0 earned: remaining = goal / achieved=false", () => {
    const r = computeDailyProgress(20, 0);
    expect(r.goalXp).toBe(20);
    expect(r.earnedXp).toBe(0);
    expect(r.remainingXp).toBe(20);
    expect(r.ratio).toBe(0);
    expect(r.achieved).toBe(false);
  });

  it("半分達成: ratio = 0.5", () => {
    const r = computeDailyProgress(20, 10);
    expect(r.remainingXp).toBe(10);
    expect(r.ratio).toBe(0.5);
    expect(r.achieved).toBe(false);
  });

  it("ちょうど達成: achieved=true / remaining=0", () => {
    const r = computeDailyProgress(20, 20);
    expect(r.remainingXp).toBe(0);
    expect(r.ratio).toBe(1);
    expect(r.achieved).toBe(true);
  });

  it("超過: ratio は 1 でクランプ", () => {
    const r = computeDailyProgress(20, 100);
    expect(r.remainingXp).toBe(0);
    expect(r.ratio).toBe(1);
    expect(r.achieved).toBe(true);
    expect(r.earnedXp).toBe(100);
  });

  it("負値の earned は 0 に矯正", () => {
    const r = computeDailyProgress(20, -5);
    expect(r.earnedXp).toBe(0);
    expect(r.remainingXp).toBe(20);
  });

  it("0 goal は 1 に矯正 (除算保護)", () => {
    const r = computeDailyProgress(0, 5);
    expect(r.goalXp).toBe(1);
    expect(r.achieved).toBe(true);
  });
});

describe("isValidDailyGoalXp()", () => {
  it("4 段階値は true", () => {
    expect(isValidDailyGoalXp(10)).toBe(true);
    expect(isValidDailyGoalXp(20)).toBe(true);
    expect(isValidDailyGoalXp(30)).toBe(true);
    expect(isValidDailyGoalXp(50)).toBe(true);
  });

  it("中間値 / 範囲外 / 文字列 / null は false", () => {
    expect(isValidDailyGoalXp(15)).toBe(false);
    expect(isValidDailyGoalXp(0)).toBe(false);
    expect(isValidDailyGoalXp(100)).toBe(false);
    expect(isValidDailyGoalXp("20")).toBe(false);
    expect(isValidDailyGoalXp(null)).toBe(false);
    expect(isValidDailyGoalXp(undefined)).toBe(false);
  });
});

describe("describeDailyGoal()", () => {
  it("既知値 20 は ふつう", () => {
    const c = describeDailyGoal(20);
    expect(c.label).toBe("ふつう");
    expect(c.xp).toBe(20);
  });

  it("既知値 50 は 本気", () => {
    const c = describeDailyGoal(50);
    expect(c.label).toBe("本気");
  });

  it("未知値は default (ふつう) にフォールバック", () => {
    const c = describeDailyGoal(99);
    expect(c.xp).toBe(20);
  });
});

describe("getDailyGoalXp()", () => {
  it("行が無ければ default 20", async () => {
    mockSelectChain([]);
    const v = await getDailyGoalXp(db as never, "lp_001");
    expect(v).toBe(20);
  });

  it("DB の値が候補内なら そのまま返す", async () => {
    mockSelectChain([{ goal: 30 }]);
    const v = await getDailyGoalXp(db as never, "lp_001");
    expect(v).toBe(30);
  });

  it("DB の値が候補外なら default に矯正", async () => {
    mockSelectChain([{ goal: 7 }]);
    const v = await getDailyGoalXp(db as never, "lp_001");
    expect(v).toBe(20);
  });
});

describe("getDailyEarnedXp()", () => {
  it("解答ログが空なら 0", async () => {
    mockSelectChain([{ delta: 0 }]);
    const v = await getDailyEarnedXp(db as never, "lp_001");
    expect(v).toBe(0);
  });

  it("delta 値を Number 化して返す", async () => {
    mockSelectChain([{ delta: 31 }]);
    const v = await getDailyEarnedXp(db as never, "lp_001");
    expect(v).toBe(31);
  });

  it("undefined delta は 0", async () => {
    mockSelectChain([{}]);
    const v = await getDailyEarnedXp(db as never, "lp_001");
    expect(v).toBe(0);
  });
});

describe("getDailyProgress()", () => {
  it("goal + earned を統合し achieved 判定", async () => {
    // 1 回目: getDailyGoalXp (goal=30) / 2 回目: getDailyEarnedXp (delta=15)
    mockSelectChainSeq([[{ goal: 30 }], [{ delta: 15 }]]);
    const r = await getDailyProgress(db as never, "lp_001");
    expect(r.goalXp).toBe(30);
    expect(r.earnedXp).toBe(15);
    expect(r.remainingXp).toBe(15);
    expect(r.achieved).toBe(false);
    expect(r.ratio).toBe(0.5);
  });

  it("goal を超過すると achieved=true / ratio=1", async () => {
    mockSelectChainSeq([[{ goal: 10 }], [{ delta: 50 }]]);
    const r = await getDailyProgress(db as never, "lp_001");
    expect(r.achieved).toBe(true);
    expect(r.ratio).toBe(1);
    expect(r.remainingXp).toBe(0);
  });
});
