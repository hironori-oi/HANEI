# PRJ-016 HANEI W3 保護者ダッシュボード画面ガイド

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W3 開発実装（保護者向け `/parent/dashboard` 画面）
- **W1/W2 連携**: design-w1-tokens.md / design-w1-character.md / design-w1-microcopy.md / design-w2-screens-v2.md / design-w2-style-snippets.md
- **DEC 連携**: DEC-004（HANEI / Amber Gold / ことだまトリ）/ DEC-008（K-1 タップ領域）/ DEC-012（無料運用 = 課金 UI 不要）/ DEC-018（W2 完遂）
- **方針**: Tailwind v4 + shadcn/ui + Heroicons 24/outline + framer-motion 構成、絵文字 0、課金 UI 0、敬語ベース。学習者画面（ポップ × 自己肯定）と意図的にトーン差を作るが、Amber Gold の温かみは維持し、保護者を冷たく突き放さない。
- **スタイル詳細**: 主要 className は本ガイドに完全記述。長くなりすぎる箇所は「主要 className のみ」+「フル版は実装時にコンポーネント化」と注記し、`design-w3-parent-snippets.md` 側に JSX スニペットを切り出し。

---

## § 1. トーン設計（学習者画面との明確な差別化）

### 1.1 トーンマトリクス

| 軸 | 学習者画面（home / study / diagnosis） | 保護者画面（parent/dashboard） |
|---|---|---|
| 文体 | やさしい日本語、ですます調、ふりがな付き | 敬語ベース、丁寧語中心、ふりがな最小（漢字は学年制限なし） |
| 色温度 | 高（Amber Gold グラデを多用、Mint アクセントで明るく） | 中（Amber Gold は CTA / アクセントのみ、ベースは neutral-50 / 100） |
| カード装飾 | 角丸 24-32px、グラデ背景、紙質感 | 角丸 16-20px、フラット背景、線で区切る情報密度 |
| マスコット出現 | 全画面に登場、感情豊か | ヘッダー横と特定状態（greeting / alert / celebrate）のみ |
| アイコン使用 | Heroicons + キャラクター表情 | Heroicons のみ、装飾を削ぎ落とす |
| 数値表示 | 4xl-5xl のお祝いサイズ | 2xl-3xl の落ち着いたサイズ、表組み多用 |
| アニメーション | 正解 pop / 誤答 shake / streak stamp | カード fade-in 200ms のみ、グラフは prefers-reduced-motion 配慮 |
| ボタン | `bg-[var(--brand-500)]` 主張強め | `border` + `bg-white` の outline 主体、CTA のみ Amber Gold |
| 文末表現 | 「〜ましょう」「〜できますよ」 | 「〜していらっしゃいます」「〜ご確認ください」 |

### 1.2 一貫性として維持するもの

- **トークン**: `--brand-*` `--mint-*` `--ink-*` `--surface-*` 全て W1 トークンをそのまま使用
- **アクセント**: ストリーク / 受験日カウントダウン / CTA は Amber Gold `#F2A93A` を継承
- **フォント**: Geist Sans + Geist Mono（数値）、`font-heading` は Hero 部のみ
- **マスコット**: ことだまトリは「保護者モード 3 状態」を新規追加（後述 §5）して使用、無くしはしない
- **WCAG AA**: コントラスト比 4.5:1 以上を全本文で保証（W1 §1 コントラストマトリクス準拠）

### 1.3 「冷たくしない」ためのデザインルール

- 数値カードに必ず Amber Gold か Mint のアイコン色を入れる（モノクロにしない）
- セクション間の区切りは `border-[var(--border)]` のみで、罫線の太さは `border` (1px) を維持し詰めすぎない
- 「お疲れさまです」「素晴らしいですね」など、敬語でも温度のある言い回しを必ず混ぜる
- 警告系アラート（学習停止リマインド）でも `--danger` ではなく `--warning`（橙）を使用
- 失敗・遅れを「指摘」ではなく「お知らせ + 次の一歩の提案」として描く

---

## § 2. 画面構成（`/parent/dashboard`）

### 2.1 全体ワイヤフレーム（モバイル基準・`md:` 以上 2 カラム / `lg:` 以上 3 カラム）

```
Screen: parent/dashboard
├─ ParentHeaderBar
│  ├─ LeftCluster: HANEI ロゴ + 「保護者画面」バッジ（敬語切替の視覚記号）
│  ├─ CenterCluster: 学習者切替 Select（複数子家族対応）
│  └─ RightCluster: 今日の日付 + 受験日カウントダウン Pill + Bell + Cog
│
├─ Section 0: GreetingBanner（保護者向け固定挨拶 + ことだまトリ parent-greeting）
│
├─ Section 1: WeeklySummary（カード 4 枚）
│  ├─ Card1: streak（連続学習日数）
│  ├─ Card2: 今週の解答数（answers_this_week）
│  ├─ Card3: 正答率（accuracy_this_week）
│  └─ Card4: XP 増加（xp_gain_this_week）
│
├─ Section 2: ProgressChart
│  ├─ Tabs: 7日 / 30日 / 90日
│  └─ Recharts LineChart（解答数 + 正答率の二重軸折れ線）
│
├─ Section 3: RecentMistakes
│  └─ List 最大 5 件: 問題タイトル / 学習者の選んだ誤答 / 正解 / AI コーチの一言
│
├─ Section 4: InactivityReminder（条件付き表示）
│  └─ days_since_last_activity >= 7 のときのみ表示
│
├─ Section 5: CoachingSettings
│  ├─ 1日の学習時間目安 Slider
│  ├─ リマインド ON/OFF Switch
│  └─ 受験予定日編集 Dialog
│
└─ Footer: 4 タブ
   ├─ HomeIcon「保護者ホーム」
   ├─ ChartBarIcon「学習レポート」
   ├─ Cog6ToothIcon「設定」
   └─ ArrowRightOnRectangleIcon「学習者画面に戻る」
```

