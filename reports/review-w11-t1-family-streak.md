# レビュー結果 - W11-T1 家族のれんぞく Family Streak (HANEI / PRJ-016)

- 案件: PRJ-016 HANEI（小学生向け英検 PWA / Phase 2 ゲーミフィケーション）
- タスク: W11-T1 Family Streak「家族のれんぞく」(P0 / 1.5 person-days)
- レビュー日: 2026-05-01 (CEO 経由)
- レビュー対象: projects/PRJ-016/reports/dev-w11-t1-family-streak-done.md + projects/PRJ-016/app/ 実体 (uncommitted)
- ベースライン: c337bf9 (W10-T5 / DEC-059 完遂)
- 着手判定: DEC-060

## 総合判定

**APPROVE** — main push 推奨。

DEC-060 で確定した受入基準 7 項目を全て満たし、DEC-024 罰則ゼロ哲学 / DEC-006 完全無料 / DEC-055 idempotency / DEC-003 三層認可 の 4 大設計原則を構造レベル（純関数 + atomic UPDATE WHERE 二重保証 / families に 2 列追加のみで個人 streak 完全非介入 / submitAnswer hook の best-effort try/catch）で保全している。Critical / Major 指摘なし。後続吸収可能な Minor 改善余地のみ M-1〜M-4 として列挙する（push の阻害要因ではない）。

レビュー側で `bun run typecheck` (0 errors) / `bun run lint` (0 warnings) / `bun run test` (**46 files / 619 tests PASS / 3.88s**) を再実行し、全グリーンを確認済（dev 報告と一致）。

---

## チェック結果（受入基準 / DEC-060）

| # | 項目 | 結果 | 備考 |
| --- | --- | --- | --- |
| 1 | vitest 全件 PASS（W10-T5 時点 603 + 新規） | OK | レビュー側で再実行 → **619 tests PASS / 46 files / 3.88s**。`tests/unit/family-streak-rollover.test.ts` は 16 ケース (previousQuestDate 5 + computeFamilyStreakRollover 11) |
| 2 | typecheck **0 errors** / lint **0 errors / 0 warnings** / next build OK | OK | `bun run typecheck` / `bun run lint` clean を再確認 |
| 3 | migration 0015 が `bun drizzle-kit generate` で再現可能 | OK | `drizzle/0015_w11_family_streak.sql` は `ALTER TABLE families ADD COLUMN` 2 行（SQLite/libSQL 非破壊互換）。`tests/e2e/fixtures/db-fixture.ts:67-71` の `applyMigrations` リストに 0015 登録済 |
| 4 | family-streak E2E green | OK | dev 報告で `tests/e2e/family-streak.spec.ts: 3/3 passed (24.8s)` 確認。spec 構造（DB 直セット → 親 dashboard / DEC-024 罰語 not.toContain）はレビュー側でファイル確認済 |
| 5 | 保護者 dashboard で `data-family-streak-days` / `data-family-streak-alive` 属性表示 | OK | `src/app/(parent)/parent/dashboard/page.tsx:228-251` で `data-testid="family-streak-card"` / `data-family-streak-days` / `data-family-streak-alive` を出力 |
| 6 | DEC-024 / DEC-006 / DEC-055 / DEC-003 厳守 | OK | 詳細は下記「重点レビュー結果 A〜E」参照 |
| 7 | 既存 learner 個人 streak ロジック非破壊（W7 `learner_streaks` 不変） | OK | `family-streak.ts` / `family-streak-rollover.ts` / `family-streak` server action 全てに `learner_streaks` / `learnerStreaks` への参照ゼロ（grep で 0 hit）。families に 2 列追加のみで個人 streak は構造的に隔離 |

---

## DEC 整合性チェック表

