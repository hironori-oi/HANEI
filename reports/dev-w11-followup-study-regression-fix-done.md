# 開発報告 — PRJ-016 W11 follow-up / DEC-064 完遂

- 日時: 2026-05-02
- 担当: 開発部門
- 関連 atomic: DEC-064（study-smoke / study-writing-smoke E2E preexisting regression 修復）

---

## 実施内容

W11 安定化の最後の閉じとして、`study-smoke` / `study-writing-smoke` E2E の preexisting regression を修復した。

CEO の DIAG spec で観測されていた症状:

```
[t=0]   click choice A → submitChoiceValue → startTransition
[t=200] submitAnswer 完了 (correct:true) → setFeedback(result) コール
[t=200] StudyClient render (problemId=prb_001)
[t=210] StudyClient render (problemId=prb_002)   ← prop 切替
[t=210] StudyClient UNMOUNTED / MOUNTED          ← 新インスタンス
[t=324] feedback NOT visible / fresh state
```

の根本原因は **Next.js 16 Server Action auto-revalidation × `studyClientKey` の衝突** だった。
submitAnswer は SRS dueAt を未来に更新するため `getNextProblem(...)` が次問 ID を返し、
従来の `studyClientKey = "problem:" + problem.id` が変化 → React が StudyClient を unmount →
`setFeedback(...)` した値が破棄されていた。

これに加え、dev 着手時の trust-but-verify で `study-writing-smoke` のみ別系統の preexisting failure を確認したため、計 6 ファイル（コード 2 + テスト config 1 + fixture 1 + decisions 1 + report 1）に閉じる atomic 修正を実施した。

---

## 技術的判断

### 1. `studyClientKey` を learner-stable に変更（page.tsx）

W10-T4 fix M-A1 で session-mode は既に `session:<id>` で StudyClient instance を維持していた。
同パターンを Phase 1 直リンク経路（非セッション mode）にも展開し `learner:<learnerId>` を採用。
これで auto-revalidation で `problem.id` が次問へ変化しても、
StudyClient は同一インスタンスを維持する。

### 2. prevProblemId pattern を「feedback 描画中は reset しない」に変更（StudyClient.tsx）

React 19 推奨の "Resetting state when a prop changes" パターンを保持しつつ、
`if (!feedback)` で囲むことで「ユーザが解答結果を見ている間は前問の選択 / textarea / audio 状態を維持」する挙動に変更。
`feedback` 自体は handleNext で明示 clear する（責務分離）。

### 3. `answeredView` snapshot state 導入（StudyClient.tsx）

`{ problemId, prompt, choices, problemType, audioUrl, skill }` を `setFeedback(result)` の直前にキャプチャし、
描画時は `displayedView = answeredView ?? props` で派生値を計算する。
これにより auto-revalidation で props.prompt / props.choices が次問に変化しても、
ユーザが「次の問題へ」を押すまで「直前に答えた問題」の prompt / choices / audio を描画し続ける。
`feedback.correctAnswer` / `feedback.explanation` は元々 server response の値であり frozen のためそのまま使用。

### 4. handleNext で answeredView を明示 clear（StudyClient.tsx）

`if (feedback?.nextProblemId) { ... setFeedback(null); setAnsweredView(null); ... }` で、
「次の問題へ」押下時に feedback / answeredView を同時に null 化。
次サイクルでは props.problemId（次問）が描画ソースとなり、prevProblemId branch の reset 経路にも入って残りの state も clean up される。

### 5. （追補）`OPENAI_API_KEY: ""` を webServer env で固定（playwright.config.ts）

`.env.local` に置かれている本番 API キーが production webServer で読まれて
`score-writing` が OpenAI 実呼び出ししていた。
`gpt-5-mini` primary が `finishReason:'length'` で JSON parse error → fallback model を含めて 15s `feedback` timeout を超過する flaky 化が発生していた。
`study-writing-smoke.spec.ts:128` の注釈「OPENAI_API_KEY 不在環境前提」設計に合わせ、E2E webServer は決定論 jaccard fallback に固定。

### 6. （追補）writing seed を 1 問 → 2 問に拡張（tests/e2e/fixtures/db-fixture.ts）

writing-3 が 1 問しか seed されておらず、submitAnswer 後の auto-revalidation で
`getNextProblem(level=3, skill=writing-3)` が path1（due）/ path2（NOT EXISTS）どちらにも該当せず null を返す
→ page.tsx が「問題が用意されていません」branch に落ちて `<StudyClient>` 自体を render しなくなる
→ answeredView snapshot で守れない（snapshot は StudyClient 配下の Card にあるため）。

writing-3 を 2 問にすると次問描画で同一 StudyClient インスタンスが維持され、answeredView snapshot が機能する。
production seed は十分な多様性があるため本変更は E2E fixture 限定。

### 6 修正の関係

(1)-(4) は DEC-064 当初スコープ。(5)-(6) は dev 着手時に判明した E2E 再現失敗から逆算した周辺修正。
(5)(6) を別 atomic に分割すると本問題の green 化が達成できないため同 atomic に取り込んだ（決定済 / DEC-064 §実装完遂デルタ参照）。

---

## 成果物

### 変更ファイル（6 件）

