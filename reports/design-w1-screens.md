# PRJ-016 HANEI 主要画面デザイン仕様 v1（W1）

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W1〜W4 開発実装（Next.js 16 + Tailwind v4 + shadcn/ui + Framer Motion）
- **DEC 連携**: DEC-004 / DEC-008（K-1 タップ領域 56/48px）/ DEC-012（料金 UI 不要）
- **方針**: ASCII モックではなく **構造図 + Tailwind クラス指定** で Dev がコピペ実装可能なレベルで記述

---

## 共通レイアウト前提

| 項目 | 仕様 |
|---|---|
| Mobile breakpoint | デフォルト（< 640px） |
| Tablet | `sm:` (≥ 640px) / `md:` (≥ 768px) |
| Desktop | `lg:` (≥ 1024px) |
| 最大幅 | `max-w-screen-xl` (1280px) |
| 横余白 | `px-4 sm:px-6 lg:px-8` |
| Sticky Header | `sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur` |
| 主要 CTA | `min-h-[56px] min-w-[56px]` |
| 通常タップ要素 | `min-h-[48px] min-w-[48px]` |
| カード基調 | `rounded-3xl bg-[var(--surface)] shadow-[var(--shadow-card)] p-6` |
| ふりがな対応 | `<ruby>漢字<rt>かんじ</rt></ruby>` |
| フォーカスリング | `focus-visible:shadow-[var(--shadow-focus)]`（globals.css で全体適用済） |

### 共通ヘッダー（全画面共通、ログイン後）

```
Header: 64px / Sticky / Background: surface/95 + backdrop-blur
├─ Container: max-w-screen-xl mx-auto px-4 lg:px-8 / flex items-center justify-between / h-full
├─ LeftCluster: flex items-center gap-3
│  ├─ Logo: HANEI ロゴ (h-8) + ことだまトリ small (32×32)
│  └─ Nav (lg+): flex gap-6 / TextLink "ホーム" "学習" "進捗" "コーチ"
└─ RightCluster: flex items-center gap-2
   ├─ NotificationButton: BellIcon / 48×48 / aria-label="通知"
   └─ AvatarButton: 40×40 rounded-full / aria-label="アカウント"
```

```tsx
<header className="sticky top-0 z-40 h-16 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
  <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between px-4 lg:px-8">
    <div className="flex items-center gap-3">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/logo.svg" alt="HANEI" width={88} height={32} priority />
        <Image src="/character/idle.svg" alt="" width={32} height={32} />
      </Link>
      <nav className="hidden lg:flex items-center gap-6 ml-6">
        <NavLink href="/home">ホーム</NavLink>
        <NavLink href="/study">学習</NavLink>
        <NavLink href="/progress">進捗</NavLink>
        <NavLink href="/coach">コーチ</NavLink>
      </nav>
    </div>
    <div className="flex items-center gap-2">
      <button aria-label="通知" className="grid h-12 w-12 place-items-center rounded-full hover:bg-[var(--surface-muted)]">
        <BellIcon className="h-5 w-5 text-[var(--ink-700)]" />
      </button>
      <Avatar className="h-10 w-10" />
    </div>
  </div>
</header>
```

---

## 画面 1: 保護者サインアップ（`/signup/parent`）

### 構造

