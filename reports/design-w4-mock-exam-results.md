# PRJ-016 HANEI W4 保護者向け模試結果画面ガイド

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W4 開発実装（保護者向け `/parent/mock-exam-results` 画面）
- **W1〜W3 連携**: design-w1-tokens.md / design-w1-character.md / design-w1-microcopy.md / design-w2-screens-v2.md / design-w2-style-snippets.md / design-w3-parent-dashboard.md / design-w3-parent-snippets.md
- **DEC 連携**: DEC-004（HANEI / Amber Gold / ことだまトリ）/ DEC-008（K-1 タップ領域）/ DEC-012（無料運用 = 課金 UI 不要）/ DEC-018（W2 mock_exam_results テーブル確定）/ DEC-023（W3 完遂・W4 移行）
- **方針**: Tailwind v4 + shadcn/ui + Heroicons 24/outline + framer-motion 構成、絵文字 0、課金 UI 0、敬語ベース。模試の「結果の見える化」と「次の一歩の温かい提示」を両立する。
- **ことだまトリ新状態**: `parent-encouraging`（合計 14 状態目）を本ガイドで新規追加

---

## § 1. トーン設計（保護者向け × 模試結果の温度設計）

### 1.1 W3 から継承するトーン

W3 で確定した「保護者向けトーン = 敬語 + フラット + 落ち着き」をそのまま継承する。表現の温度を W3 ダッシュボードと変えない。

| 軸 | W3 ダッシュボード | W4 模試結果（本ガイド） |
|---|---|---|
| 文体 | 敬語ベース、ですます調、丁寧語中心 | 同左、加えて模試結果は「事実 + 次の一歩」の二段構成で必ず締める |
| 色温度 | 中（Amber Gold は CTA / アクセント） | 同左、ただし合否ステータスのみ Mint（合格）/ Warning（再挑戦）の色を許容 |
| カード装飾 | 角丸 16-20px、フラット背景、線で区切る | 同左 |
| ことだまトリ出現 | `parent-greeting` / `parent-alert` / `parent-celebrate` | `parent-encouraging` を新規追加（合計 4 種を保護者画面で使用） |
| 数値表示 | 2xl-3xl、表組み多用 | レーダーチャートの中心スコアのみ 4xl の主役級。それ以外は表組み |
| アニメーション | カード fade-in 200ms のみ | 同左、レーダーチャートは初回ロード時に 600ms で円周描画（reduced-motion 時は静止） |
| ボタン | outline 主体、CTA のみ Amber Gold | 同左、「模試を実施する」は主役 CTA |

### 1.2 「合否の事実を温かく伝える」設計の核

**禁止表現**:
- 「不合格でした」「失敗しました」「あなたのお子様は合格基準に達しませんでした」
- 「ダメでした」「もう一度がんばってください」（プロセスを尊重しない）
- 「上位 {pct}% でした」だけで完結（順位のみで自尊心を傷つける）

**推奨表現の型**:

```
{事実: 何点だったか / 合格までのギャップ} + {次の一歩: どこを伸ばすと次は届くか} + {タイミング: いつ次の模試が来るか}
```

実例:
- NG: 「3 級 模試 不合格でした。」
- OK: 「{学習者名}さんは 5 月 12 日の 3 級模試で {n} 点獲得されました。合格基準まであと {gap} 点です。次は{弱点スキル}を中心に進めると、6 月の模試では届く見通しです。」

### 1.3 「冷たくしない」具体ルール（W3 から強化）

- 合格時は **必ず** ことだまトリ `parent-celebrate` を表示し、保護者から子どもへ褒めるトリガーをつくる
- 不合格時は **必ず** ことだまトリ `parent-encouraging`（W4 新規）を表示し、ギャップを温かく可視化する
- 弱点 TOP 3 の表示は「指摘」ではなく「次に伸ばす余地」として描く
- 「平均」「偏差値」を全面に出さない（β拡大前は統計母集団が小さく、誤解を招く）
- 「順位」「上位 %」を冒頭に置かない（順位ではなくプロセスを評価する設計）

---

## § 2. 画面構成（`/parent/mock-exam-results`）

### 2.1 全体ワイヤフレーム（モバイル基準・`md:` 以上 2 カラム）

