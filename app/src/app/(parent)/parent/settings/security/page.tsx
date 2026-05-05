/**
 * /parent/settings/security - セキュリティ設定 (W12-T1 / Phase 3 第 1 波 / DEC-074)
 *
 * 親が「パスワード変更」「2 段階認証」「退会」など重要操作を見つける入口.
 *
 * Phase 3 第 1 波 (本 atomic) では入口だけ用意し、実体は以下で実装:
 *   - パスワード変更: Better Auth /sign-in/email-password 内 reset flow に link
 *   - 2 段階認証: 将来 atomic で実装 (W13 以降 / Should-have)
 *   - 退会: W12-T10 atomic で実装
 *
 * 認可:
 *   - requireAuth (proxy 第一層)
 *   - requireParent (第二層)
 *
 * 設計原則: 絵文字ゼロ / Heroicons / 罰語ゼロ (DEC-024).
 */

import Link from "next/link";
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  KeyIcon,
  ShieldExclamationIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAuth, requireParent } from "@/lib/auth/guards";

export const metadata = {
  title: "セキュリティ",
};

export default async function ParentSettingsSecurityPage(): Promise<React.ReactElement> {
  const session = await requireAuth();
  await requireParent(session.userId);

  const items = [
    {
      title: "パスワード変更",
      description:
        "現在のパスワードを変更します。安全のため、定期的な変更をおすすめします。",
      icon: KeyIcon,
      href: "/sign-in/email-password",
      cta: "パスワード変更画面へ",
      testId: "security-link-password",
      enabled: true,
    },
    {
      title: "2 段階認証",
      description:
        "メールに加えてもう 1 つの認証要素でアカウントを保護します。今後のリリースで追加予定です。",
      icon: ShieldExclamationIcon,
      href: "#",
      cta: "近日対応予定",
      testId: "security-link-2fa",
      enabled: false,
    },
    {
      title: "退会する",
      description:
        "アカウントとお子さまの学習データを完全に削除します。元に戻せません。今後のリリースで追加予定です。",
      icon: ArrowRightOnRectangleIcon,
      href: "#",
      cta: "近日対応予定",
      testId: "security-link-withdraw",
      enabled: false,
    },
  ];

  return (
    <main
      data-testid="parent-settings-security"
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8"
    >
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link
            href="/parent/settings"
            className="inline-flex items-center gap-1"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            設定に戻る
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <ShieldCheckIcon
            className="mb-2 h-8 w-8 text-primary"
            aria-hidden="true"
          />
          <CardTitle className="text-2xl">セキュリティ</CardTitle>
          <CardDescription>
            パスワード変更や、退会など重要な操作はこちらです。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            ログイン中の親メール: <span data-testid="security-parent-email">{session.email}</span>
          </p>
        </CardContent>
      </Card>

      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.title}>
            <Card>
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
                {it.enabled ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={it.href} data-testid={it.testId}>
                      {it.cta}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    data-testid={it.testId}
                  >
                    {it.cta}
                  </Button>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
