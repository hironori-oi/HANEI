export const metadata = { title: "プライバシーポリシー" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-bold">プライバシーポリシー</h1>
      <p className="text-muted-foreground">
        本ページは W2 以降に正式版を掲載します。HANEI は 13 歳未満のお子さま向けサービスのため、
        改正個人情報保護法および COPPA の趣旨に沿った保護措置を講じます。
      </p>
      <h2 className="mt-8 mb-3 text-xl font-semibold">取得する情報</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>保護者のメールアドレス・お名前</li>
        <li>お子さまのニックネーム (本名は取得しません)</li>
        <li>学習履歴・正答率・受験予定日</li>
        <li>AIコーチとの会話内容 (安全のため記録)</li>
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        最終更新: 2026-04-26 (W1 placeholder)
      </p>
    </main>
  );
}
