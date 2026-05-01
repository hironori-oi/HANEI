"use server";

/**
 * HANEI - Parent Messages Server Actions (W9-T5 / W11-T2)
 *
 * 親→子応援メッセージの送信 / 取得 / 既読更新。
 *
 * 三層認可防衛 (DEC-003):
 *   - 第一層: middleware (proxy.ts)
 *   - 第二層: requireAuth → requireParent → requireLearnerOwner で
 *            「この親がこの learner にメッセージを送れるか」を SQL で確認
 *            (同じ family_id の learner 以外は throw)
 *   - 第三層: 全 INSERT / SELECT / UPDATE は family_id + learner_id の
 *            二重スコープ条件で WHERE 絞り込み
 *
 * W11-T2 で /home 代読 modal の「ありがとう」 button 経由から markMessageRead が
 * 呼び出される。学習者直ログイン経路解禁は引き続き Phase 3 で再評価。
 * (Phase 1-2 は parent session 経由の learner /home 動作で既存 requireParent +
 *  family scope が正しく通る設計)
 *
 * W11-T2 / DEC-062 追加:
 *   - sendCustomMessage / sendMessageFromTemplate (customBody 経路) に
 *     validateParentMessageBody (純関数 / 罵倒系・否定系・強制系・PII 辞書) を統合
 *   - 連投スパム防止 (5 分 5 件以上の同 from→to はリジェクト = "rate_limited")
 */

import { z } from "zod";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import {
  parentMessages,
  learnerProfiles,
  streaks,
  type ParentMessage,
} from "@/lib/db/schema";
import {
  requireAuth,
  requireParent,
  requireFamilyMember,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import {
  findTemplateByCode,
  type MessageCategory,
} from "@/lib/messages/template-catalog";
import { resolvePlaceholders } from "@/lib/messages/resolve-placeholders";
import { validateParentMessageBody } from "@/lib/messages/moderation";

const BODY_MAX = 200;
const BODY_MIN = 1;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const SendFromTemplateSchema = z.object({
  templateCode: z.string().min(1).max(8),
  toLearnerId: z.string().min(1),
  customBody: z.string().min(BODY_MIN).max(BODY_MAX).optional(),
});

const SendCustomSchema = z.object({
  toLearnerId: z.string().min(1),
  body: z.string().min(BODY_MIN).max(BODY_MAX),
});

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------
export type SendMessageResult =
  | { ok: true; messageId: string; body: string }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "unknown_template"
        | "learner_not_owned"
        | "body_too_long"
        | "body_too_short"
        // W11-T2 / DEC-062: moderation pipeline
        | "blocked_word"
        | "rate_limited";
      matchedWord?: string;
    };

export type MarkReadResult =
  | { ok: true; readAt: Date }
  | { ok: false; reason: "not_found" | "not_owned" | "already_read" };

export interface ParentMessageView extends ParentMessage {
  category?: MessageCategory | null;
}

// ---------------------------------------------------------------------------
// 1. テンプレからメッセージ送信
// ---------------------------------------------------------------------------
/**
 * テンプレ code を指定してメッセージを送信する。
 * customBody が指定された場合はそちらを優先 (テンプレを編集して送信)。
 *
 * placeholder は streaks / learner_profiles から自動解決される。
 */
export async function sendMessageFromTemplate(params: {
  templateCode: string;
  toLearnerId: string;
  customBody?: string;
}): Promise<SendMessageResult> {
  // 入力検証
  const parsed = SendFromTemplateSchema.safeParse(params);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_input" };
  }

  // 1. 認可: 親 + family + learner owner
  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);
  await requireFamilyMember(session.userId, familyId);
  try {
    await requireLearnerOwner(session.userId, parsed.data.toLearnerId);
  } catch {
    return { ok: false, reason: "learner_not_owned" };
  }

  // 2. テンプレ解決
  const tpl = findTemplateByCode(parsed.data.templateCode);
  if (!tpl) {
    return { ok: false, reason: "unknown_template" };
  }

  // 3. body 確定 (customBody 優先 / なければ placeholder 解決)
  let body: string;
  const isCustom = parsed.data.customBody !== undefined;
  if (isCustom) {
    body = parsed.data.customBody!;
  } else {
    const ctx = await loadPlaceholderContext(parsed.data.toLearnerId, familyId);
    body = resolvePlaceholders(tpl.body, ctx);
  }

  // 4. 送信前の最終 length チェック (customBody は zod 済 / template も念押し)
  if (body.length > BODY_MAX) return { ok: false, reason: "body_too_long" };
  if (body.length < BODY_MIN) return { ok: false, reason: "body_too_short" };

  // 5. W11-T2 / DEC-062: moderation pipeline
  //    customBody 経路のみ moderation を通す (定型 30 種は事前審査済).
  //    placeholder 解決後の最終 body に対して辞書ベース検証.
  if (isCustom) {
    const mod = validateParentMessageBody(body);
    if (!mod.ok) {
      if (mod.reason === "too_long")
        return { ok: false, reason: "body_too_long" };
      if (mod.reason === "too_short")
        return { ok: false, reason: "body_too_short" };
      if (mod.reason === "invalid_type")
        return { ok: false, reason: "invalid_input" };
      return {
        ok: false,
        reason: "blocked_word",
        matchedWord: mod.matchedWord,
      };
    }
  }

  // 6. W11-T2 / DEC-062: 連投スパム防止 (同 from→to / 5 分 5 件以上 reject)
  if (await isRateLimited(session.userId, parsed.data.toLearnerId)) {
    return { ok: false, reason: "rate_limited" };
  }

  // 7. INSERT (family_id 必須 + learner is owned)
  const id = `pm_${randomUUID()}`;
  await db.insert(parentMessages).values({
    id,
    familyId,
    fromUserId: session.userId,
    toLearnerId: parsed.data.toLearnerId,
    templateCode: tpl.code,
    body,
  });

  return { ok: true, messageId: id, body };
}

