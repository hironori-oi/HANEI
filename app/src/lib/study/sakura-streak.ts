/**
 * HANEI - 桜の木メタファ Streak 表示 (W8-T6)
 *
 * Duolingo 流の「炎アイコン」を **「桜の木が育つ」メタファ** に置換する。
 * HANEI の独自差別化軸 (Duolingo は「無限の道」 / HANEI は「半年で桜咲く山頂」)。
 *
 * 7 段階 (countdown-variant 7 段階と semantic に対応):
 *   1 日:        "seed"      (種)
 *   2-6 日:      "sprout"    (芽)
 *   7-13 日:     "leaves"    (若葉)
 *   14-29 日:    "bud"       (蕾)
 *   30-89 日:    "bloom"     (開花)
 *   90-179 日:   "fullbloom" (満開)
 *   180+ 日:     "grove"     (桜並木)
 *
 * 0 日 = まだ Streak が無い状態は "seed" 同様の見た目だが、UI 側で
 * 「まだはじまっていません」のマイクロコピーに切り替える運用 (Phase 2)。
 *
 * 純関数のみ export し、UI / SSR / unit test で共通利用する。
 */

export type SakuraStage =
  | "seed"
  | "sprout"
  | "leaves"
  | "bud"
  | "bloom"
  | "fullbloom"
  | "grove";

export interface SakuraStageInfo {
  stage: SakuraStage;
  /** 日本語ラベル (UI 表示用 / 小学生にも読める) */
  label: string;
  /** 平易な日本語のひとこと説明 */
  description: string;
  /** 次の段階に進むのに必要な日数 (最後段階なら null) */
  nextStageInDays: number | null;
  /** 次の段階の名称 (最後段階なら null) */
  nextStage: SakuraStage | null;
}

/**
 * Stage 定義 (境界値: streakDays >= minDays && streakDays <= maxDays)。
 * maxDays が null なら最終段階 (上限なし)。
 */
interface StageDef {
  stage: SakuraStage;
  minDays: number;
  /** null = 上限なし (最終段階) */
  maxDays: number | null;
  label: string;
  description: string;
}

const STAGE_DEFS: ReadonlyArray<StageDef> = [
  {
    stage: "seed",
    minDays: 0,
    maxDays: 1,
    label: "たね",
    description: "はじまりの たね。きょう ひとつぶ まきましょう。",
  },
  {
    stage: "sprout",
    minDays: 2,
    maxDays: 6,
    label: "め",
    description: "ちいさな めが でました。みずを やる ように 学習を つづけましょう。",
  },
  {
    stage: "leaves",
    minDays: 7,
    maxDays: 13,
    label: "わかば",
    description: "わかばが ひろがりました。1 しゅうかん つづいています。",
  },
  {
    stage: "bud",
    minDays: 14,
    maxDays: 29,
    label: "つぼみ",
    description: "つぼみが ふくらんでいます。あと すこしで さきそうです。",
  },
  {
    stage: "bloom",
    minDays: 30,
    maxDays: 89,
    label: "かいか",
    description: "さくらが さきました。1 か月の つみかさねの しょうこです。",
  },
  {
    stage: "fullbloom",
    minDays: 90,
    maxDays: 179,
    label: "まんかい",
    description: "まんかいの さくらです。3 か月の どりょくが みのっています。",
  },
  {
    stage: "grove",
    minDays: 180,
    maxDays: null,
    label: "さくらなみき",
    description: "さくらなみきに なりました。半年の どりょくは すごい ことです。",
  },
];

/**
 * streak 日数から桜の木の段階を返す純関数。
 *
 * - 負の値 / NaN は seed 扱い (UI 側で「まだはじまっていません」表記)
 * - 0 日 = seed (まだ tap していない / 未開始)
 * - 1 日 = seed (1 日目 = タネを蒔いた直後)
 * - 2 日目から sprout に進む (「2 日続いた = 芽が出た」を視覚化)
 */
export function pickSakuraStage(streakDays: number): SakuraStage {
  if (!Number.isFinite(streakDays) || streakDays < 0) return "seed";
  const days = Math.floor(streakDays);
  for (const def of STAGE_DEFS) {
    if (def.maxDays === null) {
      if (days >= def.minDays) return def.stage;
    } else if (days >= def.minDays && days <= def.maxDays) {
      return def.stage;
    }
  }
  return "seed";
}

/**
 * 段階情報 (UI 表示の総合パッケージ) を返す純関数。
 * 「あと X 日で次の段階！」マイクロコピー用に next* も返す。
 */
export function describeSakuraStage(streakDays: number): SakuraStageInfo {
  const stage = pickSakuraStage(streakDays);
  const def = STAGE_DEFS.find((d) => d.stage === stage)!;
  const idx = STAGE_DEFS.indexOf(def);
  const nextDef = idx >= 0 && idx < STAGE_DEFS.length - 1 ? STAGE_DEFS[idx + 1] : null;

  let nextStageInDays: number | null = null;
  if (nextDef) {
    const days = Math.max(0, Math.floor(streakDays));
    nextStageInDays = Math.max(0, nextDef.minDays - days);
  }

  return {
    stage: def.stage,
    label: def.label,
    description: def.description,
    nextStageInDays,
    nextStage: nextDef ? nextDef.stage : null,
  };
}

/** 全 stage 一覧 (settings preview / weekly-digest メールで利用) */
export function getAllSakuraStages(): ReadonlyArray<SakuraStage> {
  return STAGE_DEFS.map((d) => d.stage);
}
