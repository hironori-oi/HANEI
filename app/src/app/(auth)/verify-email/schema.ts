/**
 * Verify Email Form Schema (G-6 ビルド修正)
 * 背景: `actions.ts` ("use server") に Zod スキーマを置けないため分離。
 */

import { z } from "zod";

export const VerifyEmailSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});
