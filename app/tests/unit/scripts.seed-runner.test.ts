/**
 * scripts.seed-runner.test.ts (W4.5 / T-4)
 *
 * 検証ポイント:
 *  1. mapLevelId / mapSkillCode / mapSkillId / mapProblemType の純粋関数群
 *  2. buildChoiceQuestionJson が replace-problem.ts と同型 ({label, text}) を返す
 *  3. buildWriting / Reorder / ReadingPassage の questionJson 構造
 *  4. runSeed(true) が dry-run モードで全 822 件を inserted=822 / skipped=0 で返す
 *     (DB 接続なし: db.insert を vi.fn でスタブ)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// db client をモック (Turso 接続を呼ばない)
vi.mock("@/lib/db/client", () => {
  const insert = vi.fn();
  return {
    db: {
      insert,
      select: vi.fn(),
    },
    schema: {},
  };
});

import {
  mapLevelId,
  mapSkillCode,
  mapSkillId,
  mapProblemType,
  buildChoiceQuestionJson,
  buildWritingQuestionJson,
  buildReorderQuestionJson,
  buildReadingPassageQuestionJson,
  runSeed,
} from "../../scripts/seed-problems-runner";
import type {
  SeedChoice,
  SeedWriting,
  SeedReorder,
  SeedReadingPassage,
} from "../../scripts/seed-id-mapper";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// マッピング系 (純粋関数 / DB 不要)
// ---------------------------------------------------------------------------

describe("mapLevelId()", () => {
  it.each([
    ["eiken-5", "5"],
    ["eiken-4", "4"],
    ["eiken-3", "3"],
  ])("%s → %s", (seed, expected) => {
    expect(mapLevelId(seed)).toBe(expected);
  });

  it("未知の level は throw", () => {
    expect(() => mapLevelId("eiken-x")).toThrow();
  });
});

describe("mapSkillCode()", () => {
  it.each([
    ["vocab", "vocabulary"],
    ["grammar", "grammar"],
    ["listening", "listening"],
    ["listening-response", "listening"],
    ["reading", "reading"],
    ["reorder", "reading"],
    ["writing", "writing"],
  ])("%s → %s", (seed, expected) => {
    expect(mapSkillCode(seed)).toBe(expected);
  });

  it("未知 skill は throw", () => {
    expect(() => mapSkillCode("speaking")).toThrow();
  });
});

describe("mapSkillId()", () => {
  it("vocab + 5 → vocabulary-5", () => {
    expect(mapSkillId("vocab", "5")).toBe("vocabulary-5");
  });
  it("listening-response + 4 → listening-4", () => {
    expect(mapSkillId("listening-response", "4")).toBe("listening-4");
  });
  it("reorder + 5 → reading-5", () => {
    expect(mapSkillId("reorder", "5")).toBe("reading-5");
  });
});

describe("mapProblemType()", () => {
  it("writing variant → writing_essay", () => {
    expect(mapProblemType("writing", "writing")).toBe("writing_essay");
  });
  it("reorder variant → reorder", () => {
    expect(mapProblemType("reorder", "reorder")).toBe("reorder");
  });
  it("passage variant → reading_passage_mcq", () => {
    expect(mapProblemType("reading", "passage")).toBe("reading_passage_mcq");
  });
  it("listening choice variant → listening_mcq", () => {
    expect(mapProblemType("listening", "choice")).toBe("listening_mcq");
    expect(mapProblemType("listening-response", "choice")).toBe("listening_mcq");
  });
  it("vocab choice variant → mcq", () => {
    expect(mapProblemType("vocab", "choice")).toBe("mcq");
  });
});

// ---------------------------------------------------------------------------
// questionJson 構築
// ---------------------------------------------------------------------------

describe("buildChoiceQuestionJson()", () => {
  it("4 択は {label, text} 配列に変換", () => {
    const seed: SeedChoice = {
      id: "V5-001",
      level: "eiken-5",
      skill: "vocab",
      prompt_text: "I (   ) apples.",
      choices: ["like", "likes", "liked", "liking"],
      correct_index: 0,
      explanation_jp: "現在形",
      difficulty: 0,
      estimated_time_sec: 20,
      tags: ["verb-like"],
      copyright_safe: true,
      generated_quality_score: 0.9,
    };
    const q = buildChoiceQuestionJson(seed);
    expect(q["prompt"]).toBe("I (   ) apples.");
    expect(q["choices"]).toEqual([
      { label: "A", text: "like" },
      { label: "B", text: "likes" },
      { label: "C", text: "liked" },
      { label: "D", text: "liking" },
    ]);
    expect(q["tags"]).toEqual(["verb-like"]);
    expect(q["estimatedTimeSec"]).toBe(20);
    expect(q["difficulty"]).toBe(0);
  });

  it("audio_transcript / passage_text を保持", () => {
    const seed: SeedChoice = {
      id: "L5-001",
      level: "eiken-5",
      skill: "listening",
      prompt_text: "What does she say?",
      passage_text: "Hello!",
      choices: ["a", "b", "c", "d"],
      correct_index: 1,
      explanation_jp: "x",
      difficulty: 0,
      estimated_time_sec: 30,
      tags: [],
      audio_transcript: "Hello, my name is Mary.",
      copyright_safe: true,
      generated_quality_score: 0.9,
    };
    const q = buildChoiceQuestionJson(seed);
    expect(q["passage"]).toBe("Hello!");
    expect(q["audioTranscript"]).toBe("Hello, my name is Mary.");
  });
});

describe("buildWritingQuestionJson()", () => {
  it("modelAnswer / wordCount を保持", () => {
    const seed: SeedWriting = {
      id: "W3-001",
      level: "eiken-3",
      skill: "writing",
      prompt: "Why do you like reading?",
      model_answer: "I like reading because it is fun.",
      word_count_min: 25,
      word_count_max: 35,
      estimated_time_sec: 480,
      tags: ["essay"],
      difficulty: 2,
      copyright_safe: true,
      generated_quality_score: 0.9,
    };
    const q = buildWritingQuestionJson(seed);
    expect(q["modelAnswer"]).toBe("I like reading because it is fun.");
    expect(q["wordCountMin"]).toBe(25);
    expect(q["wordCountMax"]).toBe(35);
  });
});

describe("buildReorderQuestionJson()", () => {
  it("chunks / correctOrder / correctSentence を保持", () => {
    const seed: SeedReorder = {
      id: "O5-001",
      level: "eiken-5",
      skill: "reorder",
      prompt_text: "並べ替え",
      choices: ["I", "like", "apples", "."],
      correct_order: [0, 1, 2, 3],
      correct_sentence: "I like apples.",
      explanation_jp: "x",
      difficulty: 0,
      estimated_time_sec: 30,
      tags: [],
      copyright_safe: true,
      generated_quality_score: 0.9,
    };
    const q = buildReorderQuestionJson(seed);
    expect(q["chunks"]).toEqual(["I", "like", "apples", "."]);
    expect(q["correctOrder"]).toEqual([0, 1, 2, 3]);
    expect(q["correctSentence"]).toBe("I like apples.");
  });
});

describe("buildReadingPassageQuestionJson()", () => {
  it("passage と questions[] を保持", () => {
    const seed: SeedReadingPassage = {
      id: "R3-011",
      level: "eiken-3",
      skill: "reading",
      passage: "It was a sunny day.",
      word_count: 5,
      genre: "daily",
      questions: [
        {
          question: "How was the day?",
          choices: ["sunny", "rainy", "cloudy", "snowy"],
          correct_index: 0,
          explanation_jp: "x",
        },
      ],
      difficulty: 1,
      estimated_time_sec: 60,
      tags: [],
      copyright_safe: true,
      generated_quality_score: 0.9,
    };
    const q = buildReadingPassageQuestionJson(seed);
    expect(q["passage"]).toBe("It was a sunny day.");
    expect(q["wordCount"]).toBe(5);
    expect(q["genre"]).toBe("daily");
    type SubQ = {
      prompt: string;
      choices: ReadonlyArray<{ label: string; text: string }>;
      correctAnswer: string;
      explanation: string;
    };
    const qs = q["questions"] as ReadonlyArray<SubQ>;
    expect(qs).toHaveLength(1);
    expect(qs[0]?.correctAnswer).toBe("A");
    expect(qs[0]?.choices[0]).toEqual({ label: "A", text: "sunny" });
  });
});

// ---------------------------------------------------------------------------
// runSeed(true) - DRY_RUN
// ---------------------------------------------------------------------------

describe("runSeed(dryRun=true)", () => {
  it("902 件すべて inserted カウント、DB 書込ゼロ (W12 / W6 +60 / DEC-094)", async () => {
    // db.insert は呼ばれない想定だが、呼ばれた場合のために安全 stub
    const mod = (await import("@/lib/db/client")) as unknown as {
      db: { insert: ReturnType<typeof vi.fn> };
    };

    const summary = await runSeed(true);
    expect(summary.total).toBe(902);
    expect(summary.inserted).toBe(902);
    expect(summary.skipped).toBe(0);

    // dry-run なので db.insert は一度も呼ばれない
    expect(mod.db.insert).not.toHaveBeenCalled();
  });
});
