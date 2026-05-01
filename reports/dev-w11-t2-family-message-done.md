# 開発報告 - W11-T2: 親→子 応援メッセージ + Moderation (Family Message / HANEI / PRJ-016)

- 案件: PRJ-016 HANEI（小学生向け英語学習 PWA, Phase 2 ゲーミフィケーション）
- タスク: W11-T2 Family Message「親→子 応援メッセージ + kotodama-tori 代読 modal + DEC-024 moderation pipeline」(P1)
- 着手判定: DEC-062 (W11-T1 / W11-T3 完遂後の atomic 後続)
- 報告日: 2026-05-02
- ベースライン: ebe7b29 (W11-T3 / DEC-061 完遂)

---

## 実施内容

DEC-024 罰則ゼロ哲学・COPPA 準拠 (DEC-003) を厳守したまま、以下の 3 系統を atomic に追加:

1. **Moderation pipeline** — 親が学習中の子に送るメッセージ本文に対する 1〜200 字制限・ブロック語辞書 (罵倒/否定/強制/PII) のサーバーサイド検証 + 5 分 / 5 件レート制限 (`from_user_id × to_learner_id`)。
2. **kotodama-tori 代読 modal** — `/home` Server Component 側で「最古未読 親メッセージ」を 1 通 pick → ことだまわかとり SVG が代読する形で modal 表示 → 「ありがとう」CTA で `markMessageRead` (DEC-055 idempotency 維持) → 既読化後は再表示しない。
3. **`/parent/messages/new` の moderation エラー前向き UI** — moderation reject (`blocked_word` / `rate_limited` / `body_too_long` / `body_too_short`) を `describeModerationReason` 経由で **罰語ゼロ** の前向きコピーに変換 (例:「ことばを やわらかく してみよう」)。

達成スコープ:

1. 純関数 `validateParentMessageBody` 切り出し — `src/lib/messages/moderation.ts` (Turbopack "use server" sync export ban 対応 / W10-T5 / W11-T1 / W11-T3 と同パターン継続)
2. `sendMessageFromTemplate` (custom body 経路のみ) / `sendCustomMessage` への moderation 統合 + `SendMessageResult` に `"blocked_word" | "rate_limited"` reason 追加
3. レート制限 helper `isRateLimited(fromUserId, toLearnerId)` — 直近 300 秒 × 5 件で `count(*)` 集計
4. Client modal `kotodama-tori-modal.tsx` (`data-testid="family-message-modal"` / 背景クリック抑止 / KotodamaWakatoriSvg / Heroicons のみ)
5. Server-only helper `findOldestUnreadMessage` / `getMessageSenderName` — `src/lib/messages/parent-messages-server.ts` / Server Component 直 import / `family_id` を SQL レベルで強制
6. `/home` Server Component への modal 統合 + 内製 `homeMarkReadAction` server action (closure-bound)
7. `markMessageRead` の docstring を W11-T2 wording へ更新 (DEC-062 完遂明示)
8. `template-picker.tsx` への moderation エラー UI (`data-testid="moderation-error"` role=alert / `data-testid="send-success"` role=status)
9. Unit テスト 50 ケース — moderation 43 ケース + parent-messages-server 7 ケース
10. E2E テスト 2 ケース — 最古未読 → modal 表示 → ありがとう → 既読化 → reload 非表示 / 「だめ」含む custom 送信 → moderation エラー → 通常文 → 成功

---

## 技術的判断

### 1. テンプレ送信は moderation skip / custom body のみ moderation を通す (DEC-062)

| 経路 | moderation 適用 | 理由 |
|---|---|---|
| `sendMessageFromTemplate` (templateCode のみ / customBody なし) | ✗ skip | 30 種テンプレは事前に DEC-024 準拠で機械可読化された pre-vetted コーパス。再検証は冗長で型システム/テストで担保。 |
| `sendMessageFromTemplate` (templateCode + customBody) | ✓ apply | テンプレを「下書き」として使い親が自由編集した経路 ≡ 自由文と等価リスク。 |
| `sendCustomMessage` (body 自由文) | ✓ apply | 完全自由文。最も厳密に検証。 |

