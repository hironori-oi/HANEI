/**
 * HANEI - OpenAI / AI SDK Client (W2 完成形)
 *
 * 主軸: gpt-5-mini (DEC-003)
 * フォールバック: gpt-4.1-mini
 *
 * AI SDK の streamText / generateText で利用。エラー時にフォールバックモデルへ。
 */

import {
  streamText,
  generateText,
  type LanguageModel,
  type CoreMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const apiKey = process.env.OPENAI_API_KEY;

export const openai = createOpenAI({
  apiKey: apiKey ?? "sk-placeholder-not-real",
  compatibility: "strict",
});

export const PRIMARY_MODEL = process.env.OPENAI_MODEL_PRIMARY ?? "gpt-5-mini";
export const FALLBACK_MODEL = process.env.OPENAI_MODEL_FALLBACK ?? "gpt-4.1-mini";

export function primaryModel(): LanguageModel {
  return openai(PRIMARY_MODEL);
}

export function fallbackModel(): LanguageModel {
  return openai(FALLBACK_MODEL);
}

export function hasApiKey(): boolean {
  return Boolean(
    apiKey && apiKey.startsWith("sk-") && apiKey !== "sk-placeholder-not-real",
  );
}

/**
 * streamText with provider fallback
 * - 主軸モデルで失敗したら fallback モデルへ
 * - キー未設定時は throw (caller で coach API がモック応答に切替)
 */
export async function streamWithFallback(args: {
  system: string;
  messages: CoreMessage[];
  tools?: Record<string, unknown>;
  maxTokens?: number;
}) {
  if (!hasApiKey()) {
    throw new Error("[ai/openai] OPENAI_API_KEY 未設定");
  }
  try {
    return streamText({
      model: primaryModel(),
      system: args.system,
      messages: args.messages,
      tools: args.tools as never,
      maxTokens: args.maxTokens ?? 600,
    });
  } catch (err) {
    console.warn("[ai/openai] primary failed, falling back:", err);
    return streamText({
      model: fallbackModel(),
      system: args.system,
      messages: args.messages,
      tools: args.tools as never,
      maxTokens: args.maxTokens ?? 600,
    });
  }
}

export async function generateWithFallback(args: {
  system: string;
  prompt: string;
  maxTokens?: number;
}) {
  if (!hasApiKey()) {
    throw new Error("[ai/openai] OPENAI_API_KEY 未設定");
  }
  try {
    return await generateText({
      model: primaryModel(),
      system: args.system,
      prompt: args.prompt,
      maxTokens: args.maxTokens ?? 600,
    });
  } catch (err) {
    console.warn("[ai/openai] primary failed, falling back:", err);
    return await generateText({
      model: fallbackModel(),
      system: args.system,
      prompt: args.prompt,
      maxTokens: args.maxTokens ?? 600,
    });
  }
}
