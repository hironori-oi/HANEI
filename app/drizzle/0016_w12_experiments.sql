-- HANEI W12-T2 = A/B test 基盤 (DEC-066)
-- learner_profiles.experiments JSON column 追加 (cohort 割当永続化)
-- shape: { [experimentKey]: variantKey } 例: { "streak_freeze_monthly_grant": "variant_a" }
-- default '{}' で既存行に影響なし (NOT NULL は default 経由)
ALTER TABLE `learner_profiles` ADD COLUMN `experiments` TEXT NOT NULL DEFAULT '{}';
