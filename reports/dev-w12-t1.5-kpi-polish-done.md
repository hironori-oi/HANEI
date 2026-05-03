# PRJ-016 HANEI - W12-T1.5 KPI ダッシュボード polish + Minor/Nit 累積吸収 完遂報告

- 案件: PRJ-016 HANEI
- atomic: Phase 2 W12-T1.5 (= 0.25 人日)
- 根拠 DEC: DEC-068 (本 atomic) / DEC-067 / DEC-066 / DEC-065 / DEC-024 / DEC-003 / DEC-006 / DEC-055
- 着手判断: CEO 確定スコープ (DEC-068 §A〜D)
- 報告者: 開発部門
- 完遂日: 2026-05-03

## サマリー

DEC-068 §A〜D を完納。

- §A: DEC-066 由来 polish（`.gitattributes` 新設 / E2E 罰語 9 語化 / kpi.ts コメント訂正）
- §B: DEC-067 由来 polish（cron route per-row fail-soft × 2 ループ / `?? 1` 多層防御コメント / `monthlyGrantedByVariant` JSDoc 拡張）
- §C: KPI 拡張 2 系統（模試結果分布 / kotodama-tori メッセージ表示率 / `Promise.all` 9 → 11 並列 / 10 → 12 cards）
- §D: 受入更新（unit `tests/unit/admin.kpi.test.ts` / `tests/unit/experiments.test.ts` を 12 cards 化 + builder 全件網羅 ≥ 14 / E2E `admin-kpi.spec.ts` `admin-kpi-experiment.spec.ts` を 12 cards 化）

受入基準は 7 項目すべて PASS（typecheck warning 0 / lint warning 0 / vitest **53 files / 815 tests PASS** / next build **25 routes** / E2E admin-kpi 4 / admin-kpi-experiment 2 / shop 6 = **計 12 PASS / regression 0**）。

## 修正ファイル一覧（行数増減）

| ファイル | 区分 | 行数増減 | 内容 |
| --- | --- | --- | --- |
| `app/.gitattributes` | 新規 | +8 | `*.snap text eol=lf` で CRLF noise を構造的に解消 (DEC-066 M-2) |
| `app/tests/e2e/admin-kpi.spec.ts` | 修正 | +12 / -2 | `PUNISHMENT_WORDS` 7 → 9 語 / `REQUIRED_KPI_IDS` に `mock-exam-distribution` `kotodama-message-delivery` 追加 / 「全 9 card」→「全 12 card」 |
| `app/tests/e2e/admin-kpi-experiment.spec.ts` | 修正 | +13 / -3 | 同 9 語化 / 同 12 cards 化 / 「10 枚目」→「12 枚目」表記訂正 |
| `app/src/lib/admin/kpi.ts` | 修正 | +83 / -3 | `mockExamResults` import / `getMockExamDistribution` `getKotodamaMessageDeliveryLast7Days` 新関数 / `Promise.all` 9 → 11 並列 / コメント訂正 |
| `app/src/lib/admin/kpi-summary.ts` | 修正 | +148 / -1 | `MockExamDistributionRaw` `KotodamaMessageDeliveryRaw` 型 / `KpiDashboardRaw` 拡張 / `buildMockExamDistributionCard` `buildKotodamaMessageDeliveryCard` 新 builder / `composeKpiDashboardView` cards 10 → 12 |
| `app/src/app/api/cron/streak-freeze-monthly/route.ts` | 修正 | +30 / -3 | monthly grant ループ + 受験 30 日前ボーナスループに per-row try/catch + errors.push / `monthlyGrantedByVariant` JSDoc 拡張 |
| `app/src/lib/experiments/streak-freeze-variants.ts` | 修正 | +6 / 0 | `?? 1` 直前に多層防御コメント追加 |
| `app/tests/unit/admin.kpi.test.ts` | 修正 | +166 / -2 | `buildRaw` ヘルパ拡張 / `composeKpiDashboardView` 12 cards 化 / `buildMockExamDistributionCard` 6 ケース / `buildKotodamaMessageDeliveryCard` 6 ケース / 全埋め罰語 grep に新 raw を追加 |
| `app/tests/unit/experiments.test.ts` | 修正 | +6 / -3 | `buildRaw` に新フィールド 2 件 / 「10 枚目」→「12 cards 化後も index 不変」へ assertion 改訂 |

合計: 9 ファイル / 新規 1 + 修正 8 / **+472 行 / -17 行 / 純増 +455 行**

## 主要技術判断

### 1. SQL aggregate-only での learner_id 排除証跡 (DEC-003 第三層)

**模試結果分布 (`getMockExamDistribution`)**:

```ts
.select({
  level: mockExamResults.level,                    // 級コード ("5"|"4"|"3")
  cnt: sql<number>`COUNT(*)`,                       // 件数のみ
  avgRatio: sql<number>`AVG(CAST(...) / NULLIF(...))`,  // 平均得点率のみ
})
.from(mockExamResults)
.where(sql`${mockExamResults.takenAt} >= ${cutoff}`)
.groupBy(mockExamResults.level);
```