```
Screen: parent/mock-exam-results
├─ ParentHeaderBar（W3 から再利用 + 本画面で学習者切替を主役化）
│  ├─ LeftCluster: HANEI ロゴ + 「保護者画面」バッジ
│  ├─ CenterCluster: 学習者切替（Tabs / DropdownMenu）
│  └─ RightCluster: 受験日カウントダウン Pill + Bell + Cog
│
├─ Section 1: 過去模試一覧（PastMockExamList）
│  └─ 直近 10 件のカード列（横スクロール / md: 以上 grid-cols-2）
│     ├─ 受験日（YYYY/MM/DD）
│     ├─ 級（5 級 / 4 級 / 3 級 / 準 2 級）
│     ├─ 総合スコア（n / max 形式）
│     └─ 合格 / もう一歩 バッジ
│
├─ Section 2: 最新模試レーダーチャート（LatestRadarChart）
│  └─ 4 技能（語彙 / 文法 / 読解 / リスニング）の SVG 自作レーダー
│
├─ Section 3: 弱点 TOP 3（WeakPointTop3）
│  └─ 過去 3 回平均で最低スコアの技能 3 つ
│     + 各技能ごとに改善提案テンプレ（敬語 + 学習プラン）
│
├─ Section 4: AI コーチからの一言（CoachMessage）
│  └─ ことだまトリ parent-encouraging 状態 + 学習プラン提案テンプレ
│
├─ Section 5: 次回受験日カウントダウン + 模試実施 CTA（NextExamCta）
│  ├─ 次回受験日（残り {n} 日）
│  ├─ 模試を実施する（主役 CTA）
│  └─ 補助テキスト「{学習者名}さんの準備状況を見て、推奨タイミングをお知らせします」
│
└─ Footer: 4 タブ（W3 と共通）
   ├─ HomeIcon「保護者ホーム」
   ├─ ChartBarIcon「学習レポート」（現在地）
   ├─ Cog6ToothIcon「設定」
   └─ ArrowRightOnRectangleIcon「学習者画面に戻る」
```

### 2.2 レスポンシブ仕様

| ブレークポイント | レイアウト |
|---|---|
| `<md` (sm) | 全セクション縦積み 1 カラム、過去模試一覧は横スクロール、レーダーチャートは 280×280px に縮小 |
| `md:` 768px〜 | 過去模試一覧 `grid-cols-2`、レーダー + 弱点 TOP 3 を 2 カラム並び（レーダー左 / 弱点右） |
| `lg:` 1024px〜 | `max-w-screen-xl mx-auto`、レーダーチャートは 360×360px、弱点とコーチメッセージを 2 カラム並び |

### 2.3 データソース（Dev 連携）

- `mock_exam_results` テーブル（DEC-018 で W2 確定済）から最新 10 件を取得
- 4 技能スコア: `vocab_score` / `grammar_score` / `reading_score` / `listening_score`（各 0-100 正規化済を想定、Dev と最終確認）
- 合格判定: 級 × 総合スコア閾値テーブルで判定（5 級 60%、4 級 60%、3 級 60%、準 2 級 60% を初期値）
- 弱点算出: 直近 3 件の平均で最低スコアの技能 3 つ

---

## § 3. 各セクション詳細仕様

### 3.1 ParentHeaderBar（W3 から再利用 + 拡張）

W3 ParentHeaderBar をそのまま使用。本画面では **学習者切替を主役化** する（W3 では補助 UI 扱いだったが、模試結果は学習者ごとに見比べる需要が高い）。

- 学習者 1 名: 切替 UI 非表示、学習者名を平文で表示
- 学習者 2 名: shadcn `Tabs` で横並び切替
- 学習者 3 名以上: shadcn `DropdownMenu` で省スペース切替

詳細は `design-w4-learner-switch.md` 側で記述。

### 3.2 Section 1: PastMockExamList（過去模試一覧）

- ラッパー: `<section aria-labelledby="past-exams-heading">`
- 見出し: 「過去の模試結果」`text-lg font-semibold text-[var(--ink-900)]`
- 表示件数: 直近 10 件（11 件以降は「もっと見る」リンク予定 = Phase 2）
- カード単位:
  - サイズ: `min-w-[200px]` / `md:min-w-0`、`p-4`、`rounded-xl border border-[var(--border)] bg-[var(--surface)]`
  - 上段: 受験日（`text-sm text-[var(--ink-500)] font-mono`）+ 級バッジ（`bg-[var(--brand-50)] text-[var(--brand-700)] rounded-full px-2.5 py-0.5 text-xs font-medium`）
  - 中段: 総合スコア `font-mono text-3xl font-bold text-[var(--ink-900)]` + 「/ 100」を `text-sm text-[var(--ink-500)]` で続ける
  - 下段: 合否バッジ
    - 合格時: `bg-[var(--mint-100)] text-[var(--mint-700)] rounded-full px-2.5 py-0.5 text-xs font-medium` + CheckCircleIcon
    - もう一歩時: `bg-[var(--brand-50)] text-[var(--warning-fg)] rounded-full px-2.5 py-0.5 text-xs font-medium` + 「もう一歩」（「不合格」とは表記しない）
- 並び順: 受験日降順（最新が左）
- スマホ横スクロール: `flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible`
- データなし時: 「まだ模試の記録がありません。下のボタンから初回模試を実施できます。」+ 矢印で Section 5 を指す

### 3.3 Section 2: LatestRadarChart（最新模試レーダーチャート）

