/**
 * HANEI - Learner Study Data Reset / 削除対象 / 保持対象 テーブル名一覧 (DEC-090 項目 4)
 *
 * "use server" ファイル (lib/actions/reset-learner-study-data.ts) からは
 * sync 配列を export しても vitest 環境で import できるが、明示的に純データ
 * モジュールへ切り出すことで「やり直し」スコープの監査可能性を高める.
 *
 * - DELETE: 学習履歴系 (15 tables) — learner_id 条件で全件削除
 * - KEEP: メタ情報 + 親作成コンテンツ + family 全体 (8 tables) — 一切触らない
 *
 * 注意: ここに table 名を増やす時は必ず lib/actions/reset-learner-study-data.ts の
 * DELETE_TABLES const も同時更新すること (構造一致テストで検出される).
 */

export const RESET_DELETE_TABLE_NAMES_CANONICAL: ReadonlyArray<string> = [
  "answerLogs",
  "srsStates",
  "dailyPlans",
  "streaks",
  "xpLevels",
  "userBadges",
  "mockExamResults",
  "aiCoachConversations",
  "masteryEstimates",
  "learnerAccessories",
  "characters",
  "coinTransactions",
  "learnerInventory",
  "dailyQuests",
  "studySessions",
] as const;

export const RESET_KEEP_TABLE_NAMES_CANONICAL: ReadonlyArray<string> = [
  "learnerProfiles",
  "learnerSettings",
  "learnerStudyTargets",
  "examDates",
  "parentMessages",
  "families",
  "familyMembers",
  "users",
] as const;

/**
 * 削除対象 table 数. DEC-090 項目 4 仕様により 15.
 * 増減した時は本定数で構造的に検出.
 */
export const RESET_DELETE_TABLE_COUNT = 15 as const;

/**
 * 保持対象 table 数. DEC-090 項目 4 仕様により 8.
 */
export const RESET_KEEP_TABLE_COUNT = 8 as const;
