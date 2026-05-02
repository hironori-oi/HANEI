# Review Report — PRJ-016 / DEC-065 W12-T1（KPI ダッシュボード / admin 専用 read-only）

- 日時: 2026-05-03
- 担当: レビュー部門（独立判定 / dev 報告非依拠）
- 関連 atomic: DEC-065
- 検証範囲: 8 ファイル（新規 6 / 修正 2 / 計約 1,691 行）
- 検証手段: ファイル直読 + 罰語 grep + family/learner/user_id flow grep + DEC 突合 + middleware / metadata 突合

---

## 総合判定: **APPROVE_WITH_CONDITIONS**

Critical 0 件 / Major 1 件（軽微な構造改善 / 後追い OK）/ Minor 4 件 / Nit 2 件。

| 重要度 | 件数 |
|--------|-----|
| Critical | 0 |
| Major | 1 |
| Minor | 4 |
| Nit | 2 |

**条件**: Major M-1（`/admin/*` の middleware 第一層 / metadata noindex 不在）を W12-T2 着手前に follow-up commit で解消すること。本 atomic は read-only かつ機能的には authz 閉じているため、commit 自体は進行可とする。

---

## DEC 整合確認表

| DEC | 整合 | 確認内容 |
|-----|------|---------|
| **DEC-065**（本 atomic） | OK | §1〜8 のスコープに完全準拠。9 カード（3 retention + avg session + streak median + freeze usage + quest + badge + msg）・`requireAdmin()` 追加・layout + page 新設・unit 37 + E2E 4 ケース・新規 server action 0。dev 報告と実態一致。 |
| **DEC-024**（罰則ゼロ） | OK | UI 表示文字列・fallback catalog・unit grep・E2E grep の四層で構造的に担保。`grep -E "最下位\|ペナルティ\|サボ\|もうダメ\|失敗\|やりすぎ\|がんばってない\|だめ\|怠\|劣"` を `kpi-summary.ts` / `kpi.ts` / `(admin)/**` 配下に対し走らせ、ヒットは全て docstring 内の禁止語列挙のみ（ユーザー表示経路はゼロ）。 |
| **DEC-003**（三層認可） | OK（条件付き / Major M-1 参照） | 第二層 `requireAdmin()` は `requireAuth() → role !== "admin" なら redirect("/home")` で正しく構造化。第三層 SQL は `COUNT` / `SUM` / `AVG` / `GROUP BY` のみで family_id / learner_id / user_id の SELECT 句流出ゼロ（grep 確認）。`getRetentionDayN` の EXISTS 副照会は集約 COUNT のみ返すので個人特定不能。streak median は `currentStreak` 値配列のみ flow（learner_id は流れない）。第一層 middleware は M-1 で要強化。 |
| **DEC-006**（API surface 不変 / 10 GET / 5 mutation） | OK | 新規 server action 0（`"use server"` 一切無し / `kpi.ts` も `kpi-summary.ts` も非 server-action モジュール）。GET 経路は `/admin/kpi` SSR 1 件のみ追加で内部 admin route 扱い。mutation 5 不変。 |
| **DEC-055**（idempotency） | OK（該当無し） | read-only / write ゼロのため自動成立。 |

---

## レビュー詳細

### 1. `src/lib/auth/guards.ts` — `requireAdmin()` 追加（+18 行）

- `requireAuth()` を内部呼出 → `session.role !== "admin"` で `redirect("/home")` の構造は DEC-065 §1 / §2 と完全一致。
- `redirect` を投げるので throw して error boundary を汚染しない設計判断は妥当（middleware 風 UX）。
- 戻り値型 `Promise<AuthSession>` は role narrowing されていない（型上は parent / learner / admin の union のまま）が、実行時には role === "admin" 確定 / 呼び出し元で role 分岐は不要なので実害なし。**Nit N-1** 参照。
- 既存 `requireAuth` / `requireParent` / `requireLearnerOwner` のパターンと整合。eslint exception コメントの追加は本変更で不要（DB アクセス無し）。

### 2. `src/lib/admin/kpi-summary.ts` — 純関数 view-model（438 行 / 新規）

