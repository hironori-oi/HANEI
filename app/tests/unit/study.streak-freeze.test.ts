/**
 * study.streak-freeze.test.ts (W8-T1)
 *
 * 純関数のユニットテスト:
 *   - diffDays: ISO 日付差
 *   - isFirstDayOfMonthJst: 月初判定
 *   - isExamDateBonusDay: 受験 30 日前判定
 *   - grantFreezeTicket: 上限 2 枚で +1
 *   - applyStreakFreeze: 救済可否 (diff=1/2/3+ 別 + freeze 0/>0)
 *   - applyLearnDayUpdate: 学習日に streak 更新 + freeze 救済の合算
 */

import { describe, it, expect } from "vitest";
import {
  FREEZE_MAX_TICKETS,
  diffDays,
  formatIsoDate,
  isFirstDayOfMonthJst,
  isExamDateBonusDay,
  grantFreezeTicket,
  applyStreakFreeze,
} from "@/lib/study/streak-freeze";
import { applyLearnDayUpdate } from "@/lib/study/streak";

describe("formatIsoDate / diffDays", () => {
  it("formatIsoDate: 月日を 0 padding で返す", () => {
    expect(formatIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(formatIsoDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("diffDays: 同日 = 0、翌日 = 1、2 日後 = 2", () => {
    expect(diffDays("2026-04-29", "2026-04-29")).toBe(0);
    expect(diffDays("2026-04-29", "2026-04-30")).toBe(1);
    expect(diffDays("2026-04-29", "2026-05-01")).toBe(2);
    expect(diffDays("2026-04-29", "2026-05-29")).toBe(30);
  });

  it("diffDays: 不正な ISO は 0 を返す (防御的)", () => {
    expect(diffDays("invalid", "2026-04-29")).toBe(0);
    expect(diffDays("2026-04-29", "")).toBe(0);
  });
});

describe("isFirstDayOfMonthJst", () => {
  it("月の 1 日なら true", () => {
    expect(isFirstDayOfMonthJst(new Date(2026, 4, 1))).toBe(true);
    expect(isFirstDayOfMonthJst(new Date(2026, 0, 1))).toBe(true);
  });

  it("月の 1 日以外なら false", () => {
    expect(isFirstDayOfMonthJst(new Date(2026, 4, 2))).toBe(false);
    expect(isFirstDayOfMonthJst(new Date(2026, 4, 30))).toBe(false);
    expect(isFirstDayOfMonthJst(new Date(2026, 11, 31))).toBe(false);
  });
});

describe("isExamDateBonusDay", () => {
  it("受験日まで 30 日ちょうどなら true", () => {
    expect(isExamDateBonusDay("2026-04-29", "2026-05-29")).toBe(true);
  });

  it("受験日まで 29 日 / 31 日なら false", () => {
    expect(isExamDateBonusDay("2026-04-29", "2026-05-28")).toBe(false);
    expect(isExamDateBonusDay("2026-04-29", "2026-05-30")).toBe(false);
  });

  it("受験日が null なら false", () => {
    expect(isExamDateBonusDay("2026-04-29", null)).toBe(false);
  });

  it("受験日が過去なら false", () => {
    expect(isExamDateBonusDay("2026-04-29", "2026-03-01")).toBe(false);
  });
});

describe("grantFreezeTicket", () => {
  it("0 -> 1 (granted)", () => {
    expect(grantFreezeTicket(0)).toEqual({ newCount: 1, granted: true });
  });

  it("1 -> 2 (granted)", () => {
    expect(grantFreezeTicket(1)).toEqual({ newCount: 2, granted: true });
  });

  it("上限 2 で打ち止め (granted=false)", () => {
    expect(grantFreezeTicket(FREEZE_MAX_TICKETS)).toEqual({
      newCount: FREEZE_MAX_TICKETS,
      granted: false,
    });
    expect(grantFreezeTicket(99)).toEqual({
      newCount: FREEZE_MAX_TICKETS,
      granted: false,
    });
  });
});

describe("applyStreakFreeze", () => {
  it("初学習者 (lastActiveDate=null): noChange=true", () => {
    const r = applyStreakFreeze({
      lastActiveDate: null,
      todayIso: "2026-04-29",
      currentStreak: 0,
      freezeTickets: 2,
    });
    expect(r.noChange).toBe(true);
    expect(r.newStreak).toBe(0);
    expect(r.consumed).toBe(false);
  });

  it("同日学習済 (diff=0): noChange=true", () => {
    const r = applyStreakFreeze({
      lastActiveDate: "2026-04-29",
      todayIso: "2026-04-29",
      currentStreak: 7,
      freezeTickets: 1,
    });
    expect(r.noChange).toBe(true);
    expect(r.newStreak).toBe(7);
    expect(r.consumed).toBe(false);
  });

  it("昨日学習 (diff=1): streak 維持 / freeze 消費なし", () => {
    const r = applyStreakFreeze({
      lastActiveDate: "2026-04-28",
      todayIso: "2026-04-29",
      currentStreak: 5,
      freezeTickets: 2,
    });
    expect(r.noChange).toBe(true);
    expect(r.newStreak).toBe(5);
    expect(r.consumed).toBe(false);
    expect(r.broken).toBe(false);
  });

  it("一昨日まで (diff=2) + freeze>0: 1 枚消費して streak 維持", () => {
    const r = applyStreakFreeze({
      lastActiveDate: "2026-04-27",
      todayIso: "2026-04-29",
      currentStreak: 10,
      freezeTickets: 2,
    });
    expect(r.consumed).toBe(true);
    expect(r.newFreezeTickets).toBe(1);
    expect(r.newStreak).toBe(10);
    expect(r.broken).toBe(false);
  });

  it("一昨日まで (diff=2) + freeze=0: streak リセット", () => {
    const r = applyStreakFreeze({
      lastActiveDate: "2026-04-27",
      todayIso: "2026-04-29",
      currentStreak: 10,
      freezeTickets: 0,
    });
    expect(r.consumed).toBe(false);
    expect(r.broken).toBe(true);
    expect(r.newStreak).toBe(0);
  });

  it("3 日以上サボった (diff>=3): freeze があってもリセット (救済不可)", () => {
    const r = applyStreakFreeze({
      lastActiveDate: "2026-04-25",
      todayIso: "2026-04-29",
      currentStreak: 20,
      freezeTickets: 2,
    });
    expect(r.consumed).toBe(false);
    expect(r.broken).toBe(true);
    expect(r.newStreak).toBe(0);
    expect(r.newFreezeTickets).toBe(2); // 消費しない
  });
});

describe("applyLearnDayUpdate (W8-T1 統合)", () => {
  it("初学習者 -> streak=1 / freeze 据え置き", () => {
    const r = applyLearnDayUpdate(
      {
        lastActiveDate: null,
        todayIso: "2026-04-29",
        currentStreak: 0,
        freezeTickets: 0,
      },
      0,
    );
    expect(r.newStreak).toBe(1);
    expect(r.newLongestStreak).toBe(1);
    expect(r.freezeConsumed).toBe(false);
    expect(r.newLastActiveDate).toBe("2026-04-29");
  });

  it("昨日学習済 -> streak +1", () => {
    const r = applyLearnDayUpdate(
      {
        lastActiveDate: "2026-04-28",
        todayIso: "2026-04-29",
        currentStreak: 5,
        freezeTickets: 1,
      },
      5,
    );
    expect(r.newStreak).toBe(6);
    expect(r.newLongestStreak).toBe(6);
    expect(r.freezeConsumed).toBe(false);
    expect(r.newFreezeTickets).toBe(1);
  });

  it("同日重複学習 -> 据え置き", () => {
    const r = applyLearnDayUpdate(
      {
        lastActiveDate: "2026-04-29",
        todayIso: "2026-04-29",
        currentStreak: 7,
        freezeTickets: 2,
      },
      7,
    );
    expect(r.newStreak).toBe(7);
    expect(r.freezeConsumed).toBe(false);
  });

  it("1 日サボった + freeze>0 -> 救済 + streak +1", () => {
    const r = applyLearnDayUpdate(
      {
        lastActiveDate: "2026-04-27",
        todayIso: "2026-04-29",
        currentStreak: 10,
        freezeTickets: 2,
      },
      10,
    );
    expect(r.freezeConsumed).toBe(true);
    expect(r.newFreezeTickets).toBe(1);
    expect(r.newStreak).toBe(11);
    expect(r.newLongestStreak).toBe(11);
  });

  it("1 日サボった + freeze=0 -> 新スタート (1)", () => {
    const r = applyLearnDayUpdate(
      {
        lastActiveDate: "2026-04-27",
        todayIso: "2026-04-29",
        currentStreak: 10,
        freezeTickets: 0,
      },
      10,
    );
    expect(r.freezeConsumed).toBe(false);
    expect(r.newStreak).toBe(1);
    expect(r.newLongestStreak).toBe(10); // longest は維持
  });

  it("3 日以上サボった -> freeze ある場合でもリセット + 新スタート", () => {
    const r = applyLearnDayUpdate(
      {
        lastActiveDate: "2026-04-25",
        todayIso: "2026-04-29",
        currentStreak: 20,
        freezeTickets: 2,
      },
      20,
    );
    expect(r.freezeConsumed).toBe(false);
    expect(r.newStreak).toBe(1);
    expect(r.newFreezeTickets).toBe(2);
    expect(r.newLongestStreak).toBe(20);
  });
});
