/**
 * Signup Form Schema (G-6 ビルド修正)
 *
 * 背景: `actions.ts` は `"use server"` 指定のため Zod スキーマ等の非 async export を
 * 持てない (Next.js 16 / Turbopack で build error)。スキーマを本ファイルに分離し、
 * server action 側 + テスト側の双方から import 可能にする。
 */

import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  parent_name: z.string().min(1).max(100),
  consent_coppa: z.literal("on"),
  consent_ai_chat: z.literal("on"),
  consent_terms: z.literal("on"),
  /**
   * W12-T3-A (DEC-069): β 招待コード (任意 / `BETA_INVITE_REQUIRED === "true"` のときに
   * 実行時必須化される). normalize / 形式検証 / DB 検証は signup action 内で行う.
   * Schema レベルでは「任意」で受け取り、必須判定は invite ゲート (実行時 env flag) に委ねる.
   */
  invite_code: z.string().optional(),
});

export type SignupActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
