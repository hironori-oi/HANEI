# W11-T5 Weekly Digest Card 独立コードレビュー（PRJ-016 / DEC-063）

**レビュアー**: review (品質管理 / 独立判定者)
**日時**: 2026-05-02
**対象**: W11-T5 atomic / 保護者ダッシュボード Card 版 Weekly Digest（uncommitted）
**dev 報告**: `projects/PRJ-016/reports/dev-w11-t5-weekly-digest-card-done.md`
**atomic spec**: DEC-063

---

## 総合判定: **APPROVE**

CEO 既検証（typecheck PASS / lint warning 0 / vitest 715 / build 23 routes / E2E 20/20 PASS）に加え、独立コードレビューでも DEC-063 atomic spec を **すべて満たしている** ことを確認した。Critical 0 / Major 0 / Minor 2 / Nit 3。Minor / Nit はすべて W12 polish もしくは別 atomic 吸収可。push 阻害要因なし。

---

## レビュー範囲

新規 4 ファイル + 修正 1 ファイル:

| # | パス | 種類 | 行数 |
|---|---|---|---|
| 1 | `src/lib/study/family-weekly-digest-summary.ts` | 新規 / 純関数 | 296 |
| 2 | `src/lib/study/family-weekly-digest.ts` | 新規 / server-only helper | 144 |
| 3 | `src/app/(parent)/parent/dashboard/page.tsx` | 修正 / +123 / -0 | +123 |
| 4 | `tests/unit/study.family-weekly-digest-summary.test.ts` | 新規 / 32 ケース | 347 |
| 5 | `tests/e2e/family-weekly-digest.spec.ts` | 新規 / 4 ケース | 313 |

合計 +1223 行 / -0 行（リグレッション 0 のため既存ファイル削除なし）。

---

## 観点別評価サマリ

| 観点 | 結果 | コメント |
|---|---|---|
| A 設計・実装品質 | OK | 純関数 / server-only / Server Component 直 import の三層分離が W11-T1 / T3 と完全一致。`Promise.all` 並列 + per-task try/catch fallback が digest 全体を落とさない設計。`weekStartUtc` から ISO 週番号 + familyId codePoint sum mod 8 = 決定論的選択。Turbopack `"use server"` sync export ban を構造的に回避。 |
| B DEC-024 罰則ゼロ | OK | catalog 8 件すべて罰語ゼロ、3 分岐 streak コピー前向き、0 件 fallback 「来週から ...」前向き、ハードコード分も全て中立 / ねぎらい tone。罰語 grep 5 ファイルすべてヒット 0（コメント / 防御 regex / 防御 string array 内のメタ言及を除く）。 |
| C テスト | OK | unit 32 ケースが catalog / selectTopSkills / pickEncouragementCopy / describeFamilyStreakSummary / composeWeeklyDigestView の主要分岐 + 罰語不在 grep + 鳩ノ巣による異 week / 異 family の別 key 性質を網羅。E2E 2 シナリオ × 2 project = 4 で「解答ログ有り / 無し」両ケース + encouragement key catalog assert + 罰語不在を検証。SQLITE_BUSY 対策 (`mode: serial` + `execWithRetry` + `client.batch`) が W11-T3 / T2 と同水準。 |
| D セキュリティ・認可 | OK | 三層認可（`requireAuth + requireParent + requireFamilyMember`）が呼び出し元で完了済の前提を docstring に明記。新規 SQL 2 系統とも `learner_profiles.family_id = ?` で family scope を構造的に強制し、`inArray(answer_logs.learner_id, learnerIds)` で COPPA 漏洩経路を構造的に閉じている（DEC-003 / DEC-061 と同パターン）。Drizzle ORM safe API のみ使用。`requireLearnerOwner` は `Promise.all` 前に呼ばれており影響なし。 |
| E 周辺影響 | OK | 既存 `getFamilyStreak` / `getFamilyWeeklyLeaderboard` 戻り値構造は read-only 流用のみ（変更なし）。既存 `lib/notifications/weekly-digest.ts`（W6 F-1 email service）とパス分離（`lib/study/family-weekly-digest*`）で命名衝突なし。23 routes 不変 / 新規ルートなし。 |