#### 3.3.1 実装方針: SVG 自作（外部ライブラリ依存なし）

Recharts を使えば早いが、Recharts の RadarChart は依存追加 + バンドルサイズ増加 + reduced-motion 対応が煩雑になるため、**SVG 自作** を採用。Snippets 集 (`design-w4-snippets.md`) に完全な JSX を記載。

代替案（万一 SVG で詰まった場合）:
- **代替 A**: 4 技能を Progress バー 4 本の縦並びにして「レーダーは W5 で SVG 化」とリスケ
- **代替 B**: Recharts を採用（依存増を許容）

W4 では SVG 自作を第一優先、ストールしたら代替 A に即切替する判断ライン: **3 時間で動かなければ代替 A** を Dev に渡す。

#### 3.3.2 レーダーチャートのビジュアル仕様

- サイズ: モバイル `280×280px`、md+ `360×360px`、center 配置
- 4 軸: 12 時方向 = 語彙、3 時 = 文法、6 時 = 読解、9 時 = リスニング
- 軸ラベル: 各頂点の外側 16px 離して表示、`font-medium text-sm text-[var(--ink-700)]`
- スコア値: ラベル直下に `font-mono text-xs text-[var(--ink-500)]` で「{n}/100」
- 同心円: 4 段階（25 / 50 / 75 / 100）、線色 `var(--border)`、stroke-dasharray "3 3"
- データ多角形:
  - fill: `var(--brand-500)` / `fill-opacity: 0.2`
  - stroke: `var(--brand-600)` / `stroke-width: 2`
- 各頂点ドット: `r=4` `fill: var(--brand-600)` `stroke: var(--surface)` `stroke-width: 2`
- 中心: 総合スコアを `text-4xl font-bold font-mono text-[var(--ink-900)]` で表示

#### 3.3.3 アクセシビリティ

```tsx
<div role="img"
  aria-label={`最新模試のスキル別スコア。語彙${vocab}点、文法${grammar}点、読解${reading}点、リスニング${listening}点。総合${total}点。`}
  className="mx-auto h-[280px] w-[280px] md:h-[360px] md:w-[360px]">
  <svg viewBox="0 0 360 360" className="h-full w-full">{/* SVG 中身は Snippets 集参照 */}</svg>
</div>
```

- `role="img"` + `aria-label` で 4 技能スコアを必ず読み上げ
- 視覚障害ユーザー向けに、レーダーの直下に **スコア表組み** を `<table>` で併記し、`aria-hidden` をレーダー側に付ける選択肢も検討（W4 では併記版を採用、Dev に明示）

#### 3.3.4 reduced-motion 対応

- 初回ロード時に多角形が 0 から実スコアまで 600ms で展開するアニメーションを付与（CSS `@keyframes draw-radar`）
- `@media (prefers-reduced-motion: reduce)` で全フレーム静止 = 即時最終形を表示
- 実装は `motion-reduce:animate-none` クラス + `animate-[draw-radar_0.6s_ease-out]` を `<polygon>` に付ける

### 3.4 Section 3: WeakPointTop3（弱点 TOP 3）

- ラッパー: `<section aria-labelledby="weak-points-heading">`
- 見出し: 「次に伸ばすと届きそうな 3 つ」`text-lg font-semibold text-[var(--ink-900)]`
  - **「弱点」という言葉を見出しに出さない**（保護者と子どもの目に入る言葉として）
  - 補助テキスト: 「直近 3 回の模試平均で、もう少し伸ばせそうな技能から順にお知らせします。」
- リスト: `<ul role="list">`、各項目 `<li role="listitem">`
- 各項目構造（3 件）:
  - 順位バッジ: `bg-[var(--brand-100)] text-[var(--brand-700)] rounded-full h-7 w-7 grid place-items-center font-mono text-sm font-bold`
  - 技能名: 「読解」`text-base font-semibold text-[var(--ink-900)]`
  - 直近 3 回平均: 「平均 {n}/100」`font-mono text-sm text-[var(--ink-500)]`
  - 改善提案テキスト: `text-sm text-[var(--ink-700)] mt-1` で 1〜2 文
- 各項目間: `divide-y divide-[var(--border)]`、`py-4`

#### 3.4.1 改善提案テンプレ（4 技能 × トーン統一）

| 技能 | 改善提案テンプレ |
|---|---|
| 語彙 | 「{学習者名}さんは語彙でもう少し伸びしろがあります。1 日 5 単語ずつ、継続学習をすると次回の模試で {n} 点上乗せが見込まれます。」 |
| 文法 | 「文法は積み上げ式のため、{学習者名}さんが間違えた問題から優先して再演習されることをおすすめします。」 |
| 読解 | 「読解は語彙の定着とあわせて伸びる傾向があります。{学習者名}さんの語彙学習が定着するにつれ、読解スコアも自然に伸びていく見通しです。」 |
| リスニング | 「リスニングは反復回数が成果に直結します。1 日 1 回、3 分の音読 + 聞き取り練習を {学習者名}さんと一緒に続けてみてください。」 |

