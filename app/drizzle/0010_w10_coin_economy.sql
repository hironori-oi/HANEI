-- HANEI W10-T1 = ハネキン (はね金) 経済 foundation
-- Source: src/lib/db/schema.ts (learnerProfiles.coinBalance + coinTransactions)
-- Target: Turso / libSQL (SQLite)
--
-- 1. learner_profiles に coin_balance (denormalized cache) 列を追加
-- 2. coin_transactions テーブル新設 (1 行 = 1 トランザクション)
-- 3. インデックス 2 本 (時系列読出 + 冪等チェック用)
--
-- 不変条件:
--   - coin_balance >= 0 (アプリ層 awardCoins / spendCoins で保証)
--   - SUM(coin_transactions.amount WHERE learner_id=?) == learner_profiles.coin_balance
--   - 課金システム化禁止 (DEC-012) : 外部購入導線ゼロの閉じた経済
--
-- 冪等性:
--   - 列追加: SQLite は IF NOT EXISTS をサポートしないため、ALTER TABLE は単発で実行する
--     既存環境では migration 適用済 marker (drizzle メタ) で重複防止される。
--   - テーブル / インデックス: IF NOT EXISTS 付きで再実行に強い。

-- ---- 1. learner_profiles.coin_balance 列追加 ---------------------------
ALTER TABLE `learner_profiles` ADD COLUMN `coin_balance` integer NOT NULL DEFAULT 0;

-- ---- 2. coin_transactions テーブル新設 -----------------------------------
CREATE TABLE IF NOT EXISTS `coin_transactions` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `amount` integer NOT NULL,
  `reason` text NOT NULL,
  `reference_id` text,
  `memo` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);

-- ---- 3. インデックス 2 本 ----------------------------------------------
-- 時系列読出 (取引履歴 listTransactions)
CREATE INDEX IF NOT EXISTS `coin_transactions_learner_idx`
  ON `coin_transactions` (`learner_id`, `created_at`);

-- 冪等チェック (同 reason + referenceId の重複付与検出)
CREATE INDEX IF NOT EXISTS `coin_transactions_learner_reason_ref_idx`
  ON `coin_transactions` (`learner_id`, `reason`, `reference_id`);
