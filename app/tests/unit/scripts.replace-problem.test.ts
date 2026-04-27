/**
 * scripts.replace-problem.test.ts (W3 / T-7)
 *
 * 検証ポイント (2 ケース必須):
 *  1. 差し替え成功 - 既存問題があれば update を呼んで { replaced: true } を返す
 *  2. id 不在で throw - 存在しない id を渡すと Error
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => {
  return {
    db: {
      select: vi.fn(),
      update: vi.fn(),
    },
    schema: {},
  };
});

import { db } from "@/lib/db/client";
import { replaceProblem } from "../../scripts/replace-problem";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("replaceProblem()", () => {
  it("既存 id ならば update を呼んで { replaced: true } を返す", async () => {
    // select() chain
    const selectLimit = vi.fn().mockResolvedValue([{ id: "v3_012" }]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: selectFrom });

    // update() chain
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: updateSet });

    const r = await replaceProblem("v3_012", {
      questionJson: {
        prompt: "This book (   ) by a famous writer.",
        choices: [
          { label: "A", text: "was written" },
          { label: "B", text: "writes" },
          { label: "C", text: "writing" },
          { label: "D", text: "write" },
        ],
      },
      correctAnswer: "A",
      explanation: "受動態 was written が正しいです。",
    });

    expect(r.replaced).toBe(true);
    expect(updateSet).toHaveBeenCalled();
    expect(updateWhere).toHaveBeenCalled();
  });

  it("id が不在なら throw する", async () => {
    const selectLimit = vi.fn().mockResolvedValue([]); // not found
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: selectFrom });

    await expect(
      replaceProblem("v3_999", {
        questionJson: {},
        correctAnswer: "A",
        explanation: "x",
      }),
    ).rejects.toThrow(/not found/);
  });

  it("空文字列の id は引数バリデーションで throw", async () => {
    await expect(
      replaceProblem("", {
        questionJson: {},
        correctAnswer: "A",
        explanation: "x",
      }),
    ).rejects.toThrow(/required/);
  });
});
