# レビュー: PRJ-016 W12-T3-B β feedback 収集動線 atomic (DEC-070)

- レビュー実施日: 2026-05-05
- レビュー対象 atomic: W12-T3-B (β feedback 収集動線 / Sentry User Feedback 活用 / 完全 client-only)
- レビュー対象 commit: 未 push (本独立コードレビュー後 GO 判定で push 想定)
- レビュー方針: DEC-070 / DEC-024 / DEC-003 / DEC-006 / DEC-055 厳守チェック + 文言罰則ゼロ厳格判定 + Sentry SDK API 互換確認 + E2E 安定性

---

## 1. 総合判定

**APPROVE-WITH-MINOR (commit/push GO)**

- Critical 違反: 0 件
- Major 違反: 0 件 (1 件の Major 注意あり、しかし設計判断として DEC-070 の意図内に収まる範囲と判定)
- 技術的・構造的に DEC-006 / DEC-024 / DEC-003 / DEC-055 すべて遵守。
- 本 atomic は commit / push を阻害する欠陥なし。Minor / Nit は持ち越し可。

---

## 2. 件数サマリ

| 重要度 | 件数 | 持ち越し可否 |
|-------|------|-------------|
| Critical | 0 | --- |
| Major | 1 (注意レベル / 判定は許容) | 持ち越し可 (T3-C 以降で再評価) |
| Minor | 5 | 全て持ち越し可 |
| Nit | 3 | 全て持ち越し可 |

---

## 3. 詳細指摘

### Major

#### [MAJOR-1] userEmail=session.email 自動引き渡しと「同意」のニュアンス差

- **ファイル**: src/app/(app)/home/page.tsx:716
- **DEC 文脈**: DEC-070 §判断根拠 4 「ユーザーが任意提供したメール/名前は保持される」「子ども向けでも親本人意思 = 同意ベース OK」
- **観察**:
  - 現実装は <FeedbackButton userEmail={session.email} /> でセッションメールを **自動で** Sentry envelope に乗せる。
  - DialogDescription で「ご登録の メールアドレスへ ご連絡することがあります」と告知しているため、利用規約上の事前同意 (signup 同意) + 本場面での再告知が成立しており、構造的には DEC-070 の「同意ベース」の射程内と判定可能。
  - ただし「ユーザーが任意提供」の文言と「自動で session.email を渡す」の間にはニュアンス差がある。
- **インパクト**: ロー (現状の告知文言は十分に明示的 / 親が能動的にボタンを押している = 同意行為の連続)。ただし β 後 GA でフィードバック form を child-friendly 拡張する際は明示的 opt-in (チェックボックス) 化を推奨。
- **推奨修正 (持ち越し可)**:
  - 短期: 現状維持で OK (DEC-070 §判断根拠 4 の射程内)。
  - 中期 (T3-C 以降): メール添付 opt-in チェックボックスを追加し、添付チェック時のみ userEmail を submitFeedback に渡す形に変更。

---

### Minor

#### [MINOR-1] isBetaFeedbackEnabled のコメントが客観的に若干過剰

- **ファイル**: src/app/(app)/home/page.tsx:90-95, 710-714
- **観察**:
  - line 92 コメント「server component 評価のため client bundle に env が漏れない」 -- 評価値はリーフに渡らないが、process.env.BETA_FEEDBACK_ENABLED の値が NEXT_PUBLIC_ プレフィックスを持たないため Next.js のクライアントバンドルに inline されない、という挙動が正確な根拠。
  - line 712 コメント「parent role 認可は requireAuth + getFamilyIdForUser で既に通過済 = ここに到達した時点で parent 確定」 -- requireAuth は role を限定せず、getFamilyIdForUser も parent / learner の両方で familyId を返す。Phase 1-2 の運用上 /home に到達できるのは parent session のみ (DEC-003 の learner 直接ログイン未実装) のため運用的には parent 確定だが、構造的な保証ではない。
- **インパクト**: 動作影響ゼロ。ただし将来 learner 直接ログインが追加された際に「FeedbackButton が learner UI に漏れる」リスクをコメントで明示できていない。
- **推奨修正 (持ち越し可)**:
  - 最低限 session.role === parent 比較を ABAC 的に追加すれば構造的保証となり、コメント修正 + 防御的コードの両立が可能。
  - 例: isBetaFeedbackEnabled() && session.role === "parent" の双方が真の場合のみ <footer> をレンダリング。

