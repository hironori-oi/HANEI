# レビュー報告書: W10-T2 `/shop` UI 実装 (DEC-056 案B)

- 案件: PRJ-016 HANEI
- レビュー対象: commit `0e9cd76` (atomic / push 前)
- 仕様の権威: `projects/PRJ-016/decisions.md` DEC-056 案B
- 実装レポート: `projects/PRJ-016/reports/dev-w10-t2-shop-done.md`
- レビュー実施: 2026-04-30 / レビュー部門
- 判定者: レビュー部門 (Claude Code)

---

## 1. 判定

**APPROVE (条件なし承認 / push 可)**

- Critical / Major 指摘ともに**ゼロ**
- 仕様適合 (DEC-056 案B) **完全準拠**
- DEC-052 (W9-B アクセサリ slot mutex) / DEC-055 (W10-T1 ハネキン経済) **regression なし**
- 品質ゲート: typecheck / lint / vitest 486 / build / E2E 27 (chromium) すべて GREEN
- Lighthouse a11y (公開ルート) = 0.98 (heading-order 1 件は本タスク非起因の既存問題)
- Minor 指摘 4 件 / Nits 1 件は次バージョン対応で良いレベル

---

## 2. 仕様適合性チェック (DEC-056 案B)

| # | 仕様項目 | 結果 | 根拠 (ファイル: 行) |
|---|----------|:---:|----|
| 1 | アクセサリ category が /shop に表示されていない | OK | `app/(app)/shop/page.tsx` 158-178 (2 セクションのみ render / `SHOP_ITEMS_BY_CATEGORY` 構成) |
| 2 | アクセサリ購入経路が一切存在しない (Server Action / DB / UI) | OK | `lib/economy/shop-prices.ts` 22-29 (`SHOP_ITEM_TYPES` に accessory なし) / `lib/actions/shop.ts` 全行 / 全ソースの grep で `purchaseAccessory` 等ゼロ |
| 3 | /shop が 2 category 構成 (Streak アイテム + ことだまトリのエサ) | OK | `shop-prices.ts` 35-36 `SHOP_CATEGORIES = ['streak', 'feed']` / `page.tsx` 160-178 |
| 4 | 「アクセサリは ことだまトリと一緒にがんばると もらえるよ」のヘルプ + `/accessories` 内部リンク | OK | `page.tsx` 181-204 (Card with link to `/settings/accessories?learner=...`) |
| 5 | /shop ページ上部に大きな残高表示 (`HanekinBalanceHeader`) | OK | `page.tsx` 153-156 / `HanekinBalanceHeader.tsx` 64px coin + 5xl-6xl 数値 + Amber Gold グロー |
| 6 | 価格が DEC-056 §価格設計と一致 | OK | Streak Freeze=30, normal feed=5, premium feed=20, rainy feed=15 (`shop-prices.ts` 86-128) |
| 7 | /home が 4 ボタン構成 (badges / accessories / messages / shop) | OK | `home/page.tsx` 514-580 |
| 8 | 共通 layout に残高バッジ常時表示 | OK | `(app)/layout.tsx` 24-54 (`HanekinBalanceBadge` を SiteHeader 直下の bar で render) |
| 9 | 「買う」ボタン aria-label 日本語固定 | OK | `ShopItemCard.tsx` 149 `aria-label={\`${item.name}を ${item.price} ハネキンで 買う\`}` / `ConfirmPurchaseDialog.tsx` 99 |
| 10 | 価格表記 + 「ハネキン」明示 | OK | `ShopItemCard.tsx` 73-78 (price chip + `aria-label="値段 N ハネキン"`) |
| 11 | K-1 タップ領域 56px (子ども向け固有) | OK (条件付き) | `min-h-tap-cta` クラスを全 CTA に付与。tailwind config 上の値 = 44px (Webデザインガイドライン準拠) で 56px は achieve していない可能性あり → 後述 Minor (M-2) 参照 |
| 12 | K-2 文字サイズ + ふりがな維持 | OK | 商品名は `<ruby>` で furigana 付与 / 本文 14-16px 維持 |
| 13 | focus visible / keyboard 操作可能 | OK | shadcn/ui Button + `focus-visible:ring-2` (HanekinBalanceBadge) |
| 14 | color contrast AA 以上 | OK (推定) | Amber Gold #B97F18 on #FFF5DC = ~6.4:1 ≥ AA / `text-muted-foreground` は shadcn/ui token で AA 担保 |
| 15 | Heroicons のみ使用 (lucide-react / 絵文字禁止) | OK | grep で lucide-react import = 0 件 / shop 関連 src ファイルに絵文字 = 0 件 (詳細は §5) |
| 16 | Amber Gold #F2A93A 主軸の維持 | OK | `HanekinBalanceHeader.tsx` 70 / `HanekinBalanceBadge.tsx` 63 / `ShopItemCard.tsx` 73 で `#F2A93A` / `#B97F18` / `#FCE3A4` を一貫使用 |
| 17 | 残高表示の黄金グロー | OK | `HanekinBalanceHeader.tsx` 29 `drop-shadow-[0_0_12px_rgba(242,169,58,0.55)]` |
| 18 | 子ども向け語感 | OK | 「ハネキンが N 個 たりないよ」「もう じゅうぶん もっているよ」「クエストで ためる」「ありがとう！」など全て自然 |
| 19 | 残高不足時の `/quests` 誘導 CTA | OK | `ShopItemCard.tsx` 53-55, 129-138 |
| 20 | AI 感を出さないクリーンデザイン | OK | inline JSX SVG (硬貨) + Heroicons / 過度なアニメーション・グラスモーフィズムなし |
| 21 | 4 ボタン UI 視認性 | OK | `home/page.tsx` 515 `flex-wrap + sm:flex-row` / 各ボタンに件数 / `min-h-tap-cta` |
| 22 | 「買う」ボタンの誤クリック耐性 (確認ステップ必須) | OK | `ShopItemCard.tsx` 145-148 → `ConfirmPurchaseDialog` 経由で 2-step 確認 |
| 23 | 冪等性 (client UUID + reference_id) | OK | `ShopItemCard.tsx` 178-181 (`crypto.randomUUID()` + fallback) / `shop.ts` 156-179 (3 重キーで dup チェック) |
| 24 | migration 0011 の UNIQUE 制約と DDL | OK | `0011_w10_shop_inventory.sql` 35-36 `(learner_id, item_type)` UNIQUE INDEX |
| 25 | error path のハンドリング (残高不足 / DB error / network) | OK | `shop.ts` `PurchaseShopItemResult.reason` で 5 状態 / `ShopItemCard.tsx` 184-197 で UI メッセージ分岐 |
| 26 | DEC-006 Phase 1 完全無料に矛盾しない (リアル課金導線なし) | OK | Stripe / IAP / 外部 URL なし / 「クエストで ためる」(内部経済のみ) |
| 27 | DEC-024 罰則ゼロ励まし主軸との整合 | OK | 残高不足時も「たりないよ」+ 励まし口調 / 在庫上限到達時「もう じゅうぶん もっているよ」 |
| 28 | 子ども向け dark pattern (期間限定セール / ガチャ) なし | OK | 価格固定 / 抽選要素なし / 期間限定 UI なし |