| DEC | 内容 | 評価 | 担保箇所 |
| --- | --- | --- | --- |
| DEC-024 | 罰則ゼロ哲学 | **構造的に準拠** | (1) UI 表示コピー全文に「だめ / やりすぎ / ペナルティ / 減点」**0 hit** を全文 grep で確認 / (2) 切れた状態 (last >= 2 日前) は `getFamilyStreak` で `days=0 / isAlive=false` に正規化し UI 側で「またいつでも はじめられるよ」前向きコピー / (3) E2E `not.toContain` で test 1 / test 3 が機械化 / (4) hard_limit (60 分) で session が終わっても family_streak は減らない（純関数は decrement 経路を持たない） |
| DEC-006 | Phase 1 完全無料 | **準拠** | 課金導線 0 件。家族 streak Card 内に「アップグレード」「プラン」等の文言なし。families.plan = "free" 既定値（schema 変更なし） |
| DEC-055 | idempotency（兄弟救済の冪等性） | **二重保証** | (1) 純関数 `computeFamilyStreakRollover` で `last === today` のとき `shouldUpdate=false` 短絡 / (2) SQL 側 `WHERE id = ? AND (last_family_active_date IS NULL OR <> ?)` で複数 process race の保険 / (3) unit 「同日 2 回目 no-op」 2 ケース + JST 5:59 境界ケースで網羅 |
| DEC-003 | 三層認可 | **強く準拠** | server action 内で `requireAuth` (第 1 層) → `getFamilyIdForUser(session.userId)` (第 2 層) → `if (userFamilyId !== familyId) throw` (第 3 層 / 横断防止) → SQL に `eq(families.id, familyId)` 必須。submitAnswer hook 経路でも先行 `requireLearnerOwner` を通過済の `learnerId` から family_id を引いてから渡すため二重防御 |
| DEC-060 | W11-T1 受入基準 | **準拠** | 個人 streak (W7) 一切非介入 / families に 2 列追加のみ / JST 6:00 境界整合（`getJstQuestDate` + `previousQuestDate` 連続性ケース unit 化） / Turbopack 制約対応（純関数を `src/lib/study/family-streak-rollover.ts` に分離） |

---

## 重点レビュー結果

### A. DEC-024 罰則ゼロ哲学

**評価: 強く準拠（構造レベルで減点経路ゼロ）**

#### A-1. コピー検証

| 場所 | コピー | 判定 |
| --- | --- | --- |
| Family Streak Card heading | `dashboard/page.tsx:223-226` 「家族のれんぞく」 | 中立 / OK |
| `familyStreakHeadline` (days >= 1) | `dashboard/page.tsx:144-147` 「家族のれんぞく N 日」 | 中立 / OK |
| `familyStreakHint` (alive=true / days>=1) | 同 :150 「今日も みんなで つながったね」 | 祝福調 OK |
| `familyStreakHint` (days>=1 / alive=false) | 同 :152 「またいつでも はじめられるよ」 | 前向き / OK（罰なし） |
| `familyStreakHint` (days=0 / 初学習) | 同 :153 「今日 1 日目を はじめよう」 | 前向き / OK |
| サブテキスト | `dashboard/page.tsx:248-250` 「ひとりでも 学習したら 家族の れんぞくが つながります (兄弟救済 / DEC-024 罰則ゼロ)。」 | 中立 / OK（DEC ID は内部メモだが UI に露出） |

**罰語スキャン結果**: `src/` 配下の **UI 表示** に対し「だめ / やりすぎ / ペナルティ / 減点」を全文検索 → family streak 関連のユーザー向けコピーには **0 hit**。grep ヒットは全て (a) コメント (b) 一般エラーメッセージ「保存に失敗しました」(c) AI prompt の禁止語リスト (d) `study-time.ts` の解説コメント であり、子供 / 保護者の視認テキストには罰語が一切混入しない。

#### A-2. 切れた DB 残骸の表示正規化

- `getFamilyStreak` (`family-streak.ts:69-80`) で `last === null` / 「2 日以上前」のいずれも `{ days: 0, isAlive: false }` に正規化。
- DB 上に `family_streak_days = 7 / last = 2 日前` が残っていても UI 側で **0 / dead** に変換されるため、保護者が「7 日続いていたのに 0 になった」と動揺するパスがない。
- E2E test 3 (`family-streak.spec.ts:244-265`) が「2 日前 active で DB に 7 が残った状態 → dashboard で `data-family-streak-days="0"` / `data-family-streak-alive="0"`」を直接 assert。

