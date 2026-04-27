/**
 * HANEI - API 共通エラーハンドラ
 *
 * project-setup-checklist.md Phase 6: API共通エラーハンドラー apiError() を作成
 * - 構造化 JSON ログ出力
 * - 内部エラーメッセージをクライアントに漏洩させない
 */

import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
};

export function apiError(
  code: ApiErrorCode,
  publicMessage: string,
  details?: { internal?: unknown; userId?: string },
): NextResponse {
  // 内部ログには詳細を残す (Sentry に送る前提)
  const logEntry = {
    timestamp: new Date().toISOString(),
    code,
    publicMessage,
    internal: details?.internal,
    userId: details?.userId,
  };
  console.error("[apiError]", JSON.stringify(logEntry));

  // 外部レスポンスは publicMessage のみ (内部情報を漏洩させない)
  return NextResponse.json(
    {
      error: {
        code,
        message: publicMessage,
      },
    },
    { status: STATUS_BY_CODE[code] },
  );
}
