# Review Report — PRJ-016 / DEC-064 W11 follow-up（study-smoke / study-writing-smoke E2E preexisting regression 修復）

- 日時: 2026-05-03
- 担当: レビュー部門
- 関連 atomic: DEC-064
- 検証範囲: 6 ファイル（コード 2 + test config 1 + fixture 1 + decisions 1 + report 1）

---

## 総合判定: **APPROVE**

Critical / Major 指摘 0 件 → コミット進行可。

| 重要度 | 件数 |
|--------|-----|
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Nit | 3 |

---

## レビュー詳細

### 1. `page.tsx` - studyClientKey の learner-stable 化

`studyClientKey` を `learner:<learnerId>` に変更する判断は妥当。

- W10-T4 fix (M-A1) と同パターンの一貫適用で保守性が高い
- Phase 1 想定（1 家族 1 学習者）で learnerId は安定識別子として機能
- session-mode の `session:<id>` 経路は維持されており後方互換 OK
- コメント (L209-216) が根本原因と修正意図を正確に記述

### 2. `StudyClient.tsx` - answeredView snapshot pattern

React 19 + Next.js 16 のベストプラクティス整合確認:

- "Resetting state when a prop changes" pattern は render 中の `if (prevProblemId !== problemId)` で正しく実装。`useEffect` 内 `setState` の cascading render を回避している
- `if (!feedback)` ガードによる「フィードバック描画中は reset しない」分岐は React docs 推奨の派生 state pattern を逸脱していない
- `displayedView = answeredView ?? props` の 3 項派生は純粋関数で副作用なし
- snapshot capture (L428-435) と clear (L524) の対応関係が明確
- **stale closure / memory leak 懸念なし**: `answeredView` は単一 state で `setAnsweredView(null)` で確実に解放される。`useTransition` の async closure 内で `problemId/prompt/choices` を読むが、これは submitChoiceValue 呼出時点の props を意図的にキャプチャする設計通り

### 3. `playwright.config.ts` - OPENAI_API_KEY 空文字 override

`webServer.env` block 内に閉じており、production 経路には漏れない設計。

- `score-writing.ts` L15 注釈「OPENAI_API_KEY 未設定時は決定論的フォールバック」設計と一致
- `jaccardWordOverlap` (L261) がエクスポート済で fallback 経路は単体テスト済（vitest 715 PASS の中に含意）
- ローカル `.env.local` の本番 key を E2E が誤呼出しする事故を構造的に防ぐ良い修正

### 4. `db-fixture.ts` - writing 2 問化

- production の `seed-problems-runner.ts` 側を変えず、E2E fixture のみ拡張で副作用を局所化
- writing-3 で `getNextProblem(...)` が path1/path2 のいずれにもヒットせず null → 「問題が用意されていません」 branch → StudyClient unmount → snapshot pattern 失効、というチェーンは正確に診断されている
- 既存 study-writing-smoke spec の 1 問解答前提も問題なし（2 問あれば 1 問解答後も page.tsx は次問を取得して描画継続）

### 5. DEC 整合確認

| DEC | 整合 | 確認内容 |
|-----|------|---------|
| **DEC-024**（罰則ゼロ） | OK | feedback メッセージに罰語なし。「おしい」「せいかい」「もう少しだけ書いてみよう」等は中立～肯定トーン。snapshot/reset 経路は罰則ロジックに介入なし |
| **DEC-003**（三層認可） | OK | page.tsx の `requireAuth` + `getFamilyIdForUser` + `learner ownership` は無変更。Server Action 認可も無変更 |
| **DEC-006**（GET 10 / mutation 5 不変条件） | OK | API surface 無変更。Server Action 数も増減なし |
| **DEC-055**（idempotency） | OK | `submitAnswer` / `startOrResumeStudySession` / coin_transactions UNIQUE INDEX は無変更 |
| **DEC-064**（本 atomic） | OK | §実装完遂デルタ追補 2 点（OPENAI_API_KEY env / writing 2 問化）も decisions.md に記載済 |

### 6. UX 機能（音響 / Confetti / KotodamaTori / Combo / SessionComplete / LessonComplete）副作用確認

- `audioRef` は `displayedView.audioUrl` を src に bind（L698）→ feedback 中も前問の audio が継続して聞ける（仕様一貫）
- combo / session 集計 state は problem 単位 reset 対象外と明記コメントあり（L361-362）
- LessonCompleteModal / SessionCompleteModal の発火条件 (`!result.nextProblemId && !sessionActive` 等) は無変更
- ことだまトリ mood 計算は `feedback?.streak` 依存で snapshot 影響なし

---

## Minor 指摘

### M1: `displayedView.skill` 経由の `shouldShowAudioUi` (L390)

`shouldShowAudioUi(displayedView.audioUrl, displayedView.skill)` で snapshot の skill を渡しているが、props.skill は learner 単位 / level 単位で確定される値で問題横断で変動しない（page.tsx で `skill = "${skillBase}-${level}"` 確定）。よって `displayedView.skill` も `props.skill` も同値で機能差なし。

- **影響**: なし（純粋に冗長性の話）
- **改善案**: 機能性に影響しないので現状維持で OK。次回リファクタ時に `skill` だけ snapshot に含めない選択肢もある（型がわずかに簡素化される）

### M2: writing fixture コメントの長さ

`db-fixture.ts` L458-465 のコメントは丁寧で良いが 9 行と長め。同等情報が dev report と decisions.md にもあるため、ここでは要点 3 行 + 「詳細は DEC-064 §実装完遂デルタ参照」で短縮可能。

- **影響**: 可読性のみ（情報の正確性は◎）

---

## Nit 指摘

### N1: `void and` (page.tsx L202)

`void and; // import 保持` は import を削除しないためのガードだが、`and` が本ファイルで実使用されているか確認推奨。未使用なら import 自体を削除する方が望ましい（lint が通っているなら現状でも害なし）。

### N2: コメント内コード位置参照（StudyClient.tsx L154-157）

`page.tsx` という他ファイル参照が複数箇所にあるが、リファクタ追従コストあり。参照対象が安定しているので現状維持で OK。

### N3: 「W11 follow-up (DEC-064):」プレフィックスが多数

可読性向上のためコメント先頭に DEC ID を明示する慣行は良いが、5 箇所以上に同一プレフィックスがある。1 箇所のヘッダーコメントで「以下、W11 follow-up (DEC-064) 関連変更」と宣言する形でも可。

---

## 結論

CEO の DIAG spec で診断された Next.js 16 Server Action auto-revalidation × studyClientKey 衝突問題に対する、最小侵襲かつ構造的な修復。React 19 ベストプラクティス、DEC-024 / 003 / 006 / 055 すべてに整合。Critical / Major 指摘なし。

**APPROVE / commit 進行可**

Minor / Nit 指摘 5 件は将来 polish 候補（W12 着手前の 0.1 人日整理 or 任意のリファクタ atomic で吸収可）。
