# レビュー結果 - W11-T2 親→子 応援メッセージ + DEC-024 Moderation Pipeline (HANEI / PRJ-016)

- 案件: PRJ-016 HANEI（小学生向け英検 PWA / Phase 2 ゲーミフィケーション）
- タスク: W11-T2 Family Message「親→子 応援メッセージ + kotodama-tori 代読 modal + DEC-024 moderation pipeline」(P0 / 1 person-day 訂正版)
- レビュー日: 2026-05-02 (CEO 経由 / Trust-but-Verify チェックポイント)
- レビュー対象: `projects/PRJ-016/reports/dev-w11-t2-family-message-done.md` + `projects/PRJ-016/app/` 実体 (uncommitted working tree)
- ベースライン commit: `e201de2` (W11-T3 / DEC-061 完遂 / dashboard 更新は `ebe7b29`)
- 着手判定: **DEC-062**（訂正版 / 既存 W9-D 基盤を流用 / 新規テーブル無し）

---

## 1. 総合判定

**APPROVE** — main push 推奨。

- **Critical 指摘: 0 件**
- **Major 指摘: 0 件**
- **Minor 指摘: 4 件**（M-1〜M-4 / すべて後続吸収可 / push 阻害なし）

DEC-062 受入基準 10 項目を全て満たし、DEC-024 罰則ゼロ哲学 / DEC-003 三層認可 + COPPA / DEC-055 idempotency / Turbopack `"use server"` 制約の 4 大設計原則を構造レベル（純関数 + server-only helper の分離 / SQL `family_id WHERE` 必須 / `markMessageRead` の `already_read` 経路 / `describeModerationReason` 経由の前向きコピー機械化）で保全している。

W11-T2 は既存 W9-D 基盤（`parent_messages` テーブル / `sendMessageFromTemplate` / `getMessagesForLearner` / `markMessageRead`）を流用するため新規テーブル / 新規 server action 無しの薄い atomic で、W11-T1 / W11-T3 とアーキテクチャ的にやや異なる点を踏まえても破壊リスクは構造的に最小に抑えられている。

---

## 2. 検証手順 (レビュー側で再走確認)

### 2.1 git diff サマリ（uncommitted working tree）

```
M  app/src/app/(app)/home/page.tsx                   |  42 ++++++++-
M  app/src/app/(parent)/parent/messages/new/page.tsx |  19 ++--
M  app/src/components/messages/template-picker.tsx   |  95 +++++++++++++++++--
M  app/src/lib/actions/parent-messages.ts            | 109 ++++++++++++++++++++--
M  decisions.md                                      |  49 ++++++++++
?? app/src/components/messages/kotodama-tori-modal.tsx
?? app/src/lib/messages/moderation.ts
?? app/src/lib/messages/parent-messages-server.ts
?? app/tests/e2e/family-message.spec.ts
?? app/tests/unit/messages.moderation.test.ts
?? app/tests/unit/messages.parent-messages-server.test.ts
?? projects/PRJ-016/reports/dev-w11-t2-family-message-done.md
   合計: 5 改修ファイル + 6 新規ファイル + DEC-062 (49 行) / 4 src files / 2 unit specs / 1 e2e spec
```

新規マイグレーションなし（drizzle/ は 0015 までで停止）= schema 変更ゼロ = `parent_messages` (W9-D / migration 0008) を流用。

### 2.2 静的検査

| 観点 | コマンド | 結果 |
| --- | --- | --- |
| typecheck | `bun run typecheck` (`tsc --noEmit`) | **0 errors / 0 warnings** |
| lint | `bun run lint` (`eslint .`) | **0 errors / 0 warnings** |

### 2.3 unit テスト

`bun run test` 実行結果:

```
Test Files  49 passed (49)
     Tests  683 passed (683)
  Duration  3.53s
```

- ベースライン 633 (W11-T3 完遂時) → 683（**+50 ケース** / `messages.moderation.test.ts` 43 + `messages.parent-messages-server.test.ts` 7 = 50）。dev 報告と完全一致。
- 既存 49 ファイル regression なし。

### 2.4 production build (Turbopack)

`bun run build` 実行結果: 23 routes 全 prerender / dynamic 完遂、Turbopack production build 成功。

- 新規ルート無し（`/home` と `/parent/messages/new` の改修のみ）。
- Turbopack `"use server"` sync export 制約に該当する追加ファイル（`moderation.ts` / `parent-messages-server.ts`）は両方 server action ファイル外に配置されており build clean。

