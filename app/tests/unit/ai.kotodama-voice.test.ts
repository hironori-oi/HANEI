/**
 * ai.kotodama-voice.test.ts (DEC-089 Plan C 項目 4 / W12)
 *
 * kotodama-tori TTS pre-generate ヘルパの単体テスト.
 *
 * 検証ポイント:
 *  1. 全 KotodamaVoiceCode (10 種) が対応する VoiceSpec を持つ
 *  2. kotodamaVoiceCacheKey が `kotodama-voice/{code}_{voice}.mp3` 形式
 *  3. getKotodamaVoiceManifest は副作用ゼロ (R2 putObject を呼ばない / read-only)
 *  4. R2 cache miss は cached:false / publicUrl:"" / cache hit は cached:true / publicUrl が R2 URL
 *  5. 罰則ゼロ哲学 (DEC-024): 全台詞に「失敗」「だめ」「悲しい」「サボった」等のネガ語が含まれない
 *  6. 全台詞が 50 文字以内 (短尺 / 0.6〜2.0s 想定)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/storage/r2", () => ({
  putObject: vi.fn(),
  objectExists: vi.fn(),
  publicUrlFor: vi.fn((key: string) => `https://r2.example.com/${key}`),
}));

import {
  KOTODAMA_VOICE_SCRIPTS,
  ALL_KOTODAMA_VOICE_CODES,
  kotodamaVoiceCacheKey,
  getKotodamaVoiceManifest,
} from "@/lib/ai/kotodama-voice";
import {
  putObject,
  objectExists,
} from "@/lib/storage/r2";

const NEG_WORDS = [
  "失敗",
  "しっぱい",
  "だめ",
  "ダメ",
  "悲しい",
  "かなしい",
  "サボった",
  "さぼった",
  "怒り",
  "おこ",
  "残念",
  "ざんねん",
  "つらい",
  "辛い",
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("KOTODAMA_VOICE_SCRIPTS (DEC-089 Plan C 項目 4 / 罰則ゼロ)", () => {
  it("全 10 種の VoiceCode が定義されている", () => {
    expect(ALL_KOTODAMA_VOICE_CODES).toHaveLength(10);
    for (const code of ALL_KOTODAMA_VOICE_CODES) {
      expect(KOTODAMA_VOICE_SCRIPTS[code]).toBeDefined();
      expect(KOTODAMA_VOICE_SCRIPTS[code].text.length).toBeGreaterThan(0);
      expect(KOTODAMA_VOICE_SCRIPTS[code].alt.length).toBeGreaterThan(0);
    }
  });

  it("罰則ゼロ哲学: ネガティブ語 (失敗 / だめ / 悲しい / 残念 等) を含まない", () => {
    for (const code of ALL_KOTODAMA_VOICE_CODES) {
      const { text, alt } = KOTODAMA_VOICE_SCRIPTS[code];
      const combined = `${text} ${alt}`;
      for (const neg of NEG_WORDS) {
        expect(
          combined.includes(neg),
          `${code} 台詞「${text}」に NG 語「${neg}」が含まれる`,
        ).toBe(false);
      }
    }
  });

  it("全台詞は短尺 (50 文字以内 / 0.6〜2.0s 想定)", () => {
    for (const code of ALL_KOTODAMA_VOICE_CODES) {
      const t = KOTODAMA_VOICE_SCRIPTS[code].text;
      expect(t.length).toBeLessThanOrEqual(50);
    }
  });
});

describe("kotodamaVoiceCacheKey()", () => {
  it("既定 voice (nova) で kotodama-voice/{code}_nova.mp3 形式を返す", () => {
    expect(kotodamaVoiceCacheKey("greeting")).toBe(
      "kotodama-voice/greeting_nova.mp3",
    );
    expect(kotodamaVoiceCacheKey("praise_correct")).toBe(
      "kotodama-voice/praise_correct_nova.mp3",
    );
  });

  it("voice 指定時はキーに反映される", () => {
    expect(kotodamaVoiceCacheKey("see_you", "shimmer")).toBe(
      "kotodama-voice/see_you_shimmer.mp3",
    );
  });

  it("既存 TTS prefix (tts/) と衝突しない (kotodama-voice/ 独立 prefix)", () => {
    for (const code of ALL_KOTODAMA_VOICE_CODES) {
      const key = kotodamaVoiceCacheKey(code);
      expect(key.startsWith("kotodama-voice/")).toBe(true);
      expect(key.startsWith("tts/")).toBe(false);
    }
  });
});

describe("getKotodamaVoiceManifest() (副作用ゼロ / read-only)", () => {
  it("putObject は呼ばない (read-only / cost ¥0)", async () => {
    (objectExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await getKotodamaVoiceManifest();
    expect(putObject).not.toHaveBeenCalled();
  });

  it("全 10 entry を返す (cache miss でも entry は返る / cached=false)", async () => {
    (objectExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const manifest = await getKotodamaVoiceManifest();
    expect(manifest).toHaveLength(10);
    for (const entry of manifest) {
      expect(entry.cached).toBe(false);
      expect(entry.publicUrl).toBe("");
      expect(entry.text.length).toBeGreaterThan(0);
      expect(entry.alt.length).toBeGreaterThan(0);
      expect(entry.key.startsWith("kotodama-voice/")).toBe(true);
    }
  });

  it("cache hit 時は cached=true / publicUrl が R2 URL を返す", async () => {
    (objectExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const manifest = await getKotodamaVoiceManifest();
    for (const entry of manifest) {
      expect(entry.cached).toBe(true);
      expect(entry.publicUrl).toBe(`https://r2.example.com/${entry.key}`);
    }
  });

  it("objectExists が throw しても catch して cached=false で返る (耐障害)", async () => {
    (objectExists as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("R2 down"),
    );
    const manifest = await getKotodamaVoiceManifest();
    expect(manifest).toHaveLength(10);
    for (const entry of manifest) {
      expect(entry.cached).toBe(false);
    }
  });
});
