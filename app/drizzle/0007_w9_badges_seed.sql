-- HANEI W9-C = badges seed (8 種) + tier 列追加
-- Source: src/lib/badges/badge-codes.ts (ALL_BADGE_CODES) + catalog.ts (BADGE_CATALOG)
-- Target: Turso / libSQL (SQLite)
-- Idempotent: ALTER TABLE は CREATE OR ROW 重複を防ぐため try/catch ベース不可だが、
-- libSQL では同名カラムの ALTER ADD は失敗する。再実行時は無視前提で上書き運用。
-- (drizzle migration runner は applied_at を別管理しているため、本ファイルは初回のみ実行される)

-- =========================================================================
-- 1. badges.tier 列を追加 (rarity / 演出強度)
--    "bronze" | "silver" | "gold" | "platinum"
--    既存行は backfill で "bronze" 固定 → 直後の UPSERT で正しい tier に更新する。
-- =========================================================================
ALTER TABLE `badges` ADD COLUMN `tier` text NOT NULL DEFAULT 'bronze';

-- =========================================================================
-- 2. 8 種 badges を UPSERT (code unique)
--    code は ALL_BADGE_CODES と完全一致 (badge-codes.ts と同期)。
--    icon_name は Heroicons fallback。本体表示は components/badges/icons/* を使用。
-- =========================================================================

INSERT INTO `badges` (`id`, `code`, `name`, `description`, `icon_name`, `tier`, `criteria_json`)
VALUES
  ('bg_first_flight', 'first_flight',
    '初飛行',
    'はじめての 解答を 完了しました。ここから 旅が はじまります。',
    'PaperAirplaneIcon', 'bronze',
    '{"type":"answer_count","threshold":1}')
ON CONFLICT(`code`) DO UPDATE SET
  `name`=excluded.name,
  `description`=excluded.description,
  `icon_name`=excluded.icon_name,
  `tier`=excluded.tier,
  `criteria_json`=excluded.criteria_json;

INSERT INTO `badges` (`id`, `code`, `name`, `description`, `icon_name`, `tier`, `criteria_json`)
VALUES
  ('bg_streak_keeper', 'streak_keeper',
    '連続学習者',
    '7 日 つづけて 学習しました。リズムが できてきています。',
    'FireIcon', 'silver',
    '{"type":"streak","threshold":7}')
ON CONFLICT(`code`) DO UPDATE SET
  `name`=excluded.name,
  `description`=excluded.description,
  `icon_name`=excluded.icon_name,
  `tier`=excluded.tier,
  `criteria_json`=excluded.criteria_json;

INSERT INTO `badges` (`id`, `code`, `name`, `description`, `icon_name`, `tier`, `criteria_json`)
VALUES
  ('bg_vocab_master', 'vocab_master',
    '語彙マスター',
    '5 級の 語彙を 100 問 正解しました。語彙力の つばさを 手に 入れました。',
    'BookOpenIcon', 'silver',
    '{"type":"skill_mastery","skill":"vocabulary","threshold":100}')
ON CONFLICT(`code`) DO UPDATE SET
  `name`=excluded.name,
  `description`=excluded.description,
  `icon_name`=excluded.icon_name,
  `tier`=excluded.tier,
  `criteria_json`=excluded.criteria_json;

INSERT INTO `badges` (`id`, `code`, `name`, `description`, `icon_name`, `tier`, `criteria_json`)
VALUES
  ('bg_grammar_master', 'grammar_master',
    '文法マスター',
    '文法を 100 問 正解しました。英語の しくみが 見えてきました。',
    'PencilSquareIcon', 'silver',
    '{"type":"skill_mastery","skill":"grammar","threshold":100}')
ON CONFLICT(`code`) DO UPDATE SET
  `name`=excluded.name,
  `description`=excluded.description,
  `icon_name`=excluded.icon_name,
  `tier`=excluded.tier,
  `criteria_json`=excluded.criteria_json;

INSERT INTO `badges` (`id`, `code`, `name`, `description`, `icon_name`, `tier`, `criteria_json`)
VALUES
  ('bg_reading_master', 'reading_master',
    '読解マスター',
    '読解を 50 問 正解しました。長文を 読みとく 力が ついています。',
    'BookmarkIcon', 'gold',
    '{"type":"skill_mastery","skill":"reading","threshold":50}')
ON CONFLICT(`code`) DO UPDATE SET
  `name`=excluded.name,
  `description`=excluded.description,
  `icon_name`=excluded.icon_name,
  `tier`=excluded.tier,
  `criteria_json`=excluded.criteria_json;

INSERT INTO `badges` (`id`, `code`, `name`, `description`, `icon_name`, `tier`, `criteria_json`)
VALUES
  ('bg_listening_master', 'listening_master',
    'リスニングマスター',
    'リスニングを 50 問 正解しました。耳が 英語に なじんできました。',
    'SpeakerWaveIcon', 'gold',
    '{"type":"skill_mastery","skill":"listening","threshold":50}')
ON CONFLICT(`code`) DO UPDATE SET
  `name`=excluded.name,
  `description`=excluded.description,
  `icon_name`=excluded.icon_name,
  `tier`=excluded.tier,
  `criteria_json`=excluded.criteria_json;

INSERT INTO `badges` (`id`, `code`, `name`, `description`, `icon_name`, `tier`, `criteria_json`)
VALUES
  ('bg_first_mock_exam', 'first_mock_exam',
    '受験者',
    'はじめての 模試を 完了しました。本番への 道が ひらけました。',
    'AcademicCapIcon', 'gold',
    '{"type":"mock_exam_count","threshold":1}')
ON CONFLICT(`code`) DO UPDATE SET
  `name`=excluded.name,
  `description`=excluded.description,
  `icon_name`=excluded.icon_name,
  `tier`=excluded.tier,
  `criteria_json`=excluded.criteria_json;

INSERT INTO `badges` (`id`, `code`, `name`, `description`, `icon_name`, `tier`, `criteria_json`)
VALUES
  ('bg_sakura_keeper', 'sakura_keeper',
    '桜守',
    '30 日 つづけて 学習しました。桜並木の 守り手と なりました。',
    'SparklesIcon', 'platinum',
    '{"type":"streak","threshold":30}')
ON CONFLICT(`code`) DO UPDATE SET
  `name`=excluded.name,
  `description`=excluded.description,
  `icon_name`=excluded.icon_name,
  `tier`=excluded.tier,
  `criteria_json`=excluded.criteria_json;
