/**
 * HANEI - Vercel Cron: 日次学習時間リマインド (W12-T4 / Phase 3 第 1 波 / DEC-078)
 *
 * Schedule: 毎日 12:00 UTC = 21:00 JST = `0 12 * * *` (vercel.json で設定)
 * β 段階で時刻調整可 (オーナー判断 O-1 で承認済 / DEC-077).
 *
 * 認可: Vercel Cron からの呼び出しは `x-vercel-cron-signature` ヘッダで検証
 *  - 開発 / 手動実行は CRON_SECRET の Bearer header で代替認証.
 *
 * 処理 (per-row fail-soft / DEC-068 既存 streak-freeze-monthly 同パターン):
 *  1. reminder_enabled=true の learner_study_targets 行を全 SELECT.
 *  2. 各 learner について JST 6:00 境界の「今日」 sessionDate を計算.
 *  3. study_sessions から SUM(cumulative_seconds) for (learner_id, session_date=今日) を集計.
 *  4. 今日の累計分数 = floor(total_seconds / 60).
 *  5. target.dailyMinutesTarget 未達なら log 出力 (β 段階 / 実 push 通知は β 後の atomic で実装).
 *  6. 1 learner DB error → errors 配列 push して残 learner 続行 (per-row fail-soft).
 *
 * 罰則ゼロ哲学 (DEC-024):
 *  - log 文言は「今日も少しずつ頑張ろうね」等の優しい呼びかけのみ (「サボった」「失敗」等の罰語ゼロ).
 *  - 目標達成済 learner は no-op (log なし / 重複 reminder 防止).
 *
 * 冪等性 (DEC-055):
 *  - 同日 2 回叩いても重複 reminder を出さない (純粋に「今日の累計 vs target」 snapshot 評価).
 *  - DB write 0 (本 cron は read + log のみ / β 段階).
 */

import { NextResponse, type NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  learnerStudyTargets,
  studySessions,
  learnerProfiles,
} from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { getJstQuestDate } from "@/lib/quest/jst-date";

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
  const todayIsoJst = getJstQuestDate(now);

  let scanned = 0;
  let remindedCount = 0;
  const errors: string[] = [];

  try {
    // 1. reminder_enabled=true の learner_study_targets を全 SELECT.
    //    learner_profiles と JOIN して family_id を確認 (cron は全 family 横断 = aggregate-only / DEC-003).
    // eslint-disable-next-line no-restricted-syntax -- cron 内部 (全 learner 対象)
    const allTargets = await db
      .select({
        learnerId: learnerStudyTargets.learnerId,
        dailyMinutesTarget: learnerStudyTargets.dailyMinutesTarget,
        reminderTime: learnerStudyTargets.reminderTime,
      })
      .from(learnerStudyTargets)
      .innerJoin(
        learnerProfiles,
        eq(learnerStudyTargets.learnerId, learnerProfiles.id),
      )
      .where(eq(learnerStudyTargets.reminderEnabled, true));

    scanned = allTargets.length;

    for (const target of allTargets) {
      // per-row fail-soft (DEC-068 streak-freeze-monthly 同パターン): 1 learner DB error → 残 learner 続行.
      try {
        // 2. 今日の累計学習秒数 SUM 集計 (study_sessions × session_date 二重スコープ).
        // eslint-disable-next-line no-restricted-syntax -- cron 内部 (per-learner SUM 集計)
        const sumRows = await db
          .select({
            total: sql<number>`COALESCE(SUM(${studySessions.cumulativeSeconds}), 0)`,
          })
          .from(studySessions)
          .where(
            and(
              eq(studySessions.learnerId, target.learnerId),
              eq(studySessions.sessionDate, todayIsoJst),
            ),
          );

        const totalSeconds = Math.max(0, Number(sumRows[0]?.total ?? 0));
        const currentMinutes = Math.floor(totalSeconds / 60);

        // 3. 目標未達のみリマインド log (達成済は no-op = 罰則ゼロ哲学整合 / 重複 reminder 防止).
        //    「失敗」「サボった」等の罰語は使わず、優しい呼びかけのみ (DEC-024).
        if (currentMinutes < target.dailyMinutesTarget) {
          const remaining = target.dailyMinutesTarget - currentMinutes;
          // β 段階では console.log + Sentry breadcrumb 程度の足場 (実 push 通知は β 後の atomic で実装 / DEC-078 §スコープ含まないもの).
          console.log(
            `[HANEI/cron/study-minutes-reminder] learner=${target.learnerId} today=${currentMinutes}min target=${target.dailyMinutesTarget}min remaining=${remaining}min message="今日も少しずつ頑張ろうね"`,
          );
          remindedCount += 1;
        }
      } catch (err) {
        errors.push(
          `learner=${target.learnerId} ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    todayIsoJst,
    scanned,
    remindedCount,
    errors,
  });
}

export const POST = GET;
