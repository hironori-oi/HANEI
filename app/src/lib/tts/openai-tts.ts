/**
 * HANEI - OpenAI TTS Helper (W2 完成形 / T-6 残)
 *
 * 用途:
 *  - リスニング問題用の英文読み上げ mp3 を OpenAI tts-1 で生成
 *  - Cloudflare R2 に `tts/{level}/{skill}/{problem_id}_{voice_id}.mp3` でキャッシュ保存
 *  - 既存があれば再利用 (HEAD で存在確認 / 無ければ POST → R2 put → public URL)
 *
 * デフォルト voice: "nova" (女性 / クリア)
 * 利用可能 voice: "alloy" / "echo" / "fable" / "onyx" / "nova" / "shimmer"
 *
 * NOTE:
 *  - 課金関連コードは含めない (DEC-012 / 無料アプリ)
 *  - 大量バルク生成は Cron (W3 以降) から呼ぶ。Phase 1 では「問題生成パイプラインの後段」に位置付け
 */

import { openai, hasApiKey } from "@/lib/ai/openai";
import {
  putObject,
  objectExists,
  publicUrlFor,
  ttsCacheKey,
} from "@/lib/storage/r2";

export const TTS_VOICES = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
] as const;
export type TtsVoice = (typeof TTS_VOICES)[number];

export const DEFAULT_TTS_VOICE: TtsVoice = "nova";
export const DEFAULT_TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "tts-1";

export interface SynthesizeArgs {
  text: string;
  level: "5" | "4" | "3";
  skill: string;
  problemId: string;
  voice?: TtsVoice;
}

export interface SynthesizeResult {
  key: string;
  publicUrl: string;
  cached: boolean;
}

/**
 * OpenAI tts-1 で英文 -> mp3 (Buffer) を生成。
 * 内部利用 (キャッシュは synthesizeAndCache 側で扱う)。
 */
async function generateMp3(text: string, voice: TtsVoice): Promise<Buffer> {
  if (!hasApiKey()) {
    throw new Error("[tts/openai-tts] OPENAI_API_KEY 未設定");
  }
  // AI SDK の createOpenAI クライアントから raw OpenAI 互換を呼ぶ。
  // @ai-sdk/openai は audio.speech を直接公開していないため fetch で叩く。
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_TTS_MODEL,
      voice,
      input: text,
      format: "mp3",
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`[tts/openai-tts] OpenAI TTS failed: ${res.status} ${errText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
  // openai client の参照を保つだけ (将来 SDK 統合のための未使用警告抑止)
  void openai;
}

/**
 * 英文 -> R2 キャッシュ ヒット確認 -> 無ければ生成 -> R2 put -> public URL を返す。
 */
export async function synthesizeAndCache(
  args: SynthesizeArgs,
): Promise<SynthesizeResult> {
  const voice = args.voice ?? DEFAULT_TTS_VOICE;
  const key = ttsCacheKey({
    level: args.level,
    skill: args.skill,
    problemId: args.problemId,
    voiceId: voice,
  });

  // 1. キャッシュ ヒット?
  const exists = await objectExists(key).catch(() => false);
  if (exists) {
    return {
      key,
      publicUrl: publicUrlFor(key),
      cached: true,
    };
  }

  // 2. 生成 -> R2 put
  const mp3 = await generateMp3(args.text, voice);
  const { publicUrl } = await putObject(key, mp3, "audio/mpeg");

  return {
    key,
    publicUrl,
    cached: false,
  };
}

/**
 * 単発生成 (キャッシュを使わない / テスト or Cron での 強制再生成 用)
 */
export async function synthesizeForce(
  args: SynthesizeArgs,
): Promise<SynthesizeResult> {
  const voice = args.voice ?? DEFAULT_TTS_VOICE;
  const key = ttsCacheKey({
    level: args.level,
    skill: args.skill,
    problemId: args.problemId,
    voiceId: voice,
  });
  const mp3 = await generateMp3(args.text, voice);
  const { publicUrl } = await putObject(key, mp3, "audio/mpeg");
  return { key, publicUrl, cached: false };
}
