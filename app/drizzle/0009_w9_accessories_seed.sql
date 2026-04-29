-- HANEI W9-B = accessories seed (12 種)
-- Source: src/lib/accessories/catalog.ts (ACCESSORY_CATALOG)
-- Target: Turso / libSQL (SQLite)
-- Idempotent: ON CONFLICT(code) DO UPDATE で再実行に強い。

-- =========================================================================
-- 12 種 accessories を UPSERT (code unique)
-- code は ACCESSORY_CODES と完全一致 (catalog.ts と同期)。
-- 3 スロット (hat / scarf / wing_charm) × 4 = 12 種。
-- =========================================================================

-- ---- HAT (帽子) ---------------------------------------------------------
INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_hat_school_cap', 'hat_school_cap', 'hat',
    '学帽', 'level', '5',
    'レベル 5 で受け取れる、ぴかぴかの学びの帽子。', 1)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_hat_sakura_crown', 'hat_sakura_crown', 'hat',
    '桜花冠', 'streak', '7',
    '7 日連続で学んだ証。桜の花を編んだ冠。', 2)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_hat_eiken_pass', 'hat_eiken_pass', 'hat',
    '受験合格鉢巻', 'badge', 'first_mock_exam',
    '模試デビューで巻ける、勝利祈願の鉢巻。', 3)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_hat_guardian_crown', 'hat_guardian_crown', 'hat',
    '守護神冠', 'xp', '5000',
    '5000 XP の旅路で授かる、神々しい守護の冠。', 4)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

-- ---- SCARF (マフラー) --------------------------------------------------
INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_scarf_red', 'scarf_red', 'scarf',
    '赤マフラー', 'level', '3',
    'レベル 3 で巻ける、勇気の赤マフラー。', 1)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_scarf_kasuri', 'scarf_kasuri', 'scarf',
    '紺絣マフラー', 'streak', '14',
    '14 日連続学習で授かる、藍染めの絣模様。', 2)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_scarf_sakura', 'scarf_sakura', 'scarf',
    '桜柄スカーフ', 'streak', '30',
    '30 日連続学習の桜守だけが纏える、満開の桜柄。', 3)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_scarf_kinran', 'scarf_kinran', 'scarf',
    '金襴マフラー', 'xp', '3000',
    '3000 XP で得られる、金糸織りの華やかなマフラー。', 4)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

-- ---- WING_CHARM (羽飾り) -----------------------------------------------
INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_wing_charm_bell', 'wing_charm_bell', 'wing_charm',
    '鈴', 'level', '1',
    'はじめてのプロフィール作成でもらえる、清らかな鈴。', 1)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_wing_charm_sakura', 'wing_charm_sakura', 'wing_charm',
    '桜花飾り', 'badge', 'sakura_keeper',
    '桜守バッジを得たことだまトリに咲く花飾り。', 2)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_wing_charm_torii', 'wing_charm_torii', 'wing_charm',
    '鳥居型お守り', 'streak', '21',
    '21 日連続学習で授かる、朱色の鳥居の御守り。', 3)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;

INSERT INTO `accessories`
  (`id`, `code`, `slot`, `name`, `unlock_type`, `unlock_value`, `description`, `display_order`)
VALUES
  ('ac_wing_charm_moonlight', 'wing_charm_moonlight', 'wing_charm',
    '月光ペンダント', 'xp', '10000',
    '10000 XP の頂で輝く、月光を宿したペンダント。', 4)
ON CONFLICT(`code`) DO UPDATE SET
  `slot`=excluded.slot,
  `name`=excluded.name,
  `unlock_type`=excluded.unlock_type,
  `unlock_value`=excluded.unlock_value,
  `description`=excluded.description,
  `display_order`=excluded.display_order;
