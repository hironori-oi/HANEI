/**
 * Unit: lib/study/session-composer (W10-T4)
 *
 * 検証範囲:
 *  - composeStudySession の決定論性 / planSize 範囲 / ratio sum = planSize
 *  - getSessionCopy / SESSION_DURATION_OPTIONS / isSessionDurationMinutes
 *  - hasReachedOvertime + SESSION_OVERTIME_RATIO
 *  - summarizeSession (純関数 / clamp 含む)
 *  - readLastSessionDurationFromStorage / writeLastSessionDurationToStorage (localStorage helper)
 *  - getPlanVariantsFor の table 整合 (review+fresh+weakness == planSize)
 *
 * 制約:
 *  - DB / Date Mock 不要 (純関数のみ)
 *  - ≥ 20 cases / 罰則ゼロ哲学にあわせて文言検査も含む
 */

import { describe, it, expect } from "vitest";

import {
  SESSION_DURATION_OPTIONS,
  SESSION_OVERTIME_RATIO,
  LAST_SESSION_DURATION_STORAGE_KEY,
  composeStudySession,
  getPlanVariantsFor,
  getSessionCopy,
  hasReachedOvertime,
  isSessionDurationMinutes,
  readLastSessionDurationFromStorage,
  summarizeSession,
  writeLastSessionDurationToStorage,
  type SessionDurationMinutes,
} from "@/lib/study/session-composer";

// ---------------------------------------------------------------------------
// In-memory localStorage stub (vitest jsdom 不要 / unit 軽量化)
// ---------------------------------------------------------------------------

