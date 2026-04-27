# Dev W5 Frontend Implementation Report (G-2 / G-5)

担当: Dev (Frontend)
対象: PRJ-016 HANEI W5 ギャップ埋め 6 タスクのうち G-2 / G-5
根拠: DEC-036 (W5 圧縮 5 営業日プラン)
状態: 全タスク実装完了 + typecheck / lint / test 全緑

---

## 1. 変更ファイル一覧

### 新規作成
- `projects/PRJ-016/app/src/components/study/kotodama-tori.tsx`
  - **G-5**: ことだまトリ コンパニオン UI コンポーネント (`"use client"`)。
  - 5 mood (`thinking` / `cheerful` / `celebrating` / `sad` / `encouraging`) を Heroicons +
    Tailwind class + マイクロコピー (`design-w1-microcopy.md` から抜粋) で表現。
  - アニメーションは `motion-safe:animate-bounce` / `motion-safe:animate-pulse` で
    `prefers-reduced-motion` に追従 (WCAG)。
  - `aria-label="ことだまトリ"` + 各 mood に sr-only ラベル付与。streak >= 3 で連続正解
    バッジを `<ruby>` ふりがな付きで表示。
- `projects/PRJ-016/app/src/components/study/kotodama-tori-mood.ts`
  - `pickMood(lastResult, streakBeforeAnswer)` 純関数 + 型 (`KotodamaMood` / `LastResult`)。
  - "use client" コンポーネントから分離してユニットテスト可能 (node 環境で安全に import)。
- `projects/PRJ-016/app/src/lib/study/streak.ts`
  - `computeRunningStreak(recentLogs)` 純関数。answer_logs の末尾 (最新) から連続正解数を
    返す。"use server" モジュールには非 async export ができないため分離。
- `projects/PRJ-016/app/src/lib/study/audio-gate.ts`
  - **G-2**: `shouldShowAudioUi(audioUrl, skill)` / `canReplay(playCount)` / `MAX_REPLAY=3`。
  - listening + audioUrl truthy のときのみ true を返す純関数 (vocab/grammar/reading を壊さない)。

### 修正
- `projects/PRJ-016/app/src/app/(app)/study/[levelCode]/[skillCode]/StudyClient.tsx`
  - **G-2**: `audioUrl` / `skill` を props に追加。`shouldShowAudioUi()` で listening のみ
    再生 UI を出す。再生ボタン (`SpeakerWaveIcon` / `PauseIcon`)、もう一度きくボタン
    (`ArrowPathIcon`)、再生回数カウンタ (`{count} / 3 かい`) を実装。
  - 自動再生なし (`preload="metadata"`、`controls` 非表示、ブラウザポリシー + 子ども UX 両立)。
  - `aria-label="音声を再生"` / `"一時停止"` / `"もう一度聞く"` + `aria-pressed={isPlaying}` で WCAG。
  - **G-5**: `KotodamaTori` を画面冒頭に常時表示。`feedback?.streak ?? 0` と直前の正誤から
    `pickMood()` で mood 算出して prop で渡す。
  - state リセットは `<StudyClient key={problem.id}>` (page.tsx 側) で React の自然な
    unmount/remount に任せる方針に変更 (useEffect での setState を避けて
    `react-hooks/set-state-in-effect` ルールに準拠)。
- `projects/PRJ-016/app/src/app/(app)/study/[levelCode]/[skillCode]/page.tsx`
  - StudyClient に `audioUrl={problem.audioUrl ?? null}` / `skill={skill}` を渡す。
  - `key={problem.id}` を付与して問題切り替え時の state 自動リセットを担保。
- `projects/PRJ-016/app/src/lib/actions/study.ts`
  - **G-5**: `SubmitAnswerResult` に `streak: number` を追加。
  - submitAnswer 末尾で `answer_logs` を desc 50 件取得 → `computeRunningStreak()` を計算
    して戻り値に含める。
  - `computeRunningStreak` 本体は `@/lib/study/streak` から import (非 async helper を
    "use server" モジュールに置けないため分離)。

### テスト追加
- `projects/PRJ-016/app/tests/unit/study.kotodama-tori.test.ts` (新規)
  - `pickMood()` 5 ケース (thinking / cheerful / celebrating / sad / encouraging) +
    `computeRunningStreak()` 4 ケース = **9 ケース**。
- `projects/PRJ-016/app/tests/unit/study.audio-gate.test.ts` (新規)
  - `shouldShowAudioUi()` 6 ケース + `canReplay()` 4 ケース = **10 ケース**。

合計 +19 テストケース (138 → **157 件**)。

---

## 2. 検収結果

| ゲート | コマンド | 結果 |
|--------|----------|------|
| typecheck | `npx tsc --noEmit` | exit=0 / 0 errors |
| lint | `npm run lint` | exit=0 / 0 errors / 0 warnings |
| test | `npm run test` | **157 passed (16 files)** / 失敗 0 / skip 0 |

baseline 138 件 → +19 件追加で 157 件。Backend 担当の 138 件は破壊なし。

---

## 3. G-2 / G-5 仕上がりサマリー