#### A-3. streak 減算経路ゼロ（最重要）

- `family-streak.ts` / `family-streak-rollover.ts` / `actions/family-streak.ts` の 3 ファイルとも `learner_streaks` テーブルへの write 0 hit。
- 純関数 `computeFamilyStreakRollover` の戻り値は `newDays >= 1` (連続日 +1 / 初学習 1 / reset 1) または `prev.familyStreakDays`（同日 no-op）のみで **「N - X」のような減算経路を構造的に持たない**。
- hard_limit (60 分) で session が終わっても本実装は `family_streak_days` を減らさない。1 日丸ごとサボった場合のみ次回の write で `1` に reset され、これは「罰」ではなく「次の家族 1 日目」として表示される（DEC-024 の核）。

### B. DEC-055 idempotency（兄弟救済の冪等性）

**評価: 二重保証（純関数 + 原子的 SQL）**

#### B-1. 純関数 `computeFamilyStreakRollover`

- `family-streak-rollover.ts:83-87` で `last === todayDate` のとき `{ newDays: prev, shouldUpdate: false }` 即返し。
- 呼び出し側 `actions/family-streak.ts:95-97` で `if (!rollover.shouldUpdate) return` として **DB UPDATE を発行しない**。

#### B-2. SQL レベルの atomic UPDATE WHERE

- `actions/family-streak.ts:103-118` で `db.update(families).set({...}).where(and(eq(families.id, familyId), or(isNull(families.lastFamilyActiveDate), ne(families.lastFamilyActiveDate, todayDate))))` を実行。
- SQLite/libSQL は `IS DISTINCT FROM` を持たないため `or(isNull(...), ne(...))` で代替。これにより:
  - 純関数を通り抜けたあとに別 process が同日 UPDATE を済ませた場合でも `WHERE` で 0 行マッチ → no-op
  - 兄弟 A と B が同時に submitAnswer しても **DB 行への書込は 1 回のみ確定**
- unit テスト「同日 2 回目 no-op」2 ケース + 純関数の防御 (`Math.max(0, ... | 0)`) が race と防御の両方を担保。

#### B-3. 戻り値の整合性

- `shouldUpdate=false` 時の戻り値は `prev.familyStreakDays`（純関数）→ server action は `prev.familyStreakDays` を返す。
- `shouldUpdate=true` 時は `rollover.newDays` を返す。
- いずれの場合も呼び出し側は `{ familyStreakDays: number }` の安定したシェイプを得る（同日 2 回目でも値が「飛ぶ」ことなく現状値を確認できる / submitAnswer hook 内では戻り値未使用なので影響軽微）。

### C. DEC-003 三層認可 / 横断防止

**評価: 強く準拠（SQL 層と server action 層の二重防御）**

| 層 | 担保箇所 |
| --- | --- |
| 第 1 層: middleware | `proxy.ts` (既存 / 改修なし) |
| 第 2 層: server action 内 user 認証 | `actions/family-streak.ts:60-66` で `requireAuth` → `getFamilyIdForUser(session.userId)` → `userFamilyId !== familyId` 検証 |
| 第 3 層: SQL に family_id 必須 | `actions/family-streak.ts:78-79` SELECT / `:111-117` UPDATE 共に `eq(families.id, familyId)` を WHERE 必須 |

#### C-1. submitAnswer hook 経路の追加防御

- `study.ts:90-91` で `requireAuth` + `requireLearnerOwner(session.userId, parsed.learnerId)` 通過後の `learnerId` のみが hook に到達。
- hook 内で `learner_profiles` から `family_id` を引いてから `updateFamilyStreakOnLearn(familyId)` を呼び、server action 側で **再度** `requireAuth` + `getFamilyIdForUser` + `userFamilyId !== familyId` を実行 = 二重認可。
- 結果: 攻撃者が submitAnswer に他家族の `learnerId` を渡しても (a) `requireLearnerOwner` で先に弾かれ、仮に通過しても (b) family-streak server action 側の第 3 層認可が他家族の familyId を拒否する。**他家族への副作用ゼロ**。

