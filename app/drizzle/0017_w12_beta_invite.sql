-- HANEI W12-T3-A = β invite flow (DEC-069)
-- Source: src/lib/db/schema.ts (users.betaInvitedByCode + betaInviteCodes)
-- Target: Turso / libSQL (SQLite)
--
-- 1. users.beta_invited_by_code 列追加 (履歴保持目的 / FK 不要)
-- 2. beta_invite_codes テーブル新設 (1 行 = 1 招待コード / code UNIQUE)
-- 3. インデックス 2 本 (code unique + (disabled_at, expires_at) 複合)
--
-- 設計思想 (DEC-069):
--   - β リリース期間中の signup ゲーティング用招待コード.
--   - 8 文字大文字英数 (`0/O/1/I/L` 除外) / scripts/generate-beta-invite.ts で運営者発行.
--   - admin UI 不要 (β 期間は CLI 運用 / Phase 3 candidate).
--
-- 三層認可 (DEC-003):
--   - 第三層: 個人特定可能要素 0 = テーブル設計時点で構造排除.
--
-- idempotency (DEC-055):
--   - signup action 内 transaction で
--       UPDATE ... SET redemption_count = redemption_count + 1
--        WHERE id = ? AND redemption_count < max_redemptions
--     の atomic 増加で race 条件下でも上限超過 0 を SQL レベルで担保.
--
-- 冪等性:
--   - 列追加: SQLite は ALTER TABLE ADD COLUMN に IF NOT EXISTS が無いが、E2E fixture
--     applyMigrations は `duplicate column name` を benign として握り潰す.
--   - テーブル / インデックス: IF NOT EXISTS 付きで再実行に強い.

-- ---- 1. users.beta_invited_by_code 列追加 ---------------------------------
ALTER TABLE `users` ADD COLUMN `beta_invited_by_code` text;

-- ---- 2. beta_invite_codes テーブル新設 ------------------------------------
CREATE TABLE IF NOT EXISTS `beta_invite_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `created_by` text,
  `note` text,
  `max_redemptions` integer NOT NULL DEFAULT 1,
  `redemption_count` integer NOT NULL DEFAULT 0,
  `expires_at` integer,
  `disabled_at` integer,
  `created_at` integer NOT NULL
);

-- ---- 3. インデックス 2 本 -------------------------------------------------
-- code 一意 (signup action での SELECT 検索キー)
CREATE UNIQUE INDEX IF NOT EXISTS `beta_invite_codes_code_idx`
  ON `beta_invite_codes` (`code`);

-- 「有効コード」検索高速化 (disabled / expired を構造的に弾く)
CREATE INDEX IF NOT EXISTS `beta_invite_codes_active_idx`
  ON `beta_invite_codes` (`disabled_at`, `expires_at`);
