# PRJ-016 HANEI W4 受験日設定モーダル中身ガイド

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W4 開発実装（既存 `/parent/dashboard` 内 受験日編集 Dialog の中身）
- **W3 連携**: design-w3-parent-dashboard.md § 3.7 CoachingSettings の Dialog Trigger（中身は本ガイドで完成）
- **DEC 連携**: DEC-004 / DEC-008 / DEC-012 / DEC-018 / DEC-023
- **ことだまトリ新状態**: `parent-planning`（合計 15 状態目）を本ガイドで新規追加

---

## § 1. モーダルの構造

### 1.1 全体レイアウト

shadcn `Dialog` の標準 3 構成を採用し、保護者向けトーン（敬語 + フラット）を維持する。

```
Dialog
├─ DialogHeader
│  ├─ DialogTitle: 「受験予定日を設定する」
│  └─ DialogDescription: 「受験予定日を変更すると、{学習者名}さんのホーム画面のカウントダウンと 1 日の推奨学習時間が自動で更新されます。」
├─ DialogContent（本体）
│  ├─ 級セレクト: shadcn Select（5 級 / 4 級 / 3 級 / 準 2 級）
│  ├─ Calendar: shadcn Calendar（過去日付不可、当日含む 730 日以内）
│  ├─ ことだまトリ parent-planning（80×80px、Calendar 右側）
│  └─ 補助情報: 「現在の受験予定日: {currentExamDate}」
└─ DialogFooter
   ├─ Cancel ボタン（outline）
   └─ Save ボタン（primary、disabled 条件: 日付未選択 / 過去日付）
```

### 1.2 サイズ感

- モバイル: full-height 風 Sheet 形式は採用せず、shadcn Dialog の中央配置を維持。`max-w-md w-[calc(100vw-2rem)]`
- md+: `max-w-lg`
- 高さ: Calendar の月送り次第で可変、最大 `max-h-[80vh] overflow-y-auto`

### 1.3 必要な shadcn 追加コンポーネント

W3 までで `dialog` / `select` は導入済（DEC-023 W3 T-5 参照）。本画面では追加で:

- `npx shadcn@latest add calendar`（Dev に依頼）
- 内部依存: `react-day-picker`（自動追加される）+ `date-fns`（既存依存に含まれているか Dev 側で要確認）

---

## § 2. 日付入力 UI: shadcn Calendar 採用

### 2.1 採用理由

| 候補 | 採用判定 | 理由 |
|---|---|---|
| ネイティブ `<input type="date">` | NG | OS 依存で見た目が統一できない、保護者画面のフラット感と合わない |
| shadcn Calendar（react-day-picker） | **採用** | デザイン制御可能、shadcn/ui 親和性、SR / キーボード操作標準対応 |
| 自作カレンダー | NG | a11y 実装コストが過大 |

### 2.2 Calendar の Tailwind カスタマイズ

shadcn Calendar は内部に `Button` を使うため、CSS 変数経由で配色を上書きする。

```tsx
<Calendar
  mode="single"
  selected={selectedDate}
  onSelect={setSelectedDate}
  disabled={(date) => date < today || date > maxDate}
  fromMonth={today}
  toMonth={maxDate}
  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
  classNames={{
    day_selected:
      "bg-[var(--brand-500)] text-[var(--ink-900)] hover:bg-[var(--brand-600)] hover:text-white focus:bg-[var(--brand-600)]",
    day_today:
      "bg-[var(--brand-50)] text-[var(--brand-700)] font-semibold",
    day_disabled:
      "text-[var(--ink-300)] opacity-50 cursor-not-allowed",
    day_outside:
      "text-[var(--ink-300)] opacity-40",
    head_cell:
      "text-[var(--ink-500)] font-medium text-xs",
    caption_label:
      "text-base font-semibold text-[var(--ink-900)]",
    nav_button:
      "h-9 w-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]",
  }}
/>
```

### 2.3 日付制約

- `fromMonth={today}`: 過去月の表示を禁止
- `disabled={(date) => date < today || date > maxDate}`: 過去日付 + 730 日以降を選択不可
- `maxDate = addDays(today, 730)`（2 年後まで）
- 選択時バリデーション: useState で `selectedDate` を保持、`!selectedDate || selectedDate < today` のとき Save ボタン disabled

### 2.4 級セレクト

