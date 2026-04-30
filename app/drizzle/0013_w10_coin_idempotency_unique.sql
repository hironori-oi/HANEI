-- HANEI W10-T4 = coin_transactions 冪等チェック partial UNIQUE INDEX
-- Source: review-w10-t3-daily-quest.md M-2 / DEC-055 補強
-- Target: Turso / libSQL (SQLite)
--
-- 目的:
--   DEC-055 で謳っていた「(learner_id, reason, reference_id) で同一付与の冪等性」を
--   アプリ層 SELECT + INSERT のみに頼らず、DB 層の partial UNIQUE INDEX で
--   構造的に二重 INSERT を不可能にする。
--
--   Phase 1 では SQLite の serialized writes により実用上ゼロ近傍の race だが、
--   将来 Turso 本番 / 複数 region 投入時にレイテンシ増で window が広がる懸念を
--   この index で構造的に閉じる。
--
-- 不変条件:
--   - reference_id IS NULL の行 (memo 系 / manual_adjust 等) は重複してもよい
--     → partial INDEX (WHERE reference_id IS NOT NULL) で除外
--   - reference_id IS NOT NULL の行は (learner_id, reason, reference_id) で 1 行のみ
--
-- 既存挿入経路への影響:
--   - awardCoins (idempotent=true): 事前 SELECT → INSERT。dup なら index で同じ行を
--     INSERT しようとした場合に SQLITE_CONSTRAINT_UNIQUE が発生するが、
--     アプリ層の hasReceivedFor で先に skipped へ倒すので発生しない。
--   - claimQuestReward: 事前 SELECT → INSERT。同じく dup は事前検出で回避。
--   - all_done bonus: 同様。
--   - shop の freeze / feed 購入: referenceId 付き UUID で実質一意 → 重複しない。
--   - lesson / streak / level_up 等: 既存ロジックでも (reason, referenceId) で日次冪等
--     してきており新たな衝突は発生しない。
--
-- 罰則ゼロ哲学 (DEC-024) / 課金システム化禁止 (DEC-012) は維持。

CREATE UNIQUE INDEX IF NOT EXISTS `coin_transactions_idempotency_unique_idx`
  ON `coin_transactions` (`learner_id`, `reason`, `reference_id`)
  WHERE `reference_id` IS NOT NULL;
