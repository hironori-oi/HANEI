/**
 * HANEI - ことだまトリ Stage 2: 若鳥 (wakatori)
 * - 羽が生え揃った 凛々しい若鳥
 * - 翼が体の側面に出始めている / 嘴がしっかり
 *
 * 進化アニメ (animate=true): 1.5s で羽ばたき (翼の透明度 / scale)
 */
import { KOTODAMA_COLORS, KOTODAMA_VIEWBOX, type KotodamaStageSvgProps } from "./colors";
import { ProgressArc } from "./progress-arc";

export function KotodamaWakatoriSvg({
  size = 240,
  className,
  label,
  animate = false,
  progress = 0,
  expression = "idle",
}: KotodamaStageSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={KOTODAMA_VIEWBOX}
      role="img"
      aria-label={label ?? "ことだまトリ・わかとり"}
      className={className}
      data-expression={expression}
    >
      <title>{label ?? "ことだまトリ・わかとり"}</title>

      <ProgressArc cx={120} cy={120} r={108} progress={progress} />

      {/* 体 (やや縦長 / 羽が生え揃ってきた) */}
      <ellipse cx="120" cy="142" rx="48" ry="56" fill={KOTODAMA_COLORS.base} />
      <ellipse
        cx="120"
        cy="148"
        rx="42"
        ry="48"
        fill={KOTODAMA_COLORS.primary}
        opacity="0.85"
      />

      {/* お腹のハイライト */}
      <ellipse cx="120" cy="158" rx="20" ry="26" fill={KOTODAMA_COLORS.white} opacity="0.5" />

      {/* 翼 (左) */}
      <g>
        <path
          d="M 78 132 Q 60 140 64 168 Q 78 168 90 158 Q 96 144 92 132 Z"
          fill={KOTODAMA_COLORS.shadow}
        />
        <path
          d="M 80 138 Q 72 148 78 162"
          stroke={KOTODAMA_COLORS.accent}
          strokeWidth="1.2"
          fill="none"
          opacity="0.5"
        />
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 90 142;-15 90 142;0 90 142"
            keyTimes="0;0.5;1"
            dur="1.5s"
            repeatCount="1"
          />
        )}
      </g>

      {/* 翼 (右) */}
      <g>
        <path
          d="M 162 132 Q 180 140 176 168 Q 162 168 150 158 Q 144 144 148 132 Z"
          fill={KOTODAMA_COLORS.shadow}
        />
        <path
          d="M 160 138 Q 168 148 162 162"
          stroke={KOTODAMA_COLORS.accent}
          strokeWidth="1.2"
          fill="none"
          opacity="0.5"
        />
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 150 142;15 150 142;0 150 142"
            keyTimes="0;0.5;1"
            dur="1.5s"
            repeatCount="1"
          />
        )}
      </g>

      {/* 頭 */}
      <ellipse cx="120" cy="100" rx="36" ry="34" fill={KOTODAMA_COLORS.base} />
      <ellipse cx="108" cy="92" rx="14" ry="11" fill={KOTODAMA_COLORS.white} opacity="0.55" />

      {/* 目 / くちばし (表情に応じて切替) */}
      {expression === "happy" ? (
        <g data-part="face-happy">
          <path d="M 100 100 Q 106 94 112 100" stroke={KOTODAMA_COLORS.black} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M 128 100 Q 134 94 140 100" stroke={KOTODAMA_COLORS.black} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M 112 113 Q 120 124 128 113 Z" fill={KOTODAMA_COLORS.accent} />
        </g>
      ) : expression === "thinking" ? (
        <g data-part="face-thinking">
          <ellipse cx="106" cy="98" rx="4" ry="5" fill={KOTODAMA_COLORS.black} />
          <ellipse cx="134" cy="98" rx="4" ry="5" fill={KOTODAMA_COLORS.black} />
          <circle cx="107" cy="95" r="1.4" fill={KOTODAMA_COLORS.white} />
          <circle cx="135" cy="95" r="1.4" fill={KOTODAMA_COLORS.white} />
          <path d="M 114 117 L 126 117" stroke={KOTODAMA_COLORS.accent} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      ) : (
        <g data-part="face-idle">
          <ellipse cx="106" cy="100" rx="4" ry="5" fill={KOTODAMA_COLORS.black} />
          <ellipse cx="134" cy="100" rx="4" ry="5" fill={KOTODAMA_COLORS.black} />
          <circle cx="107" cy="98" r="1.4" fill={KOTODAMA_COLORS.white} />
          <circle cx="135" cy="98" r="1.4" fill={KOTODAMA_COLORS.white} />
          <path d="M 113 113 L 127 113 L 120 122 Z" fill={KOTODAMA_COLORS.accent} />
        </g>
      )}

      {/* ほっぺ */}
      <circle cx="96" cy="108" r="3" fill={KOTODAMA_COLORS.sakura} opacity="0.6" />
      <circle cx="144" cy="108" r="3" fill={KOTODAMA_COLORS.sakura} opacity="0.6" />

      {/* DEC-089 Plan C 項目 3: happy 時 目もとキラキラ (Gold sparkle) */}
      {expression === "happy" && (
        <g data-part="wakatori-happy-sparkles" aria-hidden="true">
          <path
            d="M 96 88 L 98 84 L 100 88 L 96 88 Z M 98 84 L 98 80"
            stroke={KOTODAMA_COLORS.gold}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill={KOTODAMA_COLORS.gold}
            opacity="0.85"
          />
          <path
            d="M 144 88 L 146 84 L 148 88 L 144 88 Z M 146 84 L 146 80"
            stroke={KOTODAMA_COLORS.gold}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill={KOTODAMA_COLORS.gold}
            opacity="0.85"
          />
        </g>
      )}

      {/* DEC-089 Plan C 項目 3: 翼先の追加飾り羽 (左右 / 若鳥らしい三角羽 1 枚ずつ) */}
      <g data-part="wakatori-wing-tip-feathers" aria-hidden="true">
        <path
          d="M 64 168 L 60 178 L 70 174 Z"
          fill={KOTODAMA_COLORS.shadow}
          opacity="0.7"
        />
        <path
          d="M 176 168 L 180 178 L 170 174 Z"
          fill={KOTODAMA_COLORS.shadow}
          opacity="0.7"
        />
      </g>

      {/* 頭頂の羽飾り (3 枚 / 凛々しい三角) */}
      <path
        d="M 110 70 L 116 56 L 122 70 Z"
        fill={KOTODAMA_COLORS.primary}
      />
      <path
        d="M 118 66 L 124 50 L 130 66 Z"
        fill={KOTODAMA_COLORS.shadow}
      />
      <path
        d="M 126 70 L 132 58 L 138 70 Z"
        fill={KOTODAMA_COLORS.primary}
      />

      {/* 足 (2 本) */}
      <line x1="108" y1="194" x2="108" y2="206" stroke={KOTODAMA_COLORS.accent} strokeWidth="3" strokeLinecap="round" />
      <line x1="132" y1="194" x2="132" y2="206" stroke={KOTODAMA_COLORS.accent} strokeWidth="3" strokeLinecap="round" />
      <path d="M 102 206 L 114 206 M 126 206 L 138 206" stroke={KOTODAMA_COLORS.accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
