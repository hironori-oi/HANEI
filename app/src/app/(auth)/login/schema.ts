/**
 * Login Form Schema (G-6 ビルド修正)
 * 背景: `actions.ts` ("use server") に Zod スキーマを置けないため分離。
 */

import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.string().optional(),
  redirect_to: z.string().optional(),
});
