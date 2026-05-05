/**
 * HANEI - learner_settings 入力バリデーション (W12-T1 / Phase 3 第 1 波)
 *
 * "use server" ファイル (learner-settings.ts) からは sync 関数 / 型を export できないため,
 * バリデーション系はこの非 "use server" ファイルに切り出す (Turbopack 制約 / DEC-064 / DEC-072).
 *
 * 三層認可 (DEC-003): バリデーションは入力検証層 (第二層 require* の前段).
 * 罰則ゼロ哲学 (DEC-024): エラーメッセージは丁寧な日本語で罰語ゼロ.
 */

import { z } from "zod";

/** HH:MM (24h, 00:00 - 23:59). 半角数字のみ. */
const TIME_HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const LearnerSettingsPatchSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  /** null = リマインド無効. 'HH:MM' = 有効. undefined = 変更しない (no-op). */
  dailyReminderTime: z
    .union([
      z.string().regex(TIME_HHMM_REGEX, "時刻は HH:MM 形式 (24 時間制) で入力してください"),
      z.null(),
    ])
    .optional(),
  soundEnabled: z.boolean().optional(),
  displayNameOverride: z
    .union([z.string().min(1).max(40), z.null()])
    .optional(),
});

export type LearnerSettingsPatch = z.infer<typeof LearnerSettingsPatchSchema>;

export interface NormalizedLearnerSettings {
  notificationsEnabled: boolean;
  dailyReminderTime: string | null;
  soundEnabled: boolean;
  displayNameOverride: string | null;
}

export const DEFAULT_LEARNER_SETTINGS: NormalizedLearnerSettings = {
  notificationsEnabled: true,
  dailyReminderTime: null,
  soundEnabled: true,
  displayNameOverride: null,
};

export const LearnerProfilePatchSchema = z.object({
  /** 表示名 (nickname). 1-20 文字. */
  nickname: z.string().min(1, "表示名を入力してください").max(20).optional(),
  /** 学年 (eiken target level). '5' / '4' / '3' のみ. */
  targetEikenLevel: z.union([z.literal("5"), z.literal("4"), z.literal("3")]).optional(),
});

export type LearnerProfilePatch = z.infer<typeof LearnerProfilePatchSchema>;
