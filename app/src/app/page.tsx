import Link from "next/link";
import {
  AcademicCapIcon,
  SparklesIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/guards";

/**
 * DEC-090 項目 2: 右上ヘッダ context-aware (認証コンテキスト対応).
 *
 * - 未認証: 既存の「無料ではじめる」+「ログイン」2 件 (LP 訪問パス完全保持)
 * - 認証済 / parent: 「ダッシュボードに戻る」CTA 1 件 (→ /parent/dashboard)
 * - 認証済 / learner: 「ホームに戻る」CTA 1 件 (→ /home)
 *
 * 認証情報取得は既存 `getSession()` (Better Auth) を流用 (新規 API 0).
 *
 * DEC-090 hotfix (2026-05-06): parent CTA href を `/parent` → `/parent/dashboard` に修正.
 * `/parent` は route group `(parent)/parent/` 配下に page.tsx を持たず 404 になるため,
 * canonical な保護者ホーム `/parent/dashboard` (既存 layout.tsx の Logo link と同一) に揃える.
 */
export default async function HomePage() {
  const session = await getSession();
  const isAuthenticated = session !== null;
  const isParent = session?.role === "parent";
  const isLearner = session?.role === "learner";
  const homeHref = isLearner
    ? "/home"
    : isParent
      ? "/parent/dashboard"
      : null;
  const homeLabel = isLearner
    ? "ホームに戻る"
    : isParent
      ? "ダッシュボードに戻る"
      : null;

  return (
    <main className="hanei-bg-gradient hanei-bg-gradient--sakura mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-6 py-16">
      {/* Hero */}
      <section className="text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
          HANEI / ハンエイ / 半英
        </p>
        <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          半年で、英検3級。
          <br className="hidden sm:block" />
          <span className="text-primary">AIコーチと、毎日いっしょに。</span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          HANEI は小学生のための英語学習アプリです。
          英検5級から3級まで、本人のレベルに合わせて毎日1時間の学習プランをAIコーチが用意します。
        </p>
        {isAuthenticated && homeHref && homeLabel ? (
          <div
            className="flex flex-wrap justify-center gap-4"
            data-testid="hero-cta-authenticated"
          >
            <Button
              asChild
              size="lg"
              className="min-h-tap-cta min-w-tap-cta"
            >
              <Link href={homeHref} data-testid="hero-cta-home">
                {homeLabel}
              </Link>
            </Button>
          </div>
        ) : (
          <div
            className="flex flex-wrap justify-center gap-4"
            data-testid="hero-cta-anonymous"
          >
            <Button asChild size="lg" className="min-h-tap-cta min-w-tap-cta">
              <Link href="/signup">無料ではじめる</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-tap-cta"
            >
              <Link href="/login">ログイン</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Features */}
      <section className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <AcademicCapIcon className="mb-3 h-10 w-10 text-primary" aria-hidden="true" />
            <CardTitle>英検 5級・4級・3級</CardTitle>
            <CardDescription>
              本人のレベルに合わせて自動進級。語彙・文法・リスニング・読解・ライティングを段階的に学べます。
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <SparklesIcon className="mb-3 h-10 w-10 text-primary" aria-hidden="true" />
            <CardTitle>AIコーチが伴走</CardTitle>
            <CardDescription>
              誤答の解説、わからないところの質問、その日の学習プラン。AIコーチが毎日サポートします。
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <ChartBarIcon className="mb-3 h-10 w-10 text-primary" aria-hidden="true" />
            <CardTitle>受験日まで逆算</CardTitle>
            <CardDescription>
              受験日を登録すると、合格に向けた週次・日次プランを自動生成。保護者にも進捗が見える化されます。
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      {/* Footer */}
      <footer className="mt-16 border-t pt-8 text-center text-sm text-muted-foreground">
        <p>HANEI - 小学生向け英語学習アプリ</p>
        <p className="mt-2">
          クローズドβ公開中。ご利用は無料です（招待制）。
        </p>
        <p className="mt-1">
          招待をご希望の方は{" "}
          <a className="underline" href="mailto:support@hanei.app">
            こちら
          </a>
          までご連絡ください。
        </p>
      </footer>
    </main>
  );
}
