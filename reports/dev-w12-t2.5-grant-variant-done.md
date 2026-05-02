## 開発報告（W12-T2.5 月次 streak freeze grant cron への variant 別 grant 数適用 / DEC-067）

### 実施内容

DEC-067 の atomic スコープに完全準拠し、W12-T2 で catalog 登録のみだった `streak_freeze_monthly_grant` experiment を **実走化**。

W8-T1 既存 cron route (`/api/cron/streak-freeze-monthly`) の月初付与ループに `getOrAssignVariant` を組み込み、control = 1 枚 / variant_a = 2 枚を **variant 別**に grant する構造へ拡張。`grantFreezeTicketsN` 純関数を新設し `FREEZE_MAX_TICKETS=2` 上限を構造的に尊重。`streak-freeze-variants.ts` は catalog から独立分離し Turbopack `"use server"` sync export ban パターン **8 度目**適用。新規 server action 0 / 新規 route 0 / 新規 migration 0（GET 10 / mutation 5 不変 / DEC-006）。

実装ピース（atomic 完遂単位）:

1. **`src/lib/study/streak-freeze.ts`（修正 / +37 行）**
   - 既存 `grantFreezeTicket` の直後に純関数 `grantFreezeTicketsN(current, n)` を追加。
   - signature: `(current: number, n: number) => { newCount: number; grantedCount: number }`。
   - 内部で最大 n 回 `grantFreezeTicket` を呼び、`granted: false` で early break（上限到達 = 構造的 no-op）。
   - 防御: `n` が NaN / Infinity / 非整数 → `Number.isFinite(n) ? Math.floor(n) : 0` で整数化、`safeN <= 0` は即返却（DB write 0）。
   - 既存 `grantFreezeTicket` は **不変**（W8 既存 unit test 全件 regression 0）。
   - W8 設計原則（罰演出ゼロ / 自動消費 / 上限 2 で「貯まりすぎ → 学習離脱」抑止）を踏襲する旨を doc-comment に明示。

2. **`src/lib/experiments/streak-freeze-variants.ts`（新規 / 純関数 / 56 行）**
   - `STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT: Record<string, number>` = `{ control: 1, variant_a: 2 }` を export。
   - `resolveStreakFreezeGrantTickets(variantKey: string): number` を export（catalog にない variant key / 非 string / prototype 系 key は **fallback = 1 枚 / control 互換 / 安全側**）。
   - **`Object.prototype.hasOwnProperty.call` で prototype-pollution 防御**（`"toString"` / `"__proto__"` / `"hasOwnProperty"` も unit test で fallback 1 枚を確認）。
   - **NO `"use server"` directive** / **DOM-free / DB-free** / catalog (`experiments-catalog.ts`) を **import せず**、独立した「variant → 効果」マッピングとして責務分離（Turbopack 制約 8 度目適用）。
   - 一貫性ガード（catalog ↔ variants map）は unit test 側で構造担保（catalog 拡張時の構造ガード）。

3. **`src/app/api/cron/streak-freeze-monthly/route.ts`（修正 / +28 行 / -3 行）**
   - import 追加: `grantFreezeTicketsN` / `getOrAssignVariant` / `EXPERIMENTS` / `resolveStreakFreezeGrantTickets`。
   - 月初付与ループ内に `getOrAssignVariant(row.learnerId, EXPERIMENTS.streak_freeze_monthly_grant.key)` を追加 → `resolveStreakFreezeGrantTickets(variantKey)` で n 枚を取得 → `grantFreezeTicketsN(row.freezeTickets, n)` で newCount + grantedCount を計算。
   - `grantedCount > 0` なら UPDATE / `monthlyGranted += grantedCount`（**実枚数**集計に意味変更 / コメントで明示）+ `monthlyGrantedLearners += 1`（**学習者数**集計 / 旧 monthlyGranted の意味で後方互換）+ `monthlyGrantedByVariant[variantKey] += grantedCount`（variant 別観測性確保）。
   - レスポンス JSON に `monthlyGrantedLearners` + `monthlyGrantedByVariant` フィールドを追加（既存 `monthlyGranted` は維持 / 後方互換）。
   - **受験 30 日前ボーナス（line 76-115）は完全不変** = scope 外（experiment 対象外 / control/variant_a 共通で +1 のまま）。
   - **認可（`x-vercel-cron-signature` or `Bearer ${CRON_SECRET}` 二段）は完全不変**。

