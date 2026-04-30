# 開発報告 - W10-T5: 過学習防止「もう少しで終わるよ」UX (HANEI / PRJ-016)

- 案件: PRJ-016 HANEI（小学生向け英語学習 PWA, Phase 2 ゲーミフィケーション）
- タスク: W10-T5 過学習防止 (Overlearning Prevention)
- 着手判定: DEC-058 (W10-T4 完遂後の GO 判定)
- 報告日: 2026-04-30

---

## 実施内容

DEC-024 罰則ゼロ哲学 (punishment-zero philosophy) を厳守したまま、子どもの過学習を構造的に抑止する 30/60 分タイマーを実装。
W10-T4 までは「セッション単位 (5/7/10 分)」しか測れていなかったが、本タスクで「同一学習者・本日累計学習秒数 (JST 6:00 境界)」を DB に永続化し、reload 越え / cross-device 越えで閾値を判定できる構造に拡張した。

達成スコープ:

1. **`study_sessions` テーブル新設 (migration 0014)** - cumulative_seconds を SUM 集計するインフラ
2. **30 分 nudge modal** - 「もう一息で 30 分。きょうは ここで やすもう」(穏やかな促し / 強制ではない)
3. **60 分 hard_limit** - 「きょうは じゅうぶん がんばったね。あした また あおうね」(server gate / 罰なし / streak 不変)
4. **保護者ダッシュボード「今日 X 分学習」可視化** - tone (neutral / warm / celebrate) で前向き copy 切替
5. **`learner_preferences.preferredSessionMinutes`** - W10-T4 SessionPicker の「いつもの長さ」を cross-device 永続化
6. **session_cumulative E2E + overtime_cumulative E2E** - M-A1 リグレッションガード兼 30/60 分閾値到達確認

---

## 技術的判断

### 1. cumulative の単位 = 「同一学習者・本日 (JST 6:00 境界) 累計学習秒数」

W10-T4 の `sessionStartTime` はセッション (5/7/10 分の選択) 単位だが、W10-T5 の閾値は「今日合計」が必要。
そこで `study_sessions` テーブルを新設し `(learner_id, session_date)` 検索 INDEX で SUM 集計する経路を作った。

- `session_date`: JST 6:00 境界 ('YYYY-MM-DD')。Daily Quest と同じ `getJstQuestDate(now)` を流用 → 6 時境界をズラさない
- `cumulative_seconds`: 行ごとの累計学習秒数 (cap = 4 時間)
- `client_session_id`: SessionPicker が発行する URL UUID。`UNIQUE (learner_id, client_session_id)` で `startOrResumeStudySession` の冪等性を担保
- `end_reason`: 4 種 (`natural` / `abort` / `overtime` / `hard_limit`) - 後の分析用

### 2. ハートビート設計 - 1 秒 tick (UI) / 10 秒 heartbeat (server) / 60 秒 cap (DB)

W10-T4 の sessionStartTime と整合させつつ、リクエスト負荷とリアルタイム性のバランス:

- **UI tick (1 秒)**: `useEffect setInterval` で `localElapsedSec` を進める → nudge modal 検知 (= 30 分到達直後 1 秒以内に出す)
- **Server heartbeat (10 秒)**: `recordStudyHeartbeat({ sessionDbId, deltaSeconds })` server action を呼び `cumulative_seconds` を SQL の `MIN(cap, col + delta)` で原子的に加算 → reload 越えで baseline を維持
- **Heartbeat delta cap (60 秒)**: `clampHeartbeatDeltaSeconds(s)` で 0..60 にクランプ → タブが眠っていて 30 分後に復帰しても unbounded で進まない

これにより「閾値判定の正確性 (1 秒)」と「DB 書込量 (1 分あたり 6 行更新)」を両立。

### 3. 60 分 hard_limit は **server-side gate** で入口を塞ぐ

クライアントの 1 秒 tick だけでは、reload で問題ページが一瞬出てしまう (UX 後退)。
そこで `/study/[level]/[skill]/page.tsx` で `getTodayLearningSeconds(learner.id)` を server で先取りし、60 分以上なら問題を一切 fetch せずに gate ページ (`data-testid="overlearning-hard-limit-gate"`) を返す。

罰則ゼロ表現:

