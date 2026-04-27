"use client";

/**
 * ことだまトリ (Kotodama-tori) — 学習画面コンパニオン (W5 / G-5)
 *
 * 設計仕様: projects/PRJ-016/reports/design-w1-character.md (10 ポーズ / mood)
 * マイクロコピー: projects/PRJ-016/reports/design-w1-microcopy.md
 *
 * Phase 1 = CSS classes + Heroicons + テキスト文言で 5 mood を表現。
 * 外部 Lottie / 重い PNG は使わない (DEC-012 無料運用)。
 *
 * Mood 遷移ロジック (pickMood) は純関数として export し、ユニットテスト対象。
 */

import {
  FaceSmileIcon,
  SparklesIcon,
  HeartIcon,
  AcademicCapIcon,
  HandRaisedIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import {
  type KotodamaMood,
  type LastResult,
  pickMood,
} from "@/components/study/kotodama-tori-mood";

export { pickMood };
export type { KotodamaMood, LastResult };

interface MoodPresentation {
  icon: typeof FaceSmileIcon;
  /** 表情を表すラベル (aria-label / sr-only 用) */
  label: string;
  /** Tailwind クラス: 背景・ボーダー */
  containerClass: string;
  /** Tailwind クラス: アイコン色 */
  iconClass: string;
  /** モーション用追加クラス (prefers-reduced-motion で無効化) */
  motionClass: string;
}

const MOOD_PRESENTATION: Record<KotodamaMood, MoodPresentation> = {
  thinking: {
    icon: AcademicCapIcon,
    label: "ことだまトリ・かんがえちゅう",
    containerClass: "border-primary/30 bg-primary/5",
    iconClass: "text-primary",
    motionClass: "",
  },
  cheerful: {
    icon: FaceSmileIcon,
    label: "ことだまトリ・うれしそう",
    containerClass: "border-success/40 bg-success/10",
    iconClass: "text-success",
    motionClass: "motion-safe:animate-bounce",
  },
  celebrating: {
    icon: SparklesIcon,
    label: "ことだまトリ・おおよろこび",
    containerClass:
      "border-success/60 bg-gradient-to-br from-success/15 to-primary/15",
    iconClass: "text-success",
    motionClass: "motion-safe:animate-pulse",
  },
  sad: {
    icon: HandRaisedIcon,
    label: "ことだまトリ・しょんぼり",
    containerClass: "border-warning/40 bg-warning/5",
    iconClass: "text-warning",
    motionClass: "",
  },
  encouraging: {
    icon: HeartIcon,
    label: "ことだまトリ・はげましちゅう",
    containerClass: "border-accent/40 bg-accent/10",
    iconClass: "text-accent-foreground",
    motionClass: "",
  },
};

/**
 * mood ごとのマイクロコピー (design-w1-microcopy.md より抜粋)。
 * 「ですます調 / 絵文字なし / 小学生向け」を厳守。
 */
const MOOD_MESSAGE: Record<KotodamaMood, string> = {
  thinking: "つぎの もんだいを いっしょに みてみましょう。",
  cheerful: "いいですね、かんがえかたが あっています。",
  celebrating: "れんぞくで せいかいですね。つづける ちからが ついてきています。",
  sad: "おしいです。もういちど いっしょに みなおしてみましょう。",
  encouraging: "だいじょうぶです。つぎは きづけますよ。",
};

export interface KotodamaToriProps {
  mood: KotodamaMood;
  /** 直近 streak 数 (連続正解) */
  streak: number;
  lastResult: LastResult;
  /** メッセージを上書き (任意 / テスト用) */
  messageOverride?: string;
  className?: string;
}

export function KotodamaTori(props: KotodamaToriProps) {
  const { mood, streak, lastResult, messageOverride, className } = props;
  const presentation = MOOD_PRESENTATION[mood];
  const Icon = presentation.icon;
  const message = messageOverride ?? MOOD_MESSAGE[mood];

  return (
    <section
      data-testid="kotodama-tori"
      data-mood={mood}
      data-streak={streak}
      data-last-result={lastResult ?? "none"}
      aria-label="ことだまトリ"
      className={cn(
        "flex items-center gap-4 rounded-lg border-2 px-4 py-3",
        presentation.containerClass,
        className,
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-card shadow-sm",
          presentation.motionClass,
        )}
        aria-hidden="true"
      >
        <Icon className={cn("h-8 w-8", presentation.iconClass)} />
      </div>
      <div className="flex-1 space-y-1">
        <p className="sr-only">{presentation.label}</p>
        <p className="text-sm leading-relaxed text-foreground sm:text-base">
          {message}
        </p>
        {streak >= 3 && (
          <p className="text-xs font-bold text-primary">
            <ruby>
              連続正解
              <rt>れんぞくせいかい</rt>
            </ruby>{" "}
            {streak} かい
          </p>
        )}
      </div>
    </section>
  );
}
