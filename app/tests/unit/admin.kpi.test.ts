/**
 * Unit tests: src/lib/admin/kpi-summary.ts (W12-T1 / DEC-065)
 *
 * 純関数 `composeKpiDashboardView` + 補助 helper の不変条件:
 *   - 0 件 / 1 件 / 多数件 / NaN ガード / median 偶奇 / 全 fallback / 部分 fallback /
 *     バッジ 0 件 / バッジ 5 件超 → 上位 5 件絞込 / 罰語不在 grep
 *   - DEC-024 罰則ゼロ厳守 (admin 向けでも fallback 文字列に罰語が混入しない).
 */

import { describe, expect, it } from "vitest";

import {
  buildKotodamaMessageDeliveryCard,
  buildMockExamDistributionCard,
  composeKpiDashboardView,
  formatCount,
  formatMinutes,
  formatPercentage,
  median,
  safeFiniteNumber,
  safeNonNegInt,
  safeRatio,
  type BadgeDistributionRaw,
  type KotodamaMessageDeliveryRaw,
  type KpiDashboardRaw,
  type MockExamDistributionRaw,
} from "@/lib/admin/kpi-summary";

const PUNISHMENT_WORDS = [
  "最下位",
  "ペナルティ",
  "サボ",
  "もうダメ",
  "失敗",
  "やりすぎ",
  "がんばってない",
  "だめ",
  "やる気",
] as const;

function expectNoPunishmentWords(text: string): void {
  for (const w of PUNISHMENT_WORDS) {
    expect(text, `罰語 "${w}" が含まれてはいけない (DEC-024)`).not.toContain(w);
  }
}

const FIXED_NOW = new Date("2026-05-03T00:00:00Z");

