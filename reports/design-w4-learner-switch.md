# PRJ-016 HANEI W4 学習者切替 UX ガイド

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W4 開発実装（`(parent)/layout.tsx` 最上段ヘッダーの学習者切替）
- **W3 連携**: design-w3-parent-dashboard.md § 3.1 ParentHeaderBar（W3 では Select で簡易実装、W4 で UX を本ガイドに従い再構築）
- **DEC 連携**: DEC-004 / DEC-008 / DEC-012 / DEC-018 / DEC-023

---

## § 1. 切替 UI の選定

### 1.1 学習者人数別の UI 切替

| 学習者数 | 採用 UI | 理由 |
|---|---|---|
| 1 名 | UI 非表示、学習者名を平文表示 | 切替不要、ノイズ削減 |
| 2 名 | shadcn `Tabs` | 一覧性最大、タップ 1 回で切替、スマホ画面でも収まる |
| 3 名以上 | shadcn `DropdownMenu` | Tabs だと横幅圧迫、省スペース性確保 |

### 1.2 1 名のときの表示

```tsx
<div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
  <UserIcon className="h-4 w-4 text-[var(--ink-500)]" aria-hidden />
  <span className="text-sm font-medium text-[var(--ink-900)]">
    {learner.name}（{learner.grade}）
  </span>
</div>
```

### 1.3 2 名のときの Tabs

```tsx
<Tabs value={currentLearnerId} onValueChange={handleSwitch}>
  <TabsList role="tablist" aria-label="学習者を切り替え"
    className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-muted)] p-1">
    {learners.map((l) => (
      <TabsTrigger
        key={l.id} value={l.id}
        className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-[var(--ink-700)] data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--brand-700)] data-[state=active]:shadow-[var(--shadow-sm)]">
        {l.name}
        <span className="ml-1.5 text-xs text-[var(--ink-500)]">{l.grade}</span>
      </TabsTrigger>
    ))}
  </TabsList>
</Tabs>
```

