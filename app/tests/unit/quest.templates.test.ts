/**
 * HANEI W10-T3: lib/quest/quest-templates.ts 純関数の単体テスト。
 *
 * 戦略:
 *   - QUEST_TEMPLATES の整合性 (target candidates 範囲 / reward = QUEST_COMPLETE)
 *   - selectableTypes() は mock_warmup を除外
 *   - shouldIncrementForAnswer の各 trigger ロジック
 */

import { describe, it, expect } from "vitest";
import {
  ALL_QUEST_TYPES,
  QUEST_TEMPLATES,
  isQuestType,
  renderQuestTitle,
  selectableTypes,
  shouldIncrementForAnswer,
} from "@/lib/quest/quest-templates";
import { COIN_REWARDS } from "@/lib/economy/ledger";

describe("quest/quest-templates", () => {
  describe("ALL_QUEST_TYPES", () => {
    it("Phase 1 で定義された 7 種", () => {
      expect(ALL_QUEST_TYPES.length).toBe(7);
    });

    it("isQuestType は正規 7 種のみ true", () => {
      for (const t of ALL_QUEST_TYPES) {
        expect(isQuestType(t)).toBe(true);
      }
      expect(isQuestType("unknown")).toBe(false);
      expect(isQuestType("")).toBe(false);
      expect(isQuestType(null)).toBe(false);
    });
  });

  describe("QUEST_TEMPLATES 整合性", () => {
    it("各 type に definition がある", () => {
      for (const t of ALL_QUEST_TYPES) {
        expect(QUEST_TEMPLATES[t]).toBeDefined();
        expect(QUEST_TEMPLATES[t].type).toBe(t);
      }
    });

    it("rewardCoins は QUEST_COMPLETE と一致", () => {
      for (const t of ALL_QUEST_TYPES) {
        expect(QUEST_TEMPLATES[t].rewardCoins).toBe(COIN_REWARDS.QUEST_COMPLETE);
      }
    });

    it("targetCandidates は 1 つ以上で全て正の整数", () => {
      for (const t of ALL_QUEST_TYPES) {
        const tpl = QUEST_TEMPLATES[t];
        expect(tpl.targetCandidates.length).toBeGreaterThan(0);
        for (const v of tpl.targetCandidates) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThan(0);
        }
      }
    });

    it("titleTemplate に {target} 埋め込み (streak_keep / mock_warmup 以外)", () => {
      // streak_keep は target=1 固定なので埋め込みなしでも成立
      const optional: ReadonlyArray<string> = ["streak_keep", "mock_warmup"];
      for (const t of ALL_QUEST_TYPES) {
        if (optional.includes(t)) continue;
        expect(QUEST_TEMPLATES[t].titleTemplate).toContain("{target}");
      }
    });
  });

  describe("selectableTypes", () => {
    it("mock_warmup を除外する", () => {
      expect(selectableTypes()).not.toContain("mock_warmup");
    });

    it("Phase 1 では 6 種が選択可能", () => {
      expect(selectableTypes().length).toBe(6);
    });
  });

  describe("renderQuestTitle", () => {
    it("{target} を実数に置換", () => {
      const t = renderQuestTitle("vocab_count", 5);
      expect(t).toContain("5");
      expect(t).not.toContain("{target}");
    });

    it("{target} を含まないテンプレでもそのまま返す", () => {
      const t = renderQuestTitle("streak_keep", 1);
      expect(t).not.toContain("{target}");
    });
  });

  describe("shouldIncrementForAnswer", () => {
    it("vocab_count: skill=vocabulary かつ 正解で true", () => {
      expect(
        shouldIncrementForAnswer("vocab_count", {
          skill: "vocabulary",
          isCorrect: true,
        }),
      ).toBe(true);
    });

    it("vocab_count: 不正解では false", () => {
      expect(
        shouldIncrementForAnswer("vocab_count", {
          skill: "vocabulary",
          isCorrect: false,
        }),
      ).toBe(false);
    });

    it("vocab_count: 別 skill (grammar) では false", () => {
      expect(
        shouldIncrementForAnswer("vocab_count", {
          skill: "grammar",
          isCorrect: true,
        }),
      ).toBe(false);
    });

    it("listening_perfect: skill=listening かつ 正解で true", () => {
      expect(
        shouldIncrementForAnswer("listening_perfect", {
          skill: "listening",
          isCorrect: true,
        }),
      ).toBe(true);
      expect(
        shouldIncrementForAnswer("listening_perfect", {
          skill: "listening",
          isCorrect: false,
        }),
      ).toBe(false);
    });

    it("reading_count: skill=reading なら正誤を問わず true", () => {
      expect(
        shouldIncrementForAnswer("reading_count", {
          skill: "reading",
          isCorrect: false,
        }),
      ).toBe(true);
      expect(
        shouldIncrementForAnswer("reading_count", {
          skill: "reading",
          isCorrect: true,
        }),
      ).toBe(true);
    });

    it("writing_count: skill=writing なら正誤を問わず true", () => {
      expect(
        shouldIncrementForAnswer("writing_count", {
          skill: "writing",
          isCorrect: false,
        }),
      ).toBe(true);
    });

    it("streak_keep: skill 問わず true (1 問でも解いた瞬間カウント)", () => {
      expect(
        shouldIncrementForAnswer("streak_keep", {
          skill: "grammar",
          isCorrect: false,
        }),
      ).toBe(true);
      expect(
        shouldIncrementForAnswer("streak_keep", {
          skill: "writing",
          isCorrect: true,
        }),
      ).toBe(true);
    });

    it("badge_progress: skill=vocabulary かつ 正解で true (汎用)", () => {
      expect(
        shouldIncrementForAnswer("badge_progress", {
          skill: "vocabulary",
          isCorrect: true,
        }),
      ).toBe(true);
      expect(
        shouldIncrementForAnswer("badge_progress", {
          skill: "vocabulary",
          isCorrect: false,
        }),
      ).toBe(false);
    });

    it("mock_warmup: submitAnswer 経路では常に false", () => {
      for (const skill of [
        "vocabulary",
        "grammar",
        "listening",
        "reading",
        "writing",
      ] as const) {
        for (const c of [true, false]) {
          expect(
            shouldIncrementForAnswer("mock_warmup", {
              skill,
              isCorrect: c,
            }),
          ).toBe(false);
        }
      }
    });
  });
});
