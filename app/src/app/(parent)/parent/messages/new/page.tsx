/**
 * /parent/messages/new - 親→子 応援メッセージ送信 (W9-D)
 *
 * 30 種テンプレ + 自由文 (200 字) の 2 系統で learner にメッセージを送る。
 *
 * 認可:
 *   - requireAuth → requireParent → requireFamilyMember (parent layout)
 *   - resolveActiveLearner (?learner= or default)
 *   - requireLearnerOwner (SQL 再確認 / 改ざん防御)
 *   - sendMessageFromTemplate / sendCustomMessage 内部でも再度 requireParent + requireLearnerOwner
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TemplatePicker } from "@/components/messages/template-picker";
import {
  requireAuth,
  requireParent,
  requireFamilyMember,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { scopedQueries } from "@/lib/db/scoped";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import {
  sendMessageFromTemplate,
  sendCustomMessage,
} from "@/lib/actions/parent-messages";

export const metadata = {
  title: "メッセージを 送る",
};

interface PageProps {
  searchParams?: Promise<{ learner?: string | string[] }>;
}

export default async function ParentNewMessagePage({
  searchParams,
}: PageProps) {
  // 1. 三層認可
  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);
  await requireFamilyMember(session.userId, familyId);

  // 2. scoped query で家族の learner 一覧
  const scoped = scopedQueries(familyId);
  const learnersRaw = await scoped.listLearners();
  if (learnersRaw.length === 0) {
    redirect("/onboarding/learner");
  }
  const learnersLite = learnersRaw.map((l) => ({
    id: l.id,
    nickname: l.nickname,
  }));
  const sp = searchParams ? await searchParams : {};
  const { active } = resolveActiveLearner({
    learners: learnersLite,
    rawQuery: sp.learner,
  });
  const learner = active
    ? learnersRaw.find((l) => l.id === active.id) ?? learnersRaw[0]
    : learnersRaw[0];

  if (!learner) {
    redirect("/parent/dashboard");
  }
  await requireLearnerOwner(session.userId, learner.id);

  // 3. Server Actions: closure-bound (URL 改ざん不可)
  async function sendTemplateAction(formData: FormData): Promise<void> {
    "use server";
    const templateCode = formData.get("templateCode");
    const toLearnerId = formData.get("toLearnerId");
    if (typeof templateCode !== "string" || typeof toLearnerId !== "string") {
      return;
    }
    // 内部で requireAuth + requireParent + requireLearnerOwner を再実行する
    await sendMessageFromTemplate({ templateCode, toLearnerId });
  }

  async function sendCustomAction(formData: FormData): Promise<void> {
    "use server";
    const body = formData.get("body");
    const toLearnerId = formData.get("toLearnerId");
    if (typeof body !== "string" || typeof toLearnerId !== "string") {
      return;
    }
    await sendCustomMessage({ body, toLearnerId });
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link
            href={
              learner
                ? `/parent/dashboard?learner=${encodeURIComponent(learner.id)}`
                : "/parent/dashboard"
            }
            className="inline-flex items-center gap-1"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            ダッシュボードへ
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <ChatBubbleLeftRightIcon
            className="mb-2 h-8 w-8 text-primary"
            aria-hidden="true"
          />
          <CardTitle className="text-2xl">
            {learner.nickname} さんに メッセージを 送る
          </CardTitle>
          <CardDescription>
            応援・祝福の テンプレートから ひとつ えらんで送りましょう。
            文章は そのまま でも、カスタム しても 送れます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplatePicker
            toLearnerId={learner.id}
            sendTemplateAction={sendTemplateAction}
            sendCustomAction={sendCustomAction}
          />
        </CardContent>
      </Card>
    </main>
  );
}