### 2.5 E2E（Playwright / chromium + mobile-chrome）

| spec | 結果 | 所要 |
| --- | --- | --- |
| `tests/e2e/family-message.spec.ts` (2 cases × 2 project) | **4/4 PASS** | 23.9s |
| `tests/e2e/family-leaderboard.spec.ts` (3 cases × 2 project) | 6/6 PASS | (合算) |
| `tests/e2e/family-streak.spec.ts` (3 cases × 2 project) | **6/6 PASS** (workers=1) | 31.2s |

family-streak は workers=2 並列実行で 1 件 SQLITE_BUSY flake が観測されたが、workers=1 で 6/6 green。これは W11-T3 review でも記録された preexisting flakiness（fullyParallel=true × file: SQLite の構造的事象）であり、W11-T2 の変更とは独立。本タスクの E2E は `test.describe.configure({ mode: "serial" })` + `execWithRetry`（max 16 / exp backoff 100ms-1500ms / jitter 付き）で SQLITE_BUSY を構造的に吸収しており、workers=2 でも初回から 4/4 PASS を達成。

---

## 3. DEC-024 罰則ゼロ準拠（最重要）

**評価: 強く準拠（grep + コード読みの両面で罰語ゼロ確認）**

### 3.1 機械的 grep 検証

`src/lib/messages/**` / `src/components/messages/**` / `src/app/(app)/home/page.tsx` / `src/app/(parent)/parent/messages/**` を対象に `だめ|やりすぎ|ペナルティ|禁止|罰|最下位|ビリ` で grep:

| ファイル | hit 行 | 種別 | UI 露出 |
| --- | --- | --- | --- |
| `moderation.ts:46-58` | `だめ` / `やりすぎ` / `ペナルティ` / `罰` / `最下位` / `ビリ` | **辞書定義** | ✗ (検出対象であり UI 出口なし) |
| `moderation.ts:4, 16, 28, 132, 152` | `罰則ゼロ` / `禁止語` / `具体禁止語` | **コメント** | ✗ |
| `template-catalog.ts:11-12` | `罰なき` / `絵文字禁止` | **コメント** (W9-D 既存) | ✗ |
| `template-picker.tsx:15, 311` | `絵文字禁止` / `罰語ゼロ` | **コメント** | ✗ |
| `parent-message-card.tsx:8` | `絵文字禁止` | コメント (W9-D 既存) | ✗ |
| `kotodama-tori-modal.tsx:17` | `絵文字禁止` | コメント | ✗ |
| `home/page.tsx:556` | `罰則ゼロ哲学` | コメント (W10-T3 既存) | ✗ |

**全 hit がコメント or 辞書定義 / UI レンダーされる文字列リテラルへの混入は 0 件**。これは構造的に「禁止語は moderation 辞書の中にしか存在せず、UI 表示用文言は `describeModerationReason` 経由で前向きコピーに固定されている」設計の証跡となっている。

### 3.2 UI コピー手動検証

#### 3.2.1 `describeModerationReason` の出力（`moderation.ts:158-179`）

| reason | 文言 | 罰語チェック |
| --- | --- | --- |
| `too_short` | "メッセージを かいてください。" | clean |
| `too_long` | "200 字 まで で おねがいします。" | clean |
| `blocked_word` | "このメッセージは おくれないかも。ことばを やわらかく してみよう。" | clean (※下記注釈) |
| `rate_limited` | "つづけて たくさん おくれないよ。すこし まって また おくってね。" | clean (※下記注釈) |
| `invalid_type` | "メッセージの かたちを たしかめてください。" | clean |

**検証**: unit `tests/unit/messages.moderation.test.ts:259-273` で `expect(msg).not.toContain("だめ")` / `not.toContain("ペナルティ")` / `not.toContain("禁止")` を機械化済 → CI で罰語の混入を構造的に防止。

> 注釈: `blocked_word` 文言の "おくれないかも" / `rate_limited` 文言の "おくれないよ" は **「送れない」(動詞「送る」の可能形否定)** であり、人格否定の「だめ」ではない。子供向けの平仮名ひらがな表記で「ものを送る能力の制約」を中性的に伝える表現として妥当。「かも」(推量) / 「すこし まって また おくってね」(再試行を促す前向きトーン) で柔らかさを担保しており、DEC-024 罰則ゼロの趣旨（**人格 / 達成 / 行為の否定をしない**）から逸脱していない。

#### 3.2.2 modal / template-picker / 親 dashboard コピー