function buildRaw(
  overrides: Partial<KpiDashboardRaw> = {},
): KpiDashboardRaw {
  return {
    retentionDay1: undefined,
    retentionDay7: undefined,
    retentionDay30: undefined,
    avgSessionMinutes: undefined,
    streakStats: undefined,
    dailyQuestCompletion: undefined,
    badgeDistribution: undefined,
    familyMessageFrequency: undefined,
    experimentCohort: undefined,
    mockExamDistribution: undefined,
    kotodamaMessageDelivery: undefined,
    generatedAt: FIXED_NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// safeNonNegInt / safeFiniteNumber
// ---------------------------------------------------------------------------
describe("safeNonNegInt", () => {
  it("有限非負整数はそのまま返す", () => {
    expect(safeNonNegInt(0)).toBe(0);
    expect(safeNonNegInt(7)).toBe(7);
    expect(safeNonNegInt(7.9)).toBe(7);
  });
  it("負値 / NaN / undefined / 文字列は 0", () => {
    expect(safeNonNegInt(-3)).toBe(0);
    expect(safeNonNegInt(Number.NaN)).toBe(0);
    expect(safeNonNegInt(undefined)).toBe(0);
    expect(safeNonNegInt("3")).toBe(0);
    expect(safeNonNegInt(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("safeFiniteNumber", () => {
  it("有限実数はそのまま、NaN は 0", () => {
    expect(safeFiniteNumber(3.14)).toBe(3.14);
    expect(safeFiniteNumber(-2)).toBe(-2);
    expect(safeFiniteNumber(Number.NaN)).toBe(0);
    expect(safeFiniteNumber(undefined)).toBe(0);
    expect(safeFiniteNumber(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// median
// ---------------------------------------------------------------------------
describe("median", () => {
  it("空配列は undefined", () => {
    expect(median([])).toBeUndefined();
  });
  it("奇数件は中央値", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([5, 1, 3])).toBe(3);
  });
  it("偶数件は中央 2 件の平均", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([10, 20])).toBe(15);
  });
  it("非数値要素を除外", () => {
    expect(median([1, Number.NaN, 3, 5])).toBe(3);
    expect(median([Number.NaN, Number.POSITIVE_INFINITY])).toBeUndefined();
  });
  it("元配列を破壊しない", () => {
    const original = [3, 1, 2];
    median(original);
    expect(original).toEqual([3, 1, 2]);
  });
  it("非配列入力は throw", () => {
    expect(() =>
      median(undefined as unknown as ReadonlyArray<number>),
    ).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// safeRatio / formatters
// ---------------------------------------------------------------------------
describe("safeRatio + formatPercentage", () => {
  it("通常: numerator / denominator", () => {
    expect(safeRatio(50, 200)).toBe(0.25);
    expect(formatPercentage(0.25)).toBe("25.0%");
  });
  it("denominator 0 / 負値 / NaN は undefined → '——'", () => {
    expect(safeRatio(5, 0)).toBeUndefined();
    expect(safeRatio(5, -1)).toBeUndefined();
    expect(safeRatio(Number.NaN, 10)).toBeUndefined();
    expect(formatPercentage(undefined)).toBe("——");
    expect(formatPercentage(Number.NaN)).toBe("——");
  });
  it("ratio > 1 / < 0 は 0..1 にクランプ", () => {
    expect(formatPercentage(1.2)).toBe("100.0%");
    expect(formatPercentage(-0.1)).toBe("0.0%");
  });
});

describe("formatCount + formatMinutes", () => {
  it("formatCount: 整数を ja-JP local string", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1234567)).toMatch(/1[,，]?234[,，]?567/);
    expect(formatCount(undefined)).toBe("——");
  });
  it("formatMinutes: 分を 1 桁で整形", () => {
    expect(formatMinutes(7.25)).toBe("7.3 分");
    expect(formatMinutes(0)).toBe("0.0 分");
    expect(formatMinutes(undefined)).toBe("——");
    expect(formatMinutes(Number.NaN)).toBe("——");
  });
});

// ---------------------------------------------------------------------------
// composeKpiDashboardView - 全 fallback (= 全 raw undefined)
// ---------------------------------------------------------------------------
describe("composeKpiDashboardView (全 fallback)", () => {
  it("全 raw undefined でも 12 枚 card を返す + 罰語不在", () => {
    const view = composeKpiDashboardView(buildRaw());
    expect(view.cards.length).toBe(12);
    const ids = view.cards.map((c) => c.kpiId);
    expect(ids).toEqual([
      "retention-day-1",
      "retention-day-7",
      "retention-day-30",
      "avg-session-minutes",
      "streak-median",
      "streak-freeze-usage",
      "daily-quest-completion-rate",
      "badge-distribution",
      "family-message-frequency",
      "experiment-streak-freeze-cohort",
      "mock-exam-distribution",
      "kotodama-message-delivery",
    ]);
    for (const c of view.cards) {
      expectNoPunishmentWords(c.title);
      expectNoPunishmentWords(c.primaryValue);
      expectNoPunishmentWords(c.secondaryLabel);
    }
  });

  it("非 object 入力は throw (防御)", () => {
    expect(() =>
      composeKpiDashboardView(undefined as unknown as KpiDashboardRaw),
    ).toThrow(TypeError);
  });

  it("generatedAt が無効 Date でも ISO 文字列で安全に返す", () => {
    const view = composeKpiDashboardView({
      ...buildRaw(),
      generatedAt: new Date("invalid"),
    });
    expect(typeof view.generatedAtIsoUtc).toBe("string");
    expect(view.generatedAtIsoUtc).toMatch(/^\d{4}-/);
  });
});

// ---------------------------------------------------------------------------
// composeKpiDashboardView - retention KPI 分岐
// ---------------------------------------------------------------------------
describe("composeKpiDashboardView (retention)", () => {
  it("cohort 0 件は '——' fallback + 罰語不在", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        retentionDay1: { cohortSize: 0, retainedCount: 0 },
      }),
    );
    const card = view.cards.find((c) => c.kpiId === "retention-day-1")!;
    expect(card.primaryValue).toBe("——");
    expect(card.secondaryLabel).toContain("0");
    expectNoPunishmentWords(card.secondaryLabel);
  });

  it("cohort > 0 / retained > 0 は %", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        retentionDay7: { cohortSize: 100, retainedCount: 30 },
      }),
    );
    const card = view.cards.find((c) => c.kpiId === "retention-day-7")!;
    expect(card.primaryValue).toBe("30.0%");
    expect(card.secondaryLabel).toMatch(/100/);
  });

  it("retainedCount > cohortSize でも 100% にクランプ (異常 raw 防御)", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        retentionDay30: { cohortSize: 10, retainedCount: 999 },
      }),
    );
    const card = view.cards.find((c) => c.kpiId === "retention-day-30")!;
    expect(card.primaryValue).toBe("100.0%");
  });
});

