## レビュー報告（W12-T2 A/B test 基盤 / DEC-066）

### 判定
**APPROVE**

### 重大度別件数
- Critical: 0
- Major: 0
- Minor: 2
- Nit: 1

### Critical 指摘（あれば）
なし。`push` 阻害となる欠陥は検出されなかった。

### Major 指摘（あれば）
なし。DEC-066 の atomic スコープ・制約厳守・受入基準は構造的に満たされている。

### Minor / Nit 指摘

- **Minor M-1（罰語 grep の網羅差異 / 後続 atomic で吸収可）**:
  `tests/unit/experiments.test.ts` の `PUNISHMENT_WORDS` は **10 語**（`劣位` / `だめ` / `やる気` 含む）だが、`tests/e2e/admin-kpi-experiment.spec.ts` の `PUNISHMENT_WORDS` は **7 語**（`劣位` / `だめ` / `やる気` を不含）。本番 UI に「劣位」等が露出していないことは catalog 構造で構造的担保済 + unit test 側で 10 語版を全網羅しているため push 阻害ではないが、後続 atomic で E2E 側も 10 語版に揃えると思想完成度が上がる（W12-T1 の admin-kpi.spec.ts も 7 語のため、合わせる場合は両ファイル同時更新）。

- **Minor M-2（CRLF 改行差分の混入 / 機能影響 0）**:
  `tests/unit/__snapshots__/ai.coach.test.ts.snap` が `git status` 上で M 表示されているが、`git diff --stat` 結果で実コード差分はなく `LF will be replaced by CRLF` の OS 改行コード差分のみ。dev 報告の成果物表に記載がないが、機能 / テスト挙動への影響 0。push 前にステージから外すか、`.gitattributes` で eol=lf 強制するかの検討余地あり。

### Nit 指摘

- **Nit N-1（コメント整合 / 意味影響 0）**:
  `src/lib/admin/kpi.ts:359` のコメント `// W12-T2 (DEC-066): A/B test cohort 9 並列目` は **「9 並列目」**と記述されているが、実体は「8 並列を 9 並列に拡張した結果の **9 個目（インデックス 9）**」を意味する。dev 報告の説明（"8 並列 → 9 並列"）とは整合し、`Promise.all` の配列インデックスで見ると **9 個目要素 / index 8** であるため誤読の余地はないが、後続 atomic 編集者向けに「9 個目（= 配列の 9 番目要素）」と明示するとより明確。

### 受入基準確認

- DEC-024 罰則ゼロ: ✓
  - catalog (`experiments-catalog.ts`) の `description` / `variants[].label` / `variants[].key` が中立コピーのみ。
  - `kpi-summary.ts` の `buildExperimentCohortCard` fallback 文字列（「実験データ未取得 (前向き fallback)」「割当 0 名 (まだ cohort なし)」「平均 streak 集計待ち」）は罰語不在。
  - unit test で 10 語の punishment grep（`expectNoPunishmentWords`）が catalog / fallback / card title / primaryValue / secondaryLabel / rows[].label / rows[].value 全てに適用されている。
  - E2E (`admin-kpi-experiment.spec.ts`) でも 7 語版の grep が dashboard 全体テキストに適用されている。
  - 文書（JSDoc / コメント）に「失敗」「劣位」が登場しているが UI 露出経路ではない（罰語列挙の説明文 / `取得失敗時 → ——` の概念説明）。

- DEC-003 三層認可: ✓
  - 第一層 middleware (`/admin` proxy.ts) は W12-T1 既導入 / 本 atomic で改変なし（regression 0）。
  - 第二層 `requireAdmin()` は W12-T1 既導入 / `/admin/kpi/page.tsx` で呼び出し済 / 本 atomic で改変なし。
  - 第三層 SQL aggregate-only:
    - `getCohortDistribution` SELECT 句 = `json_extract(experiments, $.<key>) AS variant`, `COUNT(*) AS cnt` のみ。learner_id / family_id / user_id は SELECT に出ない。
    - `getCohortStreakAvg` SELECT 句 = `json_extract(...)`, `AVG(currentStreak)`, `COUNT(*)` のみ。`innerJoin(streaks)` するが SELECT に id 列は出さない。
    - WHERE 句に learner_id 等で絞る箇所なし。GROUP BY が variant のみ。row 個別返却 0 / aggregate 行のみ。

- DEC-006 不変条件: ✓
  - 新規 server action 0（`"use server"` directive 不在 / 全ファイル grep 確認済）。
  - 新規 route 0（next build 25 routes 不変 / dev 報告と CEO 検証済ベースライン整合）。
  - `getOrAssignVariant` は server-only helper の単一 UPSERT で、既存割当時は DB write 0 / 未割当時のみ UPDATE 1 回 → mutation count に算入対象外（既存 server action 系統と分離）。