| 場所 | コピー | 評価 |
| --- | --- | --- |
| `kotodama-tori-modal.tsx:106` | "{learnerNickname} さんに、{fromName} から メッセージだよ" | clean / 平仮名中心 |
| `kotodama-tori-modal.tsx:129` | "ありがとう" CTA | clean / 前向き |
| `template-picker.tsx:240, 281` | "おくりました。とどくのを たのしみに してね。" | clean / 前向き |
| `template-picker.tsx:339` | "うえの リストから ひとつ えらんでください。" | clean / 中性 |
| `template-picker.tsx:71` | "この おこさま に メッセージを おくれません。" | learner_not_owned 用 / clean (※同上「送れない」) |

**検証**: E2E `tests/e2e/family-message.spec.ts:220-227` で `PUNISHMENT_WORDS = ["だめ", "やりすぎ", "ペナルティ", "最下位", "ビリ", "下位"]` を modal 表示 / 成功メッセージ両方に対して `not.toContain` で機械検証。

### 3.3 「失敗」「エラー」の扱い

レビュー観点として `失敗|エラー` を grep した:

- `moderation.ts` / `kotodama-tori-modal.tsx` / `template-picker.tsx` の **UI 表示文言** には "失敗" / "エラー" のテキストは混入していない。
- `kotodama-tori-modal.tsx:62` の `// markReadAction 内部 ... 失敗時` は **コードコメント** のみ。
- `template-picker.tsx:312-325` の moderation エラー UI は `role="alert"` を持つが、表示文言は `describeModerationReason` 経由の前向きコピーのみ（"エラー" の文字列は使わず、ExclamationTriangleIcon と amber 色で「注意促し」のトーンに留める）。

**結論**: DEC-024 罰則ゼロ哲学は **構造的に保全**。

---

## 4. DEC-003 三層認可 + COPPA

**評価: 強く準拠（SQL レベルで family_id を必須化 / cross-family 漏洩は構造的に不可能）**

### 4.1 全 SQL クエリの family_id WHERE 検証

| 関数 / SQL | family_id WHERE | learner_id 絞込 | 評価 |
| --- | --- | --- | --- |
| `sendMessageFromTemplate` INSERT (`parent-messages.ts:171-178`) | OK (`familyId` を value に含めて INSERT) | OK (`requireLearnerOwner` で SQL 認可) | OK |
| `sendCustomMessage` INSERT (`parent-messages.ts:234-241`) | OK | OK (同上) | OK |
| `getMessagesForLearner` SELECT (`parent-messages.ts:265-274`) | OK (`eq(parentMessages.familyId, familyId)`) | OK (`eq(parentMessages.toLearnerId, learnerId)`) | OK |
| `markMessageRead` SELECT + UPDATE (`parent-messages.ts:305-318, 335-343`) | OK (両方 `eq(familyId)`) | OK (`requireLearnerOwner(toLearnerId)` 経由) | OK |
| `isRateLimited` SELECT count (`parent-messages.ts:368-378`) | △ (家族 ID は明示してないが `from_user_id` + `to_learner_id` の二重スコープで family scope 内に限定 / 兄弟ペア独立) | OK | OK (※4.4 参照) |
| `getMessageSenderName` SELECT (`parent-messages-server.ts:58-69`) | **OK (`eq(parentMessages.familyId, familyId)`)** | n/a | OK |
| `getMessageSenderName` user SELECT (`parent-messages-server.ts:76-80`) | n/a (上で family scope 確認済の `fromUserId`) | n/a | OK |

### 4.2 `homeMarkReadAction` の認可チェーン

`src/app/(app)/home/page.tsx:339-346` の closure-bound server action は:

```ts
async function homeMarkReadAction(formData: FormData): Promise<void> {
  "use server";
  const messageId = formData.get("messageId");
  if (typeof messageId !== "string" || messageId.length === 0) return;
  await markMessageRead(messageId);
}
```

`markMessageRead` は内部で `requireAuth` → `requireParent(session.userId)` → `requireFamilyMember(session.userId, familyId)` → SQL `eq(familyId)` フィルタ → `requireLearnerOwner(session.userId, row.toLearnerId)` を実行。**4 段階の認可ガード**を順に通過するため、`/home` 経路でも family scope 漏洩は構造的に発生しない。

> なお `/home` は **保護者 session が親の view として learner /home を見る** 利用形態を前提としているため、`requireParent` が要求される設計は W9-D 当初の意図と一致。Phase 1-2 では学習者直ログイン経路を持たないため認可矛盾は発生しない。docstring (`parent-messages.ts:16-20`) も W11-T2 wording に正しく更新済。

