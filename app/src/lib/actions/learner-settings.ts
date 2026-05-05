"use server";

/**
 * HANEI - Learner Settings Server Actions (W12-T1 / Phase 3 第 1 波 / DEC-074 / M-1)
 *
 * 親 settings (/parent/settings/notifications + /parent/settings/account) からの編集経路.
 *
 * 三層認可防衛 (DEC-003):
 *   - 第一層: middleware (proxy.ts)
 *   - 第二層: requireAuth + requireParent + requireLearnerOwner で「親が自分の家族の learner」を確認
 *   - 第三層: family_id を learner_profiles 経由で間接 scope (learner_id 経由)
 *
 * sensitive 操作 (account / nickname / 学年 変更) は冒頭で `requireParentReauth()` を呼ぶ.
 *
 * mutation 分類 (DEC-006 拡張版 / 5→8):
 *   - `updateLearnerProfile` = top-level mutation (page form から直接呼ばれる) #1
 *   - `updateLearnerSettings` = top-level mutation #2
 *   - `getLearnerSettings` は read = mutation 対象外
 *
 * 罰則ゼロ哲学 (DEC-024): 通知 OFF / 失敗時も罰メッセージは出さない.
 * 冪等性 (DEC-055): 同一入力で同一結果. learner_id UNIQUE で 1 行制約.
 */

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { learnerSettings, learnerProfiles } from "@/lib/db/schema";
import {
  requireAuth,
  requireParent,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import {
  LearnerSettingsPatchSchema,
  LearnerProfilePatchSchema,
  DEFAULT_LEARNER_SETTINGS,
  type NormalizedLearnerSettings,
} from "@/lib/study/learner-settings-validate";
import { requireParentReauth } from "@/lib/actions/parent-reauth";

/**
 * 学習者の settings を取得 (無い場合は default 返却 / 行作成はしない).
 */
export async function getLearnerSettings(
  learnerId: string,
): Promise<NormalizedLearnerSettings> {
  const session = await requireAuth();
  const { familyId } = await requireLearnerOwner(session.userId, learnerId);

  // eslint-disable-next-line no-restricted-syntax -- learner_id + family_id 二重スコープ済 (DEC-003)
  const rows = await db
    .select({
      notificationsEnabled: learnerSettings.notificationsEnabled,
      dailyReminderTime: learnerSettings.dailyReminderTime,
      soundEnabled: learnerSettings.soundEnabled,
      displayNameOverride: learnerSettings.displayNameOverride,
    })
    .from(learnerSettings)
    .innerJoin(
      learnerProfiles,
      and(
        eq(learnerSettings.learnerId, learnerProfiles.id),
        eq(learnerProfiles.familyId, familyId),
      ),
    )
    .where(eq(learnerSettings.learnerId, learnerId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { ...DEFAULT_LEARNER_SETTINGS };
  }
  return {
    notificationsEnabled: Boolean(row.notificationsEnabled),
    dailyReminderTime: row.dailyReminderTime ?? null,
    soundEnabled: Boolean(row.soundEnabled),
    displayNameOverride: row.displayNameOverride ?? null,
  };
}

export interface UpdateLearnerSettingsResult {
  ok: boolean;
  reason?: "validation_error" | "reauth_required" | "internal_error";
  message?: string;
  settings?: NormalizedLearnerSettings;
}

/**
 * 学習者 settings を upsert (notifications page 用).
 *
 * notifications 系編集は reauth 不要 (Should-have / 親が頻繁に触る) と判定.
 *   - account 系 (nickname / 学年 / 親 email) のみ reauth 必須化 = `updateLearnerProfile`.
 *
 * **top-level mutation #1** (DEC-006 拡張版 5→8 のうち 1 件目).
 */
export async function updateLearnerSettings(
  learnerId: string,
  patch: unknown,
): Promise<UpdateLearnerSettingsResult> {
  const parsed = LearnerSettingsPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation_error",
      message: parsed.error.issues[0]?.message ?? "入力が正しくありません",
    };
  }

  const session = await requireAuth();
  await requireParent(session.userId);
  const { familyId } = await requireLearnerOwner(session.userId, learnerId);

  // 既存 settings を取得 (無ければ default にマージ)
  const current = await getLearnerSettings(learnerId);
  const merged: NormalizedLearnerSettings = {
    notificationsEnabled:
      parsed.data.notificationsEnabled ?? current.notificationsEnabled,
    dailyReminderTime:
      parsed.data.dailyReminderTime !== undefined
        ? parsed.data.dailyReminderTime
        : current.dailyReminderTime,
    soundEnabled: parsed.data.soundEnabled ?? current.soundEnabled,
    displayNameOverride:
      parsed.data.displayNameOverride !== undefined
        ? parsed.data.displayNameOverride
        : current.displayNameOverride,
  };

  // upsert: 行があれば UPDATE / 無ければ INSERT (idempotent / DEC-055)
  // eslint-disable-next-line no-restricted-syntax -- learner_id + family_id 二重スコープ済 (DEC-003)
  const existing = await db
    .select({ id: learnerSettings.id })
    .from(learnerSettings)
    .innerJoin(
      learnerProfiles,
      and(
        eq(learnerSettings.learnerId, learnerProfiles.id),
        eq(learnerProfiles.familyId, familyId),
      ),
    )
    .where(eq(learnerSettings.learnerId, learnerId))
    .limit(1);

  const now = new Date();
  if (existing[0]) {
    await db
      .update(learnerSettings)
      .set({
        notificationsEnabled: merged.notificationsEnabled,
        dailyReminderTime: merged.dailyReminderTime,
        soundEnabled: merged.soundEnabled,
        displayNameOverride: merged.displayNameOverride,
        updatedAt: now,
      })
      .where(eq(learnerSettings.id, existing[0].id));
  } else {
    await db.insert(learnerSettings).values({
      id: randomUUID(),
      learnerId,
      notificationsEnabled: merged.notificationsEnabled,
      dailyReminderTime: merged.dailyReminderTime,
      soundEnabled: merged.soundEnabled,
      displayNameOverride: merged.displayNameOverride,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { ok: true, settings: merged };
}

export interface UpdateLearnerProfileResult {
  ok: boolean;
  reason?:
    | "validation_error"
    | "reauth_required"
    | "internal_error";
  message?: string;
}

/**
 * 学習者 profile (nickname + 学年 = targetEikenLevel) を更新する (account page 用).
 *
 * sensitive: 親パスワード再認証必須 (5 分間 grace).
 *   - reauth fresh でない場合 `{ ok: false, reason: 'reauth_required' }` を返す.
 *   - dialog 側は本値で再認証 dialog を開く.
 *
 * **top-level mutation #2** (DEC-006 拡張版 5→8 のうち 2 件目).
 */
export async function updateLearnerProfile(
  learnerId: string,
  patch: unknown,
): Promise<UpdateLearnerProfileResult> {
  const parsed = LearnerProfilePatchSchema.safeParse(patch);
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

  // sensitive = 親パスワード reauth 必須
  try {
    await requireParentReauth();
  } catch {
    return {
      ok: false,
      reason: "reauth_required",
      message: "セキュリティのため、親のパスワードを再入力してください",
    };
  }

  // 何も変更が無ければ no-op
  if (!parsed.data.nickname && !parsed.data.targetEikenLevel) {
    return { ok: true };
  }

  await db
    .update(learnerProfiles)
    .set({
      ...(parsed.data.nickname ? { nickname: parsed.data.nickname } : {}),
      ...(parsed.data.targetEikenLevel
        ? { targetEikenLevel: parsed.data.targetEikenLevel }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(learnerProfiles.id, learnerId),
        eq(learnerProfiles.familyId, familyId),
      ),
    );

  return { ok: true };
}