### 3.5 Section 4: CoachMessage（AI コーチからの一言）

- ラッパー: `<section aria-labelledby="coach-msg-heading">`
- レイアウト: `<aside>` 風、`bg-gradient-to-br from-[var(--brand-50)] to-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6`
- 左にことだまトリ `parent-encouraging` 96×96px（合格時は `parent-celebrate` に切替）
- 見出し: 「ことだまトリより」`text-lg font-semibold text-[var(--ink-900)]`
- 本文: `text-base text-[var(--ink-700)]` で 3〜4 文の励ましメッセージ
- 末尾: 学習プラン提案テンプレ（後述 § 6.4）

#### 3.5.1 メッセージの分岐ロジック

```ts
function getCoachMessage(result: MockExamResult, weakSkill: string): string {
  if (result.passed) {
    return `${learnerName}さんは ${formatDate(result.examDate)} の模試で合格基準を上回られました。素晴らしい結果です、ぜひ褒めてあげてください。次は ${nextLevel} 級にも挑戦できそうです。`;
  }
  const gap = result.passingScore - result.totalScore;
  return `${learnerName}さんは ${formatDate(result.examDate)} の模試で ${result.totalScore} 点獲得されました。合格基準まであと ${gap} 点です。${weakSkill}を中心に学習を進めると、次回の模試では届く見通しです。`;
}
```

### 3.6 Section 5: NextExamCta（次回受験日カウントダウン + 模試実施 CTA）

- ラッパー: `<section aria-labelledby="next-exam-heading" class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">`
- 上段: 次回受験日カウントダウン
  - 見出し: 「次回受験予定日」`text-sm text-[var(--ink-500)]`
  - 日付: `font-mono text-2xl font-bold text-[var(--ink-900)]`
  - 残日数: `inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1 text-sm font-medium text-[var(--brand-700)]` + CalendarDaysIcon
- 下段: 模試実施 CTA
  - ボタン: 「模試を実施する」
    - `min-h-[56px] rounded-xl bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-[var(--ink-900)] hover:text-white font-semibold px-6`
    - PlayCircleIcon を左に配置
  - 補助テキスト: 「{学習者名}さんの学習進捗を見て、最適な実施タイミングをお知らせします。」`text-sm text-[var(--ink-500)] mt-2`
  - **重要**: 模試実施は cron 起動 / 保留状態（W4 では UI のみ、実バッチは Phase 2）。ボタン押下時は `Dialog` で「模試を実施するには 5〜10 分かかります。準備ができたら開始してください」を表示。

---

## § 4. Tailwind 指定（主要 className 完全記述）

### 4.1 画面ラッパー

```tsx
<main id="main" className="mx-auto max-w-screen-xl px-4 pb-24 pt-6 md:px-6 lg:px-8 lg:pt-8">
  <div className="space-y-6 md:space-y-8">
    {/* 各セクション */}
  </div>
</main>
```

### 4.2 PastMockExamList セクション

```tsx
<section aria-labelledby="past-exams-heading">
  <div className="mb-3 flex items-baseline justify-between">
    <h2 id="past-exams-heading" className="text-lg font-semibold text-[var(--ink-900)]">
      過去の模試結果
    </h2>
    <span className="text-sm text-[var(--ink-500)]">直近 {Math.min(exams.length, 10)} 件</span>
  </div>
  <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">
    {exams.map((exam) => (
      <article key={exam.id}
        className="min-w-[220px] shrink-0 snap-start rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:min-w-0">
        {/* 中身は Snippets 集 §1 */}
      </article>
    ))}
  </div>
</section>
```

### 4.3 LatestRadarChart セクション（ラッパー）

```tsx
<section aria-labelledby="latest-radar-heading"
  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
  <div className="mb-4 flex items-baseline justify-between">
    <h2 id="latest-radar-heading" className="text-lg font-semibold text-[var(--ink-900)]">
      最新模試のスキル別スコア
    </h2>
    <span className="font-mono text-sm text-[var(--ink-500)]">
      {formatDate(latestExam.examDate)}
    </span>
  </div>
  <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
    {/* レーダーチャート + スコア表組み: Snippets 集 §2 */}
  </div>
</section>
```

### 4.4 WeakPointTop3 セクション

```tsx
<section aria-labelledby="weak-points-heading"
  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
  <h2 id="weak-points-heading" className="text-lg font-semibold text-[var(--ink-900)]">
    次に伸ばすと届きそうな 3 つ
  </h2>
  <p className="mt-1 text-sm text-[var(--ink-500)]">
    直近 3 回の模試平均で、もう少し伸ばせそうな技能から順にお知らせします。
  </p>
  <ul role="list" className="mt-4 divide-y divide-[var(--border)]">
    {weakSkills.map((skill, idx) => (
      <li key={skill.code} role="listitem" className="py-4 first:pt-0 last:pb-0">
        {/* Snippets 集 §3 */}
      </li>
    ))}
  </ul>
</section>
```