### 4.3 `getMessageSenderName` の二段 SQL 構造

```ts
// 1. messageId × familyId で parent_messages を引く
.where(and(eq(parentMessages.id, messageId), eq(parentMessages.familyId, familyId)))
// 2. 上で family scope 確認済の fromUserId で users を引く
.where(eq(users.id, fromUserId))
```

第 1 SELECT で `family_id` 一致を SQL レベルで強制 → 他家族の `parent_messages` 行に到達不可能。fallback として `"おうちの ひと"` (中性的な平仮名表記 / 罰語ゼロ) を返すため、表示崩れも UI に出ない。

### 4.4 レート制限の SQL スコープ

`isRateLimited(fromUserId, toLearnerId)` は `family_id` を WHERE に持たないが、

- 呼び出し側 (`sendMessageFromTemplate` / `sendCustomMessage`) は呼出時点で `requireParent` + `requireFamilyMember` + `requireLearnerOwner` を通過済 = `fromUserId` も `toLearnerId` も既に family scope に絞られている。
- カウント条件 `from_user_id = ? AND to_learner_id = ?` は **親子ペア単位** で集計するため、他家族の rate limit カウントに干渉しない（複数家族間でカウントが衝突する経路は構造的に存在しない / `from_user_id` が同一なら同一親であり、`to_learner_id` が同一なら同一 learner = 同 family）。
- DEC-062 §dev へのブリーフ要点 3「同一 from_user_id → 同一 to_learner_id に 5 分以内 5 件以上が存在する場合は reject」と完全一致。

**結論**: DEC-003 三層認可 + COPPA は構造レベルで保全。

---

## 5. DEC-055 idempotency

**評価: 準拠（既存 W9-D `markMessageRead` の `already_read` reason で同一 messageId 複数 click は安全）**

### 5.1 `markMessageRead` の冪等性保証

`parent-messages.ts:295-346`:

```ts
if (row.readAt !== null && row.readAt !== undefined) {
  return { ok: false, reason: "already_read" };
}
```

- 1 回目: `row.readAt === null` → UPDATE 実行 → `{ ok: true, readAt }`
- 2 回目以降: 上記分岐で **DB write 0** / `{ ok: false, reason: "already_read" }` を返す
- modal 側 (`kotodama-tori-modal.tsx:54-65`) は失敗・成功どちらでも `setOpen(false)` で閉じる（finally 句）→ ユーザ操作は idempotent に閉じる。
- ネットワーク完全失敗時は modal が再表示されないが、**read_at が NULL のままなので次回 /home 訪問で再 push される**（= 安全側にフェイル / DEC-055 整合）。

### 5.2 レート制限カウントの非破壊性

- `isRateLimited` は **SELECT count(*)** のみで write 経路を持たない。
- 同 messageId を複数回 markMessageRead しても `parent_messages.created_at` は不変なので、レート制限カウントに影響を与えない。
- 他 atomic（W11-T1 family streak / W11-T3 family leaderboard）の write 経路（`families.family_streak_days` / `xp_logs` / `answer_logs`）には触れない（grep 確認済）。

### 5.3 modal 再表示の冪等性

「最古未読 1 件を pick」する `findOldestUnreadMessage` は純関数で DB write 0 / 同入力 → 同出力。read_at が NULL の間は何度 /home を訪問しても同 1 件が再 push されるため、ユーザが「ありがとう」を押すまで構造的にメッセージが消えない（= 親の応援が確実に届く UX）。

**結論**: DEC-055 idempotency は構造的に保全。

---

## 6. アーキテクチャ評価

### 6.1 Turbopack `"use server"` sync export 制約

| ファイル | `"use server"` directive | sync export | 評価 |
| --- | --- | --- | --- |
| `src/lib/actions/parent-messages.ts` | **あり** (line 1) | async のみ (`sendMessageFromTemplate` / `sendCustomMessage` / `getMessagesForLearner` / `getLatestMessageForLearner` / `markMessageRead` / `isRateLimited`) | OK |
| `src/lib/messages/moderation.ts` | **なし** | sync export 可 (`validateParentMessageBody` / `describeModerationReason` / `BODY_MIN` / `BODY_MAX`) | OK |
| `src/lib/messages/parent-messages-server.ts` | **なし** | mixed (`findOldestUnreadMessage` sync / `getMessageSenderName` async) | OK |
| `src/components/messages/kotodama-tori-modal.tsx` | `"use client"` | n/a (Client Component) | OK |
| `src/app/(app)/home/page.tsx` (Server Component) | 暗黙 server 境界 | inline `homeMarkReadAction` は `"use server"` 内部 directive | OK |

