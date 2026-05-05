/**
 * /parent/settings - 親 settings index (W12-T1 / Phase 3 第 1 波 / DEC-074)
 *
 * 4 link card: account / notifications / security (+ 既存 アクセサリは learner-side のため除外).
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - requireParent (第二層)
 *   - 既存 (parent) layout で familyMember / scopedQueries まで担保済
 *
 * 設計原則 (CLAUDE.md):
 *   - 絵文字ゼロ / Heroicons のみ
 *   - 子向けでなく親向けなので「ですます調」標準的な日本語
 *   - 罰語ゼロ (DEC-024)
 */

import Link from "next/link";
import {
  UserCircleIcon,
  BellIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  requireAuth,
  requireParent,
} from "@/lib/auth/guards";

export const metadata = {
  title: "設定",
};

export default async function ParentSettingsIndexPage(): Promise<React.ReactElement> {
  // 認可: parent layout 側で requireAuth + requireParent + requireFamilyMember 済だが
  // 防御的に再確認 (DEC-003 三層認可)
  const session = await requireAuth();
  await requireParent(session.userId);

  const items = [
    {
      href: "/parent/settings/account",
      title: "アカウント",
      description: "学習者の表示名 / 学年 / 親メールを変更します。",
      icon: UserCircleIcon,
      testId: "settings-link-account",
    },
    {
      href: "/parent/settings/notifications",
      title: "通知 / リマインド",
      description:
        "メール通知の ON / OFF と、毎日のリマインド時刻を設定します。",
      icon: BellIcon,
      testId: "settings-link-notifications",
    },
    {
      href: "/parent/settings/security",
      title: "セキュリティ",
      description: "パスワード変更や、退会など重要な操作はこちらです。",
      icon: ShieldCheckIcon,
      testId: "settings-link-security",
    },
  ];

  return (
    <main
      data-testid="parent-settings-index"
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8"
    >
      <header className="mb-6">
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          お子さまの学習環境を 親アカウントから 管理します。
        </p>
      </header>

      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              data-testid={it.testId}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <Card className="transition-colors hover:border-primary">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <it.icon
                      className="mt-0.5 h-6 w-6 text-primary"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <CardTitle className="text-base">{it.title}</CardTitle>
                      <CardDescription>{it.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    タップして開きます
                  </p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
