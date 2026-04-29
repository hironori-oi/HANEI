/**
 * HANEI W10-T3: lib/quest/quest-generator.ts 純関数の単体テスト。
 *
 * 戦略:
 *   - mulberry32 / hashStringToUint32 が deterministic
 *   - generateDailyQuests が同 (learnerId, questDate) で同じ 3 件を返す
 *   - streak_keep を必ず含む
 *   - mock_warmup は Phase 1 では候補から除外される
 *   - 学習者が違えば結果が違う (生成の多様性)
 *
 * すべて純関数 (DB I/O ゼロ)。
 */

import { describe, it, expect } from "vitest";
import {
  buildQuestSeed,
  deterministicShuffle,
  generateDailyQuests,
  hashStringToUint32,
  mulberry32,
  pickTarget,
} from "@/lib/quest/quest-generator";
import { COIN_REWARDS } from "@/lib/economy/ledger";
import { selectableTypes } from "@/lib/quest/quest-templates";

describe("quest/quest-generator", () => {
  describe("mulberry32", () => {
    it("同 seed なら同じ列を返す", () => {
      const a = mulberry32(12345);
      const b = mulberry32(12345);
      const seqA = [a(), a(), a(), a(), a()];
      const seqB = [b(), b(), b(), b(), b()];
      expect(seqA).toEqual(seqB);
    });

    it("戻り値は 0 <= x < 1", () => {
      const r = mulberry32(7777);
      for (let i = 0; i < 100; i += 1) {
        const v = r();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe("hashStringToUint32", () => {
    it("同じ文字列は同じ hash を返す", () => {
      expect(hashStringToUint32("hello")).toBe(hashStringToUint32("hello"));
      expect(hashStringToUint32("learnerA|2026-04-30")).toBe(
        hashStringToUint32("learnerA|2026-04-30"),
      );
    });

    it("空文字も deterministic", () => {
      expect(hashStringToUint32("")).toBe(hashStringToUint32(""));
    });

    it("異なる文字列は通常異なる hash を返す (衝突率は十分低い)", () => {
      const a = hashStringToUint32("learner-a|2026-04-30");
      const b = hashStringToUint32("learner-b|2026-04-30");
      expect(a).not.toBe(b);
    });

    it("32-bit unsigned int 範囲 (0 <= x < 2^32)", () => {
      const v = hashStringToUint32("foo");
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(2 ** 32);
    });
  });

  describe("buildQuestSeed", () => {
    it("(learnerId, questDate) の組から deterministic な seed", () => {
      const s1 = buildQuestSeed("L1", "2026-04-30");
      const s2 = buildQuestSeed("L1", "2026-04-30");
      expect(s1).toBe(s2);
    });

    it("学習者が違えば seed も違う", () => {
      const s1 = buildQuestSeed("L1", "2026-04-30");
      const s2 = buildQuestSeed("L2", "2026-04-30");
      expect(s1).not.toBe(s2);
    });

    it("日付が違えば seed も違う", () => {
      const s1 = buildQuestSeed("L1", "2026-04-30");
      const s2 = buildQuestSeed("L1", "2026-05-01");
      expect(s1).not.toBe(s2);
    });
  });

  describe("deterministicShuffle", () => {
    it("同 seed なら同じ並び", () => {
      const arr = [1, 2, 3, 4, 5, 6];
      const r1 = mulberry32(42);
      const r2 = mulberry32(42);
      expect(deterministicShuffle(arr, r1)).toEqual(deterministicShuffle(arr, r2));
    });

    it("入力配列を破壊しない", () => {
      const arr = [1, 2, 3, 4, 5];
      const before = [...arr];
      deterministicShuffle(arr, mulberry32(1));
      expect(arr).toEqual(before);
    });

    it("結果は元配列と同じ要素群 (順だけ違う)", () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = deterministicShuffle(arr, mulberry32(99));
      expect(shuffled.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("pickTarget", () => {
    it("配列から 1 つ deterministic に pick", () => {
      const r1 = mulberry32(1234);
      const r2 = mulberry32(1234);
      expect(pickTarget([3, 5, 7], r1)).toBe(pickTarget([3, 5, 7], r2));
    });

    it("空配列なら 1 (defensive)", () => {
      expect(pickTarget([], mulberry32(1))).toBe(1);
    });
  });

  describe("generateDailyQuests", () => {
    it("同 (learnerId, questDate) で何度呼んでも同じ 3 件", () => {
      const a = generateDailyQuests({
        learnerId: "L1",
        questDate: "2026-04-30",
      });
      const b = generateDailyQuests({
        learnerId: "L1",
        questDate: "2026-04-30",
      });
      expect(a).toEqual(b);
      expect(a.length).toBe(3);
    });

    it("count = 3 が既定 (3 件返る)", () => {
      const a = generateDailyQuests({
        learnerId: "L1",
        questDate: "2026-04-30",
      });
      expect(a.length).toBe(3);
    });

    it("streak_keep を必ず含む", () => {
      const a = generateDailyQuests({
        learnerId: "L1",
        questDate: "2026-04-30",
      });
      expect(a.some((q) => q.questType === "streak_keep")).toBe(true);
    });

    it("mock_warmup は Phase 1 では絶対に含まれない", () => {
      // 多様な seed を 50 回試して mock_warmup が出ないことを確認
      for (let i = 0; i < 50; i += 1) {
        const a = generateDailyQuests({
          learnerId: `learner_${i}`,
          questDate: "2026-04-30",
        });
        for (const q of a) {
          expect(q.questType).not.toBe("mock_warmup");
        }
      }
    });

    it("学習者が違えば 3 件の組み合わせが (基本的には) 違う", () => {
      const a = generateDailyQuests({
        learnerId: "L_alpha",
        questDate: "2026-04-30",
      });
      const b = generateDailyQuests({
        learnerId: "L_beta_diff",
        questDate: "2026-04-30",
      });
      // streak_keep + 2 件 を pool 5 種から抽選 → 完全一致は (5C2 = 10) 回に 1 回
      // ただし「完全一致しない or target 値が違う」を確認する側面で OK
      const sameTypes = a.map((q) => q.questType).every(
        (t, i) => t === b[i]?.questType,
      );
      const sameTargets = a.every((q, i) => q.target === b[i]?.target);
      expect(sameTypes && sameTargets).toBe(false);
    });

    it("rewardCoins は QUEST_COMPLETE 規定値と一致", () => {
      const a = generateDailyQuests({
        learnerId: "L1",
        questDate: "2026-04-30",
      });
      for (const q of a) {
        expect(q.rewardCoins).toBe(COIN_REWARDS.QUEST_COMPLETE);
      }
    });

    it("title に target が埋め込まれている (streak_keep 以外は数字を含む)", () => {
      const a = generateDailyQuests({
        learnerId: "L1",
        questDate: "2026-04-30",
      });
      for (const q of a) {
        if (q.questType === "streak_keep") continue;
        expect(q.title).toMatch(/[0-9]+/);
      }
    });

    it("learnerId / questDate が空なら空配列", () => {
      expect(
        generateDailyQuests({ learnerId: "", questDate: "2026-04-30" }),
      ).toEqual([]);
      expect(generateDailyQuests({ learnerId: "L1", questDate: "" })).toEqual([]);
    });

    it("count を変えても deterministic (同 input なら同結果)", () => {
      const a = generateDailyQuests({
        learnerId: "L1",
        questDate: "2026-04-30",
        count: 2,
      });
      const b = generateDailyQuests({
        learnerId: "L1",
        questDate: "2026-04-30",
        count: 2,
      });
      expect(a).toEqual(b);
      expect(a.length).toBe(2);
    });

    it("選ばれる quest_type は selectableTypes() に含まれる種類のみ", () => {
      const allowed = new Set(selectableTypes());
      for (let i = 0; i < 30; i += 1) {
        const a = generateDailyQuests({
          learnerId: `L_${i}`,
          questDate: "2026-04-30",
        });
        for (const q of a) {
          expect(allowed.has(q.questType)).toBe(true);
        }
      }
    });

    it("3 件の questType は重複しない (非復元抽選)", () => {
      for (let i = 0; i < 30; i += 1) {
        const a = generateDailyQuests({
          learnerId: `L_${i}`,
          questDate: "2026-04-30",
        });
        const types = a.map((q) => q.questType);
        expect(new Set(types).size).toBe(types.length);
      }
    });
  });
});