- ヘッダ: **「きょうは じゅうぶん」** (達成感)
- 本文: **「きょうは {minutes} ふん がんばったね。あした また あおうね。」** (祝福)
- CTA: **「ホームへ もどる」** (前向きな閉じ方)

DEC-024 観点:

- streak は `study_sessions.end_reason='hard_limit'` でも一切減算しない (streak は `answer_logs` から日次再計算のため、本テーブルが触ること自体ない)
- 「やりすぎ / だめ / ペナルティ」のような語彙は禁止 (E2E で `not.toContain` を assert)

### 4. 30 分 nudge は client-side `OverlearningModal` で穏やかに

server-render では 30 分 < x < 60 分でも問題ページを通常通り出す。
modal は client 側 (`StudyClient.tsx`) で `hasReachedOverlearningNudge(seconds)` を 1 秒 tick で確認 → state で表示。

- 2 ボタン (横並び 56px tap area / K-1)
  - 「やすむ」 → `endStudySession({ sessionDbId, reason: 'abort' })` → `/home`
  - 「もうすこし やる」 → modal 閉 + 1 度きり (= `nudgeShownRef` で再表示しない)
- データ属性: `data-testid="overlearning-modal" data-variant="nudge"` で E2E 検出
- DEC-024: 「あと 5 分だけ」のような時間制限を再オファーしない (= 強制ではない)

### 5. React 19 純度規則 (`react-hooks/purity` / `set-state-in-effect`)

途中、lint が:

- `useRef<number>(Date.now())` を **「render 中の不純な呼び出し」** として reject
- effect 本体での `setShowOverlearningHardLimit(true)` を reject

修正:

- `useRef<number>(0)` で lazy 初期化 (1 秒 tick 内で `if (ref.current === 0) ref.current = Date.now()`)
- `showOverlearningHardLimit` を派生値 (`= trackingActive && hasReachedOverlearningHardLimit(seconds)`) に変えて state 不要化
- nudge の setState は `setInterval` callback 内なので render の外 → 適合

これで DEC-024 / DEC-006 (純粋関数優先) 整合 + 全 lint クリーン。

### 6. `"use server"` ファイルから sync 関数を export 不可 (Turbopack)

`src/lib/actions/learner-preferences.ts` (`"use server"`) に `normalizePreferences` (sync) を置いていたところ、`bun run build` が:

```
Server Actions must be async functions.
  > 75 | export function normalizePreferences(
```

で fail した (W8 までは Webpack で許容されていたが、Next.js 16 + Turbopack で厳格化)。
純関数を `src/lib/study/learner-preferences-normalize.ts` に切り出して両側 (server action / unit test) から import する形にリファクタ。

### 7. Playwright `E2E_PORT` env 対応

dev (`next dev`) が port 3000 を占有している環境向けに、`playwright.config.ts` を `E2E_PORT` 環境変数で切替できるよう拡張:

```bash
E2E_PORT=3100 bunx playwright test
```

`webServer.url` / `use.baseURL` / `webServer.env.PORT` を全て `E2E_PORT` で揃えることで、Next.js `start` の listen port と Playwright のチェック先がズレない。
W10-T5 の E2E (session-cumulative / overtime-cumulative) は port 3100 fallback で green 確認済み。

---

## 成果物

### 新規ファイル (untracked)

| ファイル | 行数 | 役割 |
| --- | --- | --- |
| `drizzle/0014_w10_study_sessions.sql` | 53 | study_sessions テーブル + 2 INDEX |
| `src/lib/study/study-time.ts` | (純関数) | 閾値定数 / clampers / nudge & hard_limit predicates / describeTodayMinutes |
| `src/lib/study/learner-preferences-normalize.ts` | 50 | normalizePreferences 純関数 (server / test 共有) |
| `src/lib/actions/study-sessions.ts` | (server action) | startOrResumeStudySession / endStudySession / recordStudyHeartbeat / getTodayLearningSeconds |
| `src/components/study/OverlearningModal.tsx` | (client) | nudge / hard_limit 2 variant の modal (K-1 / K-2 準拠) |
| `tests/unit/study.study-time.test.ts` | 26 tests | 閾値・clampers・tone 切替の不変条件 |
| `tests/e2e/session-cumulative.spec.ts` | 2 tests | M-A1 ガード + 30 分 nudge |
| `tests/e2e/overtime-cumulative.spec.ts` | 1 test | 60 分 hard_limit + DEC-024 streak 不変 |