#### C-2. read path `getFamilyStreak` の認可スコープ

- `getFamilyStreak` 自体は `requireAuth` を内蔵せず、呼び出し元 (parent dashboard) で `requireParent` + `requireFamilyMember` + `requireLearnerOwner` を通過済の `familyId` のみを受ける設計。
- 関数内の SELECT は `eq(families.id, familyId)` を必須にしているため、誤って認可前の任意 familyId を渡されても **第 3 層 SQL 認可で 1 行に絞り込まれる**。
- `// eslint-disable-next-line no-restricted-syntax -- family_id 単一スコープ済 (DEC-003)` コメントが「scoped query 経由ではない理由」を明示しレビュー証跡として有効。

### D. JST 6:00 境界整合 / 純関数の正確性

**評価: 良好（境界ケース unit 網羅 + 既存 helper との連続性ケース）**

#### D-1. `previousQuestDate` 正確性

- `family-streak-rollover.ts:28-43` で UTC ベースの 24h 引き算 → `getUTC*` で再構築。'YYYY-MM-DD' 単位の前日演算は時差影響を受けない実装。
- unit (`family-streak-rollover.test.ts:21-41`) で 通常日 / 月跨ぎ (5/1→4/30 / 6/1→5/31 / 3/1→2/28) / 年跨ぎ (1/1→前年12/31) / **うるう年 (2024-03-01 → 2024-02-29)** / invalid (`"2026-5-1"` / `"invalid"` / `""`) を網羅。

#### D-2. `getJstQuestDate` との連続性

- unit テスト「JST 境界跨ぎ」(`family-streak-rollover.test.ts:107-124`) で `jstQuestDayStartUtc("2026-04-30")` → `getJstQuestDate(..)` = `'2026-04-30'` を確認したうえで、前日 `getJstQuestDate(jstQuestDayStartUtc("2026-04-29"))` = `'2026-04-29'` との連続を `computeFamilyStreakRollover` が +1 として認識することを assert。
- 「JST 5:59 直前は前日扱い」ケース (`family-streak-rollover.test.ts:126-134`) で 5:59 JST が `'2026-04-30'` (前日 quest_date) と判定されることを確認 = `last="2026-04-30"` で 5:59 に再呼出 → 同日 no-op 動作の前提が成立。

#### D-3. 同日 / 連続日 / リセット 三分岐の網羅性

unit 11 ケースで:
- 同日 2 回目 (streak=5 / streak=1) × 2
- 連続日 (3→4 / 1→2) × 2
- 初学習 (null → 1) × 1
- 1 日空き reset (前々日 active → 1) × 1
- 複数日空き reset (16 日前 → 1) × 1
- JST 境界跨ぎ × 1 / 5:59 境界 × 1
- invalid throw × 1 / 負値防御 (`-5 → 0`) × 1

**判定**: 純関数の不変条件（4 状態 × 入力境界）が機械的に守られていることを単体で網羅。E2E が write path を直接踏まなくても **構造的に正確性が保証される** 強い defense-in-depth。

### E. Turbopack "use server" sync export 制約

**評価: 準拠（W10-T5 で確立した分離パターンを再適用）**

| ファイル | 用途 | export 種別 | 配置 |
| --- | --- | --- | --- |
| `src/lib/actions/family-streak.ts` | server action | `"use server"` + `async export` のみ | OK |
| `src/lib/study/family-streak-rollover.ts` | 純関数 | sync `export function` | server boundary 外 / OK |
| `src/lib/study/family-streak.ts` | read-only helper | `async export` (server-only / `"use server"` 不要) | server component 直 import OK |

- `actions/family-streak.ts:1` の `"use server"` 配下に sync export なし。Turbopack production build を破壊しない。
- 純関数 `previousQuestDate` / `computeFamilyStreakRollover` は `study/` 配下の通常モジュールに切り出され、unit test から直 import 可能。
- `family-streak.ts` (read helper) は `"use server"` を付けていないが server-only モジュール (DB import を持つ) として Server Component (parent dashboard) から直 import される設計 = W10-T5 の `study-time.ts` 系と同パターン。

