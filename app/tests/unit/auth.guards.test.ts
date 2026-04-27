/**
 * 認可ガード 4 関数の最低 4 ケース
 * (review-phase0-gate.md §8.2 W1-09)
 *
 * W1 雛形: DB 接続をモックしたユニットテスト。
 * W2 で in-memory libSQL に置き換えて統合テスト化。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// db client をモック (本物の Turso 接続を呼ばない)
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
  requireParent,
  requireFamilyMember,
  requireLearnerOwner,
  getSession,
} from "@/lib/auth/guards";

function mockSelectChain(returnValue: unknown[]) {
  // drizzle の chained API: db.select().from().where().limit()
  const limit = vi.fn().mockResolvedValue(returnValue);
  const where = vi.fn().mockReturnValue({ limit });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ where, innerJoin });
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSession", () => {
  it("W1 雛形では常に null を返す (W2 で Better Auth 連携予定)", async () => {
    const session = await getSession();
    expect(session).toBeNull();
  });
});

describe("requireParent", () => {
  it("user が parent role の family メンバーなら familyId を返す", async () => {
    mockSelectChain([{ familyId: "fam_123", role: "parent" }]);
    const result = await requireParent("user_abc");
    expect(result).toEqual({ familyId: "fam_123" });
  });

  it("user が parent でない場合は throw", async () => {
    mockSelectChain([]);
    await expect(requireParent("user_xyz")).rejects.toThrow(/not a parent/);
  });
});

describe("requireFamilyMember", () => {
  it("user が family メンバーなら row を返す", async () => {
    const row = {
      id: "fm_1",
      familyId: "fam_123",
      userId: "user_abc",
      role: "parent",
      createdAt: new Date(),
    };
    mockSelectChain([row]);
    const result = await requireFamilyMember("user_abc", "fam_123");
    expect(result).toEqual(row);
  });

  it("user が family メンバーでなければ throw", async () => {
    mockSelectChain([]);
    await expect(requireFamilyMember("user_evil", "fam_123")).rejects.toThrow(/is not in family/);
  });
});

describe("requireLearnerOwner", () => {
  it("親と学習者が同じ family なら通る", async () => {
    mockSelectChain([
      { familyId: "fam_123", learnerFamilyId: "fam_123" },
    ]);
    const result = await requireLearnerOwner("parent_abc", "learner_xyz");
    expect(result.familyId).toBe("fam_123");
    expect(result.learnerId).toBe("learner_xyz");
  });

  it("他家族の学習者にアクセスしようとすると throw (cross-family 漏洩防止)", async () => {
    mockSelectChain([]);
    await expect(
      requireLearnerOwner("parent_a", "learner_in_other_family"),
    ).rejects.toThrow(/cannot access learner/);
  });
});