---

## Issue 一覧

### Critical (push 阻害)

なし。

### Major (push 前修正推奨 / 後続吸収可)

なし。

### Minor (W12 polish 吸収可)

#### M-1: `weekStartUtc` 命名と実渡し値の意味ずれ（family-weekly-digest.ts L120-134）

`composeWeeklyDigestView` の入力型 `FamilyWeeklyDigestInput.weekStartUtc` は `/** JST 6:00 境界の週開始 UTC */` と定義されているが、helper は `cutoff = todayStartUtc - 6 days`（= 7 日 window の開始日）を渡している。これは「週の月曜日」ではなく「直近 7 日 rolling window の開始日」。

- 影響:
  - `pickEncouragementCopy` 内の `isoWeekOfYear(cutoff)` は ISO 週番号を返すため、`cutoff` が同一 ISO 週内にあれば同じ key を返す。実害なし（同一週内安定が崩れることは稀）。
  - ただし「ISO 週の月曜→金曜」を跨ぐ rolling cutoff がたまたま週境界を跨ぐ日には key が翌週用に切り替わる挙動になる（仕様の解釈次第で OK / 不良）。
- 推奨: 型コメントを「7 日 window の起点 UTC（rolling）」に更新するか、helper 側で「ISO 月曜の 0:00 UTC」を計算して渡す（後者は過剰最適化、前者を推奨）。
- 影響度: Minor / W12 polish 内で文言調整可（テスト変更不要）。

**ファイル**: `src/lib/study/family-weekly-digest.ts` L134, `src/lib/study/family-weekly-digest-summary.ts` L41
**推奨修正**: 型コメント `weekStartUtc` を `/** seed の週因子に使う UTC Date（7 日 window 起点でも ISO 月曜でも可） */` に書き換えるだけ。

#### M-2: E2E PUNISHMENT_WORDS と unit PUNISHMENT_REGEX の不一致

- unit (`tests/unit/study.family-weekly-digest-summary.test.ts` L24): `だめ`, `もう おそい` を含む 9 語。
- E2E (`tests/e2e/family-weekly-digest.spec.ts` L190-198): `だめ`, `もう おそい` を含まない 7 語。

catalog には両方とも不在のため実害は出ないが、防御 regex の語彙集合がずれているのは将来の罰語追加時に取りこぼしリスク。

- 推奨: 単一の `PUNISHMENT_WORDS` 定数を `tests/e2e/_helpers/punishment-words.ts` 等に抽出し unit / E2E で共有（W12 polish 範囲）。
- 影響度: Minor / 当面は実害なし。

**ファイル**: `tests/unit/study.family-weekly-digest-summary.test.ts` L24, `tests/e2e/family-weekly-digest.spec.ts` L190-198

### Nit (好み / 任意)

#### N-1: `family-weekly-digest-summary.ts` L184 のビット OR `| 0` が冗長

```ts
sum = (sum + (familyId.codePointAt(i) ?? 0)) | 0;
```
`familyIdSeed` は最後に `Math.abs(sum)` を返すので、桁落ち防止 / int32 整形の `| 0` は意味があるが、`Math.abs` で十分。可読性を優先するなら不要。

#### N-2: `composeWeeklyDigestView` 戻り値で `familyStreakDays` を再正規化

```ts
familyStreakDays: Math.max(0, Number.isFinite(input.familyStreakDays) ? Math.floor(input.familyStreakDays as number) : 0),
```
`describeFamilyStreakSummary` 内でも同等の正規化をしており重複。型レベルで `number` 保証を信じて helper 側の正規化に一本化してもよい（純関数の頑健性として現状でも妥当）。

