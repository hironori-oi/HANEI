-- HANEI W9-T2 = accessories / learner_accessories
-- Source: src/lib/db/schema.ts (accessories / learnerAccessories)
-- Target: Turso / libSQL (SQLite)
-- Idempotent: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
--
-- ことだまトリ装着用アクセサリ。3 スロット (hat / scarf / wing_charm) × 4 種 = 12 種。
-- unlock_type = 'level' | 'streak' | 'xp' | 'badge'
-- unlock_value は数値 (level / streak / xp) または badge code 文字列。

-- =========================================================================
-- accessories マスタ
-- =========================================================================
CREATE TABLE IF NOT EXISTS `accessories` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `slot` text NOT NULL,
  `name` text NOT NULL,
  `unlock_type` text NOT NULL,
  `unlock_value` text NOT NULL,
  `description` text NOT NULL,
  `display_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `accessories_code_idx` ON `accessories` (`code`);
CREATE INDEX IF NOT EXISTS `accessories_slot_idx` ON `accessories` (`slot`, `display_order`);

-- =========================================================================
-- learner_accessories (解禁 + 装着状態)
-- accessory_code は accessories.code を参照 (FK 無し / seed 順序非依存)。
-- =========================================================================
CREATE TABLE IF NOT EXISTS `learner_accessories` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `accessory_code` text NOT NULL,
  `unlocked_at` integer DEFAULT (unixepoch()) NOT NULL,
  `is_equipped` integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS `learner_accessories_learner_code_idx`
  ON `learner_accessories` (`learner_id`, `accessory_code`);
CREATE INDEX IF NOT EXISTS `learner_accessories_learner_idx`
  ON `learner_accessories` (`learner_id`);
