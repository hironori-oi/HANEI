-- HANEI W10-T5 = 過学習防止 (Overlearning Prevention)
-- Source: src/lib/db/schema.ts (studySessions)
-- Target: Turso / libSQL (SQLite)
--
-- 1. study_sessions テーブル新設 (1 行 = 1 学習者 × 1 URL session UUID)
-- 2. UNIQUE インデックス (learner_id, client_session_id) で startOrResumeStudySession の冪等性
-- 3. 検索インデックス (learner_id, session_date) で「今日の累計」 SUM 集計を高速化
--
-- 用途:
--   - 「今日 X 分学習」可視化 (保護者ダッシュボード / 学習画面の上部表示)
--   - 30 分 / 60 分の overlearning 閾値判定 (DB レイヤを真のソース化 / reload 越え対応)
--
-- end_reason (4 種):
--   - 'natural'    : planSize 問解き終わって SessionCompleteModal で OK 押下
--   - 'abort'      : 「ここまでにする」ボタンで自発中断
--   - 'overtime'   : 5/7/10 分の +50% を超過し SessionCompleteModal の overtime 提案で停止
--   - 'hard_limit' : 当日累計 60 分到達で強制終了 (W10-T5)
--
-- 不変条件:
--   - cumulative_seconds >= 0
--   - ended_at IS NULL = 進行中 / NOT NULL = 終了済
--   - session_date は JST 6:00 境界 (DEC-024 / quest 整合) の 'YYYY-MM-DD'
--
-- 罰則ゼロ哲学 (DEC-024):
--   - hard_limit (60 分) 終了時も「ごほうび: ハネキン X 枚 / きょうは おつかれさま」と祝福。
--   - streak はこのテーブルからは減算しない (streak は answer_logs から日次再計算)。

-- ---- 1. study_sessions テーブル新設 -------------------------------------
CREATE TABLE IF NOT EXISTS `study_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `session_date` text NOT NULL,
  `client_session_id` text NOT NULL,
  `duration_minutes` integer,
  `started_at` integer DEFAULT (unixepoch()) NOT NULL,
  `ended_at` integer,
  `cumulative_seconds` integer DEFAULT 0 NOT NULL,
  `end_reason` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`learner_id`) REFERENCES `learner_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);

-- ---- 2. UNIQUE インデックス (learner_id, client_session_id) ---------------
-- startOrResumeStudySession の冪等性: 同 URL session UUID で再 INSERT を防止
CREATE UNIQUE INDEX IF NOT EXISTS `study_sessions_learner_client_session_idx`
  ON `study_sessions` (`learner_id`, `client_session_id`);

-- ---- 3. 検索インデックス (learner_id, session_date) ---------------------
-- 「今日の累計」 SUM(cumulative_seconds) を 1 query で取得する経路
CREATE INDEX IF NOT EXISTS `study_sessions_learner_date_idx`
  ON `study_sessions` (`learner_id`, `session_date`);
