/**
 * scripts/r2-debug.ts (DEC-029 続き / R2 認可切り分け)
 *
 * 用途:
 *   `npm run ai:generate-tts` の R2 smoke check が 401 で止まった件で、
 *   どの操作が通り / 弾かれているのかを最小単位で切り分けるためのデバッグツール。
 *
 *   失敗パターンの代表例:
 *     A. トークン自体が失効 / typo            → 全部 401
 *     B. トークンが別バケット限定 (object scope)→ 全部 401 / 403
 *     C. HeadBucket だけ弾かれる              → HeadBucket=401, Put/Get=200
 *     D. write 権限なし (read only token)      → Head/Get=200, Put=403
 *
 * 実行:
 *   npm run r2:debug
 *
 * 一切の実 OpenAI 課金を発生させないため、本スクリプトは TTS パイプラインに
 * 入る前のクレデンシャル切り分け専用。
 *
 * セキュリティ:
 *   - 失敗時の error は AWS SDK が返した raw 構造をそのまま出すが、credential
 *     値は SDK 側で常に伏せられる。endpoint URL / bucket 名は表示する。
 */

import {
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "../src/lib/storage/r2";

type StepResult = {
  step: string;
  ok: boolean;
  status?: number | string;
  code?: string;
  message?: string;
};

async function runStep(
  name: string,
  fn: () => Promise<unknown>,
): Promise<StepResult> {
  try {
    await fn();
    return { step: name, ok: true };
  } catch (err) {
    const status =
      (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode ?? "?";
    const code = (err as { name?: string })?.name ?? "Unknown";
    const message = (err as { message?: string })?.message ?? "";
    return { step: name, ok: false, status, code, message };
  }
}

async function main() {
  console.log("[r2-debug] env:");
  console.log(`  R2_ACCOUNT_ID       = ${process.env.R2_ACCOUNT_ID ? "set" : "<unset>"}`);
  console.log(`  R2_ACCESS_KEY_ID    = ${process.env.R2_ACCESS_KEY_ID ? "set" : "<unset>"}`);
  console.log(`  R2_SECRET_ACCESS_KEY= ${process.env.R2_SECRET_ACCESS_KEY ? "set" : "<unset>"}`);
  console.log(`  R2_S3_ENDPOINT      = ${process.env.R2_S3_ENDPOINT ?? "<unset>"}`);
  console.log(`  R2_BUCKET_NAME      = ${process.env.R2_BUCKET_NAME ?? "<unset>"}`);
  console.log(`  R2_AUDIO_BUCKET     = ${process.env.R2_AUDIO_BUCKET ?? "<unset>"}`);
  console.log(`  R2_PUBLIC_URL       = ${process.env.R2_PUBLIC_URL ?? "<unset>"}`);
  console.log(`  R2_AUDIO_PUBLIC_URL = ${process.env.R2_AUDIO_PUBLIC_URL ?? "<unset>"}`);
  console.log("");
  console.log(`[r2-debug] resolved bucket = ${R2_BUCKET}`);
  console.log(`[r2-debug] resolved publicUrl = ${R2_PUBLIC_URL || "<unset>"}`);
  console.log("");

  if (!r2Client) {
    console.error(
      "[r2-debug] R2 client が初期化されていません (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY のどれかが未設定)",
    );
    process.exit(1);
  }

  const debugKey = "tts/_debug/r2-debug-smoke.txt";
  const results: StepResult[] = [];

  // 1. HeadBucket: バケットそのものへのアクセス権
  results.push(
    await runStep("1) HeadBucket", () =>
      r2Client!.send(new HeadBucketCommand({ Bucket: R2_BUCKET })),
    ),
  );

  // 2. ListObjectsV2: list 権限
  results.push(
    await runStep("2) ListObjectsV2 (max=1)", () =>
      r2Client!.send(
        new ListObjectsV2Command({ Bucket: R2_BUCKET, MaxKeys: 1 }),
      ),
    ),
  );

  // 3. HeadObject (存在しないキー想定 / 404 期待 → 401/403 ならスコープ問題)
  results.push(
    await runStep("3) HeadObject (non-existent key, expect 404)", () =>
      r2Client!.send(
        new HeadObjectCommand({
          Bucket: R2_BUCKET,
          Key: "tts/_debug/__definitely_does_not_exist__.txt",
        }),
      ),
    ),
  );

  // 4. PutObject: 書き込み権 (1 byte だけ)
  results.push(
    await runStep("4) PutObject (1 byte)", () =>
      r2Client!.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: debugKey,
          Body: "x",
          ContentType: "text/plain",
        }),
      ),
    ),
  );

  // 5. GetObject: 読み取り権
  results.push(
    await runStep("5) GetObject (just-put key)", () =>
      r2Client!.send(
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: debugKey }),
      ),
    ),
  );

  // 6. DeleteObject: 後始末
  results.push(
    await runStep("6) DeleteObject (cleanup)", () =>
      r2Client!.send(
        new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: debugKey }),
      ),
    ),
  );

  // -------------------------------------------------------------------------
  // 結果
  // -------------------------------------------------------------------------
  console.log("[r2-debug] results:");
  for (const r of results) {
    if (r.ok) {
      console.log(`  ${r.step}  -> OK`);
    } else if (r.code === "NotFound" || r.status === 404) {
      // 404 は HeadObject (3) では期待挙動なので OK 扱い
      console.log(`  ${r.step}  -> 404 (expected for non-existent key)`);
    } else {
      console.log(
        `  ${r.step}  -> FAIL  status=${r.status} code=${r.code} msg=${r.message?.slice(0, 200) ?? ""}`,
      );
    }
  }
  console.log("");

  // -------------------------------------------------------------------------
  // 切り分けヒント
  // -------------------------------------------------------------------------
  const head = results[0]!;
  const list = results[1]!;
  const headObj = results[2]!;
  const put = results[3]!;
  const get = results[4]!;

  console.log("[r2-debug] interpretation:");
  if (
    !head.ok &&
    !list.ok &&
    !headObj.ok &&
    !put.ok &&
    !get.ok &&
    [head, list, headObj, put, get].every(
      (r) => r.status === 401 || r.status === 403,
    )
  ) {
    console.log(
      "  -> 全操作が 401/403。トークン自体が無効、または `hanei-dev-audio` バケットへの権限が一切ない。",
    );
    console.log(
      "     対処: Cloudflare ダッシュボード → R2 → 'Manage R2 API Tokens' で",
    );
    console.log(
      "           - 該当トークンの 'Permissions' = 'Object Read & Write' 以上",
    );
    console.log(
      "           - 該当トークンの 'Specify bucket(s)' に 'hanei-dev-audio' が含まれる",
    );
    console.log("           - 'TTL' が expired していない");
    console.log("           を確認。必要なら新トークン発行 → .env.local 更新。");
  } else if (
    !head.ok &&
    (head.status === 401 || head.status === 403) &&
    put.ok &&
    get.ok
  ) {
    console.log(
      "  -> HeadBucket だけ弾かれているが PutObject / GetObject は通る。",
    );
    console.log(
      "     Object Read & Write スコープのトークンの典型挙動。",
    );
    console.log(
      "     対処: pingR2() を HeadBucket → PutObject(1 byte)+DeleteObject に変更する",
    );
    console.log(
      "          (CEO 側で `r2.ts` の pingR2 実装を切り替える)",
    );
  } else if (
    head.ok &&
    !put.ok &&
    (put.status === 401 || put.status === 403)
  ) {
    console.log(
      "  -> Head/Get は通るが Put が弾かれる = read-only トークン。",
    );
    console.log("     対処: 'Object Read & Write' 権限のトークンに切替え。");
  } else if (head.ok && put.ok && get.ok) {
    console.log(
      "  -> すべて OK。pingR2 経由で再走可能。`npm run ai:generate-tts` を実行してください。",
    );
  } else {
    console.log(
      "  -> 部分的失敗。各行の status/code を見てトークンスコープを再確認。",
    );
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