### 4.5 CoachMessage セクション

```tsx
<section aria-labelledby="coach-msg-heading"
  className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand-50)] to-[var(--surface)] p-5 sm:p-6 dark:from-[var(--brand-900)]/15 dark:to-[var(--surface)]">
  <div className="flex items-start gap-4 sm:gap-6">
    <Image
      src={passed ? "/character/parent-celebrate.svg" : "/character/parent-encouraging.svg"}
      alt=""
      width={96} height={96}
      className="h-20 w-20 shrink-0 sm:h-24 sm:w-24"
    />
    <div className="flex-1">
      <h2 id="coach-msg-heading" className="text-lg font-semibold text-[var(--ink-900)]">
        ことだまトリより
      </h2>
      <p className="mt-2 text-base leading-relaxed text-[var(--ink-700)]">
        {coachMessage}
      </p>
      <div className="mt-4 rounded-lg bg-[var(--surface)]/70 p-3 text-sm text-[var(--ink-700)]">
        <p className="font-medium text-[var(--ink-900)]">学習プランの提案</p>
        <p className="mt-1">{learningPlan}</p>
      </div>
    </div>
  </div>
</section>
```

### 4.6 NextExamCta セクション

```tsx
<section aria-labelledby="next-exam-heading"
  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 id="next-exam-heading" className="text-sm text-[var(--ink-500)]">
        次回受験予定日
      </h2>
      <div className="mt-1 flex items-baseline gap-3">
        <p className="font-mono text-2xl font-bold text-[var(--ink-900)]">
          {formatDate(nextExamDate)}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-50)] px-3 py-1 text-sm font-medium text-[var(--brand-700)]">
          <CalendarDaysIcon className="h-4 w-4" aria-hidden />
          残り {daysUntilNext} 日
        </span>
      </div>
    </div>
    <Dialog>
      <DialogTrigger asChild>
        <button type="button"
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-[var(--brand-500)] px-6 font-semibold text-[var(--ink-900)] hover:bg-[var(--brand-600)] hover:text-white focus-visible:shadow-[var(--shadow-focus)]">
          <PlayCircleIcon className="h-5 w-5" aria-hidden />
          模試を実施する
        </button>
      </DialogTrigger>
      <DialogContent>{/* 模試実施前の準備案内 Dialog */}</DialogContent>
    </Dialog>
  </div>
  <p className="mt-3 text-sm text-[var(--ink-500)]">
    {learnerName}さんの学習進捗を見て、最適な実施タイミングをお知らせします。
  </p>
</section>
```

---

## § 5. アクセシビリティ

### 5.1 WCAG AA 全保証（W1 §1 マトリクス準拠）

| 文字 | 背景 | コントラスト比 | 合否 |
|---|---|---|---|
| `--ink-900` | `--surface` | 14.9:1 | AAA |
| `--ink-700` | `--surface` | 11.0:1 | AAA |
| `--ink-500` | `--surface` | 6.0:1 | AA |
| `--brand-700` | `--brand-50` | 4.5:1 | AA（境界） |
| `--mint-700` | `--mint-100` | 5.6:1 | AA |
| `--warning-fg` | `--surface` | 5.7:1 | AA |
| `--ink-900` | `--brand-500`（CTA） | 7.8:1 | AAA |
| 白 | `--brand-600`（CTA hover） | 4.7:1 | AA |

`--ink-300` は本ガイドで本文使用 0、補助記号のみ。

### 5.2 ARIA / セマンティクス

- レーダーチャートラッパー: `role="img"` + `aria-label="最新模試のスキル別スコア。語彙{n}点、文法{n}点、読解{n}点、リスニング{n}点。総合{n}点。"`
- レーダーチャート SVG 自体: `aria-hidden="true"`（ラッパーで読み上げ済みのため重複回避）
- 視覚障害向け代替: レーダーの右隣に `<table>` でスコアを併記
- 弱点 TOP 3: `<ul role="list">` + 各項目 `<li role="listitem">`（明示的に role を付与し、CSS で list-style を消した場合の SR 動作を担保）
- 過去模試一覧: `<article>` で各カードを意味付け、`aria-labelledby` で級バッジを参照
- 合否バッジ: `aria-label="3 級合格"` のように級 + 合否を組で読み上げ

### 5.3 スクリーンリーダー想定動線

