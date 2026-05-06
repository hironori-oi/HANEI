/**
 * reset-learner-study-data-tables.test.ts (DEC-090 項目 4 / mutation 10/10 最終枠)
 *
 * 検証ポイント:
 *  1. 削除対象 table 数 = 15 (DEC-090 仕様)
 *  2. 保持対象 table 数 = 8 (メタ + 親コンテンツ + family)
 *  3. 削除と保持に重複 0 (mutual exclusivity)
 *  4. 削除対象に「学習履歴系」が網羅される (answerLogs / srsStates / xpLevels / streaks / userBadges)
 *  5. 保持対象に「メタ情報」が含まれる (learnerProfiles / examDates / parentMessages /
 *     families [familyStreakDays 含む])
 *  6. 罰則ゼロ哲学 (DEC-024) - キーに罰語ゼロ
 *
 * 注: server action 本体 (resetLearnerStudyData) の三層認可ガード / 冪等性 / fail-soft 動作は
 *     E2E テスト (Playwright reset E2E spec) でカバーする方針 (lib/actions/learner-preferences と同じ運用).
 */

import { describe, it, expect } from "vitest";

import {
  RESET_DELETE_TABLE_NAMES_CANONICAL,
  RESET_KEEP_TABLE_NAMES_CANONICAL,
  RESET_DELETE_TABLE_COUNT,
  RESET_KEEP_TABLE_COUNT,
} from "@/lib/study/reset-learner-study-data-tables";

describe("reset-learner-study-data-tables (DEC-090 項目 4)", () => {
  describe("table 数", () => {
    it("削除対象は 15 table (DEC-090 仕様)", () => {
      expect(RESET_DELETE_TABLE_NAMES_CANONICAL.length).toBe(15);
      expect(RESET_DELETE_TABLE_COUNT).toBe(15);
    });

    it("保持対象は 8 table", () => {
      expect(RESET_KEEP_TABLE_NAMES_CANONICAL.length).toBe(8);
      expect(RESET_KEEP_TABLE_COUNT).toBe(8);
    });
  });

  describe("構造的不変条件", () => {
    it("削除と保持に重複は 0 (mutual exclusivity)", () => {
      const deleteSet = new Set(RESET_DELETE_TABLE_NAMES_CANONICAL);
      const keepSet = new Set(RESET_KEEP_TABLE_NAMES_CANONICAL);
      const intersection = [...deleteSet].filter((name) => keepSet.has(name));
      expect(intersection).toEqual([]);
    });

    it("削除対象に重複 table 名は無い", () => {
      const set = new Set(RESET_DELETE_TABLE_NAMES_CANONICAL);
      expect(set.size).toBe(RESET_DELETE_TABLE_NAMES_CANONICAL.length);
    });

    it("保持対象に重複 table 名は無い", () => {
      const set = new Set(RESET_KEEP_TABLE_NAMES_CANONICAL);
      expect(set.size).toBe(RESET_KEEP_TABLE_NAMES_CANONICAL.length);
    });
  });

  describe("削除対象の網羅性 (学習履歴系)", () => {
    const REQUIRED_DELETES = [
      "answerLogs", // 解答履歴
      "srsStates", // SRS スケジュール
      "xpLevels", // XP / レベル
      "streaks", // 個人 streak
      "userBadges", // バッジ獲得履歴
      "characters", // ことだまトリ mood
      "coinTransactions", // ハネキン履歴
      "learnerInventory", // ハネキンショップアイテム
      "learnerAccessories", // 装備状態
      "dailyPlans", // 学習プラン
      "dailyQuests", // 日次クエスト
      "studySessions", // 学習セッション
      "mockExamResults", // 模試結果
      "masteryEstimates", // BKT mastery
      "aiCoachConversations", // AI コーチ会話 (cascade で aiCoachMessages も削除)
    ];

    for (const name of REQUIRED_DELETES) {
      it(`削除対象に ${name} が含まれる`, () => {
        expect(RESET_DELETE_TABLE_NAMES_CANONICAL).toContain(name);
      });
    }
  });

  describe("保持対象の網羅性 (メタ + 親コンテンツ + family)", () => {
    const REQUIRED_KEEPS = [
      "learnerProfiles", // nickname / examDate / targetEikenLevel / dailyMinutesTarget meta
      "learnerSettings", // 通知 / リマインド
      "learnerStudyTargets", // 学習目標
      "examDates", // 受験日履歴 (親が登録した meta)
      "parentMessages", // 親が書いたメッセージ (親コンテンツ)
      "families", // family 単位 (familyStreakDays 含む / 兄弟救済 / DEC-024)
      "familyMembers", // 親-子 link
      "users", // 認証 / better-auth
    ];

    for (const name of REQUIRED_KEEPS) {
      it(`保持対象に ${name} が含まれる`, () => {
        expect(RESET_KEEP_TABLE_NAMES_CANONICAL).toContain(name);
      });
    }
  });

  describe("罰則ゼロ哲学 (DEC-024) - 用語チェック", () => {
    const FORBIDDEN_WORDS = ["delete", "destroy", "wipe", "kill", "purge"];

    it("削除対象 table 名に英語の罰語は含まれない (中立用語のみ)", () => {
      // table 名は schema 由来のため強制力は弱いが、もし将来的に
      // "destroyedRecords" 等が混入したら検知する.
      for (const name of RESET_DELETE_TABLE_NAMES_CANONICAL) {
        const lower = name.toLowerCase();
        for (const forbidden of FORBIDDEN_WORDS) {
          expect(lower).not.toContain(forbidden);
        }
      }
    });
  });
});