```tsx
<div>
  <Label htmlFor="exam-level" className="text-sm font-medium text-[var(--ink-900)]">
    受験する級
  </Label>
  <Select value={level} onValueChange={setLevel}>
    <SelectTrigger id="exam-level" className="mt-1.5 h-11 rounded-xl">
      <SelectValue placeholder="級を選択" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="5">5 級</SelectItem>
      <SelectItem value="4">4 級</SelectItem>
      <SelectItem value="3">3 級</SelectItem>
      <SelectItem value="pre2">準 2 級</SelectItem>
    </SelectContent>
  </Select>
</div>
```

---

## § 3. 過去日付不可のビジュアル指示

### 3.1 視覚仕様

- 過去日付セル: `text-[var(--ink-300)] opacity-50 cursor-not-allowed line-through`（取消線で「不可」を視覚化）
- ホバー時のツールチップ: 「過去の日付は選択できません」（react-day-picker の `disabledDays` 標準では表示されないため、aria-label でのみ案内 = 視覚的には取消線とグレーで判別）
- 当日: `bg-[var(--brand-50)] text-[var(--brand-700)] font-semibold ring-1 ring-[var(--brand-300)]`（「今日」だけ強調）

### 3.2 補助テキスト（Calendar 下部）

```tsx
<p className="mt-2 text-xs text-[var(--ink-500)]">
  本日以降〜2 年先までの日付を選択できます。過去の日付はグレーで表示されます。
</p>
```

### 3.3 アクセシビリティ

- 過去日付セル: `aria-disabled="true"` + `aria-label="{date} は選択できません（過去の日付）"`
- スクリーンリーダーで「選択できません」と必ず読み上げ
- キーボード操作: 矢印キーで過去日付セルにフォーカスは移動するが Enter / Space で選択不可

---

## § 4. 上書き確認ダイアログ（二段確認）

### 4.1 表示条件

既に `exam_dates` テーブルに該当学習者 × 該当級の登録がある場合に発火。

### 4.2 二段ダイアログのフロー

```
[Save 押下]
  ↓
[既存登録あり?]
  ├─ Yes → 上書き確認ダイアログ（AlertDialog）を表示
  │       ├─ 「{level} 級の受験日を {oldDate} から {newDate} に変更します」
  │       ├─ 「{学習者名}さんのホーム画面のカウントダウンも更新されます」
  │       ├─ Cancel ボタン
  │       └─ Confirm ボタン → 保存処理 → トースト
  └─ No → 直接保存処理 → トースト
```

### 4.3 AlertDialog の Tailwind

```tsx
<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
  <AlertDialogContent className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
    <AlertDialogHeader>
      <AlertDialogTitle className="text-lg font-semibold text-[var(--ink-900)]">
        受験予定日を変更しますか
      </AlertDialogTitle>
      <AlertDialogDescription className="mt-2 text-sm text-[var(--ink-700)]">
        {level} 級の受験予定日を <span className="font-mono text-[var(--ink-900)]">{oldDate}</span> から{" "}
        <span className="font-mono text-[var(--brand-700)] font-semibold">{newDate}</span> に変更します。
        {learnerName}さんのホーム画面のカウントダウンも自動で更新されます。
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="mt-6 gap-2">
      <AlertDialogCancel className="min-h-[44px] rounded-xl">キャンセル</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleConfirm}
        className="min-h-[44px] rounded-xl bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-[var(--ink-900)] hover:text-white font-semibold">
        変更する
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 4.4 アクセシビリティ

- AlertDialog は shadcn 内部で `role="alertdialog"` + `aria-modal="true"` 自動付与
- Esc 閉じる、Tab トラップ、初回フォーカスは Cancel に当てる（誤操作回避）

---

## § 5. 保存完了トースト

### 5.1 表示内容

shadcn `useToast` を使用、保存成功時に右下（モバイルは下中央）に表示。

```ts
toast({
  title: "受験予定日を更新しました",
  description: `${level} 級の受験日を ${formatDate(newDate)} に設定しました`,
  duration: 4000,
});
```

### 5.2 ビジュアル

- `bg-[var(--surface)] border border-[var(--mint-300)] text-[var(--ink-900)]`
- 左に CheckCircleIcon `text-[var(--mint-600)]` `h-5 w-5`
- 自動消滅: 4 秒、ホバーで一時停止

### 5.3 失敗時トースト

- 保存失敗（バリデーション以外のエラー、例: ネットワーク）
  - `bg-[var(--surface)] border border-[var(--warning)] text-[var(--ink-900)]`
  - タイトル: 「保存に失敗しました」
  - 説明: 「通信状況をご確認のうえ、もう一度お試しください」
  - 「もう一度試す」ボタン（リトライ）

---

## § 6. ことだまトリ「parent-planning」状態（W4 新規 / 15 状態目）

### 6.1 命名規則と位置づけ

W3 で確定した命名規則 `parent-{intent}` を踏襲し、`parent-planning` を採用。受験日を設定する瞬間にのみ表示するモーダル内専用状態。

| 既存状態 | 用途 |
|---|---|
| `parent-greeting` | 保護者画面の挨拶 / 通常時 |
| `parent-alert` | 学習停止リマインド |
| `parent-celebrate` | 特別達成の祝福 / 模試合格時 |
| `parent-encouraging` | 模試の合格基準に届かなかった励まし（W4 D-1） |
| **`parent-planning`（W4 新規 / 15 状態目）** | **受験日を設定する瞬間のモーダル内表示** |

### 6.2 キャラ表現仕様

- **首傾け角度**: 0°、わずかに前傾 5°（カレンダーを覗き込む姿勢）
- **翼の位置**: 片翼で小さなカレンダーを軽く支える、もう片翼は体の横
- **表情**: 集中した穏やかな表情。目はしっかり開き、口元はわずかに開いて「考え中」を示す
- **持ち物**: 小さなカレンダー（W1 `serious-countdown` のカレンダー保持を踏襲、サイズはやや大きめに）
- **配色**: 体メイン Amber Gold `#F2A93A`（不変）、カレンダーは `var(--surface)` ベース + `var(--brand-300)` の強調マーク

