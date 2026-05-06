/**
 * HANEI - ことだまトリ Stage 5: 守護神 (syugosin)
 * - 桜の神霊 / 金色の輝き
 * - 後光 + 桜の花びら + 金色の冠
 *
 * 進化アニメ (animate=true): 1.5s で光のオーラがゆっくり広がる
 */
import { KOTODAMA_COLORS, KOTODAMA_VIEWBOX, type KotodamaStageSvgProps } from "./colors";
import { ProgressArc } from "./progress-arc";

export function KotodamaSyugosinSvg({
  size = 240,
  className,
  label,
  animate = false,
  progress = 1,
  expression = "idle",
}: KotodamaStageSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={KOTODAMA_VIEWBOX}
      role="img"
      aria-label={label ?? "ことだまトリ・しゅごしん"}
      className={className}
      data-expression={expression}
    >
      <title>{label ?? "ことだまトリ・しゅごしん"}</title>

      {/* 後光 (Aura) */}
      <g opacity="0.6">
        <circle cx="120" cy="120" r="112" fill={KOTODAMA_COLORS.aura} opacity="0.3" />
        <circle cx="120" cy="120" r="100" fill={KOTODAMA_COLORS.aura} opacity="0.4" />
        {animate && (
          <animate
            attributeName="opacity"
            values="0.4;0.85;0.6;0.85;0.6"
            keyTimes="0;0.25;0.5;0.75;1"
            dur="1.5s"
            repeatCount="1"
          />
        )}
      </g>

      {/* 後光の光線 (8 方向 / 静止) */}
      <g opacity="0.7" stroke={KOTODAMA_COLORS.gold} strokeWidth="1.5" strokeLinecap="round">
        <line x1="120" y1="14" x2="120" y2="30" />
        <line x1="120" y1="210" x2="120" y2="226" />
        <line x1="14" y1="120" x2="30" y2="120" />
        <line x1="210" y1="120" x2="226" y2="120" />
        <line x1="44" y1="44" x2="56" y2="56" />
        <line x1="184" y1="56" x2="196" y2="44" />
        <line x1="44" y1="196" x2="56" y2="184" />
        <line x1="184" y1="184" x2="196" y2="196" />
      </g>

      <ProgressArc cx={120} cy={120} r={108} progress={progress} fillColor={KOTODAMA_COLORS.gold} />

      {/* 桜の花びら (背景に散らす / 4 枚) */}
      <g opacity="0.9">
        <circle cx="40" cy="80" r="6" fill={KOTODAMA_COLORS.sakura} />
        <circle cx="200" cy="80" r="6" fill={KOTODAMA_COLORS.sakura} />
        <circle cx="36" cy="180" r="5" fill={KOTODAMA_COLORS.sakura} />
        <circle cx="204" cy="180" r="5" fill={KOTODAMA_COLORS.sakura} />
      </g>

      {/* 翼 (大きく広がる / 金色 / 左) */}
      <g>
        <path
          d="M 86 130 Q 30 102 12 142 Q 28 168 70 162 Q 88 152 92 144 Z"
          fill={KOTODAMA_COLORS.gold}
        />
        <path
          d="M 86 130 Q 50 116 30 144"
          stroke={KOTODAMA_COLORS.primary}
          strokeWidth="1.8"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M 86 138 Q 56 134 38 158"
          stroke={KOTODAMA_COLORS.primary}
          strokeWidth="1.4"
          fill="none"
          opacity="0.6"
        />
      </g>

      {/* 翼 (右) */}
      <g>
        <path
          d="M 154 130 Q 210 102 228 142 Q 212 168 170 162 Q 152 152 148 144 Z"
          fill={KOTODAMA_COLORS.gold}
        />
        <path
          d="M 154 130 Q 190 116 210 144"
          stroke={KOTODAMA_COLORS.primary}
          strokeWidth="1.8"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M 154 138 Q 184 134 202 158"
          stroke={KOTODAMA_COLORS.primary}
          strokeWidth="1.4"
          fill="none"
          opacity="0.6"
        />
      </g>

      {/* 体 (Amber Gold で安定) */}
      <ellipse cx="120" cy="146" rx="40" ry="50" fill={KOTODAMA_COLORS.primary} />
      <ellipse cx="120" cy="152" rx="34" ry="42" fill={KOTODAMA_COLORS.gold} opacity="0.55" />
      <ellipse cx="120" cy="160" rx="18" ry="22" fill={KOTODAMA_COLORS.white} opacity="0.5" />

      {/* 胸の桜紋 */}
      <g>
        <circle cx="120" cy="150" r="6" fill={KOTODAMA_COLORS.sakura} />
        <circle cx="120" cy="142" r="3" fill={KOTODAMA_COLORS.white} opacity="0.85" />
        <circle cx="126" cy="148" r="3" fill={KOTODAMA_COLORS.white} opacity="0.85" />
        <circle cx="123" cy="155" r="3" fill={KOTODAMA_COLORS.white} opacity="0.85" />
        <circle cx="117" cy="155" r="3" fill={KOTODAMA_COLORS.white} opacity="0.85" />
        <circle cx="114" cy="148" r="3" fill={KOTODAMA_COLORS.white} opacity="0.85" />
      </g>

      {/* 頭 */}
      <ellipse cx="120" cy="98" rx="34" ry="34" fill={KOTODAMA_COLORS.primary} />
      <ellipse cx="110" cy="90" rx="12" ry="9" fill={KOTODAMA_COLORS.white} opacity="0.5" />

      {/* 神々しい眉 */}
      <path d="M 96 86 Q 104 82 112 86" stroke={KOTODAMA_COLORS.accent} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M 128 86 Q 136 82 144 86" stroke={KOTODAMA_COLORS.accent} strokeWidth="2.4" fill="none" strokeLinecap="round" />

      {/* 目 / くちばし (表情に応じて切替 / 守護神は gold ハイライト維持) */}
      {expression === "happy" ? (
        <g data-part="face-happy">
          <path d="M 100 100 Q 106 94 112 100" stroke={KOTODAMA_COLORS.black} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M 128 100 Q 134 94 140 100" stroke={KOTODAMA_COLORS.black} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M 112 113 Q 120 126 128 113 Z" fill={KOTODAMA_COLORS.gold} />
        </g>
      ) : expression === "thinking" ? (
        <g data-part="face-thinking">
          <ellipse cx="106" cy="98" rx="4" ry="6" fill={KOTODAMA_COLORS.black} />
          <ellipse cx="134" cy="98" rx="4" ry="6" fill={KOTODAMA_COLORS.black} />
          <circle cx="107" cy="95" r="1.6" fill={KOTODAMA_COLORS.gold} />
          <circle cx="135" cy="95" r="1.6" fill={KOTODAMA_COLORS.gold} />
          <path d="M 113 117 L 127 117" stroke={KOTODAMA_COLORS.gold} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      ) : (
        <g data-part="face-idle">
          <ellipse cx="106" cy="100" rx="4" ry="6" fill={KOTODAMA_COLORS.black} />
          <ellipse cx="134" cy="100" rx="4" ry="6" fill={KOTODAMA_COLORS.black} />
          <circle cx="107" cy="98" r="1.6" fill={KOTODAMA_COLORS.gold} />
          <circle cx="135" cy="98" r="1.6" fill={KOTODAMA_COLORS.gold} />
          <path d="M 113 113 L 127 113 L 120 124 Z" fill={KOTODAMA_COLORS.gold} />
        </g>
      )}

      {/* DEC-089 Plan C 項目 3: happy 時 目もとキラキラ + 後光増幅 */}
      {expression === "happy" && (
        <g data-part="syugosin-happy-sparkles" aria-hidden="true">
          <path
            d="M 96 84 L 98 80 L 100 84 L 96 84 Z M 98 80 L 98 76"
            stroke={KOTODAMA_COLORS.gold}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill={KOTODAMA_COLORS.gold}
            opacity="0.9"
          />
          <path
            d="M 144 84 L 146 80 L 148 84 L 144 84 Z M 146 80 L 146 76"
            stroke={KOTODAMA_COLORS.gold}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill={KOTODAMA_COLORS.gold}
            opacity="0.9"
          />
        </g>
      )}

      {/* DEC-089 Plan C 項目 3: 桜の花びら追加散布 (4 → 8 枚 / 神々しさ増強) */}
      <g data-part="syugosin-extra-petals" aria-hidden="true" opacity="0.85">
        <circle cx="60" cy="50" r="4" fill={KOTODAMA_COLORS.sakura} />
        <circle cx="180" cy="50" r="4" fill={KOTODAMA_COLORS.sakura} />
        <circle cx="60" cy="216" r="4" fill={KOTODAMA_COLORS.sakura} />
        <circle cx="180" cy="216" r="4" fill={KOTODAMA_COLORS.sakura} />
      </g>

      {/* 守護神の冠 (5 枚 / すべて gold + 中央桜) */}
      <path d="M 100 66 L 106 46 L 112 66 Z" fill={KOTODAMA_COLORS.gold} />
      <path d="M 110 60 L 116 36 L 122 60 Z" fill={KOTODAMA_COLORS.gold} />
      <path d="M 118 56 L 124 30 L 130 56 Z" fill={KOTODAMA_COLORS.gold} />
      <path d="M 124 60 L 130 38 L 136 60 Z" fill={KOTODAMA_COLORS.gold} />
      <path d="M 132 66 L 138 48 L 144 66 Z" fill={KOTODAMA_COLORS.gold} />
      {/* 中央桜紋 */}
      <circle cx="124" cy="40" r="4" fill={KOTODAMA_COLORS.sakura} />

      {/* 尾羽 (神々しい / 長い) */}
      <path d="M 120 196 Q 92 210 84 226 Q 116 218 120 206" fill={KOTODAMA_COLORS.gold} opacity="0.85" />
      <path d="M 120 196 Q 148 210 156 226 Q 124 218 120 206" fill={KOTODAMA_COLORS.gold} opacity="0.85" />

      {/* 足 */}
      <line x1="108" y1="196" x2="108" y2="210" stroke={KOTODAMA_COLORS.accent} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="132" y1="196" x2="132" y2="210" stroke={KOTODAMA_COLORS.accent} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 100 210 L 116 210 M 124 210 L 140 210" stroke={KOTODAMA_COLORS.accent} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
