-- HANEI - Initial Migration (W1)
-- Generated manually for environments where drizzle-kit cannot run.
-- Source: src/lib/db/schema.ts (10 tables)
-- Target: Turso / libSQL (SQLite dialect)

CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `email_verified` integer DEFAULT 0 NOT NULL,
  `name` text,
  `image` text,
  `role` text DEFAULT 'parent' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_idx` ON `users` (`email`);

CREATE TABLE IF NOT EXISTS `families` (
  `id` text PRIMARY KEY NOT NULL,
  `display_name` text,
  `plan` text DEFAULT 'free' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS `family_members` (
  `id` text PRIMARY KEY NOT NULL,
  `family_id` text NOT NULL,
  `user_id` text NOT NULL,
  `role` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS `family_members_user_family_idx` ON `family_members` (`user_id`,`family_id`);
CREATE INDEX IF NOT EXISTS `family_members_family_idx` ON `family_members` (`family_id`);

CREATE TABLE IF NOT EXISTS `parent_consents` (
  `id` text PRIMARY KEY NOT NULL,
  `family_id` text NOT NULL,
  `parent_user_id` text NOT NULL,
  `learner_profile_id` text,
  `consent_type` text NOT NULL,
  `consent_version` text NOT NULL,
  `signature` text,
  `consented_at` integer DEFAULT (unixepoch()) NOT NULL,
  `ip_address` text,
  `user_agent` text,
  `revoked_at` integer,
  FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `learner_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `family_id` text NOT NULL,
  `user_id` text,
  `nickname` text NOT NULL,
  `avatar_id` text DEFAULT 'kotodama_tori' NOT NULL,
  `current_level` text NOT NULL,
  `target_eiken_level` text NOT NULL,
  `exam_date` text,
  `daily_minutes_target` integer DEFAULT 60 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS `learner_profiles_family_idx` ON `learner_profiles` (`family_id`);

CREATE TABLE IF NOT EXISTS `eiken_levels` (
  `id` text PRIMARY KEY NOT NULL,
  `display_name` text NOT NULL,
  `target_vocab_count` integer NOT NULL,
  `description` text
);

CREATE TABLE IF NOT EXISTS `skills` (
  `id` text PRIMARY KEY NOT NULL,
  `parent_skill_id` text,
  `eiken_level_id` text NOT NULL,
  `display_name` text NOT NULL,
  FOREIGN KEY (`eiken_level_id`) REFERENCES `eiken_levels`(`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `problems` (
  `id` text PRIMARY KEY NOT NULL,
  `level_id` text NOT NULL,
  `skill_id` text NOT NULL,
  `type` text NOT NULL,
  `question_json` text NOT NULL,
  `correct_answer` text NOT NULL,
  `explanation` text NOT NULL,
  `generation_quality_score` real,
  `qa_verdict` text DEFAULT 'pending' NOT NULL,
  `qa_reasons` text,
  `qa_status` text DEFAULT 'draft' NOT NULL,
  `audio_url` text,
  `source` text DEFAULT 'ai_generated' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`level_id`) REFERENCES `eiken_levels`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS `problems_level_skill_idx` ON `problems` (`level_id`,`skill_id`);
CREATE INDEX IF NOT EXISTS `problems_qa_status_idx` ON `problems` (`qa_status`);

CREATE TABLE IF NOT EXISTS `answer_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `problem_id` text NOT NULL,
  `user_answer` text NOT NULL,
  `is_correct` integer NOT NULL,
  `time_spent_ms` integer NOT NULL,
  `answered_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS `answer_logs_learner_idx` ON `answer_logs` (`learner_id`,`answered_at`);
CREATE INDEX IF NOT EXISTS `answer_logs_learner_problem_idx` ON `answer_logs` (`learner_id`,`problem_id`);

CREATE TABLE IF NOT EXISTS `srs_states` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `problem_id` text NOT NULL,
  `fsrs_state` text NOT NULL,
  `stability` real DEFAULT 0 NOT NULL,
  `difficulty` real DEFAULT 5 NOT NULL,
  `due_at` integer NOT NULL,
  `last_reviewed_at` integer,
  `review_count` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS `srs_states_learner_problem_idx` ON `srs_states` (`learner_id`,`problem_id`);
CREATE INDEX IF NOT EXISTS `srs_states_learner_due_idx` ON `srs_states` (`learner_id`,`due_at`);

-- Seed: eiken_levels
INSERT OR IGNORE INTO `eiken_levels` (`id`,`display_name`,`target_vocab_count`,`description`) VALUES
  ('5','英検5級 (中学初級)',600,'be動詞・一般動詞・基本疑問文'),
  ('4','英検4級 (中学中級)',1300,'過去形・未来形・比較・関係詞入口'),
  ('3','英検3級 (中学卒業)',2100,'現在完了・受動態・関係代名詞・短文ライティング');

-- Seed: skills
INSERT OR IGNORE INTO `skills` (`id`,`parent_skill_id`,`eiken_level_id`,`display_name`) VALUES
  ('vocabulary',NULL,'5','語彙'),
  ('grammar',NULL,'5','文法'),
  ('listening',NULL,'5','リスニング'),
  ('reading',NULL,'5','読解'),
  ('writing',NULL,'5','ライティング'),
  ('speaking',NULL,'5','面接 / スピーキング');
