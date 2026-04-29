/**
 * HANEI - Message Placeholder Resolver (W9-T5)
 *
 * 純関数。テストは tests/unit/messages.resolve-placeholders.test.ts に集約。
 *
 * placeholder:
 *   - {streak_days} → ctx.streakDays  (現在の連続学習日数)
 *   - {exam_days}   → ctx.examDays    (受験日まで N 日 / 0=当日 / 負数=過去)
 *
 * 仕様:
 *   - placeholder の値が null/undefined の場合は ja-JP の人間的なフォールバック
 *     ("きょう" / "もうすぐ") に置換する (子供向けで「null 日」を絶対に出さない)。
 *   - 同じ placeholder が複数回現れても全て置換する。
 *   - 未知の placeholder ({xyz}) は元の文字列のまま (silent ignore)。
 */

export interface PlaceholderContext {
  /** 連続学習日数 */
  streakDays?: number | null;
  /** 受験日までの日数 (0=当日 / 負数=過去 / null=未設定) */
  examDays?: number | null;
}

/**
 * streakDays を ja-JP の自然な文字列に変換。
 *  - 0 / null / undefined → "きょう" (まだ続いていない場合の優しい表現)
 *  - >=1 → "N"
 */
function formatStreakDays(v: number | null | undefined): string {
  if (v === null || v === undefined) return "きょう";
  if (typeof v !== "number" || !Number.isFinite(v)) return "きょう";
  if (v <= 0) return "きょう";
  return String(Math.floor(v));
}

/**
 * examDays を ja-JP の自然な文字列に変換。
 *  - null / undefined → "もうすぐ" (受験日未設定時の優しい代替)
 *  - 0 → "0" (当日)
 *  - 負数 → "0" (過去 / 当日扱い)
 *  - >=1 → "N"
 */
function formatExamDays(v: number | null | undefined): string {
  if (v === null || v === undefined) return "もうすぐ";
  if (typeof v !== "number" || !Number.isFinite(v)) return "もうすぐ";
  if (v <= 0) return "0";
  return String(Math.floor(v));
}

/**
 * テンプレ本文の placeholder を解決して返す。
 *
 * @example
 *   resolvePlaceholders("しけんまで あと {exam_days} 日。", { examDays: 7 })
 *   → "しけんまで あと 7 日。"
 */
export function resolvePlaceholders(
  body: string,
  ctx: PlaceholderContext = {},
): string {
  if (typeof body !== "string") return "";
  let out = body;

  out = out.replaceAll("{streak_days}", formatStreakDays(ctx.streakDays));
  out = out.replaceAll("{exam_days}", formatExamDays(ctx.examDays));

  return out;
}

/**
 * 本文に placeholder が含まれているかを判定 (UI で preview 必要性の判定に利用)。
 */
export function hasPlaceholder(body: string): boolean {
  if (typeof body !== "string") return false;
  return body.includes("{streak_days}") || body.includes("{exam_days}");
}