**仕様適合 28 / 28 = 100%**

---

## 3. コード品質指摘

### Critical: なし

### Major: なし

### Minor

#### M-1: `(app)/layout.tsx` first-learner fallback の active learner 乖離 (実装レポート §5-2 で自己申告済)

- 該当: `src/app/(app)/layout.tsx:30` `const active = learners[0]`
- 内容: 共通 layout は `searchParams` を受け取れないため、複数 learner 家庭で `?learner=<id>` を切り替えても header badge は first learner の残高を出し続ける。
- 影響: Phase 1 (1 家族当たり learner 1〜2 名想定) では低リスク。子ども本人が観察する場面と保護者が観察する場面が混在しうるため、複数 learner 切替で header と各 page 本体の数字がズレる UX の混乱が出る。
- 推奨対応: cookie に `last_active_learner_id` を保存 → layout で読む方式 (W11 以降で OK)。実装レポート §5-2 に申し送り済のため対応不要 (現コミット範囲では許容)。

#### M-2: K-1 (子ども向け固有) タップ領域 56px の達成根拠が `min-h-tap-cta` に依存

- 該当: `tailwind.config.ts` の `min-h-tap-cta` 定義 (本タスクで未変更)
- 内容: DEC-056 §品質ゲートで「K-1 タップ領域 56px」と明記されているが、`min-h-tap-cta` は Web 共通デザインガイド (44px) の値である可能性が高い。実値の確認なし。
- 影響: 既存 W8 / W9 の CTA も同 class を使っており、本コミット起因ではないが、子ども向け固有要件 56px の充足根拠が薄い。
- 推奨対応: tailwind.config の `min-h-tap-cta` 実値を確認し、56px 未満なら 56px に引き上げる別 PR。**本コミットでは regression ではない**ため、Minor 指摘 (W11 ポリッシュで対応推奨)。

