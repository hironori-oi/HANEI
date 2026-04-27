/**
 * HANEI - Exam Date 同期バリデータ + 型定義 (G-6 ビルド修正)
 *
 * 背景:
 *   `src/lib/actions/exam-date.ts` は `"use server"` 指定のため、
 *   非 async export (sync 関数 / 型) を含めることができない (Next.js 16 / Turbopack で
 *   build error: "Export validateExamDate doesn't exist in target module")。
 *   "use server" モジュールに同居させると client component (`exam-date-dialog.tsx`)
 *   からの import で破綻する。
 *
 * 解決:
 *   `streak.ts` で確立された分離パターンと同じく、sync helper と type を本ファイルに
 *   分離し、`exam-date.ts` (server actions) と `exam-date-dialog.tsx` (client component)
 *   の双方から import 可能にする。
 *
 * 既存 unit test (`tests/unit/exam-date.validation.test.ts`) も
 * `@/lib/actions/exam-date` から validateExamDate を import しているため、
 * server module 側で再エクスポートして互換性を保つ。
 */

export type ExamLevel = "5" | "4" | "3";

export interface UpdateExamDateInput {
  learnerId: string;
  level: ExamLevel;
  /** ISO YYYY-MM-DD */
  examDate: string;
  /** 上書き許可フラグ (false で既存日付があれば overwrite_required を返す) */
  allowOverwrite?: boolean;
}

export type UpdateExamDateResult =
  | { ok: true; action: "inserted" | "updated"; examDate: string }
  | {
      ok: false;
      reason:
        | "invalid_date_format"
        | "past_date_not_allowed"
        | "overwrite_required"
        | "invalid_level"
        | "learner_not_owned";
      existingDate?: string;
    };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 入力日付バリデーション (YYYY-MM-DD + 過去日不可) */
export function validateExamDate(
  input: string,
  now: Date = new Date(),
):
  | { ok: true }
  | { ok: false; reason: "invalid_date_format" | "past_date_not_allowed" } {
  if (!DATE_RE.test(input)) {
    return { ok: false, reason: "invalid_date_format" };
  }
  const target = new Date(`${input}T00:00:00`);
  if (Number.isNaN(target.getTime())) {
    return { ok: false, reason: "invalid_date_format" };
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (target.getTime() < today.getTime()) {
    return { ok: false, reason: "past_date_not_allowed" };
  }
  return { ok: true };
}

/** Level (英検級) バリデーション */
export function validateExamLevel(level: string): level is ExamLevel {
  return level === "5" || level === "4" || level === "3";
}