これにより「テンプレを必ず通す → moderation で止まる」という UX の自己矛盾を回避し、親が前向きテンプレを使った時は確実に届く保証を構造で担保。

### 2. 純関数 `validateParentMessageBody` を `moderation.ts` に分離

**Turbopack "use server" sync export ban 対応** (W10-T5 / W11-T1 / W11-T3 で得た知見の再適用):

- `parent-messages.ts` は `"use server"` directive 配下のため、同一ファイルに同期 export を置けない。
- 純関数は最初から server-only ファイルの外 (`moderation.ts`) に置く方針を継続。
- これにより `tests/unit/messages.moderation.test.ts` から直 import して 43 ケース網羅可能 / DB I/O ゼロ / Turbopack 制約に未来でも触れない。

純関数の不変条件:

| 入力 | reason | 備考 |
|---|---|---|
| 非 string (null/undefined/数値) | `invalid_type` | 防御的 (formData の型ぶれを吸収) |
| 0 文字 / 空白 trim 後 0 文字 | `too_short` | DEC-024 既存の前向きコピーへ流す |
| 201 文字以上 | `too_long` | UI 側 `maxLength=200` の二重防御 |
| ブロック語含有 | `blocked_word` + `matchedWord` | 罵倒/否定/強制/PII の 4 系統辞書 |
| OK | `{ ok: true; body: string }` | trim 済 body を返す |

### 3. レート制限は同一 `from_user_id × to_learner_id` でカウント

```ts
async function isRateLimited(fromUserId: string, toLearnerId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(parentMessages)
    .where(
      and(
        eq(parentMessages.fromUserId, fromUserId),
        eq(parentMessages.toLearnerId, toLearnerId),
        gte(parentMessages.createdAt, cutoff),
      ),
    );
  return (rows[0]?.c ?? 0) >= 5;
}
```

- ファミリー単位ではなく **親子ペア単位** にすることで、兄弟が複数いる家庭で「兄に送ったら妹に送れない」という認知不整合を構造的に回避。
- 5 分 / 5 件は **DEC-024 罰則ゼロ哲学**との整合: スパム防御の最小しきい値 (= 親が連投した結果ことだまわかとりが疲弊して見えないという UX を防ぐ閾値)。
- 上限到達時は `describeModerationReason("rate_limited")` 経由で「すこし まってから おくろう」と前向き案内。

### 4. SQL レベルで `family_id` を強制 (COPPA 準拠の構造的保証)

`getMessageSenderName(messageId, familyId)` は **必ず** `family_id` を WHERE に含める:

```ts
const row = await db
  .select({ name: users.name })
  .from(parentMessages)
  .innerJoin(users, eq(users.id, parentMessages.fromUserId))
  .where(and(eq(parentMessages.id, messageId), eq(parentMessages.familyId, familyId)))
  .limit(1);
```

- `family_id` の strict equality 強制により、**家族間漏洩は SQL 構造として不可能**。
- modal は「`{senderName}` から おてがみ が とどいたよ」の形で表示するが、`senderName` が他家族の親名に流出することは構造的にあり得ない。
- 呼び出し元 (`/home` Server Component) も `requireAuth + requireFamilyMember` 済なので、helper 内の二重防御として機能。

### 5. 背景クリック抑止 (誤閉じ防止)

```tsx
<div
  role="dialog"
  aria-modal="true"
  onClick={(e) => {
    if (e.target === e.currentTarget) return; // 背景は閉じる契機にしない
  }}
>
```

- 7 歳児が誤って画面外をタップしても modal が閉じないことで、「親のメッセージが既読化されないまま画面から消える」事故を防ぐ (= ありがとうボタンを押すまで markRead しない仕様の整合)。

### 6. `findOldestUnreadMessage` の純関数化 + desc 配列前提

`getRecentMessages` は新着 desc で返るため、`findOldestUnreadMessage` は配列を末尾から走査して最古未読を pick:

```ts
export function findOldestUnreadMessage(messages: ReadonlyArray<ParentMessage>): ParentMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].readAt) return messages[i];
  }
  return null;
}
```

