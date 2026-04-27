/**
 * AI コーチの tool use スキーマ (zod) の妥当性テスト
 */

import { describe, it, expect } from "vitest";
import {
  RecommendNextProblemsInput,
  ExplainWrongAnswerInput,
  GenerateAdditionalProblemInput,
  UpdateStudyPlanInput,
  aiCoachTools,
} from "@/lib/ai/tools";

describe("aiCoachTools", () => {
  it("4 つの tool が定義されている", () => {
    expect(Object.keys(aiCoachTools)).toHaveLength(4);
    expect(aiCoachTools).toHaveProperty("recommend_next_problems");
    expect(aiCoachTools).toHaveProperty("explain_wrong_answer");
    expect(aiCoachTools).toHaveProperty("generate_additional_problem");
    expect(aiCoachTools).toHaveProperty("update_study_plan");
  });
});

describe("RecommendNextProblemsInput schema", () => {
  it("count のデフォルトは 5", () => {
    const parsed = RecommendNextProblemsInput.parse({ learnerId: "l1" });
    expect(parsed.count).toBe(5);
  });

  it("count が 21 以上ならエラー", () => {
    expect(() => RecommendNextProblemsInput.parse({ learnerId: "l1", count: 99 })).toThrow();
  });
});

describe("ExplainWrongAnswerInput schema", () => {
  it("最低 learnerId + problemId + userAnswer が必須", () => {
    const parsed = ExplainWrongAnswerInput.parse({
      learnerId: "l1",
      problemId: "p1",
      userAnswer: "B",
    });
    expect(parsed.problemId).toBe("p1");
  });
});

describe("GenerateAdditionalProblemInput schema", () => {
  it("levelId が 5/4/3 以外を拒否する", () => {
    expect(() =>
      GenerateAdditionalProblemInput.parse({
        learnerId: "l1",
        skillId: "vocabulary",
        levelId: "2", // 範囲外
        weaknessTopic: "be動詞",
      }),
    ).toThrow();
  });
});

describe("UpdateStudyPlanInput schema", () => {
  it("reason が必須", () => {
    expect(() => UpdateStudyPlanInput.parse({ learnerId: "l1" })).toThrow();
  });
});
