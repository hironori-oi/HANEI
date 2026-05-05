"use server";

/**
 * HANEI - Exam Date Server Actions (W4 / T-2 + W12-T2 / DEC-076)
 *
 * 三層認可 (二系統):
 *  - parent path (既存): requireAuth → requireParent → requireFamilyMember → requireLearnerOwner
 *  - learner-self path (W12-T2 新規 / DEC-076): requireAuth → requireLearner → requireSelfLearner
 *      ※ 罰則ゼロ哲学 (DEC-024): 学習者本人による自己編集は親パスワード reauth 不要
 *      ※ DEC-074 §reauth 要件: parent-only sensitive 操作 (settings 等) と区別
 *
 * 罰語ゼロ (DEC-024) / 生 db.select() 禁止 (eslint.config.mjs 内 例外を除く) /
 * mutation 8/8 維持 (DEC-006 拡張版上限ジャスト到達) = 既存 top-level fn `updateExamDate` の
 * 内部分岐で二系統認可を吸収し、新規 top-level Server Action は追加しない。
 *
 * 仕様:
 *  - 過去日付不可 (Server 側でも今日以降の日付であることを再検証)
 *  - 既に登録済の同 level / learner の最新行を上書き (UPSERT 風)
 *  - 学習者切替を挟まない (learnerId は呼び出し側で確定)
 *  - 双方向同期 (W12-T2): 親 dashboard と学習者 home の両画面に反映するため、
 *      examDates テーブル更新後に learnerProfiles.examDate を denormalize 同期
 *      + revalidatePath('/home') + revalidatePath('/parent/dashboard') の双方を発行
 */

import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { examDates, learnerProfiles, familyMembers } from "@/lib/db/schema";
import {
  requireAuth,
  requireParent,
  requireFamilyMember,
  requireLearnerOwner,
  requireLearner,
  requireSelfLearner,
} from "@/lib/auth/guards";
import {
  validateExamDate,
  validateExamLevel,
  type UpdateExamDateInput,
  type UpdateExamDateResult,
} from "@/lib/actions/exam-date-validation";

// "use server" モジュールでは非 async export ができないため、sync 関数 / 型は
// `exam-date-validation.ts` に分離して import している。型は本ファイルから
// re-export しない (Next.js Turbopack は type re-export も拒否する)。呼び出し側は
// 直接 `@/lib/actions/exam-date-validation` から import する。

/**
 * セッションの role を family_members から判定する内部 helper (W12-T2 / DEC-076).
 *
 * top-level Server Action ではなく private helper のため DEC-006 mutation count 対象外。
 * 親 path と learner-self path の二系統認可分岐に使う。
 */
async function detectFamilyRole(
  userId: string,
): Promise<"parent" | "learner" | null> {
  // 認可判定そのもの (二系統認可分岐の前段 / requireParent / requireLearner と同種)
  // eslint-disable-next-line no-restricted-syntax -- 認可判定 (parent/learner role 検出のみ / 後続で再検証)
  const rows = await db
    .select({ role: familyMembers.role })
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .limit(1);
  const role = rows[0]?.role;
  if (role === "parent" || role === "learner") return role;
  return null;
}

/**
 * 受験日更新 Server Action (W4 / T-2 + W12-T2 / DEC-076 二系統認可拡張).
 *
 * 流れ:
 *  1. 二系統認可 (parent path / learner-self path のいずれか)
 *  2. 入力検証 (level + date format + 過去日)
 *  3. 既存行検索 (learner × level)
 *  4. 既存があり allowOverwrite=false なら overwrite_required を返す
 *  5. 既存があれば UPDATE / 無ければ INSERT
 *  6. 双方向同期: learnerProfiles.examDate denormalize + revalidatePath 両画面
 *
 * mutation +0 (DEC-006 拡張版 8/8 維持): 既存 top-level fn の内部分岐拡張のみ。
 */
export async function updateExamDate(
  input: UpdateExamDateInput,
): Promise<UpdateExamDateResult> {
  // 1. 二系統認可 (parent path / learner-self path)
  const session = await requireAuth();
  const role = await detectFamilyRole(session.userId);

  if (role === "parent") {
    // parent path (既存): family 内の任意 learner を編集可
    const { familyId } = await requireParent(session.userId);
    await requireFamilyMember(session.userId, familyId);
    try {
      await requireLearnerOwner(session.userId, input.learnerId);
    } catch {
      return { ok: false, reason: "learner_not_owned" };
    }
  } else if (role === "learner") {
    // learner-self path (DEC-076 新規): 学習者本人が「自分の learnerProfiles」のみ編集可
    // 罰則ゼロ哲学 (DEC-024) に基づき reauth 不要 (自分の data の self-edit)。
    await requireLearner(session.userId);
    try {
      await requireSelfLearner(session.userId, input.learnerId);
    } catch {
      return { ok: false, reason: "learner_not_owned" };
    }
  } else {
    return { ok: false, reason: "learner_not_owned" };
  }

  // 2. 入力検証
  if (!validateExamLevel(input.level)) {
    return { ok: false, reason: "invalid_level" };
  }
  const v = validateExamDate(input.examDate);
  if (!v.ok) {
    return { ok: false, reason: v.reason };
  }

  // 3. 既存行検索 (learner × level)
  // eslint-disable-next-line no-restricted-syntax -- 認可済 (requireLearnerOwner / requireSelfLearner 直前で再検証)
  const existing = await db
    .select({
      id: examDates.id,
      examDate: examDates.examDate,
    })
    .from(examDates)
    .where(
      and(
        eq(examDates.learnerId, input.learnerId),
        eq(examDates.level, input.level),
      ),
    )
    .orderBy(desc(examDates.createdAt))
    .limit(1);

  const existingRow = existing[0];

  // 4. 上書き禁止
  if (existingRow && !input.allowOverwrite) {
    if (existingRow.examDate !== input.examDate) {
      return {
        ok: false,
        reason: "overwrite_required",
        existingDate: existingRow.examDate,
      };
    }
  }

  // 5. UPSERT (examDates テーブル)
  let result: UpdateExamDateResult;
  if (existingRow) {
    await db
      .update(examDates)
      .set({ examDate: input.examDate })
      .where(eq(examDates.id, existingRow.id));
    result = { ok: true, action: "updated", examDate: input.examDate };
  } else {
    await db.insert(examDates).values({
      id: `ed_${randomUUID()}`,
      learnerId: input.learnerId,
      level: input.level,
      examDate: input.examDate,
      planGenerated: false,
    });
    result = { ok: true, action: "inserted", examDate: input.examDate };
  }

  // 6. 双方向同期 (W12-T2 / DEC-076)
  //    /home は learnerProfiles.examDate を読むため、denormalize 同期しないと
  //    親 dashboard と /home でカウントダウン値が乖離する (W4 段階の既知 gap)。
  //    本 atomic で denormalize 同期 + revalidatePath 両画面 を整備する。
  await db
    .update(learnerProfiles)
    .set({ examDate: input.examDate })
    .where(eq(learnerProfiles.id, input.learnerId));

  revalidatePath("/home");
  revalidatePath("/home/exam-date");
  revalidatePath("/parent/dashboard");

  return result;
}