```
Screen: 保護者サインアップ
├─ Background: bg-[var(--bg)] min-h-screen
├─ Container: max-w-md mx-auto px-4 py-8 sm:py-12
│
├─ Header (簡易): mb-8
│  ├─ Logo: HANEI ロゴ (h-10) + ことだまトリ idle (48×48)
│  └─ Step Indicator: text-sm text-[var(--ink-500)] "保護者登録 1/2"
│
├─ Hero Card: bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-card)] p-6 sm:p-8 mb-6
│  ├─ Character: ことだまトリ "support" (96×96) mx-auto
│  ├─ H1: "保護者の方へ" / text-2xl font-heading font-bold text-[var(--ink-900)] text-center mt-4
│  └─ Description: "お子さまの学習を一緒に応援しましょう。" / text-base text-[var(--ink-700)] leading-relaxed text-center mt-2
│
├─ Form Card: bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-card)] p-6 space-y-5
│  ├─ Field: メールアドレス
│  │  ├─ Label: "メールアドレス" / text-sm font-medium text-[var(--ink-900)]
│  │  ├─ Input: type=email / h-12 rounded-xl border / placeholder="hanei@example.com"
│  │  └─ Hint: "ログインに使用します" / text-xs text-[var(--ink-500)]
│  ├─ Field: パスワード
│  │  ├─ Label + ToggleVisibility (EyeIcon)
│  │  ├─ Input: type=password / h-12 rounded-xl
│  │  └─ Hint: "8文字以上、英数字を含めてください"
│  ├─ Field: 表示名
│  │  ├─ Label: "おなまえ（表示名）" / 任意ニックネーム可
│  │  └─ Input: h-12 rounded-xl
│  ├─ Checkbox: 利用規約同意
│  │  └─ Label: "[利用規約](/terms) と [プライバシーポリシー](/privacy) に同意します"
│  └─ Submit: [はじめる]
│     ├─ button: w-full min-h-[56px] rounded-xl bg-[var(--brand-600)] text-white font-bold text-lg
│     └─ shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)]
│
└─ Footer: text-center mt-6
   ├─ "すでにアカウントをお持ちの方は [ログイン](/login)"
   └─ Privacy Note: "個人情報は最小限です。お子さまの本名は不要です。" + InformationCircleIcon
```

### 実装サンプル（Form 部分）

```tsx
<form className="space-y-5" onSubmit={handleSubmit}>
  <div>
    <label htmlFor="email" className="block text-sm font-medium text-[var(--ink-900)] mb-1.5">
      メールアドレス
    </label>
    <input
      id="email"
      type="email"
      required
      autoComplete="email"
      placeholder="hanei@example.com"
      aria-describedby="email-hint"
      className="w-full h-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--ink-900)] placeholder:text-[var(--ink-300)] focus:border-[var(--brand-500)] focus:outline-none"
    />
    <p id="email-hint" className="mt-1 text-xs text-[var(--ink-500)]">
      ログインに使用します
    </p>
  </div>

  {/* パスワード・表示名・チェックボックスは同パターン */}

  <button
    type="submit"
    className="w-full min-h-[56px] rounded-xl bg-[var(--brand-600)] text-white font-bold text-lg shadow-[var(--shadow-pop)] hover:bg-[var(--brand-700)] focus-visible:shadow-[var(--shadow-focus)] transition-colors"
  >
    はじめる
  </button>
</form>
```

### a11y チェック

- [ ] `<label htmlFor>` 全フィールドにあり
- [ ] `aria-describedby` でヒント連結
- [ ] エラー時は `aria-invalid="true"` + テキスト + WarningIcon
- [ ] Tab 順: メール → パスワード → 表示名 → チェックボックス → 送信
- [ ] フォーカスリングが Amber Gold で 3:1 以上のコントラスト

---

## 画面 2: 子プロフィール作成（`/onboarding/child`）

### 構造

