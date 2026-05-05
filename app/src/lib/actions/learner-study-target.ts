"use server";

/**
 * HANEI - Learner Study Target Server Actions (W12-T4 / Phase 3 第 1 波 / DEC-078 / M-3)
 *
 * 親 parent settings (/parent/settings/notifications) からの「学習時間目標」 section 編集経路.
 *
 * 三層認可防衛 (DEC-003):
 *   - 第一層: middleware (proxy.ts)
 *   - 第二層: requireAuth + requireParent + requireLearnerOwner で「親が自分の家族の learner」を確認
 *   - 第三層: family_id を learner_profiles 経由で間接 scope (learner_id 経由)
 *
 * sensitive 操作扱い (DEC-074 / DEC-075 既存パターン踏襲):
 *   - 親による学習時間目標 / リマインド時刻変更は **reauth 必須**
 *   - `requireParentReauth()` を冒頭で呼び、未 reauth なら明示エラー (dialog open trigger).
 *
 * mutation 分類 (DEC-006 再拡張版 / mutation 9/10):
 *   - `updateLearnerStudyTarget` = top-level mutation (page form から直接呼ばれる) #9
 *   - `getLearnerStudyTarget` は read = mutation 対象外
 *
 * 罰則ゼロ哲学 (DEC-024): エラーメッセージは丁寧な日本語で罰語ゼロ.
 * 冪等性 (DEC-055): 同一入力で同一結果. learner_id UNIQUE で 1 行制約 / upsert pattern.
 */

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { learnerStudyTargets, learnerProfiles } from "@/lib/db/schema";
import {
  requireAuth,
  requireParent,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import {
  LearnerStudyTargetPatchSchema,
  DEFAULT_LEARNER_STUDY_TARGET,
  type NormalizedLearnerStudyTarget,
} from "@/lib/study/learner-study-target-validate";
import { requireParentReauth } from "@/lib/actions/parent-reauth";

/**
 * 学習者の study target を取得 (無い場合は default 返却 / 行作成はしない).
 *
 * 認可: requireAuth + requireLearnerOwner (read 経路 / 親が自分の learner を見るのみ).
 */
export async function getLearnerStudyTarget(
  learnerId: string,
): Promise<NormalizedLearnerStudyTarget> {
  const session = await requireAuth();
  const { familyId } = await requireLearnerOwner(session.userId, learnerId);

  // eslint-disable-next-line no-restricted-syntax -- learner_id + family_id 二重スコープ済 (DEC-003)
  const rows = await db
    .select({
      dailyMinutesTarget: learnerStudyTargets.dailyMinutesTarget,
      reminderEnabled: learnerStudyTargets.reminderEnabled,
      reminderTime: learnerStudyTargets.reminderTime,
    })
    .from(learnerStudyTargets)
    .innerJoin(
      learnerProfiles,
      and(
        eq(learnerStudyTargets.learnerId, learnerProfiles.id),
        eq(learnerProfiles.familyId, familyId),
      ),
    )
    .where(eq(learnerStudyTargets.learnerId, learnerId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { ...DEFAULT_LEARNER_STUDY_TARGET };
  }
  return {
    dailyMinutesTarget: Number(row.dailyMinutesTarget ?? 15),
    reminderEnabled: Boolean(row.reminderEnabled),
    reminderTime: row.reminderTime ?? "19:00",
  };
}

export interface UpdateLearnerStudyTargetResult {
  ok: boolean;
  reason?: "validation_error" | "reauth_required" | "internal_error";
  message?: string;
  target?: NormalizedLearnerStudyTarget;
}

/**
 * 学習者 study target を upsert (notifications page 「学習時間目標」 section 用).
 *
 * sensitive 操作: 親パスワード再認証必須 (5 分間 grace / DEC-074 / DEC-075 既存パターン踏襲).
 *   - reauth fresh でない場合 `{ ok: false, reason: 'reauth_required' }` を返す.
 *   - dialog 側は本値で再認証 dialog を開く.
 *
 * **top-level mutation #9** (DEC-006 再拡張版 mutation 9/10 のうち 9 件目 / DEC-077 で確保した枠 +1).
 *
 * 冪等性 (DEC-055):
 *   - learner_id UNIQUE で行があれば UPDATE / 無ければ INSERT (upsert pattern).
 *   - revalidatePath('/parent/settings/notifications') + revalidatePath('/home') で双方向同期.
 */
export async function updateLearnerStudyTarget(
  learnerId: string,
  patch: unknown,
): Promise<UpdateLearnerStudyTargetResult> {
  const parsed = LearnerStudyTargetPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation_error",
      message: parsed.error.issues[0]?.message ?? "入力が正しくありません",
    };
  }

  // 認可
  const session = await requireAuth();
  await requireParent(session.userId);
  const { familyId } = await requireLearnerOwner(session.userId, learnerId);

  // sensitive = 親パスワード reauth 必須 (DEC-074 / DEC-075 既存パターン踏襲)
  try {
    await requireParentReauth();
  } catch {
    return {
      ok: false,
      reason: "reauth_required",
      message: "セキュリティのため、親のパスワードを再入力してください",
    };
  }

  // 既存 study target を取得 (無ければ default にマージ)
  const current = await getLearnerStudyTarget(learnerId);
  const merged: NormalizedLearnerStudyTarget = {
    dailyMinutesTarget:
      parsed.data.dailyMinutesTarget ?? current.dailyMinutesTarget,
    reminderEnabled: parsed.data.reminderEnabled ?? current.reminderEnabled,
    reminderTime: parsed.data.reminderTime ?? current.reminderTime,
  };

  // upsert: 行があれば UPDATE / 無ければ INSERT (idempotent / DEC-055)
  // eslint-disable-next-line no-restricted-syntax -- learner_id + family_id 二重スコープ済 (DEC-003)
  const existing = await db
    .select({ id: learnerStudyTargets.id })
    .from(learnerStudyTargets)
    .innerJoin(
      learnerProfiles,
      and(
        eq(learnerStudyTargets.learnerId, learnerProfiles.id),
        eq(learnerProfiles.familyId, familyId),
      ),
    )
    .where(eq(learnerStudyTargets.learnerId, learnerId))
    .limit(1);

  const now = new Date();
  if (existing[0]) {
    await db
      .update(learnerStudyTargets)
      .set({
        dailyMinutesTarget: merged.dailyMinutesTarget,
        reminderEnabled: merged.reminderEnabled,
        reminderTime: merged.reminderTime,
        updatedAt: now,
      })
      .where(eq(learnerStudyTargets.id, existing[0].id));
  } else {
    await db.insert(learnerStudyTargets).values({
      id: randomUUID(),
      learnerId,
      dailyMinutesTarget: merged.dailyMinutesTarget,
      reminderEnabled: merged.reminderEnabled,
      reminderTime: merged.reminderTime,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 双方向同期: 親 settings ↔ 学習者 home (DEC-078 §UI 拡張)
  revalidatePath("/parent/settings/notifications");
  revalidatePath("/home");

  return { ok: true, target: merged };
}
