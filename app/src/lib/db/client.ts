/**
 * HANEI - Database Client (Turso / libSQL)
 *
 * 本番: Turso (libSQL://...)
 * 開発: ローカル SQLite (`file:./local.db`)
 *
 * 使用上の注意:
 *  - クライアント (`use client`) からこのモジュールを import しないこと
 *  - 生クエリ (db.select() など) を直接書かず、`scoped.ts` のヘルパを経由すること
 *    (三層認可防衛 / DEC-003)
 *
 * DEC-032 (W4.5 / 2026-04-27):
 *   Turso libSQL の HTTP クライアントは内部で undici fetch を使用しており、
 *   既定の connect timeout が 10s。Turso Free tier の cold start や
 *   モバイルテザリング下では 10s では足りず `UND_ERR_CONNECT_TIMEOUT` が発生する。
 *   - timeout を 30s に拡張
 *   - connect timeout / fetch failure 時に最大 3 回まで指数バックオフでリトライ
 *   `fetch` option は @libsql/core/api Config インタフェースで正式サポートされている。
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const databaseUrl = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

// ---------------------------------------------------------------------------
// Custom fetch (timeout 30s + retry on connect timeout / network error)
// ---------------------------------------------------------------------------
const FETCH_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

function isRetriableNetworkError(err: unknown): boolean {
  // undici が投げる ConnectTimeoutError / fetch failed 系を retry 対象にする
  // Turso cold start / TLS handshake 遅延 / モバイル回線の一過性エラーが対象
  const e = err as { name?: string; code?: string; cause?: { code?: string; name?: string } };
  if (!e) return false;
  if (e.name === "AbortError") return true;
  if (e.code === "UND_ERR_CONNECT_TIMEOUT") return true;
  if (e.code === "UND_ERR_SOCKET") return true;
  if (e.code === "ECONNRESET") return true;
  if (e.code === "ETIMEDOUT") return true;
  if (e.cause?.code === "UND_ERR_CONNECT_TIMEOUT") return true;
  if (e.cause?.code === "UND_ERR_SOCKET") return true;
  if (e.cause?.code === "ECONNRESET") return true;
  if (e.cause?.code === "ETIMEDOUT") return true;
  if (e.cause?.name === "ConnectTimeoutError") return true;
  return false;
}

const customFetch: typeof fetch = async (input, init) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      // 重要: input が Request オブジェクトの場合、body stream は 1 度しか読めないので
      // 毎 attempt でクローンを送る (リトライ時に "already used" エラーを回避)。
      // 原本 input は本ループ中で fetch に直接渡さないことで、何度でも clone() 可能。
      const requestToSend =
        typeof Request !== "undefined" && input instanceof Request
          ? input.clone()
          : input;
      const response = await fetch(requestToSend, { ...init, signal: ac.signal });
      return response;
    } catch (err) {
      lastError = err;
      const retriable = isRetriableNetworkError(err);
      const isLast = attempt === MAX_ATTEMPTS;
      if (process.env.DB_DEBUG === "1" || process.env.NODE_ENV !== "production") {
        // 静かに失敗するより、運用で気付ける方を優先
        console.warn(
          `[db/client] fetch attempt ${attempt}/${MAX_ATTEMPTS} failed: ` +
            `${(err as Error)?.name ?? "Error"} ${(err as Error)?.message ?? ""}` +
            (retriable && !isLast ? " (retrying)" : ""),
        );
      }
      if (!retriable || isLast) throw err;
      // exponential backoff: 500ms, 1500ms
      await new Promise((r) => setTimeout(r, 500 * Math.pow(3, attempt - 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  // 到達不能（ループは throw か return で抜ける）
  throw lastError;
};

const libsqlClient = createClient({
  url: databaseUrl,
  ...(authToken ? { authToken } : {}),
  fetch: customFetch,
});

export const db = drizzle(libsqlClient, { schema });

export type Db = typeof db;
export { schema };
