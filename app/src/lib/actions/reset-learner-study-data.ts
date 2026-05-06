"use server";

/**
 * HANEI - Learner Study Data Reset Server Action (DEC-090 項目 4 / mutation +1 = 10/10 最終枠)
 *
 * 役割:
 *   - β 子使用継続中の「やり直し」体験を提供する.
 *   - 学習履歴系のテーブルを learner_id スコープで全件削除.
 *   - メタ情報 (nickname / 受験日 / 学習目標 / preferences 等) は保持.
 *   - 「ことだまトリ」進化段階は内部的に xp_levels / streaks / userBadges を消すため
 *     getKotodamaStage() の純関数結果が自動的に "hina" に戻る (= DB 列ゼロ前提).
 *
 * 三層認可 (DEC-003):
 *   - 第一層: middleware (proxy.ts)
 *   - 第二層: requireAuth + requireParent + requireLearnerOwner
 *   - 第三層: 全 delete に learner_id 条件を必ず付与
 *
 * 冪等性 (DEC-055):
 *   - 同 learnerId に複数回叩いても結果同一 (空テーブルへの DELETE は no-op).
 *
 * fail-soft:
 *   - 各 table 削除を try/catch で個別に守る. 一部失敗でも続行.
 *   - 結果 summary を console.log + Sentry.captureMessage("info") へ送信.
 *
 * 罰則ゼロ哲学 (DEC-024):
 *   - エラーメッセージは罰語ゼロ.
 *   - 削除対象/保持対象は「学習履歴」「お子さまの記録」中立用語のみ.
 *
 * mutation 分類 (DEC-006 拡張版 / mutation 10/10 最終枠):
 *   - `resetLearnerStudyData` = top-level mutation #10
 */

import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import {
  answerLogs,
  srsStates,
  dailyPlans,
  streaks,
  xpLevels,
  userBadges,
  mockExamResults,
  aiCoachConversations,
  masteryEstimates,
  learnerAccessories,
  characters,
  coinTransactions,
  learnerInventory,
  dailyQuests,
  studySessions,
  learnerProfiles,
} from "@/lib/db/schema";
import {
  requireAuth,
  requireParent,
  requireLearnerOwner,
} from "@/lib/auth/guards";

export type ResetLearnerStudyDataResult =
  | { ok: true; summary: ResetSummary }
  | { ok: false; error: string };

export interface ResetSummary {
  learnerId: string;
  rowsDeleted: Record<string, number>;
  errors: Array<{ table: string; message: string }>;
}

/**
 * 削除対象テーブル定義.
 *
 * 学習履歴系: 全削除 (learner_id 条件で SQL レベルスコープ).
 *
 * 保持対象 (本 action では一切触らない):
 *   - learnerProfiles (nickname / examDate / targetEikenLevel / dailyMinutesTarget /
 *     dailyGoalXp / preferences / experiments — coinBalance のみ 0 リセット)
 *   - learnerSettings (通知 / リマインド)
 *   - learnerStudyTargets (学習目標)
 *   - examDates (受験日履歴 = 親が登録した meta)
 *   - parentMessages (親が書いたメッセージ = 親コンテンツ)
 *   - families.familyStreakDays (家族単位 / 兄弟救済仕様 / DEC-024)
 *
 * 注意: aiCoachMessages は conversation_id FK cascade で自動削除されるため
 * 明示削除は aiCoachConversations のみで足りる.
 */
const DELETE_TABLES = [
  { name: "answerLogs", table: answerLogs, column: answerLogs.learnerId },
  { name: "srsStates", table: srsStates, column: srsStates.learnerId },
  { name: "dailyPlans", table: dailyPlans, column: dailyPlans.learnerId },
  { name: "streaks", table: streaks, column: streaks.learnerId },
  { name: "xpLevels", table: xpLevels, column: xpLevels.learnerId },
  { name: "userBadges", table: userBadges, column: userBadges.learnerId },
  {
    name: "mockExamResults",
    table: mockExamResults,
    column: mockExamResults.learnerId,
  },
  {
    name: "aiCoachConversations",
    table: aiCoachConversations,
    column: aiCoachConversations.learnerId,
  },
  {
    name: "masteryEstimates",
    table: masteryEstimates,
    column: masteryEstimates.learnerId,
  },
  {
    name: "learnerAccessories",
    table: learnerAccessories,
    column: learnerAccessories.learnerId,
  },
  { name: "characters", table: characters, column: characters.learnerId },
  {
    name: "coinTransactions",
    table: coinTransactions,
    column: coinTransactions.learnerId,
  },
  {
    name: "learnerInventory",
    table: learnerInventory,
    column: learnerInventory.learnerId,
  },
  { name: "dailyQuests", table: dailyQuests, column: dailyQuests.learnerId },
  {
    name: "studySessions",
    table: studySessions,
    column: studySessions.learnerId,
  },
] as const;

