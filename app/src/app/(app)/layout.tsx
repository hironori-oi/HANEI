import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { HanekinBalanceBadge } from "@/components/economy/HanekinBalanceBadge";
import { getSession } from "@/lib/auth/guards";
import { getLearnersForParent } from "@/lib/learner/repository";
import { getCoinBalance } from "@/lib/actions/coins";

/**
 * Authed (app) layout
 *
 * - 既存 SiteHeader を維持
 * - W10-T2: 共通 header に HanekinBalanceBadge を常時表示
 *   - 全 authed ページから残高が見える状態にする
 *   - layout からは searchParams が取れないため active learner は first learner で解決
 *     (各ページ側で ?learner= による上書きは page header (HanekinBalanceHeader 等) で行う)
 *   - 未ログイン or learner 未作成 (onboarding 中) では badge を出さない
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  let badge: React.ReactNode = null;

  if (session) {
    const learners = await getLearnersForParent(session.userId);
    const active = learners[0];
    if (active) {
      const balance = await getCoinBalance(active.id);
      badge = <HanekinBalanceBadge balance={balance} learnerId={active.id} />;
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      {badge ? (
        <div
          className="border-b bg-card/40"
          data-testid="authed-balance-bar"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-2">
            <Link
              href="/home"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              ホーム
            </Link>
            {badge}
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
