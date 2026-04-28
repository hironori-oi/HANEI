/**
 * learner-preferences.test.ts (W8-T3 / W8-T4)
 *
 * normalizePreferences (純関数) のみをテストする。
 * server action 本体 (DB / requireAuth) は E2E でカバーする方針。
 */

import { describe, it, expect } from "vitest";
import { normalizePreferences } from "@/lib/actions/learner-preferences";

describe("normalizePreferences", () => {
  it("undefined / null は default (両方 true)", () => {
    expect(normalizePreferences(undefined)).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
    });
    expect(normalizePreferences(null)).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
    });
  });

  it("空オブジェクトは default", () => {
    expect(normalizePreferences({})).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
    });
  });

  it("soundEnabled=false が反映される", () => {
    expect(normalizePreferences({ soundEnabled: false })).toEqual({
      soundEnabled: false,
      confettiEnabled: true,
    });
  });

  it("confettiEnabled=false が反映される", () => {
    expect(normalizePreferences({ confettiEnabled: false })).toEqual({
      soundEnabled: true,
      confettiEnabled: false,
    });
  });

  it("不正な型 (string / number) は default に倒す", () => {
    expect(
      normalizePreferences({ soundEnabled: "yes" as unknown }),
    ).toEqual({ soundEnabled: true, confettiEnabled: true });
    expect(
      normalizePreferences({ confettiEnabled: 0 as unknown }),
    ).toEqual({ soundEnabled: true, confettiEnabled: true });
  });

  it("余計なキーは捨てる", () => {
    const result = normalizePreferences({
      soundEnabled: false,
      confettiEnabled: false,
      maliciousKey: "x",
    });
    expect(result).toEqual({ soundEnabled: false, confettiEnabled: false });
    expect(result).not.toHaveProperty("maliciousKey");
  });

  it("非オブジェクト (string / number / array) は default", () => {
    expect(normalizePreferences("foo")).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
    });
    expect(normalizePreferences(42)).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
    });
  });
});
