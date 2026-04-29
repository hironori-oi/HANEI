-- HANEI W9-T5 = message_templates / parent_messages
-- Source: src/lib/db/schema.ts (messageTemplates / parentMessages)
-- Target: Turso / libSQL (SQLite)
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS
--
-- W11 Family Streak / 親→子メッセージ機能の前哨戦として
-- W9 で 30 種テンプレ + 簡易メッセージ送信を先行実装する。
--
-- 三層認可境界:
--   - parent_messages.family_id は family スコープを SQL レベルで強制
--   - 送信時 (server action) で requireParent + requireLearnerOwner で再検証
--   - to_learner_id は同 family の learner_profiles.id でなければならない

-- =========================================================================
-- 1. message_templates (応援メッセージ テンプレ マスタ / 30 種)
-- =========================================================================
CREATE TABLE IF NOT EXISTS `message_templates` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `category` text NOT NULL,
  `body` text NOT NULL,
  `display_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `message_templates_code_idx` ON `message_templates` (`code`);
CREATE INDEX IF NOT EXISTS `message_templates_category_idx` ON `message_templates` (`category`,`display_order`);

-- =========================================================================
-- 2. parent_messages (親→子メッセージ送信ログ)
-- =========================================================================
CREATE TABLE IF NOT EXISTS `parent_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `family_id` text NOT NULL,
  `from_user_id` text NOT NULL,
  `to_learner_id` text NOT NULL,
  `template_code` text,
  `body` text NOT NULL,
  `read_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`to_learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `parent_messages_to_learner_idx` ON `parent_messages` (`to_learner_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `parent_messages_family_idx` ON `parent_messages` (`family_id`,`created_at`);
