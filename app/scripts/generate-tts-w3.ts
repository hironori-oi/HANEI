/**
 * scripts/generate-tts-w3.ts (W3 / T-4)
 *
 * 用途: 5級語彙 200 問の「英単語 + 例文」を OpenAI tts-1 で読み上げ、R2 にアップロード。
 *
 * 仕様:
 *  - voice: nova / alloy / shimmer の 3 パターン
 *  - キャッシュキー: tts/v1/{problemId}-{voice}.mp3
 *    (※ 既存 tts/{level}/{skill}/{problemId}_{voice}.mp3 とは別に v1 名前空間に保存。
 *       語彙問題は level/skill が固定 (5/vocabulary) のため、シンプル化のためフラット化する)
 *  - 既に R2 に存在すれば skip (objectExists)
 *
 * コスト試算:
 *   200 問 × 3 voice × 30 文字 = 18,000 文字
 *   OpenAI tts-1 = $15.00 / 1M chars (2026-04 公開料金)
 *   => 18,000 / 1,000,000 × $15.00 = $0.27 ≒ ¥40
 *   (200 問のうち例文 50 字 + 単語 10 字 = 平均 60 字でも ¥80 以下)
 *
 * 重要:
 *   ※ 実 OpenAI API 課金 + R2 PutObject が発生するため Agent 環境では絶対に実行しない。
 *      実装のみで完了とし、オーナーが後でローカルから `npm run ai:generate-tts` で実行。
 *
 * 実行: `npm run ai:generate-tts`
 *   オプション (環境変数):
 *     - DRY_RUN=true : OpenAI / R2 を呼ばずに件数試算のみ
 *     - MAX_PROBLEMS=10
 */

import { hasApiKey } from "../src/lib/ai/openai";
import { putObject, objectExists, pingR2 } from "../src/lib/storage/r2";
import { loadAllSeedIds } from "./seed-id-mapper";

// ---------------------------------------------------------------------------
// W4.5 / T-3:
//   旧実装は seed-problems-w2 から自前で `seed_0000` 形式の fake ID を作っており、
//   DB の problems.id (V5-001 等) と一致しないため audio URL も命名が乖離していた。
//   修正: seed-id-mapper.loadAllSeedIds() を経由し、5 級 vocab に該当する
//         choice 問題の自然 ID (V5-001..060 / V5W4-001..100) を採用する。
// ---------------------------------------------------------------------------
async function loadEiken5Vocab(): Promise<
  Array<{ id: string; word: string; example: string }>
> {
  const all = await loadAllSeedIds();
  return all.choiceProblems
    .filter((p) => p.level === "eiken-5" && p.skill === "vocab")
    .map((p) => {
      const correct = p.choices[p.correct_index] ?? "";
      return {
        id: p.id,
        word: correct,
        example: p.prompt_text.replace(/\(\s*\)/g, correct),
      };
    });
}

const VOICES = ["nova", "alloy", "shimmer"] as const;
type Voice = (typeof VOICES)[number];

const TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "tts-1";

function cacheKey(problemId: string, voice: Voice): string {
  return `tts/v1/${problemId}-${voice}.mp3`;
}

async function generate(text: string, voice: Voice): Promise<Buffer> {
  if (!hasApiKey()) {
    throw new Error("[generate-tts-w3] OPENAI_API_KEY 未設定");
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
    throw new Error(`[generate-tts-w3] tts failed: ${res.status} ${errText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// CLI エントリ (W4 / T-6b: DRY_RUN=1 を default 推奨化)
// ---------------------------------------------------------------------------
//
// DRY_RUN モード仕様:
//   - 実 OpenAI API / R2 PutObject を一切呼ばない
//   - 対象問題の文字数を集計して USD/JPY コスト試算のみ
//   - W4 では `MAX_PROBLEMS=10 DRY_RUN=true npm run ai:generate-tts` を試走想定。
//     DRY_RUN=1 も拾う寛容パース。
//
async function main() {
  const dryRun =
    process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";
  const maxN = process.env.MAX_PROBLEMS
    ? Number(process.env.MAX_PROBLEMS)
    : Number.POSITIVE_INFINITY;

  const items = (await loadEiken5Vocab()).slice(0, maxN);
  console.log(
    `[generate-tts-w3] target=${items.length} voices=${VOICES.length} dryRun=${dryRun}`,
  );

  // 早期 fail: dryRun 以外で API key 不在なら即終了 (loop で全件失敗ログを出さない)
  if (!dryRun && !hasApiKey()) {
    console.error(
      "[generate-tts-w3] OPENAI_API_KEY が未設定です。.env.local に OPENAI_API_KEY=sk-... を設定してください。",
    );
    console.error(
      "[generate-tts-w3] (試走したい場合は DRY_RUN=true を付けて実行してください)",
    );
    process.exit(1);
  }

  // DEC-029: R2 smoke check
  //   既知バグ: split 命名 (R2_AUDIO_BUCKET / R2_S3_ENDPOINT) と single 命名
  //   (R2_BUCKET_NAME) のミスマッチで 401 を引いた前科あり。
  //   OpenAI を 600 回 (¥42) 叩いた後に R2 PUT で全失敗するのを防ぐため、
  //   ループ前に HeadBucket で 1 回だけ認可チェックする。
  if (!dryRun) {
    try {
      const ping = await pingR2();
      console.log(`[generate-tts-w3] R2 ok bucket=${ping.bucket}`);
    } catch (err) {
      console.error(
        "[generate-tts-w3] R2 smoke check failed. OpenAI 課金前に中断します。",
      );
      console.error(err);
      process.exit(1);
    }
  }

  let generated = 0;
  let skipped = 0;
  let charCount = 0;

  for (const item of items) {
    const text = `${item.word}. ${item.example}`;
    charCount += text.length * VOICES.length;

    for (const voice of VOICES) {
      const key = cacheKey(item.id, voice);
      if (dryRun) {
        console.log(`[dry-run] would generate ${key} (${text.length} chars)`);
        continue;
      }

      // skip if exists
      const exists = await objectExists(key).catch(() => false);
      if (exists) {
        skipped += 1;
        continue;
      }
      try {
        const mp3 = await generate(text, voice);
        await putObject(key, mp3, "audio/mpeg");
        generated += 1;
        console.log(`[generate-tts-w3] ok ${key}`);
      } catch (err) {
        console.error(`[generate-tts-w3] failed for ${key}:`, err);
      }
    }
  }

  // コスト試算 (USD 15 / 1M chars, USD/JPY = 150)
  const usd = (charCount / 1_000_000) * 15;
  const jpy = usd * Number(process.env.OPENAI_USD_JPY ?? 150);
  console.log(
    `[generate-tts-w3] done generated=${generated} skipped=${skipped} chars=${charCount} estCost≈¥${jpy.toFixed(2)}`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
