/**
 * study.aggregations.test.ts (W3 / T-7)
 *
 * 検証ポイント (3 ケース必須 / 余裕で 6 ケース):
 *  1. computeAccuracy: 解答 0 件で null
 *  2. computeAccuracy: 解答数 / 正解数の比率を 4 桁で返す
 *  3. shouldSendInactivityReminder: 7 日以上前ならトリガー true
 *  4. shouldSendInactivityReminder: 直近 1 日以内なら false
 *  5. getNearestExamCountdown: 最も近い未来日を選ぶ
 *  6. getNearestExamCountdown: 過去日のみなら null
 *
 * DB は drizzle のメソッドチェーンを vi.mock で stub する。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// db client をモック
vi.mock("@/lib/db/client", () => ({
  db: { select: vi.fn() },
  schema: {},
}));

import { db } from "@/lib/db/client";
import {
  computeAccuracy,
  shouldSendInactivityReminder,
  getNearestExamCountdown,
  getCurrentStreak,
  getDailySkillCounts,
  getMasteryCoverage,
} from "@/lib/study/aggregations";

function mockSelectChain(returnValue: unknown[]) {
  const limit = vi.fn().mockResolvedValue(returnValue);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const groupBy = vi.fn().mockResolvedValue(returnValue);
  const where = vi.fn().mockReturnValue({
    limit,
    orderBy,
    groupBy,
    then: (resolve: (v: unknown[]) => unknown) => resolve(returnValue),
  });
  const innerJoin = vi.fn().mockReturnValue({ where, limit, orderBy, groupBy });
  const from = vi.fn().mockReturnValue({
    where,
    limit,
    orderBy,
    groupBy,
    innerJoin,
  });
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });
}

/**
 * `db.select()` が複数回呼ばれる関数 (getMasteryCoverage 等) 用の mock。
 * 呼び出し順に returnValues を返す。最後の値で固定する (それ以降の呼び出しがあっても同じ値)。
 */
function mockSelectChainSeq(returnValues: unknown[][]) {
  let i = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const idx = Math.min(i++, returnValues.length - 1);
    const value = returnValues[idx] ?? [];
    const limit = vi.fn().mockResolvedValue(value);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const groupBy = vi.fn().mockResolvedValue(value);
    const where = vi.fn().mockReturnValue({
      limit,
      orderBy,
      groupBy,
      then: (resolve: (v: unknown[]) => unknown) => resolve(value),
    });
    const innerJoin = vi.fn().mockReturnValue({
      where,
      limit,
      orderBy,
      groupBy,
    });
    const from = vi.fn().mockReturnValue({
      where,
      limit,
      orderBy,
      groupBy,
      innerJoin,
    });
    return { from };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeAccuracy()", () => {
  it("解答 0 件は null", () => {
    expect(computeAccuracy(0, 0)).toBeNull();
  });
  it("10 問中 7 問正解 → 0.7", () => {
    expect(computeAccuracy(10, 7)).toBe(0.7);
  });
  it("3 問全問正解 → 1", () => {
    expect(computeAccuracy(3, 3)).toBe(1);
  });
});

describe("getCurrentStreak()", () => {
  it("streak 行が無ければ 0", async () => {
    mockSelectChain([]);
    const v = await getCurrentStreak(db as never, "lp_001");
    expect(v).toBe(0);
  });
  it("currentStreak=5 を返す", async () => {
    mockSelectChain([{ s: 5 }]);
    const v = await getCurrentStreak(db as never, "lp_001");
    expect(v).toBe(5);
  });
});

describe("shouldSendInactivityReminder()", () => {
  it("一度も学習していない (last=null) ならトリガー true", async () => {
    mockSelectChain([{ last: null }]);
    const r = await shouldSendInactivityReminder(db as never, "lp_001");
    expect(r.shouldSend).toBe(true);
    expect(r.daysSinceLastActive).toBeNull();
  });

  it("直近 1 日以内なら false", async () => {
    const now = new Date("2026-04-26T12:00:00Z");
    const lastUnix = Math.floor((now.getTime() - 1 * 24 * 60 * 60 * 1000) / 1000);
    mockSelectChain([{ last: lastUnix }]);
    const r = await shouldSendInactivityReminder(db as never, "lp_001", 7, now);
    expect(r.shouldSend).toBe(false);
    expect(r.daysSinceLastActive).toBe(1);
  });

  it("8 日前ならトリガー true", async () => {
    const now = new Date("2026-04-26T12:00:00Z");
    const lastUnix = Math.floor((now.getTime() - 8 * 24 * 60 * 60 * 1000) / 1000);
    mockSelectChain([{ last: lastUnix }]);
    const r = await shouldSendInactivityReminder(db as never, "lp_001", 7, now);
    expect(r.shouldSend).toBe(true);
    expect(r.daysSinceLastActive).toBe(8);
  });
});