W10-T5 / W11-T1 / W11-T3 で確立した **「純関数を server-only ファイルの外に分離」** パターンの 4 度目の再適用。`bun run build` で Turbopack production build 成功 (23 routes) を確認済。

### 6.2 Server Component → Client Component 境界

`/home/page.tsx:339-346` の closure-bound `homeMarkReadAction` は:

- Server Component の関数本体内に `"use server"` directive を持つ inline server action。
- `KotodamaToriModal` props の `markReadAction: (formData: FormData) => Promise<void>` として渡される（serializable な関数参照 / Next.js App Router の正規パターン）。
- form 経由で `messageId` を hidden input から渡すため、props の serialization は型レベルで安全（formData 化）。
- クロージャに captured されるのは `markMessageRead` のみで、認可済の `session` / `familyId` を直接 closure に持ち込まない（毎回 `requireAuth` 経由で再取得）= session race を構造的に回避。

### 6.3 既存 W9-D 基盤の非破壊性

| W9-D 基盤 | 変更有無 | 評価 |
| --- | --- | --- |
| `parent_messages` テーブル (migration 0008) | **変更なし** (新規 0016 不在) | 完全保全 |
| `sendMessageFromTemplate` (custom body 経路) | moderation 統合 + reason 追加 | 既存 success path 不変 |
| `sendMessageFromTemplate` (template only 経路) | **moderation skip** (line 147 `if (isCustom)` ガード) | テンプレ 30 種は事前審査済の前提を構造で担保 |
| `sendCustomMessage` | moderation + rate limit 統合 | 既存 success path 不変 |
| `getMessagesForLearner` | 変更なし | 完全保全 |
| `getLatestMessageForLearner` | 変更なし | 完全保全 |
| `markMessageRead` | docstring 更新のみ (実装変更なし) | 完全保全 |
| `/messages` 学習者受信箱 | 変更なし | 完全保全 |
| `/parent/messages/new` page | server action 戻り値型を `Promise<void>` → `Promise<SendMessageResult>` 変更 | TemplatePicker 側で型整合 / W9-D の form post 経路は不変 |
| `/parent/dashboard` メッセージ CTA | 変更なし | 完全保全 |

**結論**: アーキテクチャ整合性は高水準で保全。

---

## 7. テストカバレッジ評価

### 7.1 unit `messages.moderation.test.ts`（43 ケース）

**境界網羅**: 

| カテゴリ | ケース数 | 詳細 |
| --- | --- | --- |
| 型ガード | 4 | null / undefined / 数値 / オブジェクト → `invalid_type` |
| 長さ境界 | 7 | 0 / 1 / 200 / 201 / 連続空白 / 改行のみ / `BODY_MIN`/`BODY_MAX` 定数 |
| 罵倒系禁止語 | 6 | ばか / バカ / 馬鹿 / あほ / アホ / ぐず |
| 否定系禁止語 | 5 | だめ / やりすぎ / サボるな / ペナルティ / 最下位 |
| 強制系禁止語 | 3 | やれ / やりなさい / やめろ |
| 励まし系 OK | 5 | がんばろう / がんばれ / お疲れさま / うれしいね / placeholder 含む |
| PII | 4 | 03-1234-5678 / 090-1234-5678 / メール / 区+番地 |
| 通常メッセージ OK | 4 | テンプレ既定 / 数字混在 / カタカナ / 漢字+ひらがな |
| `describeModerationReason` | 5 | 各 reason 文言 + 罰語混入 not.toContain 検証 |

**合計 43 ケース** (DEC-062 受入基準 9「12+ ケース」を 3.6 倍超達成)。

### 7.2 unit `messages.parent-messages-server.test.ts`（7 ケース）

`findOldestUnreadMessage` の全分岐:

- 空配列 → null
- 全既読 → null
- 単一未読 → その 1 件
- 複数未読 (desc 配列の末尾が最古) → 最古 1 件
- 既読 + 未読の混在 → 最古の未読
- 単独 1 件未読 → その 1 件
- 単独 1 件既読 → null

`getMessageSenderName` は DB 依存のため unit では網羅せず、E2E modal 表示で間接検証。