```
Screen: 子プロフィール作成（オンボーディング）
├─ Background: bg-[var(--bg)] min-h-screen
├─ Container: max-w-lg mx-auto px-4 py-6 sm:py-10
│
├─ Progress Header
│  ├─ Step: "ステップ 2/3" / text-sm font-medium text-[var(--ink-500)]
│  └─ ProgressBar: h-2 w-full rounded-full bg-[var(--surface-muted)] / fill h-full bg-[var(--brand-500)] w-2/3 rounded-full
│
├─ Character Block: text-center mt-8 mb-6
│  ├─ ことだまトリ "support" (128×128) mx-auto
│  └─ Speech Bubble: rounded-2xl bg-[var(--brand-50)] px-4 py-3 inline-block max-w-xs
│      └─ "はじめまして。お子さまについて、少しだけ教えてくださいね。"
│
├─ Form Card: bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-card)] p-6 sm:p-8 space-y-6
│  ├─ Field: ニックネーム
│  │  ├─ Label: "おなまえ（ニックネームでOK）"
│  │  ├─ Input: h-12 rounded-xl / maxLength=10
│  │  └─ Hint: "本名でなくて大丈夫です（3〜10文字）"
│  ├─ Field: 学年
│  │  ├─ Label: "学年"
│  │  └─ Radio Group: grid grid-cols-4 gap-2
│  │      └─ Each: button with h-12 rounded-xl border-2
│  │          ├─ default: border-[var(--border)] bg-[var(--surface)] text-[var(--ink-700)]
│  │          └─ selected: border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)] font-bold
│  ├─ Field: 目標級
│  │  ├─ Label: "めざす級"
│  │  └─ Card Group: grid grid-cols-2 sm:grid-cols-3 gap-3
│  │      └─ Each Card: rounded-2xl border-2 p-4 min-h-[80px]
│  │          ├─ アイコン: AcademicCapIcon h-6 w-6
│  │          ├─ ラベル: "5級" "4級" "3級" "まだ決めない"
│  │          └─ サブ: "（〇〇相当）" text-xs text-[var(--ink-500)]
│  ├─ Field: 受験予定日（任意）
│  │  ├─ Label: "受験予定日（決まっていれば）"
│  │  ├─ Input: type=date / h-12 rounded-xl
│  │  └─ Hint: "未定の場合はスキップできます"
│  └─ NavRow: flex items-center justify-between mt-8
│     ├─ Back: ghost button "戻る" min-h-[48px]
│     └─ Next: primary button "次へ" min-h-[56px] + ChevronRightIcon
```

### Tailwind 実装サンプル（学年セレクタ）

```tsx
<div>
  <fieldset>
    <legend className="text-sm font-medium text-[var(--ink-900)] mb-2">学年</legend>
    <div className="grid grid-cols-4 gap-2">
      {["小4", "小5", "小6", "中1"].map((grade) => (
        <label
          key={grade}
          className={cn(
            "flex h-12 cursor-pointer items-center justify-center rounded-xl border-2 text-base font-medium transition-colors",
            selected === grade
              ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)] font-bold"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-700)] hover:bg-[var(--surface-muted)]"
          )}
        >
          <input
            type="radio"
            name="grade"
            value={grade}
            className="sr-only"
            checked={selected === grade}
            onChange={(e) => setSelected(e.target.value)}
          />
          {grade}
        </label>
      ))}
    </div>
  </fieldset>
</div>
```

### a11y

- [ ] Radio Group は `<fieldset>` + `<legend>` でグループ化
- [ ] `sr-only` の `<input type="radio">` でキーボード操作維持
- [ ] 選択状態は色だけでなく**太さ・ボールド**で表現
- [ ] `prefers-reduced-motion` で transition 0.01ms

---

## 画面 3: レベル診断テスト（`/diagnostic`）

### 構造

```
Screen: レベル診断テスト
├─ Background: bg-[var(--bg)] min-h-screen
├─ Container: max-w-2xl mx-auto px-4 py-6
│
├─ Top Bar: flex items-center justify-between mb-6
│  ├─ Close: XMarkIcon button (48×48) aria-label="中断"
│  ├─ Counter: "8 / 15" / font-mono text-base text-[var(--ink-700)]
│  └─ ProgressBar: w-32 h-2 rounded-full bg-[var(--surface-muted)] / fill bg-[var(--brand-500)]
│
├─ Coach Block: flex items-center gap-3 mb-6
│  ├─ ことだまトリ "support" (64×64)
│  └─ Speech: text-base text-[var(--ink-700)] "気楽にやろう、わからなくてもOKです。"
│
├─ Question Card: bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-card)] p-6 sm:p-8 mb-6
│  ├─ Question Label: "問題 8" / text-sm font-medium text-[var(--ink-500)] mb-3
│  ├─ Question Text:
│  │  ├─ "次の英文の (   ) に入る言葉を選んでください。"
│  │  ├─ class: text-base text-[var(--ink-900)] leading-relaxed mb-4
│  │  └─ ふりがな対応: <ruby>英文<rt>えいぶん</rt></ruby>
│  ├─ Study English: bg-[var(--brand-50)] rounded-2xl p-5 mb-6
│  │  └─ Sentence: "She ( ) to school every day."
│  │      └─ class: font-en font-bold text-2xl text-[var(--ink-900)] leading-[1.7] text-center
│  └─ Choices: grid grid-cols-1 sm:grid-cols-2 gap-3
│      └─ Each Choice: button
│          ├─ class: w-full min-h-[64px] rounded-2xl border-2 px-5 py-4 text-left transition-colors
│          ├─ default: border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)]
│          ├─ hover: hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)]
│          ├─ selected: border-[var(--brand-500)] bg-[var(--brand-100)] font-bold
│          ├─ Inner Layout: flex items-center gap-3
│          │  ├─ Letter Circle: w-8 h-8 rounded-full bg-[var(--brand-200)] grid place-items-center / "A" font-bold
│          │  └─ Text: "go" / font-en text-lg
│
├─ Action Row: flex items-center justify-between gap-3
│  ├─ SkipButton: ghost button "わからない・スキップ" min-h-[48px] / text-[var(--ink-500)]
│  └─ AnswerButton: primary button "答える" min-h-[56px] disabled until selection
│      ├─ class: bg-[var(--brand-600)] text-white shadow-[var(--shadow-pop)]
│      └─ disabled: bg-[var(--surface-muted)] text-[var(--ink-300)] cursor-not-allowed
│
└─ Footer Hint: text-center text-xs text-[var(--ink-500)] mt-4
   └─ "全 15 問、約 5 分。途中保存できます。"
```

