# 秘書部門 KPT 振り返り — PRJ-016 HANEI Phase 2 W11

- 案件: PRJ-016 HANEI（小学生向け英検 PWA / Phase 2 ゲーミフィケーション）
- 期間: 2026-05-01 〜 2026-05-03（W11-T1 着手 = DEC-060 → W11 follow-up = DEC-064 完遂）
- atomic 件数: 5（W11-T1 / W11-T3 / W11-T2 / W11-T5 / W11-followup）
- 完遂日: 2026-05-03（DEC-064 push commit `67dd31d` / E2E 38 PASS）
- 担当: secretary（記録 / KPT 整理）/ CEO 委任ベース
- 関連 DEC: DEC-060, DEC-061, DEC-062, DEC-063, DEC-064
- 関連 reports: `dev-w11-t1-family-streak-done.md` / `review-w11-t1-family-streak.md` / `dev-w11-t3-family-leaderboard-done.md` / `review-w11-t3-family-leaderboard.md` / `dev-w11-t2-family-message-done.md` / `review-w11-t2-family-message.md` / `dev-w11-t5-weekly-digest-card-done.md` / `review-w11-t5-weekly-digest-card.md` / `dev-w11-followup-study-regression-fix-done.md` / `review-w11-followup-study-regression-fix.md`
- 報告日: 2026-05-05

---

## 1. 概要

W11 は Phase 2 ゲーミフィケーション「保護者連動・家族化」週として計画 4 タスク + 規制対応 1 タスク = 5 atomic を 3 日間（カレンダー）で完遂した。中心テーマは **「家族 scope の HANEI USP（兄弟救済 + 健全競争 + 親子つながり）を DEC-024 罰則ゼロ哲学を構造で担保したまま実装する」** であり、新規テーブル 1 件（`families` への 2 列追加 = migration 0015）/ 新規 server action 4 系統 / 純関数 5 ファイル / unit +112 件（603 → 715）/ E2E +24 件（W11 family-* 20 + study smoke 復活 8）を atomic に積み上げた。

主要成果:

- **W11-T1 Family Streak** (DEC-060 / commit `15f3b92`) — `families` 2 列追加 + 兄弟救済の冪等性を純関数 + atomic UPDATE WHERE で二重保証
- **W11-T3 Family Leaderboard** (DEC-061 / commit `e201de2`) — read-only 1224 ranking で「最下位」概念を構造的に持たない設計、COPPA 準拠の SQL family_id 強制
- **W11-T2 Family Message** (DEC-062 / commit `12d93cf`) — W9-D 既存基盤再利用で見積 2 人日 → 1 人日に半減、moderation pipeline + kotodama-tori 代読 modal
- **W11-T5 Weekly Digest Card** (DEC-063 / commit `33ddb80`) — 既存基盤 70% 流用で 0.5 人日完遂、罰語 catalog pre-curated で構造的封鎖
- **W11 follow-up study-smoke 修復** (DEC-064 / commit `67dd31d`) — Next.js 16 Server Action auto-revalidation × `studyClientKey` の根本原因特定、prevProblemId pattern + answeredView snapshot で恒久解決

W11 完遂時点で Phase 2 進捗 95%（W11 5/5 完遂、W11-T4 Daily Push のみオーナー VAPID 鍵設定待ちで W12 以降に持越）。E2E 全 38 PASS / リグレッション 0 / Critical/Major 指摘 0。

---

## 2. atomic 別ハイライト

### 2.1 DEC-060 / W11-T1 Family Streak（家族のれんぞく）

- **判断**: P0 / 1.5 人日 / W11 第 1 atomic として最小スコープ + 基盤性で着手 GO（外部依存ゼロ / W11-T3 が同じ family scope 集計基盤を再利用できるため）
- **採用設計**: `families` テーブル 2 列追加（migration 0015）+ 純関数 `computeFamilyStreakRollover` 切り出し + Server action `updateFamilyStreakOnLearn`（三層認可 + atomic UPDATE WHERE で同日 2 回目 no-op を SQL 側でも構造保証）
- **核心差別化軸**: 兄弟救済 = 1 人でも当日学習すれば family streak 維持。Duolingo Family Plan を超える「日本の家族にフィットする」第 1 ピース
- **品質ゲート結果**: vitest 619 PASS（+16）/ typecheck/lint clean / E2E family-streak 3/3 / レビュー APPROVE / Minor 4 件のみ（push 阻害なし）
- **発見されたリスク**: 着手中盤に **study-smoke preexisting regression** に遭遇 → E2E 戦略を「親 dashboard read path 集中」に切替えて回避（後の DEC-064 で修復）

