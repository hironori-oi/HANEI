-- HANEI W2 = +15 tables
-- Source: src/lib/db/schema.ts (W2 extension block)
-- Target: Turso / libSQL (SQLite)
-- Idempotent: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
--
-- Tables added in W2:
--   sessions, accounts, verifications,                              (Better Auth)
--   daily_plans, streaks, xp_levels,                                (進捗)
--   badges, user_badges, characters,                                (ゲーミフィケーション)
--   mock_exam_results, exam_dates,                                  (模試/受験)
--   ai_coach_conversations, ai_coach_messages,                      (AI コーチ)
--   mastery_estimates,                                              (IRT/BKT)
--   generated_problems_queue, problem_explanations                  (生成パイプライン)
--
-- Also: srs_states に `state` カラムを追加 (FSRS state enum: 0=New 1=Learning 2=Review 3=Relearning)

-- =========================================================================
-- 1. Better Auth: sessions / accounts / verifications
-- =========================================================================
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `token` text NOT NULL,
  `expires_at` integer NOT NULL,
  `ip_address` text,
  `user_agent` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS `sessions_token_idx` ON `sessions` (`token`);
CREATE INDEX IF NOT EXISTS `sessions_user_idx` ON `sessions` (`user_id`);

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `account_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `access_token` text,
  `refresh_token` text,
  `access_token_expires_at` integer,
  `refresh_token_expires_at` integer,
  `scope` text,
  `id_token` text,
  `password` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS `accounts_provider_account_idx` ON `accounts` (`provider_id`,`account_id`);
CREATE INDEX IF NOT EXISTS `accounts_user_idx` ON `accounts` (`user_id`);

CREATE TABLE IF NOT EXISTS `verifications` (
  `id` text PRIMARY KEY NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS `verifications_identifier_idx` ON `verifications` (`identifier`);

-- =========================================================================
-- 2. 進捗: daily_plans / streaks / xp_levels
-- =========================================================================
CREATE TABLE IF NOT EXISTS `daily_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `date` text NOT NULL,
  `target_minutes` integer DEFAULT 60 NOT NULL,
  `vocab_count` integer DEFAULT 0 NOT NULL,
  `grammar_count` integer DEFAULT 0 NOT NULL,
  `listening_count` integer DEFAULT 0 NOT NULL,
  `writing_count` integer DEFAULT 0 NOT NULL,
  `completed` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS `daily_plans_learner_date_idx` ON `daily_plans` (`learner_id`,`date`);

CREATE TABLE IF NOT EXISTS `streaks` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL UNIQUE,
  `current_streak` integer DEFAULT 0 NOT NULL,
  `longest_streak` integer DEFAULT 0 NOT NULL,
  `last_active_date` text,
  `freeze_tickets` integer DEFAULT 0 NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `xp_levels` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL UNIQUE,
  `total_xp` integer DEFAULT 0 NOT NULL,
  `level` integer DEFAULT 1 NOT NULL,
  `next_level_xp` integer DEFAULT 100 NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);

-- =========================================================================
-- 3. ゲーミフィケーション: badges / user_badges / characters
-- =========================================================================
CREATE TABLE IF NOT EXISTS `badges` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `description` text NOT NULL,
  `icon_name` text NOT NULL,
  `criteria_json` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `badges_code_idx` ON `badges` (`code`);

CREATE TABLE IF NOT EXISTS `user_badges` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `badge_id` text NOT NULL,
  `earned_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS `user_badges_learner_badge_idx` ON `user_badges` (`learner_id`,`badge_id`);
CREATE INDEX IF NOT EXISTS `user_badges_learner_idx` ON `user_badges` (`learner_id`);

CREATE TABLE IF NOT EXISTS `characters` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL UNIQUE,
  `mood` text DEFAULT 'normal' NOT NULL,
  `level` integer DEFAULT 1 NOT NULL,
  `accessory_ids_json` text,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);

-- =========================================================================
-- 4. 模試 / 受験: mock_exam_results / exam_dates
-- =========================================================================
CREATE TABLE IF NOT EXISTS `mock_exam_results` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `level` text NOT NULL,
  `score` integer NOT NULL,
  `max_score` integer NOT NULL,
  `vocab_correct` integer DEFAULT 0 NOT NULL,
  `grammar_correct` integer DEFAULT 0 NOT NULL,
  `listening_correct` integer DEFAULT 0 NOT NULL,
  `writing_score` integer DEFAULT 0 NOT NULL,
  `taken_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `mock_exam_results_learner_idx` ON `mock_exam_results` (`learner_id`,`taken_at`);