### 2.2 レスポンシブ仕様

| ブレークポイント | レイアウト |
|---|---|
| `<md` (sm) | 全セクション縦積み 1 カラム、カード 4 枚は `grid-cols-2`、グラフは横スクロールにせず期間切替タブで対応 |
| `md:` 768px〜 | カード 4 枚を `grid-cols-4`、Recent Mistakes と CoachingSettings を 2 カラム並び |
| `lg:` 1024px〜 | サイドバーレールを設置可能（Phase 2 課題、W3 では未実装、main 領域 max-w-screen-xl 中央配置） |

### 2.3 Section ごとの詳細

#### Section 0: GreetingBanner

- 表示内容: 「○○さん、お疲れさまです。{学習者名}さんは今週、毎日学習されています。」
- ことだまトリ `parent-greeting` 状態（W1 character 拡張、§5 参照）を左に 96×96px で配置
- 背景: `bg-gradient-to-br from-[var(--brand-50)] to-[var(--surface)]`（学習者画面より控えめなグラデ）
- 文字色: `text-[var(--ink-900)]`、サイズ `text-base sm:text-lg`
- 角丸: `rounded-2xl`（学習者画面の `rounded-3xl` より控えめ）

#### Section 1: WeeklySummary 4 カード

| Card | 数値 | 補助テキスト | アイコン | 色 |
|---|---|---|---|---|
| streak | 「連続 {n} 日」 | 「先週比 +/- {m} 日」 | FireIcon | brand-500 |
| answers_this_week | 「{n} 問」 | 「先週比 +/- {m} 問」 | CheckCircleIcon | mint-600 |
| accuracy_this_week | 「{n}%」 | 「先週比 +/- {m} pt」 | ChartBarIcon | sky-600 |
| xp_gain_this_week | 「+{n} XP」 | 「Lv {current} → Lv {next} まで {p}%」 | SparklesIcon | brand-700 |

- 各カードは `Card` (shadcn) を使用、`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5`
- 数値は `font-mono text-3xl font-bold`、補助は `text-sm text-[var(--ink-500)]`
- アイコンは `h-5 w-5` 左上に配置、色は表に従う
- ホバー: `hover:shadow-[var(--shadow-card)] transition-shadow`

#### Section 2: ProgressChart

- ラッパー: `Card` で `rounded-2xl border bg-[var(--surface)] p-5 lg:p-6`
- ヘッダー: 左に「学習推移」見出し、右に shadcn `Tabs`（7日 / 30日 / 90日）
- グラフ: Recharts `LineChart` で `Line` 2 本（左軸: 解答数 brand-500 / 右軸: 正答率% mint-600）
- グラフ高さ: `h-64 sm:h-72 lg:h-80`、幅は `ResponsiveContainer width="100%"`
- アクセシビリティ: ラッパー div に `role="img"` + `aria-label="直近{N}日の日次解答数と正答率の推移グラフ。{要約文}"`
- reduced-motion: `isAnimationActive={false}` を `prefers-reduced-motion: reduce` 検出時に渡す（後述 §4.3）
- データ無し時: 「学習データが集まり次第、グラフが表示されます。」のプレースホルダ + `parent-greeting` を縮小表示

#### Section 3: RecentMistakes

- ラッパー: `Card` で `rounded-2xl border bg-[var(--surface)] p-5`
- 見出し: 「直近の誤答 TOP 5」`text-lg font-semibold text-[var(--ink-900)]`
- 各行（最大 5 件）:
  - 問題タイトル: `text-base font-medium text-[var(--ink-900)]`
  - 学習者の誤答: 「選択: {answer}」`text-sm text-[var(--warning-fg)]` + `XCircleIcon h-4 w-4`
  - 正解: 「正解: {correct}」`text-sm text-[var(--success-fg)]` + `CheckCircleIcon h-4 w-4`
  - AI コーチ一言: `bg-[var(--brand-50)] rounded-lg p-3 text-sm text-[var(--ink-700)]` で枠付き
- 区切り: 各行の間に `border-b border-[var(--border)] last:border-0`
- データ無し時: 「直近の誤答はありません。問題なく学習が進んでいます。」

#### Section 4: InactivityReminder（条件付き）

- 表示条件: `days_since_last_activity >= 7`
- 配置: Section 2 と Section 3 の間（保護者の目に最も入る位置）
- 装飾: `border-l-4 border-[var(--warning)] bg-[var(--warning-bg)]/20 p-5 rounded-r-2xl`
- ことだまトリ `parent-alert` 状態を左に 80×80px
- 見出し: 「{学習者名}さんが {n} 日学習されていません。」`text-lg font-semibold text-[var(--warning-fg)]`
- 本文: 「お忙しい時期かもしれません。励ましのメールを送って、ことだまトリから一言お届けすることもできます。」`text-sm text-[var(--ink-700)]`
- CTA: 「励ましメールを送る」ボタン
  - `bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-[var(--ink-900)] hover:text-white min-h-[48px] rounded-xl px-5 font-semibold`
  - `aria-describedby="reminder-desc"` で `<span id="reminder-desc" class="sr-only">{学習者名}さんに励ましメールを送ります</span>`
- 送信処理: Resend API（DEC-012 無料運用枠内、Resend Free 100 通/日）
- 送信後: トースト「メールをお送りしました」+ ボタン disabled 24h

