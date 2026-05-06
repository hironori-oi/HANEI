/**
 * home.heatmap-aggregation.test.ts (DEC-088 Plan B / 項目 3)
 *
 * `getRecentDailyStudyMinutes` / `buildHeatmapDateGrid` を検証する.
 *
 * 検証ポイント:
 *  - buildHeatmapDateGrid:
 *    1. 末尾が今日 / 配列長が指定 days
 *    2. 連続した日付 (前日/翌日が 1 日違い)
 *    3. days < 1 は 1 にクランプ / days > 365 は 365 にクランプ
 *    4. 浮動小数 days は Math.floor で整数化
 *  - getRecentDailyStudyMinutes:
 *    5. 0 件 → 空 map
 *    6. cumulativeSeconds → 分換算 (Math.floor / 60) / 0 分の日は除外
 *    7. days クランプ
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// db client を mock (drizzle のチェーンを stub する)
vi.mock("@/lib/db/client", () => ({
  db: { select: vi.fn() },
  schema: {},
}));

import { db } from "@/lib/db/client";
import {
  buildHeatmapDateGrid,
  getRecentDailyStudyMinutes,
} from "@/lib/study/aggregations";
import type { Db } from "@/lib/db/client";

/**
 * `db.select().from(...).where(...).groupBy(...)` チェーンを stub し、
 * groupBy が returnRows を resolve する形を作る.
 */
function mockSelectGroupBy(returnRows: Array<{ date: string; totalSeconds: number }>) {
  const groupBy = vi.fn().mockResolvedValue(returnRows);
  const where = vi.fn().mockReturnValue({ groupBy });
  const from = vi.fn().mockReturnValue({ where });
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });
}

describe("buildHeatmapDateGrid", () => {
  const fixedNow = new Date(2026, 4, 6); // 2026-05-06 (PRJ-016 currentDate)

  it("days=1 の場合 [今日] のみ", () => {
    const grid = buildHeatmapDateGrid(1, fixedNow);
    expect(grid).toEqual(["2026-05-06"]);
  });

  it("days=7 の末尾は今日 / 配列長 = 7", () => {
    const grid = buildHeatmapDateGrid(7, fixedNow);
    expect(grid.length).toBe(7);
    expect(grid[grid.length - 1]).toBe("2026-05-06");
    expect(grid[0]).toBe("2026-04-30"); // 7 日前
  });

  it("days=84 (デフォルト) で 84 要素", () => {
    const grid = buildHeatmapDateGrid(84, fixedNow);
    expect(grid.length).toBe(84);
    expect(grid[grid.length - 1]).toBe("2026-05-06");
  });

  it("連続した日付 (前後の差 1 日) を生成", () => {
    const grid = buildHeatmapDateGrid(5, fixedNow);
    for (let i = 1; i < grid.length; i += 1) {
      const prev = new Date(grid[i - 1] + "T00:00:00");
      const cur = new Date(grid[i] + "T00:00:00");
      const diff = (cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
      expect(diff).toBe(1);
    }
  });

  it("days <= 0 は 1 にクランプ", () => {
    expect(buildHeatmapDateGrid(0, fixedNow).length).toBe(1);
    expect(buildHeatmapDateGrid(-5, fixedNow).length).toBe(1);
  });

  it("days > 365 は 365 にクランプ", () => {
    expect(buildHeatmapDateGrid(1000, fixedNow).length).toBe(365);
  });

  it("浮動小数の days は Math.floor", () => {
    expect(buildHeatmapDateGrid(7.9, fixedNow).length).toBe(7);
  });
});

describe("getRecentDailyStudyMinutes", () => {
  beforeEach(() => {
    (db.select as ReturnType<typeof vi.fn>).mockReset();
  });

  it("0 件なら空 map", async () => {
    mockSelectGroupBy([]);
    const map = await getRecentDailyStudyMinutes(db as Db, "learner-1", 84);
    expect(map).toEqual({});
  });

  it("cumulativeSeconds を 60 で割った分数を返す (floor)", async () => {
    mockSelectGroupBy([
      { date: "2026-05-06", totalSeconds: 600 }, // 10 分
      { date: "2026-05-05", totalSeconds: 305 }, // 5 分 (floor)
      { date: "2026-05-04", totalSeconds: 60 }, // 1 分
    ]);
    const map = await getRecentDailyStudyMinutes(db as Db, "learner-1", 84);
    expect(map).toEqual({
      "2026-05-06": 10,
      "2026-05-05": 5,
      "2026-05-04": 1,
    });
  });

  it("0 分の日 (秒数 < 60) は map に含めない", async () => {
    mockSelectGroupBy([
      { date: "2026-05-06", totalSeconds: 30 }, // 0 分扱い
      { date: "2026-05-05", totalSeconds: 0 }, // 0 分
      { date: "2026-05-04", totalSeconds: 120 }, // 2 分 → 残る
    ]);
    const map = await getRecentDailyStudyMinutes(db as Db, "learner-1", 84);
    expect(map).toEqual({ "2026-05-04": 2 });
  });

  it("totalSeconds が null/undefined でも throw せず除外", async () => {
    mockSelectGroupBy([
      // @ts-expect-error - test 用 null
      { date: "2026-05-06", totalSeconds: null },
      { date: "2026-05-05", totalSeconds: 180 },
    ]);
    const map = await getRecentDailyStudyMinutes(db as Db, "learner-1", 84);
    expect(map).toEqual({ "2026-05-05": 3 });
  });

  it("days クランプ (0 → 1, 1000 → 365) でも throw せず select チェーンを呼ぶ", async () => {
    mockSelectGroupBy([]);
    await getRecentDailyStudyMinutes(db as Db, "learner-1", 0);
    expect(db.select).toHaveBeenCalledTimes(1);

    mockSelectGroupBy([]);
    await getRecentDailyStudyMinutes(db as Db, "learner-1", 1000);
    expect(db.select).toHaveBeenCalledTimes(2);
  });
});
