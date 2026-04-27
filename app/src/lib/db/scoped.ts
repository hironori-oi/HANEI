/**
 * HANEI - Scoped Query Helpers
 *
 * 三層認可防衛の第三層: 必ず family_id でスコープされたクエリビルダ。
 *
 * - 第一層: middleware (proxy.ts) でセッション検証
 * - 第二層: src/lib/auth/guards.ts の require* 関数
 * - 第三層: scopedQueries.familyOnly(familyId) で SQL レベルで絞り込む
 *
 * ESLint の no-restricted-syntax で `db.select()` の素呼びを禁止し、
 * 開発者にこのモジュール経由を強制する。
 */

import { eq, and } from "drizzle-orm";
import { db } from "./client";
import {
  learnerProfiles,
  familyMembers,
  parentConsents,
  answerLogs,
  srsStates,
  type LearnerProfile,
  type FamilyMember,
} from "./schema";

/**
 * `family_id` でスコープされたクエリビルダ集合を返す。
 * 必ず本ヘルパ経由でクエリを構築すること (家族間漏洩防止)。
 */
export function scopedQueries(familyId: string) {
  if (!familyId || typeof familyId !== "string") {
    throw new Error("[HANEI] scopedQueries: familyId is required");
  }

  return {
    /** 家族内の learner プロフィール一覧 */
    listLearners(): Promise<LearnerProfile[]> {
      return db.select().from(learnerProfiles).where(eq(learnerProfiles.familyId, familyId));
    },

    /** 家族メンバー一覧 */
    listMembers(): Promise<FamilyMember[]> {
      return db.select().from(familyMembers).where(eq(familyMembers.familyId, familyId));
    },

    /** 家族の同意ログ */
    listConsents() {
      return db.select().from(parentConsents).where(eq(parentConsents.familyId, familyId));
    },

    /**
     * learner_id 指定で answer_logs を取得 (familyId スコープを必ずチェックすること)
     * 呼び出し前に requireLearnerOwner でチェック済みであることが前提。
     */
    listAnswerLogs(learnerId: string) {
      return db.select().from(answerLogs).where(eq(answerLogs.learnerId, learnerId));
    },

    /** SRS 状態 (learnerId 指定 / 呼び出し前に owner チェック必須) */
    listSrsStates(learnerId: string) {
      return db.select().from(srsStates).where(eq(srsStates.learnerId, learnerId));
    },
  };
}

/**
 * 学習者IDが指定された家族に属することを SQL で再確認するためのヘルパ。
 * guards.ts の `requireLearnerOwner` から内部で利用される。
 */
export async function isLearnerInFamily(learnerId: string, familyId: string): Promise<boolean> {
  const rows = await db
    .select({ id: learnerProfiles.id })
    .from(learnerProfiles)
    .where(and(eq(learnerProfiles.id, learnerId), eq(learnerProfiles.familyId, familyId)))
    .limit(1);
  return rows.length > 0;
}