### a11y

- [ ] Choice は `<button type="button" aria-pressed={selected}>`
- [ ] 進捗バーに `role="progressbar" aria-valuenow={8} aria-valuemax={15}`
- [ ] ライブリージョン: 回答結果は `<div aria-live="polite">` で読み上げ
- [ ] スキップボタンは Tab 順最後（誤操作回避）

---

## 画面 4: ホーム（`/home`）

### 構造（モバイル基準、`sm:` 以上で 2 カラム化）

```
Screen: ホーム
├─ Header: 共通ヘッダー（64px Sticky）
├─ Main: max-w-screen-xl mx-auto px-4 lg:px-8 py-6 space-y-6
│
├─ Section 1: HeroCountdown
│  ├─ Container: bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] rounded-3xl p-6 sm:p-8 shadow-[var(--shadow-card)]
│  ├─ Layout: flex flex-col sm:flex-row items-center gap-6
│  ├─ Character: ことだまトリ "cheer" (128×128 sm:160×160)
│  └─ Right: flex-1
│      ├─ H1: "今日のミッション" / text-2xl sm:text-3xl font-heading font-bold text-[var(--ink-900)]
│      ├─ Countdown Row: flex items-baseline gap-2 mt-2
│      │  ├─ Label: "英検3級まで" / text-base text-[var(--ink-700)]
│      │  ├─ Number: "あと 87 日" / font-mono text-4xl sm:text-5xl font-bold text-[var(--brand-700)]
│      │  └─ Pace: "1日 60分で間に合うペース" / text-sm text-[var(--mint-700)] (Mint アクセント)
│      └─ Progress Pill: rounded-full bg-[var(--surface)] px-3 py-1 inline-flex items-center gap-2 mt-3
│         ├─ ChartBarIcon h-4 w-4 text-[var(--brand-600)]
│         └─ "全体進捗 42%" / text-sm font-medium
│
├─ Section 2: Today's Tasks Grid
│  ├─ H2: "今日のミッション (60分)" / text-xl font-heading font-bold mb-4
│  ├─ Grid: grid grid-cols-2 lg:grid-cols-4 gap-4
│  └─ Each Task Card: bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-card)] p-5 min-h-[160px]
│      ├─ Icon Container: w-12 h-12 rounded-2xl bg-[var(--brand-100)] grid place-items-center mb-3
│      │  └─ Icon: BookOpenIcon / SpeakerWaveIcon / AcademicCapIcon / PencilSquareIcon h-6 w-6 text-[var(--brand-700)]
│      ├─ Title: "単語" / text-base font-bold text-[var(--ink-900)]
│      ├─ Duration: "15分" / text-sm text-[var(--ink-500)] mb-3
│      ├─ ProgressBar: h-2 rounded-full bg-[var(--surface-muted)] / fill bg-[var(--mint-500)] w-0
│      └─ Status: "未開始" / text-xs text-[var(--ink-500)] mt-2
│
├─ Section 3: Coach Pinned Card
│  ├─ Container: bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-card)] p-6 flex gap-4 items-start
│  ├─ Avatar: ことだまトリ "support" (80×80) shrink-0
│  └─ Content: flex-1
│      ├─ Header: flex items-center gap-2
│      │  ├─ Name: "ことだまトリ" / font-bold text-base
│      │  └─ Time: "14:32" / text-xs text-[var(--ink-500)]
│      ├─ Message: text-base text-[var(--ink-700)] leading-relaxed mt-2
│      │  └─ "おかえりなさい。きのう覚えた『decide』、今日も復習に出しますね。一緒にやってみましょう。"
│      └─ Action: button "コーチと話す" inline-flex / min-h-[44px] mt-3 / text-[var(--brand-700)] font-medium
│
└─ Section 4: Streak Tracker
   ├─ Container: bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-card)] p-5
   ├─ Header: flex items-center justify-between mb-4
   │  ├─ H3: "連続記録" / font-bold text-lg
   │  └─ Streak: "12日" / font-mono font-bold text-2xl text-[var(--brand-600)]
   ├─ Calendar: grid grid-cols-7 gap-2
   │  └─ Each Day: aspect-square rounded-xl
   │     ├─ done: bg-[var(--brand-500)] grid place-items-center → CheckIcon h-5 w-5 text-white
   │     ├─ today: bg-[var(--brand-100)] border-2 border-[var(--brand-500)] / 火マーク?? いいえ、SparklesIcon
   │     └─ upcoming: bg-[var(--surface-muted)]
   └─ Footer: text-sm text-[var(--ink-500)] text-center mt-3
      └─ "あと 3 日でつぼみが開きます。"
```

