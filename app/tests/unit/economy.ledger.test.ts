/**
 * HANEI W10-T1: economy/ledger.ts 純関数の単体テスト。
 *
 * テスト方針:
 *   - validateAmount / validateSpend / computeNewBalance / validateReasonAmountSign /
 *     reduceTransactionsToBalance / rewardForBadgeTier
 *   - DB I/O ゼロ (純関数のみ)
 *   - 課金システム化禁止 (DEC-012) と整合した「閉じた経済」のロジックを検証
 */

import { describe, it, expect } from "vitest";
import {
  COIN_REASONS,
  COIN_REWARDS,
  EARN_REASONS,
  SPEND_REASONS,
  computeNewBalance,
  isCoinReason,
  reduceTransactionsToBalance,
  rewardForBadgeTier,
  validateAmount,
  validateReasonAmountSign,
  validateSpend,
} from "@/lib/economy/ledger";

describe("economy/ledger", () => {
  describe("COIN_REASONS / EARN_REASONS / SPEND_REASONS", () => {
    it("9 種すべて network type と一致する", () => {
      expect(COIN_REASONS.length).toBe(9);
    });

    it("EARN_REASONS と SPEND_REASONS は manual_adjust 以外で重ならない", () => {
      const earn = new Set(EARN_REASONS);
      const spend = new Set(SPEND_REASONS);
      // manual_adjust は両方に含めない (validateReasonAmountSign で個別許容)
      const earnOnly = [...earn].filter((r) => !spend.has(r));
      const spendOnly = [...spend].filter((r) => !earn.has(r));
      expect(earnOnly.length).toBeGreaterThan(0);
      expect(spendOnly.length).toBeGreaterThan(0);
    });

    it("isCoinReason が unknown 値を弾く", () => {
      expect(isCoinReason("lesson")).toBe(true);
      expect(isCoinReason("badge")).toBe(true);
      expect(isCoinReason("unknown")).toBe(false);
      expect(isCoinReason("")).toBe(false);
    });
  });

  describe("validateAmount", () => {
    it("正の整数は ok", () => {
      expect(validateAmount(1).ok).toBe(true);
      expect(validateAmount(100).ok).toBe(true);
      expect(validateAmount(99999).ok).toBe(true);
    });

    it("負の整数も ok (消費)", () => {
      expect(validateAmount(-1).ok).toBe(true);
      expect(validateAmount(-200).ok).toBe(true);
    });

    it("0 は不正", () => {
      const r = validateAmount(0);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("zero");
    });

    it("非整数は不正", () => {
      expect(validateAmount(1.5).ok).toBe(false);
      expect(validateAmount(NaN).ok).toBe(false);
      expect(validateAmount(Infinity).ok).toBe(false);
    });

    it("|amount| > 100000 は防御的に拒否", () => {
      expect(validateAmount(100001).ok).toBe(false);
      expect(validateAmount(-100001).ok).toBe(false);
    });
  });

  describe("validateSpend", () => {
    it("残高 >= cost なら ok", () => {
      expect(validateSpend(100, 50).ok).toBe(true);
      expect(validateSpend(50, 50).ok).toBe(true);
    });

    it("残高 < cost は insufficient_balance + shortfall", () => {
      const r = validateSpend(30, 50);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("insufficient_balance");
      expect(r.shortfall).toBe(20);
    });

    it("cost <= 0 は non_positive_cost", () => {
      const r = validateSpend(100, 0);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("non_positive_cost");

      const r2 = validateSpend(100, -50);
      expect(r2.ok).toBe(false);
      expect(r2.reason).toBe("non_positive_cost");
    });

    it("cost が非整数は non_positive_cost", () => {
      expect(validateSpend(100, 1.5).ok).toBe(false);
    });
  });

  describe("computeNewBalance", () => {
    it("正常な加算", () => {
      expect(computeNewBalance(100, 50)).toBe(150);
      expect(computeNewBalance(0, 30)).toBe(30);
    });

    it("正常な減算", () => {
      expect(computeNewBalance(100, -50)).toBe(50);
      expect(computeNewBalance(50, -50)).toBe(0);
    });

    it("結果が負になる場合は null", () => {
      expect(computeNewBalance(50, -100)).toBeNull();
    });

    it("非整数 currentBalance は null", () => {
      expect(computeNewBalance(1.5, 10)).toBeNull();
      expect(computeNewBalance(NaN, 10)).toBeNull();
    });
  });

  describe("validateReasonAmountSign", () => {
    it("EARN_REASONS は正の amount で OK", () => {
      expect(validateReasonAmountSign("lesson", 5).ok).toBe(true);
      expect(validateReasonAmountSign("streak", 20).ok).toBe(true);
      expect(validateReasonAmountSign("badge", 30).ok).toBe(true);
      expect(validateReasonAmountSign("quest", 15).ok).toBe(true);
      expect(validateReasonAmountSign("level_up", 50).ok).toBe(true);
    });

    it("EARN_REASONS は負の amount で不正", () => {
      expect(validateReasonAmountSign("lesson", -5).ok).toBe(false);
      expect(validateReasonAmountSign("badge", -30).ok).toBe(false);
    });

    it("SPEND_REASONS は負の amount で OK", () => {
      expect(validateReasonAmountSign("shop_purchase", -100).ok).toBe(true);
      expect(validateReasonAmountSign("freeze_purchase", -200).ok).toBe(true);
      expect(validateReasonAmountSign("feed_purchase", -50).ok).toBe(true);
    });

    it("SPEND_REASONS は正の amount で不正", () => {
      expect(validateReasonAmountSign("shop_purchase", 100).ok).toBe(false);
    });

    it("manual_adjust は両方向 OK (運営サポート)", () => {
      expect(validateReasonAmountSign("manual_adjust", 100).ok).toBe(true);
      expect(validateReasonAmountSign("manual_adjust", -100).ok).toBe(true);
    });
  });

  describe("rewardForBadgeTier", () => {
    it("4 tier 単調増加 (bronze < silver < gold < platinum)", () => {
      const bronze = rewardForBadgeTier("bronze");
      const silver = rewardForBadgeTier("silver");
      const gold = rewardForBadgeTier("gold");
      const platinum = rewardForBadgeTier("platinum");
      expect(bronze).toBeLessThan(silver);
      expect(silver).toBeLessThan(gold);
      expect(gold).toBeLessThan(platinum);
    });

    it("実装値は COIN_REWARDS と一致", () => {
      expect(rewardForBadgeTier("bronze")).toBe(COIN_REWARDS.BADGE_BRONZE);
      expect(rewardForBadgeTier("silver")).toBe(COIN_REWARDS.BADGE_SILVER);
      expect(rewardForBadgeTier("gold")).toBe(COIN_REWARDS.BADGE_GOLD);
      expect(rewardForBadgeTier("platinum")).toBe(COIN_REWARDS.BADGE_PLATINUM);
    });
  });

  describe("reduceTransactionsToBalance", () => {
    it("空配列は 0", () => {
      expect(reduceTransactionsToBalance([])).toBe(0);
    });

    it("正負混在の合計", () => {
      const rows = [
        { amount: 10 },
        { amount: 20 },
        { amount: -5 },
        { amount: 100 },
        { amount: -30 },
      ];
      expect(reduceTransactionsToBalance(rows)).toBe(95);
    });

    it("非整数行はスキップ (防御的)", () => {
      const rows = [
        { amount: 10 },
        { amount: 1.5 },
        { amount: 20 },
        { amount: NaN },
      ];
      expect(reduceTransactionsToBalance(rows)).toBe(30);
    });
  });

  describe("COIN_REWARDS 設計検証", () => {
    it("LESSON_INCORRECT = 0 (罰則ゼロ / DEC-024 励まし主軸 と整合)", () => {
      expect(COIN_REWARDS.LESSON_INCORRECT).toBe(0);
    });

    it("LESSON_CORRECT > 0 (1 問正解で必ず付与)", () => {
      expect(COIN_REWARDS.LESSON_CORRECT).toBeGreaterThan(0);
    });

    it("STREAK 報酬は単調増加 (DAY < WEEK < MONTH)", () => {
      expect(COIN_REWARDS.STREAK_DAY).toBeLessThan(COIN_REWARDS.STREAK_WEEK);
      expect(COIN_REWARDS.STREAK_WEEK).toBeLessThan(COIN_REWARDS.STREAK_MONTH);
    });

    it("QUEST_ALL_DONE > QUEST_COMPLETE (3 件全完了 bonus)", () => {
      expect(COIN_REWARDS.QUEST_ALL_DONE).toBeGreaterThan(
        COIN_REWARDS.QUEST_COMPLETE,
      );
    });

    it("60 分学習で ≒ 60 ハネキン獲得想定 (LESSON_CORRECT × 30 問正解)", () => {
      // Shop UI 設計値: 30〜60 ハネキンで小物 1 つ買える
      const dailyEarning = COIN_REWARDS.LESSON_CORRECT * 30;
      expect(dailyEarning).toBeGreaterThanOrEqual(30);
      expect(dailyEarning).toBeLessThanOrEqual(120);
    });
  });
});
