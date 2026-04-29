/**
 * HANEI - ことだまトリ Stage 4: 賢者 (kenzya)
 * - 知性の眼差し / 巻物を持つ
 * - 風格と落ち着き / 装飾豊か
 *
 * 進化アニメ (animate=true): 1.5s で巻物が淡く光る (opacity 反復)
 */
import { KOTODAMA_COLORS, KOTODAMA_VIEWBOX, type KotodamaStageSvgProps } from "./colors";
import { ProgressArc } from "./progress-arc";

export function KotodamaKenzyaSvg({
  size = 240,
  className,
  label,
  animate = false,
  progress = 0,
}: KotodamaStageSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={KOTODAMA_VIEWBOX}
      role="img"
      aria-label={label ?? "ことだまトリ・けんじゃ"}
      className={className}
    >
      <title>{label ?? "ことだまトリ・けんじゃ"}</title>

      <ProgressArc cx={120} cy={120} r={108} progress={progress} />

      {/* 翼 (折りたたみ風 / 落ち着いた風格 / 左) */}
      <g>
        <path
          d="M 84 134 Q 60 140 56 172 Q 80 174 92 162 Q 96 148 92 136 Z"
          fill={KOTODAMA_COLORS.primary}
        />
        <path d="M 80 144 Q 70 154 72 168" stroke={KOTODAMA_COLORS.shadow} strokeWidth="1.5" fill="none" opacity="0.6" />
        <path d="M 86 142 Q 80 152 84 166" stroke={KOTODAMA_COLORS.shadow} strokeWidth="1.2" fill="none" opacity="0.5" />
      </g>

      {/* 翼 (右 / 巻物を持つように前に出す) */}
      <g>
        <path
          d="M 156 134 Q 180 140 184 172 Q 160 174 148 162 Q 144 148 148 136 Z"
          fill={KOTODAMA_COLORS.primary}
        />
        <path d="M 160 144 Q 170 154 168 168" stroke={KOTODAMA_COLORS.shadow} strokeWidth="1.5" fill="none" opacity="0.6" />
      </g>

      {/* 体 */}
      <ellipse cx="120" cy="148" rx="40" ry="52" fill={KOTODAMA_COLORS.base} />
      <ellipse cx="120" cy="154" rx="34" ry="44" fill={KOTODAMA_COLORS.primary} opacity="0.9" />
      <ellipse cx="120" cy="162" rx="18" ry="22" fill={KOTODAMA_COLORS.white} opacity="0.45" />

      {/* 賢者の襟 (円形装飾 / 緑帯) */}
      <path
        d="M 90 124 Q 120 140 150 124"
        stroke={KOTODAMA_COLORS.green}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="120" cy="132" r="3" fill={KOTODAMA_COLORS.gold} />

      {/* 巻物 (右翼の前に持つ) */}
      <g opacity={animate ? 1 : 0.95}>
        <rect x="156" y="156" width="36" height="14" rx="2" fill={KOTODAMA_COLORS.white} stroke={KOTODAMA_COLORS.accent} strokeWidth="1" />
        <circle cx="158" cy="163" r="6" fill={KOTODAMA_COLORS.shadow} />
        <circle cx="190" cy="163" r="6" fill={KOTODAMA_COLORS.shadow} />
        <line x1="164" y1="160" x2="184" y2="160" stroke={KOTODAMA_COLORS.accent} strokeWidth="0.8" opacity="0.6" />
        <line x1="164" y1="164" x2="184" y2="164" stroke={KOTODAMA_COLORS.accent} strokeWidth="0.8" opacity="0.6" />
        {animate && (
          <animate
            attributeName="opacity"
            values="0.6;1;0.7;1"
            keyTimes="0;0.33;0.66;1"
            dur="1.5s"
            repeatCount="1"
          />
        )}
      </g>

      {/* 頭 */}
      <ellipse cx="120" cy="100" rx="34" ry="34" fill={KOTODAMA_COLORS.base} />
      <ellipse cx="110" cy="92" rx="12" ry="9" fill={KOTODAMA_COLORS.white} opacity="0.5" />

      {/* 賢者の眉 (落ち着き) */}
      <path d="M 96 88 Q 104 84 112 88" stroke={KOTODAMA_COLORS.shadow} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M 128 88 Q 136 84 144 88" stroke={KOTODAMA_COLORS.shadow} strokeWidth="2.4" fill="none" strokeLinecap="round" />

      {/* 目 (知性の眼 / 半月型) */}
      <path d="M 100 100 Q 106 96 112 100 Q 106 104 100 100 Z" fill={KOTODAMA_COLORS.black} />
      <path d="M 128 100 Q 134 96 140 100 Q 134 104 128 100 Z" fill={KOTODAMA_COLORS.black} />
      <circle cx="107" cy="99" r="1.4" fill={KOTODAMA_COLORS.white} />
      <circle cx="135" cy="99" r="1.4" fill={KOTODAMA_COLORS.white} />

      {/* くちばし */}
      <path d="M 113 113 L 127 113 L 120 124 Z" fill={KOTODAMA_COLORS.accent} />

      {/* 賢者の冠 (5 枚 / 中央に gold) */}
      <path d="M 100 68 L 106 48 L 112 68 Z" fill={KOTODAMA_COLORS.primary} />
      <path d="M 110 64 L 116 42 L 122 64 Z" fill={KOTODAMA_COLORS.shadow} />
      <path d="M 118 60 L 124 36 L 130 60 Z" fill={KOTODAMA_COLORS.gold} />
      <path d="M 124 64 L 130 44 L 136 64 Z" fill={KOTODAMA_COLORS.shadow} />
      <path d="M 132 68 L 138 50 L 144 68 Z" fill={KOTODAMA_COLORS.primary} />

      {/* 尾羽 (背面 / 長い) */}
      <path d="M 120 196 Q 96 208 88 222 Q 116 214 120 204" fill={KOTODAMA_COLORS.shadow} opacity="0.75" />
      <path d="M 120 196 Q 144 208 152 222 Q 124 214 120 204" fill={KOTODAMA_COLORS.shadow} opacity="0.75" />

      {/* 足 */}
      <line x1="108" y1="196" x2="108" y2="210" stroke={KOTODAMA_COLORS.accent} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="132" y1="196" x2="132" y2="210" stroke={KOTODAMA_COLORS.accent} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 100 210 L 116 210 M 124 210 L 140 210" stroke={KOTODAMA_COLORS.accent} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
