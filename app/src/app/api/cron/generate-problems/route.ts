/**
 * HANEI - Vercel Inline Cron: 問題生成 + Judge パイプライン
 *
 * Schedule: 毎日 02:00 JST = 17:00 UTC = `0 17 * * *` (vercel.json で設定)
 * 認可: Vercel cron からの呼び出しは `x-vercel-cron-signature` または環境 CRON_SECRET で検証
 *
 * 処理:
 *  1. generated_problems_queue から status=pending を最大 50 件取り出す
 *  2. gpt-5-mini で生成 → Claude Sonnet 4.5 (現状モック) で採点
 *  3. score >= 0.85 (= 85/100) なら problems に投入し queue.status='passed'
 *  4. 失敗時 retries < 3 ならリトライ用に status='pending' を保持、
 *     >= 3 なら status='failed'
 *  5. 1 回の cron で cost ¥100/日上限 (運用環境変数で上書き可能)
 */

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { eq, and, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  generatedProblemsQueue,
  problems,
} from "@/lib/db/schema";
import { generateEiken5VocabProblem } from "@/scripts-runtime/generate-problem-runtime";
import { judgeProblem } from "@/scripts-runtime/judge-problem-runtime";
import { estimateCostJpy } from "@/lib/ai/cost-guard";

const MAX_PROBLEMS_PER_RUN = 50;
const MAX_DAILY_COST_JPY = Number(process.env.CRON_MAX_DAILY_JPY ?? 100);
const PASS_THRESHOLD_PCT = 85;
const MAX_RETRIES = 3;

export async function GET(request: NextRequest) {
  // 認可: Vercel Cron からの呼び出しか確認
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
  let processed = 0;
  let passed = 0;
  let failed = 0;
  let totalCost = 0;
  const errors: string[] = [];

  // pending を取得
  // eslint-disable-next-line no-restricted-syntax -- cron 内部 (queue 全体スキャン)
  const pending = await db
    .select()
    .from(generatedProblemsQueue)
    .where(
      and(
        eq(generatedProblemsQueue.status, "pending"),
        lte(generatedProblemsQueue.retries, MAX_RETRIES),
      ),
    )
    .limit(MAX_PROBLEMS_PER_RUN);

  for (const queueItem of pending) {
    if (totalCost >= MAX_DAILY_COST_JPY) {
      errors.push(`cost_limit_reached: ${totalCost}/${MAX_DAILY_COST_JPY}`);
      break;
    }
    processed += 1;
    try {
      // 1. 生成 (Phase 1 では eiken5 vocab 固定 / Phase 2 で skill/level 動的化)
      const generated = await generateEiken5VocabProblem();

      // 2. 採点
      const verdict = await judgeProblem(generated);

      // 簡易 cost 推定 (生成 800 tokens 出力 / 採点 500 tokens 出力 想定)
      const cost = estimateCostJpy(200, 800) + estimateCostJpy(300, 500);
      totalCost += cost;

      const scoreNormalized = verdict.qualityScore; // 0..100

      if (scoreNormalized >= PASS_THRESHOLD_PCT && verdict.qaVerdict === "pass") {
        // problems に投入
        const problemId = `pr_${randomUUID()}`;
        await db.insert(problems).values({
          id: problemId,
          levelId: queueItem.level,
          skillId: queueItem.skill,
          type: "mcq",
          questionJson: generated.questionJson,
          correctAnswer: generated.correctAnswer,
          explanation: generated.explanation,
          generationQualityScore: scoreNormalized,
          qaVerdict: "pass",
          qaReasons: verdict.reasons,
          qaStatus: "live",
          source: "ai_generated",
        });

        await db
          .update(generatedProblemsQueue)
          .set({
            status: "passed",
            judgeScore: scoreNormalized,
            judgeVerdict: "pass",
            problemId,
            updatedAt: new Date(),
          })
          .where(eq(generatedProblemsQueue.id, queueItem.id));
        passed += 1;
      } else {
        // 失敗 / リトライ
        const newRetries = queueItem.retries + 1;
        await db
          .update(generatedProblemsQueue)
          .set({
            retries: newRetries,
            judgeScore: scoreNormalized,
            judgeVerdict: "fail",
            status: newRetries >= MAX_RETRIES ? "failed" : "pending",
            updatedAt: new Date(),
          })
          .where(eq(generatedProblemsQueue.id, queueItem.id));
        if (newRetries >= MAX_RETRIES) failed += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`queue=${queueItem.id}: ${message}`);
    }
  }

  const elapsedMs = Date.now() - startedAt;
  return NextResponse.json({
    ok: true,
    elapsedMs,
    processed,
    passed,
    failedFinal: failed,
    totalCostJpy: totalCost,
    costLimitJpy: MAX_DAILY_COST_JPY,
    errors,
  });
}

// POST も Vercel Cron が選ぶ場合に対応
export const POST = GET;