### Tailwind 実装サンプル（Hero）

```tsx
<section className="rounded-3xl bg-gradient-to-br from-[var(--brand-50)] to-[var(--brand-100)] p-6 shadow-[var(--shadow-card)] sm:p-8">
  <div className="flex flex-col items-center gap-6 sm:flex-row">
    <Image
      src="/character/cheer.svg"
      alt=""
      width={160}
      height={160}
      className="h-32 w-32 sm:h-40 sm:w-40"
    />
    <div className="flex-1 text-center sm:text-left">
      <h1 className="font-heading text-2xl font-bold text-[var(--ink-900)] sm:text-3xl">
        今日のミッション
      </h1>
      <div className="mt-2 flex flex-wrap items-baseline justify-center gap-2 sm:justify-start">
        <span className="text-base text-[var(--ink-700)]">英検3級まで</span>
        <span className="font-mono text-4xl font-bold text-[var(--brand-700)] sm:text-5xl">
          あと 87 日
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--mint-700)]">
        1日60分で間に合うペースです。
      </p>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-3 py-1">
        <ChartBarIcon className="h-4 w-4 text-[var(--brand-600)]" />
        <span className="text-sm font-medium text-[var(--ink-700)]">全体進捗 42%</span>
      </div>
    </div>
  </div>
</section>
```

### a11y

- [ ] カウントダウンに `<time dateTime="2026-07-22">` で意味付け
- [ ] 進捗バー: `role="progressbar" aria-valuenow={42} aria-valuemax={100}`
- [ ] キャラ画像は `alt=""`（装飾扱い）
- [ ] Streak カレンダー: `<table>` で曜日ヘッダ + `<th scope="col">`

---

## 画面 5: 学習中（語彙 4 択カード / `/study/vocab`）

### 構造