// ---------------------------------------------------------------------------
// composeKpiDashboardView - avg session minutes
// ---------------------------------------------------------------------------
describe("composeKpiDashboardView (avg session minutes)", () => {
  it("totalSessions=0 は fallback", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        avgSessionMinutes: { totalSessions: 0, totalMinutes: 0 },
      }),
    );
    const card = view.cards.find((c) => c.kpiId === "avg-session-minutes")!;
    expect(card.primaryValue).toBe("——");
  });

  it("totalSessions=10 / totalMinutes=87.5 は 8.8 分", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        avgSessionMinutes: { totalSessions: 10, totalMinutes: 87.5 },
      }),
    );
    const card = view.cards.find((c) => c.kpiId === "avg-session-minutes")!;
    expect(card.primaryValue).toBe("8.8 分");
  });
});

// ---------------------------------------------------------------------------
// composeKpiDashboardView - streak (median + freeze usage)
// ---------------------------------------------------------------------------
describe("composeKpiDashboardView (streak)", () => {
  it("0 名 (空配列) は streak 中央値 fallback", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        streakStats: {
          currentStreaks: [],
          freezeUsageCount: 0,
          freezeAcquiredCount: 0,
        },
      }),
    );
    const card = view.cards.find((c) => c.kpiId === "streak-median")!;
    expect(card.primaryValue).toBe("——");
  });

  it("奇数件 (1,3,5) は 3.0 日", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        streakStats: {
          currentStreaks: [1, 3, 5],
          freezeUsageCount: 0,
          freezeAcquiredCount: 0,
        },
      }),
    );
    const card = view.cards.find((c) => c.kpiId === "streak-median")!;
    expect(card.primaryValue).toBe("3.0 日");
  });

  it("偶数件 (2,4) は 3.0 日 (平均)", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        streakStats: {
          currentStreaks: [2, 4],
          freezeUsageCount: 0,
          freezeAcquiredCount: 0,
        },
      }),
    );
    const card = view.cards.find((c) => c.kpiId === "streak-median")!;
    expect(card.primaryValue).toBe("3.0 日");
  });

  it("freezeAcquired=0 は 使用率 fallback", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        streakStats: {
          currentStreaks: [1],
          freezeUsageCount: 0,
          freezeAcquiredCount: 0,
        },
      }),
    );
    const card = view.cards.find((c) => c.kpiId === "streak-freeze-usage")!;
    expect(card.primaryValue).toBe("——");
  });

  it("freezeAcquired=10 / used=4 は 40.0%", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        streakStats: {
          currentStreaks: [3, 7, 5, 2, 0, 1, 100],
          freezeUsageCount: 4,
          freezeAcquiredCount: 10,
        },
      }),
    );
    const usageCard = view.cards.find(
      (c) => c.kpiId === "streak-freeze-usage",
    )!;
    expect(usageCard.primaryValue).toBe("40.0%");
    const medianCard = view.cards.find((c) => c.kpiId === "streak-median")!;
    expect(medianCard.primaryValue).toBe("3.0 日"); // sorted [0,1,2,3,5,7,100] → median=3
  });
});

// ---------------------------------------------------------------------------
// composeKpiDashboardView - daily quest completion
// ---------------------------------------------------------------------------
describe("composeKpiDashboardView (daily quest completion)", () => {
  it("totalQuests=0 は fallback", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        dailyQuestCompletion: { totalQuests: 0, completedQuests: 0 },
      }),
    );
    const card = view.cards.find(
      (c) => c.kpiId === "daily-quest-completion-rate",
    )!;
    expect(card.primaryValue).toBe("——");
  });

  it("totalQuests=20 / completed=15 は 75.0%", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        dailyQuestCompletion: { totalQuests: 20, completedQuests: 15 },
      }),
    );
    const card = view.cards.find(
      (c) => c.kpiId === "daily-quest-completion-rate",
    )!;
    expect(card.primaryValue).toBe("75.0%");
    expect(card.secondaryLabel).toContain("15");
    expect(card.secondaryLabel).toContain("20");
  });
});

