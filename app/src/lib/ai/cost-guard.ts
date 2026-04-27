/**
 * HANEI - AI コスト ガード
 *
 * 1 ユーザー 1 日 ¥10 上限 (DEC-008 / AI_COST_LIMIT_JPY_PER_USER_PER_DAY)
 * ai_coach_messages.cost_jpy を当日分集計してチェック。
 *
 * トークン → JPY 換算 (gpt-5-mini 想定 / 2026-04 時点 公開料金):
 *   入力 USD 0.00025/1K tokens, 出力 USD 0.002/1K tokens
 *   USD/JPY ~ 150 想定で内部で計算 (運用環境変数 OPENAI_USD_JPY で上書き可能)
 */

import { eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiCoachMessages, aiCoachConversations } from "@/lib/db/schema";
import { AI_COST_LIMIT_JPY_PER_USER_PER_DAY } from "@/lib/constants";

const USD_JPY = Number(process.env.OPENAI_USD_JPY ?? 150);

// gpt-5-mini 想定 (運用で上書き可)
const PRICE_USD_PER_1K = {
  input: Number(process.env.OPENAI_PRICE_IN_USD_PER_1K ?? 0.00025),
  output: Number(process.env.OPENAI_PRICE_OUT_USD_PER_1K ?? 0.002),
};

export function estimateCostJpy(tokensIn: number, tokensOut: number): number {
  const usd =
    (tokensIn / 1000) * PRICE_USD_PER_1K.input +
    (tokensOut / 1000) * PRICE_USD_PER_1K.output;
  return Number((usd * USD_JPY).toFixed(4));
}

/**
 * 当日 (UTC ベース) の累計コストを返す。
 */
export async function getTodayCostJpy(learnerId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  // eslint-disable-next-line no-restricted-syntax -- 集計用 read-only (learnerId スコープ)
  const rows = await db
    .select({ total: sql<number>`COALESCE(SUM(${aiCoachMessages.costJpy}), 0)` })
    .from(aiCoachMessages)
    .innerJoin(
      aiCoachConversations,
      eq(aiCoachConversations.id, aiCoachMessages.conversationId),
    )
    .where(
      sql`${aiCoachConversations.learnerId} = ${learnerId} AND ${aiCoachMessages.createdAt} >= ${Math.floor(startOfDay.getTime() / 1000)}`,
    );

  return Number(rows[0]?.total ?? 0);
}

/**
 * 上限超過チェック
 */
export async function isOverDailyLimit(learnerId: string): Promise<{
  over: boolean;
  current: number;
  limit: number;
}> {
  const current = await getTodayCostJpy(learnerId);
  return {
    over: current >= AI_COST_LIMIT_JPY_PER_USER_PER_DAY,
    current,
    limit: AI_COST_LIMIT_JPY_PER_USER_PER_DAY,
  };
}

// gte / eq 使用箇所のため import 保持 (将来拡張用)
const _exports = { gte, eq };
void _exports;