4. **`tests/unit/study.streak-freeze.test.ts`（修正 / +60 行 / 既存ケース不変）**
   - 既存 `grantFreezeTicket` describe ブロック直後に `grantFreezeTicketsN` describe を追加。
   - 計 **10 ケース**: `(0,1)` / `(0,2)` / `(1,2)` 上限到達 / `(2,2)` no-op / `(0,0)` no-op / `(0,-5)` 負値 / `(0,NaN)` / `(0,1.7)` Math.floor / `(0,100)` 上限尊重 / `(0,Infinity)` 防御。
   - 既存 `grantFreezeTicket` 単独テスト・`applyStreakFreeze` / `applyLearnDayUpdate` 全件 **regression 0**。

5. **`tests/unit/experiments.streak-freeze-variants.test.ts`（新規 / 9 ケース / 78 行）**
   - `STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT` 完全列挙（control = 1 / variant_a = 2 / Object.keys 件数 = 2）。
   - 値の不変条件: 全て 1 以上 2 以下の整数（`FREEZE_MAX_TICKETS=2` 上限尊重を構造的検証）。
   - `resolveStreakFreezeGrantTickets` 4 ケース（`"control"` / `"variant_a"` / 未知 / 空文字）+ prototype-pollution 防御 1 ケース（`"toString"` / `"__proto__"` / `"hasOwnProperty"`）。
   - **catalog ↔ variants map 一貫性ガード**: `EXPERIMENTS.streak_freeze_monthly_grant.variants` の各 key + default key が `STREAK_FREEZE_GRANT_TICKETS_BY_VARIANT` に全件存在することを検証（将来 catalog 拡張時の構造ガード）。

### 技術的判断

- **catalog 独立分離（Turbopack 制約 8 度目）**: `streak-freeze-variants.ts` は `experiments-catalog.ts` を `import` せず独立した「variant → 効果」マッピングとして責務分離。catalog は「どんな experiment / variant が存在するか」の source of truth、variants.ts は「variant が何枚 grant するか」の純関数。cron / Server Component / Server Action どこからでも import 可能（W11-T1 / W11-T2 / W11-T3 / W11-T5 / W12-T1 / W12-T2 で確立した pattern を踏襲し 8 度目）。

- **既存 `grantFreezeTicket` を完全不変に保つ判断**: W8 unit test の regression 0 を構造的に担保するため、`grantFreezeTicketsN` は **新規追加**として `grantFreezeTicket` を内部で n 回呼ぶ実装。既存呼び出し元（受験 30 日前ボーナスループ / `applyStreakFreeze` 経由の救済 / `applyLearnDayUpdate` 統合フロー）は完全に挙動が変わらない。

- **整数化 + Infinity 防御**: `n = Number.isFinite(n) ? Math.floor(n) : 0` で NaN / Infinity / 非整数を一括防御。`Math.floor(1.7)` = 1 / `Math.floor(2.999)` = 2 / 構造的に上限 `FREEZE_MAX_TICKETS=2` で打ち止め。負値 / 0 / Infinity すべて 0 として早期 return（DB write 0）。

- **cron route の意味変更を後方互換で吸収**: 既存 `monthlyGranted` フィールドは「学習者数」だったが、本 atomic で「実枚数」へ意味変更（control = 1 枚と variant_a = 2 枚を区別するため）。後方互換のために `monthlyGrantedLearners` を別フィールドで併記し、observability のために `monthlyGrantedByVariant` も追加。コメントで意味変更を明示。

- **idempotency 構造的担保（DEC-055）**: `getOrAssignVariant` は W12-T2 で構造担保済（既存割当時 DB write 0 / 未割当時単一 UPDATE）+ `grantFreezeTicketsN` は上限到達で no-op + 月初判定 (`isFirstDayOfMonthJst`) で月 1 回のみ実行 = 同日 cron 二重起動でも streaks 行は max 上限到達のため変化なし。

- **DEC-024 罰則ゼロ哲学維持**: variant_a でも `FREEZE_MAX_TICKETS=2` 上限を構造的に尊重（`grantFreezeTicketsN` は内部で `grantFreezeTicket` を呼ぶため上限が自動適用）。「貯まりすぎ → 安心しすぎ → 学習離脱」を防ぐ既存設計原則と完全整合。

