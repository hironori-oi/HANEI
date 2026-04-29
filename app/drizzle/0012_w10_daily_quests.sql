-- HANEI W10-T3 = Daily Quest デイリーミッション
-- Source: src/lib/db/schema.ts (dailyQuests)
-- Target: Turso / libSQL (SQLite)
--
-- 1. daily_quests テーブル新設 (1 行 = 1 学習者 × 1 quest_date (JST) × 1 quest_type)
-- 2. UNIQUE インデックス (learner_id, quest_date, quest_type) で lazy gen 冪等性を保証
-- 3. 検索インデックス (learner_id, quest_date) で「今日のクエスト一覧」を高速取得
--
-- quest_type (7 種 / Phase 1):
--   - 'vocab_count'        : 今日 N 問の語彙正解
--   - 'listening_perfect'  : 今日 N 問の listening を全問正解
--   - 'reading_count'      : 今日 N 問の reading 解答
--   - 'writing_count'      : 今日 1〜2 問の writing 解答
--   - 'streak_keep'        : 今日 1 問でも解いて streak をつなぐ
--   - 'badge_progress'     : 今日 N 問正解 (汎用)
--   - 'mock_warmup'        : 今日 1 度ミニ模試予熱 (Phase 3 stub)
--
-- 不変条件:
--   - 1 (learner_id, quest_date, quest_type) = 1 行 (uniqueIndex)
--   - progress >= 0
--   - status は 'in_progress' / 'claimed' のみ
--   - claimed 後は再付与不可 (claimQuestReward で冪等担保)
--
-- Lazy generation: cron 不使用 (Vercel Hobby plan 制約)
-- 罰則ゼロ哲学 (DEC-024): 未達でも streak は減らさない / マイナス pop なし。

-- ---- 1. daily_quests テーブル新設 ----------------------------------------
CREATE TABLE IF NOT EXISTS `daily_quests` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `quest_date` text NOT NULL,
  `quest_type` text NOT NULL,
  `title` text NOT NULL,
  `target` integer NOT NULL,
  `progress` integer NOT NULL DEFAULT 0,
  `reward_coins` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'in_progress',
  `completed_at` integer,
  `claimed_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);

-- ---- 2. UNIQUE インデックス (learner_id, quest_date, quest_type) ----------
-- lazy generation の冪等性: 同一 (learner, 日付, type) の二重 INSERT を防止
CREATE UNIQUE INDEX IF NOT EXISTS `daily_quests_learner_date_type_idx`
  ON `daily_quests` (`learner_id`, `quest_date`, `quest_type`);

-- ---- 3. 検索インデックス (learner_id, quest_date) ------------------------
-- 「今日 (= JST 6:00 境界後の today) の 3 件」を 1 query で取得する経路
CREATE INDEX IF NOT EXISTS `daily_quests_learner_date_idx`
  ON `daily_quests` (`learner_id`, `quest_date`);
