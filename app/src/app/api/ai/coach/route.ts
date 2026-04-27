/**
 * HANEI - AI コーチ API (POST /api/ai/coach)
 *
 * 機能:
 *  - 認証必須 (Better Auth セッション)
 *  - 三重ガード (Layer 1 NG ワード → Layer 2 OpenAI Moderation → Layer 3 出力フィルタ)
 *  - tool use 4 関数 (recommend / explain / generate / update_plan)
 *  - 1 ユーザー 1 日 ¥10 cost guard
 *  - ai_coach_conversations / ai_coach_messages にメッセージ保存
 *
 * リクエスト: { learnerId: string, message: string, conversationId?: string, contextType?: string }
 * レスポンス: text/event-stream (AI SDK toDataStreamResponse) または JSON エラー
 */

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth, requireLearnerOwner } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  aiCoachConversations,
  aiCoachMessages,
} from "@/lib/db/schema";
import { moderateText, maskRiskOutputs } from "@/lib/ai/moderation";
import { streamWithFallback, hasApiKey } from "@/lib/ai/openai";
import { KID_SAFE_SYSTEM_PROMPT } from "@/lib/ai/coach";
import { aiCoachTools } from "@/lib/ai/tools";
import {
  estimateCostJpy,
  isOverDailyLimit,
} from "@/lib/ai/cost-guard";

const RequestSchema = z.object({
  learnerId: z.string().min(1),
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  contextType: z
    .enum(["general", "wrong_answer", "study_plan", "encouragement"])
    .optional(),
});

export async function POST(request: NextRequest) {
  // 1. 認証
  const session = await requireAuth();

  // 2. リクエスト parse
  let body: z.infer<typeof RequestSchema>;
  try {
    const json = await request.json();
    body = RequestSchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", detail: err instanceof Error ? err.message : "" },
      { status: 400 },
    );
  }

  // 3. 認可 (parent → learner ownership)
  try {
    await requireLearnerOwner(session.userId, body.learnerId);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 4. 入力 moderation (Layer 1 + Layer 2)
  const inputMod = await moderateText(body.message);
  if (inputMod.flagged) {
    // 安全な定型レスポンスを返す
    const safeResponse =
      "コーチは英語のお手伝いだよ。心配なことがあったら、家の人に話してみてね。";
    return NextResponse.json({
      text: safeResponse,
      moderationVerdict: "blocked_input",
      reason: inputMod.reason,
    });
  }

  // 5. cost guard
  const cost = await isOverDailyLimit(body.learnerId);
  if (cost.over) {
    return NextResponse.json(
      {
        text: "きょうの AI コーチおはなし回数の上限に達しました。あしたまた話しかけてくださいね。",
        moderationVerdict: "warning",
        cost,
      },
      { status: 200 },
    );
  }

  // 6. 会話を取得 or 新規作成
  let conversationId = body.conversationId;
  if (!conversationId) {
    conversationId = `cv_${randomUUID()}`;
    await db.insert(aiCoachConversations).values({
      id: conversationId,
      learnerId: body.learnerId,
      contextType: body.contextType ?? "general",
    });
  } else {
    // 既存 conversation の learner 一致を確認
    // eslint-disable-next-line no-restricted-syntax -- 認可確認済 (requireLearnerOwner 通過後)
    const conv = await db
      .select()
      .from(aiCoachConversations)
      .where(eq(aiCoachConversations.id, conversationId))
      .limit(1);
    if (!conv[0] || conv[0].learnerId !== body.learnerId) {
      return NextResponse.json({ error: "forbidden_conversation" }, { status: 403 });
    }
  }

  // 7. user メッセージを保存
  await db.insert(aiCoachMessages).values({
    id: `msg_${randomUUID()}`,
    conversationId,
    role: "user",
    content: body.message,
    moderationVerdict: "pass",
  });

  // 8. AI 応答を生成 (API キー無しならモック)
  if (!hasApiKey()) {
    const mock =
      "(モック応答) わからないところは、いっしょに考えましょう。問題のどこがむずかしかったか教えてくれますか。";
    await db.insert(aiCoachMessages).values({
      id: `msg_${randomUUID()}`,
      conversationId,
      role: "assistant",
      content: mock,
      tokensIn: 0,
      tokensOut: 0,
      costJpy: 0,
      moderationVerdict: "pass",
    });
    return NextResponse.json({
      text: mock,
      conversationId,
      moderationVerdict: "pass",
      mock: true,
    });
  }

  // 9. ストリーミング応答 (AI SDK)
  const result = await streamWithFallback({
    system: KID_SAFE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: body.message }],
    tools: aiCoachTools as unknown as Record<string, unknown>,
    maxTokens: 600,
  });

  // ストリーム完了後に出力 moderation + DB 保存 を行うため、
  // 全文を assemble してから返却する (Phase 1 では SSE ではなく一括 JSON で十分)
  let assembled = "";
  for await (const chunk of result.textStream) {
    assembled += chunk;
  }

  const usage = await result.usage;
  const tokensIn = usage?.promptTokens ?? 0;
  const tokensOut = usage?.completionTokens ?? 0;
  const costJpy = estimateCostJpy(tokensIn, tokensOut);

  // 10. 出力 moderation + マスク
  const outputMod = await moderateText(assembled);
  let finalText = maskRiskOutputs(assembled);
  let verdict: "pass" | "blocked_output" | "warning" = "pass";
  if (outputMod.flagged) {
    finalText =
      "ごめんなさい、いまうまく答えられませんでした。べつの言い方で聞いてみてね。";
    verdict = "blocked_output";
  }

  await db.insert(aiCoachMessages).values({
    id: `msg_${randomUUID()}`,
    conversationId,
    role: "assistant",
    content: finalText,
    tokensIn,
    tokensOut,
    costJpy,
    moderationVerdict: verdict,
  });

  return NextResponse.json({
    text: finalText,
    conversationId,
    moderationVerdict: verdict,
    tokensIn,
    tokensOut,
    costJpy,
  });
}
