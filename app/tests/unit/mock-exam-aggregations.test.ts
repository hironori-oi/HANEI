/**
 * mock-exam-aggregations.test.ts (W4 / T-7)
 *
 * 検証ポイント:
 *  1. computeWeakestSkills - 4 技能の平均が低い順に上位 N を返す
 *  2. computeWeakestSkills - 受験 0 件で空配列
 *  3. computeWeakestSkills - 同点の場合は元の順序を保つ (vocab → grammar → reading → listening)
 *  4. buildCoachSuggestionForWeakSkills - 弱点なしで初期メッセージ
 *  5. buildCoachSuggestionForWeakSkills - vocab 弱点で「単語カード」テンプレを含む
 *  6. buildCoachSuggestionForWeakSkills - 全 4 技能のテンプレが順序通りに並ぶ
 */

import { describe, it, expect } from "vitest";

import {
  computeWeakestSkills,
  buildCoachSuggestionForWeakSkills,
  type SkillScores,
} from "@/lib/study/aggregations";

const mkRow = (skills: SkillScores) => ({ skills });

describe("computeWeakestSkills()", () => {
  it("受験 0 件なら空配列", () => {
    expect(computeWeakestSkills([], 3)).toEqual([]);
  });

  it("3 行の平均で低い順に上位 3 つを返す", () => {
    const rows = [
      mkRow({ vocab: 0.9, grammar: 0.5, reading: 0.4, listening: 0.3 }),
      mkRow({ vocab: 0.8, grammar: 0.4, reading: 0.5, listening: 0.4 }),
      mkRow({ vocab: 0.7, grammar: 0.6, reading: 0.6, listening: 0.5 }),
    ];
    const w = computeWeakestSkills(rows, 3);
    // 平均 listening = (0.3 + 0.4 + 0.5) / 3 = 0.4 (最も低い)
    // 平均 grammar = (0.5 + 0.4 + 0.6) / 3 = 0.5
    // 平均 reading = (0.4 + 0.5 + 0.6) / 3 = 0.5
    // 平均 vocab = (0.9 + 0.8 + 0.7) / 3 = 0.8
    expect(w[0]?.skill).toBe("listening");
    expect(w[0]?.averageScore).toBeCloseTo(0.4, 4);
    expect(w[0]?.sampleSize).toBe(3);
    // 2 番目と 3 番目は同点 (0.5) で grammar / reading のいずれかが先
    expect(["grammar", "reading"]).toContain(w[1]?.skill);
    expect(["grammar", "reading"]).toContain(w[2]?.skill);
  });

  it("topN=2 を渡すと 2 件しか返らない", () => {
    const rows = [
      mkRow({ vocab: 0.9, grammar: 0.5, reading: 0.4, listening: 0.3 }),
    ];
    const w = computeWeakestSkills(rows, 2);
    expect(w).toHaveLength(2);
  });
});

describe("buildCoachSuggestionForWeakSkills()", () => {
  it("受験 0 件なら初期メッセージ", () => {
    const msg = buildCoachSuggestionForWeakSkills([]);
    expect(msg).toMatch(/まだ模試結果が登録されていません/);
  });

  it("vocab が最弱なら「単語カード」テンプレを含む", () => {
    const msg = buildCoachSuggestionForWeakSkills([
      { skill: "vocab", averageScore: 0.3, sampleSize: 3 },
      { skill: "grammar", averageScore: 0.5, sampleSize: 3 },
      { skill: "listening", averageScore: 0.6, sampleSize: 3 },
    ]);
    expect(msg).toMatch(/語彙/);
    expect(msg).toMatch(/単語カード/);
    expect(msg).toMatch(/30%/); // 0.3 -> 30%
  });

  it("4 技能 全てが弱点リストにあれば全テンプレが含まれる", () => {
    const msg = buildCoachSuggestionForWeakSkills([
      { skill: "listening", averageScore: 0.2, sampleSize: 3 },
      { skill: "reading", averageScore: 0.4, sampleSize: 3 },
      { skill: "grammar", averageScore: 0.5, sampleSize: 3 },
      { skill: "vocab", averageScore: 0.7, sampleSize: 3 },
    ]);
    expect(msg).toMatch(/シャドーイング/);
    expect(msg).toMatch(/読解/);
    expect(msg).toMatch(/文法ドリル/);
    expect(msg).toMatch(/単語カード/);
  });
});