// ---------------------------------------------------------------------------
// composeKpiDashboardView - badge distribution
// ---------------------------------------------------------------------------
describe("composeKpiDashboardView (badge distribution)", () => {
  it("0 件は fallback rows=[]", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        badgeDistribution: [],
      }),
    );
    const card = view.cards.find((c) => c.kpiId === "badge-distribution")!;
    expect(card.primaryValue).toBe("——");
    expect(card.rows).toEqual([]);
  });

  it("3 件は降順 + label fallback", () => {
    const raw: BadgeDistributionRaw[] = [
      { badgeId: "b_a", label: "", earnedCount: 5 },
      { badgeId: "b_b", label: "Bravery", earnedCount: 12 },
      { badgeId: "b_c", label: "Curiosity", earnedCount: 7 },
    ];
    const view = composeKpiDashboardView(
      buildRaw({ badgeDistribution: raw }),
    );
    const card = view.cards.find((c) => c.kpiId === "badge-distribution")!;
    expect(card.rows!.map((r) => r.id)).toEqual(["b_b", "b_c", "b_a"]);
    expect(card.rows![2]!.label).toBe("——"); // empty label → fallback
    expect(card.primaryValue).toMatch(/24/); // 5 + 7 + 12
  });

  it("7 件入力でも上位 5 件のみ rows に含まれる + 同数タイは badgeId 昇順", () => {
    const raw: BadgeDistributionRaw[] = [
      { badgeId: "b_g", label: "G", earnedCount: 1 },
      { badgeId: "b_a", label: "A", earnedCount: 5 },
      { badgeId: "b_b", label: "B", earnedCount: 5 },
      { badgeId: "b_c", label: "C", earnedCount: 9 },
      { badgeId: "b_d", label: "D", earnedCount: 7 },
      { badgeId: "b_e", label: "E", earnedCount: 4 },
      { badgeId: "b_f", label: "F", earnedCount: 1 },
    ];
    const view = composeKpiDashboardView(
      buildRaw({ badgeDistribution: raw }),
    );
    const card = view.cards.find((c) => c.kpiId === "badge-distribution")!;
    expect(card.rows!.length).toBe(5);
    expect(card.rows!.map((r) => r.id)).toEqual([
      "b_c", // 9
      "b_d", // 7
      "b_a", // 5 (a < b)
      "b_b", // 5
      "b_e", // 4
    ]);
    // primary value = 上位 5 件の合計 = 9+7+5+5+4 = 30
    expect(card.primaryValue).toMatch(/30/);
  });

  it("罰語不在", () => {
    const raw: BadgeDistributionRaw[] = [
      { badgeId: "b_x", label: "Xx", earnedCount: 1 },
    ];
    const view = composeKpiDashboardView(
      buildRaw({ badgeDistribution: raw }),
    );
    const card = view.cards.find((c) => c.kpiId === "badge-distribution")!;
    expectNoPunishmentWords(card.title);
    expectNoPunishmentWords(card.secondaryLabel);
    for (const row of card.rows!) {
      expectNoPunishmentWords(row.label);
    }
  });
});

// ---------------------------------------------------------------------------
// composeKpiDashboardView - family message frequency
// ---------------------------------------------------------------------------
describe("composeKpiDashboardView (family message frequency)", () => {
  it("undefined raw は fallback", () => {
    const view = composeKpiDashboardView(buildRaw());
    const card = view.cards.find(
      (c) => c.kpiId === "family-message-frequency",
    )!;
    expect(card.primaryValue).toBe("——");
  });

  it("totalMessagesLast7Days=42 は formatCount", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        familyMessageFrequency: { totalMessagesLast7Days: 42 },
      }),
    );
    const card = view.cards.find(
      (c) => c.kpiId === "family-message-frequency",
    )!;
    expect(card.primaryValue).toMatch(/42/);
  });

  it("負値 raw は 0 にクランプ", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        familyMessageFrequency: { totalMessagesLast7Days: -5 },
      }),
    );
    const card = view.cards.find(
      (c) => c.kpiId === "family-message-frequency",
    )!;
    expect(card.primaryValue).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// 模試結果分布 (W12-T1.5 / DEC-068)
