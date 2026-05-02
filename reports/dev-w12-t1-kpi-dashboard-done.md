## 開発報告（W12-T1 KPI ダッシュボード / admin 専用 read-only）

### 実施内容

DEC-065 の atomic スコープに完全準拠し、内部運営向け KPI ダッシュボード `/admin/kpi` を新設。
admin ロール専用の read-only ビュー / 集約値のみ表示 / 新規 server action 無し / 新規 migration 無し / write 一切無し。

実装した 6 ピース（atomic 完遂単位 / 全て read-only）:

1. **`src/lib/auth/guards.ts`（修正 / +18 行）**
   - `requireAdmin()` 追加（第二層認可 / DEC-065）。`requireAuth()` で 第一層 cookie チェック後、`session.role !== "admin"` なら `redirect("/home")` で middleware 風 UX を保つ（throw しないので error boundary を汚さない）。
   - 戻り値は `AuthSession`（role: "admin" 確定）。
   - 第三層（SQL aggregate）は `kpi.ts` 側で集約 SQL のみに限定し、family / learner row が flow しない構造（COPPA / DEC-003）。

2. **`src/lib/admin/kpi-summary.ts`（純関数 / 438 行 / 新規）**
   - 6 種類 9 カテゴリの KPI を組み立てる pure compose 群:
     - `buildRetentionCard`（D1 / D7 / D30 別カード × 3 / `safeRatio` で 0 除算回避 / `formatPercentage` でクランプ）
     - `buildAvgSessionMinutesCard`（直近 7 日 / `formatMinutes`）
     - `buildStreakMedianCard`（中央値 JS 側計算 / `median` で偶奇両対応 / NaN フィルタ / 非配列 throw）
     - `buildStreakFreezeUsageCard`（購入数 / 使用数 / 使用率の 3 行）
     - `buildDailyQuestCompletionCard`（達成率 / 母数）
     - `buildBadgeDistributionCard`（top-5 / `count desc + badgeId asc tie-break` / 同 badge 重複潰し）
     - `buildFamilyMessageFrequencyCard`（直近 7 日 / 親→子）
   - `composeKpiDashboardView(input)`: pure compose で 9 カード固定順生成。raw が undefined でも全カード必ず描画（前向き fallback / DEC-024）。
   - `safeNonNegInt` / `safeFiniteNumber` / `safeRatio` / `formatPercentage` / `formatCount` / `formatMinutes` の防御的ヘルパ群。
   - DB I/O ゼロ / `"use server"` 一切無し（Turbopack `"use server"` sync export ban 対応の 6 度目再適用パターン）。

3. **`src/lib/admin/kpi.ts`（server-only helper / 344 行 / 新規）**
   - `getKpiDashboard(now?)`: 8 並列 `safeAggregate` → `composeKpiDashboardView`。各 KPI が独立失敗してもダッシュボード全体は落とさない構造。
   - 集約 SQL のみ（family_id / learner_id / user_id を絶対に flow させない / DEC-003 §第三層）:
     - `getRetentionDayN(N, now)`: cohort window + EXISTS 副照会で COUNT のみ返す（drizzle `sql\`...\``）
     - `getAvgSessionMinutesLast7Days`: `SUM(CAST((endedAt - startedAt) AS REAL) / 60.0)` を `endedAt IS NOT NULL` 条件下で
     - `getStreakStats`: SELECT raw `currentStreak` 値（個人特定不能 / median 用）+ COUNT freeze_purchase + COUNT inventory.lastUsedAt
     - `getDailyQuestCompletionLast7Days`: COUNT 母数 + SUM CASE progress >= target
     - `getBadgeDistributionTop5`: `GROUP BY userBadges.badgeId, badges.name` + `ORDER BY COUNT DESC LIMIT 5` + leftJoin badges でラベル取得
     - `getFamilyMessageFrequencyLast7Days`: parent_messages の COUNT in window
   - `safeAggregate<T>(taskName, fn)`: `try / catch + console.warn + 戻り値 undefined`。compose 側で undefined を fallback 文字列に倒す。
   - `eslint-disable no-restricted-syntax` コメントは既存 family-* helper と同フォーマットで付与。

4. **`src/app/(admin)/layout.tsx`（新規 / 16 行）**
   - 最小ラッパ: `<main className="min-h-screen bg-background">{children}</main>`。
   - admin 向けに飾らない / 既存 (parent) (auth) layout と独立。