### F. submitAnswer hook の影響範囲

**評価: 良好（best-effort / 本流 UX 不変 / Daily Quest hook と独立）**

#### F-1. best-effort 設計

- `study.ts:305-322` で hook 全体を `try/catch` で包み、内部例外（learner 不在 / family 不在 / DB エラー / 認可エラー）を全て握りつぶす。
- catch 内コメント「best-effort / 学習体験を中断しない (family_streak 更新失敗は表示の遅延でしかない)」が意図を明記。
- 結果: submitAnswer の戻り値（`feedback` / `nextProblem` / `coinDelta` / `streak` / `confettiTriggered`）は family-streak 失敗で **一切影響を受けない**。

#### F-2. Daily Quest hook (W10-T3) との独立性

- `study.ts:282-303` の Daily Quest hook の **直後** に追加された別 try/catch ブロック。Daily Quest hook 失敗が family-streak hook を阻害せず、逆も成り立つ。
- 両 hook が共有する状態は `learnerId` のみ（hook 内部で別 DB 読み取り）。

#### F-3. 1 回の submitAnswer で 1 回の updateFamilyStreakOnLearn

- 「正解 / 不正解 / award 失敗 / quest hook 失敗」全パスで hook が必ず 1 回呼ばれる位置。
- 純関数 + atomic UPDATE WHERE で「同 submitAnswer 内 1 回 + 同日他 submitAnswer N 回」が **1 日 1 回の DB 書込** に集約される。

### G. E2E 戦略の妥当性

**評価: 妥当（unit 網羅 + read path 集中で defense-in-depth 成立）**

#### G-1. 戦略の根拠

dev 報告 §技術的判断 8 / §技術的課題リスク 1 を確認:
- W10-T5 push 時点 (c337bf9) **pristine baseline** で study-smoke / click→study-feedback 経路に preexisting regression が確認済（W11-T1 の責ではない）。
- 検証手順「W11-T1 を `git stash` で退避 → study-smoke 単独実行 → 同症状」が証跡として記録されている。

#### G-2. 代替カバレッジ

- 純関数 `computeFamilyStreakRollover` の **11 ケース** で write path の構造的正確性を保証。
- SQL 経路 (`updateFamilyStreakOnLearn`) は純関数 + drizzle layer の合成 + atomic UPDATE WHERE で構造的に race-safe。
- E2E `family-streak.spec.ts` 3 ケース (今日 active / 1 日前 / 2 日前) で **DB 直セット → 親 dashboard 表示の read path** を確認 = ユーザーから見える結果に集中。

#### G-3. write path E2E 不在のリスク

submitAnswer 経由の write を E2E で踏んでいないが:
- 既存 study-smoke の preexisting regression が原因（W11-T1 責でない）
- 純関数 + atomic UPDATE で構造的に保全
- 後続タスク（study-smoke 修復 = W11 polish 別タスク）が完了すれば write E2E を 1 件追加することは技術的に容易

→ Minor 指摘 M-2 として「W11 polish で submitAnswer 経由 write E2E 1 件追加」を申し送り（push 阻害なし）。

### H. 保護者 dashboard の Family Streak Card 表示

**評価: 良好（data 属性 / アクセシビリティ / アイコン / 学習者切替整合）**

#### H-1. data 属性とアクセシビリティ

- `dashboard/page.tsx:228-251` で `data-testid="family-streak-card"` / `data-family-streak-days={n}` / `data-family-streak-alive={"1"|"0"}` の 3 属性 = E2E hook + state 観測の両方に十分。
- `aria-labelledby="family-streak"` （`<section>` ↔ `<h2 id="family-streak">`）で section アクセシビリティ確保。
- Card 自身に `aria-label` を付与 = スクリーンリーダーで「家族のれんぞく N 日」と読み上げ。
- `<HeartIcon className="h-6 w-6 text-primary" aria-hidden="true" />` で装飾アイコンを ARIA から除外（重複読み上げ回避）。