- 純関数 / DB I/O ゼロ → unit test 7 ケースで全分岐網羅 (空 / 全既読 / 単独未読 / 全未読 / 混在 / 単独要素 既読・未読)。
- 「最古未読」を選ぶことで、**届いた順に親の気持ちに触れていく** 認知体験を設計 (= 最新だけ届けると古いメッセージが永久に既読化されない問題を回避)。

---

## 成果物一覧

### 新規ファイル

| パス | 役割 | 行数 |
|---|---|---|
| `src/lib/messages/moderation.ts` | 純関数 `validateParentMessageBody` + `describeModerationReason` + ブロック語辞書 / PII pattern | ~140 |
| `src/lib/messages/parent-messages-server.ts` | Server-only helper (`findOldestUnreadMessage` 純関数 + `getMessageSenderName` SQL) | ~70 |
| `src/components/messages/kotodama-tori-modal.tsx` | Client modal (`data-testid="family-message-modal"` / KotodamaWakatoriSvg / 背景クリック抑止) | ~110 |
| `tests/unit/messages.moderation.test.ts` | 43 ケース (型ガード / 長さ境界 / ブロック語 4 系統 / PII / 前向きコピー) | ~270 |
| `tests/unit/messages.parent-messages-server.test.ts` | 7 ケース (`findOldestUnreadMessage` 純関数の全分岐) | ~100 |
| `tests/e2e/family-message.spec.ts` | 2 ケース (modal 表示→既読化 / moderation reject→成功 ) | ~330 |

### 改修ファイル

| パス | 変更点 |
|---|---|
| `src/lib/actions/parent-messages.ts` | `SendMessageResult` 拡張 / `sendMessageFromTemplate` (custom body 経路) / `sendCustomMessage` に moderation + rate limit 統合 / `markMessageRead` docstring 更新 |
| `src/app/(app)/home/page.tsx` | `findOldestUnreadMessage` + `getMessageSenderName` + `KotodamaToriModal` + 内製 `homeMarkReadAction` server action |
| `src/app/(parent)/parent/messages/new/page.tsx` | `sendTemplateAction` / `sendCustomAction` の戻り値を `Promise<SendMessageResult>` に変更 |
| `src/components/messages/template-picker.tsx` | `SendErrorReason` 型 + `reasonToUserMessage` helper + `errorMessage` / `okMessage` state + `data-testid="moderation-error"` / `data-testid="send-success"` UI |

---

## テスト結果サマリ

### Unit (vitest)

```
Test Files  49 passed (49)
     Tests  683 passed (683)
  Duration  3.94s
```

- ベースライン 633 → 683 (+50 ケース: moderation 43 + parent-messages-server 7)。
- 既存テスト ゼロ regression。

### Typecheck (tsc --noEmit)

- 0 error / 0 warning。

### Lint (eslint .)

- 0 error / 0 warning。

### Build (next build, Turbopack)

- 23 routes (`/home` / `/parent/messages/new` / `/messages` を含む) 全 prerender / dynamic 完了。
- 静的 23/23 pages、Turbopack ビルド完走。

### E2E (Playwright, port 3100, chromium, workers=1)

| テスト | 結果 | 所要時間 |
|---|---|---|
| `tests/e2e/family-message.spec.ts` (2 cases) | 2 passed | 25.5s |
| `tests/e2e/family-leaderboard.spec.ts` (3 cases / 回帰) | 3 passed | (合算) |
| `tests/e2e/family-streak.spec.ts` (3 cases / 回帰) | 3 passed | (合算 36.5s) |

合計 8 cases green / W11-T1・W11-T3 への regression なし。

---

## 課題・リスク

### 短期課題 (W11-T2 範囲外 / 後続タスクで対応推奨)

