/**
 * learner-preferences.test.ts (W8-T3 / W8-T4 / W10-T5)
 *
 * normalizePreferences (純関数) のみをテストする。
 * server action 本体 (DB / requireAuth) は E2E でカバーする方針。
 *
 * W10-T5 拡張: preferredSessionMinutes (5/7/10/null) を含む正規化
 */

import { describe, it, expect } from "vitest";
// W10-T5 補正: "use server" ファイル (src/lib/actions/learner-preferences.ts) からは
// sync 関数を export できない (Turbopack 制約) ため、純関数 normalizePreferences は
// @/lib/study/learner-preferences-normalize に切り出している。
import { normalizePreferences } from "@/lib/study/learner-preferences-normalize";

describe("normalizePreferences", () => {
  it("undefined / null は default (両方 true / preferredSessionMinutes=null)", () => {
    expect(normalizePreferences(undefined)).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
      preferredSessionMinutes: null,
    });
    expect(normalizePreferences(null)).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
      preferredSessionMinutes: null,
    });
  });

  it("空オブジェクトは default", () => {
    expect(normalizePreferences({})).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
      preferredSessionMinutes: null,
    });
  });

  it("soundEnabled=false が反映される", () => {
    expect(normalizePreferences({ soundEnabled: false })).toEqual({
      soundEnabled: false,
      confettiEnabled: true,
      preferredSessionMinutes: null,
    });
  });

  it("confettiEnabled=false が反映される", () => {
    expect(normalizePreferences({ confettiEnabled: false })).toEqual({
      soundEnabled: true,
      confettiEnabled: false,
      preferredSessionMinutes: null,
    });
  });

  it("不正な型 (string / number) は default に倒す", () => {
    expect(
      normalizePreferences({ soundEnabled: "yes" as unknown }),
    ).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
      preferredSessionMinutes: null,
    });
    expect(
      normalizePreferences({ confettiEnabled: 0 as unknown }),
    ).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
      preferredSessionMinutes: null,
    });
  });

  it("余計なキーは捨てる", () => {
    const result = normalizePreferences({
      soundEnabled: false,
      confettiEnabled: false,
      maliciousKey: "x",
    });
    expect(result).toEqual({
      soundEnabled: false,
      confettiEnabled: false,
      preferredSessionMinutes: null,
    });
    expect(result).not.toHaveProperty("maliciousKey");
  });

  it("非オブジェクト (string / number / array) は default", () => {
    expect(normalizePreferences("foo")).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
      preferredSessionMinutes: null,
    });
    expect(normalizePreferences(42)).toEqual({
      soundEnabled: true,
      confettiEnabled: true,
      preferredSessionMinutes: null,
    });
  });

  // ---------------------------------------------------------------------------
  // W10-T5: preferredSessionMinutes
  // ---------------------------------------------------------------------------
  describe("preferredSessionMinutes (W10-T5)", () => {
    it("5 / 7 / 10 はそのまま反映される", () => {
      expect(
        normalizePreferences({ preferredSessionMinutes: 5 }),
      ).toMatchObject({ preferredSessionMinutes: 5 });
      expect(
        normalizePreferences({ preferredSessionMinutes: 7 }),
      ).toMatchObject({ preferredSessionMinutes: 7 });
      expect(
        normalizePreferences({ preferredSessionMinutes: 10 }),
      ).toMatchObject({ preferredSessionMinutes: 10 });
    });

    it("不正な数値 (3 / 6 / 8 / 15 等) は null", () => {
      expect(
        normalizePreferences({ preferredSessionMinutes: 3 }),
      ).toMatchObject({ preferredSessionMinutes: null });
      expect(
        normalizePreferences({ preferredSessionMinutes: 6 }),
      ).toMatchObject({ preferredSessionMinutes: null });
      expect(
        normalizePreferences({ preferredSessionMinutes: 8 }),
      ).toMatchObject({ preferredSessionMinutes: null });
      expect(
        normalizePreferences({ preferredSessionMinutes: 15 }),
      ).toMatchObject({ preferredSessionMinutes: null });
    });

    it("文字列 / null / undefined / object は null", () => {
      expect(
        normalizePreferences({
          preferredSessionMinutes: "5" as unknown,
        }),
      ).toMatchObject({ preferredSessionMinutes: null });
      expect(
        normalizePreferences({ preferredSessionMinutes: null }),
      ).toMatchObject({ preferredSessionMinutes: null });
      expect(
        normalizePreferences({ preferredSessionMinutes: undefined }),
      ).toMatchObject({ preferredSessionMinutes: null });
      expect(
        normalizePreferences({
          preferredSessionMinutes: {} as unknown,
        }),
      ).toMatchObject({ preferredSessionMinutes: null });
    });

    it("preferredSessionMinutes と既存 boolean フィールドは独立", () => {
      const r = normalizePreferences({
        soundEnabled: false,
        confettiEnabled: false,
        preferredSessionMinutes: 7,
      });
      expect(r).toEqual({
        soundEnabled: false,
        confettiEnabled: false,
        preferredSessionMinutes: 7,
      });
    });
  });
});