### 2.2 DEC-061 / W11-T3 Family Leaderboard（家族内ランキング）

- **判断**: P1 / 1.5 人日 / W11 第 2 atomic として **P0 の T2 を先送りして先行着手 GO**（read-only / 新規テーブル不要 / preexisting regression に独立）
- **採用設計**: `getFamilyWeeklyLeaderboard(familyId, now?)` を `xp_logs` 新設せず `answer_logs × 10 XP/問` の近似で算出（DEC-061 §選択肢 A）/ 1224 ranking + 純関数 `computeWeeklyXpRanking` で「最下位」概念を構造的に持たない実装 / SQL レベルで `learner_profiles.family_id = ?` を WHERE 必須化 = COPPA 構造保証
- **DEC-024 罰語封鎖の構造化**: 純関数は `rank` プロパティ（位置情報）のみ生成、UI は 3 状態（solo / allZero / 通常）でコピー切替 = 罰語の出口を物理的に塞ぐ
- **品質ゲート結果**: vitest 633 PASS（+14）/ E2E family-leaderboard 6/6 + family-streak 6/6 regression 0 / レビュー APPROVE / Minor 4 件
- **CEO Trust-but-Verify が容易**: read-only かつ family_id スコープ済 → DB 直セット → 親 dashboard 表示 assert で完結（W11-T1 で確立した E2E 戦略の再利用）

### 2.3 DEC-062 / W11-T2 Family Message（親→子応援メッセージ + kotodama-tori 代読）

- **重要訂正**: 当初 DEC-062 草案は「`family_messages` テーブル新規 + `sendFamilyMessage` server action 新規」想定だったが、CEO 着手前 trust-but-verify で **W9-D commit `c85d7df` で親→子メッセージ基盤が既に完成済**であることが判明。`parent_messages` テーブル / `sendMessageFromTemplate` / `markMessageRead` / `/parent/messages/new` / `/messages` / `/home` 未読バッジ全て運用中
- **判断**: P0 / 既存基盤に「kotodama-tori 代読 modal + DEC-024 moderation pipeline」の 2 ピースを追加する atomic / **2 人日見積 → 1 人日相当**に半減
- **採用設計**: 純関数 `validateParentMessageBody`（罵倒/否定/強制/PII 4 系統辞書 + 1〜200 文字 + trim）/ レート制限 5 分 5 件 per `(from_user_id, to_learner_id)` ペア / `kotodama-tori-modal.tsx` 背景クリック抑止 / `/home` Server Component で最古未読 1 通を pick → 「ありがとう」CTA で `markMessageRead` → 既読化
- **テンプレ送信は moderation skip / custom body のみ通す**設計で「テンプレを必ず通す → moderation で止まる」UX 自己矛盾を回避
- **品質ゲート結果**: vitest 683 PASS（+50）/ E2E family-message 4/4 + 既存 12/12 regression 0 / レビュー APPROVE / Minor 4 件

### 2.4 DEC-063 / W11-T5 Weekly Digest Card（保護者ダッシュボード Card 版）

- **判断**: P1 / 0.5 人日 / W11 第 4 atomic として GO（オーナー指示 A 案明示採用 / 最小 atomic / read-only / 既存基盤 70% 流用）
- **採用設計**: 純関数 `composeWeeklyDigestView` + `pickEncouragementCopy(weekStartUtc, familyId)`（ISO 週番号 + familyId codePoint sum mod 8 で deterministic 選択）+ `selectTopSkills(rows, limit=3)` + 励ましコピー catalog 8 件 pre-curated（罰語ゼロ / 平仮名中心 / 命令形回避）+ `getFamilyWeeklyDigest` で既存 `getFamilyStreak` + `getFamilyWeeklyLeaderboard` + 新規 SQL（top-skills GROUP BY）を `Promise.all` 並列取得
- **罰語封鎖の構造化第 2 段**: catalog 自体に NG 語が存在しない設計 → `pickEncouragementCopy` が何を返しても罰語は構造上発生し得ない（DEC-024 / DEC-061 と同パターンの 5 度目再適用）
- **品質ゲート結果**: vitest 715 PASS（+32）/ E2E family-weekly-digest 4/4 + 既存 16/16 = 20/20 / レビュー APPROVE / Minor 2 + Nit 3
- **W11 完遂率**: T1 + T3 + T2 + T5 完遂 = 4/5（W11-T4 のみオーナー VAPID 鍵設定待ち）

