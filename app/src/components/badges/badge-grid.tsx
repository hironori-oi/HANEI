/**
 * HANEI - Badge Grid (W9-C / /badges ページ)
 *
 * 8 種 badges を grid 表示。Server Component。
 * - 取得済 → カラー + ring + 取得日
 * - 未取得 → グレースケール + 進捗バー (current / total)
 *
 * Tier 順 (catalog.ts の ALL_BADGE_CODES 順) で並べる。
 */

import { ALL_BADGE_CODES, type BadgeCode } from "@/lib/badges/badge-codes";
import {
  badgeProgressRatio,
  type LearnerBadgeStats,
} from "@/lib/badges/badge-engine";
import { BadgeProgressCard } from "./badge-progress-card";

export interface BadgeEarnedRecord {
  code: BadgeCode;
  /** UTC unixepoch (DB earned_at) */
  earnedAtSec: number;
}

interface Props {
  /** DB 取得済バッジ (W9 lib/actions/badges.ts から渡す) */
  earned: ReadonlyArray<BadgeEarnedRecord>;
  /** 全 8 種の進捗計算用 stats */
  stats: LearnerBadgeStats;
  className?: string;
}

function formatJaDate(unixSec: number): string {
  if (!Number.isFinite(unixSec) || unixSec <= 0) return "";
  const d = new Date(unixSec * 1000);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day} 取得`;
}

export function BadgeGrid({ earned, stats, className }: Props) {
  const earnedByCode = new Map<BadgeCode, BadgeEarnedRecord>(
    earned.map((e) => [e.code, e]),
  );

  return (
    <ul
      data-testid="badge-grid"
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${className ?? ""}`}
    >
      {ALL_BADGE_CODES.map((code) => {
        const e = earnedByCode.get(code);
        const isEarned = !!e;
        const progress = badgeProgressRatio(code, stats);
        return (
          <li key={code}>
            <BadgeProgressCard
              code={code}
              earned={isEarned}
              current={progress.current}
              total={progress.total}
              earnedAtLabel={e ? formatJaDate(e.earnedAtSec) : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}
