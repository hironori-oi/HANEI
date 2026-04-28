-- HANEI W8-T5 = learner_profiles.daily_goal_xp
-- Source: src/lib/db/schema.ts (learnerProfiles)
-- Target: Turso / libSQL (SQLite)
--
-- W8-T5: 自己選択日次ゴール
--   4 段階: 10 (軽い) / 20 (ふつう) / 30 (がんばる) / 50 (本気)
--   default 20 = 「ふつう」 (10 分目安)
--   学習者本人 or 保護者が settings 画面から変更可。
--
-- SDT Autonomy 充足の主軸 (Locke & Latham 1990 / Duolingo retention 主軸)。

ALTER TABLE `learner_profiles`
  ADD COLUMN `daily_goal_xp` integer NOT NULL DEFAULT 20;
