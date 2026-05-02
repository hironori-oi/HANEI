/**
 * /admin/* layout (W12-T1 / DEC-065)
 *
 * admin ロール専用の最小 layout. `requireAdmin()` は子 page 側で呼ぶ
 * (DEC-065 §1: 「`page.tsx` 冒頭で `requireAuth()` + `if (session.role !== 'admin') redirect('/home')`」).
 *
 * layout 自体は thin wrapper のみとし、UI 装飾を持たない (admin 内部 UI は飾らない方針).
 *
 * SEO 抑止 (W12-T1 follow-up / review M-1 / 2026-05-03):
 *   - `metadata.robots = { index: false, follow: false }` で `/admin/*` 配下を
 *     検索エンジン索引から構造的に除外 (root layout の `robots: { index: true }`
 *     を本 layout で上書き). admin route group 全体に適用される.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-h-screen bg-background">{children}</main>;
}
