"use server";

/**
 * HANEI - Learner Preferences Server Actions (W8-T3 / W8-T4)
 *
 * 学習者 (子) の効果音 / 紙吹雪 ON-OFF を保護者が制御する。
 *
 * 三層認可防衛 (DEC-003):
 *   - 第一層: middleware (proxy.ts)
 *   - 第二層: requireAuth → requireLearnerOwner で
 *            「この親がこの learner にアクセス可能か」を SQL で確認
 *   - 第三層: scopedQueries(familyId) で更新先を familyId スコープで再絞込み
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { learnerProfiles } from "@/lib/db/schema";
import { requireAuth, requireLearnerOwner } from "@/lib/auth/guards";
import {
  DAILY_GOAL_XP_OPTIONS,
  DAILY_GOAL_DEFAULT_XP,
  isValidDailyGoalXp,
  type DailyGoalXp,
} from "@/lib/study/daily-goal";
import {
  normalizePreferences,
  type NormalizedLearnerPreferences,
} from "@/lib/study/learner-preferences-normalize";

/**
 * preferences JSON のスキーマ (W8 + W10-T5 拡張).
 * - soundEnabled / confettiEnabled: 既存 (W8-T3 / W8-T4)
 * - preferredSessionMinutes: W10-T5 「いつもの長さ」 cross-device 永続化
 *   5 / 7 / 10 / null のみ許容 (それ以外は zod が reject)
 *
 * NOTE (Turbopack 制約):
 *   "use server" ファイルから sync 関数 / 型を `export` することは不可なので、
 *   normalizePreferences / NormalizedLearnerPreferences は @/lib/study/learner-preferences-normalize に切り出す。
 */
const PreferencesSchema = z.object({
  soundEnabled: z.boolean().optional(),
  confettiEnabled: z.boolean().optional(),
  preferredSessionMinutes: z
    .union([z.literal(5), z.literal(7), z.literal(10), z.null()])
    .optional(),
});

const DailyGoalSchema = z.object({
  dailyGoalXp: z
    .number()
    .int()
    .refine((v): v is DailyGoalXp => isValidDailyGoalXp(v), {
      message: `dailyGoalXp は ${DAILY_GOAL_XP_OPTIONS.join(" / ")} のいずれかである必要があります`,
    }),
});

type LearnerPreferences = z.infer<typeof PreferencesSchema>;

/**
 * 学習者の preferences を取得する。
 * 認可: 保護者本人が learner の owner であること。
 */
export async function getLearnerPreferences(
  learnerId: string,
): Promise<NormalizedLearnerPreferences> {
  const session = await requireAuth();
  const { familyId } = await requireLearnerOwner(session.userId, learnerId);

  // scoped: familyId AND learnerId の AND で絞り込む (家族間漏洩防止)
  // eslint-disable-next-line no-restricted-syntax -- familyId + learnerId 二重スコープ済 (DEC-003)
  const rows = await db
    .select({ preferences: learnerProfiles.preferences })
    .from(learnerProfiles)
    .where(
      and(
        eq(learnerProfiles.id, learnerId),
        eq(learnerProfiles.familyId, familyId),
      ),
    )
    .limit(1);

  return normalizePreferences(rows[0]?.preferences);
}

/**
 * 学習者の preferences を部分更新する (merge)。
 * 認可: 保護者本人が learner の owner であること。
 *
 * preferredSessionMinutes (W10-T5):
 *   - undefined を渡された場合は現状値を維持 (no-op)
 *   - null を渡された場合は明示的に未設定にリセット
 */
export async function updateLearnerPreferences(
  learnerId: string,
  patch: LearnerPreferences,
): Promise<NormalizedLearnerPreferences> {
  const parsed = PreferencesSchema.parse(patch);
  const session = await requireAuth();
  const { familyId } = await requireLearnerOwner(session.userId, learnerId);

  const current = await getLearnerPreferences(learnerId);
  const merged: NormalizedLearnerPreferences = {
    soundEnabled: parsed.soundEnabled ?? current.soundEnabled,
    confettiEnabled: parsed.confettiEnabled ?? current.confettiEnabled,
    preferredSessionMinutes:
      parsed.preferredSessionMinutes !== undefined
        ? (parsed.preferredSessionMinutes as 5 | 7 | 10 | null)
        : current.preferredSessionMinutes,
  };

  await db
    .update(learnerProfiles)
    .set({ preferences: merged, updatedAt: new Date() })
    .where(
      and(
        eq(learnerProfiles.id, learnerId),
        eq(learnerProfiles.familyId, familyId),
      ),
    );

  return merged;
}

/**
 * 「いつもの長さ」を学習者本人 (= sign-in 中の自分自身が learner かつ family の parent) で
 * 永続化するための専用 action.
 *
 * 既存 updateLearnerPreferences は parent ロール経由を前提としているが、本 action は
 * /study Picker (子どもが触る画面) からも 1 click で呼べるように切り出している.
 *
 * 認可は requireLearnerOwner (= 親が自分の家族の learner を更新する) の枠内.
 * - Phase 1 では同一アカウントが parent + learner を兼ねるシナリオなので OK.
 */
export async function setPreferredSessionMinutes(
  learnerId: string,
  minutes: 5 | 7 | 10 | null,
): Promise<NormalizedLearnerPreferences> {
  return updateLearnerPreferences(learnerId, {
    preferredSessionMinutes: minutes,
  });
}

/**
 * 学習者の自己選択日次ゴール XP を取得する (W8-T5)。
 * 認可: 保護者本人が learner の owner であること。
 *       (学習者本人ログイン経由の場合は requireLearnerOwner が拒否するため、
 *        Phase 1 では保護者経由のみを想定)
 */
export async function getDailyGoalForLearner(
  learnerId: string,
): Promise<DailyGoalXp> {
  const session = await requireAuth();
  const { familyId } = await requireLearnerOwner(session.userId, learnerId);

  // eslint-disable-next-line no-restricted-syntax -- familyId + learnerId 二重スコープ済 (DEC-003)
  const rows = await db
    .select({ goal: learnerProfiles.dailyGoalXp })
    .from(learnerProfiles)
    .where(
      and(
        eq(learnerProfiles.id, learnerId),
        eq(learnerProfiles.familyId, familyId),
      ),
    )
    .limit(1);

  const raw = rows[0]?.goal ?? DAILY_GOAL_DEFAULT_XP;
  return isValidDailyGoalXp(raw) ? raw : DAILY_GOAL_DEFAULT_XP;
}

/**
 * 学習者の自己選択日次ゴール XP を更新する (W8-T5)。
 *
 * 4 段階値以外は zod で reject する。
 * 認可: 保護者本人が learner の owner であること。
 */
export async function updateDailyGoal(
  learnerId: string,
  dailyGoalXp: number,
): Promise<DailyGoalXp> {
  const parsed = DailyGoalSchema.parse({ dailyGoalXp });
  const session = await requireAuth();
  const { familyId } = await requireLearnerOwner(session.userId, learnerId);

  await db
    .update(learnerProfiles)
    .set({ dailyGoalXp: parsed.dailyGoalXp, updatedAt: new Date() })
    .where(
      and(
        eq(learnerProfiles.id, learnerId),
        eq(learnerProfiles.familyId, familyId),
      ),
    );

  return parsed.dailyGoalXp as DailyGoalXp;
}