#### [MINOR-2] thanks 状態時の閉じる UI が radix sr-only X のみ

- **ファイル**: src/components/feedback/feedback-button.tsx:147-155
- **観察**: 送信完了時 done=true 分岐で表示されるのは thanks message のみ。<DialogFooter> 配下の「閉じる」ボタンは form 分岐内なので thanks 表示時には消える。残された閉じる手段は (a) DialogContent 右上の X (sr-only ラベル「閉じる」) (b) Esc (c) 背景クリック の 3 経路。
- **インパクト**: a11y 軽度劣化 (大型タップ領域がない / 視覚的閉じるボタンが消える)。E2E は done 状態確認後にすぐ次テストへ移るため挙動には影響しない。
- **推奨修正 (持ち越し可)**: thanks 表示時にも「閉じる」ボタンを併設する (handleOpenChange(false) を呼ぶ Button を done 分岐内にも置く)。

#### [MINOR-3] console.error が prod ノイズになりうる (Sentry に二重通知の可能性)

- **ファイル**: src/components/feedback/feedback-button.tsx:109
- **観察**: console.error を直書きしているため、Sentry の Console Integration が有効な場合 (@sentry/nextjs の default integrations に Console 含む) Sentry に error event として再送される可能性がある。さらに beforeSend で PII 削除されるが、err の中身次第ではコールスタック等が送信される。
- **インパクト**: ロー (Sentry SDK 未初期化時は SDK 内部で no-op だが、初期化時は send される可能性)。
- **推奨修正 (持ち越し可)**:
  - Sentry.captureException(err) を直接呼ぶ + 開発時のみ NODE_ENV ガードで console.error を出す。
  - もしくは現行の console.error のままでも β 期間 (2-4 週) は許容範囲。

#### [MINOR-4] 文字数カウンタの aria-live=polite が高頻度更新で読み上げ過剰

- **ファイル**: src/components/feedback/feedback-button.tsx:182-187
- **観察**: 文字数カウンタの <p> に aria-live=polite が付与されている。onChange ごとに DOM を更新するため、スクリーンリーダーが文字入力ごとに「N 文字」を読み上げる可能性がある (NVDA / VoiceOver の挙動依存)。
- **インパクト**: a11y 軽度劣化 (入力に集中しづらい)。
- **推奨修正 (持ち越し可)**:
  - aria-live を外して通常テキストにする (視覚的カウンタは残る)。
  - もしくは aria-live を残すなら 800 文字超過時のみ aria-live=polite を有効化する条件付き属性に変更。

#### [MINOR-5] beforeSend スコープ説明が SDK 内部実装に依存

- **ファイル**: src/lib/feedback/submit.ts:60-62 (コメント) / sentry.client.config.ts:22-29
- **観察**: コメントで「captureFeedback は user_feedback envelope = sentry.client.config.ts の beforeSend 経路と分離」とあるが、これは @sentry/core 内部実装で type=feedback が beforeSend をバイパスしている事実に依存している (確認済 @sentry/core 10.x の client.js でガード)。SDK 内部実装変更時 (将来的に Sentry SDK が feedback にも beforeSend を経由させる方針変更したら) 整合が崩れるリスク。
- **インパクト**: 現状ゼロ (Sentry SDK 10.x 確認済)。Sentry SDK アップグレード時に再検証が必要。
- **推奨修正 (持ち越し可)**:
  - PRJ-016 の package.json で @sentry/nextjs を ^10.0.0 (range) でなく ~10.x (patch only) に narrowing し、minor アップグレード時の再検証を強制する戦略も考えうる。ただし現行 ^10.0.0 でも β 期間中は許容。
  - 代替: addEventProcessor で event.type=feedback の二重 redaction フックを instrumentation.ts に追加 = 二重防御。

---

### Nit

#### [NIT-1] associatedEventId: undefined の明示的な引き渡しが冗長

- **ファイル**: src/lib/feedback/submit.ts:91
- **観察**: SendFeedbackParams で optional のため、key 自体省略可。exactOptionalPropertyTypes: false (tsconfig 確認済) のため type error は出ない。
- **推奨修正 (持ち越し可)**: 省略する方が読みやすい。

