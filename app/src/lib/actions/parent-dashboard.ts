"use server";

/**
 * HANEI - Parent Dashboard Server Actions (W3 / T-2)
 *
 * 三層認可: requireParent → requireFamilyMember → requireLearnerOwner
 *           + scopedQueries(familyId)
 *           生 db.select() は ESLint で禁止 (eslint.config.mjs 内 例外を除く)
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, learnerProfiles } from "@/lib/db/schema";
import {
  requireAuth,
  requireParent,
  requireFamilyMember,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { scopedQueries } from "@/lib/db/scoped";
import { sendInactivityReminder } from "@/lib/email/resend";
import { shouldSendInactivityReminder } from "@/lib/study/aggregations";

export interface SendReminderResult {
  ok: boolean;
  reason?: string;
  daysSinceLastActive: number | null;
}

/**
 * 「今すぐリマインド」ボタンから呼ばれる Server Action。
 *
 * 流れ:
 *  1. 認証 + 親判定 + 家族メンバー判定 + 学習者所有判定 (三層)
 *  2. scopedQueries(familyId) で family メンバーを再取得 (生 select 禁止)
 *  3. shouldSendInactivityReminder で 7 日 inactive 判定
 *  4. 親 user の email に Resend 送信
 */
export async function sendInactivityReminderNow(
  learnerId: string,
): Promise<SendReminderResult> {
  // 1. auth
  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);
  await requireFamilyMember(session.userId, familyId);
  await requireLearnerOwner(session.userId, learnerId);

  // 2. scoped query: 親 user の email + 学習者の nickname
  const scoped = scopedQueries(familyId);
  const learners = await scoped.listLearners();
  const learner = learners.find((l) => l.id === learnerId);
  if (!learner) {
    return { ok: false, reason: "learner_not_in_family", daysSinceLastActive: null };
  }

  // parent email を引く (認可ガード経由で session に email がある前提)
  // session.email は requireAuth で取得済 (proxy 経由ではなく Better Auth API 直)
  const parentEmail = session.email;
  // 親 user の表示名
  // eslint-disable-next-line no-restricted-syntax -- 認可済 (parent user 自身)
  const userRows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  const parentName = userRows[0]?.name ?? "保護者";

  // 3. inactive 判定
  const trigger = await shouldSendInactivityReminder(db, learnerId, 7);
  if (!trigger.shouldSend) {
    return {
      ok: false,
      reason: "still_active",
      daysSinceLastActive: trigger.daysSinceLastActive,
    };
  }

  // 4. 送信
  await sendInactivityReminder({
    to: parentEmail,
    parentName,
    childNickname: learner.nickname,
    daysSinceLastActive: trigger.daysSinceLastActive ?? 7,
  });

  return {
    ok: true,
    daysSinceLastActive: trigger.daysSinceLastActive,
  };
}

// 未使用警告抑止 (learnerProfiles を直接参照するヘルパは scoped 経由)
const _ = { learnerProfiles };
void _;