/**
 * テスト用 export: 削除対象 / 保持対象 テーブル名一覧.
 * vitest unit test の構造的検証で使用する.
 */
export const RESET_DELETE_TABLE_NAMES: ReadonlyArray<string> = DELETE_TABLES.map(
  (t) => t.name,
);

export const RESET_KEEP_TABLE_NAMES: ReadonlyArray<string> = [
  "learnerProfiles",
  "learnerSettings",
  "learnerStudyTargets",
  "examDates",
  "parentMessages",
  "families",
  "familyMembers",
  "users",
] as const;

/**
 * 学習者の学習履歴系データを「やり直し」状態に戻す.
 *
 * **top-level mutation #10** (DEC-006 拡張版 mutation 10/10 / 最終枠到達 / DEC-090).
 *
 * 認可: parent role + learner ownership 厳守 (DEC-003).
 * 冪等 (DEC-055): 同 learnerId に 2 回叩いても結果同一 (空テーブルへの DELETE は no-op).
 * fail-soft: 各 table を try/catch で守り、失敗テーブルは errors に積みつつ続行.
 *
 * 監査ログ:
 *   - console.log で rowsDeleted summary を出力 (本番は Vercel Logs).
 *   - Sentry.captureMessage("info") で running tally を記録.
 */
export async function resetLearnerStudyData(
  learnerId: string,
): Promise<ResetLearnerStudyDataResult> {
  // 入力バリデーション (空文字 / 不正型)
  if (typeof learnerId !== "string" || learnerId.length === 0) {
    return { ok: false, error: "学習者の指定が正しくありません。" };
  }

  // 三層認可 (DEC-003 継承)
  let parentUserId: string;
  try {
    const session = await requireAuth();
    await requireParent(session.userId);
    await requireLearnerOwner(session.userId, learnerId);
    parentUserId = session.userId;
  } catch {
    return {
      ok: false,
      error: "この操作にはアクセスできません。",
    };
  }

  const summary: ResetSummary = {
    learnerId,
    rowsDeleted: {},
    errors: [],
  };

  // fail-soft: 各 table delete を独立 try/catch で守る
  for (const def of DELETE_TABLES) {
    try {
      // SQLite drizzle .delete() は影響行数を直接返さないため、
      // 削除前に件数を select し summary に記録する (監査ログ目的).
      // eslint-disable-next-line no-restricted-syntax -- learner_id 条件で必ずスコープ済 (DEC-003)
      const before = await db
        .select({ id: def.column })
        .from(def.table as never)
        .where(eq(def.column, learnerId));
      const beforeCount = before.length;

      // learner_id 条件で必ずスコープ済 (DEC-003)
      await db.delete(def.table as never).where(eq(def.column, learnerId));

      summary.rowsDeleted[def.name] = beforeCount;
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown";
      summary.errors.push({ table: def.name, message });
      summary.rowsDeleted[def.name] = 0;
    }
  }

  // learnerProfiles の coinBalance denormalized cache を 0 にリセット.
  // (coinTransactions を全削除した後、SUM = 0 と整合させる)
  // 注意: nickname / examDate / targetEikenLevel 等のメタは触らない.
  try {
    await db
      .update(learnerProfiles)
      .set({ coinBalance: 0, updatedAt: new Date() })
      .where(eq(learnerProfiles.id, learnerId));
    summary.rowsDeleted["learnerProfiles_coinBalance_reset"] = 1;
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    summary.errors.push({ table: "learnerProfiles_coinBalance", message });
  }

  // 監査ログ
  const totalDeleted = Object.values(summary.rowsDeleted).reduce(
    (a, b) => a + (b ?? 0),
    0,
  );
  console.log(
    `[reset-learner-data] learnerId=${learnerId} parentUserId=${parentUserId} totalDeleted=${totalDeleted} errors=${summary.errors.length}`,
  );
  try {
    Sentry.captureMessage("learner study data reset", {
      level: "info",
      extra: {
        learnerId,
        totalDeleted,
        errorCount: summary.errors.length,
        rowsDeleted: summary.rowsDeleted,
      },
    });
  } catch {
    // Sentry 失敗は UX を壊さない
  }

  // 関連 path を revalidate (キャッシュ整合)
  // DEC-090 hotfix: `/parent` は route group (parent)/parent/ 配下に page.tsx を持たないため
  // revalidatePath 対象外. canonical な `/parent/dashboard` のみを revalidate する.
  try {
    revalidatePath("/home");
    revalidatePath("/parent/dashboard");
    revalidatePath("/parent/settings/account");
  } catch {
    // 失敗しても続行
  }

  return { ok: true, summary };
}