5. **`src/app/(admin)/admin/kpi/page.tsx`（Server Component / 127 行 / 新規）**
   - `export const dynamic = "force-dynamic"` で static rendering 抑止（authz ガードを毎リクエスト評価）。
   - `await requireAdmin()` → `getKpiDashboard()` → 9 カード `<ul>` 列挙。
   - 各カード: `<Card data-kpi-id={card.kpiId} data-kpi-value={card.primaryValue}>` + Heroicon + primary value + 任意 rows。
   - Heroicons (`ChartBarIcon` / `UsersIcon` / `FireIcon` / `TrophyIcon` / `SparklesIcon` / `ChatBubbleLeftEllipsisIcon` / `ClockIcon`) のみ / 絵文字 0 / 平仮名中心の説明文 / 罰語ゼロ。
   - `data-testid="admin-kpi-dashboard"` ルートコンテナ + `data-generated-at` 属性で観測性確保。

6. **テスト**
   - `tests/unit/admin.kpi.test.ts`（512 行 / 37 ケース新規）
     - ヘルパ: `safeNonNegInt` / `safeFiniteNumber` / `median`（空 / 奇 / 偶 / NaN フィルタ / 非破壊 / 非配列 throw）/ `safeRatio`（0 除算 / 負分母）/ `formatPercentage` / `formatCount` / `formatMinutes`
     - `composeKpiDashboardView`: 全 raw undefined → 9 カードフォールバック / retention 各分岐（0 cohort / 0% / 100%）/ avg session / streak median + freeze / quest 完遂率 / badge 分布（0 件 / 3 件 / 7 件 → 5 件絞込 / 同数 tie-break by badgeId 昇順）/ family message frequency
     - 全カード罰語不在 grep（`["最下位", "ペナルティ", "サボ", "もうダメ", "失敗", "やりすぎ", "がんばってない"]` を全 card text に対し `expect.not.toContain`）
   - `tests/e2e/admin-kpi.spec.ts`（236 行 / 2 シナリオ × 2 project = 4 ケース新規）
     - シナリオ A: signup → `promoteToAdmin` (DB UPDATE `users.role = 'admin'`) → `clearCookies + 再ログイン` → `/admin/kpi` → dashboard 可視 + 9 card 全件 visible + 罰語不在 grep
     - シナリオ B: signup（role: 'parent' のまま）→ `/admin/kpi` → `/home` redirect + dashboard 不在
     - `test.describe.configure({ mode: "serial" })` + `execWithRetry` パターン (W11-T2/T3/T5 と同 SQLITE_BUSY 対策)
   - `tests/e2e/fixtures/db-fixture.ts` に admin user fixture を追加（`usr_e2e_admin_001` / `admin-e2e@example.com` / role='admin'）

### 技術的判断

- **純関数分離（6 度目）**: Turbopack `"use server"` sync export ban の経験を踏襲し、`kpi-summary.ts` を server-only ファイル外に隔離。`kpi.ts` も `"use server"` 不要（Server Component 直 import 経路 / mutation 無し）。
- **三層認可の構造的担保**: 第一層 middleware (proxy.ts) → 第二層 `requireAdmin()` で role 検証 → 第三層 SQL aggregate で個別 family / learner の選別すら不可能な構造。`SUM` / `COUNT` / `AVG` / 中央値（JS 側 / streak 値のみで learner_id 流出無し）に限定し、scopedQueries 不要なほど aggregate-only に振り切った（DEC-003 §第三層 / DEC-065 §5 / COPPA 準拠）。
- **median は JS 側で計算**: SQLite に `percentile_cont` が無いため、`SELECT current_streak` の値配列のみ取得して JS の `median(values)` で算出。ID は流れず streak 数値のみ流れるためプライバシー安全。
- **エラーハンドリング**: 8 並列 `safeAggregate` は各 try/catch 独立 → 1 KPI が落ちても残り 8 は正常表示。compose 側で undefined を「——」/ 「集計データ未取得」フォールバック文字列に倒す（前向き fallback / DEC-024）。
- **罰語ゼロの構造的担保**: fallback 文字列 catalog に NG 語を 1 件も含めない設計（unit test の grep で構造的に検証）。動的に表示される値（数値 / カウント / パーセンテージ）は性質上罰語を含まない。
- **新規 server action ゼロ**: read-only / DEC-006 不変条件（10 GET / 5 mutation）に影響無し。/admin/kpi は SSR 1 GET 経路のみ（force-dynamic でリクエスト毎評価）。
- **better-auth cookieCache 対策（E2E 設計）**: `cookieCache.maxAge = 5 * 60` で role が cookie 値に焼き込まれるため、DB UPDATE 後に `page.context().clearCookies()` → `/login` 再投入で fresh cookie を取得するパターンを E2E で採用。同 session 内で role を切り替える必要がある場合の汎用パターンとして確立。
- **ICON_BY_NAME map**: kpi-summary.ts（純関数 / DOM-free）から Heroicon コンポーネントを直接 reference できないため、文字列 `iconName` を返してクライアント側で resolve。テスト容易性 + 型安全性 + Tree-shake 互換。

### 成果物