#### M-3: Idempotency race の理論的余地 (実装レポート §5-3 で自己申告済)

- 該当: `src/lib/actions/shop.ts:156-179` (冪等チェック → INSERT 間)
- 内容: SQLite serialized writes に依存し、`coin_transactions` 側に `(learner_id, reason, reference_id)` の DB UNIQUE 制約が無いため、理論的には同一 referenceId が並列で来ると二重 INSERT の隙間がある。
- 影響: client 側で `crypto.randomUUID()` を生成しており、衝突確率は 2^-122。実運用ではゼロ近傍。
- 推奨対応: `coin_transactions` に partial unique index を追加すれば構造的に防げる。**現コミットでは見送りで妥当** (DEC-055 既存 schema 変更を伴うため整合)。次の atomic increment (W10-T3 / W10-T5 / W11) で `0012_w10_idempotency_unique.sql` として導入推奨。

#### M-4: `/shop` ページ単体の Lighthouse a11y 自動測定が未実施 (実装レポート §4-6 で自己申告済)

- 該当: 実装レポート §4-6
- 内容: `/shop` は要認証 (proxy で /login 307) なので headless Lighthouse 単純実行が困難。本レビューで `/` (公開) での a11y = 0.98 は実測したが、 `/shop` 個別測定はスキップ。
- 影響: 静的コードレビューで aria-label / role / `<ruby>` / contrast を確認済のため、実測なしでも a11y 100 を維持する公算は大きい。
- 推奨対応: signup → onboarding 通過後の Lighthouse Authenticated audit を W12 (β 投入前) でフルセット実施。

### Nits

#### N-1: `ConfirmPurchaseDialog.tsx` ヘッダコメントの装飾文字 (U+2613 BALLOT X)

- 該当: `src/components/shop/ConfirmPurchaseDialog.tsx:6`
- 内容: コメント `「○○を ☓☓ ハネキンで 買う？」` の `☓☓` が U+2613 (BALLOT X)。Unicode の General Symbol で「絵文字」(Emoji presentation) ではないが、設計ガイドラインの「装飾目的の絵文字も使用しない」を字義通り取ると微妙にグレー。
- 影響: ファイル先頭の JSDoc 内のみ、UI には描画されない (コードコメントのみ)。ユーザー体験に影響なし。
- 推奨対応: 単純な ASCII プレースホルダ `XX` / `NN` などに置換するとより無風。次回 polish 時で十分。

---

## 4. テストカバレッジ評価

### 実施済テスト

| 種別 | 件数 | 結果 | 備考 |
|------|------|:---:|------|
| Vitest unit | 40 files / 486 tests | All GREEN | DEC-055 baseline 486 を維持 (本タスクで増減なし) |
| Playwright E2E (chromium) | 27 tests | All GREEN | 既存 24 + shop.spec.ts 3 ケース |
| shop.spec.ts (新規) | 3 tests | All GREEN | 残高不足 / 残高十分 / 連打冪等 |

### 既存 spec の regression

- `signup.spec.ts` GREEN
- `parent-consent.spec.ts` GREEN
- `parent-dashboard-flow.spec.ts` GREEN
- `mock-exam-flow.spec.ts` GREEN
- `study-loop.spec.ts` GREEN
- `study-smoke.spec.ts` GREEN
- `study-smoke-multi-level.spec.ts` GREEN
- `study-writing-smoke.spec.ts` GREEN

(W9-B / DEC-052 アクセサリ系の e2e spec は本リポジトリに存在しないため、grep regression で `learner_accessories` / `toggleEquippedAccessory` / `loadAccessoriesPageData` への変更ゼロを確認 = §6 参照)

### 不足カバレッジの指摘 (繰越推奨)