### 2.5 DEC-064 / W11 follow-up = study-smoke / study-writing-smoke E2E regression 修復

- **重要訂正**: task output で観測されていた「`test.describe()` parser エラー」は再現せず、CEO trust-but-verify で **真の根本原因は別** であることが DIAG spec で判明
- **真の根本原因**: Next.js 16 Server Action auto-revalidation × `studyClientKey` の衝突。`submitAnswer` が SRS dueAt を未来に更新 → `getNextProblem` が次問 ID を返す → `studyClientKey = "problem:" + problem.id` が変化 → React が StudyClient を unmount → `setFeedback(...)` した値が破棄される
- **採用設計（4 点）**: (i) `studyClientKey` を `learner:<learnerId>` に変更（W10-T4 fix M-A1 同パターンを Phase 1 直リンク経路にも展開）/ (ii) prevProblemId pattern を `if (!feedback)` で囲んで「フィードバック描画中は reset しない」に変更 / (iii) `answeredView` snapshot state を導入（`{ problemId, prompt, choices, problemType, audioUrl, skill }` を `setFeedback(result)` 直前にキャプチャ）/ (iv) `handleNext` で `setAnsweredView(null)` 明示 clear
- **追補 2 点**: (v) `playwright.config.ts` webServer env で `OPENAI_API_KEY: ""` 固定（`.env.local` 本番 key 誤呼び出し防止）/ (vi) writing-3 seed を 1 問 → 2 問に拡張（次問 null による StudyClient 自体の unmount を回避）
- **「実態スコープ訂正版」表記の意味**: 当初 atomic 計画（parser エラー修復）が trust-but-verify で別問題と判明 → DEC-064 §実装完遂デルタで追補修正 2 点を同 atomic に取り込んだ宣言的記録
- **品質ゲート結果**: vitest 715 PASS（baseline 維持）/ E2E **38 PASS**（study 12 + family 20 + session/overtime 6）/ レビュー APPROVE / Minor 2 + Nit 3

---

## 3. Keep（継続したい良かった点 / 9 件）

### K-1. 純関数 + server-only helper + Server Component 直 import の三層分離パターン（5 度連続再適用）

W10-T5 (`study-time.ts`) → W11-T1 (`family-streak-rollover.ts`) → W11-T3 (`family-leaderboard-ranking.ts`) → W11-T2 (`moderation.ts` / `parent-messages-server.ts`) → W11-T5 (`family-weekly-digest-summary.ts`) と **5 atomic 連続で同パターンが機能**。Turbopack `"use server"` sync export ban を構造的に回避し、unit test 直 import + DB I/O ゼロを保証。今後の W12 以降も継続採用する強い再現性を獲得。

### K-2. DEC-024 罰則ゼロ哲学の「構造的封鎖」アプローチ

「コピー検閲」ではなく「罰語の出口を物理的に塞ぐ」設計思想が W11-T1 / T3 / T5 で連続成功:

- W11-T1: `computeFamilyStreakRollover` の戻り値が `newDays >= 1` または `prev` のみで decrement 経路を構造的に持たない
- W11-T3: 1224 ranking で「最下位」概念が定義されない（同 XP 同順位 / 単独 learner = `[1]` / 全員 0 XP = 全員 `1`）
- W11-T5: 励ましコピー catalog 8 件 pre-curated → catalog 自体に NG 語が無いため何を返しても罰語 0
- W11-T2: `describeModerationReason` で reject 理由を「やさしいことばで」前向きコピーに機械変換
- E2E では `not.toContain` で 6 罰語（だめ / やりすぎ / ペナルティ / 最下位 / ビリ / 下位）を機械化 assert

### K-3. 既存基盤の最大活用による工数半減（W11-T2）

DEC-062 着手前の trust-but-verify で **W9-D で既に親→子メッセージ基盤完成済**を発見し、見積 2 人日 → 1 人日に半減した実績。「新規テーブル + server action 設計」を「既存基盤への薄いレイヤ追加」に変換するアプローチは W12 以降の atomic でも積極的に採用すべき。

### K-4. CEO Trust-but-Verify が atomic スコープを正しい方向に再定義した 2 例

- DEC-062: 当初草案「family_messages 新規」→ 実態は W9-D 完成済 → atomic 半減
- DEC-064: 当初草案「parser エラー修復」→ DIAG spec で auto-revalidation × key 衝突を特定 → 局所的修復に確定

