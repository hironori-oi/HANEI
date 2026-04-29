# Dev W10-T2: `/shop` UI 実装 完了レポート

- 案件: PRJ-016 HANEI
- スコープ: W10-T2 (DEC-056 案B)
- 日付: 2026-04-30
- 担当: Dev (Claude)
- 方針: アクセサリ category は出さない / 課金システム化禁止 (DEC-012) / 4 ボタン構成 / 共通 layer 残高バッジ

---

## 1. サマリー

W10-T2 の `/shop` UI を DEC-056 案B 仕様で 1 atomic commit 単位で実装。
2 category (Streak アイテム / ことだまトリのエサ) のみを露出し、
アクセサリ獲得経路は W9-B 解禁条件のみに集約 (DEC-052 slot mutex 保全)。
購入 Server Action は client-generated UUID を referenceId にした冪等性を持ち、
SQLite serialized writes + atomic conditional UPDATE で二重消費を防御。

E2E 3 ケース (残高不足 / 残高十分 / UI 連打) と既存スモーク全 7 ケースが
緑通し。typecheck / lint も clean。

---

## 2. 変更ファイル

### 新規追加
- `drizzle/0011_w10_shop_inventory.sql`
  - `learner_inventory` テーブル + `(learner_id, item_type)` UNIQUE INDEX
- `src/lib/economy/shop-prices.ts`
  - `SHOP_ITEM_TYPES` / `SHOP_CATEGORIES` / `SHOP_ITEMS` / `SHOP_ITEMS_BY_CATEGORY`
  - `canPurchaseAdditional()` / `isShopItemType()`
- `src/lib/actions/shop.ts`
  - `getInventoryFor(learnerId)` (Server Action)
  - `purchaseShopItem({learnerId, itemType, referenceId})` (Server Action)
  - 内部ヘルパ `getCoinBalanceInline` / `getQuantityInline`
- `src/app/(app)/shop/page.tsx`
  - 三層認可 + parallel fetch + 内部 Server Action `purchaseFromClient`
- `src/components/economy/HanekinBalanceHeader.tsx` (Server Component / 大表示)
- `src/components/economy/HanekinBalanceBadge.tsx` (Server Component / 小バッジ + Link)
- `src/components/shop/ShopCategorySection.tsx` (Client Component)
- `src/components/shop/ShopItemCard.tsx` (Client Component)
- `src/components/shop/ConfirmPurchaseDialog.tsx` (Client Component)
- `tests/e2e/shop.spec.ts` (3 ケース)

### 修正
- `src/lib/db/schema.ts`
  - `learnerInventory` table 定義追加 + 型 export (`LearnerInventory` / `NewLearnerInventory`)
- `src/app/(app)/layout.tsx`
  - `HanekinBalanceBadge` を共通 header に常時表示 (active learner = first learner で解決)
- `src/app/(app)/home/page.tsx`
  - 4 ボタン構成 (badges / accessories / messages / shop) に変更
  - `data-testid="home-shop-link"` 追加
- `tests/e2e/fixtures/db-fixture.ts`
  - migration list に `0011_w10_shop_inventory.sql` を追加

---

## 3. 主要 diff のポイント

### 3-1. 価格構成 (DEC-056 §価格設計に厳密準拠)
| item_type | 表示名 | 価格 | maxQuantity | reason |
|---|---|---|---|---|
| `streak_freeze` | Streak Freeze | 30 | 5 | `freeze_purchase` |
| `kotodama_feed_normal` | ふつうの エサ | 5 | null | `feed_purchase` |
| `kotodama_feed_premium` | とくじょうの エサ | 20 | null | `feed_purchase` |
| `kotodama_feed_rainy` | あめの日 エサ | 15 | null | `feed_purchase` |

### 3-2. 三層認可
- 第一層: middleware (proxy.ts)
- 第二層: `/shop/page.tsx` 冒頭で `requireAuth` + `requireLearnerOwner`
- 第三層: `purchaseShopItem` 内部でも `requireAuth` + `requireLearnerOwner` を再呼び出し
  (FormData 改ざん防御 / closure-bound learnerId と SQL 再確認の二重防御)

### 3-3. 冪等性 (二重消費防御)
- Client 側で `globalThis.crypto.randomUUID()` を生成して `referenceId` に load
- Server 側で `(learner_id, reason, reference_id)` の既存取引を SELECT で確認
- 既存あり → INSERT/UPDATE せず `skipped: true` で成功扱い
- 既存なし → 残高 / maxQuantity チェック → INSERT(coin_transactions, amount=-price)
  → UPDATE(learner_profiles.coin_balance, `WHERE coin_balance >= price`)
  → UPSERT(learner_inventory, `quantity += 1`) → revalidatePath('/shop')

### 3-4. 共通 layout 残高バッジ
- `(app)/layout.tsx` で `getSession()` → `getLearnersForParent` → 先頭 learner の `getCoinBalance`
- learner 未作成 (onboarding 中) は badge 非表示
- layout は `searchParams` を受け取れないため active learner は first learner で fallback
  (`/shop` への深いリンクは badge クリック → `/shop?learner=<id>`)
- 各ページ内の active learner 切替 (e.g. `/home` の `LearnerSwitcherTabs`) は別経路

### 3-5. 残高不足 UX
- 残高 < price のとき「ハネキンが N 個 たりないよ」+ 「クエストで ためる」CTA
- CTA は `/quests?learner=<id>` を指す (Daily Quest 経路で稼ぐ誘導 / 課金導線ゼロ)

