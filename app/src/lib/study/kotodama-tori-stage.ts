/**
 * HANEI - ことだまトリ 5 段階育成 (W9-T1)
 *
 * 累計 XP / Streak / Badge 取得状況から「進化段階」を決定する純関数。
 * 既存 kotodama-tori-mood.ts (5 mood) は破壊せず横並びで stage を追加する。
 *
 * 進化条件:
 *
 *   | Stage     | 名前         | 条件                                  |
 *   |-----------|-------------|---------------------------------------|
 *   | hina      | 雛 (ひな)    | 初期                                   |
 *   | wakatori  | 若鳥        | XP >= 100 OR streak >= 3              |
 *   | seityo    | 成鳥        | XP >= 500 OR badgeCount >= 4          |
 *   | kenzya    | 賢者        | XP >= 1500 OR streak >= 30            |
 *   | syugosin  | 守護神      | XP >= 5000 AND 桜守 badge 取得         |
 *
 * 進化は「より高い段階の条件を満たすほど」上書きされる。退行はしない (DB 側でも保存)。
 *
 * UI / SSR / unit test 共通利用のため、副作用ゼロの純関数のみ export する。
 *
 * 設計:
 *  - 5 mood (kotodama-tori-mood.ts) は学習中の表情遷移
 *  - 5 stage (本ファイル) は累計成長の進化遷移
 *  - 両者は独立に変化し、組み合わせで「成鳥が celebrating している」のような表現が可能
 *
 * 並列 agent との衝突回避:
 *  - badge code (e.g. "sakuramori") は src/lib/badges/badge-codes.ts に共通定数を export
 *    する想定 (Agent W9-C と共有)。本モジュールが文字列リテラルを直接持つことを避ける。
 */

import {
  FIRST_MOCK_EXAM_BADGE_CODE,
  SAKURA_KEEPER_BADGE_CODE,
} from "@/lib/badges/badge-codes";

export type KotodamaStage =
  | "hina"
  | "wakatori"
  | "seityo"
  | "kenzya"
  | "syugosin";

export interface KotodamaStageInput {
  /** 累計 XP (xp_levels.totalXp) */
  totalXp: number;
  /** 現在の streak 日数 (streaks.currentStreak) */
  currentStreak: number;
  /** 取得済 badge 件数 (user_badges count) */
  badgeCount: number;
  /** 取得済 badge code 配列 (badges.code) — 守護神条件で sakuramori を確認 */
  badgeCodes?: ReadonlyArray<string>;
}

export interface KotodamaStageInfo {
  stage: KotodamaStage;
  /** 日本語ラベル (UI 表示) */
  label: string;
  /** ふりがな表記 (ruby 用) */
  furigana: string;
  /** 平易な日本語説明 (ですます調 / 絵文字なし) */
  description: string;
  /** 次段階 (最終なら null) */
  nextStage: KotodamaStage | null;
  /** 次段階までの進捗ヒント (UI 表示用 / "あと N XP" など) */
  nextStageHint: string | null;
  /** 0..1 の正規化進捗 (現段階 -> 次段階) */
  progressToNext: number;
}

interface StageDef {
  stage: KotodamaStage;
  label: string;
  furigana: string;
  description: string;
  /** 次段階の達成条件閾値 (XP) — 進捗計算と表示に使用。null = 最終段階 */
  nextXpHint: number | null;
}

/**
 * Stage 定義 (順序が進化順 / index で前後比較可能)。
 */
const STAGE_DEFS: ReadonlyArray<StageDef> = [
  {
    stage: "hina",
    label: "ひな",
    furigana: "雛",
    description:
      "たまごから かえったばかりの ひなどりです。これから いっしょに そだちましょう。",
    nextXpHint: 100,
  },
  {
    stage: "wakatori",
    label: "わかとり",
    furigana: "若鳥",
    description:
      "はねが はえそろい、りりしい わかどりに なりました。",
    nextXpHint: 500,
  },
  {
    stage: "seityo",
    label: "せいちょう",
    furigana: "成鳥",
    description:
      "おとなの ふうかくです。つばさを ひろげて とびまわれます。",
    nextXpHint: 1500,
  },
  {
    stage: "kenzya",
    label: "けんじゃ",
    furigana: "賢者",
    description:
      "ちせいの まなざしを そなえた けんじゃです。まきものを たずさえています。",
    nextXpHint: 5000,
  },
  {
    stage: "syugosin",
    label: "しゅごしん",
    furigana: "守護神",
    description:
      "さくらの しんれいと なりました。きんいろの ひかりを まとっています。",
    nextXpHint: null,
  },
];

const STAGE_ORDER: ReadonlyArray<KotodamaStage> = STAGE_DEFS.map((d) => d.stage);

/**
 * 入力から到達可能な最高段階を決定する純関数。
 *
 * - 高い段階の条件から順に評価し、満たすものが見つかった時点で確定
 * - 退行はしない (高い stage の条件を一度満たした学習者は DB 側でも保持される)
 */