### 6.3 生成プロンプト（gpt-image-2 / Midjourney 共通）

```
[共通プレフィックス], standing with body slightly leaning forward 5 degrees as if looking at a small calendar held by one wing, eyes focused and calm with intelligent concentration, mouth slightly open in a quiet thinking expression, the calendar shows a small marked date (subtle amber gold mark, NOT a big circle), the other wing softly resting at body side, expression of "let's pick the right date together", parent-facing planning tone for the moment of setting an exam date in a modal dialog, dignified and supportive NOT pressuring
[共通サフィックス]
```

### 6.4 配置場所

- Dialog 内、Calendar の右側に 80×80px で配置（モバイルでは Calendar 上部に 64×64px）
- セリフ吹き出しなし（モーダル内では吹き出しがノイズになるため、画像のみで佇む）

### 6.5 SVG ファイル配置（Dev 連携）

- `projects/PRJ-016/app/public/character/parent-planning.svg`
- `KotodamaState` 型に追加:
  ```ts
  export type KotodamaState =
    | "idle" | "cheer" | "support" | "gentle-correct" | "thinking"
    | "level-up" | "streak-fire" | "serious-countdown"
    | "morning-wave" | "night-rest" | "sleeping"
    | "parent-greeting" | "parent-alert" | "parent-celebrate"
    | "parent-encouraging" // W4 D-1
    | "parent-planning";   // W4 D-2
  ```

---

## § 7. Tailwind 指定（主要 className）

### 7.1 Dialog ラッパー

```tsx
<DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
  <DialogHeader>
    <DialogTitle className="text-xl font-semibold text-[var(--ink-900)]">
      受験予定日を設定する
    </DialogTitle>
    <DialogDescription className="mt-2 text-sm text-[var(--ink-700)]">
      受験予定日を変更すると、{learnerName}さんのホーム画面のカウントダウンと
      1 日の推奨学習時間が自動で更新されます。
    </DialogDescription>
  </DialogHeader>

  <div className="mt-5 space-y-4">
    {/* 現在の受験予定日 */}
    {currentExamDate && (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <p className="text-xs text-[var(--ink-500)]">現在の受験予定日</p>
        <p className="mt-0.5 font-mono text-base font-semibold text-[var(--ink-900)]">
          {formatDate(currentExamDate)}
        </p>
      </div>
    )}

    {/* 級セレクト */}
    {/* §2.4 参照 */}

    {/* Calendar + ことだまトリ */}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex-1">
        {/* Calendar §2.2 参照 */}
      </div>
      <Image src="/character/parent-planning.svg" alt=""
        width={80} height={80}
        className="hidden h-20 w-20 shrink-0 self-center sm:block" />
    </div>

    {/* 補助テキスト */}
    <p className="text-xs text-[var(--ink-500)]">
      本日以降〜2 年先までの日付を選択できます。過去の日付はグレーで表示されます。
    </p>
  </div>

  <DialogFooter className="mt-6 gap-2 sm:gap-3">
    <DialogClose asChild>
      <button type="button"
        className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-medium text-[var(--ink-900)] hover:bg-[var(--surface-muted)] focus-visible:shadow-[var(--shadow-focus)]">
        キャンセル
      </button>
    </DialogClose>
    <button type="button" onClick={handleSave}
      disabled={!selectedDate || !level || selectedDate < today}
      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-500)] px-5 font-semibold text-[var(--ink-900)] hover:bg-[var(--brand-600)] hover:text-white focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-500)]">
      <CalendarDaysIcon className="h-4 w-4" aria-hidden />
      この日付で保存
    </button>
  </DialogFooter>
</DialogContent>
```

