/**
 * HANEI W9-T2 / Accessories Catalog
 *
 * ことだまトリに装着する 12 種類のアクセサリ定義。
 * - 3 スロット × 4 種 = 計 12 種
 * - unlock_type ('level' | 'streak' | 'xp' | 'badge') と unlock_value で解禁条件を機械可読化
 * - DB seed (`scripts/seed-accessories.ts`) と unlock-engine が共通で参照する
 *
 * 設計原則:
 *   - 絵文字禁止 / Heroicons + 自前 SVG
 *   - 主体カラー Amber Gold #F2A93A (DEC-004)
 *   - 和の美意識: 桜 / 鳥居 / 鈴 / 学帽 などモチーフ
 *
 * 解禁条件マトリクス (要件定義より):
 *
 * | accessory_code        | スロット     | unlock_type | unlock_value      | 解禁メッセージ                |
 * |----------------------|-------------|-------------|-------------------|------------------------------|
 * | hat_school_cap       | hat         | level       | 5                 | レベル 5 達成                  |
 * | hat_sakura_crown     | hat         | streak      | 7                 | 7 日連続学習                   |
 * | hat_eiken_pass       | hat         | badge       | first_mock_exam   | 模試初挑戦達成                 |
 * | hat_guardian_crown   | hat         | xp          | 5000              | 5000 XP 達成                   |
 * | scarf_red            | scarf       | level       | 3                 | レベル 3 達成                  |
 * | scarf_kasuri         | scarf       | streak      | 14                | 14 日連続学習                  |
 * | scarf_sakura         | scarf       | streak      | 30                | 30 日連続 (桜守)              |
 * | scarf_kinran         | scarf       | xp          | 3000              | 3000 XP 達成                   |
 * | wing_charm_bell      | wing_charm  | level       | 1                 | 初期所持                       |
 * | wing_charm_sakura    | wing_charm  | badge       | sakura_keeper     | 桜守 badge                     |
 * | wing_charm_torii     | wing_charm  | streak      | 21                | 21 日連続                       |
 * | wing_charm_moonlight | wing_charm  | xp          | 10000             | 10000 XP 達成                  |
 */

export const ACCESSORY_SLOTS = ["hat", "scarf", "wing_charm"] as const;
export type AccessorySlot = (typeof ACCESSORY_SLOTS)[number];

export const ACCESSORY_UNLOCK_TYPES = [
  "level",
  "streak",
  "xp",
  "badge",
] as const;
export type AccessoryUnlockType = (typeof ACCESSORY_UNLOCK_TYPES)[number];

/**
 * 12 種の accessory code を文字列リテラル union として束縛。
 */
export const ACCESSORY_CODES = [
  "hat_school_cap",
  "hat_sakura_crown",
  "hat_eiken_pass",
  "hat_guardian_crown",
  "scarf_red",
  "scarf_kasuri",
  "scarf_sakura",
  "scarf_kinran",
  "wing_charm_bell",
  "wing_charm_sakura",
  "wing_charm_torii",
  "wing_charm_moonlight",
] as const;
export type AccessoryCode = (typeof ACCESSORY_CODES)[number];

export interface AccessoryDefinition {
  code: AccessoryCode;
  slot: AccessorySlot;
  name: string;
  unlockType: AccessoryUnlockType;
  /**
   * unlockType が 'level' / 'streak' / 'xp' のとき: 数値文字列 ("5", "7", "5000" 等)
   * unlockType が 'badge' のとき: badges.code 文字列 ("first_mock_exam", "sakura_keeper" 等)
   */
  unlockValue: string;
  description: string;
  /** 解禁通知時に kotodama-tori が読み上げるメッセージ */
  unlockMessage: string;
  displayOrder: number;
}

