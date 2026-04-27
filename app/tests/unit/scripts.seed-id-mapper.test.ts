/**
 * scripts.seed-id-mapper.test.ts (W4.5 / T-4)
 *
 * 検証ポイント:
 *  1. assignW2Ids: section ごとに連番が振られる (V5/G5/V4/L4/V3/R3)
 *  2. assignW3Ids: L5/G4/W3/O5/R4 連番、replacement の自然 ID は tags から抽出
 *  3. assignW4Ids: V5W4 連番、L4-021..100 / R3-011..050 への shift、G4-080R 抽出
 *  4. loadAllSeedIds: 全 822 問、ID 重複なし、4 種類の配列構成が正しい
 */

import { describe, it, expect } from "vitest";
import {
  assignW2Ids,
  assignW3Ids,
  assignW4Ids,
  loadAllSeedIds,
} from "../../scripts/seed-id-mapper";

// ---------------------------------------------------------------------------
// W2 採番
// ---------------------------------------------------------------------------

describe("assignW2Ids()", () => {
  it("section ごとに連番を振る", () => {
    const result = assignW2Ids([
      // 5 級 vocab × 2
      makeChoice({ level: "eiken-5", skill: "vocab" }),
      makeChoice({ level: "eiken-5", skill: "vocab" }),
      // 5 級 grammar × 1
      makeChoice({ level: "eiken-5", skill: "grammar" }),
      // 4 級 vocab × 1
      makeChoice({ level: "eiken-4", skill: "vocab" }),
      // 4 級 listening-response × 1
      makeChoice({ level: "eiken-4", skill: "listening-response" }),
      // 3 級 vocab × 1
      makeChoice({ level: "eiken-3", skill: "vocab" }),
      // 3 級 reading × 1
      makeChoice({ level: "eiken-3", skill: "reading" }),
    ]);

    expect(result.map((p) => p.id)).toEqual([
      "V5-001",
      "V5-002",
      "G5-001",
      "V4-001",
      "L4-001",
      "V3-001",
      "R3-001",
    ]);
  });

  it("未知 section は throw する", () => {
    expect(() =>
      assignW2Ids([makeChoice({ level: "eiken-5", skill: "unknown-skill" })]),
    ).toThrow(/未知の section/);
  });
});

// ---------------------------------------------------------------------------
// W3 採番
// ---------------------------------------------------------------------------

describe("assignW3Ids()", () => {
  it("各セクションに L5/G4/R4/W3/O5 連番を振る", () => {
    const r = assignW3Ids({
      listening: [
        makeChoice({ level: "eiken-5", skill: "listening" }),
        makeChoice({ level: "eiken-5", skill: "listening" }),
      ],
      grammar: [makeChoice({ level: "eiken-4", skill: "grammar" })],
      writing: [makeWriting()],
      reorder: [makeReorder()],
      reading: [makeChoice({ level: "eiken-4", skill: "reading" })],
      replacements: [],
    });

    expect(r.choiceProblems.map((p) => p.id)).toEqual([
      "L5-001",
      "L5-002",
      "G4-001",
      "R4-001",
    ]);
    expect(r.writingProblems.map((p) => p.id)).toEqual(["W3-001"]);
    expect(r.reorderProblems.map((p) => p.id)).toEqual(["O5-001"]);
  });

  it("replacement は tags から V3-012R 等を抽出する", () => {
    const r = assignW3Ids({
      listening: [],
      grammar: [],
      writing: [],
      reorder: [],
      reading: [],
      replacements: [
        makeChoice({
          level: "eiken-3",
          skill: "vocab",
          tags: ["replacement", "V3-012R"],
        }),
      ],
    });
    expect(r.choiceProblems[0]?.id).toBe("V3-012R");
  });
});

// ---------------------------------------------------------------------------
// W4 採番 (衝突回避 shift)
// ---------------------------------------------------------------------------

describe("assignW4Ids()", () => {
  it("V5W4 / L4-021.. / R3-011.. に shift する", () => {
    const r = assignW4Ids({
      vocab: [
        makeChoice({ level: "eiken-5", skill: "vocab" }),
        makeChoice({ level: "eiken-5", skill: "vocab" }),
      ],
      listening: [
        makeChoice({ level: "eiken-4", skill: "listening" }),
        makeChoice({ level: "eiken-4", skill: "listening" }),
      ],
      reading: [makeReadingPassage(), makeReadingPassage()],
      replacements: [],
    });
    expect(r.choiceProblems.map((p) => p.id)).toEqual([
      "V5W4-001",
      "V5W4-002",
      "L4-021",
      "L4-022",
    ]);
    expect(r.readingPassageProblems.map((p) => p.id)).toEqual([
      "R3-011",
      "R3-012",
    ]);
  });

  it("replacement は tags から G4-080R 等を抽出する", () => {
    const r = assignW4Ids({
      vocab: [],
      listening: [],
      reading: [],
      replacements: [
        makeChoice({
          level: "eiken-4",
          skill: "grammar",
          tags: ["replacement", "G4-080R"],
        }),
      ],
    });
    expect(r.choiceProblems[0]?.id).toBe("G4-080R");
  });
});

// ---------------------------------------------------------------------------
// loadAllSeedIds: 822 問 / 重複なし
// ---------------------------------------------------------------------------