function makeMemoryStorage(): Storage & { _map: Map<string, string> } {
  const map = new Map<string, string>();
  const storage = {
    _map: map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage & { _map: Map<string, string> };
  return storage;
}

// ---------------------------------------------------------------------------
// Constants / type guards
// ---------------------------------------------------------------------------

describe("session-composer / constants", () => {
  it("SESSION_DURATION_OPTIONS は 5/7/10 の 3 択", () => {
    expect(SESSION_DURATION_OPTIONS).toEqual([5, 7, 10]);
  });

  it("isSessionDurationMinutes は 5/7/10 のみ true", () => {
    expect(isSessionDurationMinutes(5)).toBe(true);
    expect(isSessionDurationMinutes(7)).toBe(true);
    expect(isSessionDurationMinutes(10)).toBe(true);
    expect(isSessionDurationMinutes(0)).toBe(false);
    expect(isSessionDurationMinutes(6)).toBe(false);
    expect(isSessionDurationMinutes("5")).toBe(false);
    expect(isSessionDurationMinutes(null)).toBe(false);
    expect(isSessionDurationMinutes(undefined)).toBe(false);
    expect(isSessionDurationMinutes({})).toBe(false);
  });

  it("SESSION_OVERTIME_RATIO は 0.5 (= +50%)", () => {
    expect(SESSION_OVERTIME_RATIO).toBe(0.5);
  });

  it("LAST_SESSION_DURATION_STORAGE_KEY は安定 (snapshot)", () => {
    expect(LAST_SESSION_DURATION_STORAGE_KEY).toBe(
      "hanei.session.lastDurationMin",
    );
  });
});

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

describe("session-composer / getSessionCopy", () => {
  it("各 duration ごとに一意のコピーを返す (DEC-024 罰則ゼロ整合 / 否定形なし)", () => {
    const c5 = getSessionCopy(5);
    const c7 = getSessionCopy(7);
    const c10 = getSessionCopy(10);
    expect(c5.subtext).toContain("ちょっとだけ");
    expect(c7.subtext).toContain("ちょうどいい");
    expect(c10.subtext).toContain("しっかり");
    // 否定形検査
    for (const c of [c5, c7, c10]) {
      expect(c.subtext).not.toMatch(/(ない|だめ|失敗|やめろ)/);
      expect(c.headline).toMatch(/[0-9]/); // 数字半角
    }
  });
});

// ---------------------------------------------------------------------------
// Plan variants table (合計 = planSize 不変条件)
// ---------------------------------------------------------------------------

describe("session-composer / getPlanVariantsFor", () => {
  it.each(SESSION_DURATION_OPTIONS)(
    "%i 分 variant の review+fresh+weakness == planSize",
    (d) => {
      const variants = getPlanVariantsFor(d);
      expect(variants.length).toBeGreaterThan(0);
      for (const v of variants) {
        expect(v.ratio.review + v.ratio.fresh + v.ratio.weakness).toBe(
          v.planSize,
        );
        expect(v.planSize).toBeGreaterThan(0);
        expect(v.ratio.review).toBeGreaterThan(0);
        expect(v.ratio.fresh).toBeGreaterThan(0);
        expect(v.ratio.weakness).toBeGreaterThan(0);
      }
    },
  );

  it("5 分は 5〜8 問 / 7 分は 8〜12 問 / 10 分は 12〜18 問の範囲", () => {
    const sizes5 = getPlanVariantsFor(5).map((v) => v.planSize);
    const sizes7 = getPlanVariantsFor(7).map((v) => v.planSize);
    const sizes10 = getPlanVariantsFor(10).map((v) => v.planSize);
    expect(Math.min(...sizes5)).toBe(5);
    expect(Math.max(...sizes5)).toBe(8);
    expect(Math.min(...sizes7)).toBe(8);
    expect(Math.max(...sizes7)).toBe(12);
    expect(Math.min(...sizes10)).toBe(12);
    expect(Math.max(...sizes10)).toBe(18);
  });
});

// ---------------------------------------------------------------------------
// composeStudySession - determinism / 範囲 / 合計
// ---------------------------------------------------------------------------

describe("session-composer / composeStudySession", () => {
  const fixedNow = new Date(2026, 3, 30, 9, 0, 0); // 2026-04-30 09:00 (local)

  it("同 (learnerId, duration, day) で同じ planSize / ratio を返す (決定論性)", () => {
    const a = composeStudySession({
      learnerId: "L-1",
      durationMinutes: 7,
      now: fixedNow,
    });
    const b = composeStudySession({
      learnerId: "L-1",
      durationMinutes: 7,
      now: fixedNow,
    });
    expect(a).toEqual(b);
  });

  it("learnerId 違いで variant が異なりうる (異 seed → 異 variant の存在)", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 30; i += 1) {
      const c = composeStudySession({
        learnerId: `L-${i}`,
        durationMinutes: 10,
        now: fixedNow,
      });
      seen.add(c.planSize);
    }
    // 10 分は 7 variant あるので 30 名で 2 種類以上は出るはず
    expect(seen.size).toBeGreaterThan(1);
  });

  it("planSize == ratio.review + ratio.fresh + ratio.weakness (不変条件)", () => {
    for (const d of SESSION_DURATION_OPTIONS) {
      const c = composeStudySession({
        learnerId: "L-A",
        durationMinutes: d,
        now: fixedNow,
      });
      expect(c.planSize).toBe(c.ratio.review + c.ratio.fresh + c.ratio.weakness);
    }
  });

  it.each([
    [5 as SessionDurationMinutes, 5, 8],
    [7 as SessionDurationMinutes, 8, 12],
    [10 as SessionDurationMinutes, 12, 18],
  ])(
    "duration=%i 分 → planSize は [%i, %i] 範囲内",
    (d, lo, hi) => {
      for (let i = 0; i < 50; i += 1) {
        const c = composeStudySession({
          learnerId: `r-${i}`,
          durationMinutes: d,
          now: fixedNow,
        });
        expect(c.planSize).toBeGreaterThanOrEqual(lo);
        expect(c.planSize).toBeLessThanOrEqual(hi);
      }
    },
  );

  it("overtimeThresholdSeconds = duration*60*1.5", () => {
    const c5 = composeStudySession({
      learnerId: "L",
      durationMinutes: 5,
      now: fixedNow,
    });
    expect(c5.overtimeThresholdSeconds).toBe(450);
    const c7 = composeStudySession({
      learnerId: "L",
      durationMinutes: 7,
      now: fixedNow,
    });
    expect(c7.overtimeThresholdSeconds).toBe(630);
    const c10 = composeStudySession({
      learnerId: "L",
      durationMinutes: 10,
      now: fixedNow,
    });
    expect(c10.overtimeThresholdSeconds).toBe(900);
  });

  it("learnerId が空文字 / 不正 duration の場合は TypeError を投げる (防御的バリデーション)", () => {
    expect(() =>
      composeStudySession({
        learnerId: "",
        durationMinutes: 5,
        now: fixedNow,
      }),
    ).toThrow(TypeError);
    expect(() =>
      composeStudySession({
        learnerId: "L",
        durationMinutes: 6 as unknown as SessionDurationMinutes,
        now: fixedNow,
      }),
    ).toThrow(TypeError);
  });

  it("now を省略しても結果が型整合 (planSize > 0)", () => {
    const c = composeStudySession({
      learnerId: "L-now",
      durationMinutes: 5,
    });
    expect(c.planSize).toBeGreaterThan(0);
    expect(c.copy.headline).toBeTypeOf("string");
  });

  it("日付が異なれば variant が異なりうる (飽き防止)", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 30; i += 1) {
      const day = new Date(2026, 3, i + 1, 9, 0, 0);
      const c = composeStudySession({
        learnerId: "Lconst",
        durationMinutes: 10,
        now: day,
      });
      seen.add(c.planSize);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// hasReachedOvertime
// ---------------------------------------------------------------------------

describe("session-composer / hasReachedOvertime", () => {
  it("経過時間 < 1.5x の時は false", () => {
    expect(hasReachedOvertime(5, 0)).toBe(false);
    expect(hasReachedOvertime(5, 449)).toBe(false);
    expect(hasReachedOvertime(7, 629)).toBe(false);
    expect(hasReachedOvertime(10, 899)).toBe(false);
  });

  it("経過時間 >= 1.5x で true", () => {
    expect(hasReachedOvertime(5, 450)).toBe(true);
    expect(hasReachedOvertime(7, 630)).toBe(true);
    expect(hasReachedOvertime(10, 900)).toBe(true);
    expect(hasReachedOvertime(5, 9999)).toBe(true);
  });

  it("負数 / NaN / Infinity は false (防御的)", () => {
    expect(hasReachedOvertime(5, -1)).toBe(false);
    expect(hasReachedOvertime(5, NaN)).toBe(false);
    expect(hasReachedOvertime(5, Infinity)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// summarizeSession
// ---------------------------------------------------------------------------

describe("session-composer / summarizeSession", () => {
  it("空配列は accuracy 0%", () => {
    const s = summarizeSession([]);
    expect(s).toEqual({
      problemsAnswered: 0,
      correctCount: 0,
      accuracyPercent: 0,
      earnedCoins: 0,
    });
  });

  it("正答率 / coin 集計が正しい", () => {
    const s = summarizeSession(
      [
        { correct: true },
        { correct: true },
        { correct: false },
        { correct: true },
      ],
      6,
    );
    expect(s.problemsAnswered).toBe(4);
    expect(s.correctCount).toBe(3);
    expect(s.accuracyPercent).toBe(75);
    expect(s.earnedCoins).toBe(6);
  });

  it("accuracy は 0-100 の範囲に clamp", () => {
    const s = summarizeSession([{ correct: true }, { correct: true }]);
    expect(s.accuracyPercent).toBeGreaterThanOrEqual(0);
    expect(s.accuracyPercent).toBeLessThanOrEqual(100);
  });

  it("earnedCoins が負数の場合は 0 に clamp / 小数は floor", () => {
    expect(summarizeSession([], -10).earnedCoins).toBe(0);
    expect(summarizeSession([], 7.9).earnedCoins).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

describe("session-composer / last-duration storage helpers", () => {
  it("storage が null/undefined でも throw しない", () => {
    expect(readLastSessionDurationFromStorage(null)).toBeNull();
    expect(readLastSessionDurationFromStorage(undefined)).toBeNull();
    // setter も同様に no-op
    expect(() => writeLastSessionDurationToStorage(null, 5)).not.toThrow();
    expect(() =>
      writeLastSessionDurationToStorage(undefined, 5),
    ).not.toThrow();
  });

  it("正しい値を読み書きできる", () => {
    const s = makeMemoryStorage();
    expect(readLastSessionDurationFromStorage(s)).toBeNull();
    writeLastSessionDurationToStorage(s, 7);
    expect(s._map.get(LAST_SESSION_DURATION_STORAGE_KEY)).toBe("7");
    expect(readLastSessionDurationFromStorage(s)).toBe(7);
  });

  it("不正値 (異常値 / 数字以外) が入っていたら null を返す", () => {
    const s = makeMemoryStorage();
    s.setItem(LAST_SESSION_DURATION_STORAGE_KEY, "abc");
    expect(readLastSessionDurationFromStorage(s)).toBeNull();
    s.setItem(LAST_SESSION_DURATION_STORAGE_KEY, "6");
    expect(readLastSessionDurationFromStorage(s)).toBeNull();
    s.setItem(LAST_SESSION_DURATION_STORAGE_KEY, "999");
    expect(readLastSessionDurationFromStorage(s)).toBeNull();
  });

  it("write は 5/7/10 以外を受け取ると no-op", () => {
    const s = makeMemoryStorage();
    writeLastSessionDurationToStorage(s, 6 as unknown as SessionDurationMinutes);
    expect(s._map.size).toBe(0);
  });

  it("write が throw しても silent fail (catch される)", () => {
    const throwingStorage: Pick<Storage, "setItem"> = {
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    expect(() =>
      writeLastSessionDurationToStorage(throwingStorage, 5),
    ).not.toThrow();
  });
});