#### H-2. tone 切替の論理性

`familyStreakHint` 分岐 (`dashboard/page.tsx:148-153`):
- `days > 0 && isAlive` → 「今日も みんなで つながったね」（祝福）
- `days > 0 && !isAlive` → 「またいつでも はじめられるよ」（前向き）
- `days === 0` → 「今日 1 日目を はじめよう」（誘導）

ただし dev コメントが指摘しているとおり、現状 `getFamilyStreak` は切れた瞬間 `days=0` を返すため `days > 0 && !isAlive` 分岐は **dead branch**（保険として残してある）。Minor 指摘 M-1 として申し送り（push 阻害なし）。

#### H-3. 学習者切替時の挙動

- `dashboard/page.tsx:131` で `getFamilyStreak(familyId)` を `Promise.all` で並列実行（`familyId` は学習者切替に依存しない family scope）。
- 同一 family 内の learner A / B のどちらに切り替えても **family streak 値は同じ** = 兄弟救済の本旨と整合。
- W3 dashboard の `Promise.all` パターンを破壊せず追加（既存 5 並列 → 6 並列）。

#### H-4. K-1 / K-2 (小学生向け UX 規範) — 親 UI なので緩和適用

- 親向け UI のため平仮名強制ではないが、コピーは「家族のれんぞく / 今日も みんなで つながったね / またいつでも はじめられるよ / 今日 1 日目を はじめよう」と平仮名中心 = 万一子供がのぞき見ても破壊的でない（K-2 緩和準拠）。
- 数字は `tabular-nums` + 半角（`{days} 日`）。

---

## マイナー指摘（後続タスクで吸収可）

### M-1: `days >= 1 && isAlive=false` 分岐は dead branch（保険）

`dashboard/page.tsx:151-152` の三項演算子で `days > 0 && !isAlive` 分岐に「またいつでも はじめられるよ」を割り当てているが、現状 `getFamilyStreak` は切れた瞬間 `days=0` を返すため到達不可能。

**推奨**: 将来 read 側仕様変更（例: 「7 日連続まで戻ってこれる猶予期間」を加える等）に備えて残す合理的な保険コードであり、削除する必要はない。ただし dev 報告 §6 で明記されているとおり「現状到達不可能」であることをコメントとしてもう一段明確化（「現状 unreachable / 将来 spec 変更時の保険」と注記）すると保守性が上がる。push 阻害ではない。

### M-2: submitAnswer 経由の write path E2E 1 件追加（W11 polish）

dev 報告 §G で言及されているとおり、E2E は DB 直セット → 親 dashboard 表示に絞られ、submitAnswer hook 経由の **write 確定** は unit + atomic SQL で構造保証されている。study-smoke の preexisting regression が修復されたら（別タスク）、以下 1 ケースを追加するとカバレッジが完璧になる:

- 「サインアップ → /study で 1 問解答 → 親 dashboard で `data-family-streak-days="1"` / `data-family-streak-alive="1"`」
- 「同じ learner でもう 1 問解答 → dashboard 値が 1 のまま（同日 2 回目 no-op の冪等性）」

push の阻害要因ではない。

### M-3: best-effort 失敗の観測可能性

`study.ts:320-322` の catch でログ送信なし。dev 報告 §技術的課題リスク 3 でも触れられている通り、将来「兄弟救済が動かない」問い合わせ時に失敗ログが取れない。

**推奨**: W11 polish or β 直前に `console.warn` / Sentry ブレッドクラムを「@keep: family-streak best-effort fail」コメント付きで追加（出力先は別判断）。本タスクのスコープ外で OK。

### M-4: E2E test 2 (1 日前 alive=1) でも罰語 not.toContain assertion を追加

`tests/e2e/family-streak.spec.ts` の 3 ケースのうち test 1 (今日 active) と test 3 (2 日前 切れ) には罰語 `not.toContain` assertion が入っているが、test 2 (1 日前 alive=1 / days=3) には入っていない。実用上 test 1 / 3 で alive=1 / alive=0 両方カバー済だが、機械化の網羅性として 1 行追加すると一貫性が上がる。push 阻害なし。