// ---------------------------------------------------------------------------
describe("buildMockExamDistributionCard (W12-T1.5 / DEC-068)", () => {
  it("raw undefined は中立 fallback (rows=[] / 罰語不在)", () => {
    const card = buildMockExamDistributionCard(undefined);
    expect(card.kpiId).toBe("mock-exam-distribution");
    expect(card.iconName).toBe("ChartBarIcon");
    expect(card.primaryValue).toBe("——");
    expect(card.secondaryLabel).toContain("0");
    expect(card.rows).toEqual([]);
    expectNoPunishmentWords(card.title);
    expectNoPunishmentWords(card.secondaryLabel);
  });

  it("byLevel 空配列も中立 fallback", () => {
    const card = buildMockExamDistributionCard({ byLevel: [] });
    expect(card.primaryValue).toBe("——");
    expect(card.rows).toEqual([]);
  });

  it("1 級のみ (5 級) raw でも row 1 件で構築", () => {
    const raw: MockExamDistributionRaw = {
      byLevel: [{ level: "5", count: 8, avgRatio: 0.625 }],
    };
    const card = buildMockExamDistributionCard(raw);
    expect(card.primaryValue).toMatch(/8/);
    expect(card.rows!.length).toBe(1);
    expect(card.rows![0]!.id).toBe("level-5");
    expect(card.rows![0]!.label).toBe("5 級");
    expect(card.rows![0]!.value).toContain("8 件");
    expect(card.rows![0]!.value).toContain("62.5%");
  });

  it("3 級揃い (5/4/3) は 5 → 4 → 3 順で安定 + 合計件数を primaryValue", () => {
    const raw: MockExamDistributionRaw = {
      byLevel: [
        // 入力順は意図的に逆順 / シャッフル.
        { level: "3", count: 4, avgRatio: 0.4 },
        { level: "5", count: 10, avgRatio: 0.7 },
        { level: "4", count: 6, avgRatio: 0.55 },
      ],
    };
    const card = buildMockExamDistributionCard(raw);
    expect(card.rows!.map((r) => r.id)).toEqual([
      "level-5",
      "level-4",
      "level-3",
    ]);
    expect(card.primaryValue).toMatch(/20/); // 10 + 6 + 4
  });

  it("count=0 の級は配列に出さない (母数 0 級は表示対象外)", () => {
    const raw: MockExamDistributionRaw = {
      byLevel: [
        { level: "5", count: 0, avgRatio: 0 },
        { level: "4", count: 3, avgRatio: 0.5 },
      ],
    };
    const card = buildMockExamDistributionCard(raw);
    expect(card.rows!.map((r) => r.id)).toEqual(["level-4"]);
    expect(card.primaryValue).toMatch(/3/);
  });

  it("avgRatio 0..1 を超えた異常値は '——' にフォールバック (クランプではなく明示)", () => {
    const raw: MockExamDistributionRaw = {
      byLevel: [
        { level: "5", count: 2, avgRatio: 1.5 },
        { level: "4", count: 1, avgRatio: -0.1 },
      ],
    };
    const card = buildMockExamDistributionCard(raw);
    // 異常値は ratio undefined → "——"
    expect(card.rows![0]!.value).toContain("——");
    expect(card.rows![1]!.value).toContain("——");
  });

  it("通常 raw + 罰語不在 (DEC-024)", () => {
    const raw: MockExamDistributionRaw = {
      byLevel: [
        { level: "5", count: 10, avgRatio: 0.85 },
        { level: "4", count: 5, avgRatio: 0.6 },
      ],
    };
    const card = buildMockExamDistributionCard(raw);
    expectNoPunishmentWords(card.title);
    expectNoPunishmentWords(card.primaryValue);
    expectNoPunishmentWords(card.secondaryLabel);
    for (const row of card.rows!) {
      expectNoPunishmentWords(row.label);
      expectNoPunishmentWords(row.value);
    }
  });
});

