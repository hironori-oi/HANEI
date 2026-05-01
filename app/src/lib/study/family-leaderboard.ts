/**
 * HANEI - Family Weekly Leaderboard Read-only Helper (W11-T3 / 家族内ランキング)
 *
 * 表示用の getFamilyWeeklyLeaderboard. 副作用なし (DB 読み取りのみ).
 *
 * "use server" ではない通常の server-only モジュール:
 *   - Server Component (parent dashboard) から直接 import する.
 *   - 認可は呼び出し元で実施 (parent dashboard は requireParent + scopedQueries 済).
 *   - 本関数自体は SQL レベルで learner_profiles.family_id = ? を強制しているので
 *     家族間漏洩は構造的に防止済 (COPPA 準拠 / DEC-061).
 *
 * データソース (選択肢 A 採用 / DEC-061):
 *   - xp_logs テーブルが存在しないため answer_logs を直近 7 日 (JST 6:00 境界) で集計.
 *   - is_correct=true × 10 XP/問 を「週間 XP」の近似値とする (= submitAnswer の XP 加算ロジックは re-use せず read-only).
 *   - 累計 xp_levels.totalXp は破壊しない.
 *   - 近似値である旨は親 dashboard 側で「直近 7 日の 正解数を 集計しています」と明記.
 *
 * DEC-024 罰則ゼロ哲学:
 *   - 全員 0 XP / 単独 learner は UI 側で罰語を出さない. 本関数は構造データのみ返す.
 *   - 「最下位」「ビリ」「下位」等の罰語は UI / 純関数で発生し得ない設計.
 */

import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { answerLogs, learnerProfiles } from "@/lib/db/schema";
import { getJstQuestDate, jstQuestDayStartUtc } from "@/lib/quest/jst-date";
import {
  computeWeeklyXpRanking,
  type RankedWeeklyXpRow,
  type WeeklyXpRow,
} from "@/lib/study/family-leaderboard-ranking";
import { getKotodamaStageInput } from "@/lib/study/kotodama-stage-resolver";
import { getKotodamaStage } from "@/lib/study/kotodama-tori-stage";

/** 1 正解あたりの近似 XP (DEC-061 選択肢 A) */
export const LEADERBOARD_XP_PER_CORRECT = 10;

/** ランキング集計のウィンドウ日数 (= 直近 7 日) */
export const LEADERBOARD_WINDOW_DAYS = 7;

/**
 * 直近 7 日 (JST 6:00 境界) の family 内 learner ごとの XP 合計を返す.
 *
 * 認可: 呼び出し元 (parent dashboard / Server Component) で requireParent / scopedQueries 済.
 *       本関数は SQL レベルで family_id = ? を強制 (COPPA 準拠 / DEC-061 / DEC-003).
 *
 * 仕様:
 *   - 直近 7 日の `answer_logs` を `is_correct=true` でフィルタ → 正解数集計
 *   - 正解数 × LEADERBOARD_XP_PER_CORRECT (= 10) を週間 XP として返す
 *   - 降順 + 1224 ranking + kotodama-tori stage 同梱
 *   - 単独 learner / 全員 0 XP も適切に扱う (UI 側で前向きコピー切替)
 *
 * 副作用なし: DB 読み取りのみ.
 */
export async function getFamilyWeeklyLeaderboard(
  familyId: string,
  now?: Date,
): Promise<RankedWeeklyXpRow[]> {
  if (!familyId || typeof familyId !== "string") {
    throw new TypeError("[family-leaderboard] familyId is required");
  }

  // 1) 7 日前 JST 6:00 境界の UTC Date (= cut-off / SQL の gte 用)
  const today = getJstQuestDate(now ?? new Date());
  const todayStartUtc = jstQuestDayStartUtc(today);
  const cutoff = new Date(
    todayStartUtc.getTime() -
      (LEADERBOARD_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000,
  );

  // 2) family の learner 一覧 (family_id WHERE 必須 / COPPA 準拠の構造的保証)
  // eslint-disable-next-line no-restricted-syntax -- family_id 単一スコープ済 (DEC-003 / DEC-061)
  const learners = await db
    .select({ id: learnerProfiles.id, nickname: learnerProfiles.nickname })
    .from(learnerProfiles)
    .where(eq(learnerProfiles.familyId, familyId));

  if (learners.length === 0) return [];
  const learnerIds = learners.map((l) => l.id);

  // 3) 直近 7 日の answer_logs (learner_id IN family scope) を取得
  // eslint-disable-next-line no-restricted-syntax -- learner_id IN family scope (上記で family 確定済)
  const correctRows = await db
    .select({
      learnerId: answerLogs.learnerId,
      isCorrect: answerLogs.isCorrect,
    })
    .from(answerLogs)
    .where(
      and(
        inArray(answerLogs.learnerId, learnerIds),
        gte(answerLogs.answeredAt, cutoff),
      ),
    );

  // 4) learner ごとの正解数集計
  const correctCountByLearner = new Map<string, number>();
  for (const r of correctRows) {
    if (!r.isCorrect) continue;
    correctCountByLearner.set(
      r.learnerId,
      (correctCountByLearner.get(r.learnerId) ?? 0) + 1,
    );
  }

  // 5) kotodama-tori stage を learner 並列取得 (best-effort / per-learner try-catch)
  const stageEntries = await Promise.all(
    learners.map(async (l) => {
      try {
        const input = await getKotodamaStageInput(db, l.id);
        return [l.id, getKotodamaStage(input)] as const;
      } catch {
        return [l.id, undefined] as const;
      }
    }),
  );
  const stageByLearner = new Map(stageEntries);

  // 6) WeeklyXpRow に整形して純関数で順位付け
  const weeklyRows: WeeklyXpRow[] = learners.map((l) => ({
    learnerId: l.id,
    nickname: l.nickname,
    weeklyXp:
      (correctCountByLearner.get(l.id) ?? 0) * LEADERBOARD_XP_PER_CORRECT,
    kotodamaToriStage: stageByLearner.get(l.id) ?? undefined,
  }));

  return computeWeeklyXpRanking(weeklyRows);
}
