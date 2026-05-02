/**
 * Unit tests: src/lib/experiments/experiments-catalog.ts
 *               + buildExperimentCohortCard (src/lib/admin/kpi-summary.ts)
 *
 * (W12-T2 / DEC-066)
 *
 * 純関数の不変条件:
 *   - assignVariant: deterministic / 50/50 ±5% 分布 / 空・0 weight throw / 単一 variant 必ず命中
 *   - validateExperimentsJson: null / 配列 / number / object 内非 string 値 を防御正規化
 *   - isKnownExperiment / getExperimentDef: catalog 未登録 → false / undefined
 *   - buildExperimentCohortCard: 0 件 / 部分埋め / variant 昇順 / 罰語不在
 *
 * DEC-024 罰則ゼロ厳守: 罰語が catalog / fallback / card label に混入しない.
 */

import { describe, expect, it } from "vitest";

import {
  EXPERIMENTS,
  assignVariant,
  getExperimentDef,
  isKnownExperiment,
  validateExperimentsJson,
  type VariantDef,
} from "@/lib/experiments/experiments-catalog";
import {
  buildExperimentCohortCard,
  composeKpiDashboardView,
  type ExperimentCohortRaw,
  type KpiDashboardRaw,
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
  "劣位",
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
    generatedAt: FIXED_NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// EXPERIMENTS catalog 構造の不変条件
// ---------------------------------------------------------------------------
describe("EXPERIMENTS catalog", () => {
  it("streak_freeze_monthly_grant が定義されている", () => {
    expect(EXPERIMENTS.streak_freeze_monthly_grant).toBeDefined();
    expect(EXPERIMENTS.streak_freeze_monthly_grant.key).toBe(
      "streak_freeze_monthly_grant",
    );
  });

  it("variants は control + variant_a の 2 件で 50/50", () => {
    const def = EXPERIMENTS.streak_freeze_monthly_grant;
    expect(def.variants.length).toBe(2);
    const keys = def.variants.map((v) => v.key);
    expect(keys).toContain("control");
    expect(keys).toContain("variant_a");
    const total = def.variants.reduce((acc, v) => acc + v.weight, 0);
    expect(total).toBe(100);
  });

  it("default は variants の key と一致", () => {
    const def = EXPERIMENTS.streak_freeze_monthly_grant;
    const keys = def.variants.map((v) => v.key);
    expect(keys).toContain(def.default);
  });

  it("catalog 全 entry の text に罰語が含まれない (DEC-024)", () => {
    for (const def of Object.values(EXPERIMENTS)) {
      expectNoPunishmentWords(def.description);
      for (const v of def.variants) {
        expectNoPunishmentWords(v.label);
        expectNoPunishmentWords(v.key);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// assignVariant: deterministic 割当 + 異常入力ガード
// ---------------------------------------------------------------------------
describe("assignVariant", () => {
  const variants: ReadonlyArray<VariantDef> = [
    { key: "control", weight: 50, label: "1 枚 (control)" },
    { key: "variant_a", weight: 50, label: "2 枚" },
  ];

  it("同一 seed × 同一 variants は必ず同じ variant", () => {
    const a = assignVariant("learner_001:streak_freeze_monthly_grant", variants);
    const b = assignVariant("learner_001:streak_freeze_monthly_grant", variants);
    const c = assignVariant("learner_001:streak_freeze_monthly_grant", variants);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("異なる seed は分布する (50/50 で 10000 件 ±5% 以内)", () => {
    const variantsAB = [
      { key: "control", weight: 50, label: "control" },
      { key: "variant_a", weight: 50, label: "variant_a" },
    ];
    let controlCount = 0;
    const N = 10000;
    for (let i = 0; i < N; i += 1) {
      const v = assignVariant(
        `learner_${i}:streak_freeze_monthly_grant`,
        variantsAB,
      );
      if (v === "control") controlCount += 1;
    }
    const ratio = controlCount / N;
    // FNV-1a 32-bit / N=10000 で ±5% 以内に収まる (実測 ±0.5% 程度)
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.55);
  });

  it("単一 variant (weight > 0) は必ずその variant", () => {
    const single = [{ key: "only", weight: 1, label: "only" }];
    expect(assignVariant("seed_a", single)).toBe("only");
    expect(assignVariant("seed_b", single)).toBe("only");
    expect(assignVariant("", single)).toBe("only");
  });

  it("3 variant 不均等 weight (10/30/60) でも全 variant 命中可能", () => {
    const triple: ReadonlyArray<VariantDef> = [
      { key: "a", weight: 10, label: "a" },
      { key: "b", weight: 30, label: "b" },
      { key: "c", weight: 60, label: "c" },
    ];
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      seen.add(assignVariant(`seed_${i}`, triple));
    }
    expect(seen.has("a")).toBe(true);
    expect(seen.has("b")).toBe(true);
    expect(seen.has("c")).toBe(true);
  });

  it("空配列入力は throw", () => {
    expect(() => assignVariant("seed", [])).toThrow();
  });

  it("非配列入力 (undefined) は throw", () => {
    expect(() =>
      assignVariant(
        "seed",
        undefined as unknown as ReadonlyArray<VariantDef>,
      ),
    ).toThrow();
  });

  it("weight 合計 0 は throw", () => {
    expect(() =>
      assignVariant("seed", [
        { key: "a", weight: 0, label: "a" },
        { key: "b", weight: 0, label: "b" },
      ]),
    ).toThrow();
  });

  it("負 weight / NaN weight は throw", () => {
    expect(() =>
      assignVariant("seed", [
        { key: "a", weight: -1, label: "a" },
      ]),
    ).toThrow();
    expect(() =>
      assignVariant("seed", [
        { key: "a", weight: Number.NaN, label: "a" },
      ]),
    ).toThrow();
  });

  it("variant key が string でない場合 throw", () => {
    expect(() =>
      assignVariant("seed", [
        { key: 123 as unknown as string, weight: 1, label: "x" },
      ]),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateExperimentsJson: 入力防御正規化
// ---------------------------------------------------------------------------
describe("validateExperimentsJson", () => {
  it("null / undefined / 配列 / 数値 / 文字列 は {}", () => {
    expect(validateExperimentsJson(null)).toEqual({});
    expect(validateExperimentsJson(undefined)).toEqual({});
    expect(validateExperimentsJson([])).toEqual({});
    expect(validateExperimentsJson([1, 2, 3])).toEqual({});
    expect(validateExperimentsJson(42)).toEqual({});
    expect(validateExperimentsJson("hello")).toEqual({});
    expect(validateExperimentsJson(true)).toEqual({});
  });

  it("有効な Record<string,string> はそのまま", () => {
    expect(
      validateExperimentsJson({
        streak_freeze_monthly_grant: "variant_a",
        another_test: "control",
      }),
    ).toEqual({
      streak_freeze_monthly_grant: "variant_a",
      another_test: "control",
    });
  });

  it("非 string value は entry ごと drop", () => {
    expect(
      validateExperimentsJson({
        a: "x",
        b: 1,
        c: null,
        d: { nested: true },
        e: "y",
        f: "",
      }),
    ).toEqual({ a: "x", e: "y" });
  });

  it("元値を破壊しない", () => {
    const src = { a: "x", b: 1, c: "y" };
    validateExperimentsJson(src);
    expect(src).toEqual({ a: "x", b: 1, c: "y" });
  });
});

// ---------------------------------------------------------------------------
// isKnownExperiment / getExperimentDef
// ---------------------------------------------------------------------------
describe("isKnownExperiment / getExperimentDef", () => {
  it("登録済 key は true / def 取得可", () => {
    expect(isKnownExperiment("streak_freeze_monthly_grant")).toBe(true);
    expect(getExperimentDef("streak_freeze_monthly_grant")?.key).toBe(
      "streak_freeze_monthly_grant",
    );
  });

  it("未知 key は false / undefined", () => {
    expect(isKnownExperiment("unknown_experiment")).toBe(false);
    expect(getExperimentDef("unknown_experiment")).toBeUndefined();
  });

  it("空文字 / 非 string は false / undefined", () => {
    expect(isKnownExperiment("")).toBe(false);
    expect(
      isKnownExperiment(undefined as unknown as string),
    ).toBe(false);
    expect(getExperimentDef("")).toBeUndefined();
  });

  it("prototype pollution を避ける (toString 等は false)", () => {
    expect(isKnownExperiment("toString")).toBe(false);
    expect(isKnownExperiment("hasOwnProperty")).toBe(false);
    expect(getExperimentDef("toString")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildExperimentCohortCard / composeKpiDashboardView 経由
// ---------------------------------------------------------------------------
describe("buildExperimentCohortCard", () => {
  it("undefined 入力は中立 fallback", () => {
    const card = buildExperimentCohortCard(undefined);
    expect(card.kpiId).toBe("experiment-streak-freeze-cohort");
    expect(card.primaryValue).toBe("——");
    expect(card.iconName).toBe("BeakerIcon");
    expectNoPunishmentWords(card.title);
    expectNoPunishmentWords(card.secondaryLabel);
  });

  it("distribution 0 件は中立 fallback (description は表示)", () => {
    const raw: ExperimentCohortRaw = {
      experimentKey: "streak_freeze_monthly_grant",
      description: "月次 streak freeze 自動付与の枚数",
      distribution: [],
      streakAvg: [],
    };
    const card = buildExperimentCohortCard(raw);
    expect(card.primaryValue).toBe("——");
    expect(card.secondaryLabel).toContain("月次");
    expect(card.rows).toEqual([]);
    expectNoPunishmentWords(card.secondaryLabel);
  });

  it("distribution 全件 0 件 (合計 0) も fallback", () => {
    const raw: ExperimentCohortRaw = {
      experimentKey: "streak_freeze_monthly_grant",
      description: "x",
      distribution: [
        { variantKey: "control", count: 0 },
        { variantKey: "variant_a", count: 0 },
      ],
      streakAvg: [],
    };
    const card = buildExperimentCohortCard(raw);
    expect(card.primaryValue).toBe("——");
    expect(card.rows).toEqual([]);
  });

  it("distribution + streakAvg 両方ある場合: variantKey 昇順 + 平均 streak 表示", () => {
    const raw: ExperimentCohortRaw = {
      experimentKey: "streak_freeze_monthly_grant",
      description: "月次 streak freeze 自動付与の枚数",
      distribution: [
        { variantKey: "variant_a", count: 30 },
        { variantKey: "control", count: 25 },
      ],
      streakAvg: [
        { variantKey: "control", avgStreak: 3.4, n: 25 },
        { variantKey: "variant_a", avgStreak: 4.7, n: 30 },
      ],
    };
    const card = buildExperimentCohortCard(raw);
    // primaryValue = 25 + 30 = 55
    expect(card.primaryValue).toMatch(/55/);
    // rows は variantKey 昇順 (control < variant_a)
    expect(card.rows!.map((r) => r.id)).toEqual(["control", "variant_a"]);
    expect(card.rows![0]!.value).toMatch(/cohort 25/);
    expect(card.rows![0]!.value).toMatch(/3\.4 日/);
    expect(card.rows![1]!.value).toMatch(/4\.7 日/);
  });

  it("distribution あり / streakAvg 欠落の variant は '集計待ち' fallback", () => {
    const raw: ExperimentCohortRaw = {
      experimentKey: "streak_freeze_monthly_grant",
      description: "x",
      distribution: [
        { variantKey: "control", count: 5 },
        { variantKey: "variant_a", count: 3 },
      ],
      // variant_a だけ streak 集計欠落
      streakAvg: [{ variantKey: "control", avgStreak: 2.0, n: 5 }],
    };
    const card = buildExperimentCohortCard(raw);
    const variantA = card.rows!.find((r) => r.id === "variant_a")!;
    expect(variantA.value).toContain("集計待ち");
    expectNoPunishmentWords(variantA.value);
  });

  it("不正 row (variantKey 空 / null) は除外", () => {
    const raw = {
      experimentKey: "streak_freeze_monthly_grant",
      description: "x",
      distribution: [
        { variantKey: "control", count: 10 },
        { variantKey: "", count: 99 },
        null,
      ],
      streakAvg: [
        { variantKey: "control", avgStreak: 1.0, n: 10 },
        { variantKey: "", avgStreak: 9.9, n: 99 },
      ],
    } as unknown as ExperimentCohortRaw;
    const card = buildExperimentCohortCard(raw);
    expect(card.rows!.map((r) => r.id)).toEqual(["control"]);
    expect(card.primaryValue).toMatch(/10/);
  });

  it("description 欠落 (空) は中立 fallback で穴埋め", () => {
    const raw: ExperimentCohortRaw = {
      experimentKey: "streak_freeze_monthly_grant",
      description: "",
      distribution: [{ variantKey: "control", count: 1 }],
      streakAvg: [],
    };
    const card = buildExperimentCohortCard(raw);
    expectNoPunishmentWords(card.secondaryLabel);
    expect(card.secondaryLabel.length).toBeGreaterThan(0);
  });

  it("罰語不在 (DEC-024 構造的担保)", () => {
    const raw: ExperimentCohortRaw = {
      experimentKey: "streak_freeze_monthly_grant",
      description: "月次 streak freeze 自動付与の枚数",
      distribution: [
        { variantKey: "control", count: 50 },
        { variantKey: "variant_a", count: 50 },
      ],
      streakAvg: [
        { variantKey: "control", avgStreak: 3.1, n: 50 },
        { variantKey: "variant_a", avgStreak: 4.2, n: 50 },
      ],
    };
    const card = buildExperimentCohortCard(raw);
    expectNoPunishmentWords(card.title);
    expectNoPunishmentWords(card.primaryValue);
    expectNoPunishmentWords(card.secondaryLabel);
    for (const r of card.rows ?? []) {
      expectNoPunishmentWords(r.label);
      expectNoPunishmentWords(r.value);
    }
  });
});

// ---------------------------------------------------------------------------
// composeKpiDashboardView 経由で 10 枚 card に展開されるか
// ---------------------------------------------------------------------------
describe("composeKpiDashboardView (with experiment cohort)", () => {
  it("experimentCohort raw を渡すと 10 枚目に experiment-streak-freeze-cohort が現れる", () => {
    const view = composeKpiDashboardView(
      buildRaw({
        experimentCohort: {
          experimentKey: "streak_freeze_monthly_grant",
          description: "月次 streak freeze 自動付与の枚数",
          distribution: [
            { variantKey: "control", count: 8 },
            { variantKey: "variant_a", count: 9 },
          ],
          streakAvg: [
            { variantKey: "control", avgStreak: 2.5, n: 8 },
            { variantKey: "variant_a", avgStreak: 3.6, n: 9 },
          ],
        },
      }),
    );
    expect(view.cards.length).toBe(10);
    const last = view.cards[view.cards.length - 1]!;
    expect(last.kpiId).toBe("experiment-streak-freeze-cohort");
    expect(last.primaryValue).toMatch(/17/);
  });
});
