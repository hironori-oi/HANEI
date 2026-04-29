/**
 * DailyQuestSummaryRibbon - /home 上部の Daily Quest サマリ (W10-T3)
 *
 * Server Component (UI のみ / 計算済 props を受ける):
 *   - 「きょうの クエスト 1 / 3」表示
 *   - 達成済件数バッジ
 *   - claim 可能件数があれば「うけとれるよ」hint
 *   - 全件 claimed + bonus 受領済なら祝福メッセージ
 *   - 「クエストを ひらく」CTA → /quests
 *
 * 罰則ゼロ哲学 (DEC-024): 未達でも「がんばろう」しか出さない / 否定形なし。
 */

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardDocumentCheckIcon,
  GiftIcon,
} from "@heroicons/react/24/outline";

interface DailyQuestSummaryRibbonProps {
  learnerId: string;
  totalCount: number;
  completedCount: number;
  claimedCount: number;
  /** 達成済 + 未受領の件数 ( = claim 可能件数) */
  claimableCount: number;
  /** 3/3 全 claim + bonus も受領済 */
  allBonusClaimed: boolean;
}

export function DailyQuestSummaryRibbon({
  learnerId,
  totalCount,
  completedCount,
  claimedCount,
  claimableCount,
  allBonusClaimed,
}: DailyQuestSummaryRibbonProps) {
  const pct =
    totalCount > 0
      ? Math.min(100, Math.floor((claimedCount / totalCount) * 100))
      : 0;

  const href = `/quests?learner=${encodeURIComponent(learnerId)}`;

  return (
    <Card
      data-testid="home-quest-summary-ribbon"
      data-claimable-count={claimableCount}
      data-claimed-count={claimedCount}
      data-total-count={totalCount}
      className="border-[#F2A93A]/40 bg-amber-50/50 dark:bg-amber-900/10"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardDocumentCheckIcon
              className="h-6 w-6 text-[#B97F18] dark:text-[#F2A93A]"
              aria-hidden="true"
            />
            <CardTitle className="text-base">きょうのクエスト</CardTitle>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-[#B97F18] shadow-sm dark:bg-amber-900/40 dark:text-[#F2A93A]"
            aria-label={`うけとりずみ ${claimedCount} / ${totalCount}`}
          >
            <span className="tabular-nums">{claimedCount}</span>
            <span> / </span>
            <span className="tabular-nums">{totalCount}</span>
          </span>
        </div>
        <CardDescription>
          {allBonusClaimed
            ? "きょうは ぜんぶ クリア！ おつかれさま。"
            : claimableCount > 0
              ? "うけとれる ほうしゅうが あるよ。"
              : completedCount > 0
                ? "つぎの 1 つを めざして がんばろう。"
                : "もんだいに とりくむと メーターが すすむよ。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress
          value={pct}
          aria-label={`クエスト 進捗 ${pct}%`}
          data-testid="home-quest-summary-progress"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            size="lg"
            className="min-h-tap-cta"
            variant={claimableCount > 0 ? "default" : "outline"}
          >
            <Link
              href={href}
              className="inline-flex items-center gap-2"
              data-testid="home-quest-summary-cta"
            >
              <GiftIcon className="h-5 w-5" aria-hidden="true" />
              <span>
                {claimableCount > 0
                  ? `うけとれる クエストが ${claimableCount} こ`
                  : "クエストを ひらく"}
              </span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
