/**
 * AI コスト ガード - 1 ユーザー 1 日 ¥10 上限テスト
 * (W2-09 / dev-w2 R-6)
 *
 * 検証ポイント:
 *  - estimateCostJpy が tokens から JPY を計算する
 *  - getTodayCostJpy が DB 集計値を返す (db.select() をモック)
 *  - isOverDailyLimit が ¥10 閾値で over=true / false を返す
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// db client をモック (Turso 接続を呼ばない)
vi.mock("@/lib/db/client", () => {
  return {
    db: {
      select: vi.fn(),
    },
    schema: {},
  };
});

import { db } from "@/lib/db/client";
import {
  estimateCostJpy,
  getTodayCostJpy,
  isOverDailyLimit,
} from "@/lib/ai/cost-guard";
import { AI_COST_LIMIT_JPY_PER_USER_PER_DAY } from "@/lib/constants";

function mockSelectChain(returnValue: unknown[]) {
  // drizzle chain: db.select().from().innerJoin().where()
  const where = vi.fn().mockResolvedValue(returnValue);
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin, where });
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("estimateCostJpy()", () => {
  it("0 tokens なら 0 円", () => {
    expect(estimateCostJpy(0, 0)).toBe(0);
  });

  it("入力 1000 / 出力 500 トークンで正の値を返す", () => {
    const cost = estimateCostJpy(1000, 500);
    expect(cost).toBeGreaterThan(0);
  });

  it("出力トークンの方が入力よりコスト単価が高い (gpt-5-mini 仮定)", () => {
    const inputOnly = estimateCostJpy(1000, 0);
    const outputOnly = estimateCostJpy(0, 1000);
    expect(outputOnly).toBeGreaterThan(inputOnly);
  });
});

describe("getTodayCostJpy()", () => {
  it("DB 集計が 0 円なら 0 を返す", async () => {
    mockSelectChain([{ total: 0 }]);
    const result = await getTodayCostJpy("learner_001");
    expect(result).toBe(0);
  });

  it("DB 集計が 5.5 円なら 5.5 を返す", async () => {
    mockSelectChain([{ total: 5.5 }]);
    const result = await getTodayCostJpy("learner_001");
    expect(result).toBe(5.5);
  });

  it("rows が空なら 0 を返す", async () => {
    mockSelectChain([]);
    const result = await getTodayCostJpy("learner_001");
    expect(result).toBe(0);
  });
});

describe("isOverDailyLimit()", () => {
  it("AI_COST_LIMIT_JPY_PER_USER_PER_DAY が 10 円である (DEC-008 K-6)", () => {
    expect(AI_COST_LIMIT_JPY_PER_USER_PER_DAY).toBe(10);
  });

  it("当日 5 円なら over=false", async () => {
    mockSelectChain([{ total: 5 }]);
    const result = await isOverDailyLimit("learner_001");
    expect(result.over).toBe(false);
    expect(result.current).toBe(5);
    expect(result.limit).toBe(10);
  });

  it("当日 10 円ちょうどで over=true (上限到達)", async () => {
    mockSelectChain([{ total: 10 }]);
    const result = await isOverDailyLimit("learner_001");
    expect(result.over).toBe(true);
  });

  it("当日 11 円で over=true", async () => {
    mockSelectChain([{ total: 11 }]);
    const result = await isOverDailyLimit("learner_001");
    expect(result.over).toBe(true);
    expect(result.current).toBe(11);
  });
});
