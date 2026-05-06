/**
 * HANEI - GET /api/study/adventure-map (DEC-089 Plan C 項目 4)
 *
 * 冒険マップ用の learner 進捗集計 + kotodama-tori 短尺音声 manifest を JSON で返す.
 *
 * - DEC-006 拡張版: GET +1 = 13/15 (適合)
 * - DEC-003 三層認可: 第一層 middleware + 第二層 requireAuth + requireLearnerOwner + 第三層 SQL learnerId スコープ
 * - DEC-024 罰則ゼロ: 未着手 = 中立 lock / 赤色 0 / 叱責語 0
 * - DEC-055 idempotency: 副作用ゼロ (read-only) / R2 cache hit 確認のみ
 *
 * リクエスト:
 *   GET /api/study/adventure-map?learner=<learnerId>
 *
 * レスポンス:
 *   200 { areas: AdventureMapArea[], clearedCount, inProgressCount, notStartedCount, voiceManifest: [...] }
 *   400 { error: "missing_learner" }   // ?learner= 未指定
 *   401 { error: "unauthorized" }      // 未ログイン
 *   403 { error: "forbidden" }         // learner 所有権なし
 */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import {
  getSession,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { getAdventureMapSummary } from "@/lib/study/aggregations";
import { getKotodamaVoiceManifest } from "@/lib/ai/kotodama-voice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // 第二層認可: getSession 直接利用 (API は redirect させず JSON で 401 返却)
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const learnerId = url.searchParams.get("learner");
  if (!learnerId || learnerId.length === 0) {
    return NextResponse.json({ error: "missing_learner" }, { status: 400 });
  }

  // 認可: parent → learner ownership (既存 /api/ai/coach 同様パターン).
  // Phase 1 / 2 では learner 直接ログイン経路がないため、要求 learner は parent が所有する
  // family 配下であることを SQL レベルで再確認する (DEC-003 三層認可拡張).
  try {
    await requireLearnerOwner(session.userId, learnerId);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [summary, voiceManifest] = await Promise.all([
    getAdventureMapSummary(db, learnerId),
    // R2 cache hit 確認のみ (副作用ゼロ / cost ¥0)
    getKotodamaVoiceManifest().catch(() => []),
  ]);

  return NextResponse.json({
    areas: summary.areas,
    clearedCount: summary.clearedCount,
    inProgressCount: summary.inProgressCount,
    notStartedCount: summary.notStartedCount,
    voiceManifest,
  });
}
