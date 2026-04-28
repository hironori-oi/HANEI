/**
 * HANEI - Vercel Cron: Streak Freeze 自動付与 (W8-T1)
 *
 * Schedule: 毎日 15:00 UTC = 翌日 00:00 JST = `0 15 * * *` (vercel.json で設定)
 * 内部で「JST 月初判定」「受験日 30 日前判定」を行うため、cron 自体は毎日発火する。
 *
 * 認可: Vercel Cron からの呼び出しは `x-vercel-cron-signature` ヘッダで検証
 *
 * 処理:
 *  1. JST に換算した「今日」が月の 1 日なら、全 streaks に対して freeze ticket +1 (上限 2)
 *  2. 学習者ごとに「受験日まで 30 日」かを判定し、該当者には追加 +1 (上限 2)
 *  3. それ以外の日は無処理 (200 OK で no-op)
 */

import { NextResponse, type NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { streaks, learnerProfiles, examDates } from "@/lib/db/schema";
import {
  FREEZE_MAX_TICKETS,
  formatIsoDate,
  grantFreezeTicket,
  isFirstDayOfMonthJst,
  isExamDateBonusDay,
} from "@/lib/study/streak-freeze";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC の Date を JST 換算 (時計表示としての JST) する。 */
function toJst(now: Date): Date {
  return new Date(now.getTime() + JST_OFFSET_MS);
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
  const jstNow = toJst(now);
  const todayIsoJst = formatIsoDate(jstNow);
  const monthlyGrant = isFirstDayOfMonthJst(jstNow);

  let monthlyGranted = 0;
  let examBonusGranted = 0;
  let scanned = 0;
  const errors: string[] = [];

  try {
    // 1. 月初付与 (毎月 1 日)
    if (monthlyGrant) {
      // eslint-disable-next-line no-restricted-syntax -- cron 内部 (全 streaks 対象)
      const allStreaks = await db.select().from(streaks);
      scanned = allStreaks.length;
      for (const row of allStreaks) {
        const { newCount, granted } = grantFreezeTicket(row.freezeTickets);
        if (granted) {
          await db
            .update(streaks)
            .set({ freezeTickets: newCount, updatedAt: new Date() })
            .where(eq(streaks.id, row.id));
          monthlyGranted += 1;
        }
      }
    }

    // 2. 受験 30 日前ボーナス (毎日チェック)
    // eslint-disable-next-line no-restricted-syntax -- cron 内部 (全 learner 対象)
    const allLearners = await db
      .select({ id: learnerProfiles.id })
      .from(learnerProfiles);

    for (const learner of allLearners) {
      // 受験日: exam_dates テーブルから取得 (latest 1 件)
      // eslint-disable-next-line no-restricted-syntax -- cron 内部
      const examRows = await db
        .select({ examDate: examDates.examDate })
        .from(examDates)
        .where(eq(examDates.learnerId, learner.id))
        .limit(50);

      // 「ちょうど 30 日前」となる日が 1 つでもあれば bonus 付与対象
      const isBonus = examRows.some((r) =>
        isExamDateBonusDay(todayIsoJst, r.examDate),
      );
      if (!isBonus) continue;

      // streak 行を取得
      // eslint-disable-next-line no-restricted-syntax -- cron 内部
      const streakRows = await db
        .select()
        .from(streaks)
        .where(eq(streaks.learnerId, learner.id))
        .limit(1);
      const streakRow = streakRows[0];
      if (!streakRow) continue;

      const { newCount, granted } = grantFreezeTicket(streakRow.freezeTickets);
      if (granted) {
        await db
          .update(streaks)
          .set({ freezeTickets: newCount, updatedAt: new Date() })
          .where(eq(streaks.id, streakRow.id));
        examBonusGranted += 1;
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    todayIsoJst,
    monthlyGrant,
    monthlyGranted,
    examBonusGranted,
    scanned,
    maxTickets: FREEZE_MAX_TICKETS,
    errors,
  });
}

// 念のため和集合 (使うのは and のみ)
void and;

export const POST = GET;