export function getKotodamaStage(input: KotodamaStageInput): KotodamaStage {
  const totalXp = Number.isFinite(input.totalXp) && input.totalXp > 0 ? input.totalXp : 0;
  const currentStreak =
    Number.isFinite(input.currentStreak) && input.currentStreak > 0
      ? input.currentStreak
      : 0;
  const badgeCount =
    Number.isFinite(input.badgeCount) && input.badgeCount > 0 ? input.badgeCount : 0;
  const badgeCodes = input.badgeCodes ?? [];
  const hasGuardianBadge = badgeCodes.includes(SAKURA_KEEPER_BADGE_CODE);
  const hasMockExamBadge = badgeCodes.includes(FIRST_MOCK_EXAM_BADGE_CODE);

  // 守護神: XP >= 5000 AND 桜守 badge 取得
  if (totalXp >= 5000 && hasGuardianBadge) return "syugosin";

  // 賢者: XP >= 1500 OR streak >= 30 OR 模試デビュー badge
  if (totalXp >= 1500 || currentStreak >= 30 || hasMockExamBadge) return "kenzya";

  // 成鳥: XP >= 500 OR badgeCount >= 4
  if (totalXp >= 500 || badgeCount >= 4) return "seityo";

  // 若鳥: XP >= 100 OR streak >= 3
  if (totalXp >= 100 || currentStreak >= 3) return "wakatori";

  return "hina";
}

/**
 * 「現在 stage」と「直前に保存されていた stage」を比較し、
 * 進化が起こったか / どの stage に進化したかを返す。
 *
 * 退行は false 扱い (DB 側で stage を巻き戻さない設計)。
 */
export interface EvolutionDelta {
  /** 進化が発生したか (現 > 直前) */
  evolved: boolean;
  /** 進化先 stage (evolved=true のみ意味あり) */
  toStage: KotodamaStage | null;
  /** 進化前 stage (退行 / 未変化を含めて記録) */
  fromStage: KotodamaStage;
}

export function detectEvolution(
  previousStage: KotodamaStage | null | undefined,
  currentStage: KotodamaStage,
): EvolutionDelta {
  const prev: KotodamaStage = previousStage ?? "hina";
  const prevIdx = STAGE_ORDER.indexOf(prev);
  const curIdx = STAGE_ORDER.indexOf(currentStage);
  // 退行 / 未変化は false
  if (curIdx <= prevIdx) {
    return { evolved: false, toStage: null, fromStage: prev };
  }
  return { evolved: true, toStage: currentStage, fromStage: prev };
}

/**
 * UI 表示用の総合パッケージ。
 * - label / description / 次段階ヒント / 進捗 (0..1)
 */
export function describeKotodamaStage(
  input: KotodamaStageInput,
): KotodamaStageInfo {
  const stage = getKotodamaStage(input);
  const def = STAGE_DEFS.find((d) => d.stage === stage)!;
  const idx = STAGE_DEFS.indexOf(def);
  const nextDef = idx >= 0 && idx < STAGE_DEFS.length - 1 ? STAGE_DEFS[idx + 1] : null;

  // 進捗計算: XP 主軸 (0..1)
  let progressToNext = 0;
  let nextStageHint: string | null = null;

  if (nextDef && def.nextXpHint !== null) {
    const totalXp =
      Number.isFinite(input.totalXp) && input.totalXp > 0 ? input.totalXp : 0;
    // 直前段階の XP しきい値 (idx-1 の nextXpHint) を起点とする
    const previousXpFloor =
      idx === 0 ? 0 : (STAGE_DEFS[idx - 1]?.nextXpHint ?? 0);
    const span = Math.max(1, def.nextXpHint - previousXpFloor);
    const offset = Math.max(0, totalXp - previousXpFloor);
    progressToNext = Math.min(1, offset / span);
    const remainingXp = Math.max(0, def.nextXpHint - totalXp);
    nextStageHint =
      remainingXp > 0
        ? `あと ${remainingXp} XP で つぎの だんかいです`
        : "つぎの だんかいの じゅんびが ととのいました";
  } else {
    progressToNext = 1;
    nextStageHint = null;
  }

  return {
    stage: def.stage,
    label: def.label,
    furigana: def.furigana,
    description: def.description,
    nextStage: nextDef ? nextDef.stage : null,
    nextStageHint,
    progressToNext,
  };
}

/** 全段階一覧 (順序通り) */
export function getAllKotodamaStages(): ReadonlyArray<KotodamaStage> {
  return STAGE_ORDER;
}

/** 段階ラベル取得 (テスト / weekly digest 用) */
export function getKotodamaStageLabel(stage: KotodamaStage): string {
  return STAGE_DEFS.find((d) => d.stage === stage)?.label ?? stage;
}