着手前の trust-but-verify 30 分が、迷走による数日の手戻りを防いだ。

### K-5. atomic UPDATE WHERE による race-safe 二重保証（W11-T1）

純関数で `shouldUpdate=false` 時の DB UPDATE 短絡 + SQL `WHERE id=? AND (last IS NULL OR last <> ?)` の二重保証パターンが、兄弟同時 submitAnswer race を構造的に 1 回 UPDATE に集約。今後家族 scope の write 経路では同パターンを default として採用すべき。

### K-6. read-only 集中 + DB 直セット E2E 戦略

W11-T1 で **study-smoke preexisting regression に遭遇** した経験から、W11-T1 / T3 / T5 の E2E は「DB 直 INSERT → 親 dashboard 訪問 → 表示属性 assert」に集中。ユーザーから見える結果に絞ることで preexisting regression に独立させ、atomic スコープを守った。write path の正しさは純関数 unit test で網羅 = defense-in-depth。

### K-7. SQL レベル `family_id` WHERE 必須による COPPA 構造保証（W11-T3 / T2 / T5）

`learner_profiles.family_id = ?` を SQL の WHERE に必須化することで、家族間漏洩を「コードレビューに依存せず構造的に不可能」にする実装パターンが定着。「グローバル ranking が SQL レベルで構築不可能」「他家族の親名が `senderName` に流出する経路が無い」を型システムレベルで保証。

### K-8. レビュー部門の `[role="alert"]:not(#__next-route-announcer__)` パターン

W11-T2 の moderation エラー UI（`data-testid="moderation-error"` role=alert）+ 成功 UI（`data-testid="send-success"` role=status）が screen reader 読み上げで Next.js 内部 `__next-route-announcer__` と衝突しないよう、locator selector を `[role="alert"]:not(#__next-route-announcer__)` で絞り込んだパターンは E2E 安定化の再利用テンプレ。

### K-9. `Promise.all` + per-task try/catch fallback の組み合わせ（W11-T3 / T5）

`getFamilyWeeklyLeaderboard` で kotodama-tori stage を learner ごと per-task try/catch で取得 / `getFamilyWeeklyDigest` で top-skills SQL 失敗時 `[]` fallback。**1 部分の失敗が dashboard 全体を落とさない** fail-soft 設計が定着。前向き fallback コピーと組み合わせて DEC-024 整合も確保。

---

## 4. Problem（起きた問題 / 反省点 / 4 件）

### P-1. study-smoke preexisting regression の発覚遅延（W11-T1 → DEC-064 まで持越）

**症状**: W11-T1 着手中盤に W10-T5 push (c337bf9) pristine baseline で study UI 経由 click → submitAnswer → study-feedback 表示 regression が発覚。  
**真因**: Next.js 16 Server Action auto-revalidation で RSC payload が page.tsx を再評価 → SRS dueAt 更新で `getNextProblem` が次問 ID を返す → `studyClientKey = "problem:" + problem.id` 変化 → StudyClient unmount → `setFeedback` 値破棄。  
**影響範囲**: W11-T1 / T2 / T3 / T5 の E2E 戦略全体を「DB 直セット → 親 dashboard read path 集中」に切替えて回避（4 atomic 分の戦略変更コスト）。最終的に DEC-064 で修復するまで 2 日間滞留。  
**反省点**: W10-T5 push 直後に CI 上で smoke E2E を 1 度回しておけば即座に検出できた。Next.js / React のメジャーバンプ後は「全 E2E full sweep」を gate にすべき。

### P-2. atomic スコープ計画と実態のズレ（DEC-062 / DEC-064 で「実態スコープ訂正版」表記）

**症状**: DEC-062 当初草案「`family_messages` 新規」が W9-D 完成済を見落とし / DEC-064 当初草案「parser エラー修復」が DIAG spec で auto-revalidation × key 衝突と判明。  
**影響範囲**: 草案のまま着手していれば DEC-062 で工数 2 倍 / DEC-064 で 完全に的外れな修正で 1 日溶かした可能性。  
**反省点**: GO 判定前の trust-but-verify を「ベストプラクティス」ではなく「DEC 起票必須プロセス」に格上げすべき。新規テーブル / server action 設計を含む DEC は **着手前に既存基盤検索 (`grep` / 関連 schema 確認)** を 5 分以内で必ず実施するルール化が必要。

### P-3. E2E SQLITE_BUSY preexisting flaky を atomic 跨ぎで運用回避し続けた

