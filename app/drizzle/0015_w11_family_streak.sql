-- HANEI W11-T1 = Family 内 Streak (家族のれんぞく)
-- Source: src/lib/db/schema.ts (families)
-- Target: Turso / libSQL (SQLite)
--
-- 1. families.family_streak_days INTEGER NOT NULL DEFAULT 0
-- 2. families.last_family_active_date TEXT NULL ('YYYY-MM-DD' / JST 6:00 境界 quest_date)
--
-- 設計思想 (DEC-060 / phase2-gamification-implementation-plan.md §W11-T1):
--   - 同一 family の learner 全員が共通の Family Streak を持つ.
--   - 1 人でも当日学習すれば家族 Streak 維持 (兄弟がいる家庭の救済).
--   - 既存 learner_streaks (W7) は一切触らない. 新規 2 列追加のみ.
--
-- JST 6:00 境界整合 (DEC-024 / quest 整合):
--   - last_family_active_date は getJstQuestDate(now) と同形式の 'YYYY-MM-DD'.
--   - 0:00 ではなく 6:00 リフレッシュにより、夜更かし家庭の取り損ね事故を防ぐ.
--
-- 罰則ゼロ哲学 (DEC-024):
--   - family_streak が 0 / 切れた状態でも罰メッセージは出さない.
--   - 「またいつでも始められるよ」と前向きコピーで終わる.
--   - hard_limit (60 分) で session が終わっても family_streak は減らない.
--
-- 冪等性 (DEC-055):
--   - 同日 2 回目の updateFamilyStreakOnLearn は no-op.
--   - WHERE last_family_active_date IS DISTINCT FROM ? OR family_streak_days != ?
--     の atomic UPDATE で書き込み発生を構造的に防ぐ.

-- ---- 1. families.family_streak_days を追加 ------------------------------------
ALTER TABLE `families` ADD COLUMN `family_streak_days` INTEGER NOT NULL DEFAULT 0;

-- ---- 2. families.last_family_active_date を追加 -------------------------------
ALTER TABLE `families` ADD COLUMN `last_family_active_date` TEXT;