```
Screen: 学習中（語彙）
├─ Background: bg-[var(--bg)] min-h-screen
├─ Container: max-w-2xl mx-auto px-4 py-4 flex flex-col min-h-screen
│
├─ Top Bar: flex items-center justify-between py-3
│  ├─ Close: XMarkIcon button (48×48) aria-label="学習を中断"
│  ├─ Counter: "4/12" / font-mono text-base / center
│  └─ Hearts: flex gap-1
│      └─ Each: HeartIcon h-6 w-6 / text-[var(--brand-500)] (active) / text-[var(--surface-muted)] (lost)
│
├─ Progress: h-2 rounded-full bg-[var(--surface-muted)] / fill bg-[var(--brand-500)] w-1/3 mb-6
│
├─ Word Card: flex-1 flex items-center justify-center
│  └─ Card: bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-card)] p-8 sm:p-10 w-full max-w-md
│     ├─ Audio Button: w-20 h-20 rounded-full bg-[var(--brand-100)] mx-auto grid place-items-center mb-6 hover:bg-[var(--brand-200)]
│     │  └─ SpeakerWaveIcon h-8 w-8 text-[var(--brand-700)]
│     ├─ Word: "decide" / font-en font-extrabold text-4xl sm:text-5xl text-[var(--ink-900)] text-center
│     ├─ Phonetic: "/dɪˈsaɪd/" / font-mono text-base text-[var(--ink-500)] text-center mt-2
│     ├─ Question: "どんな意味でしょうか？" / text-base text-[var(--ink-700)] text-center mt-6 mb-5
│     └─ Choices: grid grid-cols-2 gap-3
│         └─ Each: button min-h-[72px] rounded-2xl border-2
│             ├─ Layout: flex items-center justify-center px-4
│             ├─ default: border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]
│             ├─ correct: border-[var(--success)] bg-[var(--mint-100)] / CheckIcon
│             ├─ wrong: border-[var(--warning)] bg-[var(--brand-50)] / 訂正タグなし
│             └─ Text: "決める" / font-bold text-lg
│
└─ Footer Bar: hidden until answered / sticky bottom-0 bg-[var(--surface)] border-t p-4
   └─ Next: primary button "次の問題" min-h-[56px]
```

### 正解時 Toast / Bottom Sheet

```
CorrectFeedback (Bottom Sheet, 220ms slide-up)
├─ bg-[var(--mint-100)] rounded-t-3xl p-6 shadow-[var(--shadow-modal)]
├─ Layout: flex items-start gap-4
├─ Character: ことだまトリ "cheer" (80×80)
└─ Content: flex-1
   ├─ Title: "いいですね、考え方が合っています" / font-bold text-lg text-[var(--mint-700)]
   ├─ XP: "+15 XP" / font-mono font-bold text-xl text-[var(--brand-700)] mt-1
   └─ Next: button "次の問題へ" min-h-[56px] mt-4 / w-full bg-[var(--brand-600)]
```

### 不正解時 Bottom Sheet

```
GentleCorrectFeedback (Bottom Sheet, 220ms slide-up + correctPop variant)
├─ bg-[var(--brand-50)] rounded-t-3xl p-6 shadow-[var(--shadow-modal)]
├─ Character: ことだまトリ "gentle-correct" (80×80)
├─ Title: "おしいです。もう一度見てみましょう。" / font-bold text-lg text-[var(--ink-900)]
├─ Correct Box: bg-[var(--surface)] rounded-2xl p-4 mt-3
│  ├─ "正解: A 「決める」" / text-base font-bold
│  ├─ Example Sentence: "I decided to go home." / font-en font-bold text-lg mt-2
│  └─ Translation: "わたしは家に帰ることに決めました。" / text-sm text-[var(--ink-700)] mt-1
└─ Action Row: flex gap-3 mt-4
   ├─ Retry: ghost "もう一度" min-h-[48px]
   └─ Next: primary "次へ" min-h-[56px] flex-1
```

### Tailwind 実装サンプル（Word Card）

