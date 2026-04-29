/**
 * HANEI - Badge Codes (W9-T3 / 共通 enum / Shared Contract)
 *
 * **このファイルは Agent 横断の共有契約 (Shared Contract) です。**
 *
 * 参照 agent:
 *   - W9-T3 (本ファイル定義): badges 8 種の解放 / 表示 / 演出
 *   - W9-A (kotodama-tori 5 stage): "first_mock_exam" を「賢者」進化条件、
 *     "sakura_keeper" を「守護神」進化条件で参照
 *   - W9-B (Accessory): unlock_type = "badge" の解放条件で `badge` 列に
 *     BadgeCode を保存し参照
 *
 * 不変条件:
 *   - BadgeCode 文字列は **DB の badges.code カラムと完全一致**する
 *     (seed-badges.ts でも同 enum を import して INSERT)
 *   - 列挙順序は SOLID-AS 原則: 達成順 / 易→難 / tier 昇順
 *   - 削除/リネーム禁止 (DB seed と整合性が崩れる)。追加のみ許可。
 *
 * 設計原則:
 *   - 純 TypeScript 定数のみ (依存ゼロ / Server Component / Edge / unit test 全 import 可)
 *   - i18n を考慮し name / description は別 catalog に分離 (catalog.ts)
 *   - 絵文字禁止 / Heroicons + inline SVG (icons/* ディレクトリ)
 */

// ---------------------------------------------------------------------------
// BadgeCode (DB badges.code と一致)
// ---------------------------------------------------------------------------

/** はじめての解答 (answer_logs >= 1) - 飛び立つ翼 */
export const FIRST_FLIGHT_BADGE_CODE = "first_flight" as const;

/** 7 日連続学習 (streaks.current_streak >= 7) - 連続炎と桜の融合 */
export const STREAK_KEEPER_BADGE_CODE = "streak_keeper" as const;

/** 5 級語彙 100 問正答 (vocabulary mastered >= 100) - 巻物 + 文字 */
export const VOCAB_MASTER_BADGE_CODE = "vocab_master" as const;

/** 文法 100 問正答 (grammar mastered >= 100) - 設計図 + ペン */
export const GRAMMAR_MASTER_BADGE_CODE = "grammar_master" as const;

/** 読解 50 問正答 (reading mastered >= 50) - 開かれた書 */
export const READING_MASTER_BADGE_CODE = "reading_master" as const;

/** リスニング 50 問正答 (listening mastered >= 50) - 響く音波 */
export const LISTENING_MASTER_BADGE_CODE = "listening_master" as const;

/** 模試 1 回完了 (mock_exam_results >= 1) - 試験合格鉢巻 */
export const FIRST_MOCK_EXAM_BADGE_CODE = "first_mock_exam" as const;

/** 30 日連続学習 (streaks.current_streak >= 30) - 桜並木の守護 */
export const SAKURA_KEEPER_BADGE_CODE = "sakura_keeper" as const;

/** ALL 8 種を達成順で並べた配列 (seed / UI grid / unit test の単一 source-of-truth) */
export const ALL_BADGE_CODES = [
  FIRST_FLIGHT_BADGE_CODE,
  STREAK_KEEPER_BADGE_CODE,
  VOCAB_MASTER_BADGE_CODE,
  GRAMMAR_MASTER_BADGE_CODE,
  READING_MASTER_BADGE_CODE,
  LISTENING_MASTER_BADGE_CODE,
  FIRST_MOCK_EXAM_BADGE_CODE,
  SAKURA_KEEPER_BADGE_CODE,
] as const;

export type BadgeCode = (typeof ALL_BADGE_CODES)[number];

/** 値が BadgeCode かを narrow する type guard (W9-A / W9-B が import 用) */
export function isBadgeCode(value: unknown): value is BadgeCode {
  return (
    typeof value === "string" &&
    (ALL_BADGE_CODES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// W9-A 互換 alias (本ファイル初稿で W9-A が下記 alias を import 済 / 破壊回避)
// 「守護神進化条件 = 30 日連続学習を達成した桜守」と意味的に等価のため、
// SAKURA_KEEPER に統一しつつ、旧 alias も維持する。
// ---------------------------------------------------------------------------

/** @deprecated SAKURA_KEEPER_BADGE_CODE に rename。互換維持のため残置。 */
export const SAKURA_GUARDIAN_BADGE_CODE = SAKURA_KEEPER_BADGE_CODE;

// ---------------------------------------------------------------------------
// BadgeTier (rarity / 演出の強度)
// ---------------------------------------------------------------------------

export const BADGE_TIERS = ["bronze", "silver", "gold", "platinum"] as const;
export type BadgeTier = (typeof BADGE_TIERS)[number];

/** Tier の強度順 (演出 intensity 計算で使用) */
export const BADGE_TIER_RANK: Readonly<Record<BadgeTier, number>> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

/** BadgeCode → Tier 対応表 (8 種すべて) */
export const BADGE_CODE_TO_TIER: Readonly<Record<BadgeCode, BadgeTier>> = {
  first_flight: "bronze",
  streak_keeper: "silver",
  vocab_master: "silver",
  grammar_master: "silver",
  reading_master: "gold",
  listening_master: "gold",
  first_mock_exam: "gold",
  sakura_keeper: "platinum",
};

/** Tier 別 confetti intensity (W8 confetti と整合 / light / medium / heavy) */
export const BADGE_TIER_TO_CONFETTI: Readonly<
  Record<BadgeTier, "light" | "medium" | "heavy">
> = {
  bronze: "light",
  silver: "medium",
  gold: "heavy",
  platinum: "heavy",
};