### 7.3 E2E `family-message.spec.ts`（2 ケース × 2 project = 4 シナリオ）

| Test | 主軸 assert |
| --- | --- |
| Test 1: modal 表示 → 既読化 → reload 非表示 | (a) modal が `data-testid="family-message-modal"` で可視 / (b) `data-message-id` 属性に messageId 設定 / (c) 本文に "がんばろう" / nickname を含む / (d) **罰語 6 種 not.toContain** / (e) 「ありがとう」click → modal hidden / (f) DB `read_at IS NOT NULL` (unixepoch > 0) / (g) reload で modal `toHaveCount(0)` |
| Test 2: moderation reject → 通常文成功 | (a) 「だめ」含む custom 送信 → `data-testid="moderation-error"` 可視 / (b) 文言に "やわらかく" 含む / (c) **エラー文言に "だめ" / "ペナルティ" not.toContain** / (d) 「がんばろう」で再送信 → `data-testid="send-success"` 可視 / (e) 成功文言に "おくりました" / (f) 罰語 not.toContain |

両テストで chromium + mobile-chrome の 2 project を走らせて **4/4 PASS** 達成（dev 報告と完全一致）。

### 7.4 テストインフラ品質

| 観点 | W11-T2 実装 | W11-T3 実装 | 比較評価 |
| --- | --- | --- | --- |
| `execWithRetry` | maxAttempts=16 / exp backoff (100ms-1500ms) / jitter | 同左 | **同等** |
| `test.describe.configure({ mode: "serial" })` | あり | あり | 同等 |
| `client.batch` 利用 | unread INSERT 1 件 / `read_at SELECT` のみで batch 不要 | 多 row INSERT で利用 | スコープ相当 |
| workers=2 並列下の green | **4/4 PASS** | 6/6 PASS | 同等 |

W11-T1 (workers=1 強制) よりも堅牢で、W11-T3 と同等の SQLITE_BUSY 構造的吸収を達成。

**結論**: テストカバレッジは DEC-062 受入基準を上回る水準。

---

## 8. アクセシビリティ評価

### 8.1 `kotodama-tori-modal.tsx`

| 観点 | 実装 | 評価 |
| --- | --- | --- |
| `role="dialog"` | `kotodama-tori-modal.tsx:78` | OK |
| `aria-modal="true"` | `kotodama-tori-modal.tsx:79` | OK |
| `aria-labelledby` | `family-message-modal-title-${messageId}` で h2 と連結 (line 80, 103) | OK |
| 56px tap area (K-1) | `<Button size="lg" className="min-h-tap-cta px-8">` (line 121-126) | OK (Tailwind カスタムクラス `min-h-tap-cta` で W10-T5 確立済) |
| 背景クリック抑止 | `handleBackdropClick` が `e.target === e.currentTarget` でも何もしない (line 67-74) | OK (誤閉じ防止) |
| 平仮名中心 | "ありがとう" / "{nickname} さんに、{fromName} から メッセージだよ" | OK |
| `KotodamaWakatoriSvg` の aria-label | `label="ことだまトリ が だいどく しています"` (line 98) | OK |
| 改行保持 (子供向け本文) | `whitespace-pre-line break-words` (line 112) | OK |
| Heroicons のみ | `HeartIcon` (24/outline) | OK / 絵文字ゼロ |

### 8.2 `template-picker.tsx`

| 観点 | 実装 | 評価 |
| --- | --- | --- |
| カテゴリ tabs `role="tablist"` / `role="tab"` / `aria-selected` | line 113-140 | OK (W9-D 既存 / W11-T2 で破壊なし) |
| moderation エラー `role="alert"` + `aria-live="polite"` | line 313-318 | OK (誤入力時のフォーカス維持 + 読み上げ) |
| 成功表示 `role="status"` + `aria-live="polite"` | line 327-332 | OK (alert と status の使い分けが正規) |
| 文字数カウンタ `aria-live="polite"` | line 204-208 | OK (W9-D 既存) |
| ふりがな `<ruby>` 対応 | `/home` `xp_levels.totalXp` 表示で利用 (W9-Polish) / 本タスク追加なし | n/a |
| tabular-nums | カテゴリラベル / カウンタで利用 | OK |
| `min-h-tap-cta` | send-template-btn / send-custom-btn 両方 (line 261, 302) | OK |

### 8.3 `/home/page.tsx` modal 統合

