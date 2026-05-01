/**
 * HANEI - Parent Messages Server-Only Helpers (W11-T2 / DEC-062)
 *
 * /home Server Component から直接 import される server-only ヘルパ群.
 *
 * 不変条件 (Turbopack 制約):
 *   - 本ファイルは "use server" を持たない (Server Action ではなく純 Server function).
 *   - DB I/O は持つが、認可は呼び出し側 ( /home の requireAuth + getFamilyIdForUser +
 *     requireLearnerOwner ) に委ねる. 本モジュールは family_id を強制 SQL WHERE で受け取り、
 *     SQL レベルで cross-family 漏洩を防ぐ (DEC-003 三層認可の第三層).
 *
 * /home 代読 modal のためのヘルパ:
 *   - findOldestUnreadMessage(messages) : 取得済の messages 配列から最古の未読 1 件を pick.
 *   - getMessageSenderName(messageId, familyId) : 送信者 (親) の display name を 1 件解決.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { parentMessages, users, type ParentMessage } from "@/lib/db/schema";

/**
 * /home に渡される messages 配列 (新着 desc) から、**最古の未読** 1 件を返す純関数.
 *
 * DEC-062 §5 では「複数親 / 複数未読の場合は最古から代読する」設計のため、
 * `getMessagesForLearner` が desc で返す配列の中で readAt === null の **末尾** を pick する.
 *
 * @param messages - 新着 desc の配列 (getMessagesForLearner の戻り値そのまま)
 * @returns 最古の未読 1 件 / 未読が無ければ null
 */
export function findOldestUnreadMessage(
  messages: ReadonlyArray<ParentMessage>,
): ParentMessage | null {
  // 配列を後ろから走査 = desc 配列の末尾 (最古) からの未読 pick
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && m.readAt === null) return m;
  }
  return null;
}

/**
 * 指定 messageId の送信者 (親) display name を解決する.
 *
 * family_id を必ず SQL WHERE で挟んで cross-family 漏洩を構造的に防ぐ.
 * 呼び出し側は /home の `getFamilyIdForUser(session.userId)` で familyId を取得済み前提.
 *
 * @param messageId - parent_messages.id
 * @param familyId - 呼び出し側の認可済 familyId
 * @returns 送信者の display name. 解決失敗時は "おうちの ひと" fallback.
 */
export async function getMessageSenderName(
  messageId: string,
  familyId: string,
): Promise<string> {
  if (!messageId || !familyId) return "おうちの ひと";

  // eslint-disable-next-line no-restricted-syntax -- familyId スコープ済 (DEC-003)
  const rows = await db
    .select({
      fromUserId: parentMessages.fromUserId,
    })
    .from(parentMessages)
    .where(
      and(
        eq(parentMessages.id, messageId),
        eq(parentMessages.familyId, familyId),
      ),
    )
    .limit(1);

  const fromUserId = rows[0]?.fromUserId;
  if (!fromUserId) return "おうちの ひと";

  // user 行から display_name を取得
  // eslint-disable-next-line no-restricted-syntax -- 上で family scope 確認済の fromUserId
  const userRows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, fromUserId))
    .limit(1);

  const name = userRows[0]?.name;
  if (typeof name === "string" && name.trim().length > 0) {
    return name;
  }
  return "おうちの ひと";
}
