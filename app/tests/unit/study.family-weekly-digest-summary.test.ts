/**
 * Unit tests: src/lib/study/family-weekly-digest-summary.ts (W11-T5 / Weekly Digest 純関数)
 *
 * 純関数の不変条件 (DEC-024 罰則ゼロ哲学 / DEC-063):
 *   - selectTopSkills: answerCount 降順 / 同数タイ skillId 昇順安定 / limit default 3 / 0 件は空 / 非配列 throw / 負値 answerCount 受容
 *   - pickEncouragementCopy: 同一週 + 同一 familyId で同じ key (= 決定論性) / 全 8 件 catalog に罰語が無いこと
 *   - describeFamilyStreakSummary: 0 / 1 / 5 / 100 days × alive 真偽 全分岐 + 罰語不在
 *   - composeWeeklyDigestView: 全員 0 XP / 単独 / 0 名 / topSkills 5 件 → 3 件絞込 / streak 0 + alive=false / 罰語不在
 *   - ENCOURAGEMENT_COPIES catalog: 8 件存在 / 全件 copy 非空 / key unique / 罰語なし
 */

import { describe, expect, it } from "vitest";

import {
  composeWeeklyDigestView,
  describeFamilyStreakSummary,
  ENCOURAGEMENT_COPIES,
  pickEncouragementCopy,
  selectTopSkills,
  type DigestSkillRow,
  type FamilyWeeklyDigestInput,
} from "@/lib/study/family-weekly-digest-summary";

const PUNISHMENT_REGEX = /最下位|ペナルティ|サボ|だめ|もうダメ|失敗|やりすぎ|もう おそい|がんばってない/;

