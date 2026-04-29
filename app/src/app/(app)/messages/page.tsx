/**
 * /messages - 学習者 受信箱 (W9-D)
 *
 * 親→子メッセージを新着順に一覧表示する Server Component。
 * Phase 1 では学習者直ログイン経路がないため、保護者が代理で
 * 「読みました」を打つ運用を許可する (template-catalog.ts 参照)。
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - resolveActiveLearner (?learner= から family scoped で解決)
 *   - requireLearnerOwner (SQL 再確認 / 改ざん防御)
 *   - markMessageRead 内部でも requireParent + family scope を再確認
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LearnerSwitcherTabs } from "@/components/learner/learner-switcher-tabs";
import { ParentMessageCard } from "@/components/messages/parent-message-card";
import {
  requireAuth,
  getFamilyIdForUser,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { getLearnersForParent } from "@/lib/learner/repository";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import {
  getMessagesForLearner,
  markMessageRead,
} from "@/lib/actions/parent-messages";
import { findTemplateByCode } from "@/lib/messages/template-catalog";

export const metadata = {
  title: "メッセージ",
};

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MessagesPage({ searchParams }: PageProps) {
  // 1. 認可
  const session = await requireAuth();
  const familyId = await getFamilyIdForUser(session.userId);
  if (!familyId) {
    redirect("/onboarding/learner");
  }

  // 2. learners + active 解決
  const learners = await getLearnersForParent(session.userId);
  if (learners.length === 0) {
    redirect("/onboarding/learner");
  }
  const sp = (await searchParams) ?? {};
  const resolved = resolveActiveLearner({
    learners: learners.map((l) => ({ id: l.id, nickname: l.nickname })),
    rawQuery: sp.learner,
  });
  const activeId = resolved.active?.id;
  if (!activeId) {
    redirect("/onboarding/learner");
  }

  // 3. 三層認可第二層 (SQL レベル)
  await requireLearnerOwner(session.userId, activeId);

  // 4. メッセージ一覧 (新着順)
  const messages = await getMessagesForLearner(activeId);
  const unreadCount = messages.filter((m) => m.readAt === null).length;
  const totalCount = messages.length;

  // 5. 既読更新 Server Action (closure-bound)
  async function markReadAction(formData: FormData): Promise<void> {
    "use server";
    const messageId = formData.get("messageId");
    if (typeof messageId !== "string") return;
    // markMessageRead 内部で requireAuth + requireParent + family scope を再確認
    await markMessageRead(messageId);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      {/* 戻る + 学習者スイッチャー */}
      <div className="mb-6 flex items-start justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link
            href={
              resolved.active
                ? `/home?learner=${encodeURIComponent(resolved.active.id)}`
                : "/home"
            }
            className="inline-flex items-center gap-1"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            ホームへ
          </Link>
        </Button>
        {learners.length > 1 && resolved.active ? (
          <LearnerSwitcherTabs
            learners={learners.map((l) => ({
              id: l.id,
              nickname: l.nickname,
              avatarId: "kotodama_tori",
            }))}
            activeLearnerId={resolved.active.id}
          />
        ) : null}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <EnvelopeIcon
            className="mb-2 h-8 w-8 text-primary"
            aria-hidden="true"
          />
          <CardTitle className="text-2xl">
            おうえん メッセージ
          </CardTitle>
          <CardDescription>
            ぱぱ／ままから とどいた メッセージを よみましょう。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p
            className="text-sm text-muted-foreground"
            aria-live="polite"
            data-testid="messages-summary"
          >
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {unreadCount}
            </span>
            <span className="ml-1">/ {totalCount} 通 未読</span>
          </p>
        </CardContent>
      </Card>

      {messages.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-base text-muted-foreground">
            まだ メッセージは とどいていません。
          </p>
        </Card>
      ) : (
        <ul className="space-y-3" data-testid="message-list">
          {messages.map((m) => {
            const tpl = m.templateCode
              ? findTemplateByCode(m.templateCode)
              : null;
            return (
              <li key={m.id}>
                <ParentMessageCard
                  id={m.id}
                  body={m.body}
                  category={tpl?.category ?? null}
                  createdAt={m.createdAt}
                  readAt={m.readAt}
                  markReadAction={markReadAction}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
