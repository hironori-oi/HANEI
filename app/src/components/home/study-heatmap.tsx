/**
 * HANEI - DEC-088 Plan B (項目 3): 学習履歴ヒートマップ (12 週 × 7 曜日)
 *
 * /home に「過去 84 日 (12 週) × 7 曜日」のグリッドで、各日の学習分数を
 * Mint Green 4 階調のセルで描画する。GitHub Contributions 風だが
 * **赤色は一切使用せず**、未学習日は薄い muted 色のままにする (DEC-024 罰則ゼロ哲学).
 *
 * 4 階調しきい値 (分):
 *  - tier 0: 0 分 (未学習) — 薄い muted (border-only)
 *  - tier 1: 1〜4 分 — Mint Green 25%
 *  - tier 2: 5〜14 分 — Mint Green 55%
 *  - tier 3: 15+ 分 — Mint Green 100%
 *
 * 設計:
 *  - SSR / RSC 安全 (純粋表示 / "use client" 不要)
 *  - 各セルは aria-label で「YYYY-MM-DD: N ふん がくしゅう」を読み上げ
 *  - キーボード focus 可 (tabindex=0) / focus-visible リング (Tailwind)
 *  - 絵文字なし / Heroicons はラベル横で補助
 *  - 赤色未使用 (DEC-024 罰則ゼロ)
 */

import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  buildHeatmapDateGrid,
  type DailyStudyMinutesMap,
} from "@/lib/study/aggregations";

interface Props {
  /** 直近 N 日の sessionDate -> 学習分数 map */
  minutesByDate: DailyStudyMinutesMap;
  /** 表示日数 (default 84 / 12 週) */
  days?: number;
  /** ベース日 (テスト容易性 / default new Date()) */
  now?: Date;
  className?: string;
}

const WEEKDAY_LABELS_JA: ReadonlyArray<string> = [
  "日",
  "月",
  "火",
  "水",
  "木",
  "金",
  "土",
];

/** 1 セルの分数 → 4 階調 tier (0..3) */
function pickTier(minutes: number): 0 | 1 | 2 | 3 {
  if (minutes <= 0) return 0;
  if (minutes < 5) return 1;
  if (minutes < 15) return 2;
  return 3;
}

const TIER_CELL_CLASS: Record<0 | 1 | 2 | 3, string> = {
  // tier 0: 未学習 - 薄い muted (赤色未使用)
  0: "bg-muted/40 border-border/40",
  // tier 1: 1〜4 分 - Mint Green 25%
  1: "bg-[color:var(--accent-correct)]/25 border-[color:var(--accent-correct)]/40",
  // tier 2: 5〜14 分 - Mint Green 55%
  2: "bg-[color:var(--accent-correct)]/55 border-[color:var(--accent-correct)]/70",
  // tier 3: 15+ 分 - Mint Green full
  3: "bg-[color:var(--accent-correct)] border-[color:var(--accent-correct)]",
};

const TIER_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "がくしゅうなし",
  1: "1〜4 ふん",
  2: "5〜14 ふん",
  3: "15 ふん いじょう",
};

export function StudyHeatmap({
  minutesByDate,
  days = 84,
  now,
  className,
}: Props) {
  const dateGrid = buildHeatmapDateGrid(days, now);
  // dateGrid は古い -> 新しい の連続配列。先頭 dateIso の曜日を割り出して、
  // 「7 行 × N 列 (週)」の縦並び (列単位で週) に並べ替える.
  const firstDate = new Date(`${dateGrid[0]}T00:00:00`);
  const startDow = Number.isNaN(firstDate.getTime()) ? 0 : firstDate.getDay();

  // grid[dow][weekIdx] = dateIso | null
  const totalWeeks = Math.ceil((dateGrid.length + startDow) / 7);
  const grid: Array<Array<string | null>> = Array.from(
    { length: 7 },
    () => Array.from({ length: totalWeeks }, () => null),
  );
  for (let i = 0; i < dateGrid.length; i += 1) {
    const offset = startDow + i;
    const dow = offset % 7;
    const week = Math.floor(offset / 7);
    grid[dow]![week] = dateGrid[i] ?? null;
  }

  // 集計: 直近 N 日の合計分数 / 学習日数
  let totalMinutes = 0;
  let activeDays = 0;
  for (const iso of dateGrid) {
    const m = minutesByDate[iso] ?? 0;
    totalMinutes += m;
    if (m > 0) activeDays += 1;
  }

  return (
    <Card
      data-testid="home-study-heatmap"
      data-days={dateGrid.length}
      data-active-days={activeDays}
      data-total-minutes={totalMinutes}
      className={cn(className)}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDaysIcon
            className="h-5 w-5 text-primary"
            aria-hidden="true"
          />
          <CardTitle className="text-base">がくしゅうの あしあと</CardTitle>
        </div>
        <CardDescription>
          ちかい {dateGrid.length} 日かんで {activeDays} 日 がくしゅうしました。
          ごうけい {totalMinutes} ふん。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* 横スクロール可 (mobile 寄り) */}
        <div
          className="overflow-x-auto pb-2"
          role="grid"
          aria-label="直近 12 週の学習履歴ヒートマップ"
        >
          <table
            className="border-separate"
            style={{ borderSpacing: "3px" }}
          >
            <thead>
              <tr aria-hidden="true">
                <th />
                {Array.from({ length: totalWeeks }).map((_, w) => (
                  <th key={w} className="h-3 w-3" />
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, dowIdx) => (
                <tr key={dowIdx}>
                  <th
                    scope="row"
                    className="pr-2 text-right text-[10px] font-normal leading-3 text-muted-foreground"
                  >
                    {/* 月水金のみ表示 (GitHub 風) */}
                    {dowIdx === 1 || dowIdx === 3 || dowIdx === 5
                      ? WEEKDAY_LABELS_JA[dowIdx]
                      : ""}
                  </th>
                  {row.map((iso, weekIdx) => {
                    if (!iso) {
                      return (
                        <td
                          key={weekIdx}
                          aria-hidden="true"
                          className="h-3 w-3"
                        />
                      );
                    }
                    const minutes = minutesByDate[iso] ?? 0;
                    const tier = pickTier(minutes);
                    return (
                      <td key={weekIdx}>
                        <span
                          tabIndex={0}
                          role="gridcell"
                          aria-label={`${iso}: ${
                            minutes > 0
                              ? `${minutes} ふん がくしゅう`
                              : "がくしゅうなし"
                          }`}
                          data-testid="heatmap-cell"
                          data-date={iso}
                          data-minutes={minutes}
                          data-tier={tier}
                          className={cn(
                            "block h-3 w-3 rounded-sm border",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                            TIER_CELL_CLASS[tier],
                          )}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 凡例 */}
        <div
          className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground"
          aria-label="ヒートマップ凡例"
        >
          <span>すくない</span>
          {([0, 1, 2, 3] as const).map((tier) => (
            <span
              key={tier}
              aria-label={TIER_LABEL[tier]}
              className={cn(
                "h-3 w-3 rounded-sm border",
                TIER_CELL_CLASS[tier],
              )}
            />
          ))}
          <span>おおい</span>
        </div>
      </CardContent>
    </Card>
  );
}
