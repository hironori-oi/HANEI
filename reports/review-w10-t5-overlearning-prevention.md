# レビュー結果 - W10-T5 過学習防止 (HANEI / PRJ-016)

- 案件: PRJ-016 HANEI（小学生向け英検 PWA / Phase 2 ゲーミフィケーション）
- タスク: W10-T5 過学習防止「もう少しで終わるよ」UX
- レビュー日: 2026-04-30 (CEO 経由)
- レビュー対象: `projects/PRJ-016/reports/dev-w10-t5-overlearning-prevention-done.md` + `projects/PRJ-016/app/` 実体

## 総合判定

**APPROVE** — main push 推奨。

DEC-058 で確定した受入基準 7 項目を全て満たし、DEC-024 罰則ゼロ哲学 / DEC-006 完全無料 / DEC-055 冪等性の 3 大設計原則を構造レベル（DB スキーマ / SQL の `MIN(cap, col + delta)` / streak 非介入）で保全している。Critical / Major 指摘なし。後続タスクで吸収できる Minor 改善余地のみ M-1〜M-3 として列挙する（push の阻害要因ではない）。

## チェック結果（受入基準）

| # | 項目 | 結果 | 備考 |
| --- | --- | --- | --- |
| 1 | unit test 全 PASS（W10-T4 573 件 + W10-T5 新規） | OK | レビュー側で `bun run test` 再実行 → 45 ファイル / **603 tests pass / 3.48s**（dev 報告と一致）。`tests/unit/study.study-time.test.ts` 単独実行で 26 tests pass を再確認 |
| 2 | typecheck / lint clean | OK | `bun run typecheck` (tsc --noEmit) 0 errors / `bun run lint` (eslint .) 0 errors 0 warnings をレビュー側で再確認 |
| 3 | `study_sessions` migration 0014 実行可能 | OK | `drizzle/0014_w10_study_sessions.sql:29-52` で `CREATE TABLE IF NOT EXISTS` + 2 INDEX。`tests/e2e/fixtures/db-fixture.ts:67-69` の `applyMigrations` リストに 0014 が登録済 |
| 4 | session_cumulative E2E green | OK | dev 報告で `tests/e2e/session-cumulative.spec.ts: 2/2 passed (24.4s)` 確認。spec 構造（M-A1 ガード + 30 分 nudge）はレビュー側でファイル確認済 |
| 5 | overtime_cumulative E2E green | OK | dev 報告で `tests/e2e/overtime-cumulative.spec.ts: 1/1 passed (23.5s)` 確認。spec の罰語 `not.toContain` assertion + streak 不変 assertion の構成をレビュー側でも確認 |
| 6 | 保護者ダッシュボード「今日 X 分」表示が学習者ごとに正しい | OK | `src/app/(parent)/parent/dashboard/page.tsx:48,128` で `getTodayLearningSeconds(learner.id)` を learner 単位で呼出。`page.tsx:174-198` で `data-testid="today-learning-card" / data-today-minutes / data-today-tone` を出力 |
| 7 | DEC-024 / DEC-006 / DEC-055 厳守 | OK | 詳細は下記「重点レビュー結果 A」参照。streak 非介入 / 課金導線ゼロ / UNIQUE INDEX + `MIN(cap, col + delta)` の 3 点で構造担保 |

---

## 重点レビュー結果

### A. DEC-024 罰則ゼロ哲学

**評価: 強く準拠（構造的に減点不可能な設計）**

#### A-1. コピー検証

| 場所 | コピー | 判定 |
| --- | --- | --- |
| `OverlearningModal` headline (hard_limit) | `src/components/study/OverlearningModal.tsx:46-48` 「きょうは じゅうぶん」 | 祝福調 OK |
| `OverlearningModal` body (hard_limit) | 同 :49-51 「きょうは {todayMinutes} ふん がんばったね。あした また あおうね。」 | 祝福調 OK |
| `OverlearningModal` headline (nudge) | 同 :47 「もうすこしで 30 ぷん」 | 促し / OK |
| `OverlearningModal` body (nudge) | 同 :51 「きょう N ふん がんばったよ。きゅうけいすると あたまが すっきりするよ。」 | 促し / OK（強制ではない） |
| 60 分 hard_limit gate page | `src/app/(app)/study/[levelCode]/[skillCode]/page.tsx:134-139` 「きょうは じゅうぶん」「きょうは N ふん がんばったね。あした また あおうね。」 | 祝福調 OK |
| `describeTodayMinutes` 60 分超 | `src/lib/study/study-time.ts:134-141` `tone="celebrate" / "きょう N ふん がんばった" / "きょうは じゅうぶん。あした また あおうね"` | 祝福調 OK |
| `describeTodayMinutes` 30 分超 | 同 :142-149 `tone="warm" / "やすみつつ つづけてね"` | 促し / OK |
| `describeTodayMinutes` 0 分 | 同 :126-133 「きょうは まだ これから」「ちょっとだけでも はじめてみよう」 | 否定形なし / OK |