#### N-3: dashboard `page.tsx` L391「直近 7 日の 家族の つみあげを まとめました」

leaderboard セクションでも同じ「直近 7 日の」「家族内のみ」キャプションが既に出ている（L301）。説明が二重化していて UX 上は冗長。card サブタイトルを「今週の ハイライトです」のように軽い tone にしてもよい。
- 影響度: Nit / DEC-024 違反なし、dev 判断尊重。

---

## 観点詳細評価

### A. 設計・実装品質

- **A-1 ✓**: `family-weekly-digest-summary.ts` (純関数 / DB I/O 0 / `"use server"` 一切なし) と `family-weekly-digest.ts` (server-only / `"use server"` directive なし / Server Component 直 import) の分離が W11-T1 / T3 / T2 の確立パターンに完全一致。Turbopack `"use server"` sync export ban の構造的回避を 5 度目の踏襲で達成。
- **A-2 ✓**: 新規 SQL 2 系統 (learner_profiles fetch + answer_logs JOIN) ともに `learnerProfiles.familyId = ?` で family を確定後 `inArray(answerLogs.learnerId, learnerIds)` を必須化し、COPPA 漏洩経路を構造的に閉じている (W11-T3 と同パターン)。
- **A-3 ✓**: `Promise.all([streak, leaderboard, topSkills])` 並列取得 + `getFamilyTopSkillsLast7Days` 内 `try/catch` で「top-skills 取得失敗 → 空配列 → digest は streak / leaderboard で継続」設計。digest 全体を落とさない (DEC-024 前向き fallback)。
- **A-4 ✓**: `pickEncouragementCopy(weekStartUtc, familyId)` は ISO 週番号 + familyId codePoint sum を 8 で mod した index で catalog から決定論的に選択。同一週・同一家族で安定、異週 / 異 family で別 key 候補は鳩ノ巣で unit test が保証 (32 ケース)。
- **A-5 ✓**: dashboard page.tsx の Promise.all 配列拡張 (8 → 9 entry) は既存 helper と完全に同じ引数規約 (`familyId` のみ) で型安全性も維持。

### B. DEC-024 罰則ゼロ哲学（最重要）

- **B-1 ✓**: `ENCOURAGEMENT_COPIES` 8 件すべて罰語不在。catalog 自体に NG 語が無いため、`pickEncouragementCopy` が何を返しても罰語は構造上発生し得ない (= DEC-024 の構造的保証)。
- **B-2 ✓**: `describeFamilyStreakSummary` 3 分岐 (0 days / N days alive / N days dead) すべて前向きコピー。罰語 grep 0 hit (8 ケース網羅 unit assert あり)。
- **B-3 ✓**: top-skills 0 件 fallback 「来週から 単元別の つみあげが 集まっていきます」前向き。
- **B-4 ✓**: 各子 XP ミニリストで 0 XP の learner にも特別な負メッセージはなく、`{nickname} 0 XP` を中立表示。レイアウト（同枠 / 同色）で差別化なし。
- **B-5 ✓**: dashboard page.tsx 内で W11-T5 で追加された全テキスト（h2「今週の ハイライト」/ subtitle / 各セクション見出し / fallback コピー / 「励まし コピーは 同じ 週は 安定して 同じ 文を 出します」付記）すべて前向きハードコードまたは catalog 経由のみ。
- **罰語 grep 5 ファイル全件**: ヒット 0（コメント内のメタ言及 / regex / 防御 string array を除く）。

### C. テスト品質