### 変更ファイル (modified)

| ファイル | 主な変更 |
| --- | --- |
| `src/lib/db/schema.ts` | `studySessions` テーブル定義追加 / 既存 streak は無変更 |
| `src/lib/actions/learner-preferences.ts` | normalizePreferences を split / preferredSessionMinutes を zod schema に追加 / setPreferredSessionMinutes server action 追加 |
| `src/app/(app)/study/page.tsx` | getLearnerPreferences → SessionPicker.initialPreferredMinutes |
| `src/app/(app)/study/[levelCode]/[skillCode]/page.tsx` | server-side hard_limit gate / startOrResumeStudySession で sessionDbId 確定 / serverTodayCumulativeSeconds を Client に渡す |
| `src/app/(app)/study/[levelCode]/[skillCode]/StudyClient.tsx` | 1 秒 tick + 10 秒 heartbeat + nudge modal + hard_limit endStudySession side-effect |
| `src/components/study/SessionPicker.tsx` | initialPreferredMinutes prop / setPreferredSessionMinutes 永続化 |
| `src/app/(parent)/parent/dashboard/page.tsx` | 「今日の学習時間」 Card (data-testid="today-learning-card") + tone styling |
| `tests/e2e/fixtures/db-fixture.ts` | applyMigrations に 0014 追加 / seedFixture flush に study_sessions 追加 |
| `tests/unit/learner-preferences.test.ts` | preferredSessionMinutes describe 追加 (11 tests = 既存 + W10-T5) / import パス修正 |
| `playwright.config.ts` | E2E_PORT env 対応 |

---

## テスト結果

### Unit (Vitest)

- 全 45 ファイル / **603 tests pass** (W10-T4 時点 573 tests + W10-T5 で 30 tests 追加)
  - `tests/unit/study.study-time.test.ts`: 26 tests (新規)
  - `tests/unit/learner-preferences.test.ts`: 4 tests 追加 (preferredSessionMinutes describe)
- Duration 3.31s

### typecheck / lint

- `bun run typecheck` (tsc --noEmit): clean
- `bun run lint` (eslint .): clean

### build (Next.js production)

- Turbopack `npm run build`: ✓ 全 23 routes 生成成功

### E2E (Playwright @ port 3100)

- `tests/e2e/session-cumulative.spec.ts`: **2/2 passed (24.4s)**
  - M-A1 ガード: session-mode `/study` で study_sessions 行が 1 件作成・revisit 冪等
  - 30 分 nudge: cumulative_seconds = 30*60+1 → reload → modal `[data-variant="nudge"]` 表示 / 2 ボタン visible / 「もうすこし やる」で dismiss
- `tests/e2e/overtime-cumulative.spec.ts`: **1/1 passed (23.5s)**
  - cumulative_seconds = 60*60+1 → reload → server gate `[data-testid="overlearning-hard-limit-gate"]` 表示 (study-prompt 出ず) / 「がんばったね」 copy / 罰語 (だめ / やりすぎ / ペナルティ) なし / data-today-minutes >= 60 / streak.current_streak / longest_streak / freeze_tickets が完全に不変 / 「ホームへ もどる」で /home

### migration (drizzle)

- `bun drizzle-kit generate`: schema diff = 0 (snapshot は cleanup 済 / repo の SQL ファイル 14 本は in-place)
- E2E fixture (file:./tests/e2e/.tmp/e2e.db) で 0014 migration 適用成功

---

## 設計ガイド遵守

### DEC-024 (punishment-zero philosophy)

- 60 分 hard_limit gate のコピーは「きょうは じゅうぶん がんばったね」(祝福) のみ
- 罰語 / 否定語 / 「やりすぎ」のような副詞は使わない (`describeTodayMinutes` 単体 + E2E 両方で assert)
- streak は `end_reason='hard_limit'` でも減らない (streak は study_sessions に依存しないため、構造的に保全)

### DEC-006 (純粋関数優先)

