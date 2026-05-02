/**
 * /admin/kpi - 内部運営 KPI ダッシュボード (W12-T1 / DEC-065)
 *
 * 6 系統の KPI Card を縦スクロールで read-only 表示する.
 *
 * 認可:
 *   - `requireAdmin()` で role !== 'admin' を `/home` に redirect (第二層 / DEC-065).
 *   - 集計は SQL レベル aggregate のみ (= 個別 family / learner row は flow しない / DEC-003 / DEC-065 §5).
 *
 * デザイン:
 *   - admin 向けで飾らない (DEC-065 §UI / 「飾らない / Heroicons のみ / 罰語回避」).
 *   - 6 つの KPI を縦スクロール + 各 card に `data-kpi-id` を付与し E2E が stable に当てる.
 *   - 罰語不在 (DEC-024 罰則ゼロ哲学 / 構造的担保: kpi-summary.ts の fallback 文字列に罰語ゼロ).
 */

import {
  ChartBarIcon,
  UsersIcon,
  FireIcon,
  TrophyIcon,
  SparklesIcon,
  ChatBubbleLeftEllipsisIcon,
  ClockIcon,
  BeakerIcon,
} from "@heroicons/react/24/outline";

import { requireAdmin } from "@/lib/auth/guards";
import { getKpiDashboard } from "@/lib/admin/kpi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "KPI ダッシュボード (admin)",
};

// 動的にセッション認可するため static rendering を抑止.
export const dynamic = "force-dynamic";

const ICON_BY_NAME = {
  ChartBarIcon,
  UsersIcon,
  FireIcon,
  TrophyIcon,
  SparklesIcon,
  ChatBubbleLeftEllipsisIcon,
  ClockIcon,
  BeakerIcon,
} as const;

type IconName = keyof typeof ICON_BY_NAME;

function KpiIcon({ name }: { name: IconName }) {
  const Component = ICON_BY_NAME[name];
  return <Component className="h-6 w-6 text-muted-foreground" aria-hidden />;
}

export default async function AdminKpiPage() {
  await requireAdmin();
  const view = await getKpiDashboard();

  return (
    <div
      className="mx-auto max-w-3xl px-6 py-8"
      data-testid="admin-kpi-dashboard"
      data-generated-at={view.generatedAtIsoUtc}
    >
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ChartBarIcon className="h-7 w-7" aria-hidden />
          KPI ダッシュボード
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          内部運営向けの集約値ダッシュボードです。個別の家庭 / 学習者の情報は表示されません。
        </p>
      </header>

      <ul className="flex flex-col gap-4">
        {view.cards.map((card) => (
          <li key={card.kpiId}>
            <Card data-kpi-id={card.kpiId} data-kpi-value={card.primaryValue}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="flex flex-col">
                  <CardTitle className="text-base font-medium">
                    {card.title}
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {card.secondaryLabel}
                  </CardDescription>
                </div>
                <KpiIcon name={card.iconName} />
              </CardHeader>
              <CardContent>
                <div
                  className="text-3xl font-bold tabular-nums"
                  data-kpi-primary
                >
                  {card.primaryValue}
                </div>
                {card.rows && card.rows.length > 0 ? (
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {card.rows.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-3 border-b border-dashed pb-1 last:border-b-0"
                        data-kpi-row-id={row.id}
                      >
                        <span className="text-muted-foreground">
                          {row.label}
                        </span>
                        <span className="font-medium tabular-nums">
                          {row.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