// ---------------------------------------------------------------------------
// kotodama-tori メッセージ表示率 (W12-T1.5 / DEC-068)
// ---------------------------------------------------------------------------
describe("buildKotodamaMessageDeliveryCard (W12-T1.5 / DEC-068)", () => {
  it("raw undefined は中立 fallback", () => {
    const card = buildKotodamaMessageDeliveryCard(undefined);
    expect(card.kpiId).toBe("kotodama-message-delivery");
    expect(card.iconName).toBe("ChatBubbleLeftEllipsisIcon");
    expect(card.primaryValue).toBe("——");
    expectNoPunishmentWords(card.secondaryLabel);
  });

  it("totalSent=0 は fallback (送信 0 件 / 表示 0 件)", () => {
    const raw: KotodamaMessageDeliveryRaw = { totalSent: 0, totalRead: 0 };
    const card = buildKotodamaMessageDeliveryCard(raw);
    expect(card.primaryValue).toBe("——");
    expect(card.secondaryLabel).toContain("送信 0 件");
    expect(card.secondaryLabel).toContain("表示 0 件");
  });

  it("全 read (totalSent=8 / totalRead=8) は 100.0%", () => {
    const raw: KotodamaMessageDeliveryRaw = { totalSent: 8, totalRead: 8 };
    const card = buildKotodamaMessageDeliveryCard(raw);
    expect(card.primaryValue).toBe("100.0%");
    expect(card.secondaryLabel).toContain("送信 8");
    expect(card.secondaryLabel).toContain("表示 8");
  });

  it("部分 read (totalSent=10 / totalRead=3) は 30.0%", () => {
    const raw: KotodamaMessageDeliveryRaw = { totalSent: 10, totalRead: 3 };
    const card = buildKotodamaMessageDeliveryCard(raw);
    expect(card.primaryValue).toBe("30.0%");
  });

  it("totalRead > totalSent でも 100% にクランプ (異常 raw 防御)", () => {
    const raw: KotodamaMessageDeliveryRaw = { totalSent: 5, totalRead: 999 };
    const card = buildKotodamaMessageDeliveryCard(raw);
    expect(card.primaryValue).toBe("100.0%");
  });

  it("負値 raw は 0 として扱う", () => {
    const raw: KotodamaMessageDeliveryRaw = { totalSent: -3, totalRead: -1 };
    const card = buildKotodamaMessageDeliveryCard(raw);
    expect(card.primaryValue).toBe("——"); // safeNonNegInt → 0 → fallback
  });

  it("通常 raw + 罰語不在 (DEC-024)", () => {
    const raw: KotodamaMessageDeliveryRaw = { totalSent: 25, totalRead: 18 };
    const card = buildKotodamaMessageDeliveryCard(raw);
    expectNoPunishmentWords(card.title);
    expectNoPunishmentWords(card.primaryValue);
    expectNoPunishmentWords(card.secondaryLabel);
  });
});

// ---------------------------------------------------------------------------
// 全 cards の罰語不在を最終 grep
// ---------------------------------------------------------------------------
describe("全 cards 罰語不在 (DEC-024 構造的担保)", () => {
  it("通常入力 / 全埋め: 全 card text に罰語が含まれない", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        retentionDay1: { cohortSize: 100, retainedCount: 35 },
        retentionDay7: { cohortSize: 80, retainedCount: 18 },
        retentionDay30: { cohortSize: 50, retainedCount: 6 },
        avgSessionMinutes: { totalSessions: 200, totalMinutes: 1234.5 },
        streakStats: {
          currentStreaks: [0, 1, 3, 5, 8, 12, 30],
          freezeUsageCount: 3,
          freezeAcquiredCount: 7,
        },
        dailyQuestCompletion: { totalQuests: 100, completedQuests: 73 },
        badgeDistribution: [
          { badgeId: "b_a", label: "Aa", earnedCount: 50 },
          { badgeId: "b_b", label: "Bb", earnedCount: 30 },
        ],
        familyMessageFrequency: { totalMessagesLast7Days: 9 },
        mockExamDistribution: {
          byLevel: [
            { level: "5", count: 12, avgRatio: 0.83 },
            { level: "4", count: 7, avgRatio: 0.61 },
          ],
        },
        kotodamaMessageDelivery: { totalSent: 30, totalRead: 22 },
      }),
    );
    expect(view.cards.length).toBe(12);
    for (const c of view.cards) {
      expectNoPunishmentWords(
        `${c.title} ${c.primaryValue} ${c.secondaryLabel} ${(c.rows ?? [])
          .map((r) => `${r.label} ${r.value}`)
          .join(" ")}`,
      );
    }
  });
});