`mock_exam_results.learner_id` を SELECT 句に**一切含めない**。GROUP BY も level のみ。個別 learner / score は構造的に flow しない。

**kotodama-tori メッセージ表示率 (`getKotodamaMessageDeliveryLast7Days`)**:

```ts
.select({
  totalSent: sql<number>`COUNT(*)`,
  totalRead: sql<number>`COALESCE(SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END), 0)`,
})
.from(parentMessages)
.where(sql`${parentMessages.createdAt} >= ${cutoff}`);
```

`parent_messages.family_id` / `from_user_id` / `to_learner_id` / `body` を SELECT 句から構造的に排除。集計は 1 行（COUNT + SUM）のみ返却。COPPA 準拠の「個別 family / learner / message 露出ゼロ」を SQL レベルで担保。

### 2. cron route per-row fail-soft 設計理由 (DEC-067 M-1 解消)

**Before**: monthly grant ループ全体が outer try/catch (line 65-139) のみで包まれる構造。一 learner の `getOrAssignVariant` throw / DB UPDATE 失敗で**残 learner の処理が全体 break**する潜在的脆弱性。

**After**: 各 `for (const row of allStreaks)` イテレーション内に per-row try/catch を導入し:

- 失敗時は `errors.push("learner=${row.learnerId} ${msg}")` で観測性確保（learnerId 含む = 後続トリアージ可）
- 同 learner は次回月初 cron で再試行（DEC-055 idempotency triple guarantee の 1 つを継続活用 / 上限到達なら自然 no-op）
- outer try/catch は**残置**（DB 接続失敗などの global error 吸収）= 二重防御

「2. 受験 30 日前ボーナス」ループ (line 103-) も同パターン適用。**「ちょうど 30 日前」判定は 1 日のみのため、リトライ機会は 1 回しかない**が、上限到達 (FREEZE_MAX_TICKETS=2) なら no-op となる構造で安全側 = DEC-024 罰則ゼロ哲学維持。

### 3. `?? 1` dead branch の保持理由 (DEC-067 N-1 多層防御)

`hasOwnProperty.call` で early return が確定しているため `??` は dead branch だが、TS Record 型 + JS runtime の二重検査としてコメントで明示し残置:

```ts
// W12-T1.5 (DEC-068 / DEC-067 N-1): 多層防御コメント.
//  - hasOwnProperty.call で key 存在は保証済だが、TS Record<string, number> は
//    値が undefined になり得ない signature でも、予期せぬ runtime override
//    (例: catalog 拡張時の同期忘れ + prototype-pollution 経路 / Object.prototype
//    汚染 / JSON.parse からの値挿入) を防ぐため fallback 1 を残置する.
//  - dead branch ではあるが構造的安全網として意図的に保持 (削除禁止).
return STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT[variantKey] ?? 1;
```

将来 lint / dead-code 検出ツールで「無効分岐」とマークされた際の削除誤操作を防ぐ「削除禁止」コメント明示。

### 4. composeKpiDashboardView の fixed-order 維持

cards 配列末尾に append（10 → 11 → 12）し、既存 9 cards + cohort card の順序は不変。E2E は `data-kpi-id` で stable に当てるため index 変更にも耐性あり。`tests/unit/experiments.test.ts` の cohort card は index 9（0-indexed）に固定で確認、新 2 cards は index 10 / 11 と明示的に検証 = regression 0。

### 5. 純関数 + server-only 分離（Turbopack `"use server"` sync export ban / 9 度目構造定着）

- `kpi-summary.ts`（純関数 / DOM-free / DB-free / `"use server"` 不在）に新 builder 2 個を追加 → unit test で全分岐網羅
- `kpi.ts`（server-only / DB I/O のみ）に新関数 2 個追加 → 既存 `safeAggregate<T>` ラッパで部分失敗を吸収

### 6. 模試 builder の異常 avgRatio フォールバック設計

avgRatio が 0..1 を逸脱（DB 破損 / division-by-zero 紛れ込み）した場合、ratio をクランプせず `undefined` 渡しで `formatPercentage` の `"——"` を出す設計を採択（unit テストで明示）:

```ts
value: `${formatCount(cnt)} 件 / 平均 ${formatPercentage(
  ratio >= 0 && ratio <= 1 ? ratio : undefined,
)}`,
```

理由: 異常値を「100%」「0%」でクランプ表示すると admin が「正常に集計できている」と誤読するリスクがある。中立 `"——"` で表示し追加調査トリガーとする方が運営上安全（Sentry / SQL spot check 連動）。

## 受入基準の実測結果

| 項目 | 期待 | 実測 | 結果 |
| --- | --- | --- | --- |
| typecheck | warning 0 | error 0 / warning 0 | PASS |
| lint | warning 0 | error 0 / warning 0 | PASS |
| vitest | baseline 801 + 新規 ≥12 | **53 files / 815 tests PASS** (+14 / regression 0) | PASS |
| next build | 25 routes 不変 | 25 routes (`/admin/kpi` 含む既存全 route) | PASS |
| E2E admin-kpi | 4 PASS / 12 cards 化 | chromium 2 + mobile-chrome 2 = **4 PASS** | PASS |
| E2E admin-kpi-experiment | 2 PASS / cohort + 12 cards | chromium 1 + mobile-chrome 1 = **2 PASS** | PASS |
| E2E shop | 6 PASS / W12-T2 / W12-T2.5 regression 0 | chromium 3 + mobile-chrome 3 = **6 PASS** | PASS |