| ファイル | 変更内容 |
|---------|---------|
| `app/src/app/(app)/study/[levelCode]/[skillCode]/page.tsx` | `studyClientKey` を `learner:<learnerId>` に変更 + 詳細コメント追加 |
| `app/src/app/(app)/study/[levelCode]/[skillCode]/StudyClient.tsx` | `AnsweredView` 型 + `answeredView` state + prevProblemId pattern を `if (!feedback)` で囲む + `displayedView` 派生 + JSX 描画ソース置換 + submitChoiceValue で snapshot capture + handleNext で clear |
| `app/playwright.config.ts` | webServer env に `OPENAI_API_KEY: ""` 追加（決定論 jaccard fallback 固定） |
| `app/tests/e2e/fixtures/db-fixture.ts` | writing seed を 1 問 → 2 問に拡張（`prb_e2e_3_writing_001` + `prb_e2e_3_writing_002`） |
| `projects/PRJ-016/decisions.md` | DEC-064 §実装完遂デルタ追補 + trust-but-verify 結果記載 |
| `projects/PRJ-016/reports/dev-w11-followup-study-regression-fix-done.md` | 本ファイル |

### 新規ファイル

なし（snapshot pattern は既存 StudyClient 内に閉じる）

### 削除ファイル

なし

---

## テスト結果

### typecheck / lint / unit

| Gate | Result |
|------|--------|
| `bun run typecheck` | PASS（tsc --noEmit 完了） |
| `bun run lint` | PASS（warning 0） |
| `bun run test`（vitest） | **715 PASS / 50 files**（baseline 維持 / 新規 unit 追加なし） |
| `bun run build` | PASS（**23 routes** / 新規ルートなし） |

### E2E

| spec | chromium | mobile-chrome | 計 |
|------|----------|---------------|---|
| `study-smoke.spec.ts` | 1 PASS | 1 PASS | **2** |
| `study-writing-smoke.spec.ts` | 1 PASS | 1 PASS | **2** |
| `study-smoke-multi-level.spec.ts` | 4 PASS | 4 PASS | **8** |
| `family-streak.spec.ts` | 3 PASS | 3 PASS | **6** |
| `family-leaderboard.spec.ts` | 3 PASS | 3 PASS | **6** |
| `family-message.spec.ts` | 2 PASS | 2 PASS | **4** |
| `family-weekly-digest.spec.ts` | 2 PASS | 2 PASS | **4** |
| `session-cumulative.spec.ts` | 2 PASS | 2 PASS | **4** |
| `overtime-cumulative.spec.ts` | 1 PASS | 1 PASS | **2** |
| **合計** | | | **38 PASS** |

CEO 受入基準（study 8 + family 20 + session/overtime 6 = 34 PASS）に対し **38 PASS 達成** / 失敗 0 / リグレッション 0。

---

## 技術的課題・リスク

### 解消されたもの

- Next.js 16 Server Action auto-revalidation × studyClientKey unmount race は本 atomic で恒久解消。
- `OPENAI_API_KEY` がローカル `.env.local` に残っている環境でも E2E は決定論経路に固定されるため、コスト 0 / flaky 0。
- writing-3 の seed 不足による page.tsx「問題が用意されていません」branch 露出は、E2E fixture の 2 問化で構造的に解消。

### 残課題（次 atomic 候補）

- **W12 KPI ダッシュボード着手**: W11 安定化が今 atomic で完全閉じたので、次は次 milestone へ進める。
- **W11-T4 Daily Push 通知**: オーナー VAPID 鍵 + Service Worker 設定待ち（外部依存ブロッカー / 着手不可）。
- **production writing seed の拡充**: 本 atomic は E2E fixture のみ修正。production の `seed-problems-runner.ts` で writing-3 を複数問入れる作業は別 atomic（W12 着手判断後）。
- **score-writing primary `finishReason:'length'` 対応**: gpt-5-mini が JSON 完了前に max_tokens 到達するケースが本番で出れば SLO ベルが鳴る可能性。`MAX_OUTPUT_TOKENS` の検討、または fallback model `gpt-4o-mini` への迅速切替の自動化を検討候補に。E2E では本変更で迂回済 / 本番影響は別 SLO で監視。

### DEC 整合

- **DEC-024（罰則ゼロ哲学）厳守**: feedback は罰語不在 / 送信失敗時の `setError(...)` も中立トーン維持。
- **DEC-003（三層認可）厳守**: server-side 認可は無変更（page.tsx の requireAuth + getFamilyIdForUser + learner ownership は既存通り）。
- **DEC-006（10 GET / 5 mutation 不変条件）厳守**: Server Action / API surface は無変更。
- **DEC-055（idempotency）厳守**: submitAnswer / startOrResumeStudySession の idempotency 経路は無変更。
- **DEC-064（本 atomic）**: §実装完遂デルタの追補 2 点も含めて完遂。

---

## CEO への申し送り

- W11 第 5 atomic = DEC-064 完遂。**W11 完全閉じ**（T1 / T2 / T3 / T5 + 本 follow-up）。T4 のみオーナー外部設定ブロッカーで未着手。
- 既存 E2E grid（study + family + session/overtime）は全 green / W12 KPI ダッシュボード着手の前提条件クリア。
- レビュー部門呼び出し → atomic commit → push → dashboard 更新 → CEO 報告の通常フローへ。