export const ACCESSORY_CATALOG: readonly AccessoryDefinition[] = [
  // ---- HAT (帽子) ----
  {
    code: "hat_school_cap",
    slot: "hat",
    name: "学帽",
    unlockType: "level",
    unlockValue: "5",
    description: "レベル 5 で受け取れる、ぴかぴかの学びの帽子。",
    unlockMessage: "レベル 5 を達成しました。学帽が解禁されました。",
    displayOrder: 1,
  },
  {
    code: "hat_sakura_crown",
    slot: "hat",
    name: "桜花冠",
    unlockType: "streak",
    unlockValue: "7",
    description: "7 日連続で学んだ証。桜の花を編んだ冠。",
    unlockMessage: "7 日連続学習達成。桜花冠が解禁されました。",
    displayOrder: 2,
  },
  {
    code: "hat_eiken_pass",
    slot: "hat",
    name: "受験合格鉢巻",
    unlockType: "badge",
    unlockValue: "first_mock_exam",
    description: "模試デビューで巻ける、勝利祈願の鉢巻。",
    unlockMessage: "模試初挑戦達成。受験合格鉢巻が解禁されました。",
    displayOrder: 3,
  },
  {
    code: "hat_guardian_crown",
    slot: "hat",
    name: "守護神冠",
    unlockType: "xp",
    unlockValue: "5000",
    description: "5000 XP の旅路で授かる、神々しい守護の冠。",
    unlockMessage: "5000 XP 達成。守護神冠が解禁されました。",
    displayOrder: 4,
  },

  // ---- SCARF (マフラー) ----
  {
    code: "scarf_red",
    slot: "scarf",
    name: "赤マフラー",
    unlockType: "level",
    unlockValue: "3",
    description: "レベル 3 で巻ける、勇気の赤マフラー。",
    unlockMessage: "レベル 3 を達成しました。赤マフラーが解禁されました。",
    displayOrder: 1,
  },
  {
    code: "scarf_kasuri",
    slot: "scarf",
    name: "紺絣マフラー",
    unlockType: "streak",
    unlockValue: "14",
    description: "14 日連続学習で授かる、藍染めの絣模様。",
    unlockMessage: "14 日連続学習。紺絣マフラーが解禁されました。",
    displayOrder: 2,
  },
  {
    code: "scarf_sakura",
    slot: "scarf",
    name: "桜柄スカーフ",
    unlockType: "streak",
    unlockValue: "30",
    description: "30 日連続学習の桜守だけが纏える、満開の桜柄。",
    unlockMessage: "30 日連続学習達成。桜柄スカーフが解禁されました。",
    displayOrder: 3,
  },
  {
    code: "scarf_kinran",
    slot: "scarf",
    name: "金襴マフラー",
    unlockType: "xp",
    unlockValue: "3000",
    description: "3000 XP で得られる、金糸織りの華やかなマフラー。",
    unlockMessage: "3000 XP 達成。金襴マフラーが解禁されました。",
    displayOrder: 4,
  },

  // ---- WING_CHARM (羽飾り) ----
  {
    code: "wing_charm_bell",
    slot: "wing_charm",
    name: "鈴",
    unlockType: "level",
    unlockValue: "1",
    description: "はじめてのプロフィール作成でもらえる、清らかな鈴。",
    unlockMessage: "ようこそ。鈴の羽飾りを贈ります。",
    displayOrder: 1,
  },
  {
    code: "wing_charm_sakura",
    slot: "wing_charm",
    name: "桜花飾り",
    unlockType: "badge",
    unlockValue: "sakura_keeper",
    description: "桜守バッジを得たことだまトリに咲く花飾り。",
    unlockMessage: "桜守バッジ取得。桜花飾りが解禁されました。",
    displayOrder: 2,
  },
  {
    code: "wing_charm_torii",
    slot: "wing_charm",
    name: "鳥居型お守り",
    unlockType: "streak",
    unlockValue: "21",
    description: "21 日連続学習で授かる、朱色の鳥居の御守り。",
    unlockMessage: "21 日連続学習達成。鳥居型お守りが解禁されました。",
    displayOrder: 3,
  },
  {
    code: "wing_charm_moonlight",
    slot: "wing_charm",
    name: "月光ペンダント",
    unlockType: "xp",
    unlockValue: "10000",
    description: "10000 XP の頂で輝く、月光を宿したペンダント。",
    unlockMessage: "10000 XP 達成。月光ペンダントが解禁されました。",
    displayOrder: 4,
  },
] as const;

/**
 * code → AccessoryDefinition の検索マップ。
 */
export const ACCESSORY_BY_CODE: Record<AccessoryCode, AccessoryDefinition> =
  ACCESSORY_CATALOG.reduce(
    (acc, a) => {
      acc[a.code] = a;
      return acc;
    },
    {} as Record<AccessoryCode, AccessoryDefinition>,
  );

/**
 * slot → AccessoryDefinition[] (displayOrder 昇順) のグループマップ。
 */
export const ACCESSORIES_BY_SLOT: Record<AccessorySlot, AccessoryDefinition[]> =
  ACCESSORY_SLOTS.reduce(
    (acc, slot) => {
      acc[slot] = ACCESSORY_CATALOG.filter((a) => a.slot === slot).sort(
        (x, y) => x.displayOrder - y.displayOrder,
      );
      return acc;
    },
    {} as Record<AccessorySlot, AccessoryDefinition[]>,
  );

export const SLOT_LABELS: Record<AccessorySlot, string> = {
  hat: "ぼうし",
  scarf: "マフラー",
  wing_charm: "はねかざり",
};

/**
 * ガード: 任意の文字列が AccessoryCode であるか判定。
 */
export function isAccessoryCode(value: unknown): value is AccessoryCode {
  return (
    typeof value === "string" &&
    (ACCESSORY_CODES as readonly string[]).includes(value)
  );
}

/**
 * ガード: 任意の文字列が AccessorySlot であるか判定。
 */
export function isAccessorySlot(value: unknown): value is AccessorySlot {
  return (
    typeof value === "string" &&
    (ACCESSORY_SLOTS as readonly string[]).includes(value)
  );
}

/**
 * 解禁条件を「人間が読めるラベル」に変換 (UI の locked card 表示で使用)。
 */
export function describeUnlockCondition(def: AccessoryDefinition): string {
  switch (def.unlockType) {
    case "level":
      return `レベル ${def.unlockValue} で解禁`;
    case "streak":
      return `${def.unlockValue} 日連続学習で解禁`;
    case "xp":
      return `${def.unlockValue} XP 達成で解禁`;
    case "badge":
      return `バッジ「${def.unlockValue}」獲得で解禁`;
  }
}
