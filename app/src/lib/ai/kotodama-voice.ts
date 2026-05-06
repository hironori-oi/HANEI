/**
 * HANEI - DEC-089 Plan C (項目 4): kotodama-tori TTS 音声会話
 *
 * 冒険マップ等の演出で kotodama-tori が短尺台詞を喋るための TTS pre-generate ヘルパ。
 * 既存 `lib/tts/openai-tts.ts` の OpenAI tts-1 + R2 cache パターンを流用する。
 *
 * 依存追加なし: 既存 `openai` SDK + 既存 R2 client (DEC-061 既存パターン).
 *
 * 設計方針 (罰則ゼロ哲学 / DEC-024):
 *  - 8〜12 種の短尺日本語台詞 (0.6〜2.0s 想定) を pre-generate
 *  - 台詞は「やったね！」「もう一度ためしてみよう」「次のエリアに行こう！」「いっしょに がんばろう！」等の
 *    中立 / 励まし系で叱責語ゼロ
 *  - R2 cache hit で副作用ゼロ (idempotent / DEC-055)
 *  - cost guard: 既存 `monthly-budget-alert` cron (DEC-081) で監視継続 / pre-generate 1 回 ¥10 以内
 *
 * 制約:
 *  - 本ヘルパは pre-generate 中心 (R2 cache hit が常態 = cost ¥0).
 *  - リアルタイム動的生成は Plan D (重投資 / DEC-090 候補) で実装.
 *  - 学習者の `audio_enabled` setting / `prefers-reduced-motion: reduce` への配慮は呼出側 client component で行う.
 */

import {
  putObject,
  objectExists,
  publicUrlFor,
} from "@/lib/storage/r2";
import { hasApiKey } from "@/lib/ai/openai";
import { DEFAULT_TTS_VOICE, DEFAULT_TTS_MODEL, type TtsVoice } from "@/lib/tts/openai-tts";

/**
 * kotodama-tori 短尺台詞コード.
 *
 * 罰則ゼロ哲学 (DEC-024):
 *  - 「失敗」「サボった」「だめ」「悲しい」等のネガ語は不採用
 *  - 不正解 / 未着手にも「もう一度ためそう」「いっしょに考えよう」中立トーン
 */
export type KotodamaVoiceCode =
  | "greeting"        // 「やあ、ぼく ことだまトリだよ。」
  | "praise_correct"  // 「やったね！」
  | "praise_streak"   // 「すごいよ！ いいちょうしだね。」
  | "encourage_retry" // 「もう一度 ためしてみよう。」
  | "encourage_thinking" // 「いっしょに かんがえよう。」
  | "next_area"       // 「次のエリアに 行こう！」
  | "level_up"        // 「ぼくが ちょっと おおきく なったよ。」
  | "lets_go"         // 「いっしょに がんばろう！」
  | "well_done"       // 「ここまで よく がんばったね。」
  | "see_you";        // 「あした また あおうね。」

interface VoiceSpec {
  /** TTS に投げる日本語台詞 */
  text: string;
  /** 短い説明 (alt text 併記用) */
  alt: string;
}

/**
 * 罰則ゼロ哲学 (DEC-024) を厳守した中立 / 励まし系の短尺台詞集。
 *
 * 「悲しみ」「怒り」「叱責」「失敗」「だめ」等のネガティブ語を一切含まないことを目視確認済み。
 */
export const KOTODAMA_VOICE_SCRIPTS: Readonly<Record<KotodamaVoiceCode, VoiceSpec>> = Object.freeze({
  greeting: {
    text: "やあ、ぼく ことだまトリだよ。いっしょに ぼうけんしよう。",
    alt: "ことだまトリのあいさつ",
  },
  praise_correct: {
    text: "やったね！",
    alt: "正解の声がけ",
  },
  praise_streak: {
    text: "すごいよ。いい ちょうしだね。",
    alt: "連続正解の声がけ",
  },
  encourage_retry: {
    text: "もう一度 ためしてみよう。",
    alt: "再挑戦の声がけ",
  },
  encourage_thinking: {
    text: "いっしょに かんがえよう。",
    alt: "考え中の声がけ",
  },
  next_area: {
    text: "つぎの エリアに いこう！",
    alt: "次エリアへの声がけ",
  },
  level_up: {
    text: "ぼくが ちょっと おおきく なったよ。",
    alt: "進化の声がけ",
  },
  lets_go: {
    text: "いっしょに がんばろう！",
    alt: "学習開始の声がけ",
  },
  well_done: {
    text: "ここまで よく がんばったね。",
    alt: "労いの声がけ",
  },
  see_you: {
    text: "あした また あおうね。",
    alt: "別れの声がけ",
  },
});

export const ALL_KOTODAMA_VOICE_CODES: ReadonlyArray<KotodamaVoiceCode> = Object.freeze(
  Object.keys(KOTODAMA_VOICE_SCRIPTS) as KotodamaVoiceCode[],
);

/**
 * R2 cache キー命名規則.
 *
 * - 既存 TTS ヘルパ (`tts/{level}/{skill}/{problem_id}_{voice_id}.mp3`) と被らないように
 *   独立 prefix `kotodama-voice/` を採用.
 * - voice (デフォルト nova) を suffix に含めることで将来 voice 切替に耐える.
 */