### 3-6. アクセサリ category 排除 (DEC-052 / DEC-056 切り分け)
- ショップでは buy できない旨の Card + `/settings/accessories` への Link を表示
- 「アクセサリは ことだまトリと いっしょに がんばると もらえるよ」のヘルプ文言

---

## 4. 検証結果

### 4-1. Typecheck
```
$ npm run typecheck
> hanei@0.1.0 typecheck
> tsc --noEmit
```
→ **clean (0 errors)**

### 4-2. Lint
```
$ npm run lint
> hanei@0.1.0 lint
> eslint .
```
→ **clean (0 warnings / 0 errors)**

### 4-3. Build
- `next build` 成功 / `/shop` が dynamic route として登録
- `Sentry` の deprecation warning は既存 / 本タスク起因ではない

### 4-4. E2E (Playwright / chromium)
- `tests/e2e/shop.spec.ts` (新規 / 3 ケース)
  - 残高不足: balance=0 で /shop を踏んでも buy ボタンが出ず、shortfall=30 と
    クエスト誘導が表示される。DB 状態変化なし
  - 残高十分: balance=50 → buy → confirm → 残高 20 / 在庫 1 / coin_transactions +1
  - UI 連打: confirm ボタン dispatchEvent('click') を 2 連発しても 1 回しか
    purchase が走らない (在庫 1 / 取引 1 / 残高 30) — pending state による二度目 disabled
- 既存スモーク regression
  - `study-smoke.spec.ts` (1 ケース) 緑
  - `parent-dashboard-flow.spec.ts` (3 ケース) 緑
  - `mock-exam-flow.spec.ts` (3 ケース) 緑
- 合計 **3 + 7 = 10 ケース 全緑**

### 4-5. アクセシビリティ
- aria-label: 全ボタン日本語固定 (e.g. `Streak Freezeを 30 ハネキンで 買う`)
- aria-live: 結果メッセージ / 受験日カウントダウンは `aria-live="polite"`
- ruby furigana: 商品名 + ふりがな
- `min-h-tap-cta` で 44px tap target 確保
- 残高 region に `aria-label="いまの ハネキン ざんだか: N 個"`
- Heroicons のみ使用 (絵文字ゼロ)

### 4-6. Lighthouse a11y
- 既存 W9-Polish の a11y 100 を維持できる構造のみ追加 (alt / aria-label / contrast 既守)
- 自動測定は webServer 立ち上げを伴うため本コミットでは未実行 / 次タスク (W10-T3 以降)
  での回帰測定を推奨

---

## 5. 残課題 / 申し送り

1. **`/quests` ルート未実装**: shortfall CTA から飛ぶ先 `/quests?learner=<id>` は
   W10-T3 (Daily Quest UI) で実装予定。現状は 404 になる。
2. **Layout 残高バッジの active learner**: `(app)/layout.tsx` は `searchParams` を
   取れないため first learner で fallback している。複数 learner 家庭で `?learner=<id>`
   を切り替えると header badge と各ページ active learner が乖離する見え方になる。
   - 短期: 致命的でないため許容 (各ページの `HanekinBalanceHeader` は active learner で正確)
   - 中期: cookie に `last_active_learner_id` を保存 → layout で読む方式に切替検討 (W11 以降)
3. **Idempotency の race**: SQLite serialized writes に依存しており完全な atomic
   ではない。冪等チェック → INSERT の間に同 referenceId が並列で来ると二重 INSERT の
   理論的余地がある (実運用では client UUID なので衝突確率ゼロ近傍)。`coin_transactions`
   側に `(learner_id, reason, reference_id)` の DB UNIQUE 制約を追加すれば構造的に防げる
   が、DEC-055 既存 schema 変更を伴うため本コミットでは見送り。
4. **`maxQuantity` 表示**: streak_freeze は max 5 / feed は無制限。UI は
   `maxQuantity !== null` で「N / 5 もっている」、null は「N 個 もっている」と
   分岐済み。
5. **雨の日エサ (`kotodama_feed_rainy`)**: 価格枠だけ確保。Phase 3 の天気 API 連動が
   入るまでは購入してもエフェクトは出ない (mood 加算ロジックが未実装)。
6. **`HanekinBalanceBadge` の learnerId fallback**: 未ログイン or learner 未作成の
   ユーザーには badge を出さない (header は SiteHeader のみ表示)。

---

## 6. レビュー部門 引継ぎ

### コードレビュー観点
- [ ] 三層認可 (page / Server Action 内部 / SQL learner_id スコープ) の網羅性
- [ ] `purchaseShopItem` の冪等チェック → INSERT 間の race リスク評価
- [ ] `(app)/layout.tsx` の first-learner fallback の UX 影響評価
- [ ] アクセサリ category が出ないこと / `/settings/accessories` Link の網羅性
- [ ] 子ども向け語感のレビュー (ふりがな / aria-label 日本語固定)
- [ ] Heroicons 以外の絵文字 / 顔文字が混入していないこと
- [ ] DEC-052 (slot mutex 保全) と DEC-056 (Shop UI) の境界が守られていること

### テストレビュー観点
- [ ] `shop.spec.ts` 3 ケースの境界網羅性
- [ ] 連打 case が DispatchEvent 経由なので、実 UA の click 連打 (pointerdown /
      pointerup) と挙動差がないか
- [ ] regression 7 ケース全緑

### コミット
- 単一 atomic commit (本タスク完了時に予定 / push なし / CHANGELOG 更新なし)
- メッセージ: `feat(shop): W10-T2 /shop UI atomic — Streak Freeze + kotodama feed only (DEC-056 案B)`

以上。
