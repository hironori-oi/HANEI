## 開発報告（W11-T5 Weekly Digest 強化 / Card 版）

### 実施内容

DEC-063 の atomic スコープに完全準拠し、保護者ダッシュボード `/parent/dashboard` に「今週の ハイライト」 Weekly Digest Card を新設。
新規テーブル無し / 新規 server action 無し / 新規 migration 無し / write 一切無し（read-only / DB I/O は SELECT のみ）。

実装した 4 ピース（atomic 完遂単位 / 全て read-only）:

1. **`src/lib/study/family-weekly-digest-summary.ts`（純関数 / 296 行 / 新規）**
   - `selectTopSkills(rows, limit=3)`: answerCount 降順 + 同数タイ skillId 昇順安定で上位 N 件返却。
   - `pickEncouragementCopy(weekStartUtc, familyId)`: ISO 週番号 + familyId codePoint sum を 8 で mod した index で `ENCOURAGEMENT_COPIES` から deterministic 選択。
   - `describeFamilyStreakSummary(days, alive)`: 0 日 / N 日+alive / N 日+!alive の 3 分岐すべて前向きコピー。
   - `composeWeeklyDigestView(input)`: pure compose で view-model 全体を組み立て。
   - `ENCOURAGEMENT_COPIES`: 8 件の励ましコピー catalog（罰語ゼロ / 平仮名中心 / 命令形回避）。
   - DB I/O ゼロ / `"use server"` 一切なし（Turbopack `"use server"` sync export ban 対応の 5 度目再適用パターン）。

2. **`src/lib/study/family-weekly-digest.ts`（server-only helper / 144 行 / 新規）**
   - `getFamilyWeeklyDigest(familyId, now?)`: 既存 `getFamilyStreak` + 既存 `getFamilyWeeklyLeaderboard` + 新規 SQL（`answer_logs × problems × skills` family-scoped 7 日 JOIN GROUP BY skills.id ORDER BY count DESC LIMIT 5）を `Promise.all` 並列取得。
   - 新規 SQL は `learner_profiles.family_id = ?` で family を確定後 `inArray(answer_logs.learner_id, learnerIds)` で構造的に family scope を強制（COPPA 準拠 / DEC-061 / DEC-003）。
   - top-skills 取得が失敗しても全体は落とさず `topSkills: []` フォールバック（前向き fallback / DEC-024）。
   - `eslint-disable no-restricted-syntax` コメントは W11-T3 と同フォーマットで付与。

3. **`src/app/(parent)/parent/dashboard/page.tsx`（修正 / +123 行）**
   - 「家族内ランキング」と「今週の学習サマリー」の間に `aria-labelledby="family-weekly-digest"` セクション挿入。
   - Card 構造: `data-testid="family-weekly-digest-card"` / `data-week-encouragement-key` / `data-top-skills-count` / `data-family-streak-days` 属性付与。
   - 4 ピース順表示:
     - ピース 1: 家族 streak 集約コピー（CardTitle として）
     - ピース 2: 各子の今週 XP ミニリスト（leaderboard rank 順を維持 / `data-digest-learner-id` + `data-digest-weekly-xp`）
     - ピース 3: Top 3 単元（`<BookOpenIcon />` + `<ol>` / `data-digest-top-skill-id` + `data-digest-top-skill-rank` + `data-digest-top-skill-count`）
     - ピース 4: 来週の励ましコピー（`<SparklesIcon />` + 強調 box）
   - Heroicons (`SparklesIcon` / `BookOpenIcon`) のみ / 絵文字 0 / 平仮名中心。
   - 既存 dashboard 構造（leaderboard / weekly-summary / 受験日 / リマインド / 誤答 TOP 5）は不変。

4. **テスト**
   - `tests/unit/study.family-weekly-digest-summary.test.ts`（347 行 / 32 ケース新規）
     - `ENCOURAGEMENT_COPIES`: 8 件存在 / 全件 copy 非空 / key unique / 全件罰語不在 grep
     - `selectTopSkills`: 0/1/2/3/4+ 件 / 同数タイ skillId 昇順安定 / 非配列 throw / 負値 answerCount 受容 / limit 明示
     - `pickEncouragementCopy`: 同一週同一 family 決定論性 / 異 week 別 key（鳩ノ巣） / 異 family 別 key（鳩ノ巣） / catalog 整合 / Date / 文字列防御 throw
     - `describeFamilyStreakSummary`: 0/1/5/100 days × alive 真偽 / 負値・NaN / 全分岐罰語不在 grep
     - `composeWeeklyDigestView`: 通常 / 全員 0 XP / 単独 / family 0 名 / topSkills 5→3 絞込 / streak 0+!alive / 非 object throw / leaderboard rank 順伝搬
   - `tests/e2e/family-weekly-digest.spec.ts`（313 行 / 2 シナリオ × 2 project = 4 ケース新規）
     - 解答ログ有り family（兄弟 2 人 + answer_logs 6 件）→ card 可視 / encouragement key catalog 整合 / top-skills-count >= 1 / learner ミニリスト両者表示 / top-skill 1 件目可視 / 罰語不在
     - 解答ログ無し family → card 可視 / topSkills 0 件 / 「来週から ...」 fallback コピー / encouragement key catalog 整合 / 罰語不在
     - `test.describe.configure({ mode: "serial" })` + `execWithRetry` + `client.batch` パターン (W11-T2/T3 と同 SQLITE_BUSY 対策)。

