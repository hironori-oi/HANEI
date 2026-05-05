/**
 * HANEI - Vercel Cron: 月次予算 alert (DEC-081 / Phase 3 第 1 波 β 開始前必須 atomic)
 *
 * Schedule: 毎日 00:00 UTC = 09:00 JST = `0 0 * * *` (vercel.json で設定).
 * 当月 (UTC 月初〜現在) の `ai_coach_messages.cost_jpy` 合計を 1 query で集計し、
 * `MONTHLY_BUDGET_JPY` env (default 3000) の 80% / 100% / 120% 段階で
 * Sentry に warning / error / fatal 相当のメッセージを送る。
 *
 * 認可: Vercel Cron からの呼び出しは `x-vercel-cron-signature` ヘッダで検証.
 *  - 開発 / 手動実行は CRON_SECRET の Bearer header で代替認証.
 *  - streak-freeze-monthly / study-minutes-reminder と完全同パターン (DEC-003 / DEC-068).
 *
 * 集計 (DEC-076 / DEC-078 既存 cost-guard.ts と同パターン / SQL aggregate-only):
 *  - SELECT COALESCE(SUM(cost_jpy), 0) FROM ai_coach_messages WHERE created_at >= <month_start_unix>.
 *  - row 単位アクセスなし / family / learner スコープなし (運営側コスト集計 = 全体集計).
 *  - DEC-003 三層認可的には「cron secret 二重認可 + 運営者通知のみ」で許容
 *    (個別 family / learner row は構造的に flow しない).
 *
 * 閾値判定:
 *  - pct = current / budget * 100
 *  - pct >= 120 → severity "fatal"  + Sentry warning (Sentry level 制約: warning のみ)
 *  - pct >= 100 → severity "error"  + Sentry warning
 *  - pct >= 80  → severity "warning" + Sentry warning
 *  - pct < 80   → no alert (200 + alerted=false / no-op)
 *
 * 罰則ゼロ哲学 (DEC-024):
 *  - admin / 運営者通知のみ / user-facing 文言なし.
 *
 * 冪等性 (DEC-055):
 *  - DB write 0 / 同日複数回叩かれても snapshot 評価のみ / Sentry 側 fingerprint で重複集約.
 *
 * Per-row fail-soft 系の精神 (DEC-068):
 *  - 1 query 失敗時は try/catch で 200 + alerted=false 返却 + Sentry capture (内部 log).
 */

import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db/client";
import { aiCoachMessages } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * UTC ベースの当月 1 日 0:00:00 を unix epoch 秒で返す.
 * `ai_coach_messages.created_at` は unixepoch() なので秒単位で比較.
 */
function getMonthStartUnixSec(now: Date): number {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  return Math.floor(monthStart.getTime() / 1000);
}

/** severity 判定. 80% 未満は null (alert なし). */
function classifySeverity(pct: number): "warning" | "error" | "fatal" | null {
  if (pct >= 120) return "fatal";
  if (pct >= 100) return "error";
  if (pct >= 80) return "warning";
  return null;
}

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
  const now = new Date();

  const parsedBudget = Number.parseFloat(
    process.env.MONTHLY_BUDGET_JPY ?? "3000",
  );
  const budget = Number.isFinite(parsedBudget) && parsedBudget > 0
    ? parsedBudget
    : 3000;

  let current = 0;
  let alerted = false;
  let severity: "warning" | "error" | "fatal" | null = null;
  const errors: string[] = [];

  try {
    const monthStartUnix = getMonthStartUnixSec(now);

    // 1 query / SQL aggregate-only / DEC-076・DEC-078 / cost-guard.ts 継承
    // eslint-disable-next-line no-restricted-syntax -- cron 内部 (運営者向け全体集計 / 個別 row なし)
    const rows = await db
      .select({
        total: sql<number>`COALESCE(SUM(${aiCoachMessages.costJpy}), 0)`,
      })
      .from(aiCoachMessages)
      .where(sql`${aiCoachMessages.createdAt} >= ${monthStartUnix}`);

    current = Math.max(0, Number(rows[0]?.total ?? 0));
    const pct = (current / budget) * 100;
    severity = classifySeverity(pct);

    if (severity !== null) {
      alerted = true;
      const message = `HANEI monthly budget alert: ${pct.toFixed(1)}% (¥${current}/${budget}) severity=${severity}`;
      console.log(`[HANEI/cron/monthly-budget-alert] ${message}`);
      // Sentry level は "warning" 固定 (Sentry SDK level enum / runbook §8 で UI 側 filter).
      // severity 情報は message 本文に埋めて UI 側で grep / filter 可能にする.
      Sentry.captureMessage(message, "warning");
    } else {
      console.log(
        `[HANEI/cron/monthly-budget-alert] no alert: ${pct.toFixed(1)}% (¥${current}/${budget})`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    // try/catch で Sentry capture 自体の失敗 (Sentry SDK 側) も吸収して 200 を返す.
    try {
      Sentry.captureException(err);
    } catch {
      // Sentry capture 自体が失敗した場合は console のみ (DEC-068 精神).
    }
    console.log(
      `[HANEI/cron/monthly-budget-alert] error: ${msg} (returning 200 + alerted=false)`,
    );
  }

  const pct = budget > 0 ? (current / budget) * 100 : 0;

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    current,
    budget,
    pct: Number(pct.toFixed(2)),
    severity,
    alerted,
    errors,
  });
}

export const POST = GET;