#### Section 5: CoachingSettings

- ラッパー: `Card` で `rounded-2xl border bg-[var(--surface)] p-5`
- 見出し: 「コーチング設定」`text-lg font-semibold`
- 設定項目 3 つを `divide-y divide-[var(--border)]` で区切る:
  1. **1日の学習時間目安**
     - shadcn `Slider` 15-90 分、5 分刻み、デフォルト 45 分
     - 表示: 「{n} 分 / 日」`font-mono text-2xl font-bold text-[var(--brand-700)]`
     - 補助: 「お子様の集中力に合わせてご調整ください。」
  2. **リマインド通知**
     - shadcn `Switch` ON/OFF
     - ラベル: 「学習が止まったときに、メールで通知する」
     - 補助: 「7日間学習がない場合に、保護者の方へお知らせをお送りします。」
  3. **受験予定日**
     - 現在値: `text-base text-[var(--ink-900)]` + CalendarDaysIcon
     - 編集ボタン: `outline` ボタン「日付を変更」→ shadcn `Dialog` で日付入力
     - 補助: 「変更すると、お子様のホーム画面のカウントダウンも更新されます。」

---

## § 3. Tailwind 指定（主要 className 完全記述）

### 3.1 ParentHeaderBar

```tsx
<header className="sticky top-0 z-40 h-16 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur dark:bg-[var(--surface)]/90">
  <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between px-4 lg:px-8">
    {/* LeftCluster */}
    <Link href="/parent/dashboard" className="flex items-center gap-2">
      <Image src="/logo.svg" alt="HANEI" width={88} height={32} priority />
      <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--ink-700)] sm:inline-block">
        保護者画面
      </span>
    </Link>

    {/* CenterCluster: 学習者切替 */}
    <Select>
      <SelectTrigger className="h-10 w-44 rounded-xl border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--ink-900)] focus-visible:shadow-[var(--shadow-focus)]">
        <SelectValue placeholder="学習者を選択" />
      </SelectTrigger>
      <SelectContent>
        {learners.map((l) => (
          <SelectItem key={l.id} value={l.id}>{l.name}（{l.grade}）</SelectItem>
        ))}
      </SelectContent>
    </Select>

    {/* RightCluster */}
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-[var(--ink-700)] md:inline">
        {todayJpFormatted}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1 text-sm font-medium text-[var(--brand-700)] dark:bg-[var(--brand-900)]/30 dark:text-[var(--brand-300)]">
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
</header>
```

### 3.2 GreetingBanner

```tsx
<section className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand-50)] to-[var(--surface)] p-5 sm:p-6 dark:from-[var(--brand-900)]/15 dark:to-[var(--surface)]">
  <div className="flex items-center gap-4 sm:gap-6">
    <Image src="/character/parent-greeting.svg" alt="" width={96} height={96}
      className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" />
    <div className="flex-1">
      <p className="text-base font-medium text-[var(--ink-900)] sm:text-lg">
        {parentName}さん、お疲れさまです。
      </p>
      <p className="mt-1 text-sm text-[var(--ink-700)] sm:text-base">
        {learnerName}さんは今週、{activeDaysThisWeek}日学習されています。
      </p>
    </div>
  </div>
</section>
```

### 3.3 WeeklySummary カード（4 枚共通テンプレ）

```tsx
<Card className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-[var(--shadow-card)]">
  <div className="flex items-start justify-between">
    <FireIcon className="h-5 w-5 text-[var(--brand-500)]" aria-hidden />
    <span className={cn(
      "text-xs font-medium",
      diff > 0 && "text-[var(--mint-700)]",
      diff < 0 && "text-[var(--warning-fg)]",
      diff === 0 && "text-[var(--ink-500)]"
    )}>
      {diff > 0 ? `先週比 +${diff}` : diff < 0 ? `先週比 ${diff}` : "先週比 ±0"}
    </span>
  </div>
  <p className="mt-3 text-sm text-[var(--ink-500)]">連続学習日数</p>
  <p className="mt-1 font-mono text-3xl font-bold text-[var(--ink-900)]">
    {streakDays}<span className="ml-1 text-base font-medium text-[var(--ink-700)]">日</span>
  </p>
</Card>
```

> 主要 className のみ。他 3 枚（answers / accuracy / xp）はアイコン色とラベルを差し替え、フル版は実装時に `<SummaryCard kind="streak|answers|accuracy|xp" />` でコンポーネント化。

### 3.4 ProgressChart

```tsx
<Card className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-5 lg:p-6">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold text-[var(--ink-900)]">学習推移</h2>
    <Tabs defaultValue="30" onValueChange={setRange}>
      <TabsList className="grid grid-cols-3 rounded-lg bg-[var(--surface-muted)] p-1">
        <TabsTrigger value="7" className="rounded-md text-sm data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--brand-700)]">7日</TabsTrigger>
        <TabsTrigger value="30" className="rounded-md text-sm data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--brand-700)]">30日</TabsTrigger>
        <TabsTrigger value="90" className="rounded-md text-sm data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--brand-700)]">90日</TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
  <div role="img" aria-label={chartAriaLabel}
    className="mt-4 h-64 w-full sm:h-72 lg:h-80">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" stroke="var(--ink-500)" fontSize={12} />
        <YAxis yAxisId="left" stroke="var(--brand-600)" fontSize={12} />
        <YAxis yAxisId="right" orientation="right" stroke="var(--mint-600)" fontSize={12} domain={[0, 100]} />
        <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
        <Line yAxisId="left" type="monotone" dataKey="answers" stroke="var(--brand-500)" strokeWidth={2}
          dot={{ r: 3 }} isAnimationActive={!prefersReducedMotion} name="解答数" />
        <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="var(--mint-600)" strokeWidth={2}
          dot={{ r: 3 }} isAnimationActive={!prefersReducedMotion} name="正答率(%)" />
      </LineChart>
    </ResponsiveContainer>
  </div>
</Card>
```