**症状**: `fullyParallel=true` + workers=2 で同一 file: SQLite に並列書込 → 一時的 lock。W11-T1 から W11-T5 まで `--workers=1` + `mode: "serial"` + `execWithRetry` で運用回避。  
**影響範囲**: CI runtime が 1.5〜2 倍に増加 / 新規 spec 追加時に毎回 retry pattern を copy-paste で再実装 / preexisting flaky 1 件（family-streak.spec.ts の `setFamilyStreakDirect` ヘルパ内 `client.execute` retry 不在）が **5 atomic 連続で残置**。  
**反省点**: W11-T3 review M-2 / W11-T5 dev report で「W12 polish 対象」とフラグしたが、根本対処（`setFamilyStreakDirect` も `execWithRetry` 化 + describe ごとに `mode: "serial"` を default 化する仕組み）を後送りし続けたのは技術負債蓄積。

### P-4. 工数見積りと実工数の差（W11-T2 = -50% / W11-T5 = +ぴったり / W11-T1 = ややオーバー）

| atomic | 当初見積 | 実工数（CEO 観測） | 差 |
|---|---|---|---|
| W11-T1 Family Streak | 1.5 人日 | study-smoke regression 調査込みでやや超過 | わずかオーバー |
| W11-T3 Family Leaderboard | 1.5 人日 | 既存パターン再利用で計画通り | ぴったり |
| W11-T2 Family Message | 2.0 人日 | W9-D 既存基盤発見で 1.0 人日に半減 | **-50%** |
| W11-T5 Weekly Digest Card | 0.5 人日 | 既存基盤 70% 流用で計画通り | ぴったり |
| W11-followup study-smoke | 0.5 人日 | DIAG + 追補 2 点で 0.75 人日相当 | やや超過 |

**反省点**: 「既存基盤未検索」起因の見積過大が 1 件 / 「preexisting regression / Next.js 16 挙動」起因の見積過小が 2 件。新規テーブル想定 atomic は trust-but-verify 必須化、フレームワークバンプ後の atomic は +25% バッファ計上を推奨。

---

## 5. Try（次に試したい改善 / 7 件）

### T-1. DEC 起票時の trust-but-verify チェックリスト導入

**観点**: 新規テーブル / 新規 server action / 新規ファイル設計を含む DEC は GO 判定前に必ず以下 4 項目を確認:

1. 既存 schema (`drizzle/*.sql`) に類似テーブルが既存していないか
2. 既存 server action (`src/lib/actions/`) に類似経路が既存していないか
3. 既存 reports (`reports/dev-w*-*-done.md`) に類似スコープの完遂記録がないか
4. preexisting regression / flaky の影響を受けないか（DIAG spec / smoke E2E 1 回実走）

**期待効果**: DEC-062 / DEC-064 で発生した「実態スコープ訂正版」起票を 0 件にする。**atomic 工数の 30% 圧縮**実績（W11-T2）が再現可能になる。

### T-2. Next.js / React メジャーバンプ後の E2E full sweep gate 化

**観点**: Next.js 16 / React 19 / Turbopack バンプ後に **全 E2E ファイルを 1 度 CI で回す gate** を W12 完遂時 TODO に明記。

**期待効果**: study-smoke preexisting regression のような「W10 で潜伏 → W11-T1 着手中に発覚」パターンを 0 件にする。バンプ直後 1 日以内に検出可能。

### T-3. SQLITE_BUSY 根本対処を W12 polish atomic として独立起票

**観点**:

- `setFamilyStreakDirect` ヘルパ内 `client.execute` を `execWithRetry` 化
- `tests/e2e/fixtures/db-fixture.ts` の全 `client.execute` を `execWithRetry` 化
- describe ごとに `mode: "serial"` を default 化する helper（`describeSerial` ラッパ）
- CI runtime 短縮のため `workers=2` でも green を保証

**期待効果**: CI runtime -30%（preexisting flaky retry オーバーヘッド削減）/ 新規 spec 追加時に retry boilerplate 不要 / W12 / W13 atomic の E2E 安定性向上。

### T-4. 純関数分離パターンを `organization/knowledge/patterns/` に正式化

**観点**: K-1 で 5 度連続成功した「純関数 + server-only helper + Server Component 直 import の三層分離」を `organization/knowledge/patterns/turbopack-use-server-export-isolation.md` として明文化（DEC-019-033 拡張ルール準拠）。

含めるべき内容:

- 問題の症状（Turbopack `"use server"` sync export ban）
- 採用パターン（3 ファイル分離 + unit test 直 import）
- 適用済み atomic 一覧（W10-T5 / W11-T1 / W11-T3 / W11-T2 / W11-T5）
- 反例（やってはいけない: server action ファイル内に sync helper を export）

**期待効果**: 他案件（PRJ-017 ホメコト / PRJ-019 Open Claw 等の Next.js 16 案件）でも即座に採用可能。新規 dev エージェントの onboarding コスト削減。

### T-5. DEC-024 罰則ゼロ哲学の「構造的封鎖」テンプレを `organization/knowledge/decisions/` に明文化

**観点**: K-2 で実証した「コピー検閲ではなく罰語の出口を物理的に塞ぐ」設計思想を `organization/knowledge/decisions/dec-024-structural-no-punishment.md` として明文化。

含めるべき内容:

- 純関数戻り値設計（位置情報のみ / decrement 経路を持たない型 / 1224 ranking）
- catalog pre-curated 設計（NG 語が無い catalog → 何を返しても罰語ゼロ）
- E2E `not.toContain` 罰語リスト機械化テンプレ
- UI 3 状態（solo / allZero / 通常）コピー切替パターン

**期待効果**: 他「子供向け / 倫理配慮必須」案件で再利用可能。DEC-024 適用案件のレビューチェック時間 -50%。

### T-6. study UI auto-revalidation × key 衝突の落とし穴を `organization/knowledge/pitfalls/` に明文化

**観点**: P-1 / DEC-064 で発覚した Next.js 16 Server Action auto-revalidation × `key={problem.id}` の衝突を `organization/knowledge/pitfalls/nextjs-16-server-action-key-unmount.md` として明文化。

4 要素テンプレ:

- **症状**: `setFeedback(...)` 値が破棄される / E2E `feedback` locator timeout / DIAG ログで unmount → mount シーケンス
- **原因**: Server Action 完了時に refreshed RSC payload で page.tsx 再評価 → key 変化 → React unmount → 新インスタンス
- **対処**: key を learner-stable / session-stable に変更 + answeredView snapshot pattern + prevProblemId は `if (!feedback)` ガード
- **再発防止**: Next.js 16 で `<Component key={...}>` を Server Action 経路に乗る page で使うときは「key が auto-revalidation で変わるか？」を必ず確認

**期待効果**: 他 Next.js 16 案件（PRJ-017 ホメコト / PRJ-019 Open Claw）で同症状の早期発見。

### T-7. 工数見積精度向上のためのバッファ規約

**観点**: P-4 を踏まえ、以下の見積バッファ規約を `organization/rules/atomic-estimation.md`（新規 or 既存に追記）として明文化:

- **新規テーブル / server action 想定 atomic**: trust-but-verify 完了後に再見積（既存基盤発見で -50% もあり得る）
- **フレームワーク / ライブラリのメジャーバンプ後 1 週間以内の atomic**: +25% バッファ
- **preexisting regression / flaky 残置中 atomic**: +15% バッファ
- **read-only / 既存基盤流用 atomic**: バッファ +0%（W11-T3 / T5 で実証）

**期待効果**: W12 atomic 見積精度の改善 / オーナー報告時の「予定通り完遂」率 +10pt。

---

## 6. organization/knowledge/* 蓄積候補マッピング

DEC-019-033 で確立された 3 サブディレクトリ（patterns / decisions / pitfalls）への仕分け。各候補に YAML frontmatter（tag / 由来 PRJ / 由来 DEC / PII redaction 必要性）を付与する想定。

### patterns/ — 再利用可能なコードパターン

| 候補ファイル | 由来 | PII redaction |
|---|---|---|
| `patterns/turbopack-use-server-export-isolation.md` | W10-T5 / W11-T1 / T3 / T2 / T5（5 度連続） | 不要 |
| `patterns/family-scope-sql-coppa-guarantee.md`（SQL `family_id` WHERE 必須による構造保証） | W11-T1 / T3 / T2 / T5 | 不要 |
| `patterns/promise-all-per-task-fail-soft.md`（per-task try/catch fallback） | W11-T3 / T5 | 不要 |
| `patterns/atomic-update-where-race-safe.md`（純関数 + SQL WHERE の二重保証） | W11-T1 (DEC-060) | 不要 |
| `patterns/answered-view-snapshot.md`（auto-revalidation × key 衝突回避の prevProblemId + snapshot） | W11-followup (DEC-064) | 不要 |
| `patterns/no-emoji-children-ui-icons-only.md`（Heroicons + KotodamaWakatoriSvg のみで絵文字ゼロ）| W11 全体 | 不要 |
| `patterns/db-direct-insert-readpath-e2e.md`（preexisting write-path regression 回避時の戦略） | W11-T1 着手時の戦略転換 | 不要 |