describe("ENCOURAGEMENT_COPIES catalog", () => {
  it("8 件存在", () => {
    expect(ENCOURAGEMENT_COPIES.length).toBe(8);
  });

  it("全件 copy 非空 + key unique", () => {
    for (const c of ENCOURAGEMENT_COPIES) {
      expect(typeof c.copy).toBe("string");
      expect(c.copy.length).toBeGreaterThan(0);
      expect(typeof c.key).toBe("string");
      expect(c.key.length).toBeGreaterThan(0);
    }
    const keys = ENCOURAGEMENT_COPIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("全 8 件の copy が罰語不在 (DEC-024 構造的保証)", () => {
    for (const c of ENCOURAGEMENT_COPIES) {
      expect(c.copy, `${c.key} に罰語が含まれてはいけない`).not.toMatch(
        PUNISHMENT_REGEX,
      );
    }
  });
});

describe("selectTopSkills", () => {
  const skills = (rows: ReadonlyArray<[string, string, number]>): DigestSkillRow[] =>
    rows.map(([skillId, displayName, answerCount]) => ({
      skillId,
      displayName,
      answerCount,
    }));

  it("0 件入力は空配列", () => {
    expect(selectTopSkills([])).toEqual([]);
  });

  it("1 件入力はその 1 件を返す", () => {
    const r = selectTopSkills(skills([["a", "A", 5]]));
    expect(r).toEqual([{ skillId: "a", displayName: "A", answerCount: 5 }]);
  });

  it("2 件入力は降順", () => {
    const r = selectTopSkills(skills([["a", "A", 1], ["b", "B", 5]]));
    expect(r.map((x) => x.skillId)).toEqual(["b", "a"]);
  });

  it("3 件入力は降順", () => {
    const r = selectTopSkills(skills([["a", "A", 1], ["b", "B", 5], ["c", "C", 3]]));
    expect(r.map((x) => x.skillId)).toEqual(["b", "c", "a"]);
  });

  it("4 件以上は default limit=3 で切る", () => {
    const r = selectTopSkills(
      skills([
        ["a", "A", 1],
        ["b", "B", 5],
        ["c", "C", 3],
        ["d", "D", 10],
        ["e", "E", 7],
      ]),
    );
    expect(r.length).toBe(3);
    expect(r.map((x) => x.skillId)).toEqual(["d", "e", "b"]);
  });

  it("同数タイは skillId 昇順で安定", () => {
    const r = selectTopSkills(
      skills([
        ["zzz", "ZZZ", 5],
        ["aaa", "AAA", 5],
        ["mmm", "MMM", 5],
      ]),
    );
    // 全部同数なので skillId 昇順
    expect(r.map((x) => x.skillId)).toEqual(["aaa", "mmm", "zzz"]);
  });

  it("非配列入力は TypeError", () => {
    // @ts-expect-error - 防御テスト
    expect(() => selectTopSkills(null)).toThrow(TypeError);
    // @ts-expect-error - 防御テスト
    expect(() => selectTopSkills(undefined)).toThrow(TypeError);
    // @ts-expect-error - 防御テスト
    expect(() => selectTopSkills("xxx")).toThrow(TypeError);
  });

  it("負値 answerCount は除外せず受容 (純関数は防御正規化しない)", () => {
    const r = selectTopSkills(skills([["a", "A", -3], ["b", "B", 1]]));
    // 負値は降順では b (1) が先、a (-3) が後
    expect(r.map((x) => x.skillId)).toEqual(["b", "a"]);
  });

  it("limit を明示指定で 1 件にする", () => {
    const r = selectTopSkills(
      skills([["a", "A", 1], ["b", "B", 5]]),
      1,
    );
    expect(r).toEqual([{ skillId: "b", displayName: "B", answerCount: 5 }]);
  });
});

describe("pickEncouragementCopy", () => {
  it("同一週 + 同一 familyId で同じ key を返す (決定論性)", () => {
    const week = new Date(Date.UTC(2026, 4, 1, 0, 0, 0));
    const a = pickEncouragementCopy(week, "fam_001");
    const b = pickEncouragementCopy(week, "fam_001");
    expect(a.key).toBe(b.key);
    expect(a.copy).toBe(b.copy);
  });

  it("異なる week では別 key の可能性 (= 少なくともいずれかのテスト week で別 key になる)", () => {
    // 8 件 catalog なので 9 週分試せば最低 1 つは別 index になる (鳩ノ巣)
    const baseFamily = "fam_test";
    const keys = new Set<string>();
    for (let w = 0; w < 9; w += 1) {
      const week = new Date(Date.UTC(2026, 0, 1 + w * 7, 0, 0, 0));
      keys.add(pickEncouragementCopy(week, baseFamily).key);
    }
    expect(keys.size).toBeGreaterThanOrEqual(2);
  });

  it("異なる familyId で別 key の可能性 (鳩ノ巣)", () => {
    const week = new Date(Date.UTC(2026, 4, 1, 0, 0, 0));
    const keys = new Set<string>();
    for (let i = 0; i < 16; i += 1) {
      keys.add(pickEncouragementCopy(week, `fam_${i}_${i * 7}`).key);
    }
    expect(keys.size).toBeGreaterThanOrEqual(2);
  });

  it("返り値の key は ENCOURAGEMENT_COPIES に必ず含まれる", () => {
    const week = new Date(Date.UTC(2026, 4, 1, 0, 0, 0));
    const validKeys = new Set(ENCOURAGEMENT_COPIES.map((c) => c.key));
    for (let i = 0; i < 32; i += 1) {
      const picked = pickEncouragementCopy(week, `family_id_${i}`);
      expect(validKeys.has(picked.key)).toBe(true);
    }
  });

  it("無効 Date / 非文字列 familyId は TypeError", () => {
    expect(() =>
      pickEncouragementCopy(new Date("invalid"), "fam"),
    ).toThrow(TypeError);
    // @ts-expect-error - 防御テスト
    expect(() => pickEncouragementCopy(new Date(), 123)).toThrow(TypeError);
  });
});

describe("describeFamilyStreakSummary", () => {
  it("days=0 → 「今週の つみあげを 始めよう」", () => {
    expect(describeFamilyStreakSummary(0, false)).toBe(
      "今週の つみあげを 始めよう",
    );
    expect(describeFamilyStreakSummary(0, true)).toBe(
      "今週の つみあげを 始めよう",
    );
  });

  it("days=1+alive=true → 「家族で 1 日 つながってるね」", () => {
    expect(describeFamilyStreakSummary(1, true)).toBe(
      "家族で 1 日 つながってるね",
    );
  });

  it("days=5+alive=true → 「家族で 5 日 つながってるね」", () => {
    expect(describeFamilyStreakSummary(5, true)).toBe(
      "家族で 5 日 つながってるね",
    );
  });

  it("days=5+alive=false → 「5 日 つながった あと、ひとやすみ。またいつでも 始められるよ」", () => {
    expect(describeFamilyStreakSummary(5, false)).toBe(
      "5 日 つながった あと、ひとやすみ。またいつでも 始められるよ",
    );
  });

  it("days=100+alive=true → 100 日反映", () => {
    expect(describeFamilyStreakSummary(100, true)).toBe(
      "家族で 100 日 つながってるね",
    );
  });

  it("負値・NaN は 0 として扱う", () => {
    expect(describeFamilyStreakSummary(-3, true)).toBe(
      "今週の つみあげを 始めよう",
    );
    expect(describeFamilyStreakSummary(Number.NaN, true)).toBe(
      "今週の つみあげを 始めよう",
    );
  });

  it("罰語不在 (全分岐網羅 grep)", () => {
    const cases: Array<[number, boolean]> = [
      [0, true],
      [0, false],
      [1, true],
      [1, false],
      [5, true],
      [5, false],
      [100, true],
      [100, false],
    ];
    for (const [d, a] of cases) {
      expect(describeFamilyStreakSummary(d, a)).not.toMatch(PUNISHMENT_REGEX);
    }
  });
});

describe("composeWeeklyDigestView", () => {
  const baseInput = (
    overrides: Partial<FamilyWeeklyDigestInput> = {},
  ): FamilyWeeklyDigestInput => ({
    familyId: "fam_compose_test",
    weekStartUtc: new Date(Date.UTC(2026, 4, 1, 0, 0, 0)),
    familyStreakDays: 3,
    familyStreakAlive: true,
    perLearnerWeeklyXp: [
      { learnerId: "lrn_a", nickname: "兄", weeklyXp: 50 },
      { learnerId: "lrn_b", nickname: "妹", weeklyXp: 30 },
    ],
    topSkills: [
      { skillId: "vocabulary-5", displayName: "5 級 語彙", answerCount: 10 },
      { skillId: "reading-5", displayName: "5 級 読解", answerCount: 5 },
    ],
    ...overrides,
  });

  it("通常入力: streak / leaderboard / topSkills / encouragement が組み立てられる", () => {
    const v = composeWeeklyDigestView(baseInput());
    expect(v.familyStreakDays).toBe(3);
    expect(v.familyStreakAlive).toBe(true);
    expect(v.familyStreakHeadline).toBe("家族で 3 日 つながってるね");
    expect(v.perLearnerXp.length).toBe(2);
    expect(v.topSkills.length).toBe(2);
    expect(v.encouragement.key).toBeTruthy();
    expect(v.encouragement.copy).toBeTruthy();
  });

  it("全員 0 XP でも構造的に罰メッセージなし (= headline + encouragement に罰語なし)", () => {
    const v = composeWeeklyDigestView(
      baseInput({
        familyStreakDays: 0,
        familyStreakAlive: false,
        perLearnerWeeklyXp: [
          { learnerId: "lrn_a", nickname: "兄", weeklyXp: 0 },
          { learnerId: "lrn_b", nickname: "妹", weeklyXp: 0 },
        ],
        topSkills: [],
      }),
    );
    expect(v.familyStreakHeadline).not.toMatch(PUNISHMENT_REGEX);
    expect(v.encouragement.copy).not.toMatch(PUNISHMENT_REGEX);
    expect(v.topSkills).toEqual([]);
  });

  it("単独 learner family", () => {
    const v = composeWeeklyDigestView(
      baseInput({
        perLearnerWeeklyXp: [
          { learnerId: "lrn_solo", nickname: "ひとりっ子", weeklyXp: 20 },
        ],
      }),
    );
    expect(v.perLearnerXp.length).toBe(1);
    expect(v.perLearnerXp[0]?.weeklyXp).toBe(20);
  });

  it("family メンバー 0 名 (新規家族 / leaderboard 空)", () => {
    const v = composeWeeklyDigestView(
      baseInput({ perLearnerWeeklyXp: [] }),
    );
    expect(v.perLearnerXp).toEqual([]);
  });

  it("topSkills 5 件 → 3 件に絞り込まれる (順序: count 降順)", () => {
    const v = composeWeeklyDigestView(
      baseInput({
        topSkills: [
          { skillId: "a", displayName: "A", answerCount: 1 },
          { skillId: "b", displayName: "B", answerCount: 5 },
          { skillId: "c", displayName: "C", answerCount: 3 },
          { skillId: "d", displayName: "D", answerCount: 10 },
          { skillId: "e", displayName: "E", answerCount: 7 },
        ],
      }),
    );
    expect(v.topSkills.length).toBe(3);
    expect(v.topSkills.map((s) => s.skillId)).toEqual(["d", "e", "b"]);
  });

  it("streak 0 + alive=false でも前向きコピー", () => {
    const v = composeWeeklyDigestView(
      baseInput({ familyStreakDays: 0, familyStreakAlive: false }),
    );
    expect(v.familyStreakDays).toBe(0);
    expect(v.familyStreakAlive).toBe(false);
    expect(v.familyStreakHeadline).toBe("今週の つみあげを 始めよう");
  });

  it("非 object 入力は TypeError", () => {
    // @ts-expect-error - 防御テスト
    expect(() => composeWeeklyDigestView(null)).toThrow(TypeError);
  });

  it("perLearnerWeeklyXp の並びは そのまま伝搬 (leaderboard rank 順を尊重)", () => {
    const v = composeWeeklyDigestView(
      baseInput({
        perLearnerWeeklyXp: [
          { learnerId: "first", nickname: "一番", weeklyXp: 80 },
          { learnerId: "second", nickname: "二番", weeklyXp: 50 },
          { learnerId: "third", nickname: "三番", weeklyXp: 10 },
        ],
      }),
    );
    expect(v.perLearnerXp.map((p) => p.learnerId)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});
