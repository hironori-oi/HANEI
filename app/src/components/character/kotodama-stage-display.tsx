/**
 * HANEI - ことだまトリ Stage 表示 (W9-T1 / /home + /study バッジ)
 *
 * 5 段階 SVG をディスパッチして表示するラッパ。
 * - /home: 大きめ (svgSize=200) フル表示
 * - /study: コンパクトバッジ (svgSize=64) と stage label のみ
 *
 * 設計:
 *  - SSR / RSC 安全 (純粋表示のみ / "use client" 不要)
 *  - 進化進捗 (progressToNext) を SVG 内 ProgressArc で可視化
 *  - 絵文字禁止 / Heroicons + inline JSX SVG / Amber Gold #F2A93A
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  describeKotodamaStage,
  type KotodamaStage,
  type KotodamaStageInput,
  type KotodamaStageInfo,
} from "@/lib/study/kotodama-tori-stage";
import { KotodamaHinaSvg } from "./kotodama-stages/hina";
import { KotodamaWakatoriSvg } from "./kotodama-stages/wakatori";
import { KotodamaSeityoSvg } from "./kotodama-stages/seityo";
import { KotodamaKenzyaSvg } from "./kotodama-stages/kenzya";
import { KotodamaSyugosinSvg } from "./kotodama-stages/syugosin";
import type { KotodamaStageSvgProps } from "./kotodama-stages/colors";

const STAGE_COMPONENTS: Record<
  KotodamaStage,
  (props: KotodamaStageSvgProps) => React.JSX.Element
> = {
  hina: KotodamaHinaSvg,
  wakatori: KotodamaWakatoriSvg,
  seityo: KotodamaSeityoSvg,
  kenzya: KotodamaKenzyaSvg,
  syugosin: KotodamaSyugosinSvg,
};

interface FullProps {
  /** 現在の累計 XP / streak / badge 件数 */
  input: KotodamaStageInput;
  /** SVG サイズ (px) - default 200 (mobile sweetspot) */
  svgSize?: number;
  className?: string;
  /** タイトル / 説明を非表示 (純粋にキャラのみ表示する用途) */
  bareSvg?: boolean;
}

export function KotodamaStageDisplay({
  input,
  svgSize = 200,
  className,
  bareSvg = false,
}: FullProps) {
  const info: KotodamaStageInfo = describeKotodamaStage(input);
  const Svg = STAGE_COMPONENTS[info.stage];

  if (bareSvg) {
    return (
      <Svg
        size={svgSize}
        progress={info.progressToNext}
        label={`ことだまトリ ${info.label}`}
        className={className}
      />
    );
  }

  return (
    <Card
      data-testid="kotodama-stage-display"
      data-stage={info.stage}
      data-progress-to-next={info.progressToNext}
      className={className}
    >
      <CardHeader>
        <CardTitle className="text-base">ことだまトリ</CardTitle>
        <CardDescription>
          いま:{" "}
          <ruby>
            {info.furigana}
            <rt>{info.label}</rt>
          </ruby>
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
            <Svg
              size={svgSize}
              progress={info.progressToNext}
              label={`ことだまトリ ${info.label}`}
            />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {info.description}
            </p>
            {info.nextStageHint && (
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-primary">
                  {info.nextStageHint}
                </span>
              </p>
            )}
            {info.nextStage === null && (
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

/**
 * /study 画面用のコンパクトバッジ (svgSize=56 / stage label と進捗のみ)。
 */
export function KotodamaStageBadge({
  input,
  className,
}: {
  input: KotodamaStageInput;
  className?: string;
}) {
  const info = describeKotodamaStage(input);
  const Svg = STAGE_COMPONENTS[info.stage];
  return (
    <div
      data-testid="kotodama-stage-badge"
      data-stage={info.stage}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border-2 border-primary/30 bg-primary/5 px-3 py-1",
        className,
      )}
    >
      <Svg size={48} progress={info.progressToNext} label={`${info.label}`} />
      <span className="text-xs font-semibold text-primary">
        <ruby>
          {info.furigana}
          <rt>{info.label}</rt>
        </ruby>
      </span>
    </div>
  );
}
