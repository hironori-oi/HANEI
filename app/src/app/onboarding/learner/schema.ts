/**
 * Create Learner Form Schema (G-6 ビルド修正 / W8-T5 daily_goal_xp 追加)
 * 背景: `actions.ts` ("use server") に Zod スキーマを置けないため分離。
 */

import { z } from "zod";

export const CreateLearnerSchema = z.object({
  nickname: z.string().min(1).max(20),
  avatar_id: z.string().min(1),
  current_level: z.enum(["beginner", "eiken5", "eiken4"]),
  target_level: z.enum(["5", "4", "3"]),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /**
   * 自己選択日次ゴール XP (W8-T5)
   * - 4 段階: 10 / 20 / 30 / 50
   * - default 20 (ふつう)
   */
  daily_goal_xp: z
    .union([z.literal("10"), z.literal("20"), z.literal("30"), z.literal("50")])
    .optional()
    .transform((v) => (v ? Number(v) : 20)),
});
