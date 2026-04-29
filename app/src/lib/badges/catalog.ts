/**
 * HANEI - Badge Catalog (W9-T3)
 *
 * 8 種 badges の表示メタデータ。
 *
 * - `code` は src/lib/badges/badge-codes.ts と一対一対応
 * - `criteria` は機械可読な解放条件 (badge-engine.ts が参照)
 * - DB seed (scripts/seed-badges.ts) も同じテーブルから INSERT 文を生成する
 *
 * 設計原則:
 *   - 絵文字禁止 / 日本語ラベルは「ですます調 / 小学生にも読める」
 *   - 純 metadata のみ (依存ゼロ / Server / Client 双方で import 可)
 *   - icon は別 components/badges/icons/* に分離 (本ファイルは icon name のみ保持)
 */

import {
  ALL_BADGE_CODES,
  BADGE_CODE_TO_TIER,
  type BadgeCode,
  type BadgeTier,
} from "./badge-codes";

/** 解放条件 (機械可読 / badge-engine.ts のディスパッチ用) */
export type BadgeCriteria =
  | { type: "answer_count"; threshold: number }
  | {
      type: "skill_mastery";
      skill: "vocabulary" | "grammar" | "reading" | "listening";
      threshold: number;
    }
  | { type: "streak"; threshold: number }
  | { type: "mock_exam_count"; threshold: number };

export interface BadgeMetadata {
  code: BadgeCode;
  /** 日本語名 (UI 表示) */
  name: string;
  /** 平易な説明 (ですます調 / 絵文字なし) */
  description: string;
  /** 取得後にホームで強調する短文 (mascot voice / 1 文) */
  earnedHeadline: string;
  /** Tier (rarity / 演出強度の決定子) */
  tier: BadgeTier;
  /** 解放条件 (badge-engine.ts が参照) */
  criteria: BadgeCriteria;
  /** 進捗バー用の現在値ラベル (例: "X / 7 日 連続") */
  progressUnit: string;
  /** 進捗バー全長 (criteria.threshold と一致 / 未取得時の達成度計算で使用) */
  progressDenominator: number;
  /** Heroicons 名 fallback (DB badges.icon_name 列に保存 / inline SVG 不在時の予備) */
  iconName: string;
}

/**
 * 8 種 badges の master 定義。
 * order = ALL_BADGE_CODES と一致 (UI grid 表示順 / seed の INSERT 順)。
 */
export const BADGE_CATALOG: ReadonlyArray<BadgeMetadata> = [
  {
    code: "first_flight",
    name: "初飛行",
    description: "はじめての 解答を 完了しました。ここから 旅が はじまります。",
    earnedHeadline: "はじめの 一歩を ふみだしました。",
    tier: BADGE_CODE_TO_TIER.first_flight,
    criteria: { type: "answer_count", threshold: 1 },
    progressUnit: "問 解答",
    progressDenominator: 1,
    iconName: "PaperAirplaneIcon",
  },
  {
    code: "streak_keeper",
    name: "連続学習者",
    description: "7 日 つづけて 学習しました。リズムが できてきています。",
    earnedHeadline: "7 日 連続で がんばりました。",
    tier: BADGE_CODE_TO_TIER.streak_keeper,
    criteria: { type: "streak", threshold: 7 },
    progressUnit: "日 連続",
    progressDenominator: 7,
    iconName: "FireIcon",
  },
  {
    code: "vocab_master",
    name: "語彙マスター",
    description: "5 級の 語彙を 100 問 正解しました。語彙力の つばさを 手に 入れました。",
    earnedHeadline: "語彙 100 問 正解 おめでとうございます。",
    tier: BADGE_CODE_TO_TIER.vocab_master,
    criteria: { type: "skill_mastery", skill: "vocabulary", threshold: 100 },
    progressUnit: "語 正答",
    progressDenominator: 100,
    iconName: "BookOpenIcon",
  },
  {
    code: "grammar_master",
    name: "文法マスター",
    description: "文法を 100 問 正解しました。英語の しくみが 見えてきました。",
    earnedHeadline: "文法 100 問 正解 おめでとうございます。",
    tier: BADGE_CODE_TO_TIER.grammar_master,
    criteria: { type: "skill_mastery", skill: "grammar", threshold: 100 },
    progressUnit: "問 正答",
    progressDenominator: 100,
    iconName: "PencilSquareIcon",
  },
  {
    code: "reading_master",
    name: "読解マスター",
    description: "読解を 50 問 正解しました。長文を 読みとく 力が ついています。",
    earnedHeadline: "読解 50 問 正解 おめでとうございます。",
    tier: BADGE_CODE_TO_TIER.reading_master,
    criteria: { type: "skill_mastery", skill: "reading", threshold: 50 },
    progressUnit: "問 正答",
    progressDenominator: 50,
    iconName: "BookmarkIcon",
  },
  {
    code: "listening_master",
    name: "リスニングマスター",
    description: "リスニングを 50 問 正解しました。耳が 英語に なじんできました。",
    earnedHeadline: "リスニング 50 問 正解 おめでとうございます。",
    tier: BADGE_CODE_TO_TIER.listening_master,
    criteria: { type: "skill_mastery", skill: "listening", threshold: 50 },
    progressUnit: "問 正答",
    progressDenominator: 50,
    iconName: "SpeakerWaveIcon",
  },
  {
    code: "first_mock_exam",
    name: "受験者",
    description: "はじめての 模試を 完了しました。本番への 道が ひらけました。",
    earnedHeadline: "模試 デビュー おめでとうございます。",
    tier: BADGE_CODE_TO_TIER.first_mock_exam,
    criteria: { type: "mock_exam_count", threshold: 1 },
    progressUnit: "回 模試 完了",
    progressDenominator: 1,
    iconName: "AcademicCapIcon",
  },
  {
    code: "sakura_keeper",
    name: "桜守",
    description: "30 日 つづけて 学習しました。桜並木の 守り手と なりました。",
    earnedHeadline: "30 日 連続 桜守 おめでとうございます。",
    tier: BADGE_CODE_TO_TIER.sakura_keeper,
    criteria: { type: "streak", threshold: 30 },
    progressUnit: "日 連続",
    progressDenominator: 30,
    iconName: "SparklesIcon",
  },
] as const;

/** code → metadata Lookup table */
export const BADGE_BY_CODE: Readonly<Record<BadgeCode, BadgeMetadata>> =
  Object.freeze(
    Object.fromEntries(BADGE_CATALOG.map((b) => [b.code, b])) as Record<
      BadgeCode,
      BadgeMetadata
    >,
  );

/** ALL_BADGE_CODES と catalog の整合 (defensive / unit test で確認) */
export function listBadgeCatalog(): ReadonlyArray<BadgeMetadata> {
  return BADGE_CATALOG;
}

/** code から metadata を解決 (未知 code は throw) */
export function getBadgeMetadata(code: BadgeCode): BadgeMetadata {
  const meta = BADGE_BY_CODE[code];
  if (!meta) {
    throw new Error(`[badges/catalog] unknown badge code: ${code}`);
  }
  return meta;
}

// 静的整合性 check (build time / vitest import 時に走る)
{
  const orderOk =
    BADGE_CATALOG.length === ALL_BADGE_CODES.length &&
    BADGE_CATALOG.every((b, i) => b.code === ALL_BADGE_CODES[i]);
  if (!orderOk) {
    throw new Error(
      "[badges/catalog] BADGE_CATALOG order must match ALL_BADGE_CODES",
    );
  }
}
