/**
 * HANEI - Daily Quest Templates (W10-T3)
 *
 * Daily Quest の「種別」定義とその文言・進捗ルール。
 * すべての値はビルド時に固定される定数 (純データ / 純関数のみ)。
 *
 * Phase 1 (W10-T3) スコープ:
 *   - 7 種を定義
 *   - 'mock_warmup' は Phase 3 で実装する模試予熱機能の placeholder。
 *     Phase 1 では生成候補から除外する (selectableTypes() で false 返し)。
 *
 * 子ども向け文言ガイドライン:
 *   - 否定形を使わない
 *   - 数字は半角 / 「ハネキン」「もんだい」「とう」など平仮名/カタカナ寄せ
 *   - DEC-024 罰則ゼロと整合 (未達でも diss しない)
 */

import { COIN_REWARDS } from "@/lib/economy/ledger";

export type QuestType =
  | "vocab_count"
  | "listening_perfect"
  | "reading_count"
  | "writing_count"
  | "streak_keep"
  | "badge_progress"
  | "mock_warmup";

export const ALL_QUEST_TYPES = [
  "vocab_count",
  "listening_perfect",
  "reading_count",
  "writing_count",
  "streak_keep",
  "badge_progress",
  "mock_warmup",
] as const satisfies ReadonlyArray<QuestType>;

export function isQuestType(value: unknown): value is QuestType {
  return (
    typeof value === "string" &&
    (ALL_QUEST_TYPES as ReadonlyArray<string>).includes(value)
  );
}

/**
 * 進捗を加算する条件。submitAnswer の hook 側で skill / isCorrect から
 * 「どの quest_type を += 1 するか」を判定する。
 */
export type QuestProgressTrigger =
  /** 正解 1 問につき +1 (skill が match した場合) */
  | { kind: "answer_correct"; skill: "vocabulary" | "listening" | "reading" | "writing" }
  /** 解答 (正誤を問わず) 1 問につき +1 (skill が match した場合) */
  | { kind: "answer_any"; skill: "vocabulary" | "listening" | "reading" | "writing" }
  /** 1 日 1 回でも解いたら +1 (streak_keep / 累積でなく boolean 的に) */
  | { kind: "any_answer_today" }
  /** 模試 1 回完了で +1 (Phase 3 stub / Phase 1 は trigger を発火させない) */
  | { kind: "mock_complete" };

export interface QuestTemplate {
  /** quest_type 識別子 */
  type: QuestType;
  /** UI タイトル placeholder ({target} を置換) */
  titleTemplate: string;
  /** 目標値の候補 (deterministic に 1 つ pick される) */
  targetCandidates: ReadonlyArray<number>;
  /** 完了報酬 (規定値: COIN_REWARDS.QUEST_COMPLETE = 15) */
  rewardCoins: number;
  /** 進捗加算 trigger */
  trigger: QuestProgressTrigger;
  /**
   * Phase 1 で生成候補に含めるか。false の場合 selectableTypes() から除外。
   */
  enabled: boolean;
}

const REWARD = COIN_REWARDS.QUEST_COMPLETE;

export const QUEST_TEMPLATES: Readonly<Record<QuestType, QuestTemplate>> = {
  vocab_count: {
    type: "vocab_count",
    titleTemplate: "ごい もんだいを {target} もんせいかいする",
    targetCandidates: [3, 5, 7],
    rewardCoins: REWARD,
    trigger: { kind: "answer_correct", skill: "vocabulary" },
    enabled: true,
  },
  listening_perfect: {
    type: "listening_perfect",
    titleTemplate: "リスニング {target} もんを ぜんもんせいかい",
    targetCandidates: [2, 3],
    rewardCoins: REWARD,
    trigger: { kind: "answer_correct", skill: "listening" },
    enabled: true,
  },
  reading_count: {
    type: "reading_count",
    titleTemplate: "どっかい {target} もんに とりくむ",
    targetCandidates: [2, 3],
    rewardCoins: REWARD,
    trigger: { kind: "answer_any", skill: "reading" },
    enabled: true,
  },
  writing_count: {
    type: "writing_count",
    titleTemplate: "ライティング {target} もんに チャレンジ",
    targetCandidates: [1, 2],
    rewardCoins: REWARD,
    trigger: { kind: "answer_any", skill: "writing" },
    enabled: true,
  },
  streak_keep: {
    type: "streak_keep",
    titleTemplate: "きょうも 1 もんでも とりくむ",
    targetCandidates: [1],
    rewardCoins: REWARD,
    trigger: { kind: "any_answer_today" },
    enabled: true,
  },
  badge_progress: {
    type: "badge_progress",
    titleTemplate: "きょう {target} もんを せいかいする",
    targetCandidates: [5, 7, 10],
    rewardCoins: REWARD,
    trigger: { kind: "answer_correct", skill: "vocabulary" }, // 汎用 placeholder
    enabled: true,
  },
  mock_warmup: {
    type: "mock_warmup",
    titleTemplate: "ミニ もし に 1 かい いどむ",
    targetCandidates: [1],
    rewardCoins: REWARD,
    trigger: { kind: "mock_complete" },
    enabled: false, // Phase 3 で有効化
  },
};

/**
 * Phase 1 で生成候補に含めるべき quest_type を返す。
 * - mock_warmup は除外 (Phase 3 で機能追加)
 */
export function selectableTypes(): ReadonlyArray<QuestType> {
  return ALL_QUEST_TYPES.filter((t) => QUEST_TEMPLATES[t].enabled);
}

/**
 * titleTemplate から target 埋め込み済タイトル文字列を作る。
 */
export function renderQuestTitle(type: QuestType, target: number): string {
  const tpl = QUEST_TEMPLATES[type];
  return tpl.titleTemplate.replace("{target}", String(target));
}

/**
 * 進捗 trigger と (skill, isCorrect) から「該当する quest_type に進捗 +1 すべきか」を返す。
 *
 * 純関数. submitAnswer hook から呼ばれ、daily_quests を 1 row UPDATE する。
 */
export function shouldIncrementForAnswer(
  type: QuestType,
  payload: {
    skill: "vocabulary" | "grammar" | "listening" | "reading" | "writing";
    isCorrect: boolean;
  },
): boolean {
  const tpl = QUEST_TEMPLATES[type];
  if (!tpl) return false;
  const tr = tpl.trigger;
  switch (tr.kind) {
    case "answer_correct":
      return payload.isCorrect && payload.skill === tr.skill;
    case "answer_any":
      return payload.skill === tr.skill;
    case "any_answer_today":
      // streak_keep は一意 progress (target=1) / 1 日 1 回でも解いた瞬間に +1
      return true;
    case "mock_complete":
      // submitAnswer 経路ではない / mock_warmup は別 hook で進捗管理する
      return false;
    default:
      return false;
  }
}
