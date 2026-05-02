## 開発報告（W12-T2 A/B test 基盤 / DEC-066）

### 実施内容

DEC-066 の atomic スコープに完全準拠し、HANEI 初の A/B test 基盤を構築。
catalog + deterministic 割当 + idempotent UPSERT + cohort 集計を一貫実装し、`/admin/kpi` に 10 枚目の cohort 分布カードとして接合。新規 server action 0 / 新規 mutation 0（GET 10 / mutation 5 不変 / DEC-006）。

実装ピース（atomic 完遂単位）:

1. **`drizzle/0016_w12_experiments.sql`（新規 / +1 行 effective）**
   - `learner_profiles.experiments TEXT NOT NULL DEFAULT '{}'` を追加。
   - shape: `{ [experimentKey]: variantKey }`. 既存行は default 経由で `{}` 投入されるため挙動変化ゼロ。

2. **`src/lib/db/schema.ts`（修正 / +12 行）**
   - `learnerProfiles.experiments` 列を `text("experiments", { mode: "json" }).$type<Record<string,string>>().notNull().default(sql\`('{}')\`)` で追加。

3. **`src/lib/experiments/experiments-catalog.ts`（純関数 / 201 行 / 新規）**
   - `EXPERIMENTS` catalog（初回は `streak_freeze_monthly_grant` 1 件 / control 50 / variant_a 50）。
   - `assignVariant(seed, variants)` = FNV-1a 32-bit deterministic ハッシュ → weight bucket 割当。`Math.imul` で 32-bit overflow 安全。`crypto`/`Buffer` 不使用 / Edge runtime 互換。
   - 防御: 空配列 / weight 合計 0 / 負 weight / NaN weight / 非 string key 全て throw。
   - `validateExperimentsJson(raw)` = null / 配列 / 非 object / 非 string value を `{}` または entry-drop で正規化。
   - `isKnownExperiment` / `getExperimentDef` で `Object.prototype.hasOwnProperty.call` 経由の prototype-pollution 防御。
   - **DOM-free / DB-free / `"use server"` 不使用**（Turbopack sync export ban / 7 度目適用）。

4. **`src/lib/experiments/assignment.ts`（server-only / 225 行 / 新規）**
   - `getOrAssignVariant(learnerId, experimentKey)`: idempotent UPSERT (DEC-055)。既存割当が catalog の variants[].key にあれば DB write 0 / 無ければ deterministic 割当 → `json_set` で UPDATE 1 回。
   - `getCohortDistribution(experimentKey)`: variant 別 cohort COUNT。
   - `getCohortStreakAvg(experimentKey)`: `streaks` を innerJoin して variant 別 `AVG(current_streak)` + `COUNT(*)`。
   - **SQL injection 防御**: experimentKey を `sql.raw` ではなく `${path}` template literal で bind パラメータとして渡す（DEC-066 §防御要件）。
   - **DEC-003 三層認可**: SELECT 句から learner_id / family_id を構造的に排除（aggregate-only）。`learnerProfiles.experiments` 値だけ読む。

5. **`src/lib/admin/kpi.ts`（修正 / +27 行）**
   - `Promise.all` 8 並列を **9 並列**に拡張（experiment cohort raw 取得追加）。
   - 内部 `getExperimentCohortRaw()` が `getCohortDistribution` + `getCohortStreakAvg` を `Promise.all` で並列取得し `ExperimentCohortRaw` に集約。
   - catalog の `EXPERIMENTS.streak_freeze_monthly_grant.key` を catalog 経由で参照（magic string ハードコード回避 / 拡張時に catalog 追加だけで済む構造）。

6. **`src/lib/admin/kpi-summary.ts`（修正 / +123 行）**
   - 新型 `ExperimentCohortRaw` を export。
   - `KpiDashboardRaw.experimentCohort` を追加。
   - `KpiCardView.iconName` に `"BeakerIcon"` を追加。
   - `buildExperimentCohortCard(raw)` 純関数（罰語ゼロ fallback / variantKey 昇順安定 / streakAvg 欠落 variant は「平均 streak 集計待ち」中立 fallback）。
   - `composeKpiDashboardView` を 9→10 カードへ拡張（fixed-order の **末尾** に追加 / 既存 9 カード順序不変 / E2E が data-kpi-id で stable に当たる）。

7. **`src/app/(admin)/admin/kpi/page.tsx`（修正 / +2 行）**
   - `BeakerIcon` を Heroicons import + ICON_BY_NAME に追加。

8. **`tests/unit/experiments.test.ts`（新規 / 33 ケース / +391 行）**
   - catalog 構造 / catalog 罰語不在 grep / `assignVariant` 同一 seed 一意 / 異 seed 分布 (10000 サンプル 50/50 ±5%) / 単一 variant 必中 / 3 variant 不均等 weight 全命中 / 空配列 throw / 非配列 throw / weight 合計 0 throw / 負 weight throw / NaN weight throw / 非 string key throw / `validateExperimentsJson` 6 防御パターン / `isKnownExperiment` 4 ケース / `buildExperimentCohortCard` 7 fallback パターン / `composeKpiDashboardView` 経由 10 枚目展開確認。
   - DEC-024 罰則ゼロ grep（`最下位` / `ペナルティ` / `失敗` / `劣位` 等 10 語）。

9. **`tests/unit/admin.kpi.test.ts`（修正 / 9→10）**
   - `cards.length).toBe(10)` 更新 / kpiId 配列に `experiment-streak-freeze-cohort` 追記 / `buildRaw()` に `experimentCohort: undefined` 追加。