### G-2: listening 問題の TTS audio 再生
- **可視条件**: `shouldShowAudioUi(audioUrl, skill)` = listening かつ audioUrl truthy のときのみ
  再生 UI を出す。vocab / grammar / reading では何も出ない (既存 UX 非破壊)。
- **再生 UI**:
  - 「おとをきく」(ふりがな ruby) ラベル
  - 再生 / 一時停止トグルボタン (Heroicons `SpeakerWaveIcon` ↔ `PauseIcon`)
  - 「もう一度きく」ボタン (`ArrowPathIcon`、頭出し再生)
  - 再生回数カウンタ `{n} / 3 かい` (`tabular-nums` で chr ずれ防止)
- **制約**:
  - 自動再生なし (`preload="metadata"`、独自ボタンのみ)
  - 最大 3 回上限 (`MAX_REPLAY = 3`)、上限到達でボタンが disabled
  - `<track kind="captions" />` を空で同梱 (a11y 用 audio タグ標準)
- **WCAG**: `aria-label` / `aria-pressed` / `aria-live="polite"` (回数表示) を付与。
- **絵文字 0 件 / Heroicons / shadcn/ui Button + Card** で `design-guidelines.md` 準拠。

### G-5: ことだまトリ mood 動的反映
- **配置**: `StudyClient` の冒頭に常駐 (問題カードの上)。
- **mood 5 状態** (Phase 1 圧縮版、`design-w1-character.md` の 10 状態のうち代表 5 つ):
  | mood | 条件 | アイコン | アニメ |
  |------|------|---------|-------|
  | thinking | 解答前 | AcademicCapIcon | なし |
  | cheerful | 直前正解 + streak < 3 | FaceSmileIcon | bounce |
  | celebrating | 直前正解 + streak >= 3 | SparklesIcon | pulse |
  | sad | 直前不正解 + 直前まで streak >= 3 | HandRaisedIcon | なし |
  | encouraging | 直前不正解 + streak < 3 | HeartIcon | なし |
- **マイクロコピー**: `design-w1-microcopy.md` から「ですます調 / 絵文字なし / 小学生向け」の
  原則を踏襲した 5 文言を `MOOD_MESSAGE` に固定。
- **streak ソース**: `submitAnswer` 戻り値に `streak: number` を追加。サーバ側で
  `answer_logs` を desc 50 件取得 → `computeRunningStreak()` で末尾から連続正解数を
  計算 (純関数 / ユニットテスト対象)。
- **WCAG**: アニメ全て `motion-safe:` prefix 付与で `prefers-reduced-motion` 尊重。
  キャラ枠に `aria-label="ことだまトリ"` + sr-only mood ラベル。
- **絵文字 0 件**、Heroicons + Tailwind class のみ。Lottie / 外部 PNG 不要 (Phase 1)。

---

## 4. 申し送り (E2E 担当者 / CEO 検収者向け)

1. **E2E selector**:
   - キャラ枠は `[data-testid="kotodama-tori"]` で取得可。`data-mood` / `data-streak` /
     `data-last-result` の data attribute で状態アサート可能。
   - audio UI は `[data-testid="audio-player"]` (Card 全体)、再生ボタン
     `[data-testid="audio-play-toggle"]`、もう一度ボタン `[data-testid="audio-replay"]`、
     回数表示 `[data-testid="audio-play-count"]`、`<audio>` 本体 `[data-testid="audio-element"]`。
2. **listening 以外の問題には audio UI が出ない**: `shouldShowAudioUi` で gate しているため、
   E2E でも `vocab` ページでは `audio-player` testid が DOM に存在しない (`expect(...).toBeNull()`
   ではなく `count: 0` で検証推奨)。
3. **streak 計算の流儀**: DB の `streaks.currentStreak` (連続学習日数) とは別軸の
   "running streak" (連続正解回数 / `answer_logs` 起点)。E2E で 3 連勝シナリオを組むときは
   解答ログを 3 件 isCorrect=true で投入 → `submitAnswer` の戻り値の streak が 3 になる。
4. **state リセット方式**: `<StudyClient key={problem.id} />` で問題切替時に React が
   自動 remount → audio 再生回数 / mood / 選択肢ハイライトが全リセット。E2E で
   `router.refresh()` 後の状態を確認する場合、新しい problemId に切り替わっていれば
   playCount は 0 に戻る。
5. **TTS audio URL**: `problems.audioUrl` (R2 URL / DEC-030 で 480 件生成済) に依存する。
   現状ローカル DB にどの程度入っているかは未確認 (Backend 担当の領域)。E2E では
   audioUrl が null の listening 問題に当たる可能性あり (= UI が出ない) — その場合は
   listening seed の中で audioUrl が確実に入っている問題 ID を fixture で固定推奨。

---

## 5. 領域分担の遵守

- Backend 担当 (G-1 / G-3 / G-4) のファイル (`/home/page.tsx`、`repository.ts`、
  `aggregations.ts`) には一切手を加えていない。
- 共有テスト `study.aggregations.test.ts` も触っていない (138/138 そのまま PASS)。
- `eslint.config.mjs` は変更なし。
- 認可 (三層認可 / `requireLearnerOwner`) は `submitAnswer` 内の既存呼び出しを保持、
  追加した `answer_logs` 取得も同じ scope の中で実行。
