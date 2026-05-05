/**
 * learner-study-target-validate.test.ts (W12-T4 / Phase 3 第 1 波 / DEC-078)
 *
 * 検証ポイント:
 *  1. dailyMinutesTarget - 0-180 分 range 境界 / 範囲外 reject
 *  2. dailyMinutesTarget - 整数のみ / 非整数 reject
 *  3. reminderTime - HH:MM 24h regex / 範囲外 reject
 *  4. reminderEnabled - boolean のみ
 *  5. 罰則ゼロ哲学 (DEC-024) - error message に罰語が含まれない
 *  6. DEFAULT_LEARNER_STUDY_TARGET - default 値の不変性 (15 / true / "19:00")
 */

import { describe, it, expect } from "vitest";

import {
  LearnerStudyTargetPatchSchema,
  DEFAULT_LEARNER_STUDY_TARGET,
} from "@/lib/study/learner-study-target-validate";

describe("LearnerStudyTargetPatchSchema", () => {
  describe("dailyMinutesTarget (0-180 分 range)", () => {
    it("0 分 (下限) は OK", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        dailyMinutesTarget: 0,
      });
      expect(r.success).toBe(true);
    });

    it("15 分 (default) は OK", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        dailyMinutesTarget: 15,
      });
      expect(r.success).toBe(true);
    });

    it("180 分 (上限) は OK", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        dailyMinutesTarget: 180,
      });
      expect(r.success).toBe(true);
    });

    it("-1 分 (下限超過) は reject", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        dailyMinutesTarget: -1,
      });
      expect(r.success).toBe(false);
    });

    it("181 分 (上限超過) は reject", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        dailyMinutesTarget: 181,
      });
      expect(r.success).toBe(false);
    });

    it("非整数 (15.5) は reject", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        dailyMinutesTarget: 15.5,
      });
      expect(r.success).toBe(false);
    });

    it("非数値 ('15') は reject", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        dailyMinutesTarget: "15",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("reminderTime (HH:MM 24h)", () => {
    it("'19:00' (default) は OK", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderTime: "19:00",
      });
      expect(r.success).toBe(true);
    });

    it("'00:00' (下限) は OK", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderTime: "00:00",
      });
      expect(r.success).toBe(true);
    });

    it("'23:59' (上限) は OK", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderTime: "23:59",
      });
      expect(r.success).toBe(true);
    });

    it("'24:00' (24 時超過) は reject", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderTime: "24:00",
      });
      expect(r.success).toBe(false);
    });

    it("'19:60' (分 60 超過) は reject", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderTime: "19:60",
      });
      expect(r.success).toBe(false);
    });

    it("'7:00' (時刻 1 桁 / 'HH' 形式違反) は reject", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderTime: "7:00",
      });
      expect(r.success).toBe(false);
    });

    it("'invalid' (非時刻文字列) は reject", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderTime: "invalid",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("reminderEnabled (boolean)", () => {
    it("true は OK", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderEnabled: true,
      });
      expect(r.success).toBe(true);
    });

    it("false は OK", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderEnabled: false,
      });
      expect(r.success).toBe(true);
    });

    it("'true' (文字列) は reject", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderEnabled: "true",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("罰則ゼロ哲学 (DEC-024) - error message", () => {
    it("dailyMinutesTarget 範囲外 error message に罰語が含まれない", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        dailyMinutesTarget: 200,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        const message = r.error.issues[0]?.message ?? "";
        expect(message).not.toMatch(/失敗|サボ|怠け|罰|ダメ|だめ|禁止/);
      }
    });

    it("reminderTime 不正 error message に罰語が含まれない", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        reminderTime: "invalid",
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        const message = r.error.issues[0]?.message ?? "";
        expect(message).not.toMatch(/失敗|サボ|怠け|罰|ダメ|だめ|禁止/);
      }
    });
  });

  describe("複合 patch", () => {
    it("3 フィールド全指定の正常系", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({
        dailyMinutesTarget: 30,
        reminderEnabled: false,
        reminderTime: "20:30",
      });
      expect(r.success).toBe(true);
    });

    it("全フィールド optional - 空オブジェクトでも OK (no-op)", () => {
      const r = LearnerStudyTargetPatchSchema.safeParse({});
      expect(r.success).toBe(true);
    });
  });
});

describe("DEFAULT_LEARNER_STUDY_TARGET", () => {
  it("default 値は 15 分 / true / '19:00' で固定", () => {
    expect(DEFAULT_LEARNER_STUDY_TARGET).toEqual({
      dailyMinutesTarget: 15,
      reminderEnabled: true,
      reminderTime: "19:00",
    });
  });
});