// ---------------------------------------------------------------------------
// 2. 自由文メッセージ送信
// ---------------------------------------------------------------------------
export async function sendCustomMessage(params: {
  toLearnerId: string;
  body: string;
}): Promise<SendMessageResult> {
  const parsed = SendCustomSchema.safeParse(params);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.code === "too_big") return { ok: false, reason: "body_too_long" };
    if (issue?.code === "too_small") return { ok: false, reason: "body_too_short" };
    return { ok: false, reason: "invalid_input" };
  }

  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);
  await requireFamilyMember(session.userId, familyId);
  try {
    await requireLearnerOwner(session.userId, parsed.data.toLearnerId);
  } catch {
    return { ok: false, reason: "learner_not_owned" };
  }

  // 自由文 placeholder 解決もサポート (親が手入力で {streak_days} を含めても可)
  const ctx = await loadPlaceholderContext(parsed.data.toLearnerId, familyId);
  const body = resolvePlaceholders(parsed.data.body, ctx);

  if (body.length > BODY_MAX) return { ok: false, reason: "body_too_long" };
  if (body.length < BODY_MIN) return { ok: false, reason: "body_too_short" };

  // W11-T2 / DEC-062: moderation pipeline (placeholder 解決後の body に対して)
  const mod = validateParentMessageBody(body);
  if (!mod.ok) {
    if (mod.reason === "too_long") return { ok: false, reason: "body_too_long" };
    if (mod.reason === "too_short") return { ok: false, reason: "body_too_short" };
    if (mod.reason === "invalid_type")
      return { ok: false, reason: "invalid_input" };
    return {
      ok: false,
      reason: "blocked_word",
      matchedWord: mod.matchedWord,
    };
  }

  // W11-T2 / DEC-062: 連投スパム防止 (同 from→to / 5 分 5 件以上 reject)
  if (await isRateLimited(session.userId, parsed.data.toLearnerId)) {
    return { ok: false, reason: "rate_limited" };
  }

  const id = `pm_${randomUUID()}`;
  await db.insert(parentMessages).values({
    id,
    familyId,
    fromUserId: session.userId,
    toLearnerId: parsed.data.toLearnerId,
    templateCode: null,
    body,
  });

  return { ok: true, messageId: id, body };
}

// ---------------------------------------------------------------------------
// 3. 学習者向け メッセージ取得 (新着順)
// ---------------------------------------------------------------------------
/**
 * 指定 learner 宛のメッセージを取得する (新着順)。
 *
 * 認可:
 *   - 親が learner の owner であることを SQL で確認
 *   - SELECT 時も to_learner_id + family_id の AND 条件で再絞込み
 */
export async function getMessagesForLearner(
  learnerId: string,
): Promise<ParentMessage[]> {
  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);
  await requireFamilyMember(session.userId, familyId);
  await requireLearnerOwner(session.userId, learnerId);

  // eslint-disable-next-line no-restricted-syntax -- familyId + learnerId 二重スコープ済 (DEC-003)
  const rows = await db
    .select()
    .from(parentMessages)
    .where(
      and(
        eq(parentMessages.toLearnerId, learnerId),
        eq(parentMessages.familyId, familyId),
      ),
    )
    .orderBy(desc(parentMessages.createdAt));

  return rows;
}