```
H1 模試結果（sr-only or 視覚的に non-sr-only）
  H2 過去の模試結果
    article 1: 3 級 / 65 点 / 合格
    article 2: 4 級 / 72 点 / 合格
    ...
  H2 最新模試のスキル別スコア
    img: 「最新模試のスキル別スコア。語彙 65 点、文法 60 点、読解 55 点、リスニング 70 点。総合 62 点。」
    table: スコア表（読み上げ用）
  H2 次に伸ばすと届きそうな 3 つ
    list: 1 位 読解 / 2 位 文法 / 3 位 語彙
  H2 ことだまトリより
    p: コーチメッセージ全文
  H2 次回受験予定日
    button: 模試を実施する
```

### 5.4 キーボード操作

- Tab 移動: 過去模試一覧（カードは focusable にしない、リンクなし）→ レーダー（focusable にしない）→ 弱点 TOP 3（focusable にしない）→ コーチメッセージ（focusable にしない）→ NextExamCta の「模試を実施する」ボタン
- Enter / Space: 模試実施ボタン押下で Dialog 起動
- Esc: Dialog 閉じる（shadcn Dialog 標準）

### 5.5 prefers-reduced-motion

- レーダーチャートの初回展開アニメーション: `motion-reduce:animate-none`
- カード fade-in: `motion-reduce:transform-none motion-reduce:transition-none`
- 全体: `globals.css` の `@media (prefers-reduced-motion: reduce)` で transition / animation duration 0.01ms 強制

---

## § 6. ことだまトリ「parent-encouraging」状態（W4 新規 / 14 状態目）

### 6.1 命名規則と位置づけ

W3 で確定した命名規則 `parent-{intent}` を踏襲し、`parent-encouraging` を採用。模試結果が出た直後の保護者向け励まし状態に限定使用する。

| 既存状態 | 用途 |
|---|---|
| `parent-greeting` | 保護者画面の挨拶 / 通常時 |
| `parent-alert` | 学習停止リマインド / 7 日以上未学習 |
| `parent-celebrate` | 特別達成の祝福 / 30 日連続・XP 大台等 / 模試合格時 |
| **`parent-encouraging`（W4 新規）** | **模試の合格基準に届かなかった直後の励まし** |

### 6.2 キャラ表現仕様

- **首傾け角度**: 0°（まっすぐ正面）、わずかに前傾 5°（共感の姿勢）
- **翼の位置**: 翼を軽く広げる（30 度ほど）。`parent-celebrate` の「両翼を肩より少し上で止める」よりも控えめで、静かな確信を表現する
- **表情**: 穏やかな確信。目はやさしく開いたまま、口元はしっかり閉じる。NOT 悲しい、NOT 同情的、NOT がっかり
- **持ち物**: なし。両翼で「次に向かうこと」を示すジェスチャー
- **配色**: 体メイン Amber Gold `#F2A93A`（不変）、背景にうっすら `var(--brand-50)` の温かい光のグラデ。NOT warning 色

### 6.3 生成プロンプト（gpt-image-2 / Midjourney 共通）

```
[共通プレフィックス], standing with body slightly leaning forward 5 degrees, both wings softly spread at about 30 degrees from body (NOT fully spread, NOT folded), eyes warm and open with calm conviction, mouth gently closed in composed reassurance (NOT sad, NOT pity, NOT disappointed), expression of "you are closer than you think, let's keep going together", soft warm amber light gradient subtly behind, parent-facing encouraging tone for the moment right after a mock exam result that did not reach passing score, dignified and warm NOT consoling, picture book illustration style with quiet confidence
[共通サフィックス]
```

### 6.4 セリフ（学習プラン提案テンプレ含む）

| 状況 | テンプレ |
|---|---|
| 合格基準まで 5 点以内 | 「{学習者名}さんは合格基準まであと {gap} 点でした。本当に近いところまで到達されています。{weakSkill}をあと 1 週間集中すると、次回の模試では届く見通しです。」 |
| 合格基準まで 6-15 点 | 「{学習者名}さんは {totalScore} 点獲得されました。合格までもう少し距離がありますが、{weakSkill}と{secondWeakSkill}を 2 週間ずつ進めることで、次回模試での合格が見込まれます。」 |
| 合格基準まで 16 点以上 | 「{学習者名}さんは {totalScore} 点獲得されました。合格基準には届きませんでしたが、{strongSkill}は十分な水準に達していらっしゃいます。次の 4 週間で {weakSkill} を中心に進めていきましょう。」 |

### 6.5 配置場所

- Section 4: CoachMessage の左側、96×96px（合格時は `parent-celebrate` に差し替え）
- Phase 2 拡張案: 学習者画面側の保護者リマインドメール画像にも転用可能

### 6.6 SVG ファイル配置（Dev 連携）

