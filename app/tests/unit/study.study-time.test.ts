/**
 * Unit tests: src/lib/study/study-time.ts (W10-T5 過学習防止)
 *
 * 純関数の不変条件 (DEC-024 罰則ゼロ哲学整合):
 *   - hasReachedOverlearningNudge: 30 分閾値の判定
 *   - hasReachedOverlearningHardLimit: 60 分閾値の判定
 *   - clampHeartbeatDeltaSeconds: 1 回 60 秒上限
 *   - clampSessionCumulativeSeconds: 1 セッション 4 時間上限
 *   - todayMinutesFromSeconds: floor(s/60) (端数切り捨て)
 *   - describeTodayMinutes: tone 切替 (neutral/warm/celebrate)
 *   - sanitizePreferredSessionMinutes: 5/7/10/null のみ
 */

import { describe, expect, it } from "vitest";

import {
  HEARTBEAT_MAX_DELTA_SECONDS,
  OVERLEARNING_HARD_LIMIT_SECONDS,
  OVERLEARNING_NUDGE_THRESHOLD_SECONDS,
  SESSION_CUMULATIVE_HARD_CAP_SECONDS,
  clampHeartbeatDeltaSeconds,
  clampSessionCumulativeSeconds,
  describeTodayMinutes,
  hasReachedOverlearningHardLimit,
  hasReachedOverlearningNudge,
  sanitizePreferredSessionMinutes,
  todayMinutesFromSeconds,
} from "@/lib/study/study-time";

describe("study-time / 閾値定数", () => {
  it("nudge は 30 分 / hard_limit は 60 分", () => {
    expect(OVERLEARNING_NUDGE_THRESHOLD_SECONDS).toBe(30 * 60);
    expect(OVERLEARNING_HARD_LIMIT_SECONDS).toBe(60 * 60);
  });
  it("heartbeat 上限 60 秒 / session 上限 4 時間", () => {
    expect(HEARTBEAT_MAX_DELTA_SECONDS).toBe(60);
    expect(SESSION_CUMULATIVE_HARD_CAP_SECONDS).toBe(4 * 60 * 60);
  });
});

describe("hasReachedOverlearningNudge", () => {
  it("30 分未満は false", () => {
    expect(hasReachedOverlearningNudge(0)).toBe(false);
    expect(hasReachedOverlearningNudge(60)).toBe(false);
    expect(hasReachedOverlearningNudge(29 * 60)).toBe(false);
    expect(hasReachedOverlearningNudge(30 * 60 - 1)).toBe(false);
  });
  it("30 分ぴったりで true (>= 境界)", () => {
    expect(hasReachedOverlearningNudge(30 * 60)).toBe(true);
  });
  it("30 分超過で true", () => {
    expect(hasReachedOverlearningNudge(45 * 60)).toBe(true);
    expect(hasReachedOverlearningNudge(59 * 60)).toBe(true);
    expect(hasReachedOverlearningNudge(60 * 60)).toBe(true);
  });
  it("負値 / NaN / Infinity は false (UI 早期 trigger 防止)", () => {
    expect(hasReachedOverlearningNudge(-1)).toBe(false);
    expect(hasReachedOverlearningNudge(NaN)).toBe(false);
    expect(hasReachedOverlearningNudge(Infinity)).toBe(false);
  });
});

describe("hasReachedOverlearningHardLimit", () => {
  it("60 分未満は false (nudge 圏内も含む)", () => {
    expect(hasReachedOverlearningHardLimit(0)).toBe(false);
    expect(hasReachedOverlearningHardLimit(30 * 60)).toBe(false);
    expect(hasReachedOverlearningHardLimit(59 * 60)).toBe(false);
    expect(hasReachedOverlearningHardLimit(60 * 60 - 1)).toBe(false);
  });
  it("60 分ぴったりで true (>= 境界)", () => {
    expect(hasReachedOverlearningHardLimit(60 * 60)).toBe(true);
  });
  it("60 分超過で true", () => {
    expect(hasReachedOverlearningHardLimit(90 * 60)).toBe(true);
    expect(hasReachedOverlearningHardLimit(180 * 60)).toBe(true);
  });
  it("負値 / NaN / Infinity は false", () => {
    expect(hasReachedOverlearningHardLimit(-1)).toBe(false);
    expect(hasReachedOverlearningHardLimit(NaN)).toBe(false);
    expect(hasReachedOverlearningHardLimit(Infinity)).toBe(false);
  });
});

describe("clampHeartbeatDeltaSeconds", () => {
  it("0..60 にクランプ (整数化)", () => {
    expect(clampHeartbeatDeltaSeconds(0)).toBe(0);
    expect(clampHeartbeatDeltaSeconds(1)).toBe(1);
    expect(clampHeartbeatDeltaSeconds(10)).toBe(10);
    expect(clampHeartbeatDeltaSeconds(60)).toBe(60);
    expect(clampHeartbeatDeltaSeconds(61)).toBe(60);
    expect(clampHeartbeatDeltaSeconds(3600)).toBe(60);
  });
  it("小数は floor (12.9 → 12)", () => {
    expect(clampHeartbeatDeltaSeconds(12.9)).toBe(12);
    expect(clampHeartbeatDeltaSeconds(0.5)).toBe(0);
  });
  it("負値 / NaN / Infinity は 0", () => {
    expect(clampHeartbeatDeltaSeconds(-1)).toBe(0);
    expect(clampHeartbeatDeltaSeconds(-100)).toBe(0);
    expect(clampHeartbeatDeltaSeconds(NaN)).toBe(0);
    expect(clampHeartbeatDeltaSeconds(Infinity)).toBe(0);
    expect(clampHeartbeatDeltaSeconds(-Infinity)).toBe(0);
  });
});

