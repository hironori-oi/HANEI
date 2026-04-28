/**
 * ai.score-writing.test.ts (W6 / F-2)
 *
 * scoreWritingEssay の fallback パスを純関数的に検証する。
 *
 *  1. jaccardWordOverlap: 完全一致 → 1.0
 *  2. jaccardWordOverlap: 完全不一致 → 0.0
 *  3. buildFallbackResult: source / score / kid-safe フィードバックを返す
 *  4. buildSystemPrompt: 「ネガティブ表現禁止」を含む
 *  5. scoreWritingEssay: API key 未設定時は fallback_no_key を返す
 */

import { describe, it, expect, vi } from "vitest";

// moderation を no-op に固定 (flagged=false)
vi.mock("@/lib/ai/moderation", () => ({
  moderateText: vi.fn().mockResolvedValue({
    flagged: false,
    ngWords: [],
    forbiddenPhrases: [],
    openaiCategories: {},
  }),
}));

// API key 未設定の挙動を検証するため hasApiKey=false に固定
vi.mock("@/lib/ai/openai", () => ({
  primaryModel: vi.fn(),
  fallbackModel: vi.fn(),
  hasApiKey: vi.fn().mockReturnValue(false),
}));

import {
  scoreWritingEssay,
  buildFallbackResult,
  buildSystemPrompt,
  buildUserPrompt,
  estimateInputTokens,
  jaccardWordOverlap,
  WRITING_PASS_THRESHOLD,
  WRITING_PER_REQUEST_HARD_CAP_JPY,
} from "@/lib/ai/score-writing";

describe("jaccardWordOverlap", () => {
  it("returns 1.0 for identical word sets", () => {
    expect(jaccardWordOverlap("I like cats", "I like cats")).toBe(1);
  });
  it("returns 0 for fully disjoint sets", () => {
    expect(jaccardWordOverlap("alpha beta", "gamma delta")).toBe(0);
  });
  it("returns ~0.33 when one word overlaps out of three unique", () => {
    // a:{cat,dog} b:{cat,bird} → intersection 1 / union 3 = 0.3333
    const v = jaccardWordOverlap("cat dog", "cat bird");
    expect(v).toBeGreaterThan(0.3);
    expect(v).toBeLessThan(0.4);
  });
});

describe("buildFallbackResult", () => {
  it("returns kid-safe deterministic result", () => {
    const r = buildFallbackResult(
      {
        userAnswer: "I like cats",
        modelAnswer: "I like cats and dogs",
        prompt: "What animals do you like?",
        level: "3",
      },
      "fallback_no_key",
    );
    expect(r.source).toBe("fallback_no_key");
    expect(r.score).toBeGreaterThan(0);
    expect(r.feedback).toMatch(/.{10,}/); // 10字以上
    expect(r.feedback).not.toMatch(/だめ|間違|ひどい|悪い/);
    expect(r.estimatedCostJpy).toBe(0);
  });
});

describe("buildSystemPrompt", () => {
  it("includes the kid-safe / no-negative directive", () => {
    const sp = buildSystemPrompt("3");
    expect(sp).toContain("ネガティブ表現");
    expect(sp).toContain("小学生");
    expect(sp).toContain("英検3級");
    expect(sp).toContain("JSON");
  });
});

describe("buildUserPrompt", () => {
  it("interpolates prompt / modelAnswer / userAnswer in JA labels", () => {
    const up = buildUserPrompt({
      userAnswer: "I like dogs.",
      modelAnswer: "I like dogs because they are kind.",
      prompt: "What animal do you like?",
      level: "3",
    });
    expect(up).toContain("【設問】");
    expect(up).toContain("What animal do you like?");
    expect(up).toContain("【模範解答】");
    expect(up).toContain("I like dogs because they are kind.");
    expect(up).toContain("【子どもの作文】");
    expect(up).toContain("I like dogs.");
    expect(up).toContain("JSON");
  });
});

describe("estimateInputTokens", () => {
  it("approximates ~4 chars per token (rounded up)", () => {
    expect(estimateInputTokens("")).toBe(0);
    expect(estimateInputTokens("abcd")).toBe(1); // 4 / 4 = 1
    expect(estimateInputTokens("abcde")).toBe(2); // 5 / 4 = 1.25 → ceil 2
    expect(estimateInputTokens("a".repeat(100))).toBe(25); // 100 / 4 = 25
  });
});

describe("scoreWritingEssay (no API key path)", () => {
  it("falls back deterministically when OPENAI_API_KEY is missing", async () => {
    const r = await scoreWritingEssay({
      userAnswer: "I like soccer.",
      modelAnswer: "I like soccer because it is fun.",
      prompt: "What sport do you like?",
      level: "3",
    });
    expect(r.source).toBe("fallback_no_key");
    expect(r.estimatedCostJpy).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
    // isCorrect は閾値で決まる
    expect(r.isCorrect).toBe(r.score >= WRITING_PASS_THRESHOLD);
  });

  it("hard caps per-request cost at <= 1 JPY", () => {
    expect(WRITING_PER_REQUEST_HARD_CAP_JPY).toBeLessThanOrEqual(1);
  });
});
