import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { LearnerSwitcher } from "./components/learner-switcher";
import {
  requireAuth,
  requireParent,
  requireFamilyMember,
} from "@/lib/auth/guards";
import { scopedQueries } from "@/lib/db/scoped";

/**
 * Parent route group layout (W4 / T-3 拡張)
 *
 * - 既存 SiteHeader を維持
 * - 子ナビ + 学習者切替 Tabs を追加
 * - 学習者 Tabs は learners.length > 1 のときだけ表示
 *
 * 認可: requireAuth → requireParent → requireFamilyMember (三層認可第二層)
 */
export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);
  await requireFamilyMember(session.userId, familyId);

  const scoped = scopedQueries(familyId);
  const learners = await scoped.listLearners();
  const activeLearnerId = learners[0]?.id ?? "";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      {learners.length > 0 ? (
        <div className="border-b bg-card/50">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-3">
            <nav aria-label="保護者メニュー" className="flex gap-4 text-sm">
              <Link
                href="/parent/dashboard"
                className="text-foreground hover:text-primary"
              >
                ダッシュボード
              </Link>
              <Link
                href="/parent/mock-exam-results"
                className="text-foreground hover:text-primary"
              >
                模試結果
              </Link>
              <Link
                href="/parent/settings"
                data-testid="parent-nav-settings"
                className="text-foreground hover:text-primary"
              >
                設定
              </Link>
            </nav>
            {learners.length > 1 ? (
              <div className="ml-auto">
                <LearnerSwitcher
                  learners={learners.map((l) => ({
                    id: l.id,
                    nickname: l.nickname,
                  }))}
                  activeLearnerId={activeLearnerId}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