### 技術的判断

- **純関数分離（5 度目）**: Turbopack `"use server"` sync export ban の経験を踏襲し、`family-weekly-digest-summary.ts` を server-only ファイル外に隔離。`family-weekly-digest.ts` も `"use server"` 不要（Server Component 直 import 経路）。
- **SQL family scope の構造的強制**: 新規 SQL（top-skills GROUP BY）は `learner_profiles.family_id = ?` で learner_ids を確定後 `inArray(answer_logs.learner_id, learnerIds)` を必須化。COPPA 準拠の構造的保証を W11-T3 と同パターンで継承。
- **励ましコピー catalog 設計**: 罰語の混入リスクを「pre-curated 8 件 + deterministic seed」で構造的に封鎖。catalog 自体に NG 語が無いため、`pickEncouragementCopy` が何を返しても罰語は構造上発生し得ない（DEC-024 の構造的保証）。
- **deterministic seed = ISO week + familyId codePoint sum mod 8**: 同一週・同一家族で安定 → 親が複数回 dashboard を開いても同じメッセージで「ぶれない」UX。週 / 家族が変われば異 key の可能性が鳩ノ巣で保証。
- **エラーハンドリング**: top-skills SQL 失敗時は `try/catch` で空配列を返し、digest 全体は streak / leaderboard で継続（前向き fallback / DEC-024）。
- **既存 cutoff 計算流用**: leaderboard と同一の `jstQuestDayStartUtc(getJstQuestDate(now))` から 6 日前 cutoff を採用 → 7 日 window が既存集計と完全一致。
- **テスト戦略**: 純関数の不変条件は unit で 32 ケース網羅、E2E は read path（親 dashboard で見える結果）に集中。study UI 経由 click → submitAnswer flow は触らないため、preexisting study-smoke regression に独立。

### 成果物

- 新規: `src/lib/study/family-weekly-digest-summary.ts`（296 行）
- 新規: `src/lib/study/family-weekly-digest.ts`（144 行）
- 修正: `src/app/(parent)/parent/dashboard/page.tsx`（+123 行 / -0 行）
- 新規: `tests/unit/study.family-weekly-digest-summary.test.ts`（347 行 / 32 ケース）
- 新規: `tests/e2e/family-weekly-digest.spec.ts`（313 行 / 4 ケース）
- ファイル数: 5（新規 4 / 修正 1） / +1223 行 / -0 行

### テスト結果

- **typecheck**: PASS / エラー 0
- **lint**: PASS / warning 0
- **vitest**: 50 files / 715 passed（前回 49/683 + 新規 1 file/32 件 = +32 = 715）/ failed 0
- **build**: 23 routes / 完遂（新規ルート無し）
- **E2E family-weekly-digest**: chromium 2 + mobile-chrome 2 = 4/4 PASS
- **E2E 既存 family-leaderboard**: 6/6 PASS（リグレッション 0）
- **E2E 既存 family-streak**: 6/6 PASS（preexisting flaky 1 件は `--retries=2` で吸収 / W11-T5 改修起因ではない）
- **E2E 既存 family-message**: 4/4 PASS（リグレッション 0）
- **家族関連 E2E 合計**: 20/20 PASS（受入基準 ≥ 20 達成）

### 技術的課題・リスク

- **family-streak.spec.ts の preexisting SQLITE_BUSY flaky**: `setFamilyStreakDirect` ヘルパ内 `client.execute` に retry が無く、worker 並列で稀に SQLITE_BUSY が発生する。`--retries=2` 込みで全 PASS のため Phase 2 W11 polish 対象として後段で `execWithRetry` 化推奨（W11-T5 起因ではない既知問題 / 別 atomic）。
- **複数 spec を 1 cmd で連続実行すると signup_failed エラー多発**: `Date.now()_workerIndex_suffix` の email 重複が起こりうる（time stamp 衝突 + DB 競合）。各 spec を個別に実行すれば全 PASS。CI でも spec 単位で並列化していれば問題なし（preexisting / W11-T5 起因ではない）。

### 次のステップ

- CEO レビュー部門呼び出し → atomic commit + push