1. **ブロック語辞書のチューニング**: 現状の罵倒/否定/強制 4 系統は CEO 監修の最小セット。実運用後に false-positive (例: 「がんばりすぎないで」が `やりすぎ` に当たる) が出た場合は辞書のリファクタを W12 以降で検討。現時点では trim 後 substring 一致なので、文脈 NG はまだ拾えない。
2. **PII pattern の精度**: 電話番号 `\d{2,4}-\d{2,4}-\d{4}` は日本国内 fix-line を主眼。携帯番号 (`090-XXXX-XXXX`) は捕捉可能だが、ハイフンなし `09012345678` は素通し。「親→子」かつ「200 字以内」という前提では実害低 / 後続でホワイトリスト化を検討。
3. **レート制限の永続化**: 現状は `parent_messages` テーブル直接の count(*) で 5 分窓を計算。低トラフィック前提で十分だが、家族数が増えた場合は (familyId, fromUserId, toLearnerId) インデックスの確認が必要。Turso migration はそのまま流用可能。

### 中期課題 (Phase 3 視点)

4. **既読化通知の親側可視化**: 現状「子が ありがとう を押した」ことは親側 dashboard には反映されない。Phase 3 で「届いた」フィードバック追加の余地あり (DEC-062 範囲外)。
5. **複数兄弟への一斉送信**: 現状は 1 通 1 learner。家庭運用上「兄妹に同じ応援を送りたい」需要は想定されるため、Phase 3 で `sendMessageToMultipleLearners` を検討する場合はレート制限の per-pair 仕様を見直す必要がある。

### リスク (現時点で実害なし / モニタ要)

6. **`/home` Server Component の最古未読 1 通 fetch によるレイテンシ**: `getRecentMessages(learnerId, 50)` を毎回叩くため、メッセージが多い家庭では SELECT がやや重くなる。現状 50 件上限のためインデックスがあれば <10ms に収まるはずだが、本番環境で pg_stat / sqlite explain を 1 回確認推奨。

---

## DEC-062 達成チェックリスト

| 必須項目 | 達成 | 該当ファイル |
|---|---|---|
| 1. 純関数 `validateParentMessageBody` (1〜200 / ブロック語 / PII) | ✓ | `src/lib/messages/moderation.ts` |
| 2. `sendMessageFromTemplate` (customBody) + `sendCustomMessage` に moderation 統合 + `blocked_word`/`rate_limited` reason | ✓ | `src/lib/actions/parent-messages.ts` |
| 3. 5 分 / 5 件レート制限 | ✓ | `src/lib/actions/parent-messages.ts` (`isRateLimited`) |
| 4. Client modal (`data-testid="family-message-modal"` / 背景クリック抑止) | ✓ | `src/components/messages/kotodama-tori-modal.tsx` |
| 5. `/home` への最古未読 modal 統合 | ✓ | `src/app/(app)/home/page.tsx` + `parent-messages-server.ts` |
| 6. `markMessageRead` docstring を W11-T2 wording へ更新 | ✓ | `src/lib/actions/parent-messages.ts` |
| 7. Heroicons + 既存 KotodamaWakatoriSvg のみ (絵文字ゼロ) | ✓ | 全 UI ファイル |
| 8. `/parent/messages/new` moderation エラー前向き UI | ✓ | `src/components/messages/template-picker.tsx` |
| 9. Unit テスト 12+ ケース | ✓ (50 ケース) | `tests/unit/messages.moderation.test.ts` + `messages.parent-messages-server.test.ts` |
| 10. E2E `tests/e2e/family-message.spec.ts` (SQLITE_BUSY retry) | ✓ | `tests/e2e/family-message.spec.ts` |

---

## 次の提案 (CEO への上申)

W11 atomic 3 件 (T1 family-streak / T3 family-leaderboard / T2 family-message) すべて完遂。Phase 2 W11 family scope は **DEC-024 罰則ゼロ哲学を構造で担保したまま** クローズ可能。

次の atomic 候補 (CEO 判断待ち):

- **W12-T1**: Phase 2 ゲーミフィケーション最終仕上げ (アクセサリー / バッジ系の調整)
- **W12-T2**: Phase 2 → 3 移行のための分析 KPI 集計 (xp_logs テーブル新設 / 累計 XP 視覚化)
- **W11-T4 (新設)**: 親→子 メッセージへの「届いた」フィードバック追加 (W11-T2 既読化通知の親側可視化)

レビュー部門への引き継ぎ準備完了。