**構造**:
- DB I/O 0 / `"use server"` 不在 / Date 以外の副作用無し → Turbopack `"use server"` sync export ban 6 度目適用の正しい隔離。
- 数値正規化 helper（`safeNonNegInt` / `safeFiniteNumber` / `median` / `safeRatio` / `formatPercentage` / `formatCount` / `formatMinutes`）は防御プリミティブとして網羅的。
- `composeKpiDashboardView` は 9 カード固定順を必ず返す（raw が undefined の KPI も fallback card として描画）→ E2E が `data-kpi-id` で stable に当てる前提と一致。

**防御正規化の網羅性** (Critical 観点 / 良好):
- `safeNonNegInt`: 非数値 / NaN / Infinity / 負値 / undefined / 文字列 → 0（unit case で全網羅）
- `safeRatio`: denominator 0 / 負分母 / NaN numerator / Infinity → undefined
- `formatPercentage`: undefined / NaN は "——" / 1.2 は 100% / -0.1 は 0% にクランプ
- `median`: 空 → undefined / 偶数件 → 中央 2 件平均 / 奇数件 / NaN フィルタ / 元配列非破壊 / 非配列 throw
- `buildBadgeDistributionCard`: 非配列入力 → safeRaw=[] / 6 件以上 → 上位 5 件 slice / 同 count tie は `badgeId.localeCompare` で安定 / 空 label → "——"
- `composeKpiDashboardView`: 非 object 入力 throw / 無効 Date は `new Date(0)` fallback で ISO 文字列を必ず返す

**罰語不在の構造的担保**:
- fallback 文字列 catalog: `"——"` / `"母数 0 (まだ集計対象 cohort なし)"` / `"終了済 session 0 件"` / `"対象 learner 0 名"` / `"Freeze 取得 0 件 (まだ配布 / 購入なし)"` / `"対象 quest 0 件"` / `"獲得バッジ 0 件"` / `"集計データ未取得 (前向き fallback)"` / `"全 family 合算 (集約値のみ)"` 全て中立 or 前向き。
- 動的に流れる値（数値 / カウント / パーセンテージ）は性質上罰語混入経路無し。

### 3. `src/lib/admin/kpi.ts` — server-only helper（344 行 / 新規）

**SQL aggregate-only の構造的担保** (DEC-003 第三層 / 重要):
- 全 7 集計関数の SELECT 句に `family_id` / `learner_id` / `user_id` 個別カラムは flow しない（grep 検証）:
  - `getRetentionDayN`: `COUNT(*)` と `COUNT(DISTINCT u.id)` のみ。EXISTS 副照会は cohort 内の retained 数を集約取得するだけで個別 id は返さない。
  - `getAvgSessionMinutesLast7Days`: `COUNT(*)` + `SUM(...)`。
  - `getStreakStats`: `currentStreak` 数値配列のみ select（learner_id 不在）+ `COUNT(*)` 2 件。
  - `getDailyQuestCompletionLast7Days`: `COUNT(*)` + `SUM(CASE ...)`。
  - `getBadgeDistributionTop5`: `GROUP BY userBadges.badgeId, badges.name` で badge 集計のみ（user_id 不在）。
  - `getFamilyMessageFrequencyLast7Days`: `COUNT(*)` のみ。
- 第三層担保は **scopedQueries 不要なほど aggregate-only に振り切った** dev 主張と実装が一致。COPPA 準拠妥当。

**`safeAggregate` パターン**:
- per-task try/catch で 8 並列 Promise.all を fail-soft 化。1 KPI が SQL エラーになっても他 8 は正常表示で前向き fallback（DEC-024）。
- console.warn は非 production or `DB_DEBUG=1` で出力 → 本番運用ノイズ回避と Sentry 拾い上げのバランス OK。

**SQL 品質**:
- `unixSeconds(date)` で全日時を秒単位で揃え、SQLite (`users.createdAt` / `studySessions.startedAt`) の epoch 整数列との型整合 OK。
- `getDailyQuestCompletionLast7Days` のみ `gte(dailyQuests.createdAt, new Date(cutoff * 1000))` を Drizzle helper で渡す形式 → schema 確認すると `dailyQuests.createdAt` の型に依存。**Minor M-2** 参照。
- `EXISTS` 副照会で N+1 回避。retention は cohort window が小さいため index 利用は `users.created_at` / `learner_profiles.user_id` / `answer_logs.answered_at + learner_id` 想定だが、専用 index 追加判断は本 atomic 外（W12 後半 / Phase 2 観測駆動）。

