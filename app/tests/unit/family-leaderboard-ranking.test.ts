/**
 * Unit tests: src/lib/study/family-leaderboard-ranking.ts (W11-T3 / 家族内ランキング)
 *
 * 純関数の不変条件 (DEC-024 罰則ゼロ哲学 / DEC-061 / 1224 ranking):
 *   - 通常 XP 降順
 *   - 同 XP は同順位 (1224 ranking)
 *   - 全員 0 XP でも全員同順位 (UI 側で「今週はまだ」表示に切替)
 *   - 単独 learner は 1 位
 *   - 大量 row でも安定ソート
 *   - 不正入力 (負値 / NaN / 非配列) を防御
 *   - kotodama-tori stage 伝搬
 */

import { describe, expect, it } from "vitest";

import {
  computeWeeklyXpRanking,
  isAllZeroXp,
} from "@/lib/study/family-leaderboard-ranking";

describe("computeWeeklyXpRanking", () => {
  it("通常: XP 降順で 1, 2, 3 位", () => {
    const r = computeWeeklyXpRanking([
      { learnerId: "B", nickname: "妹", weeklyXp: 30 },
      { learnerId: "A", nickname: "兄", weeklyXp: 50 },
      { learnerId: "C", nickname: "母", weeklyXp: 10 },
    ]);
    expect(r).toEqual([
      {
        learnerId: "A",
        nickname: "兄",
        weeklyXp: 50,
        rank: 1,
        kotodamaToriStage: undefined,
      },
      {
        learnerId: "B",
        nickname: "妹",
        weeklyXp: 30,
        rank: 2,
        kotodamaToriStage: undefined,
      },
      {
        learnerId: "C",
        nickname: "母",
        weeklyXp: 10,
        rank: 3,
        kotodamaToriStage: undefined,
      },
    ]);
  });

  it("同 XP は同順位 (1224 ranking)", () => {
    const r = computeWeeklyXpRanking([
      { learnerId: "A", nickname: "兄", weeklyXp: 10 },
      { learnerId: "B", nickname: "妹", weeklyXp: 10 },
      { learnerId: "C", nickname: "弟", weeklyXp: 5 },
    ]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3]);
    // 同 XP 内では learnerId 昇順 (安定ソート)
    expect(r[0]!.learnerId).toBe("A");
    expect(r[1]!.learnerId).toBe("B");
    expect(r[2]!.learnerId).toBe("C");
  });

  it("全員 0 XP でも rank は 1, 1, 1 (= 全員同順位 / UI 側で切替)", () => {
    const rows = [
      { learnerId: "A", nickname: "兄", weeklyXp: 0 },
      { learnerId: "B", nickname: "妹", weeklyXp: 0 },
    ];
    const r = computeWeeklyXpRanking(rows);
    expect(r.map((x) => x.rank)).toEqual([1, 1]);
    expect(isAllZeroXp(rows)).toBe(true);
  });

  it("単独 learner は 1 位 (罰語ゼロ)", () => {
    const r = computeWeeklyXpRanking([
      { learnerId: "X", nickname: "ひとり", weeklyXp: 25 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.rank).toBe(1);
    expect(r[0]!.weeklyXp).toBe(25);
  });

  it("空配列は空配列を返す (例外なし)", () => {
    expect(computeWeeklyXpRanking([])).toEqual([]);
    expect(isAllZeroXp([])).toBe(true);
  });

  it("大量 row (50 件) でも安定ソート", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      learnerId: `L${String(i).padStart(3, "0")}`,
      nickname: `child${i}`,
      weeklyXp: i,
    }));
    const r = computeWeeklyXpRanking(rows);
    expect(r).toHaveLength(50);
    expect(r[0]!.rank).toBe(1);
    expect(r[0]!.weeklyXp).toBe(49);
    expect(r[49]!.rank).toBe(50);
    expect(r[49]!.weeklyXp).toBe(0);
  });

  it("負値 / NaN weeklyXp は 0 へ正規化 (防御的)", () => {
    const r = computeWeeklyXpRanking([
      { learnerId: "A", nickname: "兄", weeklyXp: -5 },
      {
        learnerId: "B",
        nickname: "妹",
        weeklyXp: Number.NaN as unknown as number,
      },
      { learnerId: "C", nickname: "弟", weeklyXp: 10 },
    ]);
    // C が 1 位 (10 XP) / A, B は 0 XP に正規化されて同順位 2 位
    expect(r[0]!.learnerId).toBe("C");
    expect(r[0]!.weeklyXp).toBe(10);
    expect(r[0]!.rank).toBe(1);
    expect(r[1]!.weeklyXp).toBe(0);
    expect(r[2]!.weeklyXp).toBe(0);
    expect(r[1]!.rank).toBe(2);
    expect(r[2]!.rank).toBe(2);
  });

  it("非配列入力は throw", () => {
    expect(() =>
      computeWeeklyXpRanking(null as unknown as ReadonlyArray<never>),
    ).toThrow();
    expect(() =>
      computeWeeklyXpRanking(undefined as unknown as ReadonlyArray<never>),
    ).toThrow();
  });

  it("kotodama-tori stage が伝搬する", () => {
    const r = computeWeeklyXpRanking([
      {
        learnerId: "A",
        nickname: "兄",
        weeklyXp: 50,
        kotodamaToriStage: "wakatori",
      },
      {
        learnerId: "B",
        nickname: "妹",
        weeklyXp: 30,
        kotodamaToriStage: "hina",
      },
    ]);
    expect(r[0]!.kotodamaToriStage).toBe("wakatori");
    expect(r[1]!.kotodamaToriStage).toBe("hina");
  });

  it("小数 XP は floor 正規化", () => {
    const r = computeWeeklyXpRanking([
      { learnerId: "A", nickname: "兄", weeklyXp: 10.7 },
      { learnerId: "B", nickname: "妹", weeklyXp: 10.2 },
    ]);
    expect(r[0]!.weeklyXp).toBe(10);
    expect(r[1]!.weeklyXp).toBe(10);
    // 同 XP (10) → 同順位
    expect(r[0]!.rank).toBe(1);
    expect(r[1]!.rank).toBe(1);
  });
});

describe("isAllZeroXp", () => {
  it("全員 0 XP は true", () => {
    expect(
      isAllZeroXp([
        { learnerId: "A", nickname: "兄", weeklyXp: 0 },
        { learnerId: "B", nickname: "妹", weeklyXp: 0 },
      ]),
    ).toBe(true);
  });

  it("1 人でも > 0 なら false", () => {
    expect(
      isAllZeroXp([
        { learnerId: "A", nickname: "兄", weeklyXp: 0 },
        { learnerId: "B", nickname: "妹", weeklyXp: 5 },
      ]),
    ).toBe(false);
  });

  it("負値も 0 扱い → true", () => {
    expect(
      isAllZeroXp([{ learnerId: "A", nickname: "兄", weeklyXp: -3 }]),
    ).toBe(true);
  });

  it("空配列は true (= 「今週はまだ」コピーへ)", () => {
    expect(isAllZeroXp([])).toBe(true);
  });
});