- `projects/PRJ-016/app/public/character/parent-encouraging.svg`
- TypeScript 型 `KotodamaState` に `"parent-encouraging"` を追加（W3 で 13 状態定義 → W4 で 14 状態に拡張）
  ```ts
  export type KotodamaState =
    | "idle" | "cheer" | "support" | "gentle-correct" | "thinking"
    | "level-up" | "streak-fire" | "serious-countdown"
    | "morning-wave" | "night-rest" | "sleeping"
    | "parent-greeting" | "parent-alert" | "parent-celebrate"
    | "parent-encouraging"; // W4 新規
  ```

> なお D-2 受験日設定モーダルガイドで `parent-planning`（15 状態目）を追加予定。本ガイドと並行更新。

---

## § 7. マイクロコピー +12 例（保護者向け模試結果）

W3 までで 20 例完成済の保護者向けマイクロコピーに、本画面用 12 例を追加。すべてですます調 + 敬語、絵文字 0、断定的な評価語を回避。

### 7.1 合格時（3 例）

1. {学習者名}さんは {date} の {level} 級模試で合格基準を上回られました。素晴らしい結果です、ぜひ褒めてあげてください。
2. {date} 実施の {level} 級模試で、{学習者名}さんが {totalScore} 点を獲得されました。合格おめでとうございます。
3. {学習者名}さんが {level} 級模試に合格されました。次は {nextLevel} 級にも挑戦できそうです。

### 7.2 不合格時（3 例）※「不合格」「失敗」表現を回避

1. {学習者名}さんは {date} の模試で {totalScore} 点獲得されました。合格基準まであと {gap} 点です。次は {weakSkill} を中心に進めましょう。
2. あと {gap} 点で合格基準でした。{weakSkill} を 2 週間集中すると、次回の模試で届く見通しです。
3. {学習者名}さんは {strongSkill} で十分な水準に達していらっしゃいます。{weakSkill} を伸ばすことで、次回の模試で合格が見込まれます。

### 7.3 弱点提示（3 例）※「弱点」表現を回避

1. {学習者名}さんが次に伸ばすと届きそうな技能は、{weakSkill1} / {weakSkill2} / {weakSkill3} の 3 つです。
2. 直近 3 回の模試平均で、{weakSkill} がもう一歩のところに来ています。1 日 5 分の継続で次回までに伸びる見通しです。
3. {weakSkill} は積み上げ式の技能のため、お子様が間違えた問題から優先して再演習されることをおすすめします。

### 7.4 次回受験提示（3 例）

1. 次回受験予定日は {nextExamDate}、残り {daysUntilNext} 日です。
2. {学習者名}さんの学習進捗を見て、最適な模試実施タイミングをお知らせします。
3. 模試の実施には 5〜10 分かかります。{学習者名}さんの集中できる時間にあわせてご案内ください。

---

## § 8. モバイル対応（縦長スマホでのレーダーチャート縮小）

### 8.1 モバイル縦長レイアウト（〜767px）

- 全セクション縦積み 1 カラム、`px-4 py-6 space-y-6`
- 過去模試一覧: 横スクロール（`overflow-x-auto snap-x snap-mandatory`）、各カード `min-w-[220px]`
- レーダーチャート: `280×280px` に縮小、中央寄せ、軸ラベルは `text-xs`（モバイルのみ縮小）
- レーダーチャート右隣の `<table>` 併記版: モバイルでは下に積む（`md:` 以上で右並び）
- 弱点 TOP 3: 縦に 3 件、各項目 `py-4`
- CoachMessage: ことだまトリ + 文字を縦に積む選択肢あり（`flex-col sm:flex-row`、sm 以下では縦積み）
- NextExamCta: 日付ブロック + ボタンを縦に積む（`flex-col md:flex-row`）

### 8.2 タブレット（768px〜1023px / `md:`）

- 過去模試一覧 `md:grid-cols-2`
- レーダーチャート `md:h-[360px] md:w-[360px]`、表組み併記が右隣に並ぶ
- 弱点 TOP 3 と CoachMessage を 2 カラム並びにする選択肢あり（W4 では縦積み維持、Phase 2 で検討）

### 8.3 デスクトップ（1024px〜 / `lg:`）

- `max-w-screen-xl mx-auto px-8` 中央寄せ
- 過去模試一覧 `lg:grid-cols-3`
- レーダーチャート + 弱点 TOP 3 を 2 カラム並び（レーダー左 / 弱点右）
- セクション間余白 `lg:space-y-8`

### 8.4 タッチターゲット（DEC-008 K-1 準拠）

- 模試実施 CTA: `min-h-[56px]`（主役 CTA）
- 学習者切替 Tabs: 各タブ `min-h-[48px]`
- 過去模試カード: 現状クリック不可（W4 では詳細遷移なし、Phase 2 で詳細画面追加検討）

---

## § 9. W5 への申し送り

W4 で完成しなかった / W5 で深掘り必須の 3 件:

### 9.1 模試実施フロー本体（cron 起動 / バッチ）

