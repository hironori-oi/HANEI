/**
 * learner-switch.test.ts (W4 / T-7)
 *
 * 検証ポイント:
 *  1. learners=[] なら active=null / fellBack=false
 *  2. ?learner= 未指定なら先頭学習者が active / fellBack=false
 *  3. ?learner=<id> が learners に含まれる場合、その学習者が active
 *  4. ?learner=<不正な id> はフォールバック (先頭) + fellBack=true
 *  5. rawQuery が string[] (複数) の場合は先頭の値で判定
 */

import { describe, it, expect } from "vitest";

import { resolveActiveLearner } from "@/lib/study/learner-switch";

const learnersAB = [
  { id: "lr_a", nickname: "あお" },
  { id: "lr_b", nickname: "そら" },
];

describe("resolveActiveLearner()", () => {
  it("learners=[] では active=null", () => {
    const r = resolveActiveLearner({ learners: [], rawQuery: undefined });
    expect(r.active).toBeNull();
    expect(r.fellBack).toBe(false);
  });

  it("rawQuery 未指定なら先頭学習者", () => {
    const r = resolveActiveLearner({
      learners: learnersAB,
      rawQuery: undefined,
    });
    expect(r.active?.id).toBe("lr_a");
    expect(r.fellBack).toBe(false);
  });

  it("rawQuery が learners に含まれる id ならそれを active", () => {
    const r = resolveActiveLearner({
      learners: learnersAB,
      rawQuery: "lr_b",
    });
    expect(r.active?.id).toBe("lr_b");
    expect(r.fellBack).toBe(false);
  });

  it("rawQuery が含まれない id なら先頭にフォールバック + fellBack=true", () => {
    const r = resolveActiveLearner({
      learners: learnersAB,
      rawQuery: "lr_unknown",
    });
    expect(r.active?.id).toBe("lr_a");
    expect(r.fellBack).toBe(true);
  });

  it("rawQuery が string[] でも先頭値で判定 (Next の searchParams 仕様対応)", () => {
    const r = resolveActiveLearner({
      learners: learnersAB,
      rawQuery: ["lr_b", "lr_a"],
    });
    expect(r.active?.id).toBe("lr_b");
    expect(r.fellBack).toBe(false);
  });

  it("学習者 1 名のみのケースでも default は最初の (唯一の) 学習者", () => {
    const r = resolveActiveLearner({
      learners: [{ id: "lr_solo", nickname: "ひとり" }],
      rawQuery: undefined,
    });
    expect(r.active?.id).toBe("lr_solo");
    expect(r.fellBack).toBe(false);
  });
});