describe("loadAllSeedIds()", () => {
  it("総数 822 問、ID 重複なし", async () => {
    const all = await loadAllSeedIds();
    expect(all.total).toBe(822);

    // 内訳:
    //   choiceProblems = 200 (W2) + 271 (W3 listening100 + grammar150 + reading20 + repl1)
    //                  + 181 (W4 vocab100 + listening80 + repl1) = 652
    //   writingProblems = 100, reorderProblems = 30, readingPassageProblems = 40
    expect(all.choiceProblems.length).toBe(652);
    expect(all.writingProblems.length).toBe(100);
    expect(all.reorderProblems.length).toBe(30);
    expect(all.readingPassageProblems.length).toBe(40);

    // 全 ID をフラット化して重複検査
    const allIds = [
      ...all.choiceProblems.map((p) => p.id),
      ...all.writingProblems.map((p) => p.id),
      ...all.reorderProblems.map((p) => p.id),
      ...all.readingPassageProblems.map((p) => p.id),
    ];
    expect(allIds.length).toBe(822);
    expect(new Set(allIds).size).toBe(822);
  });

  it("自然 ID 命名規則のサンプル", async () => {
    const all = await loadAllSeedIds();
    const ids = new Set(all.choiceProblems.map((p) => p.id));
    // W2 セクションの最初/最後
    expect(ids.has("V5-001")).toBe(true);
    expect(ids.has("V5-060")).toBe(true);
    expect(ids.has("G5-001")).toBe(true);
    expect(ids.has("V4-001")).toBe(true);
    expect(ids.has("L4-001")).toBe(true);
    expect(ids.has("L4-020")).toBe(true);
    expect(ids.has("V3-001")).toBe(true);
    expect(ids.has("R3-001")).toBe(true);
    expect(ids.has("R3-010")).toBe(true);
    // W3
    expect(ids.has("L5-001")).toBe(true);
    expect(ids.has("L5-100")).toBe(true);
    expect(ids.has("G4-001")).toBe(true);
    expect(ids.has("G4-150")).toBe(true);
    expect(ids.has("R4-001")).toBe(true);
    // W4 shift 確認
    expect(ids.has("V5W4-001")).toBe(true);
    expect(ids.has("V5W4-100")).toBe(true);
    expect(ids.has("L4-021")).toBe(true);
    expect(ids.has("L4-100")).toBe(true);
    // reading-passage は別配列
    const rpIds = new Set(all.readingPassageProblems.map((p) => p.id));
    expect(rpIds.has("R3-011")).toBe(true);
    expect(rpIds.has("R3-050")).toBe(true);
    // writing / reorder
    const wIds = new Set(all.writingProblems.map((p) => p.id));
    expect(wIds.has("W3-001")).toBe(true);
    expect(wIds.has("W3-100")).toBe(true);
    const oIds = new Set(all.reorderProblems.map((p) => p.id));
    expect(oIds.has("O5-001")).toBe(true);
    expect(oIds.has("O5-030")).toBe(true);
  });

  it("level / skill / correct_index は seed の値を保持する", async () => {
    const all = await loadAllSeedIds();
    // すべての choice 問題で choices.length === 4 / correct_index ∈ [0,3]
    for (const p of all.choiceProblems) {
      expect(p.choices.length).toBe(4);
      expect(p.correct_index).toBeGreaterThanOrEqual(0);
      expect(p.correct_index).toBeLessThanOrEqual(3);
      expect(["eiken-5", "eiken-4", "eiken-3"]).toContain(p.level);
    }
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeChoice(overrides: {
  level: string;
  skill: string;
  tags?: string[];
}): Parameters<typeof assignW2Ids>[0][number] {
  return {
    level: overrides.level,
    skill: overrides.skill,
    prompt_text: "(   ) sample",
    choices: ["a", "b", "c", "d"],
    correct_index: 0,
    explanation_jp: "解説",
    difficulty: 0,
    estimated_time_sec: 20,
    tags: overrides.tags ?? [],
    copyright_safe: true,
    generated_quality_score: 0.9,
  };
}

function makeWriting(): Parameters<
  typeof assignW3Ids
>[0]["writing"][number] {
  return {
    level: "eiken-3",
    skill: "writing",
    prompt: "Why do you like ...?",
    model_answer: "I like it because ...",
    word_count_min: 25,
    word_count_max: 35,
    estimated_time_sec: 480,
    tags: [],
    difficulty: 2,
    copyright_safe: true,
    generated_quality_score: 0.9,
  };
}

function makeReorder(): Parameters<
  typeof assignW3Ids
>[0]["reorder"][number] {
  return {
    level: "eiken-5",
    skill: "reorder",
    prompt_text: "並べ替えてね",
    choices: ["I", "like", "apples", "."],
    correct_order: [0, 1, 2, 3],
    correct_sentence: "I like apples.",
    explanation_jp: "解説",
    difficulty: 0,
    estimated_time_sec: 30,
    tags: [],
    copyright_safe: true,
    generated_quality_score: 0.9,
  };
}

function makeReadingPassage(): Parameters<
  typeof assignW4Ids
>[0]["reading"][number] {
  return {
    level: "eiken-3",
    skill: "reading",
    passage: "This is a passage.",
    word_count: 50,
    genre: "daily",
    questions: [
      {
        question: "What is it?",
        choices: ["a", "b", "c", "d"],
        correct_index: 0,
        explanation_jp: "解説",
      },
      {
        question: "Where?",
        choices: ["a", "b", "c", "d"],
        correct_index: 1,
        explanation_jp: "解説",
      },
    ],
    difficulty: 1,
    estimated_time_sec: 120,
    tags: [],
    copyright_safe: true,
    generated_quality_score: 0.9,
  };
}
