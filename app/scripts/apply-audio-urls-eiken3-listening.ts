/**
 * scripts/apply-audio-urls-eiken3-listening.ts (W12-T5 / DEC-079 + DEC-094)
 *
 * 用途: TTS 生成完了後 / `problems` テーブルの 3 級 listening 行 (50 問 / W5 20 + W6 30)
 *       に対し `audio_url = ${R2_PUBLIC_URL}/tts/v1/L3-XXX-nova.mp3` を batch UPDATE。
 *       `loadAllSeedIds()` から (level=eiken-3 / skill=listening) を全件 filter するため、
 *       W6 追加で自動的に対象 50 件 (W5 L3-001..020 + W6 L3-021..050) になる。
 *
 * 仕様 (DEC-079 + DEC-094 / DEC-055 冪等):
 *   - `loadAllSeedIds()` で対象 ID (L3-001..L3-050 / 50 問) を取得
 *   - `publicUrlFor(cacheKey)` で URL を構築
 *   - drizzle update where `id = L3-XXX`
 *   - 同一値再 UPDATE は安全 (冪等)
 *   - DRY_RUN 標準 (DRY_RUN=1 / DRY_RUN=true で集計のみ)
 *
 * 重要:
 *   ※ 実 DB UPDATE が発生するため Agent 環境では絶対に実行しない。
 *      実装のみで完了とし、オーナーが後でローカルから
 *      `npm run db:apply-audio-urls-eiken3-listening` で実行。
 *
 * 実行: `npm run db:apply-audio-urls-eiken3-listening`
 *   オプション (環境変数):
 *     - DRY_RUN=true / DRY_RUN=1 : DB 書込なしで集計のみ
 */

import { db } from "../src/lib/db/client";
import { problems } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { publicUrlFor, R2_PUBLIC_URL } from "../src/lib/storage/r2";
import { loadAllSeedIds } from "./seed-id-mapper";

// generate-tts-listening-3.ts と完全一致させること (DEC-079 / cache key 規約)
function cacheKey(problemId: string, voice: "nova"): string {
  return `tts/v1/${problemId}-${voice}.mp3`;
}

interface RunSummary {
  updated: number;
  skipped: number;
  total: number;
}

async function run(dryRun: boolean): Promise<RunSummary> {
  const all = await loadAllSeedIds();
  const targets = all.choiceProblems.filter(
    (p) => p.level === "eiken-3" && p.skill === "listening",
  );
  console.log(
    `[apply-audio-urls-eiken3-listening] target=${targets.length} dryRun=${dryRun} R2_PUBLIC_URL=${R2_PUBLIC_URL || "<unset>"}`,
  );

  let updated = 0;
  let skipped = 0;

  for (const p of targets) {
    const key = cacheKey(p.id, "nova");
    const url = publicUrlFor(key);

    if (dryRun) {
      console.log(`[dry-run] would update ${p.id} audio_url=${url}`);
      updated += 1;
      continue;
    }

    if (!url) {
      console.warn(
        `[apply-audio-urls-eiken3-listening] skip ${p.id}: R2_PUBLIC_URL 未設定で URL を組み立てられません`,
      );
      skipped += 1;
      continue;
    }

    const ret = await db
      .update(problems)
      .set({ audioUrl: url })
      .where(eq(problems.id, p.id))
      .returning({ id: problems.id });

    if (ret.length > 0) {
      updated += 1;
      console.log(`[apply-audio-urls-eiken3-listening] ok ${p.id} -> ${url}`);
    } else {
      skipped += 1;
      console.warn(
        `[apply-audio-urls-eiken3-listening] skip ${p.id}: row not found (seed 未投入の可能性 / db:seed を先に実行してください)`,
      );
    }
  }

  return { updated, skipped, total: targets.length };
}

async function main(): Promise<void> {
  const dryRun =
    process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";

  // DEC-028: 接続先 URL を必ず 1 行表示し、誤接続を即時検知できるようにする
  const dbUrl = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
  const dbKind =
    dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")
      ? "TURSO (remote)"
      : dbUrl.startsWith("file:")
        ? "LOCAL SQLite file"
        : "UNKNOWN";
  const safeUrl = dbUrl.replace(/(authToken|password|token)=[^&]*/gi, "$1=<REDACTED>");
  console.log(
    `[apply-audio-urls-eiken3-listening] connection: kind=${dbKind} url=${safeUrl}`,
  );

  const summary = await run(dryRun);
  console.log(
    `[apply-audio-urls-eiken3-listening] done updated=${summary.updated} skipped=${summary.skipped} total=${summary.total}`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { run };