- modal は section の最末尾近く (`{oldestUnread && modalSenderName ? <KotodamaToriModal ... /> : null}`) で render され、Server Component の他セクション（quest summary / 4-button 群 / コーチひとこと）と独立。
- `KotodamaToriModal` 内部で `useState(open=true)` で初期 open / focus trap は背景クリック抑止と Esc 無効で代用（DEC-062 §4「Esc は受け付けない / 子供が偶発的に閉じない設計」）。

**結論**: アクセシビリティは小学生向け規範 (K-1 / K-2) + WCAG 2.1 AA に準拠。

---

## 9. 指摘事項

### 9.1 Critical

**なし。**

### 9.2 Major

**なし。**

### 9.3 Minor（後続吸収可 / push 阻害なし）

#### M-1: ブロック語辞書のチューニング戦略を W12 以降の DEC で明文化推奨

`moderation.ts:34-67` の `BLOCKED_WORDS` 配列は CEO 監修の最小セット (24 語) で、`includes()` による部分一致判定。

- **現状の trade-off**:
  - false positive 例: 「がんばりすぎないで」が `やりすぎ` に該当（"がんばりすぎ" は心配の言葉 / 罰ではない）
  - false negative 例: 「やる気ある？w」のような微妙な煽り、子供の作文で出てくる否定形の引用文
- **推奨**: W12 以降の polish phase で false-positive ログ収集 → 辞書のリファクタを DEC として記録（dev 報告 §課題・リスク 1 と一致）。push 阻害なし。
- **修正コスト**: 0 (本タスク内不要 / 設計戦略の DEC 化のみ)

#### M-2: PII pattern のハイフンなし携帯番号未捕捉

`moderation.ts:75-82` の電話番号正規表現 `/\d{2,4}-\d{2,4}-\d{4}/` は **ハイフン必須** のため、`09012345678`（ハイフンなし 11 桁）は素通し。

- **現状の trade-off**:
  - 親→子 200 字以内で連続 11 桁を書く頻度は低い（実害低）
  - 過剰検出（学校行事の日付やラリー番号誤検出）を避ける保守的設計
- **推奨**: W12 以降で `/\d{10,11}/` を「ハイフンあり」または「先頭 0」のホワイトリスト化として追加検討。dev 報告 §課題・リスク 2 と一致。
- **修正コスト**: 1 行追加 + unit 1 ケース（後続吸収可）

#### M-3: レート制限の SQL に index 適用確認の申し送り

`isRateLimited` の SELECT は `parent_messages.from_user_id + to_learner_id + created_at >= cutoff` を WHERE に持つ。

- 既存 migration 0008 (`parent_messages`) は `(family_id, to_learner_id)` index と `(family_id, from_user_id)` index を持つ（dev 報告から推察 / 実際の確認は migration ファイル参照可能）。
- 5 分窓 × 5 件の小カウントなので低トラフィック前提では問題ないが、家族数増加時に `(from_user_id, to_learner_id, created_at)` 複合 index の追加が必要になる可能性。
- **推奨**: production 反映後、Turso explain で query plan を 1 回確認（W11 polish or β 直前）。dev 報告 §課題・リスク 3 と一致。
- **修正コスト**: 0 (観測タスクのみ)

#### M-4: `getMessageSenderName` fallback "おうちの ひと" の i18n 戦略

`parent-messages-server.ts:55, 72, 86` は `users.name` 解決失敗時に固定文字列 `"おうちの ひと"` を返す。

- 子供向け平仮名で「家庭内の親」を中性的に指す妥当な fallback だが、将来 `users.name` が NULL になりうるエッジケース（親アカウント削除直後の race）でも UI 表示が崩れない構造的保証。
- **推奨**: 表示文言を template-catalog.ts のような中央化された定数に集約すると保守性が上がる（W12 以降）。
- **修正コスト**: 1 ファイル追加 + 3 箇所の参照書き換え（後続吸収可）

---

## 10. 次のアクション推奨

### 10.1 即 push 可

**main push 推奨**。レビュー側で以下を確認済:

- `bun run typecheck` clean (0 errors)
- `bun run lint` clean (0 errors / 0 warnings)
- `bun run test` 683/683 PASS（W11-T3 baseline 633 + W11-T2 +50）
- `bun run build` 23 routes 全 prerender / dynamic 完遂（Turbopack production）
- `bun run e2e tests/e2e/family-message.spec.ts` 4/4 PASS / 23.9s（chromium + mobile-chrome × 2 ケース）
- `bun run e2e tests/e2e/family-streak.spec.ts --workers=1` 6/6 PASS / 31.2s（W11-T1 regression check）
- `bun run e2e tests/e2e/family-leaderboard.spec.ts` 6/6 PASS（W11-T3 regression check）
- migration 新規ゼロ（schema 変更なし / `parent_messages` W9-D 流用）
- DEC-024 / DEC-003 + COPPA / DEC-055 / Turbopack 制約を構造レベルで保全
- M-1〜M-4 はいずれも push 阻害なし

