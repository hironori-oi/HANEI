/**
 * scripts/generate-tts-listening-3.ts (W12-T5 / DEC-079)
 *
 * 用途: β 開始用 3 級 listening 20 問 (L3-001 〜 L3-020) の audio_transcript を
 *       OpenAI tts-1 で読み上げ、R2 にアップロードする。
 *
 * 仕様 (DEC-079):
 *  - voice: nova のみ 1 本 (β 期は voice 1 本化 / β + 1 ヶ月評価で多 voice 拡張判断)
 *  - キャッシュキー: tts/v1/{problemId}-{voice}.mp3 (既存 generate-tts-w3.ts と同名前空間)
 *  - 既に R2 に存在すれば skip (objectExists)
 *  - DEC-029: R2 smoke check (pingR2) を OpenAI 課金前に実行
 *  - DEC-055: 冪等 (objectExists skip / 同一 key への再 PUT は安全)
 *
 * コスト試算:
 *   20 問 × 1 voice × 平均 ~70 字 = 1,400 字
 *   OpenAI tts-1 = $15.00 / 1M chars (2026-04 公開料金)
 *   => 1,400 / 1,000,000 × $15.00 = $0.021 ≒ ¥3.15 (USD/JPY=150)
 *
 * 重要:
 *   ※ 実 OpenAI API 課金 + R2 PutObject が発生するため Agent 環境では絶対に実行しない。
 *      実装のみで完了とし、オーナーが後でローカルから
 *      `npm run ai:generate-tts-listening-3` で実行。
 *
 * 実行: `npm run ai:generate-tts-listening-3`
 *   オプション (環境変数):
 *     - DRY_RUN=true / DRY_RUN=1 : OpenAI / R2 を呼ばずに件数試算のみ
 *     - MAX_PROBLEMS=10
 */

import { hasApiKey } from "../src/lib/ai/openai";
import { putObject, objectExists, pingR2 } from "../src/lib/storage/r2";
import { loadAllSeedIds } from "./seed-id-mapper";

// ---------------------------------------------------------------------------
// 対象抽出: eiken-3 / listening のみ
// ---------------------------------------------------------------------------
async function loadEiken3Listening(): Promise<
  Array<{ id: string; transcript: string }>
> {
  const all = await loadAllSeedIds();
  return all.choiceProblems
    .filter((p) => p.level === "eiken-3" && p.skill === "listening")
    .map((p) => ({
      id: p.id,
      transcript: p.audio_transcript ?? "",
    }))
    .filter((p) => p.transcript.length > 0);
}

const VOICES = ["nova"] as const;
type Voice = (typeof VOICES)[number];

const TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "tts-1";

function cacheKey(problemId: string, voice: Voice): string {
  return `tts/v1/${problemId}-${voice}.mp3`;
}

async function generate(text: string, voice: Voice): Promise<Buffer> {
  if (!hasApiKey()) {
    throw new Error("[generate-tts-listening-3] OPENAI_API_KEY 未設定");
  }
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice,
      input: text,
      format: "mp3",
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `[generate-tts-listening-3] tts failed: ${res.status} ${errText}`,
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// CLI エントリ
// ---------------------------------------------------------------------------
async function main() {
  const dryRun =
    process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";
  const maxN = process.env.MAX_PROBLEMS
    ? Number(process.env.MAX_PROBLEMS)
    : Number.POSITIVE_INFINITY;

  const items = (await loadEiken3Listening()).slice(0, maxN);
  console.log(
    `[generate-tts-listening-3] target=${items.length} voices=${VOICES.length} dryRun=${dryRun}`,
  );

  // 早期 fail: dryRun 以外で API key 不在なら即終了
  if (!dryRun && !hasApiKey()) {
    console.error(
      "[generate-tts-listening-3] OPENAI_API_KEY が未設定です。.env.local に OPENAI_API_KEY=sk-... を設定してください。",
    );
    console.error(
      "[generate-tts-listening-3] (試走したい場合は DRY_RUN=true を付けて実行してください)",
    );
    process.exit(1);
  }

  // DEC-029: R2 smoke check
  //   既知バグ: split 命名 (R2_AUDIO_BUCKET / R2_S3_ENDPOINT) と single 命名
  //   (R2_BUCKET_NAME) のミスマッチで 401 を引いた前科あり。
  //   OpenAI を 20 回叩いた後に R2 PUT で全失敗するのを防ぐため、
  //   ループ前に HeadBucket で 1 回だけ認可チェックする。
  if (!dryRun) {
    try {
      const ping = await pingR2();
      console.log(`[generate-tts-listening-3] R2 ok bucket=${ping.bucket}`);
    } catch (err) {
      console.error(
        "[generate-tts-listening-3] R2 smoke check failed. OpenAI 課金前に中断します。",
      );
      console.error(err);
      process.exit(1);
    }
  }

  let generated = 0;
  let skipped = 0;
  let charCount = 0;

  for (const item of items) {
    const text = item.transcript;
    charCount += text.length * VOICES.length;

    for (const voice of VOICES) {
      const key = cacheKey(item.id, voice);
      if (dryRun) {
        console.log(`[dry-run] would generate ${key} (${text.length} chars)`);
        continue;
      }

      // skip if exists (DEC-055 冪等)
      const exists = await objectExists(key).catch(() => false);
      if (exists) {
        skipped += 1;
        continue;
      }
      try {
        const mp3 = await generate(text, voice);
        await putObject(key, mp3, "audio/mpeg");
        generated += 1;
        console.log(`[generate-tts-listening-3] ok ${key}`);
      } catch (err) {
        console.error(`[generate-tts-listening-3] failed for ${key}:`, err);
      }
    }
  }

  // コスト試算 (USD 15 / 1M chars, USD/JPY = 150)
  const usd = (charCount / 1_000_000) * 15;
  const jpy = usd * Number(process.env.OPENAI_USD_JPY ?? 150);
  console.log(
    `[generate-tts-listening-3] done generated=${generated} skipped=${skipped} chars=${charCount} estCost≈¥${jpy.toFixed(2)}`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