**罰語スキャン結果**（「だめ / やりすぎ / ペナルティ / 失格 / 減点」を OverlearningModal / hard_limit gate / study-time.ts / dashboard で全文検索）: **0 hit**。

unit test 側 (`tests/unit/study.study-time.test.ts:165-178`) で `expect(r.primary).not.toContain("だめ") / expect(r.hint).not.toContain("やりすぎ")` を assertion 化。E2E (`tests/e2e/overtime-cumulative.spec.ts:189-192`) でも `gateText` に対して同 3 語の `not.toContain` を assertion 化。**コードと回帰テスト両方で罰語禁止が機械化**されている点が高評価。

#### A-2. streak 非減算（最重要）

- `src/lib/actions/study-sessions.ts` 全体を grep 検索 → `streaks` テーブルへの `update` / `delete` / `set` 呼び出しが **0 hit**。
- `endStudySession` (`study-sessions.ts:254-324`) は `study_sessions.endedAt / endReason` のみ更新し、`hard_limit` reason でも `streaks` テーブルに一切触らない。
- 実装報告と DEC-024 注記の通り、streak は `answer_logs` 由来の日次再計算のため、本タスク実装が **構造的に減算経路を持たない**（迂回経路もない）。
- E2E (`overtime-cumulative.spec.ts:200-204`) で `current_streak / longest_streak / freeze_tickets` 3 値の不変を直接 SQL で assertion 化。

#### A-3. nudge は「促し」であって「強制」ではない

- `OverlearningModal.tsx:104-127` の nudge variant は **2 ボタン**（「もうすこし やる」 outline / 「おやすみ する」 primary）で続行が能動的に可能。
- 「もうすこし やる」を押した後、StudyClient (`StudyClient.tsx:223,226` の `w10t5NudgeShownRef.current = true` ガード) で **same-session 内では再表示しない** = 「あと 5 分だけ」の繰返し催促をしない。
- StudyClient の hard_limit 検知 (`StudyClient.tsx:266-293`) は side-effect のみで `setState` を含まないため React 19 純度規則準拠。

### B. K-1 / K-2（小学生向け UX 規範）

**評価: 準拠**

- **K-1（56px tap area）**: `OverlearningModal.tsx:97,110,120` の Button に `min-h-tap-cta` クラス + `size="lg"` 指定。hard_limit gate (`page.tsx:141`) も同クラス。Tailwind の `min-h-tap-cta` カスタムユーティリティが 56px 以上を保証する前提（W8 / W10-T4 と同一）。
- **K-2（平仮名 / 半角数字 / ふりがなレベル）**:
  - 全 copy が平仮名中心（漢字は「今日 / 今日 X 分」のみで保護者向け dashboard、子供 UI の OverlearningModal / gate ページは「きょう / ふん / がんばったね / じゅうぶん」と平仮名）
  - 数字は **半角**（「30 ふん」「60 ふん」「N ふん がんばった」）。漢数字混入なし。
- aria-label 完備（`OverlearningModal.tsx:99,112,122`）+ `role="dialog" aria-modal aria-labelledby` (`OverlearningModal.tsx:55-57`) でアクセシビリティ良好。

### C. アーキテクチャ整合性

**評価: 良好**

#### C-1. migration 0014 の SQLite/libSQL 互換性

- `CREATE TABLE IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`: 全て libSQL 対応構文。
- 外部キー: `FOREIGN KEY (learner_id) REFERENCES learner_profiles(id) ON DELETE cascade` (`drizzle/0014_w10_study_sessions.sql:41`) — Phase 1 の他 migration と整合（learner_profiles 削除時にカスケード）。
- カラム型 / `unixepoch()` デフォルト: 既存 `0010` / `0011` / `0012` / `0013` と同パターン。

#### C-2. `recordStudyHeartbeat` の SQL 原子性