---

## § 8. アクセシビリティ

### 8.1 ARIA / セマンティクス

- shadcn Dialog 標準: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` で `DialogTitle` 参照、`aria-describedby` で `DialogDescription` 参照
- Calendar (react-day-picker): 内部で `role="grid"` + 各日付セル `role="gridcell"` + `aria-selected` 自動
- 級セレクト: shadcn Select 内部で `role="combobox"` + listbox 標準
- 保存ボタン: `disabled` 時は `aria-disabled="true"` 自動付与
- 上書き確認 AlertDialog: `role="alertdialog"` 標準

### 8.2 キーボード操作（必達）

- **Esc**: Dialog を閉じる（shadcn 標準動作）
- **Tab**: フォーカス移動順 = 級セレクト → Calendar の前月ボタン → 月ラベル → 翌月ボタン → 日付グリッド → キャンセル → 保存
- **Tab トラップ**: Dialog 内でループ、外には抜けない（shadcn 標準）
- **矢印キー**（Calendar 内）: 上下左右で日付セル移動、Home / End で週の先頭 / 末尾、Page Up / Down で前月 / 翌月
- **Enter / Space**（日付セル）: 選択（過去日付では発火しない）

### 8.3 フォーカス管理

- Dialog open 時: 初回フォーカスは級セレクト（既選択ならカレンダーの当日）
- Dialog close 時: フォーカスを Trigger ボタン（W3 ダッシュボードの「日付を変更」ボタン）に戻す

### 8.4 WCAG AA コントラスト

- Calendar 選択日: `bg-[var(--brand-500)] text-[var(--ink-900)]` = 7.8:1 ◯ AAA
- Calendar 当日: `bg-[var(--brand-50)] text-[var(--brand-700)]` = 4.5:1 ◯ AA
- 過去日付: `text-[var(--ink-300)] opacity-50` = 装飾扱い、選択不可なので AA 例外（aria-disabled で SR は動作）
- ボタン disabled: `bg-[var(--surface-muted)] text-[var(--ink-500)]` = 5.0:1 ◯ AA（disabled でも判読可能維持）

### 8.5 prefers-reduced-motion

- shadcn Dialog のデフォルト fade-in / slide-in アニメは `motion-reduce:animate-none` で無効化
- AlertDialog 同様

---

## § 9. 受入基準（W4 受験日設定モーダルゲート）

- [ ] /parent/dashboard の「日付を変更」ボタンから Dialog が開く
- [ ] Calendar が表示され、過去日付がグレー + 選択不可
- [ ] 級セレクト（5 / 4 / 3 / 準 2 級）が動作する
- [ ] 既存登録ありの場合、Save 押下で AlertDialog が開く
- [ ] AlertDialog の Confirm で `exam_dates` テーブルに保存され、トーストが表示される
- [ ] トーストに「{level} の受験日を {date} に設定しました」が表示される
- [ ] ことだまトリ `parent-planning` の SVG が Dialog 内右側に表示される
- [ ] `KotodamaState` 型に `"parent-planning"` が追加される
- [ ] Esc で Dialog が閉じる
- [ ] Tab 移動でフォーカスが Dialog 内をループする
- [ ] 矢印キーで Calendar 内日付セル移動が可能
- [ ] WCAG AA: コントラスト 4.5:1 以上を axe-core で自動検証
- [ ] reduced-motion: Dialog アニメーションが停止する

---

## 付録 A: 参照ファイルリンク

- W1 トークン: `projects/PRJ-016/reports/design-w1-tokens.md`
- W1 キャラ: `projects/PRJ-016/reports/design-w1-character.md`
- W3 保護者ダッシュボード: `projects/PRJ-016/reports/design-w3-parent-dashboard.md` § 3.7
- W4 模試結果: `projects/PRJ-016/reports/design-w4-mock-exam-results.md`
- W4 学習者切替: `projects/PRJ-016/reports/design-w4-learner-switch.md`
- W4 JSX snippets: `projects/PRJ-016/reports/design-w4-snippets.md`

---

以上、W4 受験日設定モーダルガイド完成。
