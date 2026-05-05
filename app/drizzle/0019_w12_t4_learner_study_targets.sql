-- HANEI W12-T4 (Phase 3 第 1 波 / DEC-078) = learner_study_targets テーブル新設 (M-3)
-- Source: src/lib/db/schema.ts (learnerStudyTargets)
-- Target: Turso / libSQL (SQLite)
--
-- 設計思想 (DEC-024 / DEC-003 / DEC-055 / DEC-078):
--   - 1 学習者 1 行 (uniqueIndex で保証 / learner_id UNIQUE)
--   - daily_minutes_target / reminder_enabled / reminder_time
--   - 親が parent settings (notifications page) から編集 (三層認可 / parent layer 必須)
--   - cron `/api/cron/study-minutes-reminder` から日次走査 (reminder_enabled=true のみ)
--
-- 既存テーブルとの関係:
--   - learner_profiles.dailyMinutesTarget (既存) は home の todaysMission target 配分用 (60 分既定).
--   - 新 learner_study_targets.daily_minutes_target は「今日の目標」軽量表示 + リマインド判定の
--     真のソース (15 分既定 / 0-180 分 range). 別概念として並走させる (段階移行は β 後).
--
-- 三層認可 (DEC-003):
--   - 第二層: requireAuth + requireParent + requireLearnerOwner で「親が自分の家族の learner」を確認.
--   - 第三層: family_id を learner_profiles 経由で間接的に scope (learner_id 経由).
--
-- 罰則ゼロ哲学 (DEC-024):
--   - reminder_enabled = false の場合, リマインド系 cron は no-op.
--   - 目標未達でも罰メッセージは出さない (cron log = 「優しい呼びかけ」 / 「サボった」「失敗」等の罰語ゼロ).
--
-- 冪等性 (DEC-055):
--   - upsert 風更新は learner_id UNIQUE で 1 行制約.
--   - 同一入力で同一結果 (Server Action 側で normalize 後 UPDATE).
--   - cron は同日 2 回叩いても重複 reminder を出さない (per-row idempotent log).

-- ---- 1. learner_study_targets テーブル新設 ----------------------------------
CREATE TABLE IF NOT EXISTS `learner_study_targets` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `daily_minutes_target` integer NOT NULL DEFAULT 15,
  `reminder_enabled` integer NOT NULL DEFAULT 1,
  `reminder_time` text NOT NULL DEFAULT '19:00',
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);

-- ---- 2. インデックス: learner_id UNIQUE (1 学習者 1 行 / upsert 冪等性担保) ----
CREATE UNIQUE INDEX IF NOT EXISTS `learner_study_targets_learner_idx`
  ON `learner_study_targets` (`learner_id`);
