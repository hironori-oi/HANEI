/**
 * HANEI - Vercel Cron: Weekly Digest Email (W6 / F-1)
 *
 * Schedule: 毎週日曜 21:00 JST = 12:00 UTC = `0 12 * * 0` (vercel.json で設定)
 *
 * 認可:
 *  - Vercel Cron からの呼び出し: `x-vercel-cron-signature` ヘッダ存在で許可
 *  - 手動 / 監視用: `Authorization: Bearer ${CRON_SECRET}` で許可
 *  それ以外は 401。
 *
 * 処理: 全 learner_profiles をループして sendWeeklyDigest を呼ぶ。
 * RESEND_API_KEY 未設定環境では sendEmail wrapper が console.log でスキップする
 * (=本 route は ok=false: no_api_key を「失敗」としてカウントするが、それは
 *  cron の責務外で、メトリクスとして保持するに留める)。
 */

import { NextResponse, type NextRequest } from "next/server";
import { sendWeeklyDigestAll } from "@/lib/notifications/weekly-digest";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const vercelSig = request.headers.get("x-vercel-cron-signature");
  const isVercelCron = Boolean(vercelSig);
  const isAuthorized =
    isVercelCron || (cronSecret && auth === `Bearer ${cronSecret}`);
  if (!isAuthorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await sendWeeklyDigestAll(new Date());
    return NextResponse.json({
      ok: true,
      elapsedMs: Date.now() - startedAt,
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      // 個別 outcomes は learnerId のみ返す (メール本文や PII は返さない)
      outcomes: result.outcomes.map((o) =>
        o.ok
          ? { ok: true, learnerId: o.learnerId }
          : { ok: false, learnerId: o.learnerId, reason: o.reason },
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: message, elapsedMs: Date.now() - startedAt },
      { status: 500 },
    );
  }
}

// POST も Vercel Cron が選ぶ場合に対応
export const POST = GET;
