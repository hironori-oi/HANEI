"use server";

/**
 * HANEI - Exam Date Server Actions (W4 / T-2)
 *
 * 三層認可: requireAuth → requireParent → requireFamilyMember → requireLearnerOwner
 *           生 db.select() 禁止 (eslint.config.mjs 内 例外を除く)
 *
 * 仕様:
 *  - 過去日付不可 (Server 側でも今日以降の日付であることを再検証)
 *  - 既に登録済の同 level / learner の最新行を上書き (UPSERT 風)
 *  - 学習者切替を挟まない (learnerId は呼び出し側で確定)
 */

import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { examDates } from "@/lib/db/schema";
import {
  requireAuth,
  requireParent,
  requireFamilyMember,
  requireLearnerOwner,
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
 * 受験日更新 Server Action。
 *
 * 流れ:
 *  1. 三層認可
 *  2. 入力検証 (level + date format + 過去日)
 *  3. 既存行検索 (learner × level)
 *  4. 既存があり allowOverwrite=false なら overwrite_required を返す
 *  5. 既存があれば UPDATE / 無ければ INSERT
 */
export async function updateExamDate(
  input: UpdateExamDateInput,
): Promise<UpdateExamDateResult> {
  // 1. 認可
  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);
  await requireFamilyMember(session.userId, familyId);
  try {
    await requireLearnerOwner(session.userId, input.learnerId);
  } catch {
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
  // eslint-disable-next-line no-restricted-syntax -- 認可済 (requireLearnerOwner 直前で再検証)
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

  // 5. UPSERT
  if (existingRow) {
    await db
      .update(examDates)
      .set({ examDate: input.examDate })
      .where(eq(examDates.id, existingRow.id));
    return { ok: true, action: "updated", examDate: input.examDate };
  }
  await db.insert(examDates).values({
    id: `ed_${randomUUID()}`,
    learnerId: input.learnerId,
    level: input.level,
    examDate: input.examDate,
    planGenerated: false,
  });
  return { ok: true, action: "inserted", examDate: input.examDate };
}