describe("clampSessionCumulativeSeconds", () => {
  it("0..14400 (4 時間) にクランプ", () => {
    expect(clampSessionCumulativeSeconds(0)).toBe(0);
    expect(clampSessionCumulativeSeconds(60)).toBe(60);
    expect(clampSessionCumulativeSeconds(4 * 60 * 60)).toBe(4 * 60 * 60);
    expect(clampSessionCumulativeSeconds(4 * 60 * 60 + 1)).toBe(4 * 60 * 60);
    expect(clampSessionCumulativeSeconds(86400)).toBe(4 * 60 * 60);
  });
  it("負値 / NaN / Infinity は 0", () => {
    expect(clampSessionCumulativeSeconds(-1)).toBe(0);
    expect(clampSessionCumulativeSeconds(NaN)).toBe(0);
    expect(clampSessionCumulativeSeconds(Infinity)).toBe(0);
  });
});

describe("todayMinutesFromSeconds", () => {
  it("floor(s/60)", () => {
    expect(todayMinutesFromSeconds(0)).toBe(0);
    expect(todayMinutesFromSeconds(59)).toBe(0);
    expect(todayMinutesFromSeconds(60)).toBe(1);
    expect(todayMinutesFromSeconds(119)).toBe(1);
    expect(todayMinutesFromSeconds(120)).toBe(2);
    expect(todayMinutesFromSeconds(30 * 60)).toBe(30);
    expect(todayMinutesFromSeconds(60 * 60)).toBe(60);
  });
  it("負値 / NaN / Infinity は 0", () => {
    expect(todayMinutesFromSeconds(-1)).toBe(0);
    expect(todayMinutesFromSeconds(NaN)).toBe(0);
    expect(todayMinutesFromSeconds(Infinity)).toBe(0);
  });
});

describe("describeTodayMinutes", () => {
  it("0 分: tone=neutral / hint は『はじめてみよう』寄り", () => {
    const r = describeTodayMinutes(0);
    expect(r.minutes).toBe(0);
    expect(r.tone).toBe("neutral");
    expect(r.primary).toContain("まだ");
    // 否定語 (DEC-024) 排除確認
    expect(r.primary).not.toContain("ない");
    expect(r.hint).not.toContain("ない");
  });
  it("0 < x < 30 分: tone=neutral", () => {
    const r = describeTodayMinutes(15 * 60);
    expect(r.minutes).toBe(15);
    expect(r.tone).toBe("neutral");
    expect(r.primary).toContain("15");
  });
  it("30 分以上 60 分未満: tone=warm + 休憩示唆", () => {
    const r = describeTodayMinutes(45 * 60);
    expect(r.minutes).toBe(45);
    expect(r.tone).toBe("warm");
    expect(r.hint).toContain("やすみ");
  });
  it("30 分ぴったりは warm 境界", () => {
    const r = describeTodayMinutes(30 * 60);
    expect(r.minutes).toBe(30);
    expect(r.tone).toBe("warm");
  });
  it("60 分以上: tone=celebrate + 祝福調 (DEC-024 罰則ゼロ)", () => {
    const r = describeTodayMinutes(60 * 60);
    expect(r.minutes).toBe(60);
    expect(r.tone).toBe("celebrate");
    expect(r.hint).toContain("じゅうぶん");
    // 罰則・否定語 排除
    expect(r.primary).not.toContain("だめ");
    expect(r.hint).not.toContain("やりすぎ");
  });
  it("60 分超過も celebrate / 祝福調維持 (90 分等)", () => {
    const r = describeTodayMinutes(90 * 60);
    expect(r.minutes).toBe(90);
    expect(r.tone).toBe("celebrate");
  });
});

describe("sanitizePreferredSessionMinutes", () => {
  it("5 / 7 / 10 はそのまま", () => {
    expect(sanitizePreferredSessionMinutes(5)).toBe(5);
    expect(sanitizePreferredSessionMinutes(7)).toBe(7);
    expect(sanitizePreferredSessionMinutes(10)).toBe(10);
  });
  it("それ以外の数値は null", () => {
    expect(sanitizePreferredSessionMinutes(0)).toBeNull();
    expect(sanitizePreferredSessionMinutes(3)).toBeNull();
    expect(sanitizePreferredSessionMinutes(6)).toBeNull();
    expect(sanitizePreferredSessionMinutes(8)).toBeNull();
    expect(sanitizePreferredSessionMinutes(15)).toBeNull();
    expect(sanitizePreferredSessionMinutes(NaN)).toBeNull();
    expect(sanitizePreferredSessionMinutes(Infinity)).toBeNull();
    expect(sanitizePreferredSessionMinutes(-1)).toBeNull();
  });
  it("文字列 / null / undefined / object は null", () => {
    expect(sanitizePreferredSessionMinutes("5")).toBeNull();
    expect(sanitizePreferredSessionMinutes("seven")).toBeNull();
    expect(sanitizePreferredSessionMinutes(null)).toBeNull();
    expect(sanitizePreferredSessionMinutes(undefined)).toBeNull();
    expect(sanitizePreferredSessionMinutes({})).toBeNull();
    expect(sanitizePreferredSessionMinutes([])).toBeNull();
  });
});