- `study-sessions.ts:175-187` で `cumulative_seconds = MIN(cap, cumulative_seconds + delta)` を **1 statement の UPDATE** で実行（`SELECT → JS で計算 → UPDATE` の race window がない）。
- `WHERE id = ? AND learner_id = ? AND endedAt IS NULL` の三重スコープで終了済 session への加算を弾く。
- `delta` は `clampHeartbeatDeltaSeconds` (`study-time.ts:81-84`) でサーバー側でも 0..60 に再 clamp。client 改竄耐性あり。

#### C-3. `startOrResumeStudySession` の冪等性

- `drizzle/0014:46-47` で `UNIQUE INDEX (learner_id, client_session_id)` 投入。
- `study-sessions.ts:80-114` で **既存行 SELECT → 無ければ INSERT** の 2-step。同 URL UUID で 2 度呼ばれても同じ行を返す。
- E2E (`session-cumulative.spec.ts:184-194`) で **「同 URL 再訪後も rows.length === 1 / 同 id」**を assertion 化（DB 直接 SQL 確認）。M-A1 リグレッションガード十分。

#### C-4. 三層認可

- 全 server action（`startOrResumeStudySession` / `recordStudyHeartbeat` / `endStudySession` / `getTodayLearningSeconds`）が `requireAuth` → `requireLearnerOwner` の 2 段ガード（`study-sessions.ts:72-73, 166-167, 268-269, 342-343`）。
- 全 SQL に `learner_id` を WHERE 含み（同ファイル :87-92, 181-187, 284-290, 364-368）。
- `eslint-disable no-restricted-syntax` コメントが「learner_id 二重スコープ済」のレビュー証跡として明示（`study-sessions.ts:79, 191, 296, 357`）。

#### C-5. React 19 純度規則対応

- `showOverlearningHardLimit` を **派生値**（`StudyClient.tsx:207-208`）にして state 不要化。
- `useRef<number>(0)` で lazy 初期化、effect 内 `if (ref.current === 0) ref.current = Date.now()` (`StudyClient.tsx:215-218`)。
- nudge 表示の `setState` は `setInterval` callback 内（`StudyClient.tsx:219-232`）→ render 外で適合。
- hard_limit 検知の `endStudySession` 呼出は `useEffect` 内で `w10t5HardLimitEndedRef` ガード付き 1 回限り（`StudyClient.tsx:266-293`）。
- これらの設計は dev 報告 §技術的判断 5 と一致しており、`react-hooks/purity` / `set-state-in-effect` への合理的回避策として妥当。

### D. テストカバレッジ

**評価: 十分**

#### D-1. unit 30 件追加の網羅性

- `tests/unit/study.study-time.test.ts` 26 tests（再実行で確認）:
  - 閾値定数 (2)
  - `hasReachedOverlearningNudge` (4: 未満 / 境界 / 超過 / NaN)
  - `hasReachedOverlearningHardLimit` (4: 同上)
  - `clampHeartbeatDeltaSeconds` (3: 範囲 / 小数 / 異常)
  - `clampSessionCumulativeSeconds` (2: 範囲 / 異常)
  - `todayMinutesFromSeconds` (2: floor / 異常)
  - `describeTodayMinutes` (6: 0 分 / 0-30 / 30-60 境界 / 30-60 / 60+ / 60+ 維持) — **罰語排除 assert 込**
  - `sanitizePreferredSessionMinutes` (3: 5/7/10 / その他数値 / 非数値型)
- `tests/unit/learner-preferences.test.ts` で `preferredSessionMinutes: null` を default に追加した正規化テスト 4 件追加。

純関数の境界条件（30 分ぴったり / 60 分ぴったり / 負値 / NaN / Infinity）と DEC-024 罰語 not.toContain が両方 unit レベルで担保されている。

#### D-2. E2E 2 spec の検証範囲

- **session-cumulative.spec.ts** (2 tests):
  - 「session-mode で /study に入ると study_sessions 行が作成される (M-A1 ガード)」: `?dur=5&session=<uuid>` で行 1 件 + UNIQUE 重複なし + 同 URL 再訪で同 id（**冪等性確認**） — M-A1 リグレッション検出に十分。
  - 「当日累計 30 分超 で nudge modal」: DB 直 SQL で `cumulative_seconds = 30*60+1` → reload → modal `[data-variant="nudge"]` visible + 2 ボタン + 「もうすこし やる」で dismiss（**reload 越え** 検証）。