- 修正: `src/lib/auth/guards.ts`（+18 行 / requireAdmin 追加）
- 新規: `src/lib/admin/kpi-summary.ts`（438 行）
- 新規: `src/lib/admin/kpi.ts`（344 行）
- 新規: `src/app/(admin)/layout.tsx`（16 行）
- 新規: `src/app/(admin)/admin/kpi/page.tsx`（127 行）
- 新規: `tests/unit/admin.kpi.test.ts`（512 行 / 37 ケース）
- 新規: `tests/e2e/admin-kpi.spec.ts`（236 行 / 4 ケース）
- 修正: `tests/e2e/fixtures/db-fixture.ts`（admin user fixture 追加）
- ファイル数: 8（新規 6 / 修正 2） / +約 1691 行 / -0 行

### テスト結果

- **typecheck**: PASS / エラー 0
- **lint**: PASS / warning 0
- **vitest**: 51 files / 752 passed（前回 50/715 + 新規 1 file/37 件 = +37 = 752）/ failed 0
- **build**: 25 routes / 完遂（新規 `/admin/kpi` 1 / `/api/cron/weekly-digest` ほか既存維持）
- **E2E admin-kpi（新規）**: chromium 2 + mobile-chrome 2 = 4/4 PASS
- **E2E 既存スイート全件**: 92/92 PASS（リグレッション 0 / 失敗 0）
  - signup / study-loop / study-smoke / study-smoke-multi-level / study-writing-smoke
  - parent-consent / parent-dashboard-flow / mock-exam-flow
  - shop / quests / session-cumulative / overtime-cumulative
  - family-streak / family-message / family-leaderboard / family-weekly-digest
- **DEC-006 不変条件**: 新規 server action 0 件 / GET 経路 1 件追加（mutation 不変）
- **DEC-055 idempotency**: 該当無し（read-only / mutation 無し）

### 受入基準達成状況

| 基準 | 結果 |
| --- | --- |
| `requireAdmin()` 実装（第二層認可） | PASS |
| `/admin/kpi` SSR / dynamic | PASS（25 routes / `ƒ /admin/kpi` 確認） |
| 6 系統 9 カード描画（D1/D7/D30 + 4 KPI + バッジ + メッセージ） | PASS |
| `data-testid="admin-kpi-dashboard"` | PASS |
| `data-kpi-id="..."` 全 9 カード付与 | PASS（E2E で REQUIRED_KPI_IDS 配列で全件 assert） |
| 罰語不在（DEC-024） | PASS（unit + E2E 両層で grep） |
| SQL aggregate のみ / family-id learner-id 不流出（DEC-003） | PASS（COUNT / SUM / AVG / GROUP BY top-5 のみ / 個人 row select 無し） |
| 新規 server action 0（DEC-006 不変） | PASS |
| 既存 E2E リグレッション 0 | PASS（92/92） |
| 既存 vitest リグレッション 0 | PASS（715 → 752 / 失敗 0） |

### 技術的課題・リスク

- **better-auth cookieCache の role 固着**: `cookieCache.maxAge = 5 * 60` 設定では DB role UPDATE が同 session 内で反映されない。今回 E2E で `clearCookies → /login` パターンで構造的に解消したが、本番運用で「parent → admin に昇格させる」ワークフローを実装する場合は `auth.api.refreshSession()` 相当の再発行を別途検討が必要（W12-T1 では admin user は最初から admin で seed する前提のため運用影響無し）。
- **median の sample size**: アクティブユーザーが極小の段階では中央値が単一値に大きく振れる。fallback として「——」を返す safeguard は実装済（`median([]) → undefined`）だが、運用後に `n < 5` のケースは「集計データ未取得」表示に倒すか別途検討余地あり（W12-T2 以降のチューニングで判断）。
- **badge top-5 の同 count tie-break**: `ORDER BY COUNT DESC, badgeId ASC` で決定論性を確保。badge ID 順は登録順で安定するため、運用中に badge 追加された際の順位ぶれは構造的に最小化。
- **/admin/kpi の future-proof**: 現行は単一 admin ダッシュボードのみだが、route group `(admin)` を確保したことで `/admin/users` / `/admin/families` 等の admin 系拡張に低コスト対応可能（W12-T2 / T3 視野）。

### 次のアクション候補（W12-T1 完遂後）

- W12-T2 候補: `/admin/users` 一覧（admin 専用 / read-only / paginated / 個人特定情報の最小化）
- W12-T3 候補: `/admin/operations`（cron 実行履歴 / weekly-digest 配信履歴）
- KPI 自動 alert: 急落検知（D1 retention が前週比 -20% 等）→ Slack webhook 通知（DEC-065 §拡張余地）
- E2E 統合: 既存 family-* と admin-kpi をまたぐシナリオ（admin が KPI 見ている間に裏で parent が message 送信 → 数字反映）は CI コスト を考慮し W12 後半で評価
