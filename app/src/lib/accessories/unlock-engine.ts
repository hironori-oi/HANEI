/**
 * HANEI W9-T2 / Accessories Unlock Engine
 *
 * `checkUnlocks(stats, alreadyUnlocked)` は純関数:
 *   - 12 種の AccessoryDefinition を走査し、currentStats に基づいて解禁条件を判定
 *   - alreadyUnlocked にまだ含まれていない解禁可能 code を newlyUnlocked として返す
 *   - allUnlocked = alreadyUnlocked ∪ newlyUnlocked
 *
 * I/O 副作用ゼロ → vitest で 100% テスト可能。
 */

import {
  ACCESSORY_CATALOG,
  type AccessoryCode,
  type AccessoryDefinition,
} from "./catalog";

export interface UnlockStats {
  /** xp_levels.level (1..) */
  level: number;
  /** xp_levels.totalXp (累計) */
  totalXp: number;
  /** streaks.currentStreak (現在の連続日数) */
  currentStreak: number;
  /** user_badges に獲得済みの badges.code (重複可) */
  badgeCodes: readonly string[];
}

export interface UnlockCheckResult {
  /** 今回新たに解禁された code */
  newlyUnlocked: AccessoryCode[];
  /** 解禁済 ∪ 新規解禁 (重複なし) */
  allUnlocked: AccessoryCode[];
}

/**
 * 単一 accessory の unlock 判定。stats を満たすか?
 *
 * 純関数 (テスト容易)。
 */
export function isAccessoryUnlocked(
  def: AccessoryDefinition,
  stats: UnlockStats,
): boolean {
  switch (def.unlockType) {
    case "level": {
      const need = Number(def.unlockValue);
      if (!Number.isFinite(need)) return false;
      return stats.level >= need;
    }
    case "streak": {
      const need = Number(def.unlockValue);
      if (!Number.isFinite(need)) return false;
      return stats.currentStreak >= need;
    }
    case "xp": {
      const need = Number(def.unlockValue);
      if (!Number.isFinite(need)) return false;
      return stats.totalXp >= need;
    }
    case "badge": {
      return stats.badgeCodes.includes(def.unlockValue);
    }
  }
}

/**
 * 12 種を走査し、newlyUnlocked / allUnlocked を返す。
 *
 * @param stats           現在の進捗統計
 * @param alreadyUnlocked 既に DB に保存されている解禁済 code リスト
 */
export function checkUnlocks(
  stats: UnlockStats,
  alreadyUnlocked: readonly AccessoryCode[] = [],
): UnlockCheckResult {
  const alreadySet = new Set<AccessoryCode>(alreadyUnlocked);
  const newly: AccessoryCode[] = [];

  for (const def of ACCESSORY_CATALOG) {
    if (alreadySet.has(def.code)) continue;
    if (isAccessoryUnlocked(def, stats)) {
      newly.push(def.code);
    }
  }

  // 入力順を保ったまま重複除去
  const allSet = new Set<AccessoryCode>(alreadySet);
  for (const c of newly) allSet.add(c);

  return {
    newlyUnlocked: newly,
    allUnlocked: Array.from(allSet),
  };
}

/**
 * 1 件の code を解禁判定するためのショートカット (テスト・UI 用)。
 */
export function isCodeUnlocked(
  code: AccessoryCode,
  stats: UnlockStats,
): boolean {
  const def = ACCESSORY_CATALOG.find((a) => a.code === code);
  if (!def) return false;
  return isAccessoryUnlocked(def, stats);
}
