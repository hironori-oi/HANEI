/**
 * notifications.weekly-digest.test.ts (W6 / F-1)
 *
 * `sendWeeklyDigest` / `sendWeeklyDigestAll` のテスト。
 * DB / aggregations / sendEmail を全て vi.mock し、orchestration ロジックのみ検証。
 *
 * ケース:
 *  - sendWeeklyDigest happy path: 集計結果が messageId 付きで返る
 *  - sendWeeklyDigest: learner_not_found
 *  - sendWeeklyDigest: no_parent_email
 *  - sendWeeklyDigest: sendEmail 失敗時に reason が伝播
 *  - sendWeeklyDigestAll: 複数 learner の succeed/fail を集計
 *  - sendWeeklyDigestAll: ループ内 throw を catch して fallback outcome に変換
 *
 * 注意 - weekly-digest-template の renderDigestHtml は別ファイル
 * (notifications.weekly-digest-template.test.ts) で純関数として検証済み。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.mock (hoisted) - 必ず import より前に配置
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/client", () => {
  return {
    db: {
      select: vi.fn(),
    },
  };
});

vi.mock("@/lib/email/resend", () => {
  return {
    sendEmail: vi.fn(),
  };
});

vi.mock("@/lib/study/aggregations", () => {
  return {
    getCurrentStreak: vi.fn(),
    getWeeklyAnswers: vi.fn(),
    getXpSummary: vi.fn(),
    getDailySkillCounts: vi.fn(),
    getMasteryCoverage: vi.fn(),
    getNearestExamCountdown: vi.fn(),
  };
});

import { db } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/resend";
import {
  getCurrentStreak,
  getWeeklyAnswers,
  getXpSummary,
  getDailySkillCounts,
  getMasteryCoverage,
  getNearestExamCountdown,
} from "@/lib/study/aggregations";
import {
  sendWeeklyDigest,
  sendWeeklyDigestAll,
} from "@/lib/notifications/weekly-digest";

// ---------------------------------------------------------------------------
// helper: db.select() の呼び出し列をシナリオ別に組み立てる
// ---------------------------------------------------------------------------

interface DigestSelectScenario {
  /** 1 呼び出し目: learner lookup → returns learnerProfiles 行配列 */
  learnerRows: unknown[];
  /** 2 呼び出し目: parent lookup (innerJoin) → returns 行配列 */
  parentRows: unknown[];
}

function mockSendWeeklyDigestSelectChain(scenario: DigestSelectScenario): void {
  // 第 1 呼び出し: db.select().from(learnerProfiles).where().limit()
  const limit1 = vi.fn().mockResolvedValue(scenario.learnerRows);
  const where1 = vi.fn().mockReturnValue({ limit: limit1 });
  const from1 = vi.fn().mockReturnValue({ where: where1 });

  // 第 2 呼び出し: db.select({...}).from(familyMembers).innerJoin(users).where().limit()
  const limit2 = vi.fn().mockResolvedValue(scenario.parentRows);
  const where2 = vi.fn().mockReturnValue({ limit: limit2 });
  const innerJoin2 = vi.fn().mockReturnValue({ where: where2 });
  const from2 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });

  (db.select as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce({ from: from1 })
    .mockReturnValueOnce({ from: from2 });
}

function mockAllAggregationsHappy(): void {
  (getCurrentStreak as ReturnType<typeof vi.fn>).mockResolvedValue(5);
  (getWeeklyAnswers as ReturnType<typeof vi.fn>).mockResolvedValue({
    count: 42,
    correct: 35,
  });
  (getXpSummary as ReturnType<typeof vi.fn>).mockResolvedValue({
    weeklyXpDelta: 250,
    totalXp: 1100,
  });
  (getDailySkillCounts as ReturnType<typeof vi.fn>).mockResolvedValue({
    vocabulary: 5,
    grammar: 3,
    listening: 2,
    reading: 1,
    writing: 0,
  });
  (getMasteryCoverage as ReturnType<typeof vi.fn>).mockResolvedValue([
    { skill: "vocabulary", mastered: 80, total: 200 },
    { skill: "grammar", mastered: 30, total: 100 },
    { skill: "listening", mastered: 25, total: 100 },
    { skill: "reading", mastered: 10, total: 50 },
  ]);
  (getNearestExamCountdown as ReturnType<typeof vi.fn>).mockResolvedValue({
    examDate: "2026-10-04",
    daysUntil: 159,
    level: "5",
  });
}