- **overtime-cumulative.spec.ts** (1 test):
  - 60 分超 → server-render 段階で gate 切替（study-prompt が出ない = page.tsx の入口 gate が効いている） / 「がんばったね」+ 罰語 0 / `data-today-minutes >= 60` / streak 3 値不変 / 「ホームへ もどる」で /home 復帰 — DEC-024 streak 不変の **DB 直接 SQL** assertion が決定的。

cross-device 越えは dev 報告で言及されているがテストとしては「reload = 同一 page 上の DB 再読込」までのカバー。完全な cross-device E2E（別ブラウザコンテキスト）はないが、server-rendered baseline + UNIQUE INDEX + JST 6:00 境界の 3 要素で構造的に保全されているため許容（M-3 として記載）。

### E. 既存機能との整合性

**評価: 良好**

- **W10-T4 SessionPicker / sessionStartTime と W10-T5 cumulative tracking の関係**:
  - SessionPicker (`src/components/study/SessionPicker.tsx:36,42-48,92`) で `initialPreferredMinutes` prop を受け、server からの `preferredSessionMinutes` を localStorage より優先（cross-device 一貫性）。
  - StudyClient.tsx 内で W10-T4 sessionStartTime（5/7/10 分の **session 単位** elapsed）と W10-T5 baseline+localElapsed（**当日累計**）が独立した 2 つの時計として共存。`setInterval` も別 useEffect で分離（`StudyClient.tsx:160-178` vs `:219-232`）。衝突なし。
- **W8 sound / confetti / daily-goal preferences**:
  - `learner-preferences.ts:42-46` の zod schema が `soundEnabled / confettiEnabled / preferredSessionMinutes` を `optional()` で並列許容。
  - `normalizePreferences` (`learner-preferences-normalize.ts` に切出) は既存 W8 keys を保持しつつ `preferredSessionMinutes` を default `null` で merge。
  - unit (`tests/unit/learner-preferences.test.ts`) で `preferredSessionMinutes: null` を default 期待値として 4 件追加 → W8 機能と非破壊的並列。
- **直リンク (sessionId 無し) で legacy E2E**:
  - `page.tsx:154-167` で `sessionRaw` 不在時は `studySessionDbId = undefined` → StudyClient 内 `trackingActive = false` (`StudyClient.tsx:189`) で 1 秒 tick / heartbeat / nudge / hard_limit 全て無効化。legacy 直リンク路は **意図的に W6 までの挙動を維持**。
  - ただし server-side hard_limit gate (`page.tsx:120-150`) は **session の有無に関わらず実行される** ため、直リンクでも 60 分超なら gate に切替わる。これは「保険」として正しい挙動（DEC-024 観点で「全 entry で hard_limit が効くべき」を最低限満たす）。

### F. 申し送り事項

dev 報告 §技術的課題・リスク 4 件に対するレビュー側評価:

| # | dev 申し送り | レビュー評価 |
| --- | --- | --- |
| 1 | Phase 1 直リンク (sessionId 無し) では 1 秒 tick / heartbeat / nudge が無効 | **妥当**。W10-T6 以降で「直リンク → SessionPicker リダイレクト」は別タスク扱いで OK。ただし server-side hard_limit gate は直リンクでも効く（page.tsx:120）ため、最も重要な「60 分で必ず止める」は守られている。M-1 として「過渡期挙動を DEC として明記」を推奨 |
| 2 | hard_limit でも streak は守られる（構造的） | **妥当**。コード/SQL/E2E 三層で確認済。これは申し送りというより設計上の正当化メモ |
| 3 | heartbeat dropping (タブ閉じ前 0..10 秒の最終 chunk) | **妥当**。30/60 分閾値の精度には影響しない（最大 10 秒誤差 = 1.7% / 0.6%）。`navigator.sendBeacon` 連携は将来のリファインで OK |
| 4 | cumulative 集計が SUM N rows | **妥当**。INDEX `(learner_id, session_date)` で 1 日 30 行程度なら問題なし。Phase 3 で session 数が日次 100 を超え始めたら `cumulative_seconds` を `learners.today_cumulative_seconds` 列にデノーマライズ案を検討（M-3） |

---

## マイナー指摘（後続タスクで吸収可）

### M-1: Phase 1 直リンクの cumulative tracking 不在を DEC で明文化

