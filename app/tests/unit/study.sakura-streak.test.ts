/**
 * study.sakura-streak.test.ts (W8-T6)
 *
 * pickSakuraStage / describeSakuraStage の境界値テスト。
 *
 * 段階定義:
 *   0-1 日:    seed
 *   2-6 日:    sprout
 *   7-13 日:   leaves
 *   14-29 日:  bud
 *   30-89 日:  bloom
 *   90-179 日: fullbloom
 *   180+ 日:   grove
 */

import { describe, it, expect } from "vitest";

import {
  pickSakuraStage,
  describeSakuraStage,
  getAllSakuraStages,
} from "@/lib/study/sakura-streak";

describe("pickSakuraStage()", () => {
  it("負値は seed (UI 側で「まだはじまっていません」表記)", () => {
    expect(pickSakuraStage(-1)).toBe("seed");
    expect(pickSakuraStage(-100)).toBe("seed");
  });

  it("NaN / Infinity は seed (非有限値は安全側に倒す)", () => {
    expect(pickSakuraStage(NaN)).toBe("seed");
    expect(pickSakuraStage(Infinity)).toBe("seed");
  });

  it("0 / 1 日は seed (たね)", () => {
    expect(pickSakuraStage(0)).toBe("seed");
    expect(pickSakuraStage(1)).toBe("seed");
  });

  it("2-6 日は sprout (め)", () => {
    expect(pickSakuraStage(2)).toBe("sprout");
    expect(pickSakuraStage(3)).toBe("sprout");
    expect(pickSakuraStage(6)).toBe("sprout");
  });

  it("7-13 日は leaves (わかば)", () => {
    expect(pickSakuraStage(7)).toBe("leaves");
    expect(pickSakuraStage(10)).toBe("leaves");
    expect(pickSakuraStage(13)).toBe("leaves");
  });

  it("14-29 日は bud (つぼみ)", () => {
    expect(pickSakuraStage(14)).toBe("bud");
    expect(pickSakuraStage(20)).toBe("bud");
    expect(pickSakuraStage(29)).toBe("bud");
  });

  it("30-89 日は bloom (かいか)", () => {
    expect(pickSakuraStage(30)).toBe("bloom");
    expect(pickSakuraStage(60)).toBe("bloom");
    expect(pickSakuraStage(89)).toBe("bloom");
  });

  it("90-179 日は fullbloom (まんかい)", () => {
    expect(pickSakuraStage(90)).toBe("fullbloom");
    expect(pickSakuraStage(150)).toBe("fullbloom");
    expect(pickSakuraStage(179)).toBe("fullbloom");
  });

  it("180+ 日は grove (さくらなみき)", () => {
    expect(pickSakuraStage(180)).toBe("grove");
    expect(pickSakuraStage(365)).toBe("grove");
    expect(pickSakuraStage(1000)).toBe("grove");
  });

  it("段階境界の一貫性: 1→seed / 2→sprout (生育の最初の visual 変化)", () => {
    expect(pickSakuraStage(1)).toBe("seed");
    expect(pickSakuraStage(2)).toBe("sprout");
  });

  it("段階境界の一貫性: 6→sprout / 7→leaves (1 週間)", () => {
    expect(pickSakuraStage(6)).toBe("sprout");
    expect(pickSakuraStage(7)).toBe("leaves");
  });

  it("段階境界の一貫性: 13→leaves / 14→bud (2 週間)", () => {
    expect(pickSakuraStage(13)).toBe("leaves");
    expect(pickSakuraStage(14)).toBe("bud");
  });

  it("段階境界の一貫性: 29→bud / 30→bloom (1 ヶ月)", () => {
    expect(pickSakuraStage(29)).toBe("bud");
    expect(pickSakuraStage(30)).toBe("bloom");
  });

  it("段階境界の一貫性: 89→bloom / 90→fullbloom (3 ヶ月)", () => {
    expect(pickSakuraStage(89)).toBe("bloom");
    expect(pickSakuraStage(90)).toBe("fullbloom");
  });

  it("段階境界の一貫性: 179→fullbloom / 180→grove (半年)", () => {
    expect(pickSakuraStage(179)).toBe("fullbloom");
    expect(pickSakuraStage(180)).toBe("grove");
  });

  it("小数は floor で丸められる", () => {
    expect(pickSakuraStage(6.9)).toBe("sprout");
    expect(pickSakuraStage(7.1)).toBe("leaves");
  });
});

describe("describeSakuraStage()", () => {
  it("0 日は seed / 次は 2 日後 sprout", () => {
    const info = describeSakuraStage(0);
    expect(info.stage).toBe("seed");
    expect(info.label).toBe("たね");
    expect(info.nextStage).toBe("sprout");
    expect(info.nextStageInDays).toBe(2);
  });

  it("5 日 = sprout / 次は 2 日後 leaves", () => {
    const info = describeSakuraStage(5);
    expect(info.stage).toBe("sprout");
    expect(info.nextStage).toBe("leaves");
    expect(info.nextStageInDays).toBe(2);
  });

  it("89 日 = bloom / 次は 1 日後 fullbloom", () => {
    const info = describeSakuraStage(89);
    expect(info.stage).toBe("bloom");
    expect(info.nextStage).toBe("fullbloom");
    expect(info.nextStageInDays).toBe(1);
  });

  it("180+ 日 = grove (最終段階) / nextStage は null", () => {
    const info = describeSakuraStage(200);
    expect(info.stage).toBe("grove");
    expect(info.nextStage).toBeNull();
    expect(info.nextStageInDays).toBeNull();
  });

  it("description は 「ですます調 / 絵文字なし」を維持", () => {
    for (const s of getAllSakuraStages()) {
      const info = describeSakuraStage(
        s === "seed"
          ? 0
          : s === "sprout"
            ? 3
            : s === "leaves"
              ? 8
              : s === "bud"
                ? 15
                : s === "bloom"
                  ? 35
                  : s === "fullbloom"
                    ? 100
                    : 200,
      );
      // ですます調 = ます/です/ましょう のいずれかで終わるか含む
      expect(info.description).toMatch(/ます|です|ましょう/);
      // 絵文字 (Emoji presentation) を含まない
      expect(info.description).not.toMatch(/[\p{Extended_Pictographic}]/u);
    }
  });
});

describe("getAllSakuraStages()", () => {
  it("7 段階を順序通りに返す", () => {
    expect(getAllSakuraStages()).toEqual([
      "seed",
      "sprout",
      "leaves",
      "bud",
      "bloom",
      "fullbloom",
      "grove",
    ]);
  });
});