```tsx
<motion.section
  className="w-full max-w-md rounded-3xl bg-[var(--surface)] p-8 shadow-[var(--shadow-card)] sm:p-10"
  variants={cardEnter}
  initial="hidden"
  animate="visible"
>
  <button
    aria-label={`${word} の発音を聞く`}
    className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-[var(--brand-100)] hover:bg-[var(--brand-200)] focus-visible:shadow-[var(--shadow-focus)]"
    onClick={playAudio}
  >
    <SpeakerWaveIcon className="h-8 w-8 text-[var(--brand-700)]" />
  </button>

  <h2 className="text-center font-en text-4xl font-extrabold text-[var(--ink-900)] sm:text-5xl">
    {word}
  </h2>
  <p className="mt-2 text-center font-mono text-base text-[var(--ink-500)]">{phonetic}</p>

  <p className="mt-6 mb-5 text-center text-base text-[var(--ink-700)]">
    どんな意味でしょうか？
  </p>

  <div className="grid grid-cols-2 gap-3">
    {choices.map((c, i) => (
      <button
        key={i}
        onClick={() => onSelect(i)}
        aria-pressed={selected === i}
        className={cn(
          "min-h-[72px] rounded-2xl border-2 px-4 py-3 text-base font-bold transition-colors",
          selected === i && isCorrect
            ? "border-[var(--success)] bg-[var(--mint-100)] text-[var(--mint-700)]"
            : selected === i && !isCorrect
            ? "border-[var(--warning)] bg-[var(--brand-50)] text-[var(--warning-fg)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)] hover:bg-[var(--surface-muted)]"
        )}
      >
        {c.label}
      </button>
    ))}
  </div>
</motion.section>
```

### a11y

- [ ] 単語の音声ボタンに `aria-label="発音を聞く"`
- [ ] Choice は `aria-pressed`（選択前）/ 結果表示後は `aria-disabled`
- [ ] 結果通知は `<div role="status" aria-live="polite">` で読み上げ
- [ ] `prefers-reduced-motion` 時は correctPop / wrongShake が fade のみ

---

## 画面 6: 進捗ダッシュボード（`/progress`）

### 構造

```
Screen: 進捗ダッシュボード
├─ Header: 共通ヘッダー
├─ Main: max-w-screen-xl mx-auto px-4 lg:px-8 py-6 space-y-6
│
├─ Page Header: flex items-center justify-between
│  ├─ H1: "進捗" / text-3xl font-heading font-bold
│  └─ Period Select: shadcn Select / "今月 v"
│
├─ KPI Grid: grid grid-cols-2 lg:grid-cols-4 gap-4
│  └─ Each KPI Card: bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-card)] p-5
│     ├─ Header: flex items-center gap-2
│     │  ├─ Icon Container: w-10 h-10 rounded-xl bg-[var(--brand-100)] grid place-items-center
│     │  │  └─ Icon: SparklesIcon (連続) / ClockIcon (時間) / AcademicCapIcon (語彙) / TrophyIcon (模試)
│     │  └─ Label: "連続日数" / text-sm text-[var(--ink-500)]
│     ├─ Value: "12 日" / font-mono text-3xl font-bold text-[var(--ink-900)] mt-3
│     └─ Trend: "+3 日 (前週比)" / text-xs text-[var(--mint-700)] mt-1
│         └─ ArrowTrendingUpIcon h-3 w-3 inline
│
├─ Score Chart Card: bg-[var(--surface)] rounded-3xl shadow-[var(--shadow-card)] p-6
│  ├─ H2: "模試スコア推移" / font-heading font-bold text-xl mb-4
│  ├─ Chart Container: w-full h-64 (Recharts LineChart)
│  │  ├─ Line: stroke=var(--brand-500) strokeWidth=3
│  │  ├─ Dot: fill=var(--brand-600) r=5
│  │  ├─ Grid: stroke=var(--border) strokeDasharray=3,3
│  │  └─ XAxis/YAxis: stroke=var(--ink-500) fontSize=12
│  └─ Footer: text-sm text-[var(--ink-700)] mt-3
│     └─ "過去5回の模試で +20 点伸びています。"
│
├─ Skills Grid: grid grid-cols-1 lg:grid-cols-2 gap-4
│  ├─ Skills Card: bg-[var(--surface)] rounded-3xl p-6
│  │  ├─ H2: "技能別 mastery"
│  │  └─ List: space-y-3
│  │     └─ Each Skill: flex items-center gap-3
│  │        ├─ Label: "語彙" / w-24 text-sm font-medium
│  │        ├─ ProgressBar: flex-1 h-3 rounded-full bg-[var(--surface-muted)]
│  │        │  └─ fill: bg-[var(--mastery-3)] (Amber Gold) / rounded-full h-full
│  │        └─ Percent: "78%" / w-12 text-right font-mono font-bold text-sm
│  └─ Level Map Card: bg-[var(--surface)] rounded-3xl p-6
│     ├─ H2: "学習マップ"
│     └─ Tree (SVG inline)
│        ├─ Lv50 Node: 3級ゴール / circle r=24 fill=var(--brand-200)
│        ├─ branches: 文法 / 語彙 / リスニング / 読解
│        └─ ロック表示: LockClosedIcon for 未到達
│
└─ Level Gauge Card: bg-gradient-to-r from-[var(--brand-50)] to-[var(--mint-100)] rounded-3xl p-6
   ├─ H2: "レベル進捗"
   ├─ Layout: flex items-center gap-4
   ├─ Badge Display: relative w-20 h-20
   │  ├─ Circle: bg-[var(--badge-silver)] rounded-full grid place-items-center
   │  └─ Number: "Lv12" / font-mono font-bold text-xl text-[var(--badge-silver-fg)]
   └─ ProgressBar: flex-1
      ├─ Label: "次のレベルまで あと 240 XP"
      └─ Bar: h-4 rounded-full bg-[var(--surface)] / fill bg-[var(--brand-500)] w-3/4
```

