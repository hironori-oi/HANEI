/**
 * HANEI - Cloudflare R2 Storage Helper (W2 完成形)
 *
 * DEC-003: egress 完全無料の R2 を採用。
 * S3 互換 API で @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner で操作。
 *
 * 主な用途 (Phase 1):
 *  - リスニング問題の TTS 音声 mp3 アップロード / 配信
 *  - キャラクター画像の配信
 *
 * 公開 URL:
 *  - W4 まで: r2.dev (Cloudflare 提供のサブドメイン / R2_PUBLIC_URL)
 *  - W5 以降: audio.hanei.app (DEC-016 / カスタムドメイン)
 *
 * TTS 音声キャッシュキー命名規則: tts/{level}/{skill}/{problem_id}_{voice_id}.mp3
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

// ---------------------------------------------------------------------------
// DEC-029 (W4.5 後・TTS 実走復旧):
//   .env.local は R2 を audio / images の 2 バケットに分割しており、
//   `R2_AUDIO_BUCKET` / `R2_IMAGES_BUCKET` / `R2_S3_ENDPOINT` /
//   `R2_AUDIO_PUBLIC_URL` / `R2_IMAGES_PUBLIC_URL` という split 命名を採用。
//   一方、本ヘルパは元々 single-bucket スキーム
//   (`R2_BUCKET_NAME` / `R2_PUBLIC_URL`) を読みに行っており、未設定だと
//   default `"hanei-audio"` にフォールバックして 401 Unauthorized を引いていた
//   (ai:generate-tts で 600 件全失敗、OpenAI 料金 ¥42 の空課金を発生させた)。
//   修正方針:
//     1. split 命名 → single 命名 → default の順にフォールバック
//     2. `R2_S3_ENDPOINT` が指定されていればそれを優先、無ければ accountId 由来
//     3. `pingR2()` を追加し、TTS / 画像生成スクリプトの先頭で smoke check
//        できるようにする (実 API 課金前に R2 認可エラーを検知する目的)
// ---------------------------------------------------------------------------
export const R2_BUCKET =
  process.env.R2_BUCKET_NAME ??
  process.env.R2_AUDIO_BUCKET ??
  "hanei-audio";
export const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL ?? process.env.R2_AUDIO_PUBLIC_URL ?? "";

const r2Endpoint = process.env.R2_S3_ENDPOINT
  ? process.env.R2_S3_ENDPOINT
  : accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : undefined;

const isConfigured = Boolean(
  (accountId || process.env.R2_S3_ENDPOINT) && accessKeyId && secretAccessKey,
);

export const r2Client =
  isConfigured && r2Endpoint
    ? new S3Client({
        region: "auto",
        endpoint: r2Endpoint,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      })
    : null;

// 環境変数解決の可視化 (DEC-027 / DEC-028 と同方針: 暗黙フォールバックを必ず log)
if (process.env.R2_DEBUG === "1" || process.env.R2_DEBUG === "true") {
  console.log(
    `[r2] bucket=${R2_BUCKET} endpoint=${r2Endpoint ?? "<unset>"} publicUrl=${R2_PUBLIC_URL || "<unset>"} configured=${isConfigured}`,
  );
}

function ensureClient(): S3Client {
  if (!r2Client) {
    throw new Error("[R2] not configured: missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
  }
  return r2Client;
}

// ---------------------------------------------------------------------------
// 公開 URL
// ---------------------------------------------------------------------------
export function publicUrlFor(key: string): string {
  if (!R2_PUBLIC_URL) return "";
  return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

// ---------------------------------------------------------------------------
// 1. putObject (アップロード本体 / Buffer / Uint8Array / string OK)
// ---------------------------------------------------------------------------
export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
  cacheControl: string = "public, max-age=31536000, immutable",
): Promise<{ key: string; publicUrl: string }> {
  const client = ensureClient();
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
  return { key, publicUrl: publicUrlFor(key) };
}

// 旧名互換 (W1 で uploadObject を使っていた場合)
export const uploadObject = putObject;

// ---------------------------------------------------------------------------
// 2. getUploadUrl (presigned PUT URL / クライアント直接アップロード用)
// ---------------------------------------------------------------------------
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 60 * 5,
): Promise<string> {
  const client = ensureClient();
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, cmd, { expiresIn });
}

// ---------------------------------------------------------------------------
// 3. getDownloadUrl (presigned GET URL / 公開バケットでない場合の取得)
// ---------------------------------------------------------------------------
export async function getDownloadUrl(
  key: string,
  expiresIn = 60 * 5,
): Promise<string> {
  const client = ensureClient();
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  return getSignedUrl(client, cmd, { expiresIn });
}

// 旧名互換
export const getPresignedDownloadUrl = getDownloadUrl;

// ---------------------------------------------------------------------------
// 4. exists (キャッシュ ヒット判定 / TTS で利用)
// ---------------------------------------------------------------------------
export async function objectExists(key: string): Promise<boolean> {
  const client = ensureClient();
  try {
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 5. pingR2 (smoke check: バケットへの認可が通っているかを 1 回確認する)
//    - DEC-029: TTS / 画像生成スクリプトで OpenAI API を叩く前に呼ぶこと。
//    - 認可エラーの場合は throw し、明確なメッセージで早期 fail させる。
// ---------------------------------------------------------------------------
export async function pingR2(): Promise<{ ok: true; bucket: string }> {
  const client = ensureClient();
  try {
    await client.send(new HeadBucketCommand({ Bucket: R2_BUCKET }));
    return { ok: true, bucket: R2_BUCKET };
  } catch (err) {
    const status =
      (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode ?? "?";
    const code = (err as { name?: string })?.name ?? "Unknown";
    throw new Error(
      `[R2] ping failed: bucket=${R2_BUCKET} endpoint=${r2Endpoint ?? "<unset>"} status=${status} code=${code}. ` +
        `R2_BUCKET_NAME / R2_AUDIO_BUCKET / R2_S3_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY を確認してください。`,
    );
  }
}

// ---------------------------------------------------------------------------
// 6. TTS キャッシュキー命名 (tts/{level}/{skill}/{problem_id}_{voice_id}.mp3)
// ---------------------------------------------------------------------------
export function ttsCacheKey(input: {
  level: "5" | "4" | "3";
  skill: string;
  problemId: string;
  voiceId: string;
}): string {
  return `tts/${input.level}/${input.skill}/${input.problemId}_${input.voiceId}.mp3`;
}