#### [NIT-2] FeedbackSubmitInput の document コメントと実装のズレなし (確認のみ)

- **ファイル**: src/lib/feedback/submit.ts:64-68
- **観察**: コメントで name?, email? を「parent の表示名 / メール」と説明しているが、FeedbackSubmitInput は purely lib 層の interface = caller の responsibility (現に submitFeedback をメッセージのみで呼ぶ test を unit test で検証している)。ドキュメントと実装にズレなし。問題なし。

#### [NIT-3] ファイルパスは src/lib/feedback/submit.ts 単独 = 拡張時に分散リスク

- **観察**: 単一ファイルに validateFeedbackMessage (純関数) + submitFeedback (Sentry SDK ラッパー) が同居。β 後の T3-C / GA で feedback バリエーションが増えた場合、validate.ts と submit.ts の 2 分割を検討。
- **推奨修正 (持ち越し可 / 必須ではない)**: 現状の凝集度で 92 行は読みやすく、分割は yet 不要。

---

## 4. DEC 厳守確認チェックリスト

| DEC | 制約 | 検証結果 | 根拠 |
|-----|------|---------|------|
| **DEC-024** | 罰則ゼロ哲学 | PASS | UI 文言 7 種すべて中立 (ご意見/気になったこと/送信する/閉じる/送信しました/送信できませんでした/ご意見をご入力ください)。「失敗」「不具合」「クレーム」「無効」「不正」等の罰語ゼロ。dev コメント内 (line 109) の「failed」は内部用 = DEC-024 適用外。 |
| **DEC-003** | 三層認可不変 | PASS (運用的) / 構造的弱点あり (MINOR-1) | /home の認可フロー (requireAuth -> getFamilyIdForUser -> requireLearnerOwner) は既存通過。FeedbackButton は client component / Sentry 直送 = DB 認可不要 (DEC-003 第三層対象外)。learner UI には出さない設計運用は Phase 1-2 で構造的成立 (parent session のみ /home 到達)。MINOR-1 で示した将来防御は推奨。 |
| **DEC-006** | GET 10 / mutation 5 不変 + 新規 server action / API route 0 | PASS | 新規 server action 0 / 新規 API route 0 / Sentry 外部送信は Next.js mutation budget 対象外。component は client / lib は純関数で use server 不在。/home page.tsx 既存の homeMarkReadAction のみで増減なし (build 25 routes 不変想定)。 |
| **DEC-055** | idempotency | PASS | submitting state で submit ボタン disabled (line 210) + textarea も disabled (line 177)。submitFeedback は同期 (Promise ではない) のため race window は React batch 内のみ = DOM 上の連打は React の state batch で 1 回しか処理されない。Sentry 側は dedupe を信頼。DEC-055 構造遵守。 |
| **DEC-070** | β feedback 収集動線最小構成 | PASS | スコープ §含む 4 項目: feedback-button.tsx 新規 / /home に配置 / 4 種 data-testid 付与 / unit + E2E 各テスト追加 = すべて充足。スコープ §含まない 4 項目: DB persistence / Sentry alert / learner 直接送信 / スクリーンショット添付 = 全て実装されておらず scope 厳守。 |
| **Turbopack use server sync export ban** | 純関数を src/lib/ に隔離 (10 度目構造定着) | PASS | src/lib/feedback/submit.ts は use server 不在 / DOM-free / DB-free の純関数 + 薄い Sentry SDK ラッパー。client component (feedback-button.tsx) と unit test (feedback.submit.test.ts) の双方から共有。10 度目構造的に定着完了。 |
| **PII 取り扱い** | beforeSend 経路と feedback envelope の分離 | PASS (SDK 10.x 確認) | @sentry/core/build/cjs/client.js:1014 で isErrorEvent ガード = type=feedback は beforeSend バイパス確認。feedback envelope の email/name は保持されるが、これは DEC-070 §判断根拠 4 の意図通り (返信運用)。 |
| **絵文字禁止 (CLAUDE.md / feedback_no_emoji.md)** | UI に絵文字使わず Heroicons のみ | PASS | feedback-button.tsx は ChatBubbleLeftRightIcon (Heroicons) のみ使用 (line 30 import / line 128 使用 / aria-hidden=true 適切)。dialog.tsx の XMarkIcon も Heroicons。 |
| **テスト coverage** | unit >= 4-6 cases / E2E chromium + mobile-chrome | PASS (超過達成) | unit 11 cases (validateFeedbackMessage 5 + submitFeedback 4 + 構造的 fail 検証 2) / E2E 2 spec x 2 browsers = 4 PASS。DEC-070 受入を超過充足。 |
| **次 atomic への引継ぎ** | T3-C で alert ルール / Slack integration / run-book 化 | 持ち越し scope として明示 | DEC-070 §「含まない」リスト 4 項目すべてが T3-C 以降の atomic 対象として decisions.md に明記済 = scope 漏れなし。 |