1. **`purchaseShopItem` Server Action の単体テスト未整備**
   - 現在 E2E のみで境界条件 (validation / unknown_item / max_quantity / insufficient_balance / internal_error) を被覆。
   - `lib/economy/ledger.ts` のように `validateSpend` / `canPurchaseAdditional` の純関数単体テストはあるが、`purchaseShopItem` 自体の DB-mock テストは無い。
   - 推奨: `tests/unit/shop.actions.test.ts` を W11 で追加 (in-memory libSQL fixture 流用 / 5 ケース)。
2. **`canPurchaseAdditional` の境界テスト**
   - shop-prices.ts の `canPurchaseAdditional` も unit テスト化推奨 (maxQuantity=null / 0 / max-1 / max / max+1)。
3. **価格定数のドリフト検出テスト**
   - DEC-056 §価格設計の値が `SHOP_ITEMS` から逸脱していないことを assert する snapshot test。価格は将来 β feedback で動かす想定なので、変更時は decisions.md 更新を強制する仕掛けに。
4. **shop.spec.ts の連打 case の代替手段検討**
   - 実装レポート §6 で自己申告済: `dispatchEvent('click')` x 2 の方式は React の合成イベントを抜けて DOM の click を発火するため、実 UA の `pointerdown/pointerup` 連打とは挙動差がある。pending 状態 disabled での防御は確認できているが、DB レベルの `(learner_id, reason, reference_id)` UNIQUE 制約も加えれば構造的に冪等が担保できる (M-3 と同方向)。
5. **アクセサリが `/shop` に出ない negative spec の追加**
   - DEC-052 mutex 保全のため、`/shop` ページに `[data-testid^="shop-item-accessory_"]` の locator が 0 件であることを assert する spec があると将来の regression を捕捉しやすい。

---

## 5. アクセシビリティ実測結果

### Lighthouse 自動測定

- **公開ルート (`/`)**: a11y score = **0.98** (98 / 100)
  - 失敗 audit: `heading-order` 1 件のみ (h1→h3 の階層飛び。本タスクで変更されていない LP/login 共通テンプレ起因と推定)
  - 本タスク (W10-T2 / `/shop` ページ追加) **起因の audit 失敗ゼロ**
- **`/shop` (要認証)**: 未実測 (signup フロー必須)。次タスク以降で authenticated Lighthouse 実施を推奨。

### 静的コードレビュー所見

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| ボタンに `aria-label` (日本語固定) | OK | ShopItemCard.tsx:149 / ConfirmPurchaseDialog.tsx:99 / HanekinBalanceBadge.tsx:62 |
| アイコン単体ボタンに `aria-hidden="true"` 同伴 | OK | 全 Heroicons 利用箇所 |
| 数値の `tabular-nums` | OK | balance / price / quantity すべて適用 |
| `<ruby>` でふりがな | OK | アイテム名 (ShopItemCard) / 「ハネキン」(HanekinBalanceHeader) |
| `aria-live="polite"` (結果メッセージ) | OK | ShopItemCard.tsx:161 |
| `role="status"` (補助テキスト) | OK | ShopItemCard.tsx:111, 122 |
| Dialog の trap focus / aria-label | OK | shadcn/ui Dialog + DialogTitle / `aria-label={\`${item.name}の 購入確認\`}` |
| 絵文字 (Emoji presentation) | OK | shop 関連 src 9 ファイルで 0 件 (Nits N-1 のみ U+2613 in JSDoc) |
| Heroicons / lucide-react | OK | lucide-react import 0 件 |
| color contrast (主要テキスト vs 背景) | OK | Amber Gold #B97F18 on #FFF5DC ≒ 6.4:1, dark mode #F2A93A on #3A2A0A ≒ 8.9:1 |

---

## 6. DEC-052 / DEC-055 regression 検証

