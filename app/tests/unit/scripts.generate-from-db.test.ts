/**
 * scripts.generate-from-db.test.ts (W7 / B-9)
 *
 * 検証対象:
 *  - normalizeLevelFilterToDb: LEVEL_FILTER 文字列を DB level_id へ正規化
 *  - extractMissingProblems: LEFT JOIN 行から explanation 未生成のものだけ抽出
 *  - buildChoiceInputFromDb: 単問形式の questionJson から GenerateInput を組み立て
 *  - parsePassageQuestions: reading_passage_mcq の questionJson から
 *                           question 単位の GenerateInput を組み立て
 *  - buildUserPrompt / formatExplanationText: 共通モジュールの整形
 *
 * DB / OpenAI は副作用なので呼ばない (純粋関数のみ単体テスト)。
 */

import { describe, it, expect, vi } from "vitest";

// generate-explanations-from-db / explanation-generator 内で db client / openai client が
// import されると Turso 接続を試みるため、テスト中は両者を mock する。
vi.mock("@/lib/db/client", () => ({ db: {}, schema: {} }));
vi.mock("../../src/lib/db/client", () => ({ db: {}, schema: {} }));
vi.mock("../../src/lib/ai/openai", () => ({
  primaryModel: () => ({}),
  fallbackModel: () => ({}),
  hasApiKey: () => false,
  PRIMARY_MODEL: "gpt-5-mini",
  FALLBACK_MODEL: "gpt-4.1-mini",
}));

import {
  normalizeLevelFilterToDb,
  extractMissingProblems,
  buildChoiceInputFromDb,
  type DbProblemRow,
  type JoinedRow,
} from "../../scripts/generate-explanations-from-db";

import {
  parsePassageQuestions,
  buildUserPrompt,
  formatExplanationText,
} from "../../scripts/lib/explanation-generator";