### 3.5 RecentMistakes

```tsx
<Card className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-5">
  <h2 className="text-lg font-semibold text-[var(--ink-900)]">直近の誤答 TOP 5</h2>
  <ul className="mt-4 divide-y divide-[var(--border)]">
    {mistakes.map((m) => (
      <li key={m.id} className="py-4 first:pt-0 last:pb-0">
        <p className="text-base font-medium text-[var(--ink-900)]">{m.problemTitle}</p>
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:gap-4">
          <span className="inline-flex items-center gap-1 text-sm text-[var(--warning-fg)]">
            <XCircleIcon className="h-4 w-4" aria-hidden />
            選択: {m.selectedAnswer}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-[var(--success-fg)]">
            <CheckCircleIcon className="h-4 w-4" aria-hidden />
            正解: {m.correctAnswer}
          </span>
        </div>
        <p className="mt-2 rounded-lg bg-[var(--brand-50)] p-3 text-sm text-[var(--ink-700)] dark:bg-[var(--brand-900)]/15">
          ことだまトリより: {m.coachComment}
        </p>
      </li>
    ))}
  </ul>
</Card>
```

### 3.6 InactivityReminder

```tsx
<section className="flex flex-col gap-4 rounded-r-2xl rounded-l-md border border-[var(--border)] border-l-4 border-l-[var(--warning)] bg-[var(--warning-bg)]/20 p-5 sm:flex-row sm:items-center dark:bg-[var(--warning)]/10">
  <Image src="/character/parent-alert.svg" alt="" width={80} height={80}
    className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
  <div className="flex-1">
    <h3 className="text-lg font-semibold text-[var(--warning-fg)]">
      {learnerName}さんが {daysSinceLast} 日学習されていません。
    </h3>
    <p className="mt-1 text-sm text-[var(--ink-700)]">
      お忙しい時期かもしれません。励ましのメールを送って、ことだまトリから一言お届けすることもできます。
    </p>
  </div>
  <button type="button" onClick={sendEncourageMail} disabled={sent}
    aria-describedby="reminder-desc"
    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[var(--brand-500)] px-5 font-semibold text-[var(--ink-900)] hover:bg-[var(--brand-600)] hover:text-white focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-500)]">
    <PaperAirplaneIcon className="h-5 w-5" aria-hidden />
    {sent ? "送信済み" : "励ましメールを送る"}
  </button>
  <span id="reminder-desc" className="sr-only">
    {learnerName}さんに励ましメールを送ります。Resend 経由で保護者アドレスから配信されます。
  </span>
</section>
```

### 3.7 CoachingSettings

```tsx
<Card className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-5">
  <h2 className="text-lg font-semibold text-[var(--ink-900)]">コーチング設定</h2>
  <div className="mt-4 divide-y divide-[var(--border)]">

    {/* 1日の学習時間目安 */}
    <div className="py-4 first:pt-0">
      <Label htmlFor="study-minutes" className="text-base font-medium text-[var(--ink-900)]">
        1日の学習時間目安
      </Label>
      <p className="mt-1 text-sm text-[var(--ink-500)]">
        お子様の集中力に合わせてご調整ください。
      </p>
      <div className="mt-3 flex items-center gap-4">
        <Slider id="study-minutes" min={15} max={90} step={5}
          value={[targetMinutes]} onValueChange={([v]) => setTargetMinutes(v)}
          className="flex-1" />
        <span className="font-mono text-2xl font-bold text-[var(--brand-700)] tabular-nums">
          {targetMinutes}<span className="ml-1 text-sm font-medium text-[var(--ink-700)]">分</span>
        </span>
      </div>
    </div>

    {/* リマインド通知 */}
    <div className="flex items-start justify-between py-4">
      <div className="flex-1 pr-4">
        <Label htmlFor="reminder-toggle" className="text-base font-medium text-[var(--ink-900)]">
          学習が止まったときに、メールで通知する
        </Label>
        <p className="mt-1 text-sm text-[var(--ink-500)]">
          7日間学習がない場合に、保護者の方へお知らせをお送りします。
        </p>
      </div>
      <Switch id="reminder-toggle" checked={remindOn} onCheckedChange={setRemindOn} />
    </div>

    {/* 受験予定日 */}
    <div className="py-4 last:pb-0">
      <p className="text-base font-medium text-[var(--ink-900)]">受験予定日</p>
      <p className="mt-1 text-sm text-[var(--ink-500)]">
        変更すると、お子様のホーム画面のカウントダウンも更新されます。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-base text-[var(--ink-900)]">
          <CalendarDaysIcon className="h-5 w-5 text-[var(--brand-600)]" aria-hidden />
          {examDateFormatted}
        </span>
        <Dialog>
          <DialogTrigger asChild>
            <button type="button"
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--ink-900)] hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]">
              日付を変更
              <ChevronRightIcon className="h-4 w-4" aria-hidden />
            </button>
          </DialogTrigger>
          <DialogContent>{/* 受験日入力モーダル：W4 で完成 */}</DialogContent>
        </Dialog>
      </div>
    </div>
  </div>
</Card>
```

### 3.8 Footer タブ（保護者用 4 タブ）

