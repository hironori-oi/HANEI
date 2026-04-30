"use server";

/**
 * HANEI - Study Sessions Server Actions (W10-T5 / 過学習防止)
 *
 * 当日累計学習秒数を「真のソース」として DB に永続化し、
 * 30 分 nudge / 60 分 hard_limit を reload を超えて一貫させる.
 *
 * 三層認可:
 *   - 各 Server Action 内で requireAuth + requireLearnerOwner (FormData / props 改ざん防御)
 *   - SQL は learner_id を必ず WHERE に含める
 *
 * 冪等性 / 防御:
 *   - startOrResumeStudySession: UNIQUE (learner_id, client_session_id) で二重 INSERT 防止
 *   - recordStudyHeartbeat: clamp で 1 回 +60 秒上限 / endedAt IS NULL の WHERE で終了済 session への加算を防止
 *   - endStudySession: endedAt IS NULL の WHERE で二重 UPDATE を弾く (idempotent)
 *
 * 罰則ゼロ哲学 (DEC-024):
 *   - hard_limit (60 分) 終了時も streak は守られる (本モジュールは streak に介入しない).
 */

import { eq, and, sql, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { studySessions } from "@/lib/db/schema";
import { requireAuth, requireLearnerOwner } from "@/lib/auth/guards";
import { getJstQuestDate } from "@/lib/quest/jst-date";
import {
  clampHeartbeatDeltaSeconds,
  clampSessionCumulativeSeconds,
  sanitizePreferredSessionMinutes,
} from "@/lib/study/study-time";

// ---------------------------------------------------------------------------
// 開始 / 再開
// ---------------------------------------------------------------------------

export interface StartOrResumeStudySessionInput {
  learnerId: string;
  /** /study URL に乗る session UUID (W10-T4 で発行) */
  clientSessionId: string;
  /** 5 / 7 / 10 / null (session-mode 外) */
  durationMinutes: 5 | 7 | 10 | null;
}

export interface StudySessionStartResult {
  /** DB row id (= server-issued UUID, client は不透明な ID として扱う) */
  sessionDbId: string;
  /** 当日累計秒 (= 全 session の cumulativeSeconds 合計 / 進行中 / 終了済 全て含む) */
  todayCumulativeSeconds: number;
  /** この session 単独の累計秒 (resume 時は 0 でない) */
  sessionCumulativeSeconds: number;
  /** 当日 quest_date / JST 6:00 境界 */
  sessionDate: string;
}

/**
 * Study session 行を冪等に確保し、当日累計秒を返す。
 *
 * 同一 (learnerId, clientSessionId) で 2 度呼ばれても同じ行を更新する。
 * 既存行が `ended_at` 済の場合は再オープンしない (= startedAt は不変, 累計は引き続き集計対象)。
 */
export async function startOrResumeStudySession(
  input: StartOrResumeStudySessionInput,
): Promise<StudySessionStartResult> {
  if (!input.learnerId || typeof input.learnerId !== "string") {
    throw new TypeError("[study-sessions] learnerId is required");
  }
  if (!input.clientSessionId || typeof input.clientSessionId !== "string") {
    throw new TypeError("[study-sessions] clientSessionId is required");
  }
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, input.learnerId);

  const sessionDate = getJstQuestDate(new Date());
  const durationMinutes = sanitizePreferredSessionMinutes(input.durationMinutes);

  // 既存行を先に SELECT (UNIQUE インデックスがあるので INSERT or UPDATE の判別)
  // eslint-disable-next-line no-restricted-syntax -- learner_id + client_session_id 二重スコープ済 (DEC-003)
  const existingRows = await db
    .select({
      id: studySessions.id,
      cumulativeSeconds: studySessions.cumulativeSeconds,
      endedAt: studySessions.endedAt,
    })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.learnerId, input.learnerId),
        eq(studySessions.clientSessionId, input.clientSessionId),
      ),
    )
    .limit(1);

  let sessionDbId: string;
  let sessionCumulativeSeconds: number;
  if (existingRows[0]) {
    sessionDbId = existingRows[0].id;
    sessionCumulativeSeconds = Math.max(
      0,
      Number(existingRows[0].cumulativeSeconds ?? 0),
    );
  } else {
    sessionDbId = `ss_${randomUUID()}`;
    await db.insert(studySessions).values({
      id: sessionDbId,
      learnerId: input.learnerId,
      sessionDate,
      clientSessionId: input.clientSessionId,
      durationMinutes,
      cumulativeSeconds: 0,
    });
    sessionCumulativeSeconds = 0;
  }

  const todayCumulativeSeconds = await sumTodayCumulativeSeconds(
    input.learnerId,
    sessionDate,
  );

  return {
    sessionDbId,
    todayCumulativeSeconds,
    sessionCumulativeSeconds,
    sessionDate,
  };
}

