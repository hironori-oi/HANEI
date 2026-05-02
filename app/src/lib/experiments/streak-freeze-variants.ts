/**
 * HANEI - Streak Freeze A/B Variants Mapping (W12-T2.5 / DEC-067)
 *
 * EXPERIMENTS.streak_freeze_monthly_grant の variant key (control / variant_a) を
 * 「月次 grant 枚数」にマッピングする純関数.
 *
 * Turbopack `"use server"` sync export ban パターン 8 度目適用:
 *   - "use server" 不在 / DOM-free / DB-free
 *   - experiments-catalog.ts (catalog source of truth) を import せず
 *     「variant → 効果」マッピングを独立分離
 *   - cron / Server Component / Server Action どこからでも import 可
 *
 * DEC-024 設計原則尊重:
 *   - variant_a でも FREEZE_MAX_TICKETS=2 上限を構造的に尊重
 *   - 「貯まりすぎ → 安心しすぎ → 学習離脱」を防ぐ既存設計と整合
 */

/**
 * variant key → 月次 grant 枚数 マッピング.
 *
 * - control: 1 枚 (W8 既存挙動 / 後方互換)
 * - variant_a: 2 枚 (W12-T2 catalog 登録の variant)
 *
 * 注意: catalog (experiments-catalog.ts) を import せず独立分離する設計判断 (DEC-067).
 * 将来 catalog 拡張時は対応する key を本 map にも追加すること
 * (unit test で構造ガード済 / catalog ↔ variants map 一貫性チェック).
 */
export const STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT: Record<string, number> = {
  control: 1,
  variant_a: 2,
};

/**
 * variant key から月次 grant 枚数を返す純関数.
 *
 * 未知 variant (catalog から外れた値 / 空文字 / DB データ破損等) は
 * fallback 1 枚 (control 互換 / 安全側).
 *
 * @param variantKey - 割当て済 variant key (例: "control" / "variant_a")
 * @returns 月次 grant 枚数 (1 または 2)
 */
export function resolveStreakFreezeGrantTickets(variantKey: string): number {
  if (
    typeof variantKey !== "string" ||
    !Object.prototype.hasOwnProperty.call(
      STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT,
      variantKey,
    )
  ) {
    return 1; // fallback safety (control 互換)
  }
  return STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT[variantKey] ?? 1;
}