```tsx
<nav role="navigation" aria-label="保護者ナビゲーション"
  className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur md:hidden">
  <ul className="mx-auto grid max-w-screen-xl grid-cols-4">
    {tabs.map((t) => (
      <li key={t.href}>
        <Link href={t.href}
          aria-current={pathname === t.href ? "page" : undefined}
          className={cn(
            "flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs",
            pathname === t.href
              ? "text-[var(--brand-700)]"
              : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
          )}>
          <t.Icon className="h-5 w-5" aria-hidden />
          {t.label}
        </Link>
      </li>
    ))}
  </ul>
</nav>
```

> tabs 配列: `[HomeIcon: "保護者ホーム"], [ChartBarIcon: "学習レポート"], [Cog6ToothIcon: "設定"], [ArrowRightOnRectangleIcon: "学習者画面"]`

---

## § 4. アクセシビリティ

### 4.1 WCAG AA コントラスト全保証

W1 トークン §1 のマトリクス準拠。本ガイドで使用する組み合わせを再検証:

| 文字 | 背景 | コントラスト比 | 合否 |
|---|---|---|---|
| `--ink-900` `#1F1B16` | `--surface` `#FFFFFF` | 14.9:1 | AAA |
| `--ink-700` `#3A3530` | `--surface` | 11.0:1 | AAA |
| `--ink-500` `#5A5247` | `--surface` | 6.0:1 | AA |
| `--brand-700` `#B57010` | `--surface` | 4.7:1 | AA |
| `--brand-700` | `--brand-50` `#FEF6E7` | 4.5:1 | AA（境界） |
| `--mint-600` `#2F9F7E` | `--surface` | 5.2:1 | AA |
| `--mint-700` `#1F7A60` | `--surface` | 7.0:1 | AAA |
| `--sky-600` `#2F7BC9` | `--surface` | 4.8:1 | AA |
| `--warning-fg` `#B45309` | `--surface` | 5.7:1 | AA |
| `--success-fg` `#15803D` | `--surface` | 5.6:1 | AA |
| `--ink-900` | `--brand-500` `#F2A93A`（CTA） | 7.8:1 | AAA |
| 白 `#FFFFFF` | `--brand-600` `#D78A1A`（CTA hover） | 4.7:1 | AA |

**禁止組み合わせ**: `--ink-300` を本文に使用しない（`--surface` 上 3.0:1 で NG）。プレースホルダ・補助記号のみ。

### 4.2 ARIA / セマンティクス

- グラフ: ラッパー `<div role="img" aria-label="...">` 必須。aria-label は「直近{N}日の日次解答数と正答率の推移グラフ。{要約}」の形式。要約例: 「解答数は平均 {avg} 問/日、正答率は平均 {pct}%。直近 7 日は上昇傾向です。」
- 進捗カード: `aria-labelledby` でカード見出しを参照
- リマインドボタン: `aria-describedby="reminder-desc"` + `<span id="reminder-desc" class="sr-only">{学習者名}さんに励ましメールを送ります。Resend 経由で保護者アドレスから配信されます。</span>`
- スイッチ: shadcn `Switch` の `<Label htmlFor>` で関連付け、`role="switch"` は shadcn 内蔵
- 表組み（誤答リスト）: `<ul>` セマンティクス、各項目内で問題タイトルを `<p class="font-medium">` ではなく適切な見出しレベル `<h3>` に格上げするか検討（実装時 PM レビュー）
- フォーカスリング: 全インタラクティブ要素に `focus-visible:shadow-[var(--shadow-focus)]`（W1 トークン定義 `--shadow-focus: 0 0 0 3px var(--brand-300)`）
- スキップリンク: ヘッダー直下に `<a href="#main" class="sr-only focus:not-sr-only ...">本文へスキップ</a>`

### 4.3 prefers-reduced-motion

```tsx
import { useEffect, useState } from "react";

export function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return prefers;
}
```

- ProgressChart の Recharts: `<Line isAnimationActive={!prefersReducedMotion} />`
- カード fade-in: `motion-reduce:transform-none motion-reduce:transition-none`（Tailwind ユーティリティ）
- Tabs 切替: shadcn 標準は CSS のみ、`@media (prefers-reduced-motion: reduce)` で transition 0ms が global.css 側で適用済み（W1 §3.5）

### 4.4 キーボード操作

- ヘッダー Select: 矢印キーで学習者切替、Enter で確定（shadcn Select 標準）
- Tabs: 矢印キーで期間切替（shadcn Tabs 標準、`role="tablist"` 自動付与）
- Slider: 矢印キーで 5 分ステップ、Home/End で min/max
- Dialog: Tab トラップ、Esc で閉じる（shadcn Dialog 標準）
- Footer タブ: `<a>` のため Tab 移動可、`aria-current="page"` 自動的にフォーカス可視化

### 4.5 スクリーンリーダー検証想定

- VoiceOver (macOS / iOS Safari) / NVDA (Windows / Chrome) で W3 完了時に手動チェック
- 見出しレベル: `<h1>HANEI 保護者画面` (ヘッダー sr-only) → `<h2>` 各セクション → `<h3>` カード見出しの 3 レベル構造
- ランドマーク: `<header>` `<nav>` `<main>` `<section aria-labelledby>` を明示

---

## § 5. ことだまトリ 保護者モード 3 状態（W1 character ガイド拡張）

### 5.1 命名規則

W1 で確定した 10 状態（idle / cheer / support / gentle-correct / thinking / level-up / streak-fire / serious-countdown / morning-wave / night-rest / sleeping）に加え、保護者向け 3 状態を追加。命名は `parent-{intent}` の形式で W1 と区別。

### 5.2 3 状態の仕様

#### 5.2.1 `parent-greeting`（保護者画面の挨拶 / 通常時）