CREATE TABLE IF NOT EXISTS `exam_dates` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `level` text NOT NULL,
  `exam_date` text NOT NULL,
  `countdown_days` integer,
  `plan_generated` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `exam_dates_learner_idx` ON `exam_dates` (`learner_id`,`exam_date`);

-- =========================================================================
-- 5. AI コーチ: ai_coach_conversations / ai_coach_messages
-- =========================================================================
CREATE TABLE IF NOT EXISTS `ai_coach_conversations` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `context_type` text DEFAULT 'general' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `ai_coach_conversations_learner_idx` ON `ai_coach_conversations` (`learner_id`,`created_at`);

CREATE TABLE IF NOT EXISTS `ai_coach_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `tokens_in` integer DEFAULT 0 NOT NULL,
  `tokens_out` integer DEFAULT 0 NOT NULL,
  `cost_jpy` real DEFAULT 0 NOT NULL,
  `moderation_verdict` text DEFAULT 'pass' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`conversation_id`) REFERENCES `ai_coach_conversations`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `ai_coach_messages_conv_idx` ON `ai_coach_messages` (`conversation_id`,`created_at`);

-- =========================================================================
-- 6. mastery_estimates (IRT/BKT)
-- =========================================================================
CREATE TABLE IF NOT EXISTS `mastery_estimates` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `skill_id` text NOT NULL,
  `theta` real DEFAULT 0 NOT NULL,
  `mastery_prob` real DEFAULT 0.5 NOT NULL,
  `last_updated` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS `mastery_estimates_learner_skill_idx` ON `mastery_estimates` (`learner_id`,`skill_id`);

-- =========================================================================
-- 7. 生成パイプライン: generated_problems_queue / problem_explanations
-- =========================================================================
CREATE TABLE IF NOT EXISTS `generated_problems_queue` (
  `id` text PRIMARY KEY NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `level` text NOT NULL,
  `skill` text NOT NULL,
  `prompt` text,
  `generation_id` text,
  `judge_score` real,
  `judge_verdict` text DEFAULT 'pending' NOT NULL,
  `retries` integer DEFAULT 0 NOT NULL,
  `problem_id` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS `generated_problems_queue_status_idx` ON `generated_problems_queue` (`status`,`created_at`);

CREATE TABLE IF NOT EXISTS `problem_explanations` (
  `id` text PRIMARY KEY NOT NULL,
  `problem_id` text NOT NULL,
  `explanation_text` text NOT NULL,
  `generated_by` text DEFAULT 'ai_coach' NOT NULL,
  `generated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `problem_explanations_problem_idx` ON `problem_explanations` (`problem_id`);

-- =========================================================================
-- 8. srs_states 拡張: state カラム追加 (FSRS 4-state)
-- =========================================================================
-- NOTE: 既存環境では下記 ALTER を別途手動で実行する必要がある (libSQL は IF NOT EXISTS の ALTER 非対応)
ALTER TABLE `srs_states` ADD COLUMN `state` integer DEFAULT 0 NOT NULL;

-- =========================================================================
-- Seed: 初期バッジ (W2 ミニマム)
-- =========================================================================
INSERT OR IGNORE INTO `badges` (`id`,`code`,`name`,`description`,`icon_name`) VALUES
  ('badge_first_step','first_step','はじめの一歩','はじめての問題に挑戦したよ','SparklesIcon'),
  ('badge_streak_3','streak_3','3日れんぞく','3日続けて学習したよ','FireIcon'),
  ('badge_streak_7','streak_7','1週間れんぞく','7日続けて学習したよ','FireIcon'),
  ('badge_vocab_100','vocab_100','単語マスター100','100単語を覚えたよ','BookOpenIcon'),
  ('badge_perfect_set','perfect_set','満点クリア','1セットぜんぶ正解したよ','TrophyIcon');
