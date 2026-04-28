/**
 * learner.repository.test.ts
 *
 * `getLearnersForParent` のテスト。
 *  - happy path: 親が family に所属していれば family 配下の learner_profiles を返す
 *  - no family: 親が family_members に未登録なら空配列を返す
 *
 * drizzle chained API を vi.mock でスタブし、DB 接続を一切張らない。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// db client モック (本物の Turso 接続を呼ばない)
vi.mock("@/lib/db/client", () => {
  return {
    db: {
      select: vi.fn(),
    },
  };
});

import { db } from "@/lib/db/client";
import { getLearnersForParent } from "@/lib/learner/repository";

/**
 * drizzle のチェイン API を mock する。
 * 第 1 呼び出し: select().from(familyMembers).where().limit() → familyRows
 * 第 2 呼び出し: select().from(learnerProfiles).where()       → learners
 */
function mockTwoStepSelect(
  familyRows: unknown[],
  learnerRows: unknown[],
): void {
  // 第 1 呼び出し: limit() で終わる
  const firstLimit = vi.fn().mockResolvedValue(familyRows);
  const firstWhere = vi.fn().mockReturnValue({ limit: firstLimit });
  const firstFrom = vi.fn().mockReturnValue({ where: firstWhere });
  // 第 2 呼び出し: where() で終わる (await 可能な thenable: Promise を返す)
  const secondWhere = vi.fn().mockResolvedValue(learnerRows);
  const secondFrom = vi.fn().mockReturnValue({ where: secondWhere });

  (db.select as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce({ from: firstFrom })
    .mockReturnValueOnce({ from: secondFrom });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getLearnersForParent", () => {
  it("returns the learners list when the parent belongs to a family", async () => {
    const familyId = "fam_001";
    const learners = [
      {
        id: "learner_1",
        familyId,
        nickname: "たろう",
        targetEikenLevel: "5",
      },
      {
        id: "learner_2",
        familyId,
        nickname: "はなこ",
        targetEikenLevel: "4",
      },
    ];
    mockTwoStepSelect([{ familyId }], learners);

    const result = await getLearnersForParent("user_parent_001");
    expect(result).toEqual(learners);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it("returns an empty array when the parent has no family membership", async () => {
    // 第 1 呼び出しが空配列 → 早期 return
    const firstLimit = vi.fn().mockResolvedValue([]);
    const firstWhere = vi.fn().mockReturnValue({ limit: firstLimit });
    const firstFrom = vi.fn().mockReturnValue({ where: firstWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: firstFrom,
    });

    const result = await getLearnersForParent("user_orphan");
    expect(result).toEqual([]);
    // 第 2 呼び出しは行われない
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array when family_members row exists but has nullish familyId", async () => {
    // safety: familyId が null/undefined のケースも fallback で空配列
    const firstLimit = vi.fn().mockResolvedValue([{ familyId: null }]);
    const firstWhere = vi.fn().mockReturnValue({ limit: firstLimit });
    const firstFrom = vi.fn().mockReturnValue({ where: firstWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: firstFrom,
    });

    const result = await getLearnersForParent("user_weird");
    expect(result).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
