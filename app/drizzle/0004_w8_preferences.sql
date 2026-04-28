-- HANEI W8 = learner_profiles.preferences (W8-T3 / W8-T4)
-- Source: src/lib/db/schema.ts (learnerProfiles)
-- Target: Turso / libSQL (SQLite)
--
-- W8-T3: soundEnabled (効果音 ON/OFF)
-- W8-T4: confettiEnabled (紙吹雪 ON/OFF)
--
-- 保護者が settings 画面から制御する。default は両方 true。

ALTER TABLE `learner_profiles`
  ADD COLUMN `preferences` text NOT NULL DEFAULT '{"soundEnabled":true,"confettiEnabled":true}';
