/**
 * HANEI - Application-wide constants
 */

export const APP_NAME = "HANEI";
export const APP_NAME_KANA = "ハンエイ";
export const APP_DESCRIPTION = "半年で英検3級を目指す小学生向け英語学習アプリ";

export const EIKEN_LEVELS = ["5", "4", "3"] as const;
export type EikenLevel = (typeof EIKEN_LEVELS)[number];

export const SKILLS = [
  "vocabulary",
  "grammar",
  "listening",
  "reading",
  "writing",
  "speaking",
] as const;
export type Skill = (typeof SKILLS)[number];

export const CONSENT_VERSION = "v1.0.0-2026-04";

/** デフォルトの学習目標 (分/日) */
export const DEFAULT_DAILY_MINUTES = 60;

/** AI コーチ応答時間の目標 (P95) */
export const AI_COACH_P95_MS = 4000; // K-5 受入基準 (W8 妥協ライン)

/** AI コスト/ユーザー/日 の閾値 (DEC-008 K-6 厳格化版) */
export const AI_COST_LIMIT_JPY_PER_USER_PER_DAY = 10;

/** 問題プール Phase 1 規模 (DEC-007) */
export const PROBLEM_POOL_PHASE1 = {
  level5: 400,
  level4: 500,
  level3: 700,
  total: 1600,
} as const;

/** LLM-as-Judge 合格閾値 (DEC-011) */
export const LLM_JUDGE_PASS_THRESHOLD = 80;