- **DEC-003 三層認可**: cron 認可（第一層 = `x-vercel-cron-signature` / 第二層 = `Bearer ${CRON_SECRET}`）は完全不変。`getOrAssignVariant` は cron context で auth-agnostic に呼び出し（学習者 ID を受け取るだけ / 所有権検証は本関数の責務外 / cron は全 streaks 対象なので所有権概念無し）。

- **DEC-006 API surface 不変**: 新規 server action 0 / 新規 route 0 / 既存 cron route signature 不変 / レスポンス JSON は追加フィールドのみで後方互換（GET 10 / mutation 5 不変条件遵守）。

- **prototype-pollution 防御**: `resolveStreakFreezeGrantTickets` で `Object.prototype.hasOwnProperty.call` を使い、`"toString"` / `"__proto__"` / `"hasOwnProperty"` のような prototype 系 key を fallback 1 枚に流す。unit test で 3 ケース構造的検証。

- **scope creep ゼロ**: 受験 30 日前ボーナス（既存 line 76-115）は完全不変 / cron route 全体の純関数化リファクタは別 atomic / 2 件目以降の experiment 登録も別 atomic。

### 成果物

| 種別 | パス | 行数差分 |
|------|------|----------|
| 純関数追加 | `src/lib/study/streak-freeze.ts` | +37 |
| 純関数 (新規) | `src/lib/experiments/streak-freeze-variants.ts` | +56 (新規) |
| cron route 修正 | `src/app/api/cron/streak-freeze-monthly/route.ts` | +28 / -3 |
| unit test 拡張 | `tests/unit/study.streak-freeze.test.ts` | +60 |
| unit test (新規) | `tests/unit/experiments.streak-freeze-variants.test.ts` | +78 (新規) |

### テスト結果

| 項目 | 期待値 | 実測 | 結果 |
|------|--------|------|------|
| `bun run typecheck` | エラー 0 | エラー 0 | PASS |
| `bun run lint` | warning 0 / error 0 | warning 0 / error 0 | PASS |
| `bun run test` | ≥ 794 | **801 passed (53 files)** | PASS（782 → 801 / +19 / regression 0） |
| `bun run build` | 25 routes | **25 routes** | PASS（不変） |
| `bun run e2e tests/e2e/shop.spec.ts --workers=1` | 6 PASS（streak-freeze regression） | **6 passed (37.7s)** | PASS |
| `bun run e2e tests/e2e/admin-kpi-experiment.spec.ts --workers=1` | 2 PASS（W12-T2 regression） | **2 passed (27.1s)** | PASS |

### 技術的課題・リスク

- **cron route 本体の動作確認は手動 spot check**: cron route handler は `NextRequest` mock + DB fixture が重く、純関数 unit test で論理網羅した上で「次回月初の本番 cron 実行ログ + Sentry breadcrumb」での観測に委ねる判断（DEC-067 §6 で CEO 確認済）。レスポンス JSON 追加フィールド（`monthlyGrantedLearners` / `monthlyGrantedByVariant`）は次回月初発火時のログで実測可能。

- **A/B test の統計的有意性チェック**: 本 atomic で grant 適用が走るため、次回月初以降に variant 別の cohort_size + avg_streak が `/admin/kpi` に蓄積される。母数が十分溜まった段階で z 検定 / p 値表示などの拡張は別 atomic（Phase 3 candidate）。

- **受験 30 日前ボーナス（既存 line 76-115）の A/B 化**: 本 atomic 範囲外（experiment 対象外 / control/variant_a 共通で +1 のまま）。今後 A/B 化が必要なら別 atomic で同パターン適用可。

- **catalog 拡張時の作業範囲**: `streak_freeze_monthly_grant` 以外の experiment を将来追加する際、本 variants.ts は **streak freeze 専用**なので影響なし。新 experiment 用の variants 関数は別ファイル（例: `xp-multiplier-variants.ts`）として独立分離する pattern を継続するのが Turbopack 制約 8 度目の自然な拡張形。

- **`monthlyGranted` の意味変更（後方互換）**: 既存外部監視 / アラート / dashboard が `monthlyGranted` を「学習者数」前提で利用していた場合、意味が「実枚数」に変わるため要確認。後方互換用に `monthlyGrantedLearners` を併記済 = 観測側を `monthlyGrantedLearners` に切り替えれば旧挙動を再現可能。
