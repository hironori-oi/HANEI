/**
 * HANEI - learner_study_targets 入力バリデーション (W12-T4 / Phase 3 第 1 波 / DEC-078)
 *
 * "use server" ファイル (learner-study-target.ts) からは sync 関数 / 型を export できないため,
 * バリデーション系はこの非 "use server" ファイルに切り出す (Turbopack 制約 / DEC-064 / DEC-072).
 *
 * 三層認可 (DEC-003): バリデーションは入力検証層 (第二層 require* の前段).
 * 罰則ゼロ哲学 (DEC-024): エラーメッセージは丁寧な日本語で罰語ゼロ.
 */

import { z } from "zod";

/** HH:MM (24h, 00:00 - 23:59). 半角数字のみ. */
const TIME_HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const LearnerStudyTargetPatchSchema = z.object({
  /** 0-180 分の整数 / 0 = 目標を設定しない (リマインドは reminder_enabled で別制御). */
  dailyMinutesTarget: z
    .number()
    .int("分数は整数で入力してください")
    .min(0, "分数は 0 分以上で入力してください")
    .max(180, "分数は 180 分以下で入力してください")
    .optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: z
    .string()
    .regex(
      TIME_HHMM_REGEX,
      "時刻は HH:MM 形式 (24 時間制) で入力してください",
    )
    .optional(),
});

export type LearnerStudyTargetPatch = z.infer<
  typeof LearnerStudyTargetPatchSchema
>;

export interface NormalizedLearnerStudyTarget {
  dailyMinutesTarget: number;
  reminderEnabled: boolean;
  reminderTime: string;
}

export const DEFAULT_LEARNER_STUDY_TARGET: NormalizedLearnerStudyTarget = {
  dailyMinutesTarget: 15,
  reminderEnabled: true,
  reminderTime: "19:00",
};