- **C-1 ✓**: unit 32 ケースが以下を網羅:
  - `ENCOURAGEMENT_COPIES`: 件数 8 / copy 非空 / key unique / 罰語不在 grep
  - `selectTopSkills`: 0/1/2/3/4+ 件 / 同数タイ skillId 昇順安定 / 非配列 throw / 負値受容 / limit 明示
  - `pickEncouragementCopy`: 同一週同一 family 決定論性 / 異 week 別 key / 異 family 別 key / catalog 整合 / 不正 Date / 非文字列 throw
  - `describeFamilyStreakSummary`: 0/1/5/100 days × alive 真偽 / 負値・NaN / 全分岐罰語不在 grep
  - `composeWeeklyDigestView`: 通常 / 全員 0 XP / 単独 / 0 名 / topSkills 5→3 絞込 / streak 0+!alive / 非 object throw / leaderboard rank 順伝搬
- **C-2 ✓**: E2E 2 シナリオ × 2 project = 4 ケースが「解答ログ有り family」「解答ログ無し family」両方を覆い、罰語不在 + encouragement key catalog 整合 assert を実装。
- **C-3 ✓**: `test.describe.configure({ mode: "serial" })` (L223) + `execWithRetry` (L55-69) + `client.batch` (L136-141) が family-leaderboard.spec.ts / family-message.spec.ts と同水準で適用済み。

### D. セキュリティ・認可

- **D-1 ✓**: `family-weekly-digest.ts` docstring (L102-106) で「呼び出し元で requireParent / scopedQueries 済」「本関数は SQL レベルで family_id = ? を強制」を明記。
- **D-2 ✓**: 新規 SQL は drizzle ORM の `eq` / `and` / `inArray` / `gte` / `desc` / `sql<T>` の安全な使い方のみ。raw SQL 文字列補間なし、injection 経路なし。`drizzleSql<number>` COUNT(*) は alias `as("answer_count")` 込みで Drizzle が安全に bind。
- **D-3 ✓**: dashboard page.tsx L127 `await requireLearnerOwner(session.userId, learner.id)` は Promise.all (L139) より前に実行済。新規 weekly digest ロードはこれの後に走るため認可ガードに影響なし。

### E. 周辺影響

- **E-1 ✓**: `getFamilyStreak` (戻り値 `{ days, isAlive }`) と `getFamilyWeeklyLeaderboard` (戻り値 `RankedWeeklyXpRow[]`) を read-only 流用するのみ。両戻り値型の変更なし。
- **E-2 ✓**: 既存 dashboard セクション（today-learning / family-streak / family-leaderboard / weekly-summary / exam-countdown / inactivity-reminder / recent-mistakes）はすべて DOM 構造不変。新規 section を leaderboard と weekly-summary の間に挿入のみ。
- **E-3 ✓**: 既存 `lib/notifications/weekly-digest.ts`（W6 F-1 email service）とは `lib/study/family-weekly-digest*` で完全に分離。命名衝突 / 重複ロジックなし。

---

## 結論

- **判定**: **APPROVE**
- **件数**: Critical 0 / Major 0 / Minor 2 / Nit 3
- **push 可否**: 即可（CEO による atomic commit + push に進んで問題なし）
- **後続吸収プラン**:
  - M-1（型コメント微修正）/ M-2（罰語 word list 共有抽出）: W12 polish 範囲で吸収可。実害なし。
  - N-1〜N-3: 任意。dev 判断尊重。
- **DEC-063 atomic 完遂判定**: **満たす**（受入基準 typecheck / lint / vitest ≥ 698 / build 23 routes / E2E ≥ 20 / DEC-024 厳守 / DEC-006 / DEC-003 / DEC-055 / DEC-061 / DEC-062 厳守 すべて確認）。
- **W11 atomic 進捗**: T1 ✓ / T2 ✓ / T3 ✓ / T5 ✓（4/5）= 80%。残 T4 (Daily Push 通知) はオーナー設定待ち。
- **DEC-024 罰則ゼロ哲学**: catalog pre-curated + 純関数決定論選択の二段構えで構造的に保証され、罰語混入経路がコード上存在し得ない。HANEI USP の品質基盤として模範実装。

push GO。