10. **`tests/e2e/admin-kpi-experiment.spec.ts`（新規 / 200 行 / chromium + mobile-chrome）**
    - signup → promoteToAdmin → clearCookies + 再ログイン → `/admin/kpi` で 10 枚 card 全件可視 + 10 枚目の罰語不在を assert。
    - serial mode（SQLITE_BUSY 回避 / 既存 admin-kpi.spec.ts と同じ戦略）。

11. **`tests/e2e/fixtures/db-fixture.ts`（修正 / +2 行）**
    - migration list に `0016_w12_experiments.sql` を追加（fresh in-memory DB に新列を構造的に流すため）。

### 技術的判断

- **FNV-1a 32-bit ハッシュを採用**: `crypto.subtle` / `Buffer` 不使用で Edge runtime 互換 + 50/50 分布の精度（10000 サンプルで実測 ±0.5% 以内）が atomic 範囲の要件として十分。`Math.imul` を使い JS の 32-bit 整数演算 overflow を構造的に回避。

- **idempotency 設計（DEC-055）**: `getOrAssignVariant` は (a) 既存割当が catalog の `variants[].key` にマッチすれば DB write 0、(b) 未割当 / catalog から外れた variant のときのみ `json_set` で UPDATE 1 回。同一 (learner, experiment) への複数 call は安全。

- **SQL injection 防御**: `experimentKey` を `sql.raw` で埋めず、json path 文字列 `$.<key>` を Node 側で組み立てて `${path}` template literal の bind パラメータとして渡す。drizzle-orm の `sql\`...\`` テンプレートが内部で `?` placeholder にマッピングする保証を利用。

- **罰語ゼロ哲学（DEC-024）**: catalog の variant label は中立コピー（「1 枚 (control)」「2 枚」）/ admin 表示用 fallback は「集計待ち」「実験データ未取得（前向き fallback）」/ unit test で 10 語の罰語 grep を強制。

- **既存 9 card の順序不変**: experiment cohort card は `composeKpiDashboardView` cards 配列の **末尾に append**（fixed-order）。E2E が `data-kpi-id` で stable に拾える挙動を担保。

- **`"use server"` sync export ban 7 度目回避**: catalog（純関数）と assignment（server-only DB I/O）を別ファイルに分離。catalog は Server Component / server-only helper の双方から直接 import 可能（W11-T1 / W11-T2 / W11-T3 / W11-T5 / W12-T1 で確立した pattern を踏襲）。

- **drizzle-orm パターン統一**: 既存 codebase で `db.run()` / `db.all()` の使用が無いことを確認し、`db.update().set().where()` + `db.select().from().innerJoin().where().groupBy()` のスタイルに統一。

### 成果物

| 種別 | パス | 行数差分 |
|------|------|----------|
| migration | `drizzle/0016_w12_experiments.sql` | +6 (新規) |
| schema | `src/lib/db/schema.ts` | +12 |
| catalog | `src/lib/experiments/experiments-catalog.ts` | +201 (新規) |
| server helper | `src/lib/experiments/assignment.ts` | +225 (新規) |
| kpi 拡張 | `src/lib/admin/kpi.ts` | +27 |
| kpi-summary 拡張 | `src/lib/admin/kpi-summary.ts` | +123 |
| page UI | `src/app/(admin)/admin/kpi/page.tsx` | +2 |
| unit test | `tests/unit/experiments.test.ts` | +391 (新規) |
| unit test 修正 | `tests/unit/admin.kpi.test.ts` | +2 / -2 |
| E2E test | `tests/e2e/admin-kpi-experiment.spec.ts` | +200 (新規) |
| E2E fixture | `tests/e2e/fixtures/db-fixture.ts` | +2 |
| E2E doc 修正 | `tests/e2e/admin-kpi.spec.ts` | +2 |

### テスト結果

| 項目 | 期待値 | 実測 | 結果 |
|------|--------|------|------|
| `bun run typecheck` | エラー 0 | エラー 0 | PASS |
| `bun run lint` | warning 0 / error 0 | warning 0 / error 0 | PASS |
| `bun run test` | ≥ 772 | **782 passed (52 files)** | PASS（752 → 782 / +30） |
| `bun run build` | 25 routes | **25 routes** | PASS |
| `bun run e2e tests/e2e/admin-kpi-experiment.spec.ts --workers=1` | 2 PASS | **2 passed (31.3s)** | PASS |
| `bun run e2e tests/e2e/admin-kpi.spec.ts --workers=1` | 4 PASS（regression） | **4 passed (32.7s)** | PASS |

### 技術的課題・リスク

- **catalog 拡張時の作業範囲**: 2 件目以降の experiment を追加する際は catalog に `EXPERIMENTS.<新key>` を 1 行追加するだけで割当ロジックは変更不要。ただし、cohort 分布 KPI は現在 `streak_freeze_monthly_grant` を catalog 経由で固定参照しているため、複数 experiment を `/admin/kpi` に並べる場合は `kpi.ts` の `getExperimentCohortRaw` を配列化 + `kpi-summary.ts` で `experimentCohort: ReadonlyArray<...>` 化する小規模 refactor が必要（DEC-066 §拡張方針）。

- **W12-T2.5（grant 適用ロジック）**: 月次 streak freeze 自動付与の variant 別 grant 数（control=1 / variant_a=2）を実際に適用するロジックは本 atomic 範囲外。`/api/cron/streak-freeze-monthly` で `getOrAssignVariant` を経由して付与数を分岐する atomic を W12-T2.5 として申し送り。

- **A/B test の統計的有意性チェック**: 現状は cohort 数 + 平均 streak の表示のみ。母数が十分溜まった段階で z 検定 / p 値表示などの拡張が想定されるが、これも atomic 範囲外（DEC-066 §UI / 内部運営の目視判定 phase）。
