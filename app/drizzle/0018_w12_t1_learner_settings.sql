-- HANEI W12-T1 (Phase 3 第 1 波) = learner_settings テーブル新設 (M-1)
-- Source: src/lib/db/schema.ts (learnerSettings)
-- Target: Turso / libSQL (SQLite)
--
-- 設計思想 (DEC-073 §1.1 / DEC-074 / WBS T1 atomic):
--   - 1 学習者 1 行 (uniqueIndex で保証 / learner_id UNIQUE)
--   - notifications_enabled / daily_reminder_time / sound_enabled / display_name_override
--   - 親が settings page から編集 (三層認可 / parent layer 必須)
--
-- 既存テーブルとの関係:
--   - learner_profiles.preferences (JSON / soundEnabled 等) は PWA 内の動作 preferences で残置.
--   - 新 learner_settings はリマインド / 通知系の親操作可能な設定を分離管理する.
--   - sound_enabled は学習画面側で参照される実体 (既存 preferences.soundEnabled と意味重複するが
--     段階移行: T1 では新規 learner_settings に保存先を upgrade. 既存 preferences は legacy として残し,
--     T1 atomic では既存 reads は影響不変. 将来 atomic で wiring 統合する).
--
-- 三層認可 (DEC-003):
--   - 第二層: requireAuth + requireParent + requireLearnerOwner で「親が自分の家族の learner」を確認.
--   - 第三層: family_id を learner_profiles 経由で間接的に scope (learner_id 経由).
--
-- 罰則ゼロ哲学 (DEC-024):
--   - daily_reminder_time が NULL = 通知無効. 通知 OFF でも罰メッセージは出さない.
--   - notifications_enabled = false の場合, リマインド系 cron は no-op (T4 atomic で実装).
--
-- 冪等性 (DEC-055):
--   - upsert 風更新は learner_id UNIQUE で 1 行制約.
--   - 同一入力で同一結果 (Server Action 側で normalize 後 UPDATE).

-- ---- 1. learner_settings テーブル新設 -----------------------------------------
CREATE TABLE IF NOT EXISTS `learner_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `notifications_enabled` integer NOT NULL DEFAULT 1,
  `daily_reminder_time` text,
  `sound_enabled` integer NOT NULL DEFAULT 1,
  `display_name_override` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);

-- ---- 2. インデックス: learner_id UNIQUE (1 学習者 1 行 / upsert 冪等性担保) ----
CREATE UNIQUE INDEX IF NOT EXISTS `learner_settings_learner_idx`
  ON `learner_settings` (`learner_id`);