### 10.2 commit メッセージ案

```
feat(prj-016): W11-T2 親→子 応援メッセージ + DEC-024 moderation pipeline

- 純関数 validateParentMessageBody を src/lib/messages/moderation.ts に分離
  (1〜200 字境界 / 罵倒・否定・強制系 24 語辞書 / PII pattern 3 種 /
   describeModerationReason で前向きコピー / Turbopack 制約対応)
- Server-only helper findOldestUnreadMessage / getMessageSenderName を
  src/lib/messages/parent-messages-server.ts に分離
  (純関数 + SQL family_id WHERE 必須 / COPPA 構造防御)
- 既存 W9-D server action sendMessageFromTemplate (customBody 経路) /
  sendCustomMessage に moderation + rate limit 統合
  (5 分 / 5 件 per parent×learner / SendMessageResult union 拡張)
- Client modal kotodama-tori-modal.tsx 新設
  (data-testid=family-message-modal / 背景クリック抑止 /
   role=dialog + aria-modal + aria-labelledby / 56px tap area /
   KotodamaWakatoriSvg + Heroicons のみ / 絵文字ゼロ)
- /home Server Component に最古未読 modal + 内製 homeMarkReadAction を統合
  (markMessageRead idempotency で reload 安全 / 既読は再 push されない)
- /parent/messages/new TemplatePicker に moderation エラー前向き UI
  (data-testid=moderation-error role=alert / data-testid=send-success role=status)
- markMessageRead docstring を W11-T2 wording へ更新

DEC-024 罰則ゼロ: describeModerationReason 経由 + unit not.toContain で
  罰語の出口を構造的に封鎖。
DEC-003 + COPPA: 三層認可 + SQL family_id 必須で cross-family 漏洩不可能。
DEC-055 idempotency: markMessageRead already_read + reload 再 push の二重保証。
DEC-062 訂正版: 既存 W9-D 基盤を流用 / 新規テーブルゼロ / 1 人日相当。

unit 683 PASS (+50: moderation 43 + parent-messages-server 7) /
typecheck clean / lint clean / build 23 routes /
family-message E2E 4/4 green (chromium + mobile-chrome × 2) /
family-streak E2E regression 6/6 green / family-leaderboard 6/6 green.

Refs: DEC-062, DEC-024, DEC-003, DEC-055, DEC-006
```

### 10.3 後続吸収可（M-1〜M-4）

- **M-1**: ブロック語辞書チューニング戦略 → W12 以降 DEC 化
- **M-2**: PII pattern にハイフンなし携帯対応 → W12 以降 1 行追加
- **M-3**: `isRateLimited` の query plan 確認 → β 直前 production smoke
- **M-4**: fallback `"おうちの ひと"` の中央化 → W12 以降 polish

### 10.4 dashboard 更新 / 次 atomic 着手判断

1. `dashboard/active-projects.md` の PRJ-016 Phase 2 W11 進捗 50% → **75%**（W11-T1 + T3 + T2 完遂）
2. **次 atomic 候補**:
   - **A 案**: W11-T5 Weekly Digest 強化（P1 / 0.5 人日 / 最軽量）で W11 を 4/5 に進める
   - **B 案**: study-smoke preexisting regression 修復（W11-T2 で study UI を踏まなかったため温存可能 / W12 以降の study UI 改修前に解消推奨）
   - **W11-T4 (Daily Push 通知 / P0 / 1.5 人日)** は VAPID 鍵 / Service Worker のオーナー設定待ち = 後段
   - レビュー視点では **A 案優先**（W11 完遂率最大化 + W12 移行に向けた軽量タスク終了）

### 10.5 Production smoke (任意 / オーナー手動)

- 親 session で /home 訪問 → 未読メッセージがあれば kotodama-tori 代読 modal 表示確認
- 「ありがとう」 click で modal 閉じ + 次回 /home で非表示確認
- /parent/messages/new で moderation エラー前向き案内 UI 確認
- schema 変更なしのため migration step 不要（W9-D `parent_messages` 既存テーブルを流用）

---

レビュー部門 / 2026-05-02