export function kotodamaVoiceCacheKey(
  code: KotodamaVoiceCode,
  voice: TtsVoice = DEFAULT_TTS_VOICE,
): string {
  return `kotodama-voice/${code}_${voice}.mp3`;
}

export interface KotodamaVoiceManifestEntry {
  code: KotodamaVoiceCode;
  /** 公開 URL (R2_PUBLIC_URL 未設定なら "" / 呼出側で fallback 可能) */
  publicUrl: string;
  /** R2 オブジェクトキー */
  key: string;
  /** alt text (UI で alt / aria-label に使用) */
  alt: string;
  /** 台詞テキスト (字幕表示用 / WCAG 補助) */
  text: string;
  /** R2 cache に存在するか (true = 再生可能) */
  cached: boolean;
}

export type KotodamaVoiceManifest = ReadonlyArray<KotodamaVoiceManifestEntry>;

/**
 * 全 kotodama-voice 台詞の manifest を返す.
 *
 * 呼出方針:
 *  - GET `/api/study/adventure-map` から呼出 / 各 entry の publicUrl を frontend に渡す.
 *  - **生成は行わない** = R2 cache hit 確認のみ (副作用ゼロ / cost ¥0).
 *  - 未生成 entry は `cached: false` で返り、frontend は字幕テキストのみ表示するフォールバック.
 *
 * 認可: 呼出前提で learner role 認可を済ませること (本ヘルパは learner 個別情報を含まない).
 */
export async function getKotodamaVoiceManifest(
  voice: TtsVoice = DEFAULT_TTS_VOICE,
): Promise<KotodamaVoiceManifest> {
  const codes = ALL_KOTODAMA_VOICE_CODES;
  const entries = await Promise.all(
    codes.map(async (code) => {
      const key = kotodamaVoiceCacheKey(code, voice);
      const cached = await objectExists(key).catch(() => false);
      const spec = KOTODAMA_VOICE_SCRIPTS[code];
      return {
        code,
        key,
        publicUrl: cached ? publicUrlFor(key) : "",
        alt: spec.alt,
        text: spec.text,
        cached,
      } satisfies KotodamaVoiceManifestEntry;
    }),
  );
  return entries;
}

/**
 * OpenAI tts-1 で台詞 1 種を生成し R2 にキャッシュする.
 *
 * - 既に R2 にあれば再生成せず cached=true で返す (idempotent / DEC-055).
 * - OPENAI_API_KEY 未設定 / R2 未設定の環境ではエラーを throw する (CI / 本番運用想定).
 *
 * 用途:
 *  - 別途 `scripts/generate-kotodama-voices.ts` (将来) からバッチ実行.
 *  - 本実装 atomic の範囲ではビルド時 / オーナー手動 1 回実行で R2 に置く想定.
 */
export interface PreGenerateResult {
  code: KotodamaVoiceCode;
  key: string;
  publicUrl: string;
  cached: boolean;
}

async function generateMp3(text: string, voice: TtsVoice): Promise<Buffer> {
  if (!hasApiKey()) {
    throw new Error("[ai/kotodama-voice] OPENAI_API_KEY 未設定");
  }
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
    throw new Error(
      `[ai/kotodama-voice] OpenAI TTS failed: ${res.status} ${errText}`,
    );
  }
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

export async function preGenerateKotodamaVoice(
  code: KotodamaVoiceCode,
  voice: TtsVoice = DEFAULT_TTS_VOICE,
): Promise<PreGenerateResult> {
  const key = kotodamaVoiceCacheKey(code, voice);
  const exists = await objectExists(key).catch(() => false);
  if (exists) {
    return {
      code,
      key,
      publicUrl: publicUrlFor(key),
      cached: true,
    };
  }
  const spec = KOTODAMA_VOICE_SCRIPTS[code];
  const mp3 = await generateMp3(spec.text, voice);
  const { publicUrl } = await putObject(key, mp3, "audio/mpeg");
  return {
    code,
    key,
    publicUrl,
    cached: false,
  };
}

/**
 * 全 kotodama-voice 台詞をバッチ pre-generate する.
 *
 * cost guard 注記 (DEC-081):
 *  - tts-1 は 1K 文字あたり $0.015 / 全 10 種 × 平均 30 文字 = ~300 文字 → 約 $0.0045 ≒ ¥0.7
 *    1 回の実行で **¥10 以内** で完結 (本 atomic の cost 上限制約と整合).
 *  - R2 cache hit が 1 件でもあれば該当だけスキップされ、追加 cost = 0.
 */
export async function preGenerateAllKotodamaVoices(
  voice: TtsVoice = DEFAULT_TTS_VOICE,
): Promise<ReadonlyArray<PreGenerateResult>> {
  const results: PreGenerateResult[] = [];
  for (const code of ALL_KOTODAMA_VOICE_CODES) {
    // 直列実行: OpenAI rate limit と cost 上限を厳守 (R2 cache hit は即終了)
    const r = await preGenerateKotodamaVoice(code, voice);
    results.push(r);
  }
  return results;
}
