-- HANEI W10-T2 = /shop UI 在庫テーブル (DEC-056 案B)
-- Source: src/lib/db/schema.ts (learnerInventory)
-- Target: Turso / libSQL (SQLite)
--
-- 1. learner_inventory テーブル新設 (1 行 = 1 学習者 × 1 アイテム種)
-- 2. UNIQUE インデックス (learner_id, item_type) で 1 学習者 1 item_type = 1 行を保証
--
-- アイテム種:
--   - 'streak_freeze'           : Streak 維持アイテム (W8 で 1 個無料配布 base / W10-T2 追加購入)
--   - 'kotodama_feed_normal'    : ことだまトリの普通エサ (mood +1)
--   - 'kotodama_feed_premium'   : ことだまトリの特上エサ (mood +3 + 24h 持続)
--   - 'kotodama_feed_rainy'     : 雨の日限定エサ (Phase 3 で天気 API 連動 / 価格枠だけ確保)
--
-- 不変条件:
--   - quantity >= 0 (アプリ層 spendCoinsForShopItem で +1 のみ実行 / 消費は W10-T5 で実装)
--   - shop 購入経路でのみ INSERT/UPDATE される (DEC-056 アクセサリ category は出さない)
--
-- 課金システム化禁止 (DEC-012): 外部購入導線ゼロの閉じた経済。

-- ---- 1. learner_inventory テーブル新設 -----------------------------------
CREATE TABLE IF NOT EXISTS `learner_inventory` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `item_type` text NOT NULL,
  `quantity` integer NOT NULL DEFAULT 0,
  `last_acquired_at` integer,
  `last_used_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);

-- ---- 2. UNIQUE インデックス (learner_id, item_type) ----------------------
-- 1 学習者 × 1 item_type = 1 行 (upsert はアプリ層で UPDATE quantity += 1)
CREATE UNIQUE INDEX IF NOT EXISTS `learner_inventory_learner_item_idx`
  ON `learner_inventory` (`learner_id`, `item_type`);