// ---------------------------------------------------------------------------
// Heartbeat (累計加算)
// ---------------------------------------------------------------------------

export interface RecordStudyHeartbeatInput {
  learnerId: string;
  sessionDbId: string;
  /** 加算秒数 (clamp 済前提だがサーバ側でも clamp する / 0 以下は no-op) */
  additionalSeconds: number;
}

export interface StudyHeartbeatResult {
  /** 加算後の (この session 単独の) 累計秒数 */
  sessionCumulativeSeconds: number;
  /** 加算後の当日累計秒 (全 session 合計) */
  todayCumulativeSeconds: number;
  /** session が既に終了済だった場合は true (UPDATE は no-op になっている) */
  alreadyEnded: boolean;
}

/**
 * 進行中 study_session に学習秒を加算する。
 *
 * 不変条件:
 *   - additionalSeconds は clampHeartbeatDeltaSeconds で 0..60 に詰める
 *   - cumulativeSeconds は最終的に SESSION_CUMULATIVE_HARD_CAP_SECONDS (= 4h) で頭打ち
 *   - endedAt IS NULL の行のみを更新する (終了後の session には加算しない)
 */
export async function recordStudyHeartbeat(
  input: RecordStudyHeartbeatInput,
): Promise<StudyHeartbeatResult> {
  if (!input.learnerId || typeof input.learnerId !== "string") {
    throw new TypeError("[study-sessions] learnerId is required");
  }
  if (!input.sessionDbId || typeof input.sessionDbId !== "string") {
    throw new TypeError("[study-sessions] sessionDbId is required");
  }
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, input.learnerId);

  const delta = clampHeartbeatDeltaSeconds(input.additionalSeconds);

  // delta=0 の場合でも today/session 累計は読みたいので SELECT は実行する
  if (delta > 0) {
    // SQLite: UPDATE ... SET cumulative_seconds = MIN(cap, cumulative_seconds + delta)
    // で hard cap を構造的に保証. WHERE に endedAt IS NULL を入れて終了後の加算を防ぐ.
    await db
      .update(studySessions)
      .set({
        cumulativeSeconds: sql`MIN(${clampSessionCumulativeSeconds(Number.MAX_SAFE_INTEGER)}, ${studySessions.cumulativeSeconds} + ${delta})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(studySessions.id, input.sessionDbId),
          eq(studySessions.learnerId, input.learnerId),
          isNull(studySessions.endedAt),
        ),
      );
  }

  // 加算後 (or 既に終了済 → 不変) の状態を読み戻す
  // eslint-disable-next-line no-restricted-syntax -- learner_id + id 二重スコープ済 (DEC-003)
  const rows = await db
    .select({
      sessionDate: studySessions.sessionDate,
      cumulativeSeconds: studySessions.cumulativeSeconds,
      endedAt: studySessions.endedAt,
    })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.id, input.sessionDbId),
        eq(studySessions.learnerId, input.learnerId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error("[study-sessions] session not found");
  }
  const sessionCumulativeSeconds = Math.max(
    0,
    Number(row.cumulativeSeconds ?? 0),
  );
  const todayCumulativeSeconds = await sumTodayCumulativeSeconds(
    input.learnerId,
    row.sessionDate,
  );

  return {
    sessionCumulativeSeconds,
    todayCumulativeSeconds,
    alreadyEnded: row.endedAt !== null && row.endedAt !== undefined,
  };
}

// ---------------------------------------------------------------------------
// 終了
// ---------------------------------------------------------------------------

export type StudySessionEndReason =
  | "natural"
  | "abort"
  | "overtime"
  | "hard_limit";

export interface EndStudySessionInput {
  learnerId: string;
  sessionDbId: string;
  endReason: StudySessionEndReason;
  /** 最終 heartbeat 分の加算 (0 でも可 / hard_limit 時の保険) */
  finalAdditionalSeconds?: number;
}

export interface StudySessionEndResult {
  /** 終了済か (false = 既に終了済だったので no-op) */
  ended: boolean;
  /** 終了時の (この session 単独の) 累計秒数 */
  sessionCumulativeSeconds: number;
  /** 終了時の当日累計秒 */
  todayCumulativeSeconds: number;
}

export async function endStudySession(
  input: EndStudySessionInput,
): Promise<StudySessionEndResult> {
  if (!input.learnerId || typeof input.learnerId !== "string") {
    throw new TypeError("[study-sessions] learnerId is required");
  }
  if (!input.sessionDbId || typeof input.sessionDbId !== "string") {
    throw new TypeError("[study-sessions] sessionDbId is required");
  }
  if (
    !["natural", "abort", "overtime", "hard_limit"].includes(input.endReason)
  ) {
    throw new TypeError("[study-sessions] invalid endReason");
  }
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, input.learnerId);

  const delta = clampHeartbeatDeltaSeconds(input.finalAdditionalSeconds ?? 0);
  const now = new Date();

  // 1) 進行中なら最終加算 + endedAt + endReason を一気に書き込み (atomic)
  //    既に endedAt セット済の行は WHERE で除外されるため二重 UPDATE は発生しない (idempotent)
  const updateResult = await db
    .update(studySessions)
    .set({
      cumulativeSeconds: sql`MIN(${clampSessionCumulativeSeconds(Number.MAX_SAFE_INTEGER)}, ${studySessions.cumulativeSeconds} + ${delta})`,
      endedAt: now,
      endReason: input.endReason,
      updatedAt: now,
    })
    .where(
      and(
        eq(studySessions.id, input.sessionDbId),
        eq(studySessions.learnerId, input.learnerId),
        isNull(studySessions.endedAt),
      ),
    )
    .returning({ id: studySessions.id });

  const ended = updateResult.length > 0;

  // 2) 読み戻し
  // eslint-disable-next-line no-restricted-syntax -- learner_id + id 二重スコープ済 (DEC-003)
  const rows = await db
    .select({
      sessionDate: studySessions.sessionDate,
      cumulativeSeconds: studySessions.cumulativeSeconds,
    })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.id, input.sessionDbId),
        eq(studySessions.learnerId, input.learnerId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error("[study-sessions] session not found after end");
  }
  const todayCumulativeSeconds = await sumTodayCumulativeSeconds(
    input.learnerId,
    row.sessionDate,
  );

  return {
    ended,
    sessionCumulativeSeconds: Math.max(0, Number(row.cumulativeSeconds ?? 0)),
    todayCumulativeSeconds,
  };
}

// ---------------------------------------------------------------------------
// 当日累計取得
// ---------------------------------------------------------------------------

/**
 * 学習者の「今日 (JST 6:00 境界)」の累計学習秒数を返す。
 *
 * 認可: requireLearnerOwner のみ。
 * - parent dashboard / study UI からの読み出し用 (Server Component で使う想定).
 */
export async function getTodayLearningSeconds(
  learnerId: string,
): Promise<number> {
  if (!learnerId || typeof learnerId !== "string") {
    throw new TypeError("[study-sessions] learnerId is required");
  }
  const session = await requireAuth();
  await requireLearnerOwner(session.userId, learnerId);

  const sessionDate = getJstQuestDate(new Date());
  return sumTodayCumulativeSeconds(learnerId, sessionDate);
}

/**
 * (内部) ある learner × 当日の SUM(cumulative_seconds) を返す。
 * authz は呼び出し側で済ませた前提。
 */
async function sumTodayCumulativeSeconds(
  learnerId: string,
  sessionDate: string,
): Promise<number> {
  // eslint-disable-next-line no-restricted-syntax -- learner_id + session_date 二重スコープ済 (DEC-003)
  const rows = await db
    .select({
      total: sql<number>`COALESCE(SUM(${studySessions.cumulativeSeconds}), 0)`,
    })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.learnerId, learnerId),
        eq(studySessions.sessionDate, sessionDate),
      ),
    );
  const total = Number(rows[0]?.total ?? 0);
  return Math.max(0, total);
}