**型安全性**:
- `any` 不在（grep 確認）/ strict null check 通過 / `Number(rows[0]?.cnt ?? 0)` パターン統一。
- drizzle `sql<number>` template 注釈で集約値の型推論は確保。

### 4. `src/app/(admin)/layout.tsx` — 16 行 / 新規

- thin wrapper で `<main className="min-h-screen bg-background">{children}</main>` のみ。DEC-065 §1 の「page.tsx 冒頭で `requireAuth()`」方針と整合（layout に認可を寄せず page で完結）。
- 既存 (parent) (auth) layout と独立 → admin 系ルート群（W12-T2 以降の `/admin/users` 等）への拡張余地確保。
- **Minor M-1** で metadata robots noindex の追加余地あり（後述）。

### 5. `src/app/(admin)/admin/kpi/page.tsx` — Server Component（127 行 / 新規）

- `export const dynamic = "force-dynamic"` で static render 抑止 → 認可ガードを毎リクエスト評価する正しい設計。
- `await requireAdmin()` → `getKpiDashboard()` の順で非同期処理が直列だが、認可優先の意図と整合（authz 失敗時は SQL も走らない）。
- `data-testid="admin-kpi-dashboard"` + `data-kpi-id={card.kpiId}` + `data-kpi-value={card.primaryValue}` + `data-kpi-row-id={row.id}` + `data-generated-at={view.generatedAtIsoUtc}` の観測属性付与は E2E hook として完備。
- `<ul><li>` セマンティック / `aria-hidden` Heroicon / `tabular-nums` 数値整形 → アクセシビリティ・可読性 OK。
- Heroicons 7 種 + 絵文字 0（grep で `😀-📊` 範囲ヒットゼロ確認）。
- React 19 / Next.js 16 整合: Server Component / async page / metadata export / dynamic export 全て規範通り。
- **Minor M-1**: ページ単位 `metadata.robots = { index: false, follow: false }` の上書きが無く、root layout の `index: true` が継承される懸念。

### 6. `tests/unit/admin.kpi.test.ts` — 37 ケース（512 行）

**分岐網羅性**:
- ヘルパ層 12 ケース: `safeNonNegInt` 2 / `safeFiniteNumber` 1 / `median` 6（空 / 奇 / 偶 / NaN / 非破壊 / throw）/ `safeRatio + formatPercentage` 3 / `formatCount + formatMinutes` 2
- compose 層 25 ケース: 全 fallback 3 / retention 3 / avg session 2 / streak 5（空 / 奇 / 偶 / freeze 0 / 通常）/ daily quest 2 / badge 4（0 / 3 / 7→5 / 罰語）/ msg 3 / 全カード罰語 1
- median 偶奇両対応・retention クランプ（999/10 → 100%）・badge 7 件入力で上位 5 件絞込 + tie-break by badgeId 昇順を明示確認。
- 罰語 grep `["最下位", "ペナルティ", "サボ", "もうダメ", "失敗", "やりすぎ", "がんばってない", "だめ", "やる気"]` に対し全 card text を `expect.not.toContain` → DEC-024 の構造的担保（dev 報告の 7 語に対し test 側は 9 語に拡張済 = 良好）。

**未検証分岐**:
- `kpi.ts` 側の SQL helper（`getRetentionDayN` 等）に対する unit 直テストは無し。SQL レイヤは E2E + 手動検証カバー（dev 主張通り Phase 2 内部運営用 / β ユーザー受入前の admin only）。本 atomic スコープ妥当（DEC-065 §6 「composeKpiDashboardView 全分岐網羅」のみ要求）。

### 7. `tests/e2e/admin-kpi.spec.ts` — 4 ケース（236 行）