/**
 * 学習者の最新 1 件メッセージ (未読優先) を返す。/home の上部表示用。
 * 未読が 1 件以上あれば最新の未読 / 無ければ最新の既読。
 */
export async function getLatestMessageForLearner(
  learnerId: string,
): Promise<ParentMessage | null> {
  const all = await getMessagesForLearner(learnerId);
  if (all.length === 0) return null;
  const unread = all.find((m) => m.readAt === null);
  return unread ?? all[0] ?? null;
}

// ---------------------------------------------------------------------------
// 4. 既読更新
// ---------------------------------------------------------------------------
export async function markMessageRead(messageId: string): Promise<MarkReadResult> {
  if (!messageId || typeof messageId !== "string") {
    return { ok: false, reason: "not_found" };
  }
  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);
  await requireFamilyMember(session.userId, familyId);

  // 1. 対象メッセージを family スコープで取得
  // eslint-disable-next-line no-restricted-syntax -- familyId スコープ済 (DEC-003)
  const rows = await db
    .select({
      id: parentMessages.id,
      toLearnerId: parentMessages.toLearnerId,
      readAt: parentMessages.readAt,
    })
    .from(parentMessages)
    .where(
      and(
        eq(parentMessages.id, messageId),
        eq(parentMessages.familyId, familyId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false, reason: "not_found" };

  // 2. 受信者 learner が同 family 所有であるか SQL 再確認 (cross-family 漏洩防止)
  try {
    await requireLearnerOwner(session.userId, row.toLearnerId);
  } catch {
    return { ok: false, reason: "not_owned" };
  }

  if (row.readAt !== null && row.readAt !== undefined) {
    return { ok: false, reason: "already_read" };
  }

  const now = new Date();
  await db
    .update(parentMessages)
    .set({ readAt: now })
    .where(
      and(
        eq(parentMessages.id, messageId),
        eq(parentMessages.familyId, familyId),
      ),
    );

  return { ok: true, readAt: now };
}

// ---------------------------------------------------------------------------
// W11-T2 / DEC-062: 連投スパム防止 (5 分 5 件以上 = rate_limited)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_SECONDS = 300; // 5 分
const RATE_LIMIT_MAX_MESSAGES = 5;

/**
 * 同一 from_user_id → 同一 to_learner_id に直近 5 分で
 * RATE_LIMIT_MAX_MESSAGES 件以上が既に存在するか判定する.
 *
 * 引数 fromUserId / toLearnerId は呼び出し側で session + 認可済を前提とする.
 *
 * 同 from→to の組合せでのみカウントするため、別 learner / 別親へのメッセージは
 * 互いに干渉しない.
 */
async function isRateLimited(
  fromUserId: string,
  toLearnerId: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000);
  // eslint-disable-next-line no-restricted-syntax -- from_user_id + to_learner_id 二重スコープ済
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(parentMessages)
    .where(
      and(
        eq(parentMessages.fromUserId, fromUserId),
        eq(parentMessages.toLearnerId, toLearnerId),
        gte(parentMessages.createdAt, cutoff),
      ),
    );
  const count = Number(rows[0]?.count ?? 0);
  return count >= RATE_LIMIT_MAX_MESSAGES;
}

// ---------------------------------------------------------------------------
// internal helpers
// ---------------------------------------------------------------------------
async function loadPlaceholderContext(
  learnerId: string,
  familyId: string,
): Promise<{ streakDays: number | null; examDays: number | null }> {
  // streak
  // eslint-disable-next-line no-restricted-syntax -- learnerId スコープ済 (caller で owner 確認済)
  const streakRows = await db
    .select({ currentStreak: streaks.currentStreak })
    .from(streaks)
    .where(eq(streaks.learnerId, learnerId))
    .limit(1);
  const streakDays = streakRows[0]?.currentStreak ?? null;

  // exam date (learnerProfiles.examDate ISO yyyy-mm-dd)
  // eslint-disable-next-line no-restricted-syntax -- familyId + learnerId 二重スコープ
  const learnerRows = await db
    .select({ examDate: learnerProfiles.examDate })
    .from(learnerProfiles)
    .where(
      and(
        eq(learnerProfiles.id, learnerId),
        eq(learnerProfiles.familyId, familyId),
      ),
    )
    .limit(1);
  const examDateIso = learnerRows[0]?.examDate ?? null;

  let examDays: number | null = null;
  if (examDateIso) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const exam = new Date(`${examDateIso}T00:00:00`);
    if (!Number.isNaN(exam.getTime())) {
      examDays = Math.ceil((exam.getTime() - today.getTime()) / 86_400_000);
    }
  }

  return { streakDays, examDays };
}