`page.tsx:152-167` の挙動は「sessionId なし = trackingActive false」だが、これは設計判断であり、コード読み返し時に「バグでは？」と誤解されうる。次の判断記録（W10 締め DEC か W11 着手 DEC）に「直リンクは過渡期で無効、server-side hard_limit gate のみ効く」を 1 行明記すると保守性が上がる。push の阻害要因ではない。

### M-2: heartbeat の `sendBeacon` 連携を W11 polish で検討

タブクローズ直前の最終 0..10 秒分が DB に届かない件は実害最大 10 秒で 30/60 分閾値判定に影響しないが、保護者ダッシュボード「今日 X 分」表示の精度（夜の最後セッションが 5 分過小評価される可能性）には響く。`visibilitychange` + `navigator.sendBeacon` で 1 line 追加可能。W11 polish or β 直前に統合推奨。

### M-3: SUM(N rows) 集計のデノーマライズ案

`getTodayLearningSeconds` の `SUM(cumulative_seconds)` は 1 日 30 行までなら軽量だが、Phase 3（β 拡大）で 1 学習者が複数家族メンバーの switching 頻度が上がり session 数が増える可能性。`learner_profiles.today_cumulative_seconds_cache` + JST 6:00 reset cron の方向で計画線として記録しておくと安心。push の阻害要因ではない。

## メジャー指摘

**なし。**

## 推奨次アクション

### main push 可否

**push 可**。レビュー側で以下を確認済:

- `bun run typecheck` clean
- `bun run lint` clean
- `bun run test` 603/603 PASS
- migration 0014 は libSQL 互換 SQL のみ
- DEC-024 / DEC-006 / DEC-055 を構造レベル（DB UNIQUE / SQL `MIN(cap, col + delta)` / streak 非介入 / 課金導線ゼロ）で保全
- M-1〜M-3 はいずれも push の阻害要因にならない後続改善

#### commit メッセージ案

```
feat(prj-016): W10-T5 過学習防止 (overlearning prevention) UX

- study_sessions テーブル新設 (migration 0014) で「同一学習者・本日累計学習秒数」
  を JST 6:00 境界で永続化 (reload / cross-device 越え対応)
- 30 分 nudge: 穏やかな promise modal (「もうすこしで 30 ぷん」) /
  2 ボタン (おやすみ する / もうすこし やる) で続行能動選択を担保
- 60 分 hard_limit: server-side gate ([data-testid="overlearning-hard-limit-gate"])
  で問題ページの入口を塞ぐ。コピーは「きょうは じゅうぶん / がんばったね」(祝福調)
- 保護者ダッシュボード「今日 X 分」可視化 (tone: neutral / warm / celebrate)
- learner_preferences.preferredSessionMinutes (5/7/10/null) 拡張で
  W10-T4 SessionPicker の「いつもの長さ」を cross-device 永続化

DEC-024 罰則ゼロ: streak は本実装が一切触らないため構造的に保全。
   罰語 (だめ / やりすぎ / ペナルティ) は unit + E2E 両方で not.toContain 化。
DEC-055 冪等性: UNIQUE INDEX (learner_id, client_session_id) +
   SQL MIN(cap, col + delta) で race-safe。
DEC-006 完全無料: 本タスクは課金導線ゼロ。

unit 603 PASS (+30) / typecheck clean / lint clean /
session_cumulative 2/2 + overtime_cumulative 1/1 E2E green.

Refs: DEC-058, DEC-024, DEC-006, DEC-055
```

### 次タスクへの申し送り

1. **W10 締め DEC** 起票時に「Phase 1 直リンク = cumulative tracking 無効、ただし server-side hard_limit gate は効く」を 1 行明記（M-1）
2. **W11 polish or β 直前**: `visibilitychange + navigator.sendBeacon` で heartbeat の最終 chunk 取りこぼし対応（M-2）
3. **Phase 3 β 拡大時の負荷監視**: `getTodayLearningSeconds` の SUM 集計が 100 行/日 を超え始めたらデノーマライズ案を再検討（M-3）
4. **本番 Turso 適用**: dev 報告通り `drizzle-kit push` または手動 SQL 流し込みで 0014 を本番反映（W10-T4 までと同手順）
5. **Production smoke**: 本番反映後、保護者ダッシュボードで「今日 0 ふん」表示が出ること + 学習者が 5 分以上学習後に 5 ふん前後で同期されることを 1 度オーナー手動確認推奨

---

レビュー部門 / 2026-04-30