### decisions/ — 設計判断ログ

| 候補ファイル | 由来 | PII redaction |
|---|---|---|
| `decisions/dec-024-structural-no-punishment.md`（罰語の構造的封鎖 / catalog pre-curated / 1224 ranking） | DEC-024 / DEC-060 / DEC-061 / DEC-063 横断 | 不要 |
| `decisions/dec-062-existing-foundation-reuse.md`（trust-but-verify による工数 50% 削減） | DEC-062 | 不要 |
| `decisions/dec-064-actual-scope-correction.md`（atomic 着手前 DIAG spec で実態スコープ訂正） | DEC-064 | 不要 |
| `decisions/family-message-template-vs-custom-moderation-split.md`（テンプレ skip / custom apply の UX 整合） | DEC-062 | 不要 |
| `decisions/leaderboard-coppa-1224-rank-no-loser.md`（COPPA + 1224 ranking で「最下位」概念を構造的に持たない） | DEC-061 | 不要 |
| `decisions/encouragement-copy-deterministic-seed.md`（ISO 週 + familyId codePoint sum mod N で deterministic 選択） | DEC-063 | 不要 |

### pitfalls/ — 落とし穴集

| 候補ファイル | 由来 | PII redaction |
|---|---|---|
| `pitfalls/nextjs-16-server-action-key-unmount.md`（auto-revalidation × `key={problem.id}` で StudyClient unmount） | DEC-064 | 不要 |
| `pitfalls/turbopack-use-server-sync-export-ban.md`（"use server" 配下に sync export を置くと build error） | W10-T5 起源 / W11 全体で再適用 | 不要 |
| `pitfalls/sqlite-busy-fully-parallel-flaky.md`（`fullyParallel=true` + file: SQLite で SQLITE_BUSY 多発） | W11-T1 〜 T5 横断 | 不要 |
| `pitfalls/openai-api-key-leaking-into-e2e.md`（`.env.local` の本番 key が E2E webServer に漏れて flaky 化） | DEC-064 追補 | **要**（API key を redaction） |
| `pitfalls/seed-too-few-causes-component-unmount.md`（writing-3 が 1 問で次問 null → page.tsx branch 切替 → snapshot 失効） | DEC-064 追補 | 不要 |
| `pitfalls/preexisting-regression-mid-atomic-discovery.md`（着手中盤に発覚する preexisting regression と E2E 戦略転換） | W11-T1 起源 / DEC-064 修復 | 不要 |
| `pitfalls/empty-foundation-search-before-dec.md`（既存基盤未検索による DEC 草案の工数過大見積） | DEC-062 起源 | 不要 |

---

## 7. CEO への提案

### 7.1 W12 後半 atomic で取り入れたい改善

1. **DEC 起票テンプレに trust-but-verify チェックリストを追加**（T-1）
   - 効果: W11-T2 / T64 で発生した実態スコープ訂正版を 0 件化
   - 着手 atomic: W12 完遂時の振り返り atomic（PM 部門協調）

2. **W12 完遂直前に E2E full sweep gate を 1 回挟む**（T-2）
   - 効果: study-smoke のような preexisting regression を Phase 2 完遂時点で 0 件保証
   - 着手 atomic: W12-T3-C β invite metrics 完遂直後 / 0.25 人日

3. **SQLITE_BUSY 根本対処を W12 polish atomic として独立起票**（T-3）
   - 効果: CI runtime -30% / W13 以降の E2E 安定性向上
   - 着手 atomic: W12 終盤 / 0.5 人日 / `setFamilyStreakDirect` 等の `execWithRetry` 化 + `describeSerial` ラッパ追加

4. **PRJ-016 から `organization/knowledge/` への蓄積を 3 atomic で実施**（T-4 / T-5 / T-6）
   - 着手単位: patterns 7 件 / decisions 6 件 / pitfalls 7 件 = 計 20 件
   - 推奨着手: Phase 2 完遂直後（W12-T3-C 完遂後の atomic）/ secretary or research 部門委任 / 0.75 人日
   - 効果: PRJ-017 ホメコト Phase 2（W11 着手予定）+ PRJ-019 Open Claw 提案生成への即時 retrieval 活用