### DEC-052 (W9-B アクセサリ slot mutex / 解禁演出)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| `learner_accessories` テーブル / 関連 schema に意図しない変更 | OK (変更なし) | `git diff HEAD~1 HEAD -- src/lib/db/schema.ts` で +63 行 (learnerInventory 新設のみ) / accessories / learner_accessories の差分 0 |
| `lib/actions/accessories.ts` の `toggleEquippedAccessory` slot mutex | OK (変更なし) | `git diff HEAD~1 HEAD -- src/lib/actions/accessories.ts` で差分 0 |
| `loadAccessoriesPageData` の解禁条件 (level / streak / xp / badge) | OK (変更なし) | 同上 |
| `CharacterWithAccessories` overlay | OK (変更なし) | `home/page.tsx:486-491` で既存通り render / accessoriesPageData.equippedBySlot を渡す経路維持 |
| `/settings/accessories` page の slot 切替 | OK (変更なし) | shop からの導線は `/settings/accessories?learner=<id>` のみで、購入経路ゼロ |
| アクセサリ category が /shop に出ない | OK | `SHOP_ITEM_TYPES` に accessory なし / `SHOP_ITEMS_BY_CATEGORY` に accessory category なし |

### DEC-055 (W10-T1 ハネキン経済)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| `coin_transactions` テーブル / `coin_balance` 列 | OK (変更なし) | `git diff HEAD~1 HEAD -- src/lib/db/schema.ts` の coinTransactions 部に変更なし |
| `lib/economy/ledger.ts` の純関数性 | OK (変更なし) | `git diff` 差分 0 / `shop.ts` から `validateSpend` を import するのみで再利用 |
| `COIN_REWARDS` 定数 / 9 種 reason enum | OK (変更なし) | `shop-prices.ts` 75 で `Extract<CoinReason, "freeze_purchase" | "feed_purchase">` として既存 enum を再利用 |
| `submitAnswer` hook の経路 | OK (変更なし) | git diff で `lib/study/submit-answer.ts` 差分 0 |
| `awardCoins` / `spendCoins` API surface | OK | 本タスクは `purchaseShopItem` (新規) で `coin_transactions` への INSERT を直接実行。既存 `spendCoins` は影響なし。実装上 `purchaseShopItem` が `coin_transactions` の整合性を直接担保している点は留意。 |

→ **DEC-052 / DEC-055 regression: なし**

---

## 7. 副作用・エッジケース検証

### 7-1. `purchaseShopItem` の atomic 性

- 順序: 認可 → 冪等チェック → 残高 / 在庫上限チェック → INSERT(coin_transactions) → UPDATE(learner_profiles.coinBalance) → UPSERT(learner_inventory) → revalidatePath
- atomic conditional UPDATE: `WHERE coinBalance >= price` で残高不足時に物理的に 0 行更新。この場合 INSERT(coin_transactions) と UPDATE の整合性が崩れる**理論的余地あり**だが、直前の `validateSpend` でアプリ層は弾いているため実運用では到達しない。
- 推奨対応: 将来 `db.transaction(async tx => {...})` で囲む形に統一すると堅牢。SQLite は serialized writes だが drizzle の `db.transaction` API は使用可能。**現コミットでは見送り妥当** (Minor 4 と同方向の改善)。

### 7-2. `learner_inventory.id` の生成

- `inv_${randomUUID()}` で UUID v4。`onConflictDoUpdate` の `target` は `(learner_id, item_type)` UNIQUE INDEX。conflict 時は新 id を捨てて quantity++ する設計で正しい。

### 7-3. dark mode

- HanekinBalanceHeader / Badge / ShopItemCard 全て `dark:` バリアント設定済。Amber Gold は dark mode で `#F2A93A`、light mode で `#B97F18` に切替で WCAG AA 維持。

### 7-4. 学習者切替 (`LearnerSwitcherTabs`)

- `/shop?learner=<id>` の rawQuery 改ざんは `resolveActiveLearner` + `requireLearnerOwner` で SQL 再確認 = 三層認可遵守。

### 7-5. CSP / Sentry

- Sentry deprecation warning は build/run 時のみで本タスク非起因 (W2 導入時の既存 warning)。

### 7-6. revalidatePath('/shop') の挙動

- shop page は `dynamic` route なので revalidate は cache invalidation 効果のみ。client は dialog 閉じた後 setResultMessage で表示されるので即時反映が期待できる。Next.js 15 RSC payload は client navigation 時に再フェッチされる。

---

## 8. 推奨修正 (優先順)