- **セリフ**: 「お疲れさまです。{学習者名}さんは今週、毎日学習されています。」（条件分岐: 毎日学習なら「毎日」、5-6日なら「ほぼ毎日」、3-4日なら「定期的に」、1-2日なら「マイペースに」）
- **キャラ表現**:
  - 首傾け角度: 0°（まっすぐ正面）
  - 翼の位置: 体の横、軽くたたんだ状態（W1 `idle` のポーズベース）
  - 表情: 目を開いた知的な穏やかさ。W1 `bonus-trustworthy` プロンプトの「standing in slightly more formal pose, wings folded politely」を踏襲
  - 持ち物: 小さな開いたノートを翼で軽く支える（保護者向け = 報告者役）
- **生成プロンプト**:
  ```
  [共通プレフィックス], standing in calm formal pose, wings folded politely on body, holding a small open notebook with one wing, eyes warm and intelligent looking forward, slight smile but composed, expression of "your child is doing well, here is the update", suitable for parent-facing dashboard greeting, slightly more sophisticated and reassuring tone than child-facing pose
  [共通サフィックス]
  ```
- **配色**: 体メイン Amber Gold `#F2A93A`、ノート Mint `#6FE7C9`、線色 `#5E3905`
- **配置場所**: GreetingBanner 左、Section 4 が非表示時はここがメイン出現

#### 5.2.2 `parent-alert`（学習停止リマインド / 7日以上未学習）

- **セリフ**: 「{学習者名}さんが {n} 日学習されていません。声をかけてみますか？」
- **キャラ表現**:
  - 首傾け角度: 15° 右に傾ける（心配・気にかける動作）
  - 翼の位置: 片翼を胸の前に当てる（W1 `gentle-correct` の「one wing softly placed on its own chest」を踏襲）
  - 表情: 目はやさしく開いたまま、眉を軽くハの字に。NOT 悲しい、NOT 焦る。「気にかけている」温度
  - 持ち物: なし（手紙か封筒を翼で軽く差し出す案を Phase 2 検討）
- **生成プロンプト**:
  ```
  [共通プレフィックス], head tilted gently 15 degrees to the right in concern, one wing softly placed on chest, eyes still warm and open with subtle worry (NOT sad, NOT panicked), eyebrows slightly raised in caring expression, body slightly leaning forward as if offering a gentle reminder, expression of "we noticed your child has been away, would you like to send a message?", caring NOT scolding, parent-facing concerned but composed tone
  [共通サフィックス]
  ```
- **配色**: 体メイン Amber Gold（不変）、背景は warning 橙のソフトバンドと共存。キャラ自体に warning 色は塗らない（ブランド毀損回避）
- **配置場所**: Section 4 InactivityReminder の左

#### 5.2.3 `parent-celebrate`（特別達成の祝福 / 30日連続・XP 大台等）

- **セリフ**: 「{学習者名}さんが 30 日連続達成です。素晴らしいですね、ぜひ褒めてあげてください。」
- **キャラ表現**:
  - 首傾け角度: 0°、わずかに上向き 5°
  - 翼の位置: 両翼を控えめに上げ、肩より少し上で止める（学習者画面の `level-up` の飛び上がりほど派手にしない）
  - 表情: 目が三日月の笑顔（W1 `cheer` 踏襲）、ただし口元はしっかり閉じた品のある喜び
  - 装飾: 周囲に小さな金色の星 2-3 個（紙吹雪 NG = 学習者画面と区別）、極小サイズで控えめ
- **生成プロンプト**:
  ```
  [共通プレフィックス], standing with both wings lifted modestly to shoulder height (NOT spread wide, NOT jumping), head slightly tilted upward 5 degrees, eyes curved into happy crescents but mouth gently closed (composed joy), 2-3 small gold stars subtly around (NO confetti, NO sparkle bursts), expression of "your child achieved a meaningful milestone, please celebrate with them", parent-facing dignified celebration NOT child-facing exuberant celebration
  [共通サフィックス]
  ```
- **配色**: 体メイン Amber Gold、星は `--brand-300` `#F7C16A`（控えめゴールド）
- **配置場所**: GreetingBanner（特別達成時のみ parent-greeting と差し替え）、Section 1 streak カードのアクセント

### 5.3 学習者向け既存 10 状態との出現分担

| 状態カテゴリ | 出現場所 | 状態名 |
|---|---|---|
| 学習者向け | /home, /study, /diagnosis | idle / cheer / support / gentle-correct / thinking / level-up / streak-fire / serious-countdown / morning-wave / night-rest / sleeping |
| 保護者向け（新規） | /parent/dashboard | parent-greeting / parent-alert / parent-celebrate |

合計 13 状態（W1 10 + W3 3）。 Phase 2 で 8 体育会系状態（Phase 2 検討メモ §6）+ サブキャラ 3 体起案。

### 5.4 実装ファイル配置（Dev 連携）

- SVG: `projects/PRJ-016/app/public/character/parent-greeting.svg` 等 3 ファイル新規
- TypeScript 型: `src/lib/character/state.ts` の `KotodamaState` union 型に 3 項目追加
  ```ts
  export type KotodamaState =
    | "idle" | "cheer" | "support" | "gentle-correct" | "thinking"
    | "level-up" | "streak-fire" | "serious-countdown"
    | "morning-wave" | "night-rest" | "sleeping"
    | "parent-greeting" | "parent-alert" | "parent-celebrate";
  ```

---

## § 6. マイクロコピー +20 例（保護者向け敬語トーン）

W1 microcopy 86 例文（学習者向け）に加え、保護者向け 20 例を追加。すべてですます調 + 敬語、子どもの努力プロセスを尊重する言い回し、絵文字 0、断定的な評価語（「ダメ」「失敗」）を回避。