- 課題: W4 では「模試を実施する」ボタンと Dialog のみ実装、実際の模試問題出題 + 採点フローは Phase 2
- W5 タスク（候補）:
  - 模試問題セット選定ロジック（級 × 4 技能 × 難易度ミックス）
  - 模試実施画面（学習者画面側、`/study/mock/[examId]`）の UI 設計
  - 採点バッチ（Inline Cron で実装、結果を `mock_exam_results` に書き込み）
  - 採点完了通知（保護者にメール、Resend 経由）
- トーン: 学習者画面のポップさと保護者画面の落ち着きを場面ごとに切替

### 9.2 同年齢層との比較表示

- 課題: W4 では「上位 {pct}%」表現を意図的に避けたが、β拡大後に統計母集団が育てば追加可能
- W5 / Phase 2 タスク:
  - 同年齢 × 同級の母集団を月次集計するバッチ
  - 「平均」「上位」を出さず、「{学習者名}さんと近いペースの方が {n} 名いらっしゃいます」のような共感型表現で実装
  - Designer マイクロコピーガイドに「比較表現の倫理ルール」を追記

### 9.3 弱点 TOP 3 の改善提案テンプレを動的化

- 課題: W4 では 4 技能 × 静的テンプレ 1 種ずつ、合計 4 パターンのみ
- W5 タスク:
  - AI コーチ（gpt-5-mini）に「直近 3 回の弱点傾向 + 学習履歴」を渡し、個別最適な改善提案文を生成
  - 文字数制限 80 字、トーンは敬語、生成失敗時は静的テンプレにフォールバック
  - 既存の AI コーチ ¥10/日コストガード内で運用

### 9.4 W5 完了基準（参考）

- [ ] 模試実施フローの UI 設計（学習者画面側）+ 採点バッチ実装方針
- [ ] 同年齢層比較の倫理ガイドライン文書化
- [ ] 弱点改善提案の AI 生成 + フォールバック実装
- [ ] 保護者画面 全体の WCAG AA 自動チェック（axe-core）+ SR 手動テスト
- [ ] レーダーチャートの SVG 自作版が axe-core / NVDA / VoiceOver で全 readable

---

## § 10. 受入基準（W4 模試結果ゲート）

- [ ] /parent/mock-exam-results が実装され、Section 1〜5 + Footer の全要素が表示される
- [ ] 過去模試一覧が直近 10 件まで表示される（モバイル横スクロール / md+ グリッド）
- [ ] レーダーチャート（4 技能）が SVG 自作で実装され、`role="img"` + `aria-label` で全スコア読み上げ可能
- [ ] レーダーチャート右隣にスコア表組み（`<table>`）が併記される
- [ ] 弱点 TOP 3 が直近 3 回平均で算出され、`<ul role="list">` で実装
- [ ] 改善提案テンプレ 4 種（4 技能分）が静的に表示される
- [ ] CoachMessage が合格 / 不合格分岐で `parent-celebrate` / `parent-encouraging` を切り替え
- [ ] ことだまトリ `parent-encouraging` の SVG がアセット投入される
- [ ] `KotodamaState` 型に `"parent-encouraging"` が追加される
- [ ] 模試実施 CTA を押すと Dialog が開く（中身は W5、W4 では準備案内のみ）
- [ ] 学習者切替 UI が動作（詳細は `design-w4-learner-switch.md`）
- [ ] WCAG AA: 全本文コントラスト比 4.5:1 以上を axe-core で自動検証
- [ ] reduced-motion: レーダーチャート展開アニメーションが `prefers-reduced-motion: reduce` で停止する
- [ ] モバイル縦長表示でレーダーチャートが 280×280px に縮小される
- [ ] 課金 UI が 0 件であることを確認（DEC-012 準拠）
- [ ] 絵文字が 0 件であることを Grep `[\u{1F300}-\u{1FAFF}]` で確認

---

## 付録 A: 参照ファイルリンク

- W1 トークン: `projects/PRJ-016/reports/design-w1-tokens.md`
- W1 キャラ: `projects/PRJ-016/reports/design-w1-character.md`
- W1 マイクロコピー: `projects/PRJ-016/reports/design-w1-microcopy.md`
- W3 保護者ダッシュボード: `projects/PRJ-016/reports/design-w3-parent-dashboard.md`
- W3 JSX snippets: `projects/PRJ-016/reports/design-w3-parent-snippets.md`
- W4 受験日設定モーダル: `projects/PRJ-016/reports/design-w4-exam-date-modal.md`
- W4 学習者切替: `projects/PRJ-016/reports/design-w4-learner-switch.md`
- W4 JSX snippets: `projects/PRJ-016/reports/design-w4-snippets.md`
- 意思決定: `projects/PRJ-016/decisions.md` DEC-004 / DEC-008 / DEC-012 / DEC-018 / DEC-023

---

以上、W4 保護者向け模試結果画面ガイド完成。