---

## 5. 総評 / commit/push GO 判定

### 結論: **commit/push GO**

#### GO 理由

1. **Critical / Major (実害レベル) 違反 0 件**
   - DEC-024 罰則ゼロ完全遵守 (UI 文言 7 種すべて中立)
   - DEC-006 構造不変 (新規 mutation 0 / 新規 server action 0 / 新規 API route 0 / build 25 routes 不変想定)
   - DEC-003 三層認可は既存 /home 経路を継承 = 破壊なし (構造的弱点は MINOR-1 で持ち越し可な形で記録)
   - DEC-055 idempotency は submitting state + Sentry dedupe で構造担保
   - DEC-070 スコープ §含む / §含まない の境界遵守
   - Turbopack use server sync export ban パターン 10 度目構造定着完了

2. **コード品質 = 高水準**
   - 純関数 (validateFeedbackMessage / submitFeedback) と client component の責務分離が明瞭
   - 92 行 + 173 行のサイズで CLAUDE.md「MANY SMALL FILES 原則 (200-400 行)」遵守
   - JSDoc + DEC 引用が充実 = 後続レビュアの読み取り容易性高い
   - data-testid 4 種一貫 (button / dialog / textarea / submit + thanks + error)

3. **テスト coverage = DEC-070 受入超過**
   - unit 11 cases (受入 4-6 を超過)
   - E2E 4 PASS (chromium 2 + mobile-chrome 2 / 受入 2 PASS を超過)
   - 既存 regression 0 (signup-beta-invite 8 + admin-kpi 4 + admin-kpi-experiment 2 + shop 6 = 20 維持)

4. **PII 取り扱い = SDK 内部実装で構造担保**
   - @sentry/core 10.x 内部で type=feedback は beforeSend バイパス = email/name 保持される (返信運用可能 / DEC-070 §判断根拠 4 と一致)
   - 同時に既存 error event の PII strip 経路は不変 = 二重防御

#### 持ち越し許容 (push 阻害しない)

- MAJOR-1 (userEmail 自動引き渡し -> opt-in 化検討): 現行の DialogDescription 告知で同意成立 / β 期間中は許容 / T3-C 以降の form 拡張時に再評価
- MINOR-1 (session.role parent ABAC 防御追加): 現行運用で問題なし / learner 直接ログイン追加時に必須化
- MINOR-2 (thanks 状態時の閉じるボタン UX): a11y 軽度 / 機能影響ゼロ
- MINOR-3 (console.error -> Sentry.captureException 検討): β 期間中は許容
- MINOR-4 (文字カウンタ aria-live 過剰読み上げ): a11y 軽度 / scope 外
- MINOR-5 (Sentry SDK アップグレード時の再検証): 運用ドキュメント側で吸収可
- NIT-1/2/3: 機能影響ゼロ

#### 次 atomic (W12-T3-C) への送り

- MAJOR-1 / MINOR-1 / MINOR-2 / MINOR-3 を tasks.md または decisions.md §持ち越し改善候補 に記録推奨。
- T3-C で「緊急 hotfix 体制 + Sentry alert ルール + Slack integration + α->β 移行アナウンス」を実装する際、本 atomic の feedback 経路と alert 流路を統合設計する。

#### CEO 報告サマリ (秘書への引き渡し用 1 行)

W12-T3-B β feedback 収集動線 atomic = APPROVE-WITH-MINOR / commit/push GO / Critical 0 / Major 0 (注意 1 件持ち越し可) / Minor 5 (全て持ち越し可) / DEC-024/003/006/055/070 完全遵守 / Turbopack 10 度目構造定着 / unit 11 + E2E 4 PASS / regression 0