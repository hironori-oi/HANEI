"use server";

/**
 * HANEI - Parent Messages Server Actions (W9-T5)
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
 * 既読更新は学習者側からの操作だが、Phase 1 では学習者ログイン経路を
 * 持たないため「保護者が代理で既読を打つ (家族内)」のみ許可する。
 * (W11 で学習者直アクセスを解禁する際に再評価)
 */

import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
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
        | "body_too_short";
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
  if (parsed.data.customBody !== undefined) {
    body = parsed.data.customBody;
  } else {
    const ctx = await loadPlaceholderContext(parsed.data.toLearnerId, familyId);
    body = resolvePlaceholders(tpl.body, ctx);
  }

  // 4. 送信前の最終 length チェック (customBody は zod 済 / template も念押し)
  if (body.length > BODY_MAX) return { ok: false, reason: "body_too_long" };
  if (body.length < BODY_MIN) return { ok: false, reason: "body_too_short" };

  // 5. INSERT (family_id 必須 + learner is owned)
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