- シナリオ A（admin 昇格 → 9 card 可視 + 罰語不在）/ シナリオ B（parent → /home redirect）の 2 軸 × chromium + mobile-chrome = 4 ケース。
- `promoteToAdmin` で signup 後の DB 直接 UPDATE → `clearCookies + 再ログイン` で better-auth `cookieCache.maxAge=5min` (`auth.ts:63`) の role 固着を構造的に解消するパターンは正しく診断・実装済。
- `test.describe.configure({ mode: "serial" })` + `execWithRetry` (16 回 / 100ms 〜 1500ms exponential backoff) は W11-T3 / W11-T5 で確立した SQLITE_BUSY 対策の正規再適用。
- `REQUIRED_KPI_IDS` 配列で全 9 card を `data-kpi-id` ベースに loop assert → 将来の card 追加 / 削除時に test 側更新が一箇所で済む保守性。
- 罰語検出は 7 語（`いきおい` 系の `やる気` は除外）→ unit より緩いが E2E は描画後 textContent の最終層 grep として機能十分。

### 8. `tests/e2e/fixtures/db-fixture.ts` — admin user fixture 追加

- `usr_e2e_admin_001 / admin-e2e@example.com / role='admin'` を追加。
- `family_members` に所属させない設計判断は admin の認可境界テストとして正しい（admin は family-scope 外）。
- 既存 fixture 互換（spec が直接参照しないため後方互換 OK）。

---

## Major 指摘

### M-1: `/admin/*` の第一層 middleware 不在 + metadata noindex 不在

**所見**:
- `src/proxy.ts` の `PROTECTED_PREFIXES = ["/home", "/onboarding", "/learner", "/coach", "/study"]` に `"/admin"` が含まれない。
- `/admin/kpi` 未ログイン GET → middleware 素通り → page.tsx 内 `requireAdmin()` → `requireAuth()` → `redirect("/login?redirect=...)` で機能的には authz 閉じている（実害無し）。
- ただし DEC-003 の「三層認可防衛」は 3 層全てを構造的に張る思想であり、第一層欠落は将来 `/admin/users` 等を追加する際の漏れリスク。
- 加えて `app/layout.tsx` の `metadata.robots = { index: true, follow: true }` が `/admin/kpi` にも継承される。実運用では URL 漏洩 + クローラ検出経路がある。

**影響**: 機能的には現状漏れ無し。構造的脆弱性 + SEO / leak 観点で改善推奨。

**推奨対応** (W12-T2 着手前 follow-up commit):
1. `proxy.ts` の `PROTECTED_PREFIXES` に `"/admin"` を追加（middleware で未認証時 `/login` へ早期 redirect）。
2. `(admin)/layout.tsx` または `(admin)/admin/kpi/page.tsx` に `export const metadata = { ..., robots: { index: false, follow: false } }` 上書き。

dev は本 atomic で機能要件は完遂しているため commit 阻害はしない。但し W12-T2（A/B test 基盤）着手時に admin 系 route が増えると漏れ拡大するため、その前に必ず修正。

---

## Minor 指摘

### M-2: `getDailyQuestCompletionLast7Days` の date 型変換のみ Drizzle helper 経由（軽微な一貫性）

`kpi.ts` 全体は `unixSeconds()` + `sql\`...\`` template で日時条件を渡しているが、`getDailyQuestCompletionLast7Days` のみ `gte(dailyQuests.createdAt, new Date(cutoff * 1000))` で Drizzle helper 経由 + Date オブジェクト渡し。schema 上 `dailyQuests.createdAt` の column 型に依存し、他 6 関数とパターンが揃わない。動作は問題なし（`drizzle-orm/sqlite-core` が integer 列に Date を渡すと epoch 変換するため）。

**推奨対応**: 後続 atomic で `sql\`${dailyQuests.createdAt} >= ${unixSeconds(cutoffDate)}\`` 形式に揃えると `kpi.ts` 内のクエリスタイル一貫性向上。

### M-3: `getBadgeDistributionTop5` の tie-break が SQL 側で非決定（label `null` 含む）

`ORDER BY desc(sql\`COUNT(*)\`)` のみで second key が無い。同 count の場合 SQLite の natural ordering に依存し、純関数 `buildBadgeDistributionCard` 側で `badgeId.localeCompare` 再ソートで決定論担保しているが、SQL レイヤで先に LIMIT 5 が走るため、6 件以上同 count の場合は SQL 段階で安定しない切り捨てが起きる可能性がある。

現状: badges seed が静的かつ件数小なので運用影響軽微。**推奨対応**: SQL に `.orderBy(desc(sql\`COUNT(*)\`), userBadges.badgeId)` の second key 追加で構造的に決定論化。

