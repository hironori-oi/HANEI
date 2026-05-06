/**
 * HANEI - ことだまトリ Stage 1: 雛 (hina)
 * - たまごから かえったばかりの ひよこ
 * - ぽてっとした幼さ / 殻の名残あり
 * - viewBox 240x240 / Amber Gold パレット
 *
 * 進化アニメ (animate=true): 1.5s で殻からぽよん (transform scale + opacity)
 */
import { KOTODAMA_COLORS, KOTODAMA_VIEWBOX, type KotodamaStageSvgProps } from "./colors";
import { ProgressArc } from "./progress-arc";

export function KotodamaHinaSvg({
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
      aria-label={label ?? "ことだまトリ・ひな"}
      className={className}
      data-expression={expression}
    >
      <title>{label ?? "ことだまトリ・ひな"}</title>

      {/* 進化進捗 円弧 (外周) */}
      <ProgressArc cx={120} cy={120} r={108} progress={progress} />

      {/* 殻の下半分 (まだ卵に乗っている) */}
      <path
        d="M 80 180 Q 80 210 120 210 Q 160 210 160 180 Z"
        fill={KOTODAMA_COLORS.white}
        stroke={KOTODAMA_COLORS.shadow}
        strokeWidth="1.5"
      />
      <path
        d="M 92 180 L 100 174 L 108 180 L 116 173 L 124 180 L 132 174 L 140 180 L 148 174 L 156 180"
        stroke={KOTODAMA_COLORS.shadow}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* 体 (ぽてっとした卵型) */}
      <ellipse cx="120" cy="138" rx="48" ry="48" fill={KOTODAMA_COLORS.base} />
      <ellipse
        cx="120"
        cy="148"
        rx="42"
        ry="38"
        fill={KOTODAMA_COLORS.primary}
        opacity="0.85"
      />

      {/* お腹のハイライト */}
      <ellipse cx="120" cy="155" rx="22" ry="22" fill={KOTODAMA_COLORS.white} opacity="0.55" />

      {/* 頭 (体と一体だが、ハイライトで顔の存在を表す) */}
      <ellipse cx="120" cy="115" rx="38" ry="34" fill={KOTODAMA_COLORS.base} />
      <ellipse cx="108" cy="108" rx="14" ry="11" fill={KOTODAMA_COLORS.white} opacity="0.5" />

      {/* 目 / くちばし (表情に応じて切替) */}
      {expression === "happy" ? (
        // happy: ニコッと弧目 (^_^) + 開いた笑顔くちばし
        <g data-part="face-happy">
          <path
            d="M 100 116 Q 106 110 112 116"
            stroke={KOTODAMA_COLORS.black}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 128 116 Q 134 110 140 116"
            stroke={KOTODAMA_COLORS.black}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 113 128 Q 120 138 127 128 Z"
            fill={KOTODAMA_COLORS.accent}
          />
        </g>
      ) : expression === "thinking" ? (
        // thinking: 上を向く目 + 小さな閉じくちばし
        <g data-part="face-thinking">
          <circle cx="106" cy="114" r="5" fill={KOTODAMA_COLORS.black} />
          <circle cx="134" cy="114" r="5" fill={KOTODAMA_COLORS.black} />
          <circle cx="107.5" cy="111" r="1.6" fill={KOTODAMA_COLORS.white} />
          <circle cx="135.5" cy="111" r="1.6" fill={KOTODAMA_COLORS.white} />
          <path
            d="M 115 130 L 125 130"
            stroke={KOTODAMA_COLORS.accent}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      ) : (
        // idle: 既存のぱっちり 2 つ + 小さな三角くちばし
        <g data-part="face-idle">
          <circle cx="106" cy="116" r="5" fill={KOTODAMA_COLORS.black} />
          <circle cx="134" cy="116" r="5" fill={KOTODAMA_COLORS.black} />
          <circle cx="107.5" cy="114" r="1.6" fill={KOTODAMA_COLORS.white} />
          <circle cx="135.5" cy="114" r="1.6" fill={KOTODAMA_COLORS.white} />
          <path
            d="M 115 128 L 125 128 L 120 134 Z"
            fill={KOTODAMA_COLORS.accent}
          />
        </g>
      )}

      {/* ほっぺ (ピンクぽち) */}
      <circle cx="98" cy="124" r="3.5" fill={KOTODAMA_COLORS.sakura} opacity="0.7" />
      <circle cx="142" cy="124" r="3.5" fill={KOTODAMA_COLORS.sakura} opacity="0.7" />

      {/* DEC-089 Plan C 項目 3: happy 時に目もとキラキラ追加 (罰則ゼロ / sparkle のみ) */}
      {expression === "happy" && (
        <g data-part="hina-happy-sparkles" aria-hidden="true">
          <path
            d="M 96 104 L 98 100 L 100 104 L 96 104 Z M 98 100 L 98 96"
            stroke={KOTODAMA_COLORS.gold}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill={KOTODAMA_COLORS.gold}
            opacity="0.85"
          />
          <path
            d="M 144 104 L 146 100 L 148 104 L 144 104 Z M 146 100 L 146 96"
            stroke={KOTODAMA_COLORS.gold}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill={KOTODAMA_COLORS.gold}
            opacity="0.85"
          />
        </g>
      )}

      {/* DEC-089 Plan C 項目 3: 体側面の幼羽飾り (左右 2 つ・うす Amber) */}
      <g data-part="hina-side-feathers" aria-hidden="true" opacity="0.85">
        <path
          d="M 76 142 Q 70 150 74 158 Q 80 156 82 150 Z"
          fill={KOTODAMA_COLORS.shadow}
          opacity="0.55"
        />
        <path
          d="M 164 142 Q 170 150 166 158 Q 160 156 158 150 Z"
          fill={KOTODAMA_COLORS.shadow}
          opacity="0.55"
        />
      </g>

      {/* ぴよぴよ羽 (頭頂 3 本) */}
      <line
        x1="120"
        y1="82"
        x2="120"
        y2="74"
        stroke={KOTODAMA_COLORS.shadow}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="112"
        y1="83"
        x2="108"
        y2="76"
        stroke={KOTODAMA_COLORS.shadow}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="128"
        y1="83"
        x2="132"
        y2="76"
        stroke={KOTODAMA_COLORS.shadow}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 進化アニメ: 1.5s でぽよん (transform scale) */}
      {animate && (
        <g>
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1;1.08;0.96;1.04;1"
            keyTimes="0;0.25;0.5;0.75;1"
            dur="1.5s"
            repeatCount="1"
            additive="sum"
          />
        </g>
      )}
    </svg>
  );
}
