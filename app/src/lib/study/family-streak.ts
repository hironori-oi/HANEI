/**
 * HANEI - Family Streak Read-only Helper (W11-T1 / 家族のれんぞく)
 *
 * 表示用の getFamilyStreak. 副作用なし (DB 読み取りのみ). 実際の roll-over は
 * write 経路 (updateFamilyStreakOnLearn) で確定する.
 *
 * "use server" ではない通常の server-only モジュール:
 *   - Server Component (parent dashboard) から直接 import する.
 *   - 認可は呼び出し元で実施 (parent dashboard は requireParent + scopedQueries 済).
 *
 * DEC-024 罰則ゼロ哲学:
 *   - isAlive=false (= 切れている) でも UI 側で罰メッセージを出さず「またいつでも始められるよ」.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { families } from "@/lib/db/schema";
import { getJstQuestDate } from "@/lib/quest/jst-date";
import { previousQuestDate } from "@/lib/study/family-streak-rollover";

export interface FamilyStreakReadResult {
  /** 表示する家族 streak 日数 (切れていれば 0) */
  days: number;
  /** 「生きて」いるか (= 今日 or 昨日 active. 今日学習すれば +1 候補) */
  isAlive: boolean;
}

/**
 * 指定 family の家族 streak を表示用に取得する.
 *
 * 認可: 呼び出し元 (parent dashboard / Server Component) で requireParent / scopedQueries 済.
 *       本関数自体は SQL レベルで family_id = ? を強制しているので家族間漏洩は構造的に防止済.
 *
 * 仕様:
 *   - lastFamilyActiveDate === today          → { days, isAlive: true }       (今日学習済)
 *   - lastFamilyActiveDate === yesterday      → { days, isAlive: true }       (今日中に学習すれば +1 候補)
 *   - それ以外 (NULL / 2 日以上前)             → { days: 0, isAlive: false } (切れている表示)
 *
 * 副作用なし: 実際の roll-over は updateFamilyStreakOnLearn で write 経路に確定する.
 */
export async function getFamilyStreak(
  familyId: string,
  now?: Date,
): Promise<FamilyStreakReadResult> {
  if (!familyId || typeof familyId !== "string") {
    throw new TypeError("[family-streak] familyId is required");
  }

  // eslint-disable-next-line no-restricted-syntax -- family_id 単一スコープ済 (DEC-003)
  const rows = await db
    .select({
      familyStreakDays: families.familyStreakDays,
      lastFamilyActiveDate: families.lastFamilyActiveDate,
    })
    .from(families)
    .where(eq(families.id, familyId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    // family が存在しない (= 認可未通過か新規家族) は安全側で 0 / dead を返す
    return { days: 0, isAlive: false };
  }

  const today = getJstQuestDate(now ?? new Date());
  const last = row.lastFamilyActiveDate ?? null;
  const days = Math.max(0, row.familyStreakDays | 0);

  if (last === null) {
    return { days: 0, isAlive: false };
  }
  if (last === today) {
    return { days, isAlive: true };
  }
  const yesterday = previousQuestDate(today);
  if (last === yesterday) {
    return { days, isAlive: true };
  }
  // 2 日以上前 = 切れている表示 (前向きコピーは UI 側で / DEC-024)
  return { days: 0, isAlive: false };
}
