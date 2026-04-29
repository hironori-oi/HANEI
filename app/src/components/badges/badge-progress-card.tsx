/**
 * HANEI - Badge Progress Card (W9-C / /badges グリッド要素)
 *
 * 単一バッジの「現在 ratio + ラベル + tier ring」を表示する純表示 Component。
 * 取得済 / 未取得の見せ方を切り替える。
 *
 * 設計原則:
 *  - サーバ Component (副作用ゼロ / Drizzle 結果から直接 props を受け取る)
 *  - 絵文字禁止 / Heroicons + inline SVG
 *  - tier 別 ring 色は celebration.ts と一致
 */

import { LockClosedIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  type BadgeCode,
  type BadgeTier,
} from "@/lib/badges/badge-codes";
import {
  BADGE_BY_CODE,
} from "@/lib/badges/catalog";
import { BADGE_ICON_BY_CODE, FirstFlightBadgeIcon } from "./icons";

interface Props {
  code: BadgeCode;
  /** 取得済か (true 時はカラー / false 時はグレースケール + LockClosed) */
  earned: boolean;
  /** 進捗の現在値 / threshold (未取得時のみ表示) */
  current: number;
  total: number;
  /** 取得済の場合の取得日 (YYYY/MM/DD) */
  earnedAtLabel?: string;
  className?: string;
}

const TIER_RING: Readonly<Record<BadgeTier, string>> = {
  bronze: "ring-amber-500/60",
  silver: "ring-zinc-400/60",
  gold: "ring-amber-400/80",
  platinum: "ring-pink-300/80",
};
const TIER_LABEL: Readonly<Record<BadgeTier, string>> = {
  bronze: "ブロンズ",
  silver: "シルバー",
  gold: "ゴールド",
  platinum: "プラチナ",
};

export function BadgeProgressCard({
  code,
  earned,
  current,
  total,
  earnedAtLabel,
  className,
}: Props) {
  const meta = BADGE_BY_CODE[code];
  const Icon = BADGE_ICON_BY_CODE[code] ?? FirstFlightBadgeIcon;
  const ratio = total > 0 ? Math.min(1, current / total) : 0;
  const pct = Math.round(ratio * 100);

  return (
    <Card
      data-testid={`badge-card-${code}`}
      data-earned={earned ? "true" : "false"}
      className={cn(
        "flex flex-col items-center gap-2 p-4",
        earned
          ? `ring-2 ${TIER_RING[meta.tier]} bg-card`
          : "bg-card/60 opacity-90",
        className,
      )}
    >
      <div className="relative">
        <Icon size={88} earned={earned} label={`${meta.name} バッジ`} />
        {!earned && (
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-border bg-background shadow"
          >
            <LockClosedIcon className="h-4 w-4 text-muted-foreground" />
          </span>
        )}
        {earned && (
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow"
          >
            <CheckBadgeIcon className="h-5 w-5" />
          </span>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-0.5 text-center">
        <p className="text-base font-bold leading-tight text-foreground">
          {meta.name}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {TIER_LABEL[meta.tier]}
        </p>
      </div>

      <p className="line-clamp-3 min-h-[3em] w-full text-center text-xs leading-snug text-muted-foreground">
        {meta.description}
      </p>

      {earned ? (
        <div className="flex w-full flex-col items-center gap-0.5">
          <p className="text-xs font-bold text-success">取得ずみ</p>
          {earnedAtLabel && (
            <p className="text-[11px] text-muted-foreground">{earnedAtLabel}</p>
          )}
        </div>
      ) : (
        <div className="w-full space-y-1" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-primary transition-[width] motion-safe:duration-500"
              style={{ width: `${pct}%` }}
              aria-hidden="true"
            />
          </div>
          <p className="text-center text-[11px] tabular-nums text-muted-foreground">
            {current} / {total} {meta.progressUnit}
            <span className="ml-1">({pct}%)</span>
          </p>
        </div>
      )}
    </Card>
  );
}