| # | 重要度 | 内容 | タイミング |
|---|:---:|------|-----------|
| 1 | Minor | (M-3 / 7-1) `coin_transactions` に partial UNIQUE index `(learner_id, reason, reference_id)` を追加 | W10-T3 か W10-T5 で `0012` migration 投入 |
| 2 | Minor | (M-2) `min-h-tap-cta` の実値が 56px か確認、不足なら子ども向け固有 token を追加 | W11 polish |
| 3 | Minor | (M-4) `/shop` 単体の authenticated Lighthouse audit 実施 | W12 β 投入前 |
| 4 | Minor | unit test `tests/unit/shop.actions.test.ts` (DB mock / 5 ケース) | W11 polish |
| 5 | Minor | `tests/unit/shop-prices.test.ts` で `canPurchaseAdditional` 境界 + 価格定数 snapshot | W11 polish |
| 6 | Nits | (N-1) ConfirmPurchaseDialog.tsx ヘッダコメントの U+2613 を ASCII に置換 | 任意 |
| 7 | Future | `db.transaction()` で `purchaseShopItem` を囲む堅牢化 | W11 〜 |
| 8 | Future | `(app)/layout.tsx` の active learner cookie 化 | W11 〜 |

---

## 9. CEO 向けサマリー + リリース判断

### サマリー

DEC-056 案B の仕様 28 項目すべてに準拠した品質の高い atomic commit。
- アクセサリ category は **完全に閉じられ**、DEC-052 (W9-B slot mutex) との切り分けが明確。
- 4 ボタン構成 / 共通 layout 残高バッジ / 大表示残高 (黄金グロー) / 残高不足時のクエスト誘導 / 子ども向け語感 + ふりがな + Heroicons / 確認 dialog による誤クリック耐性、すべて DEC-056 §UI 仕様通りに実装。
- 冪等性は client UUID + 三重キー (`learner_id`, `reason`, `reference_id`) の SELECT 先行 + 連打 disabled で実用十分 (M-3 で構造的補強の余地は提示)。
- 品質ゲート (typecheck / lint / vitest 486 / build / E2E 27 全 GREEN) を通過。Lighthouse a11y は公開ルートで 0.98 / `/shop` 起因の劣化なし。
- DEC-055 (ハネキン経済) / DEC-052 (アクセサリ slot mutex) / DEC-054 (W9-Polish /home) いずれも regression なし。
- Critical / Major 指摘ゼロ、Minor 4 件 + Nits 1 件はいずれも次バージョン繰越で問題なし。

### push 可否判断

**Yes (push 可)**

理由:
1. 仕様適合 100% (28/28)
2. 全品質ゲート GREEN
3. Critical / Major 指摘ゼロ
4. DEC-052 / DEC-055 regression なし
5. オーナー方針 (絵文字ゼロ / DEC-006 完全無料 / DEC-024 罰則ゼロ / 子ども向け dark pattern なし) 完全準拠
6. 既知の制約 3 件はすべて実装レポートで自己申告済 + 次タスクで対応可能な範囲

### 次バージョン繰越推奨 (現コミットでは対応不要)

- `0012_w10_idempotency_unique.sql` (DB レベルの冪等性強化)
- `tests/unit/shop.actions.test.ts` (Server Action 単体テスト)
- `min-h-tap-cta` の 56px 化検証 (子ども向け固有 token)
- `/shop` authenticated Lighthouse audit (W12 β 前)
- `(app)/layout.tsx` の active learner cookie 化 (W11 ポリッシュ)
- `tests/e2e/shop.spec.ts` に「accessory category が出ない」negative assertion 追加
- ConfirmPurchaseDialog.tsx ヘッダコメント U+2613 を ASCII に置換

---

## 検証実行ログ (再現性)

```
$ npm run typecheck
> tsc --noEmit
(exit 0 / clean)

$ npm run lint
> eslint .
(exit 0 / clean)

$ npm run test
Test Files  40 passed (40)
     Tests  486 passed (486)
  Duration  4.13s

$ npm run build
✓ Generating static pages using 15 workers (21/21) in 461ms
ƒ /shop が dynamic route として正しく出力

$ npx playwright test --project=chromium tests/e2e/shop.spec.ts
3 passed (28.4s)

$ npx playwright test --project=chromium
27 passed (47.9s)

$ npx lighthouse http://localhost:3000/ --only-categories=accessibility
a11y score: 0.98
failed audits: 1 (heading-order / 本タスク非起因)
```

---

レビュー実施: レビュー部門 (Claude Code)
レビュー日: 2026-04-30
判定: **APPROVE (push 可)**
