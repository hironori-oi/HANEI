/**
 * HANEI - Character With Accessories Overlay (W9-B)
 *
 * KotodamaStageDisplay (キャラ) の上に、装着中アクセサリ (hat / scarf / wing_charm)
 * を絶対座標で重ねる Server Component。
 *
 *  - キャラ SVG: bareSvg=true で純 SVG のみ (size 200 default)
 *  - hat        : top-center / scale 0.55
 *  - scarf      : middle-center / scale 0.55
 *  - wing_charm : bottom-right / scale 0.45
 *
 * 座標は character SVG (200×200) を基準とした % で表現する。SVG は 80×80 viewBox。
 */

import { cn } from "@/lib/utils";
import { KotodamaStageDisplay } from "../kotodama-stage-display";
import {
  ACCESSORY_BY_CODE,
  type AccessoryCode,
  type AccessorySlot,
} from "@/lib/accessories/catalog";
import {
  ACCESSORY_COMPONENT_BY_CODE,
  type AccessoryComponent,
} from "./index";
import type { KotodamaStageInput } from "@/lib/study/kotodama-tori-stage";

interface Props {
  /** 現在の累計 XP / streak / badge 件数 */
  input: KotodamaStageInput;
  /** 装着中 code (slot → code | null) */
  equippedBySlot: Readonly<Record<AccessorySlot, AccessoryCode | null>>;
  /** SVG サイズ (px) - default 200 */
  svgSize?: number;
  className?: string;
}

/**
 * slot ごとの overlay 配置 (character SVG 中央基準 / scale 比率).
 * size を size*scale に縮小し、left/top を中央 (50%) からのオフセットで指定。
 */
const SLOT_LAYOUT: Readonly<
  Record<AccessorySlot, { topPct: number; leftPct: number; scale: number }>
> = {
  hat: { topPct: 4, leftPct: 50, scale: 0.55 },
  scarf: { topPct: 50, leftPct: 50, scale: 0.55 },
  wing_charm: { topPct: 70, leftPct: 78, scale: 0.45 },
};

export function CharacterWithAccessories({
  input,
  equippedBySlot,
  svgSize = 200,
  className,
}: Props) {
  return (
    <div
      data-testid="character-with-accessories"
      className={cn("relative inline-block", className)}
      style={{ width: svgSize, height: svgSize }}
    >
      {/* ベース: ことだまトリ SVG (bareSvg) */}
      <KotodamaStageDisplay
        input={input}
        svgSize={svgSize}
        bareSvg
        className="block"
      />

      {/* オーバーレイ: 装着中のみ */}
      {(Object.keys(SLOT_LAYOUT) as AccessorySlot[]).map((slot) => {
        const code = equippedBySlot[slot];
        if (!code) return null;
        const def = ACCESSORY_BY_CODE[code];
        if (!def) return null;
        const Svg: AccessoryComponent | undefined =
          ACCESSORY_COMPONENT_BY_CODE[code];
        if (!Svg) return null;

        const layout = SLOT_LAYOUT[slot];
        const accSize = Math.round(svgSize * layout.scale);
        return (
          <span
            key={slot}
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              top: `${layout.topPct}%`,
              left: `${layout.leftPct}%`,
              transform: "translate(-50%, -50%)",
              width: accSize,
              height: accSize,
            }}
            data-slot={slot}
            data-code={code}
          >
            <Svg size={accSize} decorative className="block" />
          </span>
        );
      })}
    </div>
  );
}