- `study-time.ts` の predicate / clamper / describer は全て純関数 (DB / fetch ゼロ依存)
- `normalizePreferences` も `learner-preferences-normalize.ts` に切り出し純関数化

### DEC-055 (idempotency / single source of truth)

- `startOrResumeStudySession` は `UNIQUE (learner_id, client_session_id)` INDEX で冪等
- `recordStudyHeartbeat` は SQL `MIN(cap, col + delta)` で 4 時間 cap を原子的に強制
- `endStudySession` は `ended_at IS NULL` ガードで二重 close を no-op 化

### K-1 (56px tap area) / K-2 (font + furigana)

- OverlearningModal の 2 ボタンは min-h-tap-cta (= 56px) / 全 furigana 付き / 半角数字
- gate ページの「ホームへ もどる」も同 size

---

## 技術的課題・リスク

### 1. ⚠ Phase 1 直リンク (sessionId 無し) では cumulative tracking 無効

`/study/eiken-5/vocab` (URL に `?session=` なし) で入った場合、page.tsx は `studySessionDbId = undefined` を渡す → StudyClient の `trackingActive = false` で 1 秒 tick / heartbeat / nudge / hard_limit が全て無効化される。
これは legacy 互換 (W6 までの直リンク E2E を壊さない) のため意図的だが、**今後 SessionPicker 経由に統一できれば全 entry で cumulative tracking が効く**。

→ W10-T6 以降で「直リンクは SessionPicker にリダイレクト」を入れる選択肢あり (今回スコープ外)。

### 2. ⚠ Streak 計算は答案ベース (`answer_logs`)

DEC-024 の哲学上「hard_limit でも streak が減らない」は重要だが、実は streak は `study_sessions` を見ていないため、構造的に保全される。逆に言うと「60 分 cap で叩き落とした日でも、その前に 1 問でも正解していれば streak は伸びる」が正解 = 罰則ゼロ。
本実装は streak テーブルに 1 文字も触らない構造なので、副作用としての減算リスクは無い。

### 3. ⚠ heartbeat の dropping (タブ閉じ前 send)

10 秒間隔 heartbeat は `setInterval` ベース。ユーザーが画面を離れた直後に閉じた場合、最後の 0..10 秒が DB に届かない (= 当日累計が ~10 秒過小評価される可能性)。
`navigator.sendBeacon` 連携は今回スコープ外。実害は最大 10 秒なので、30/60 分閾値の精度には影響しない。

### 4. (改善余地) cumulative 集計が SUM N rows

`getTodayLearningSeconds(learnerId)` は当日の study_sessions 行を SUM する。1 日に 30 sessionId 入れ替わったとしても 30 行 SUM = 軽量だが、極端に増えたら考える。INDEX `(learner_id, session_date)` 済なので Phase 2 完遂までは問題なし。

---

## 受入基準照合

| 受入基準 | 状況 |
| --- | --- |
| 全 unit test PASS (W10-T4 573 件 + 新規) | ✓ 603 件 PASS (+30) |
| typecheck / lint pass | ✓ |
| `study_sessions` migration 0014 実行可能 | ✓ drizzle-kit generate clean / E2E fixture migration green |
| session cumulative E2E green | ✓ 2/2 (port 3100) |
| overtime cumulative E2E green | ✓ 1/1 (port 3100) |
| 保護者ダッシュボード「今日 X 分」表示が学習者ごとに正しい | ✓ data-testid="today-learning-card" / `getTodayLearningSeconds(learner.id)` で個別集計 |
| DEC-024 / DEC-006 / DEC-055 厳守 | ✓ (上記設計ガイド遵守セクション参照) |

---

## 次のアクション (CEO 経由 review 部門 へ申し送り)

- レビュー観点1: `OverlearningModal` のコピー (3-5 歳児向けの平仮名比率 / furigana / DEC-024 罰則ゼロ語彙) を最終確認
- レビュー観点2: `study_sessions` migration の Production Turso への適用手順 (W10-T4 までと同じ手順で OK)
- レビュー観点3: legacy 直リンク (Phase 1 互換) の cumulative tracking 不在を「許容できる過渡期挙動」として確定するか (DEC として記録するか)

W10-T5 実装完了。CEO の次の判断 (review 部門 呼び出し / 次タスクへ) を待ちます。
