/**
 * HANEI - 桜の木メタファ Streak 表示 (W8-T6 / /home)
 *
 * 連続学習日数を 7 段階の桜の木 SVG で表現する。
 * Duolingo 流の「炎」を「桜の木が育つ」に置換する HANEI 独自の差別化軸。
 *
 * 設計原則:
 *   - 絵文字禁止: 純粋なベクター描画 (sakura-stages/* に分離)
 *   - 和の美意識: ポップすぎない / amber gold は最終段階のアクセントのみ
 *   - 「ですます調 / 小学生にも読める」マイクロコピー
 *   - prefers-reduced-motion: 揺れアニメーションは追加しない (Phase 1)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { describeSakuraStage, type SakuraStage } from "@/lib/study/sakura-streak";
import { SakuraSeedSvg } from "./sakura-stages/seed";
import { SakuraSproutSvg } from "./sakura-stages/sprout";
import { SakuraLeavesSvg } from "./sakura-stages/leaves";
import { SakuraBudSvg } from "./sakura-stages/bud";
import { SakuraBloomSvg } from "./sakura-stages/bloom";
import { SakuraFullBloomSvg } from "./sakura-stages/fullbloom";
import { SakuraGroveSvg } from "./sakura-stages/grove";
import type { SakuraSvgProps } from "./sakura-stages/colors";

const STAGE_COMPONENTS: Record<
  SakuraStage,
  (props: SakuraSvgProps) => React.JSX.Element
> = {
  seed: SakuraSeedSvg,
  sprout: SakuraSproutSvg,
  leaves: SakuraLeavesSvg,
  bud: SakuraBudSvg,
  bloom: SakuraBloomSvg,
  fullbloom: SakuraFullBloomSvg,
  grove: SakuraGroveSvg,
};

interface Props {
  /** 連続学習日数 */
  streakDays: number;
  /** SVG サイズ (px) - default 96 (mobile compact) */
  svgSize?: number;
  className?: string;
}

export function SakuraStreakDisplay({ streakDays, svgSize = 96, className }: Props) {
  const info = describeSakuraStage(streakDays);
  const StageSvg = STAGE_COMPONENTS[info.stage];

  return (
    <Card
      data-testid="sakura-streak-display"
      data-stage={info.stage}
      data-streak={streakDays}
      className={className}
    >
      <CardHeader>
        <CardTitle className="text-base">れんぞくきろく</CardTitle>
        <CardDescription>
          {streakDays > 0
            ? `${streakDays} 日 つづいています`
            : "きょうから はじめましょう"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md bg-muted/30 p-1",
            )}
            aria-hidden="false"
          >
            <StageSvg
              size={svgSize}
              label={`${info.label} (${streakDays} 日)`}
            />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-2xl font-bold tabular-nums">
              {streakDays}{" "}
              <span className="text-sm font-normal text-muted-foreground">日</span>
            </p>
            <p className="text-xs font-semibold text-primary">
              いま: <ruby>{info.label}</ruby>
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {info.description}
            </p>
            {info.nextStage && info.nextStageInDays !== null ? (
              <p className="text-xs text-muted-foreground">
                あと{" "}
                <span className="font-bold tabular-nums text-primary">
                  {info.nextStageInDays}
                </span>{" "}
                日で つぎの だんかい！
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                さいこうの だんかいに とうたつしました。
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