### M-4: `currentStreak` の SELECT で all rows fetch（潜在的 large scan）

`getStreakStats` が `db.select({ currentStreak: streaks.currentStreak }).from(streaks)` で WHERE 句なし。streak テーブルは learner 1 人 1 行（schema L447）のため理論上アクティブ learner 数 = 行数。Phase 2 / β 期では問題ないが、運用後 user 数 1 万超で N 行 fetch + JS median はメモリ・レイテンシで顕在化する。

**推奨対応**: W12 中後期で `LIMIT N` + 別途 percentile 集計（SQLite `WINDOW` 関数 or `NTILE`）への移行を検討。本 atomic スコープは β 前のため採用見送り妥当。

### M-5: `safeAggregate` console.warn が production で完全沈黙

`process.env.NODE_ENV !== "production" || process.env.DB_DEBUG === "1"` 分岐 → 本番では console.warn も出ない設計。Sentry 自動取込は `console.warn` 経由ではなく実 throw → `Sentry.captureException` が必要なため、本番で SQL 失敗が発生しても観測経路ゼロ。

**推奨対応**: `Sentry.captureException(err, { tags: { kpi: taskName } })` を try/catch の catch 節に追加（本 atomic 外でも可 / W12 後半 Sentry 強化 atomic で吸収可能）。

---

## Nit 指摘

### N-1: `requireAdmin` の戻り値型を narrow できる

```typescript
export interface AuthSessionAdmin extends AuthSession { role: "admin" }
export async function requireAdmin(): Promise<AuthSessionAdmin> { ... }
```
の形にすると呼び出し元で type guard 不要。現状 page.tsx は `await requireAdmin()` 戻り値を使わないため実害なし。

### N-2: `kpi-summary.ts` の `secondaryLabel` が一部 ASCII 半角 / 全角混在

例: `"使用 ${formatCount(...)} / 取得 ${formatCount(...)}"` は半角 / / 全角スペース、`"終了済 ${formatCount(...)} session を集計"` は半角・英単語混在。admin 内部画面なので運用影響無いが、`organization/rules/design-guidelines.md` の和文タイポグラフィ規範に揃えるなら全角統一。本件は admin のみ / 開発者向けのため deferred で OK。

---

## セキュリティ / プライバシー総括

| 観点 | 結果 |
|------|------|
| COPPA 配慮 / 13 歳未満児童の個人特定不可能性 | OK（aggregate-only / id flow ゼロ） |
| admin role 権限境界 | OK（admin 以外は redirect で完全隔離） |
| better-auth cookieCache 対策 | OK（E2E で構造的に解消パターン確立） |
| `/admin/kpi` の indexable 不可制御 | **要対応**（M-1 / `robots: noindex` メタ未設定） |
| SQL injection | OK（drizzle template literal で全パラメータ化）|
| XSS | OK（React 自動エスケープ / dangerouslySetInnerHTML 不在） |
| CSRF | OK（read-only / mutation 無し） |

---

## パフォーマンス総括

- 8 並列 `Promise.all` のレイテンシは「最遅 1 query」になる構造で適切。
- `force-dynamic` で毎リクエスト評価 = admin だけが触る low-traffic route のためコスト許容。
- median JS 計算: O(n log n) sort / streak 行数 = active learner 数 / Phase 2 β では問題なし（M-4 で将来手当）。
- N+1 不在（全関数が単一 aggregate query）。

---

## 結論

DEC-065 の atomic 完遂条件は満たしており、コード品質・テスト網羅性・DEC 整合は **APPROVE 水準**。

ただし三層認可防衛思想の「第一層」が `/admin/*` で抜けている点 + `noindex` 不在の 2 点は、W12-T2 以降 admin 系 route 拡張前に必ず手当すべき構造的弱点であり **APPROVE_WITH_CONDITIONS** 判定とする。

**条件**: M-1 を W12-T2 着手前の follow-up commit で解消（30 分作業 / dev に委ねる）。M-2〜M-5 / N-1〜N-2 は後続 polish 候補で本 atomic を阻害しない。

commit 進行は **可**。CEO 経由で dev に M-1 follow-up を申し送り。