### Tailwind 実装サンプル（KPI Card）

```tsx
<div className="rounded-3xl bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
  <div className="flex items-center gap-2">
    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-100)]">
      <SparklesIcon className="h-5 w-5 text-[var(--brand-700)]" />
    </div>
    <span className="text-sm text-[var(--ink-500)]">連続日数</span>
  </div>
  <div className="mt-3 font-mono text-3xl font-bold text-[var(--ink-900)]">12 日</div>
  <div className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--mint-700)]">
    <ArrowTrendingUpIcon className="h-3 w-3" />
    +3 日 (前週比)
  </div>
</div>
```

### a11y

- [ ] グラフは `<title>` + `<desc>` で代替テキスト提供
- [ ] mastery バー: `role="progressbar" aria-valuenow={78} aria-label="語彙の習得度 78パーセント"`
- [ ] レベルマップ SVG: `role="img" aria-label="学習マップ。5級から3級までの進捗"`
- [ ] 数値は `<span className="font-mono">`（読み上げで「いちにち」と読まれないため数字記法明示）

---

## 受入基準（W1 主要画面ゲート）

- [ ] 6 画面全てが上記構造で Tailwind 実装され、モバイル / PC でレイアウト崩れなし
- [ ] 各画面の主要 CTA が `min-h-[56px]`、通常タップ要素が `min-h-[48px]` を満たす（K-1 達成）
- [ ] WCAG AA: axe-core で各画面 fail 0
- [ ] フォーカスリング: Tab で全 interactive 要素にフォーカス可、リング視認可
- [ ] `prefers-reduced-motion` で celebration / pop が fade のみへ縮退
- [ ] 学習文 (`<p className="font-en font-bold text-2xl">`) の line-height 1.7 達成
- [ ] ふりがな対応: 解説文の小4以上漢字に `<ruby>` 適用パターン確立
- [ ] ダークモード: 全画面で next-themes 切替が崩れない

---

## 次アクション

1. Dev: `app/(auth)/signup/page.tsx` `app/(onboarding)/profile/page.tsx` 等を作成、構造図に沿って実装
2. shadcn/ui 必須コンポーネント install: `button card input label progress dialog sheet toast select separator`
3. Heroicons import 一覧（共通）:
   ```ts
   import {
     BookOpenIcon, HomeIcon, AcademicCapIcon, ChartBarIcon, FireIcon, SparklesIcon,
     ClockIcon, CalendarDaysIcon, TrophyIcon, SpeakerWaveIcon, MicrophoneIcon, PlayIcon,
     CheckIcon, XMarkIcon, ChevronRightIcon, ArrowTrendingUpIcon, Cog6ToothIcon,
     BellIcon, LockClosedIcon, UserGroupIcon, InformationCircleIcon, PaperAirplaneIcon,
     SunIcon, MoonIcon, ComputerDesktopIcon, EyeIcon, PencilSquareIcon, HeartIcon
   } from "@heroicons/react/24/outline";
   ```
4. W2 で残り画面（コーチチャット / 設定 / 保護者ビュー / レベル別カリキュラム選択）を追加
