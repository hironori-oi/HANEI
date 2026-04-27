/**
 * HANEI - Learner Repository (W6 / F-3)
 *
 * 親 (parent) の所属する family 配下の learner_profiles を取得するヘルパ。
 * 三層認可防衛 第三層: 必ず familyId スコープで SQL を発行する。
 *
 * 呼び出し前提:
 *   - 第一層: middleware (proxy) でセッション検証済み
 *   - 第二層: requireParent / requireAuth で role チェック済み
 *   - 第三層: 本ヘルパが familyId 経由で SQL レベルの絞り込みを担う
 *
 * 用途:
 *   - /home の学習者切替 Tabs で「親が所属する家族の全 learner」を列挙
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  familyMembers,
  learnerProfiles,
  type LearnerProfile,
} from "@/lib/db/schema";

/**
 * 親 user_id から家族内の全 learner_profiles を取得する。
 *
 * 親が複数家族に所属するケースは想定しない (Phase 1) 。最初の family_members 行を採用。
 * 親が family_members に存在しない場合は空配列。
 *
 * @param userId - 親 (parent) の users.id
 * @returns 家族内の learner_profiles 配列 (家族未所属なら空)
 */
export async function getLearnersForParent(
  userId: string,
): Promise<LearnerProfile[]> {
  // 認可判定そのもの (eslint.config.mjs 内 files 例外で no-restricted-syntax は無効化済)
  const familyRows = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .limit(1);

  const familyId = familyRows[0]?.familyId;
  if (!familyId) return [];

  // 認可判定そのもの (familyId スコープ済み)
  const learners = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.familyId, familyId));

  return learners;
}