// ---------------------------------------------------------------------------
// normalizeLevelFilterToDb
// ---------------------------------------------------------------------------
describe("normalizeLevelFilterToDb()", () => {
  it.each([
    ["", ""],
    ["  ", ""],
    ["5", "5"],
    ["4", "4"],
    ["3", "3"],
    ["eiken-5", "5"],
    ["eiken-4", "4"],
    ["eiken-3", "3"],
    ["unknown", ""],
  ])("%j → %j", (input, expected) => {
    expect(normalizeLevelFilterToDb(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// extractMissingProblems
// ---------------------------------------------------------------------------
describe("extractMissingProblems()", () => {
  function makeProblem(id: string): DbProblemRow {
    return {
      id,
      type: "mcq",
      levelId: "5",
      skillId: "vocabulary-5",
      questionJson: { prompt: "x", choices: [] },
      correctAnswer: "A",
    };
  }

  it("explanationId が null の行のみ抽出する", () => {
    const rows: JoinedRow[] = [
      { problem: makeProblem("V5-001"), explanationId: null },
      { problem: makeProblem("V5-002"), explanationId: "pe_xxx" },
      { problem: makeProblem("V5-003"), explanationId: null },
    ];
    const out = extractMissingProblems(rows);
    expect(out.map((p) => p.id)).toEqual(["V5-001", "V5-003"]);
  });

  it("空配列なら空配列", () => {
    expect(extractMissingProblems([])).toEqual([]);
  });

  it("全件 explanationId がある場合は空配列", () => {
    const rows: JoinedRow[] = [
      { problem: makeProblem("V5-001"), explanationId: "pe_a" },
      { problem: makeProblem("V5-002"), explanationId: "pe_b" },
    ];
    expect(extractMissingProblems(rows)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildChoiceInputFromDb
// ---------------------------------------------------------------------------
describe("buildChoiceInputFromDb()", () => {
  it("通常の mcq questionJson から GenerateInput を組み立てる", () => {
    const row: DbProblemRow = {
      id: "V5-001",
      type: "mcq",
      levelId: "5",
      skillId: "vocabulary-5",
      questionJson: {
        prompt: "I (   ) an apple.",
        choices: [
          { label: "A", text: "eat" },
          { label: "B", text: "eats" },
          { label: "C", text: "ate" },
          { label: "D", text: "eating" },
        ],
      },
      correctAnswer: "A",
    };
    const input = buildChoiceInputFromDb(row);
    expect(input).not.toBeNull();
    expect(input?.prompt).toBe("I (   ) an apple.");
    expect(input?.choices).toEqual(["eat", "eats", "ate", "eating"]);
    expect(input?.correctAnswer).toBe("A");
  });

  it("passage 付き reading 短文 mcq では prompt に passage を連結する", () => {
    const row: DbProblemRow = {
      id: "R3-001",
      type: "mcq",
      levelId: "3",
      skillId: "reading-3",
      questionJson: {
        prompt: "What did Tom do?",
        passage: "Tom went to the park yesterday.",
        choices: [
          { label: "A", text: "went to the park" },
          { label: "B", text: "stayed home" },
          { label: "C", text: "went shopping" },
          { label: "D", text: "ate dinner" },
        ],
      },
      correctAnswer: "A",
    };
    const input = buildChoiceInputFromDb(row);
    expect(input?.prompt).toContain("[Passage]");
    expect(input?.prompt).toContain("Tom went to the park yesterday.");
    expect(input?.prompt).toContain("[Question]");
    expect(input?.prompt).toContain("What did Tom do?");
  });

  it("questionJson が null の場合は null を返す", () => {
    const row: DbProblemRow = {
      id: "X-001",
      type: "mcq",
      levelId: "5",
      skillId: "vocabulary-5",
      questionJson: null,
      correctAnswer: "A",
    };
    expect(buildChoiceInputFromDb(row)).toBeNull();
  });

  it("choices が空でも擬似 4 択を返す (writing_essay 等)", () => {
    const row: DbProblemRow = {
      id: "W3-001",
      type: "writing_essay",
      levelId: "3",
      skillId: "writing-3",
      questionJson: { prompt: "Write about your school." },
      correctAnswer: "I love my school.",
    };
    const input = buildChoiceInputFromDb(row);
    expect(input).not.toBeNull();
    expect(input?.choices).toHaveLength(4);
    expect(input?.choices[0]).toBe("I love my school.");
  });
});

// ---------------------------------------------------------------------------
// parsePassageQuestions (reading_passage_mcq)
// ---------------------------------------------------------------------------
describe("parsePassageQuestions()", () => {
  it("複数 question を index 付きで展開し、passage を各 prompt に連結する", () => {
    const json = {
      passage: "My dog Pochi is brown. He likes to play in the park.",
      wordCount: 12,
      genre: "diary",
      questions: [
        {
          prompt: "What color is Pochi?",
          choices: [
            { label: "A", text: "brown" },
            { label: "B", text: "white" },
            { label: "C", text: "black" },
            { label: "D", text: "red" },
          ],
          correctAnswer: "A",
          explanation: "本文に brown と書いてあります。",
        },
        {
          prompt: "Where does Pochi like to play?",
          choices: [
            { label: "A", text: "house" },
            { label: "B", text: "school" },
            { label: "C", text: "park" },
            { label: "D", text: "shop" },
          ],
          correctAnswer: "C",
          explanation: "本文に in the park と書いてあります。",
        },
      ],
    };
    const out = parsePassageQuestions(json);
    expect(out).toHaveLength(2);
    const [first, second] = out;
    if (!first || !second) throw new Error("expected 2 items");

    expect(first.index).toBe(0);
    expect(first.input.prompt).toContain("[Passage]");
    expect(first.input.prompt).toContain("My dog Pochi is brown.");
    expect(first.input.prompt).toContain("[Question]");
    expect(first.input.prompt).toContain("What color is Pochi?");
    expect(first.input.choices).toEqual(["brown", "white", "black", "red"]);
    expect(first.input.correctAnswer).toBe("A");

    expect(second.index).toBe(1);
    expect(second.input.correctAnswer).toBe("C");
  });

  it("null / undefined / 空 questions 配列なら空配列", () => {
    expect(parsePassageQuestions(null)).toEqual([]);
    expect(parsePassageQuestions(undefined)).toEqual([]);
    expect(parsePassageQuestions({ passage: "x", questions: [] })).toEqual([]);
    expect(parsePassageQuestions({ passage: "x" })).toEqual([]);
  });

  it("questions に passage が無くとも prompt は使える", () => {
    const json = {
      passage: "",
      questions: [
        {
          prompt: "Standalone question",
          choices: [{ label: "A", text: "yes" }],
          correctAnswer: "A",
        },
      ],
    };
    const out = parsePassageQuestions(json);
    expect(out).toHaveLength(1);
    const [only] = out;
    if (!only) throw new Error("expected 1 item");
    expect(only.input.prompt).toBe("Standalone question");
  });
});

// ---------------------------------------------------------------------------
// buildUserPrompt / formatExplanationText
// ---------------------------------------------------------------------------
describe("buildUserPrompt()", () => {
  it("選択肢を A/B/C/D ラベル付きで列挙する", () => {
    const out = buildUserPrompt({
      prompt: "I (   ) a book.",
      choices: ["read", "reads", "reading", "to read"],
      correctAnswer: "A",
    });
    expect(out).toContain("問題: I (   ) a book.");
    expect(out).toContain("A: read");
    expect(out).toContain("B: reads");
    expect(out).toContain("C: reading");
    expect(out).toContain("D: to read");
    expect(out).toContain("正解: A");
  });
});

describe("formatExplanationText()", () => {
  it("正解の理由 / 誤答の理由 / 覚えるコツの 3 セクションを順に出力する", () => {
    const out = formatExplanationText({
      correctReason: "主語が I なので read が正しい",
      wrongReasons: [
        { choice: "B: reads", reason: "三人称単数ではない" },
        { choice: "C: reading", reason: "be 動詞がない" },
      ],
      kidNote: "I の動詞は原形のまま",
    });
    expect(out).toContain("【正解の理由】 主語が I なので read が正しい");
    expect(out).toContain("【誤答の理由】");
    expect(out).toContain("- B: reads: 三人称単数ではない");
    expect(out).toContain("- C: reading: be 動詞がない");
    expect(out).toContain("【覚えるコツ】 I の動詞は原形のまま");
  });
});
