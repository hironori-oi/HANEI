/**
 * Create Learner Form Schema (G-6 ビルド修正)
 * 背景: `actions.ts` ("use server") に Zod スキーマを置けないため分離。
 */

import { z } from "zod";

export const CreateLearnerSchema = z.object({
  nickname: z.string().min(1).max(20),
  avatar_id: z.string().min(1),
  current_level: z.enum(["beginner", "eiken5", "eiken4"]),
  target_level: z.enum(["5", "4", "3"]),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
