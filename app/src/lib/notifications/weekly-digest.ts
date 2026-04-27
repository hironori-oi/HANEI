/**
 * HANEI - Weekly Digest Email (W6 / F-1)
 *
 * 仕様:
 *  - 毎週日曜 21:00 JST (= 12:00 UTC) に保護者宛て送信
 *  - 1 学習者あたり 1 通: 解いた問題数 / 連続日数 / XP 獲得 / 4 スキル進捗 / 受験日カウントダウン
 *  - 三層認可: 本ファイルは Vercel Cron からのみ呼ばれ、cron route が CRON_SECRET で認証する。
 *    アグリゲーションは learnerId スコープで動くため、family_id 漏洩は構造上発生しない。
 *  - RESEND_API_KEY 未設定時は console.log でスキップ (auth.ts と同じ pattern / sendEmail wrapper 内で実装済み)
 *
 * デザイン: design-guidelines.md 準拠 / 絵文字 0 / Heroicons 同等 SVG inline (W6 範囲では テキスト主体)
 * 詳細レイアウト調整は別チケットで行う前提。
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { learnerProfiles, familyMembers, users } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/resend";
import {
  getDailySkillCounts,
  getMasteryCoverage,
  getCurrentStreak,
  getWeeklyAnswers,
  getXpSummary,
  getNearestExamCountdown,
  type SkillCoverage,
  type DailySkillCounts,
} from "@/lib/study/aggregations";
import { renderDigestHtml, type DigestData } from "./weekly-digest-template";

export type WeeklyDigestSendOutcome =
  | { ok: true; learnerId: string; to: string; messageId?: string }
  | { ok: false; learnerId: string; reason: string };

/**
 * 1 学習者分の週次ダイジェストを保護者宛てに送信。
 *
 * 失敗時 (該当 learner なし / 親 email なし / Resend 失敗) は戻り値で詳細を返す。
 * cron route がループ内でこの関数を呼び、集計結果をログに出す。
 */
export async function sendWeeklyDigest(
  learnerId: string,
  now: Date = new Date(),
): Promise<WeeklyDigestSendOutcome> {
  // 1. 学習者プロフィール
  // eslint-disable-next-line no-restricted-syntax -- cron 内 system 呼び出し (single learner lookup)
  const learnerRows = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);
  const learner = learnerRows[0];
  if (!learner) {
    return { ok: false, learnerId, reason: "learner_not_found" };
  }

  // 2. 同一 family の parent email を引く
  // eslint-disable-next-line no-restricted-syntax -- cron 内 system 呼び出し (parent email lookup)
  const parentRows = await db
    .select({
      email: users.email,
      name: users.name,
    })
    .from(familyMembers)
    .innerJoin(users, eq(users.id, familyMembers.userId))
    .where(eq(familyMembers.familyId, learner.familyId))
    .limit(10);
  const parent = parentRows.find((r) => r.email);
  if (!parent || !parent.email) {
    return { ok: false, learnerId, reason: "no_parent_email" };
  }

  // 3. 集計
  const [streak, weekly, xp, dailyCounts, coverage, countdown] = await Promise.all([
    getCurrentStreak(db, learnerId),
    getWeeklyAnswers(db, learnerId, 7, now),
    getXpSummary(db, learnerId, 7, now),
    getDailySkillCounts(db, learnerId, now),
    getMasteryCoverage(db, learnerId, learner.targetEikenLevel),
    getNearestExamCountdown(db, learnerId, now),
  ]);

  const data: DigestData = {
    learnerNickname: learner.nickname,
    targetLevel: learner.targetEikenLevel,
    weeklyAnswers: weekly.count,
    weeklyCorrect: weekly.correct,
    streak,
    weeklyXpDelta: xp.weeklyXpDelta,
    totalXp: xp.totalXp,
    dailyCounts,
    coverage,
    countdown,
    parentName: parent.name ?? "保護者",
  };

  const subject = `[HANEI] ${learner.nickname} さんの今週の学習レポート`;
  const html = renderDigestHtml(data);

  const result = await sendEmail({
    to: parent.email,
    subject,
    html,
  });

  if (!result.ok) {
    return { ok: false, learnerId, reason: result.reason };
  }
  return { ok: true, learnerId, to: parent.email, messageId: result.id };
}

/**
 * 全 learner_profiles をループしてダイジェスト送信。
 * cron route から呼ばれる単一エントリポイント。
 */
export async function sendWeeklyDigestAll(
  now: Date = new Date(),
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  outcomes: WeeklyDigestSendOutcome[];
}> {
  // eslint-disable-next-line no-restricted-syntax -- cron 内 system (全 learner 走査)
  const learners = await db.select({ id: learnerProfiles.id }).from(learnerProfiles);
  const outcomes: WeeklyDigestSendOutcome[] = [];
  let succeeded = 0;
  let failed = 0;
  for (const l of learners) {
    try {
      const out = await sendWeeklyDigest(l.id, now);
      outcomes.push(out);
      if (out.ok) succeeded += 1;
      else failed += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown_error";
      outcomes.push({ ok: false, learnerId: l.id, reason });
      failed += 1;
    }
  }
  return { total: learners.length, succeeded, failed, outcomes };
}

// 型再エクスポート (cron route / test で利用)
export type { DigestData, SkillCoverage, DailySkillCounts };
export { renderDigestHtml };