総合: **7/7 PASS / regression 0**

## 各 DEC 制約への適合性自己評価

### DEC-024（罰則ゼロ哲学）

- 模試 builder rows: `"5 級"` / `"4 級"` / `"3 級"` + `"X 件 / 平均 Y.Y%"`（中立トーン）
- kotodama-tori builder: `"送信 N 件 / 表示 M 件"`（「未読」「無視」等の罰語不使用）
- unit test 9 語 grep（`PUNISHMENT_WORDS`）+ E2E 9 語 grep でカードの全テキストに対し検査済
- `DEC-066 M-1` で指摘されていた「unit 9 語 vs E2E 7 語の不揃い」を本 atomic で完全解消

### DEC-003（三層認可 / 構造的データ排除）

- 第一層 middleware（既存）+ 第二層 `requireAdmin()`（既存）に変更なし
- 第三層: 新 SQL 2 系統とも learner_id / family_id / from_user_id / to_learner_id / score / max_score / body 等の個別 row 識別子を SELECT 句から完全排除
- aggregate のみ（COUNT / SUM / AVG / GROUP BY level）= 個別行は flow しない構造

### DEC-006（API surface 不変 / GET 10 / mutation 5）

- 新規 server action: 0
- 新規 route: 0（`next build` 25 routes 不変で構造担保）
- 既存 cron route signature: GET / POST = GET の二重 export を変更なし
- レスポンス JSON: 既存フィールド構造完全不変（コメント文字列のみ更新）= 後方互換維持

### DEC-055（idempotency 三重保証）

- cron route の per-row fail-soft 化は失敗 learner skip = 次回月初 cron で再試行可能
- `getOrAssignVariant` の idempotent UPSERT（W12-T2 構造担保）に変更なし
- `grantFreezeTicketsN` の上限到達 no-op（W12-T2.5 構造担保）に変更なし
- `isFirstDayOfMonthJst` 月 1 回限定（W8 構造担保）に変更なし
- 三重保証の 1 つでも生きていれば二重起動 / 失敗リトライで streaks 行は壊れない不変条件継続

### DEC-066（A/B test 基盤 catalog 改変禁止）

- `experiments-catalog.ts` 改変なし（diff 0）
- `streak-freeze-variants.ts` の追加変更は `?? 1` のコメントのみ（map 実体は不変）

### DEC-067（W12-T2.5 grant cron signature 不変）

- cron route の signature（GET / POST 二重 export）不変
- `monthlyGrantedByVariant` field 構造不変（JSDoc コメントのみ拡張）
- `monthlyGranted` / `monthlyGrantedLearners` / `examBonusGranted` / `errors` field 不変

### DEC-068（本 atomic 仕様 §A〜D）

- §A 3 件（`.gitattributes` / E2E 9 語 / kpi.ts コメント）すべて完納
- §B 3 件（cron monthly per-row / cron exam-bonus per-row / variants `?? 1` コメント / `monthlyGrantedByVariant` JSDoc）すべて完納
- §C 2 系統（模試 / kotodama-tori）の 4 要素（型 + DB 関数 + builder + composeView 統合）すべて完納
- §D 2 ファイル（unit + E2E 2 spec）すべて完納

7 制約の自己評価: **全項目適合 / 違反 0**

## scope creep 抑止記録（含まないと宣言した項目を実装していない確認）

- cron route 全体の純関数化リファクタ → 触っていない（per-row try/catch のみ追加）
- mock_exam_results の cohort 別 / variant 別 KPI → 追加していない
- kotodama-tori 表示の AI 感品質スコア → 追加していない
- W12-T3 β 受入準備 → 着手せず
- W12-T4 ストレステスト + Sentry 強化 → 着手せず
- W11 KPT 振り返り → 着手せず

scope creep: **0 件**

## 残課題 / 後続 atomic 候補

- W12-T3 β 受入準備（招待 LP + 同意書 + フィードバックフォーム / 1.5 人日 / P0 / Phase 2 完遂前最大障壁）
- W12-T4 ストレステスト + Sentry 強化（0.5 人日 / P1）
- W11 KPT 振り返り（並行可 / 0.25 人日）
- cron route 全体の純関数化リファクタ（M-1 を polish atomic で必要なら検討）

## CEO trust-but-verify 用コマンド一覧

```bash
cd projects/PRJ-016/app
bun run typecheck
bun run lint
bun run test
bun run build
bun run e2e tests/e2e/admin-kpi.spec.ts --workers=1
bun run e2e tests/e2e/admin-kpi-experiment.spec.ts --workers=1
bun run e2e tests/e2e/shop.spec.ts --workers=1
```

実装完遂報告 / レビュー部門呼び出し以降は CEO 側で実施。