const learnerHappy = {
  id: "learner_001",
  familyId: "fam_001",
  nickname: "たろう",
  targetEikenLevel: "5",
};

beforeEach(() => {
  // resetAllMocks: history + .mockReturnValueOnce queue + 設定済み implementation を全てリセット
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// sendWeeklyDigest
// ---------------------------------------------------------------------------

describe("sendWeeklyDigest", () => {
  it("happy path: 集計を取得し sendEmail を呼んで messageId 付き ok を返す", async () => {
    mockSendWeeklyDigestSelectChain({
      learnerRows: [learnerHappy],
      parentRows: [{ email: "parent@example.com", name: "山田" }],
    });
    mockAllAggregationsHappy();
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      id: "msg_abc",
    });

    const result = await sendWeeklyDigest("learner_001");
    expect(result).toEqual({
      ok: true,
      learnerId: "learner_001",
      to: "parent@example.com",
      messageId: "msg_abc",
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const sendEmailCall = (sendEmail as ReturnType<typeof vi.fn>).mock.calls[0];
    if (!sendEmailCall) throw new Error("sendEmail was not called");
    const sendEmailArg = sendEmailCall[0] as {
      to: string;
      subject: string;
      html: string;
    };
    expect(sendEmailArg.to).toBe("parent@example.com");
    expect(sendEmailArg.subject).toContain("たろう");
    expect(typeof sendEmailArg.html).toBe("string");
    // 6 aggregations are all called once
    expect(getCurrentStreak).toHaveBeenCalledTimes(1);
    expect(getWeeklyAnswers).toHaveBeenCalledTimes(1);
    expect(getXpSummary).toHaveBeenCalledTimes(1);
    expect(getDailySkillCounts).toHaveBeenCalledTimes(1);
    expect(getMasteryCoverage).toHaveBeenCalledTimes(1);
    expect(getNearestExamCountdown).toHaveBeenCalledTimes(1);
  });

  it("learner が見つからない場合 reason='learner_not_found' を返す", async () => {
    mockSendWeeklyDigestSelectChain({
      learnerRows: [],
      parentRows: [],
    });

    const result = await sendWeeklyDigest("learner_missing");
    expect(result).toEqual({
      ok: false,
      learnerId: "learner_missing",
      reason: "learner_not_found",
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(getCurrentStreak).not.toHaveBeenCalled();
  });

  it("親 email が無い場合 reason='no_parent_email' を返す", async () => {
    mockSendWeeklyDigestSelectChain({
      learnerRows: [learnerHappy],
      parentRows: [{ email: null, name: "山田" }],
    });

    const result = await sendWeeklyDigest("learner_001");
    expect(result).toEqual({
      ok: false,
      learnerId: "learner_001",
      reason: "no_parent_email",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("家族メンバーが 0 件 (parentRows 空) の場合も reason='no_parent_email'", async () => {
    mockSendWeeklyDigestSelectChain({
      learnerRows: [learnerHappy],
      parentRows: [],
    });

    const result = await sendWeeklyDigest("learner_001");
    expect(result).toEqual({
      ok: false,
      learnerId: "learner_001",
      reason: "no_parent_email",
    });
  });

  it("sendEmail が失敗した場合 reason を伝播して ok:false を返す", async () => {
    mockSendWeeklyDigestSelectChain({
      learnerRows: [learnerHappy],
      parentRows: [{ email: "parent@example.com", name: "山田" }],
    });
    mockAllAggregationsHappy();
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: "no_api_key",
    });

    const result = await sendWeeklyDigest("learner_001");
    expect(result).toEqual({
      ok: false,
      learnerId: "learner_001",
      reason: "no_api_key",
    });
  });

  it("parent.name が null の場合は parentName='保護者' で fallback する", async () => {
    mockSendWeeklyDigestSelectChain({
      learnerRows: [learnerHappy],
      parentRows: [{ email: "parent@example.com", name: null }],
    });
    mockAllAggregationsHappy();
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      id: "msg_xyz",
    });

    const result = await sendWeeklyDigest("learner_001");
    expect(result.ok).toBe(true);
    // 「保護者」という文字列が HTML に含まれる (fallback が効いている)
    const sendEmailCall = (sendEmail as ReturnType<typeof vi.fn>).mock.calls[0];
    if (!sendEmailCall) throw new Error("sendEmail was not called");
    const html = (sendEmailCall[0] as { html: string }).html;
    expect(html).toContain("保護者");
  });
});

// ---------------------------------------------------------------------------
// sendWeeklyDigestAll
// ---------------------------------------------------------------------------

describe("sendWeeklyDigestAll", () => {
  /**
   * sendWeeklyDigestAll の冒頭で `db.select({id}).from(learnerProfiles)` が呼ばれる。
   * その後ループ内で sendWeeklyDigest が呼ばれ、その内部でさらに 2 回 db.select() が走る。
   * → learner 1 件あたり 2 回 + 冒頭 1 回 = (2N + 1) 回の db.select() が必要。
   */
  function mockListLearners(ids: string[]): void {
    // 冒頭の learners 一覧取得: db.select({id}).from(learnerProfiles)
    // → from() の戻り値が直接 await される (where 無し)
    const fromList = vi.fn().mockResolvedValue(ids.map((id) => ({ id })));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: fromList,
    });
  }

  function mockOneSendWeeklyDigestSelect(scenario: DigestSelectScenario): void {
    // sendWeeklyDigest が内部で消費する 2 回分の chain を queue に追加
    const limit1 = vi.fn().mockResolvedValue(scenario.learnerRows);
    const where1 = vi.fn().mockReturnValue({ limit: limit1 });
    const from1 = vi.fn().mockReturnValue({ where: where1 });

    const limit2 = vi.fn().mockResolvedValue(scenario.parentRows);
    const where2 = vi.fn().mockReturnValue({ limit: limit2 });
    const innerJoin2 = vi.fn().mockReturnValue({ where: where2 });
    const from2 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: from1 })
      .mockReturnValueOnce({ from: from2 });
  }

  it("複数 learner で succeed / fail を集計する", async () => {
    mockListLearners(["learner_A", "learner_B"]);

    // learner_A: happy
    mockOneSendWeeklyDigestSelect({
      learnerRows: [{ ...learnerHappy, id: "learner_A" }],
      parentRows: [{ email: "a@example.com", name: "A親" }],
    });
    // learner_B: learner_not_found
    mockOneSendWeeklyDigestSelect({
      learnerRows: [],
      parentRows: [],
    });

    mockAllAggregationsHappy();
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      id: "msg_a",
    });

    const result = await sendWeeklyDigestAll();
    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes[0]).toMatchObject({
      ok: true,
      learnerId: "learner_A",
    });
    expect(result.outcomes[1]).toMatchObject({
      ok: false,
      learnerId: "learner_B",
      reason: "learner_not_found",
    });
  });

  it("ループ内で例外が投げられた場合 catch して outcome に詰める (fallback path)", async () => {
    mockListLearners(["learner_throws"]);

    // sendWeeklyDigest 内の db.select() が throw する → 1 回目で例外
    (db.select as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const result = await sendWeeklyDigestAll();
    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.outcomes[0]).toEqual({
      ok: false,
      learnerId: "learner_throws",
      reason: "boom",
    });
  });

  it("non-Error が throw された場合 reason='unknown_error' で fallback", async () => {
    mockListLearners(["learner_weird"]);

    (db.select as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      // Error 以外を throw (string)
      throw "raw string failure";
    });

    const result = await sendWeeklyDigestAll();
    expect(result.failed).toBe(1);
    expect(result.outcomes[0]).toEqual({
      ok: false,
      learnerId: "learner_weird",
      reason: "unknown_error",
    });
  });

  it("learner が 0 件の場合 total=0 で空 outcomes", async () => {
    mockListLearners([]);

    const result = await sendWeeklyDigestAll();
    expect(result).toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      outcomes: [],
    });
  });
});
