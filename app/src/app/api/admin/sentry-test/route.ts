/**
 * HANEI - 故意発火 admin endpoint (DEC-081 / Phase 3 第 1 波 β 開始前必須 atomic)
 *
 * 目的:
 *  - β 開始前の Sentry 実発火 smoke / オーナー本人が 1 回叩いて email 到達確認 → 即 resolve.
 *  - docs/sentry-alert-setup.md § 7 に手順記載.
 *
 * 認可 (DEC-003 三層認可):
 *  - 第一層: middleware (proxy.ts) 経由のセッション cookie 存在チェック.
 *  - 第二層: 本ファイル内で `getSession()` を呼び role === "admin" を直接検証 (parent / learner は 401).
 *    `requireAdmin()` は redirect 型 = API route では 401 JSON 返却が必要なため直接 getSession で実装.
 *  - 第三層: side-effect なし (DB write 0 / Sentry capture のみ) = SQL レベル絞り込み不要.
 *
 * クエリ:
 *  - `?level=warning|error|fatal` (default `error`).
 *  - level=warning → captureMessage (warning) / captureException (warning) 双方発火 (UI で 2 系統検証可能).
 *  - level=error / fatal → captureException で Error を投げる.
 *
 * 罰則ゼロ哲学 (DEC-024):
 *  - admin 専用 / user-facing 文言なし / message は admin 内部 smoke 用.
 *
 * 冪等性 (DEC-055):
 *  - side-effect ゼロ / 何度叩いても DB 状態は変わらない.
 */

import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SentryTestLevel = "warning" | "error" | "fatal";

function parseLevel(input: string | null): SentryTestLevel {
  if (input === "warning" || input === "error" || input === "fatal") {
    return input;
  }
  return "error";
}

export async function GET(request: NextRequest) {
  // 第二層認可: getSession で role === "admin" を直接検証.
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const level = parseLevel(url.searchParams.get("level"));
  const capturedAt = new Date().toISOString();
  const message = `[sentry-test] level=${level} at ${capturedAt}`;

  // level に応じた Sentry capture (UI 側 alert ルール 4 件 + ルール 5 を一気に検証可).
  //   - warning: captureMessage + captureException 双方発火 (UI 側 level filter 動作確認用).
  //   - error / fatal: captureException で Error を投げる.
  if (level === "warning") {
    Sentry.captureMessage(message, "warning");
    Sentry.captureException(new Error(message));
  } else {
    Sentry.captureException(new Error(message));
  }

  return NextResponse.json({
    ok: true,
    level,
    capturedAt,
  });
}