describe("getNearestExamCountdown()", () => {
  it("過去日のみなら null", async () => {
    const now = new Date("2026-04-26T12:00:00Z");
    mockSelectChain([
      { learnerId: "lp_001", level: "5", examDate: "2026-04-01" },
      { learnerId: "lp_001", level: "4", examDate: "2026-03-15" },
    ]);
    const v = await getNearestExamCountdown(db as never, "lp_001", now);
    expect(v).toBeNull();
  });

  it("未来日が複数あれば最も近いものを返す", async () => {
    const now = new Date("2026-04-26T12:00:00Z");
    mockSelectChain([
      { learnerId: "lp_001", level: "3", examDate: "2026-12-01" },
      { learnerId: "lp_001", level: "5", examDate: "2026-06-01" },
      { learnerId: "lp_001", level: "4", examDate: "2026-09-01" },
    ]);
    const v = await getNearestExamCountdown(db as never, "lp_001", now);
    expect(v?.examDate).toBe("2026-06-01");
    expect(v?.level).toBe("5");
    expect(v?.daysUntil).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// W5 / G-1: getDailySkillCounts
// ---------------------------------------------------------------------------
describe("getDailySkillCounts() (W5 / G-1)", () => {
  it("解答ログが空なら全 skill 0", async () => {
    mockSelectChain([]);
    const v = await getDailySkillCounts(db as never, "lp_001");
    expect(v).toEqual({
      vocabulary: 0,
      grammar: 0,
      listening: 0,
      reading: 0,
      writing: 0,
    });
  });

  it("skillId サフィックス (vocabulary-5 など) を skill code にマップして集計", async () => {
    mockSelectChain([
      { skillId: "vocabulary-5", cnt: 7 },
      { skillId: "grammar-5", cnt: 3 },
      { skillId: "listening-5", cnt: 2 },
      { skillId: "writing-3", cnt: 1 },
    ]);
    const v = await getDailySkillCounts(db as never, "lp_001");
    expect(v.vocabulary).toBe(7);
    expect(v.grammar).toBe(3);
    expect(v.listening).toBe(2);
    expect(v.writing).toBe(1);
    expect(v.reading).toBe(0);
  });

  it("未知の skill prefix (reorder 等) は無視される", async () => {
    mockSelectChain([
      { skillId: "vocabulary-5", cnt: 5 },
      { skillId: "reorder-5", cnt: 100 }, // skills マスタには存在しないが念のため
      { skillId: "speaking-3", cnt: 10 },
    ]);
    const v = await getDailySkillCounts(db as never, "lp_001");
    expect(v.vocabulary).toBe(5);
    expect(v.reading).toBe(0);
    expect(v.listening).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W5 / G-3: getMasteryCoverage
// ---------------------------------------------------------------------------
describe("getMasteryCoverage() (W5 / G-3)", () => {
  it("4 スキル分の {skill, mastered, total} を返す", async () => {
    // 4 skill × 2 query = 8 回呼ばれる前提
    mockSelectChainSeq([
      // vocabulary
      [{ cnt: 160 }],
      [{ cnt: 40 }],
      // grammar
      [{ cnt: 30 }],
      [{ cnt: 5 }],
      // reading
      [{ cnt: 30 }],
      [{ cnt: 0 }],
      // listening
      [{ cnt: 99 }], // DEC-035 取りこぼし 1 件除外で 99
      [{ cnt: 12 }],
    ]);
    const v = await getMasteryCoverage(db as never, "lp_001", "5");
    expect(v).toHaveLength(4);
    expect(v[0]).toEqual({ skill: "vocabulary", mastered: 40, total: 160 });
    expect(v[1]).toEqual({ skill: "grammar", mastered: 5, total: 30 });
    expect(v[2]).toEqual({ skill: "reading", mastered: 0, total: 30 });
    expect(v[3]).toEqual({ skill: "listening", mastered: 12, total: 99 });
  });

  it("総数 0 でも mastered=0 / total=0 を返す (NaN にしない)", async () => {
    mockSelectChainSeq([
      [{ cnt: 0 }],
      [{ cnt: 0 }],
      [{ cnt: 0 }],
      [{ cnt: 0 }],
      [{ cnt: 0 }],
      [{ cnt: 0 }],
      [{ cnt: 0 }],
      [{ cnt: 0 }],
    ]);
    const v = await getMasteryCoverage(db as never, "lp_001", "4");
    for (const c of v) {
      expect(c.total).toBe(0);
      expect(c.mastered).toBe(0);
    }
  });
});