- DEC-055 idempotency: ✓
  - 実装: `getOrAssignVariant` は (a) `knownVariantKeys.has(existing)` で既存 valid 割当を即返却 / DB write 0、(b) 未割当 / 不正 variant のときのみ `assignVariant` で deterministic 決定 → `json_set` で UPDATE 1 回。
  - test: `assignVariant` は同一 seed 必同一 variant（10000 サンプルでも 0 / 0.45-0.55% に収束）。`validateExperimentsJson` 防御正規化で不正 variant も entry-drop。
  - 同一 (learner, experiment) への複数 call は構造的に DB write 増加なし / variant flip なし。

- Turbopack "use server" ban: ✓
  - `experiments-catalog.ts`: `"use server"` directive **不在**（grep 確認済 / コメント言及のみ）/ 純関数 / DB I/O 0 / DOM-free。Server Component / server-only helper 双方から直接 import 可能。
  - `assignment.ts`: `"use server"` **不在**（純粋な server-only モジュール / kpi.ts と同形式）。
  - パターン適用 7 度目（W10-T5 → W11-T1/T3/T2/T5 → W12-T1 → W12-T2）が一貫している。

- SQL injection 防御: ✓
  - `getCohortDistribution` / `getCohortStreakAvg` で `experimentKey` は `jsonPathFor()` 経由で `$.<key>` 文字列を組み立て、`sql\`json_extract(${learnerProfiles.experiments}, ${path})\`` の **template literal bind パラメータ**として渡される。
  - `sql.raw` 使用箇所 0（`grep` で確認済）。
  - drizzle-orm の `sql\`...\`` テンプレートが `?` placeholder にマッピングする保証を活用。
  - `getOrAssignVariant` の UPDATE も `${path}` / `${assigned}` を bind パラメータとして渡している。

- migration 互換性: ✓
  - `0016_w12_experiments.sql` は `ALTER TABLE learner_profiles ADD COLUMN experiments TEXT NOT NULL DEFAULT '{}'` の 1 文のみ。
  - DEFAULT `'{}'` で既存行は構造的に空 JSON で埋まる（NOT NULL 制約は default 経由で安全）。
  - `validateExperimentsJson` が文字列 / object / null / 配列 / 数値 / 非 string value 全てに対し `{}` または entry-drop で防御正規化されており、libSQL の text(json) 列の型ゆらぎ（drizzle mode:"json" は環境により string で来るケース）も `validateExperimentsCell` で吸収。
  - 既存 read path（`learnerProfiles.*` SELECT）に新列追加の影響なし / 既存 schema-derived 型推論にも問題なし（typecheck PASS / E2E 全 94 PASS が裏付け）。
  - E2E fixture (`db-fixture.ts`) に `0016_w12_experiments.sql` を migrations list に追加 → fresh in-memory DB に新列が構造的に流れる。

- scope creep 不在: ✓
  - `src/app/api/cron/streak-freeze-monthly` route は **存在しない**（git ls-files / Glob で確認 / 実コード上は `src/lib/study/streak-freeze.ts` のみ存在 / cron route は W12-T2.5 で実装予定 / dev は触っていない）。
  - dev 報告 §技術的課題の申し送り「W12-T2.5 で grant 適用ロジック実装」と一致。
  - DEC-066 §含まない の 4 項目（cron grant / 2 件目 experiment / winner 確定 / cross-cut KPI cohort 別）すべて未実装 → atomic スコープ厳守。

- typecheck / lint / vitest / build / E2E 全 PASS: ✓
  - dev 報告 + CEO trust-but-verify 結果と整合（typecheck 0 err / lint warning 0 / vitest 52 files 782 PASS / next build 25 routes / E2E 94 PASS = chromium 47 + mobile-chrome 47 / regression 0）。

### 総合判断

**APPROVE 推奨。** 重大度 Critical / Major の指摘ゼロ、push を阻害する欠陥なし。

DEC-066 の atomic スコープ（含む 10 項目）はすべて完遂され、含まない 4 項目（cron grant / 2 件目 experiment / winner 確定 / cross-cut KPI cohort 別）は構造的に未実装で scope creep 不在。

- **思想完成度**: 純関数（catalog） + server-only helper（assignment） + pure compose（kpi-summary）の 3 層分離が W12-T1 で確立したパターンを 7 度目で精緻に再適用。Turbopack `"use server"` sync export ban / Promise.all + per-task fail-soft / SQL aggregate-only 構造的 COPPA 担保がすべて整っている。
- **DEC-055 idempotency**: `getOrAssignVariant` の (a) 既存 valid 割当即返却 / DB write 0、(b) 未割当時の deterministic 決定 + 単一 UPSERT が unit test と実装の両側面で構造的に担保されている。
- **DEC-003 三層認可 / 第三層**: `getCohortDistribution` / `getCohortStreakAvg` の SELECT 句から learner_id / family_id / user_id が構造的に排除され、aggregate 行のみが返却される設計が確認できた。
- **罰語ゼロ哲学（DEC-024）**: catalog / fallback 文字列 / unit test grep（10 語） / E2E grep（7 語）の多層防御。本番 UI 露出経路に罰語混入の余地なし。

Minor 2 件 / Nit 1 件は後続 atomic（W12-T2.5 等）で吸収可能であり、現行 commit の push 進行可否判断には影響しない。**CEO による push 進行可と判断する。**