### 6.1 エンカレッジ系（5 例）

> 学習者の頑張りを保護者に伝え、保護者から子どもへの声かけを促す

1. {学習者名}さんは今週、毎日学習されています。お忙しい中、続けていらっしゃるご様子です。
2. {学習者名}さんは、過去 30 日で着実に正答率を伸ばしていらっしゃいます。
3. 苦手だった{skill}が、今週から少しずつ正解できるようになっていらっしゃいます。
4. {学習者名}さんが取り組んだ問題数は、{period}前と比べて {pct}% 増えています。
5. 毎日の少しずつが積み重なって、{learner_name}さんなりのペースが定着してきています。

### 6.2 アラート系（5 例）

> 学習停止・遅れに気づいたとき。「叱責」ではなく「お知らせ + 次の一歩」

1. {学習者名}さんが {n} 日学習されていません。声をかけてみてはいかがでしょうか。
2. 受験まで {n} 日となりました。学習ペースが少しゆるやかになってきているようです。
3. 今週は{learner_name}さんの解答数が先週比 {pct}% 減少しています。お忙しい時期かもしれません。
4. 苦手な{skill}でつまずきが続いています。一緒に問題を見直す時間を取ると効果的です。
5. {n} 日連続の記録が一度区切りとなりました。また明日から、ゆっくり再開していただいて大丈夫です。

### 6.3 学習進捗系（5 例）

> 数値ベースの落ち着いた報告

1. 今週の正答率は {pct}% でした（先週比 +{diff} ポイント）。
2. {learner_name}さんは現在 Lv {level}、次のレベルまで {pct}% 進んでいらっしゃいます。
3. 直近 30 日で {n} 問解かれました。1 日平均 {avg} 問のペースです。
4. 連続学習日数が {n} 日になりました。
5. 受験予定日（{date}）まで残り {days} 日、現在のペースで合計約 {est} 問の学習が見込まれます。

### 6.4 リマインド系（5 例）

> リマインドメール本文・通知文・設定画面の補助テキスト

1. お子様の学習が一定期間止まったとき、保護者の方へお知らせをお送りすることができます。
2. 学習リマインドは、メールで配信されます。配信頻度は週 1 回までを上限としています。
3. 励ましメールには、ことだまトリから {学習者名}さんへの一言が添えられます。
4. リマインド通知は、保護者画面 > コーチング設定 からいつでもオン・オフを切り替えられます。
5. {学習者名}さんへ、お疲れさまの一言をお届けしました。返事はお子様のホーム画面に表示されます。

### 6.5 文末「ですます調」確認

全 20 例の文末を一覧で確認:
- 「〜います」「〜していらっしゃいます」「〜います」「〜います」「〜います」（6.1）
- 「〜いかがでしょうか」「〜なりました」「〜います」「〜効果的です」「〜大丈夫です」（6.2）
- 「〜でした」「〜います」「〜ペースです」「〜なりました」「〜見込まれます」（6.3）
- 「〜できます」「〜配信されます」「〜添えられます」「〜切り替えられます」「〜お届けしました」（6.4）

→ すべて「ですます調」確認済み。命令形・断定形・命令的な「〜してください」は 0。

---

## § 7. モバイル対応

### 7.1 スマホ縦長レイアウト（〜767px）

- 全セクション縦積み 1 カラム、`px-4 py-6 space-y-6`
- WeeklySummary 4 カードは `grid grid-cols-2 gap-3`（小カード 2×2 配置、視認性確保）
- ProgressChart は `h-64` 固定、横スクロール禁止、期間切替タブ（7日/30日/90日）で対応
- RecentMistakes リストは縦に 5 件、各行内で誤答/正解を `flex-col` 縦並び
- InactivityReminder はキャラ + 文字 + ボタンを縦に積む（`flex-col gap-3`）
- CoachingSettings の Slider は full width、Switch は右端配置
- Footer タブは `fixed inset-x-0 bottom-0` 固定、本体 `pb-20` で被り回避

### 7.2 タブレット（768px〜1023px / `md:`）

- WeeklySummary `md:grid-cols-4`
- ProgressChart `md:h-72`
- RecentMistakes と CoachingSettings を `md:grid-cols-2 md:gap-6` で並列
- ヘッダーの「保護者画面」バッジ表示開始
- Footer タブを上部ヘッダーに統合（モバイル fixed footer は `md:hidden`）

### 7.3 デスクトップ（1024px〜 / `lg:`）

- `max-w-screen-xl mx-auto px-8` 中央寄せ
- ProgressChart `lg:h-80 lg:p-6`
- セクション間の余白 `lg:space-y-8`
- ヘッダー `CenterCluster` 全幅展開（学習者切替 + 日付 + 受験カウント）

### 7.4 タッチターゲット（DEC-008 K-1 準拠）

- 主要 CTA: `min-h-[56px]`（リマインドメール送信、日付変更）
- 副次 CTA: `min-h-[48px]`（Tabs、Switch のラベル含むクリック領域）
- アイコンボタン: `h-10 w-10`（ヘッダー Bell / Cog のみ。学習者画面は `h-12 w-12`、保護者は密度高めで `h-10 w-10` 採用）
- 隣接要素間隔: 8px 以上（`gap-2` `space-y-2` 以上を維持）

---

## § 8. W4 への申し送り

W3 で完成しなかった / W4 で深掘り必須の 3 件:

### 8.1 模試結果画面（`/parent/mock-exam-results`）

