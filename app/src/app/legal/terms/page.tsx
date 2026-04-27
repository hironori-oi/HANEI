export const metadata = { title: "利用規約" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-bold">利用規約</h1>
      <p className="text-muted-foreground">
        本ページは W2 以降に正式版を掲載します。HANEI は無料サービスとして提供されます (DEC-012)。
      </p>
      <h2 className="mt-8 mb-3 text-xl font-semibold">利用対象者</h2>
      <p>本サービスは 13 歳未満のお子さまの保護者の方が登録いただきます。</p>
      <p className="mt-6 text-sm text-muted-foreground">
        最終更新: 2026-04-26 (W1 placeholder)
      </p>
    </main>
  );
}
