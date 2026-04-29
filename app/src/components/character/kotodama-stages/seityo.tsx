/**
 * HANEI - ことだまトリ Stage 3: 成鳥 (seityo)
 * - 大人の風格 / 翼が広がる
 * - 体が引き締まり、優美な曲線
 *
 * 進化アニメ (animate=true): 1.5s で翼を大きく広げる
 */
import { KOTODAMA_COLORS, KOTODAMA_VIEWBOX, type KotodamaStageSvgProps } from "./colors";
import { ProgressArc } from "./progress-arc";

export function KotodamaSeityoSvg({
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
      aria-label={label ?? "ことだまトリ・せいちょう"}
      className={className}
    >
      <title>{label ?? "ことだまトリ・せいちょう"}</title>

      <ProgressArc cx={120} cy={120} r={108} progress={progress} />

      {/* 翼 (大きく広がる / 左) */}
      <g>
        <path
          d="M 86 130 Q 40 110 26 138 Q 36 156 70 158 Q 88 152 92 144 Z"
          fill={KOTODAMA_COLORS.primary}
        />
        <path
          d="M 86 130 Q 50 122 36 140"
          stroke={KOTODAMA_COLORS.shadow}
          strokeWidth="2"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M 86 138 Q 56 138 44 152"
          stroke={KOTODAMA_COLORS.shadow}
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 90 138;-22 90 138;-6 90 138;0 90 138"
            keyTimes="0;0.4;0.8;1"
            dur="1.5s"
            repeatCount="1"
          />
        )}
      </g>

      {/* 翼 (右) */}
      <g>
        <path
          d="M 154 130 Q 200 110 214 138 Q 204 156 170 158 Q 152 152 148 144 Z"
          fill={KOTODAMA_COLORS.primary}
        />
        <path
          d="M 154 130 Q 190 122 204 140"
          stroke={KOTODAMA_COLORS.shadow}
          strokeWidth="2"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M 154 138 Q 184 138 196 152"
          stroke={KOTODAMA_COLORS.shadow}
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 150 138;22 150 138;6 150 138;0 150 138"
            keyTimes="0;0.4;0.8;1"
            dur="1.5s"
            repeatCount="1"
          />
        )}
      </g>

      {/* 体 */}
      <ellipse cx="120" cy="146" rx="40" ry="50" fill={KOTODAMA_COLORS.base} />
      <ellipse cx="120" cy="152" rx="34" ry="42" fill={KOTODAMA_COLORS.primary} opacity="0.9" />
      <ellipse cx="120" cy="160" rx="18" ry="22" fill={KOTODAMA_COLORS.white} opacity="0.45" />

      {/* 胸の装飾 (V 字 / 風格) */}
      <path
        d="M 108 130 L 120 142 L 132 130"
        stroke={KOTODAMA_COLORS.shadow}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* 頭 (やや小さく / 引き締まる) */}
      <ellipse cx="120" cy="98" rx="32" ry="32" fill={KOTODAMA_COLORS.base} />
      <ellipse cx="110" cy="90" rx="12" ry="9" fill={KOTODAMA_COLORS.white} opacity="0.5" />

      {/* 目 (鋭い / アーモンド型) */}
      <path d="M 100 99 Q 106 95 112 99 Q 106 103 100 99 Z" fill={KOTODAMA_COLORS.black} />
      <path d="M 128 99 Q 134 95 140 99 Q 134 103 128 99 Z" fill={KOTODAMA_COLORS.black} />
      <circle cx="106" cy="98" r="1.3" fill={KOTODAMA_COLORS.white} />
      <circle cx="134" cy="98" r="1.3" fill={KOTODAMA_COLORS.white} />

      {/* くちばし (鋭い) */}
      <path d="M 112 110 L 128 110 L 120 122 Z" fill={KOTODAMA_COLORS.accent} />
      <path d="M 116 116 L 124 116" stroke={KOTODAMA_COLORS.shadow} strokeWidth="0.8" />

      {/* 頭頂の冠羽 (5 枚 / 風格) */}
      <path d="M 100 70 L 106 50 L 112 70 Z" fill={KOTODAMA_COLORS.primary} />
      <path d="M 110 66 L 116 44 L 122 66 Z" fill={KOTODAMA_COLORS.shadow} />
      <path d="M 118 64 L 124 40 L 130 64 Z" fill={KOTODAMA_COLORS.primary} />
      <path d="M 124 66 L 130 46 L 136 66 Z" fill={KOTODAMA_COLORS.shadow} />
      <path d="M 132 70 L 138 52 L 144 70 Z" fill={KOTODAMA_COLORS.primary} />

      {/* 尾羽 (背面に少し見える) */}
      <path
        d="M 120 192 Q 100 200 96 214 Q 116 208 120 200"
        fill={KOTODAMA_COLORS.shadow}
        opacity="0.7"
      />
      <path
        d="M 120 192 Q 140 200 144 214 Q 124 208 120 200"
        fill={KOTODAMA_COLORS.shadow}
        opacity="0.7"
      />

      {/* 足 */}
      <line x1="108" y1="194" x2="108" y2="208" stroke={KOTODAMA_COLORS.accent} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="132" y1="194" x2="132" y2="208" stroke={KOTODAMA_COLORS.accent} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 100 208 L 116 208 M 124 208 L 140 208" stroke={KOTODAMA_COLORS.accent} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