### 1.4 3 名以上のときの DropdownMenu

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button type="button"
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink-900)] hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]"
      aria-label={`学習者を切り替え（現在: ${currentLearner.name}）`}>
      <UserIcon className="h-4 w-4 text-[var(--ink-500)]" aria-hidden />
      {currentLearner.name}
      <span className="text-xs text-[var(--ink-500)]">{currentLearner.grade}</span>
      <ChevronDownIcon className="h-4 w-4 text-[var(--ink-500)]" aria-hidden />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end"
    className="min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
    <DropdownMenuLabel className="px-3 py-1.5 text-xs text-[var(--ink-500)]">
      学習者を選択
    </DropdownMenuLabel>
    {learners.map((l) => (
      <DropdownMenuItem key={l.id} onSelect={() => handleSwitch(l.id)}
        className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-[var(--ink-900)] data-[highlighted]:bg-[var(--brand-50)] data-[highlighted]:text-[var(--brand-700)]">
        {l.id === currentLearnerId && (
          <CheckIcon className="h-4 w-4 text-[var(--brand-600)]" aria-hidden />
        )}
        <span className={cn(l.id === currentLearnerId ? "font-semibold" : "")}>{l.name}</span>
        <span className="ml-auto text-xs text-[var(--ink-500)]">{l.grade}</span>
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

---

## § 2. 状態保持: URL クエリ `?learner=xxx`（推奨）

### 2.1 採用方針

| 候補 | 採用判定 | 理由 |
|---|---|---|
| URL クエリ `?learner=xxx` | **採用** | ブックマーク可能、SR 共有可能、Server Action / RSC との親和性高、戻るボタンで切替履歴復元 |
| Cookie | NG | URL 共有不可、戻るボタン挙動が直感に反する |
| LocalStorage | NG | RSC と同期しにくい、SR で読まれない |
| Server Action のみ | NG | URL に状態が出ないため戻る操作で混乱 |

### 2.2 切替動作

```tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

function useLearnerSwitch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (newLearnerId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("learner", newLearnerId);
    router.push(`${pathname}?${params.toString()}`);
    // aria-live region に切替アナウンスを書き込む（§3.2 参照）
    announceLearnerSwitch(newLearnerId);
  };
}
```

### 2.3 サーバ側読み出し

```tsx
// app/(parent)/layout.tsx
export default async function ParentLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams: { learner?: string };
}) {
  const learners = await getLearnersForParent();
  const currentLearnerId = searchParams.learner ?? learners[0]?.id;
  const currentLearner = learners.find((l) => l.id === currentLearnerId) ?? learners[0];
  // 三層認可: requireParent + requireFamilyMember + scopedQueries（DEC-023 W3 T-2 準拠）
  return (
    <>
      <ParentHeaderBar
        learners={learners}
        currentLearner={currentLearner}
      />
      <main>{children}</main>
    </>
  );
}
```

### 2.4 デフォルト学習者の決定

- 初回アクセス: `learners[0]`（最も古く登録された学習者を初期表示、Phase 2 で「最後に閲覧した学習者」記憶も検討）
- 削除済み学習者の learner クエリ: 404 を返さず、デフォルトに戻して toast「指定された学習者は見つかりませんでした」

---

## § 3. アクセシビリティ

### 3.1 role / aria 属性

| UI | role / aria |
|---|---|
| Tabs（2 名時） | shadcn 内部で `role="tablist"` + 各 Tab `role="tab"` + `aria-selected` 自動 |
| DropdownMenu（3 名以上） | shadcn 内部で `role="menu"` + 各 Item `role="menuitem"` 自動 |
| Trigger ボタン | `aria-label="学習者を切り替え（現在: {name}）"` |
| 1 名表示 | `<span>` 平文、role なし |

### 3.2 切替アナウンス（aria-live）

切替時にスクリーンリーダーへ読み上げる aria-live region を `<body>` 直下にマウント。

```tsx
"use client";
import { useEffect, useState } from "react";

export function LearnerSwitchAnnouncer() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const handler = (e: CustomEvent<string>) => setMessage(e.detail);
    window.addEventListener("learner-switch", handler as EventListener);
    return () => window.removeEventListener("learner-switch", handler as EventListener);
  }, []);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

export function announceLearnerSwitch(learnerName: string) {
  window.dispatchEvent(
    new CustomEvent("learner-switch", { detail: `学習者を ${learnerName} に切り替えました` })
  );
}
```

- `aria-live="polite"`: 現在の読み上げを中断せず、適切なタイミングで通知
- `aria-atomic="true"`: メッセージ全文を必ず読み上げ
- `sr-only`: 視覚的には非表示

### 3.3 キーボード操作

| UI | キー操作 |
|---|---|
| Tabs（2 名時） | Tab で TabsList にフォーカス → 矢印左右で Tab 切替 → 自動的に value 切替（shadcn `activationMode="automatic"` 標準）|
| DropdownMenu（3 名以上） | Trigger フォーカス → Enter / Space で開く → 矢印上下で項目移動 → Enter で選択 → Esc で閉じる |
| 切替後フォーカス | Trigger ボタンに自動で戻る（shadcn 標準）|

### 3.4 スクリーンリーダー想定動線

```
[Tab で TabsList に入る]
  → SR: 「タブリスト、学習者を切り替え」
[矢印右で次のタブへ]
  → SR: 「太郎（小5）、タブ、選択済」
[矢印右でもう一度]
  → SR: 「花子（小3）、タブ、選択されていません」
[Enter で確定（automatic mode のため自動）]
  → SR: 「学習者を 花子 に切り替えました」（aria-live）
```

---

## § 4. 複数子家族の典型ケース

### 4.1 想定ペルソナ

| ケース | 内容 | UX 配慮 |
|---|---|---|
| **A: 兄弟姉妹で級が違う** | 兄: 小5・3 級準備、妹: 小3・5 級準備 | 切替時にダッシュボード全体（受験日カウント / 模試結果 / 弱点）が必ず該当学習者のものに更新 |
| **B: 片方しか模試受けてない** | 兄: 模試 5 回受験、妹: 模試 0 回 | 妹切替時、模試結果画面で「まだ模試の記録がありません」プレースホルダ + 初回模試誘導 |
| **C: 学習進度が大きく違う** | 兄: 連続 30 日、妹: 連続 0 日（離脱中） | 妹切替時、ダッシュボードの InactivityReminder を必ず表示、ことだまトリ `parent-alert` 状態 |
| **D: 片方が合格済** | 兄: 5 級合格済（次は 4 級）、妹: 5 級準備中 | 切替時、級表示を自動で更新、合格バッジを過去模試一覧に維持 |
| **E: 学習者が 1 名のみ** | 単一学習者家族（最多ケース） | 切替 UI 非表示、ヘッダー領域を学習者名 + 受験日カウントに集中 |

### 4.2 切替時のローディング表示

- 切替 → URL クエリ更新 → RSC 再取得 → 画面再描画
- ローディング中: shadcn `Skeleton` を各セクションに配置（`bg-[var(--surface-muted)] animate-pulse motion-reduce:animate-none`）
- ローディング時間目安: 200ms 以内（ローカルキャッシュヒット時）/ 800ms 以内（DB 経由）
- 800ms 超過時: 透明 overlay + ローディングインジケータ表示

### 4.3 エラー時のフォールバック

- 該当学習者のデータ取得失敗 → トースト「データの取得に失敗しました」+ ヘッダーは維持、本文は「もう一度試す」ボタン
- 削除済み学習者の learner クエリ → デフォルトに戻して toast「指定された学習者は見つかりませんでした」（§2.4 参照）

---

## § 5. Tailwind 指定（ヘッダー部分の className）

### 5.1 ParentHeaderBar 全体（W3 から拡張、本ガイドで完成形）

```tsx
<header className="sticky top-0 z-40 h-16 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur dark:bg-[var(--surface)]/90">
  <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between gap-3 px-4 lg:px-8">

    {/* Left: Logo + 保護者画面バッジ */}
    <Link href="/parent/dashboard" className="flex items-center gap-2">
      <Image src="/logo.svg" alt="HANEI" width={88} height={32} priority />
      <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--ink-700)] sm:inline-block">
        保護者画面
      </span>
    </Link>

    {/* Center: 学習者切替 */}
    <div className="flex-1 max-w-md">
      {learners.length === 1 ? (
        <SingleLearnerLabel learner={currentLearner} />
      ) : learners.length === 2 ? (
        <LearnerTabs learners={learners} currentLearnerId={currentLearner.id} />
      ) : (
        <LearnerDropdown learners={learners} currentLearner={currentLearner} />
      )}
    </div>

    {/* Right: 受験日カウント + Bell + Cog */}
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1 text-sm font-medium text-[var(--brand-700)] md:inline-flex">
        <CalendarDaysIcon className="h-4 w-4" aria-hidden />
        受験まで {daysUntilExam} 日
      </span>
      <button type="button" aria-label="通知をひらく"
        className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]">
        <BellIcon className="h-5 w-5 text-[var(--ink-700)]" aria-hidden />
      </button>
      <Link href="/parent/settings" aria-label="設定"
        className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]">
        <Cog6ToothIcon className="h-5 w-5 text-[var(--ink-700)]" aria-hidden />
      </Link>
    </div>
  </div>

  {/* 切替アナウンサー（sr-only） */}
  <LearnerSwitchAnnouncer />
</header>
```

### 5.2 モバイルでの折り返し

- スマホ（〜639px）: 受験日カウントは非表示（`hidden md:inline-flex`）、保護者画面バッジも非表示（`hidden sm:inline-block`）
- 学習者切替（Tabs / DropdownMenu）はスマホでも常時表示。Tabs 時は文字を `text-xs` に縮小しつつ `min-h-[44px]` 維持

### 5.3 タッチターゲット（DEC-008 K-1 準拠）

- Tab / DropdownMenu 各項目: `min-h-[44px]` 維持
- ヘッダーアイコンボタン: `h-10 w-10`（W3 から踏襲、保護者は密度高めの 40px）
- Trigger ボタン: `min-h-[44px]`

---

## § 6. 受入基準（W4 学習者切替 UX ゲート）

- [ ] 学習者 1 名時: 切替 UI 非表示、学習者名と学年が平文で表示される
- [ ] 学習者 2 名時: shadcn Tabs で切替できる
- [ ] 学習者 3 名以上時: shadcn DropdownMenu で切替できる
- [ ] 切替時に URL クエリ `?learner=xxx` が更新される
- [ ] ブラウザの戻るボタンで切替履歴を復元できる
- [ ] 切替時にダッシュボード全体（受験日 / 模試結果 / 弱点）が該当学習者のデータに更新される
- [ ] aria-live region で「学習者を {name} に切り替えました」がスクリーンリーダーで読み上げられる
- [ ] キーボードのみで切替できる（Tab + 矢印 + Enter）
- [ ] 削除済み学習者 learner クエリ時、デフォルトに戻して toast 表示
- [ ] WCAG AA: コントラスト 4.5:1 以上を axe-core で自動検証
- [ ] reduced-motion: Tab / DropdownMenu のアニメーションが停止する

---

## 付録 A: 参照ファイルリンク

- W1 トークン: `projects/PRJ-016/reports/design-w1-tokens.md`
- W3 保護者ダッシュボード: `projects/PRJ-016/reports/design-w3-parent-dashboard.md` § 3.1
- W4 模試結果: `projects/PRJ-016/reports/design-w4-mock-exam-results.md` § 3.1
- W4 受験日設定: `projects/PRJ-016/reports/design-w4-exam-date-modal.md`
- W4 JSX snippets: `projects/PRJ-016/reports/design-w4-snippets.md`

---

以上、W4 学習者切替 UX ガイド完成。