- 課題: W2 で実装済みの `mock_exam_results` テーブル（DEC-018 参照）を保護者ダッシュボードから閲覧する画面が未着手
- W4 タスク:
  - 模試結果サマリーカード（受験日・スコア・偏差値風表現「上位 {pct}% 相当」）
  - スキル別レーダーチャート（語彙 / 文法 / リスニング / ライティング / リーディング / スピーキング 6 軸）
  - 同年齢層との比較（β拡大後に統計データ蓄積後実装、W4 ではプレースホルダ）
  - 弱点トップ 3 と AI コーチからの学習プラン提案
- トーン: 本ガイドの保護者敬語トーンを継承
- 連携: W3 ProgressChart の Recharts コンポーネントを再利用

### 8.2 受験日設定モーダル（`/parent/dashboard` 内 Dialog）

- 課題: W3 では Dialog のトリガーボタンと枠のみ実装、中身（DatePicker + バリデーション + 保存）は W4
- W4 タスク:
  - shadcn `Calendar` を使った日付ピッカー
  - バリデーション: 過去日付不可、当日含む 730 日以内
  - 保存後の影響範囲表示: 「学習者ホーム画面のカウントダウン、1 日の推奨学習時間が更新されます」
  - 確認ダイアログ: 「{date} に変更します。よろしいですか」
- トーン: 「変更」「設定」「更新」を敬語で統一

### 8.3 学習者切替 UX のテスト

- 課題: W3 ヘッダー Select で複数子家族対応するが、UX 検証未実施
- W4 タスク:
  - シナリオ: 子 1 (小5・英検 4 級準備中)、子 2 (小3・英検 5 級準備中) の 2 名を切り替えながらダッシュボードを閲覧
  - 検証項目:
    - 切替時のローディング表示・エラーハンドリング
    - URL に `?learner_id=xxx` を持たせるか、Cookie か、Server Action でセッション保持か（PM・Dev と協議）
    - キーボードのみで切替できるか（矢印キー + Enter）
    - SR 読み上げで「学習者を {name} に切り替えました」のライブリージョン announce
  - ユーザビリティテスト: 内部メンバー 3 名で切替動線をテスト、迷子率を計測

### 8.4 W4 完了基準（参考）

- [ ] /parent/mock-exam-results 画面実装（Dev）
- [ ] 受験日設定 Dialog 完成（Dev）
- [ ] 学習者切替 UX 検証レポート（Designer + PM）
- [ ] 保護者向けマイクロコピー +10 例（W3 の 20 例を補強）
- [ ] 保護者画面 全体の WCAG AA 自動チェック（axe-core）+ SR 手動テスト

---

## § 9. 受入基準（W3 保護者ダッシュボードゲート）

- [ ] /parent/dashboard が実装され、Section 0〜5 + Footer の全要素が表示される
- [ ] 学習者切替 Select が動作し、選択した学習者のデータがダッシュボード全体に反映される
- [ ] WeeklySummary 4 カードが正しい数値を表示し、先週比 diff が ± 表示される
- [ ] ProgressChart が Recharts で 7日/30日/90日切替できる
- [ ] InactivityReminder が `days_since_last_activity >= 7` のときのみ表示される
- [ ] 励ましメールボタン押下で Resend API が叩かれ、トースト表示される
- [ ] CoachingSettings の Slider / Switch / Dialog が動作する（Dialog 内部は W4 で完成、トリガーまでは W3）
- [ ] ことだまトリ 3 状態（parent-greeting / parent-alert / parent-celebrate）の SVG がアセット投入される
- [ ] WCAG AA: 全本文コントラスト比 4.5:1 以上を axe-core で自動検証
- [ ] reduced-motion: グラフのアニメーションが `prefers-reduced-motion: reduce` で停止する
- [ ] モバイル縦長表示で全要素が縦積みされ、タッチターゲット 48px 以上を維持
- [ ] 課金 UI が 0 件であることを確認（DEC-012 準拠）
- [ ] 絵文字が 0 件であることを Grep `[\u{1F300}-\u{1FAFF}]` で確認

---

## § 10. 次アクション

1. **W3 Day 1-2**: Dev が `/parent/dashboard/page.tsx` のスケルトンを作成、Section 0〜5 を `<SectionPlaceholder>` で配置
2. **W3 Day 2-3**: Designer が ことだまトリ 3 状態の SVG を gpt-image-2 で生成 → SVG 化、Dev に渡す
3. **W3 Day 3-5**: Dev が WeeklySummary / ProgressChart / RecentMistakes を順次実装、データは仮データで進行
4. **W3 Day 5-6**: Dev が InactivityReminder + Resend API 連携、CoachingSettings の Slider/Switch を実装
5. **W3 Day 6-7**: Designer + Dev で WCAG AA 検証、SR 手動チェック、コピーレビュー
6. **W4 Day 1-**: §8 申し送り 3 件に着手

---

## 付録 A: 参照ファイルリンク

- W1 トークン: `projects/PRJ-016/reports/design-w1-tokens.md`
- W1 キャラ: `projects/PRJ-016/reports/design-w1-character.md`
- W1 マイクロコピー: `projects/PRJ-016/reports/design-w1-microcopy.md`
- W2 学習者画面 v2: `projects/PRJ-016/reports/design-w2-screens-v2.md`
- W2 スタイル snippets: `projects/PRJ-016/reports/design-w2-style-snippets.md`
- W3 JSX snippets（本ガイド対）: `projects/PRJ-016/reports/design-w3-parent-snippets.md`
- 意思決定: `projects/PRJ-016/decisions.md` DEC-004 / DEC-008 / DEC-012 / DEC-018

---

以上、W3 保護者ダッシュボード画面ガイド完成。

