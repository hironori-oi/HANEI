/**
 * study.kotodama-tori.test.ts (W5 / G-5)
 *
 * pickMood 純関数 + computeRunningStreak 純関数のユニットテスト。
 *
 * pickMood は (lastResult, streakBeforeAnswer) → KotodamaMood の写像。
 * computeRunningStreak は answer_logs 末尾の連続正解数を返す。
 */

import { describe, it, expect } from "vitest";
import { pickMood } from "@/components/study/kotodama-tori-mood";
import { computeRunningStreak } from "@/lib/study/streak";

describe("pickMood()", () => {
  it("解答前 (lastResult=null) は thinking", () => {
    expect(pickMood(null, 0)).toBe("thinking");
    expect(pickMood(null, 5)).toBe("thinking");
  });

  it("直前正解 + streak < 3 は cheerful", () => {
    expect(pickMood("correct", 0)).toBe("cheerful");
    expect(pickMood("correct", 1)).toBe("cheerful");
    expect(pickMood("correct", 2)).toBe("cheerful");
  });

  it("直前正解 + streak >= 3 は celebrating", () => {
    expect(pickMood("correct", 3)).toBe("celebrating");
    expect(pickMood("correct", 7)).toBe("celebrating");
  });

  it("直前不正解 + streak < 3 は encouraging", () => {
    // streakBeforeAnswer は今回の解答時点の running streak (= 0 if just wrong)。
    // brief の規約で「直前不正解」のときは encouraging。
    expect(pickMood("wrong", 0)).toBe("encouraging");
    expect(pickMood("wrong", 2)).toBe("encouraging");
  });

  it("直前不正解 + streak >= 3 は sad (連勝が途切れた瞬間の落胆)", () => {
    // 直前まで 3 連勝以上 → 不正解 = sad
    expect(pickMood("wrong", 3)).toBe("sad");
    expect(pickMood("wrong", 10)).toBe("sad");
  });
});

describe("computeRunningStreak()", () => {
  it("ログが空なら 0", () => {
    expect(computeRunningStreak([])).toBe(0);
  });

  it("最新が不正解なら 0", () => {
    expect(
      computeRunningStreak([
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: true },
      ]),
    ).toBe(0);
  });

  it("末尾から連続して正解の数を返す", () => {
    // 配列は新しい順 (desc) で渡される想定
    expect(
      computeRunningStreak([
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
      ]),
    ).toBe(3);
  });

  it("全て正解なら長さを返す", () => {
    expect(
      computeRunningStreak([
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
      ]),
    ).toBe(4);
  });
});