5. **工数見積バッファ規約を `organization/rules/` に追加**（T-7）
   - 効果: W12 atomic の見積精度 +10pt
   - 着手 atomic: PM 部門委任 / 0.25 人日

### 7.2 監視したい指標（W12 / Phase 2 完遂時の KPI）

| 指標 | 現状（W11 完遂時） | 目標（Phase 2 完遂時 / W12 終了時） |
|---|---|---|
| vitest 件数 / GREEN 率 | 715 / 100% | ≥ 800 / 100% |
| E2E 件数 / GREEN 率 | 38 / 100% | ≥ 50 / 100%（β feedback E2E + KPI 観測 E2E 追加） |
| typecheck / lint 0 errors | OK | OK 維持 |
| migration 件数 | 0015 まで | W12 で 0016 / 0017 程度想定 |
| **DEC-024 罰語 grep（UI 表示テキスト）** | 0 hit | **0 hit 維持** |
| **COPPA SQL family_id 強制率** | 100%（W11 family-* 全 SQL） | 100% 維持 |
| **preexisting regression 残置数** | 0（DEC-064 で全閉じ） | 0 維持（新規発生時は即時起票） |
| **atomic 工数見積 vs 実工数差** | -50% 〜 +50%（W11 5 atomic） | ±25% 以内（バッファ規約適用後） |
| **trust-but-verify 起票率** | 不規則（DEC-062 / DEC-064 で実施） | 100%（チェックリスト適用後） |
| **knowledge/ 蓄積件数** | 0（W11 時点） | patterns 7 + decisions 6 + pitfalls 7 = **20 件**（W12 完遂後） |

### 7.3 W11 完遂報告の Phase 2 文脈での位置づけ

W11 5 atomic 完遂で **HANEI 差別化軸 3 ピース**（家族 streak / 家族 leaderboard / 親子つながり = 兄弟救済 + 健全競争 + 親子つながり）が atomic に揃い、Phase 2 ゲーミフィケーションの「家族化レイヤ」が完成。Phase 2 W10 ハネキン経済 + W11 家族化 + W12 KPI/A/B test/β 受入が直列に完遂すれば、Phase 3（β 公開）への移行ゲートが構造的に通過可能。

W11 で蓄積した 5 度連続再利用の純関数分離パターン / 5 度連続再利用の DEC-024 構造的封鎖 / SQL family_id 強制パターンは PRJ-016 のみならず PRJ-017 / PRJ-019 でも即座に retrieval 活用すべき組織知。

---

## 付記 — 引用 commit / report ハッシュ事実ベース確認

- W11-T1 完遂 commit: `15f3b92`（DEC-060 / 本番 Turso migration 0015 適用済 / `dev-w11-t1-family-streak-done.md` §テスト結果 619 PASS）
- W11-T3 完遂 commit: `e201de2`（DEC-061 / dashboard 反映 `ebe7b29` / `dev-w11-t3-family-leaderboard-done.md` §テスト結果 633 PASS / E2E 6/6）
- W11-T2 完遂 commit: `12d93cf`（DEC-062 / dashboard 反映 `cc410ed` / `dev-w11-t2-family-message-done.md` §テスト結果 683 PASS / E2E 4/4 + 既存 12/12）
- W11-T5 完遂 commit: `33ddb80`（DEC-063 / dashboard 反映 `f6a21f0` / `dev-w11-t5-weekly-digest-card-done.md` §テスト結果 715 PASS / E2E 20/20）
- W11-followup 完遂 commit: `67dd31d`（DEC-064 / `dev-w11-followup-study-regression-fix-done.md` §テスト結果 715 PASS / E2E 38 PASS）
- W11-T1 ベースライン: `c337bf9`（W10-T5 / DEC-059 完遂）
- W11-T3 ベースライン: `15f3b92`（W11-T1 / DEC-060）
- W11-T2 ベースライン: `e201de2`（W11-T3 / DEC-061）
- W11-T5 ベースライン: `12d93cf`（W11-T2 / DEC-062）
- W11-followup ベースライン: `33ddb80`（W11-T5 / DEC-063）

各 commit の direct evidence は対応する `dev-*-done.md` / `review-*.md` の §テスト結果 / §総合判定 / §検証手順 セクションに記録済。

---

以上、PRJ-016 HANEI Phase 2 W11 KPT 振り返り（secretary 部門 / 2026-05-05）。