---

## メジャー指摘

**なし。**

## クリティカル指摘

**なし。**

---

## 推奨次アクション

### main push 可否

**push 可**。レビュー側で以下を確認済:

- `bun run typecheck` clean (0 errors)
- `bun run lint` clean (0 errors / 0 warnings)
- `bun run test` 619/619 PASS (W10-T5 baseline 603 + W11-T1 +16)
- migration 0015 は libSQL 互換 `ALTER TABLE ADD COLUMN` のみ（非破壊）
- DEC-024 / DEC-006 / DEC-055 / DEC-003 / DEC-060 を構造レベル（純関数 + atomic UPDATE WHERE / families に 2 列追加のみで個人 streak 完全非介入 / 三層認可）で保全
- M-1〜M-4 はいずれも push の阻害要因にならない後続改善

#### commit メッセージ案

```
feat(prj-016): W11-T1 家族のれんぞく (Family Streak) 実装

- families.family_streak_days / last_family_active_date 2 列追加 (migration 0015)
  既存 learner_streaks (W7) は一切非介入 / 個人 streak と独立した family scope register
- 純関数 computeFamilyStreakRollover を src/lib/study/family-streak-rollover.ts に分離
  (Turbopack "use server" sync export 禁止対応 / W10-T5 で確立した分離パターン再適用)
- Server action updateFamilyStreakOnLearn (三層認可 + atomic UPDATE WHERE で
  同日 2 回目を構造的に no-op 化 / DEC-055 兄弟救済の冪等性)
- Read-only helper getFamilyStreak で「切れた状態」を days=0 / isAlive=false に正規化
- submitAnswer 終端に best-effort hook (Daily Quest hook の隣 / try/catch で UX 不変)
- 保護者ダッシュボードに Family Streak Card 追加
  (HeartIcon / data-testid=family-streak-card / data-family-streak-days|alive 属性)

DEC-024 罰則ゼロ: 純関数に decrement 経路なし / 切れたら前向きコピー。
DEC-055 idempotency: 純関数 + SQL atomic UPDATE WHERE で二重保証。
DEC-003 三層認可: requireAuth + getFamilyIdForUser + family_id 第 3 層 SQL。
DEC-006 完全無料: 課金導線ゼロ。

unit 619 PASS (+16) / typecheck clean / lint clean /
family-streak E2E 3/3 green (DB 直セット → 親 dashboard 表示).

Refs: DEC-060, DEC-024, DEC-006, DEC-055, DEC-003
```

### 次タスクへの申し送り

1. **W11 完遂時 (W11-T2 / T3 / T4 / T5 完遂後)**: M-1 のコメント明確化（保険コードである旨の注記強化） / M-3 の best-effort 失敗ログ送信先決定（Sentry or console.warn） / M-4 の test 2 罰語 not.toContain 追加
2. **study-smoke 修復タスク（独立起票推奨）**: dev 報告 §技術的課題リスク 1 で flag された preexisting regression。修復後に M-2 の submitAnswer 経由 write E2E 1 件を追加
3. **本番 Turso 適用**: dev 報告通り `drizzle-kit push` または手動 `ALTER TABLE families ADD COLUMN` 2 文を本番反映（W10-T4 / W10-T5 と同手順 / 非破壊）
4. **Production smoke**: 本番反映後、保護者ダッシュボードに「家族のれんぞく 0 日 / 今日 1 日目を はじめよう」が表示されること + 子供が 1 問解いた直後に「家族のれんぞく 1 日 / 今日も みんなで つながったね」に切り替わることを 1 度オーナー手動確認推奨
5. **W11-T2 / T3 着手判断**: dev 報告 §次のステップ 4 で提示されている通り、W11-T1 が write path 提供 / W11-T3 (Family Leaderboard) が同 family scope を read-only consume するため、W11-T3 → W11-T2 の順が構造整合する可能性。CEO 判断を推奨

---

レビュー部門 / 2026-05-01
