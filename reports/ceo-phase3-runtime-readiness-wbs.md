# CEO 統合 Phase 3 本格運用準備 WBS（DEC-073 軸-4 / オーナー承認用最終成果物）

**作成日**: 2026-05-05
**起点**: DEC-073（Phase 3 計画立案 atomic / WBS 徹底洗い出し）
**前提**: Phase 2 100% 完遂（DEC-071 / commit 25abbb3）+ v2 ナレッジ 20 件着地（DEC-072 / commit b6c03f7 + d3126fc）
**3 軸 input**:
- 軸-1 research: `reports/research-phase3-runtime-readiness-investigation.md`（558 行）
- 軸-2 secretary: `reports/secretary-phase3-requirements-spec.md`（363 行 / AC 計 56 件）
- 軸-3 dev: `reports/dev-phase3-feasibility-and-estimation.md`（723 行）

---

## 0. オーナー向けエグゼクティブサマリー

オーナーマンデート「本格的に息子に使わせたい / 運用開始に向けて徹底的にタスク洗い出し」に対する **Phase 3 全体プラン** を 3 部門統合の上で確定した。

| 項目 | 値 |
|---|---|
| Phase 3 全体 atomic 数 | **12 件**（T0 + T1〜T11） |
| 全体総工数（バッファ込） | **約 12 人日**（個人開発 1 人 / 1 日 4h で約 4 週間 / 1 日 6h で 2.5 週間） |
| 第 1 波（β 実子使用開始までの最短）| **5.5 人日 / 約 1〜2 週間** |
| 新規 DB migration | 6 件 |
| 新規 page routes | +7 件（25 → 32 / DEC-006 改訂前提） |
| 新規 API routes | +2 件 |
| 新規 Server Actions | +8〜10 件 |
| 推奨 OpenAI 月次予算 | **¥3,000 / 月**（既存 ¥10/user/日 構造 cap 維持） |

**3 軸の核心結論一致**:

1. **β 開始前必須 = Must 4 件（atomic で 5〜6 件）**: F-2 settings 全体 / F-1 学習者向け受験日表示 / F-4 1 日学習時間目標 / F-7-a リスニング音源最低 1 セット
2. **DEC-006 改訂が前提**: GET 10 / mutation 5 / page routes 25 → GET 15 / mutation 8 / page routes 32 への拡張 DEC を Phase 3 第 0 atomic で正式起票必要
3. **段階配信推奨**: 第 1 波完遂時点で β 実子使用開始可能、Should + Could は β 運用観察を経て順次追加
4. **W12-T4 ストレステストとは並走可**: 触る範囲独立 / 排他不要

**確定推奨技術選定**（research 軸）:

| 領域 | 確定推奨 | 月次コスト目安 |
|---|---|---|
| 辞書 API | **Free Dictionary API + 自前 glossary 併用** | $0（無料） |
| TTS フェーズ 1 | **Web Speech API（ブラウザ内蔵）** | $0 |
| TTS フェーズ 2 | **OpenAI TTS（gpt-4o-mini-tts）** | ~¥150/月（cache hit 後） |
| AI チャット | **OpenAI Chat Completions（gpt-4o-mini）+ system prompt + cost cap** | ~¥300/月（上限到達時） |
| リスニング音源 | **OpenAI TTS で自前生成 + Vercel Blob cache** | ~¥150/月（初月のみ） |
| ライティング採点 | **既存 `score-writing.ts` 流用 + rubric 拡張** | ~¥30/月 |

**1 ユーザー総計**: $1.2〜$2.5/月 / **β1 名運用予算**: ¥3,000/月で十分余裕

---

## 1. WBS 全体表（atomic × 工数 × 依存 × 優先度）

### 1.1 atomic 一覧（12 件）

> **重要 / T 番号系統**: dev report と CEO WBS で T 番号系統が**別**である。**実装 atomic 起票時は本 CEO WBS の T 番号を正とする**（最終承認後の atomic 起票で誤参照を防止）。「dev 旧#」列に dev-phase3-feasibility-and-estimation.md §4-1 の Phase3-T## 対応を併記する。

| # | atomic | 機能 | 工数 | DB migration | 既存基盤活用度 | 優先度 | 依存 | dev 旧# |
|---|---|---|---|---|---|---|---|---|
| **T0** | DEC-006 拡張 + 月次予算 / 親パスワード方式承認（前提整備） | 前提決議 | 0.1 人日 | no | n/a | **P0（前提条件）** | 無 | T11 |
| **T1** | settings 全体 page 整備（account / notifications / security / index）+ `learner_settings` 新設 | F-2 | 1.0 人日 | yes (M-1) | 低 | **P0** | T0 | T1 |
| **T2** | 受験日 学習者 UI 拡充（本人画面で自己編集 link 追加 + dashboard invalidate） | F-1 | 0.5 人日 | no | **高** | **P0** | T1 | T2 |
| **T3** | 親パスワード再入力 dialog（reauth gate / 5 分有効） | F-2 (reauth) | 0.25 人日 | no | 低 | **P0** | T1 | T9 |
| **T4** | 目標学習時間 UI + `learner_study_targets` + cron `/api/cron/study-minutes-reminder` | F-4 | 1.0 人日 | yes (M-3) | 中 | **P0** | T1 | T4 |
| **T5** | リスニング音源生成 + 一括 seed（最低 1 セット 10〜20 問 / Vercel Blob upload） | F-7-a | 1.5 人日 | no (data only) | 中 | **P0** | T0（OpenAI 予算承認後） | T7a |
| **T6** | 長期目標 / 短期目標 UI + `learner_goals` + 3 Server Actions + dashboard 連動 | F-3 | 1.5 人日 | yes (M-2) | 低 | **P1** | T1, T2 | T3 |
| **T7** | ライティング採点 UX polish（履歴閲覧 + score progression 表示 + 親 dashboard 連動） | F-7-b | 0.5 人日 | no | **高** | **P1** | T1 | T7b |
| **T8** | 辞書 popup 第 1 波（Tappable word + `/api/dictionary/lookup` proxy + cache） | F-5-a | 1.0 人日 | yes (M-4) | 低 | **P1** | T0 | T5a |
| **T9** | 発音 TTS 第 1 波 = Web Speech API wiring + 連打防止 UI | F-5-b | 0.25 人日 | no | 中 | **P1** | T8（同画面で統合） | T6 |
| **T10** | 退会 page + cascade delete 確認 + 親 email 通知（**親パスワード reauth 必須化**を AC に明記） | F-2-退会 | 0.25 人日 | no | 低 | **P1** | T1, T3 | T10 |
| **T11** | AI チャット質問 UI（`useChat` + `/api/ai/coach` 既存流用 + bottom sheet + `learner_problem_chats`） | F-6 | 1.0 人日 | yes (M-6) | 中 | **P2** | T0（cost cap 確定後） | T8 |

**持ち越し（第 3 波 Could 候補 / 本 WBS 範囲外）**:
- dev T6.5（OpenAI TTS 切替）= 0.5 人日 / β + 1 ヶ月後の cache hit 率次第で着手判断
- dev T5b（辞書検索履歴 + `dictionary_lookup_history`）= 0.5 人日 / 親 dashboard 価値検証後着手判断

**注**: 上記 12 件 + 持ち越し 2 件 = 計 14 atomics の dev 純見積 9.85 人日と合算。本 WBS は Phase 3 第 1 主軸として 12 件を提示し、持ち越し 2 件は β 1 ヶ月運用後の評価で着手可否判断する。

### 1.2 波別構成（推奨実行順序）

```
[第 1 波 P0 / 5.5 人日 / 約 1〜2 週間 → β 実子使用開始可能]
T0 DEC-006 拡張 + 前提承認 (0.1)         ← オーナー承認 gate
T1 settings 全体 page (1.0)              ← 全機能の前提
T3 親パスワード reauth (0.25 / T1 統合可)
T2 受験日 学習者 UI (0.5)
T4 目標学習時間 (1.0)
T5 リスニング音源 seed (1.5)             ← 並走可
─────────────────────────────────────
   バッファ込 5.5 人日 / β 開始

[第 2 波 P1 / 4.2 人日 / 約 1 週間]
T6 長期/短期目標 (1.5)
T7 ライティング採点 UX polish (0.5)
T8 辞書 popup (1.0)
T9 発音 TTS Phase 1 (0.25 / T8 統合)
T10 退会 page (0.25)
─────────────────────────────────────
   1 ヶ月運用観察と並走

[第 3 波 P2 / 1.0 人日 / 約 0.5 週間]
T11 AI チャット質問 UI (1.0)
─────────────────────────────────────
   β + 1 ヶ月評価後の着手判断
```

### 1.3 依存関係グラフ

```
[T0 DEC-006 拡張 = 前提]
    |
    v
[T1 settings] ───────┬──> [T3 reauth (T1 統合可)]
    |                ├──> [T2 受験日学習者 UI]
    |                ├──> [T4 学習時間目標]
    |                └──> [T7 ライティング UX]
    |
    +──> [T6 長期/短期目標 (T2 後)]
    +──> [T10 退会 (T1+T3 後)]

[T0] ───> [T5 リスニング音源 (OpenAI 予算承認後)]
[T0] ───> [T8 辞書 (API 選定承認後)] ──> [T9 TTS Phase 1]
[T0] ───> [T11 AI チャット (cost cap 確定後)]
```

---

## 2. 受入条件（AC）の凝縮（secretary 軸 56 件 → 波別ハイライト）

### 第 1 波（Must / 30〜35 件）の AC ハイライト

- **F-2 (T1)**: 「親が settings トップから表示名 / 学年 / 親 email を変更できる」+ 「変更時に親パスワード再確認」+ 「全 settings 操作で罰語 grep 0 件」
- **F-1 (T2)**: 「学習者 home に受験日と残日数が常時表示」+ 「過去日入力ガード」+ 「親 dashboard と双方向同期」
- **F-4 (T4)**: 「1 日 X 分目標を設定可」+ 「当日進捗 bar 表示」+ 「`learner_study_targets` 計測は active time（idle 30 秒で停止）」+ 「目標 0 分時はリマインドゼロ」
- **F-7-a (T5)**: 「最低 1 セット（10〜20 問）のリスニング問題で audio_url が存在」+ 「再生 UI / 連打防止 / 再生回数記録」+ 「OpenAI TTS 自前生成のため著作権完全クリア」

### 第 2 波（Should / 25〜30 件）の AC ハイライト

- **F-3 (T6)**: 「長期目標 = 合格目標日（受験日基点）/ 月次 / 週次 / 当日の階層を `learner_goals.type` enum で多態化」+ 「達成判定は罰則ゼロ（達成時のみ祝福、未達時は無言 + 翌日へ）」
- **F-7-b (T7)**: 「writing_essay 解答後に採点結果 + フィードバック表示」+ 「履歴閲覧で score progression を表示」+ 「親 dashboard で過去エッセイ閲覧可」
- **F-5-a (T8)**: 「学習画面で単語 hover/tap → popup で意味表示」+ 「Free Dictionary API + 自前 glossary 優先 fallback」+ 「server proxy で API key 露出回避」
- **F-5-b (T9)**: 「単語 popup に発音再生ボタン」+ 「Web Speech API 既定 / cache 不要 / 連打防止」

### 第 3 波（Could / 15〜20 件）の AC ハイライト

- **F-6 (T11)**: 「解説後に『もっと聞く』ボタン」+ 「context 自動 inject = 問題文 + 子の回答 + 既存解説を system prompt」+ 「学習文脈外の質問は丁寧に拒否」+ 「月次 100 ターン上限 / Sentry alert」+ 「履歴は親 dashboard 閲覧可」

---

## 3. DB schema 影響整理（dev 軸 6 migration）

| migration | テーブル | 用途 | 主要列 | atomic |
|---|---|---|---|---|
| M-1 | `learner_settings` | learner ごとの設定保存 | learner_id / display_name / grade / avatar_kind / notifications_email / notifications_push / parent_email_for_notifications / etc | T1 |
| M-2 | `learner_goals` | 長期 / 月次 / 週次 / 当日目標 | learner_id / type (enum) / target / target_metric / deadline / status / parent_set | T6 |
| M-3 | `learner_study_targets` + `learner_study_minutes` | 1 日 / 1 週間目標と分単位ログ | period (daily/weekly) / minutes / start_at + active_minutes / day | T4 |
| M-4 | `dictionary_lookups` | 単語 lookup の cache | word / definition_json / japanese_translation / fetched_at / hit_count | T8 |
| M-5 (Could / Phase 3 範囲外暫定) | `dictionary_lookup_history` | 親 dashboard 用 top10 | learner_id / word / count | T5b（持ち越し） |
| M-6 | `learner_problem_chats` | AI チャット履歴 | learner_id / problem_id / role / content / cost_tokens / created_at | T11 |

**DEC-006 改訂後の上限**: GET 15 / mutation 8 / page routes 32（dev 推奨）= secretary 推奨と完全一致。

---

## 4. オーナー判断要請項目（統合 10 件 / dev 6 + research 5 + secretary 9 + 独立 review 1 重複排除）

| # | 項目 | 選択肢 | CEO 推奨デフォルト | 関連 atomic |
|---|---|---|---|---|
| **O-1** | **DEC-006 拡張承認**（page routes 25 → 32 / GET 10 → 15 / mutation 5 → 8） | A. 承認 / B. RPC 寄せで現状維持 / C. 機能 scope 縮小 | **A. 承認**（個人開発の柔軟性 + UX 影響最小） | T0 |
| **O-2** | **段階配信 vs 一括 release** | A. 第 1 波完遂後即 β 開始 / B. 全 3 波完遂後 β | **A. 段階配信**（オーナー要望「本格的に息子に使わせたい」の最短経路 / リスク分散） | 全体 |
| **O-3** | **OpenAI 月次予算上限** | A. ¥3,000/月 / B. ¥1,000/月（厳格 cap） / C. 無上限（実費精算） | **A. ¥3,000/月**（既存 ¥10/user/日 構造 cap 維持） | T5, T11 |
| **O-4** | **親パスワード再入力方式（T3）** | A. Better Auth reauth（5 分有効） / B. PIN 4 桁 / C. 親 email リンク再認証 | **A. Better Auth reauth**（既存基盤 + 実装最小） | T3 |
| **O-5** | **辞書 API 採用承認** | A. Free Dictionary API + 自前 glossary 併用 / B. Merriam-Webster Learners（有料） / C. Weblio | **A. Free Dictionary API + 自前 glossary**（無料 / 商用可 / 英検3級語彙適合） | T8 |
| **O-6** | **TTS 段階導入承認** | A. Web Speech API → OpenAI TTS 段階移行 / B. 最初から OpenAI TTS / C. ElevenLabs | **A. 段階移行**（cost / UX 両立） | T9 |
| **O-7** | **AI チャット月次回数上限（T11）** | A. 100 ターン/月 / B. 50 ターン/月 / C. 200 ターン/月 | **A. 100 ターン/月**（β1 名 / OpenAI コスト ¥300/月 上限から逆算） | T11 |
| **O-8** | **退会時データ削除粒度（T10）** | A. 論理削除 + 個人情報 null 化 / B. 完全消去 / C. 匿名化 | **A. 論理削除 + null 化**（GDPR-K 整合 / 復旧申請可） | T10 |
| **O-9** | **β 開始 deadline 目安** | A. 第 1 波完遂直後（2026-05 月内） / B. 第 1 波 + 第 2 波完遂後（2026-06 月内） / C. オーナー判断 | **A. 第 1 波完遂直後**（オーナー要望「本格運用」最短経路） | 全体 |
| **O-10** | **リマインド経路**（F-4 学習時間目標未達時の通知手段） | A. email 先行 / push 見送り / B. email + Web Push 両方 / C. 通知無し（学習者画面 banner のみ） | **A. email 先行**（dev 暗黙判断を昇格 / Web Push は β + 1 ヶ月評価で再検討） | T4 |

> **注**: O-3（OpenAI 月次 ¥3,000 cap）と O-7（AI チャット 100 ターン ≒ ¥300/月）は依存関係。O-7 を A 確定すれば O-3 cap も自動成立。

---

## 5. リスク + 対処（3 軸統合）

| # | リスク | 対処 |
|---|---|---|
| R-1 | **DEC-006 上限超過**（page routes 25 → 32 / GET 5 → 8 / mutation 5 → 8） | T0 で拡張 DEC 正式起票 + dev で RPC 寄せ feasibility 確認（F-3 多態 CRUD 1 本 / F-6 OpenAI 既存経路 / F-2 退会 admin RPC） |
| R-2 | **OpenAI コスト膨張**（F-6 + F-7-b + 既存解説生成） | 既存 ¥10/user/日 構造 cap 維持 + 月次 ¥3,000 ceiling + Sentry alert（cost 80% 到達時） |
| R-3 | **子供向け UX で罰則ゼロ哲学崩壊リスク** | DEC-002 + PAT-005 + PAT-007 を 7 要望全件展開（F-3 達成判定 / F-4 未達表示 / F-6 safe completion / F-7-b 採点コピーで罰語回避必須）+ E2E `not.toContain` を Must 全機能で導入 |
| R-4 | **W12-T4 ストレステスト未実施で β 開始** | 並走可と判定（排他不要 / 触る範囲独立）+ T4 致命的 alert 構成欠落時は Phase 3 一時停止する条件ゲートを T0 承認時に明記 |
| R-5 | **子供が辞書 / AI チャットで遊んで離脱** | 学習文脈外質問は AI チャットで丁寧に拒否 / 辞書 popup は学習画面の単語に限定 |
| R-6 | **リスニング音源の著作権** | OpenAI TTS で自前生成 → 完全クリア（research 確定） |
| R-7 | **COPPA 観点での操作主体** | exam-date / 目標 / 学習時間は親操作必須 / 学習時間記録のみ子操作（DEC-016-061 1224 ranking 継承） |

---

## 6. β 開始判定基準（実子使用開始 OK のチェックリスト）

第 1 波完遂時点で以下が全て GREEN なら β 実子使用開始 GO:

- [ ] T0 DEC-006 拡張 atomic 完遂 + オーナー承認済
- [ ] T1 settings 全体 page で表示名 / 親 email 変更可
- [ ] T3 親パスワード reauth dialog 動作確認済
- [ ] T2 学習者 home に受験日 + 残日数表示
- [ ] T4 1 日学習時間目標設定 + 進捗 bar 表示
- [ ] T5 リスニング音源最低 1 セット seed 投入完遂
- [ ] vitest 60 files / 880 PASS 以上（baseline 55 / 846 → +5 files / +34 tests）
- [ ] E2E 16 PASS 以上（baseline 14 / +2 = settings smoke + 受験日学習者 UI）
- [ ] next build 25 → 31 routes（DEC-006 改訂後の上限内）
- [ ] 罰語 grep 0 件
- [ ] DEC-024 罰則ゼロ / DEC-003 三層認可 / DEC-006 改訂版厳守
- [ ] **Sentry alert 実発火検証 = 必須化**（W12-T4 並走完遂が GO 条件 / 「実子使用開始 = 事故ゼロを構造的保証」原則）
- [ ] **OpenAI cost guard 構造的有効性の手動超過テスト**（¥10/user/日 cap 到達時に grace degradation UX で graceful 停止することを実機で確認 / T11 着手前に T5 段階で簡易確認可）
- [ ] **退会経路の親パスワード reauth gate 動作確認**（T10 AC 化 / 子による誤退会の構造的防止）
- [ ] **退会後個人情報 null 化の実演確認**（テスト学習者 1 名で実演 / display_name / parent_email / chat 履歴 null 化を SQL で確認）
- [ ] **DB バックアップ復元の RUNBOOK 整備 + 1 回実演**（research §28-29 / Supabase 自動 backup 復元手順を文書化 + 実機で 1 回復元）
- [ ] **Vercel + Supabase + OpenAI 月次予算 alert 設定 3 件全部**（research §41-44）
- [ ] オーナー本人による smoke 実施 + GO 判定

---

## 7. Phase 3 完遂宣言条件

- 第 1 波 + 第 2 波の全 atomic 完遂（第 3 波 T11 は Could で必須ではない）
- β 1 ヶ月運用無事故（致命的 incident 0 件 / Sentry SEV-1 0 件）
- DEC-024 罰則ゼロ継続
- 子の継続学習日数 14 日以上（学習継続 KPI / 任意）
- オーナー本人「Phase 3 完遂と認める」明示判断

---

## 8. 前提 atomic（T0）詳細仕様

T0 = DEC-006 拡張 atomic は本 WBS の **唯一のオーナー承認 gate atomic** であり、以下を含む:

### T0 含むもの（0.1 人日 / コード変更ゼロ / Markdown のみ）

1. **DEC-074 起票（仮番号）**: DEC-006 を以下に拡張
   - page routes: 25 → 32（+7）
   - GET API routes: 10 → 15（+5）= 既存 routes 不変 + Phase 3 で新設
   - Server Actions / mutation: 5 → 8（+3）
   - 既存「不変条件としての厳守」哲学は維持（拡張版を新基準として継承）
   - **DEC-006 の本来意図の再定義**: dev report §3.3-§3.4 で「現状 38 個 Server Action が既に存在（mutation 5 制約と乖離）」が判明。**「mutation 5」の真の意味は「page route から直接呼ばれる top-level Server Action 数」**であり、helper 関数を含まないことを T0 で明文化。新基準 mutation 8 も同義（page から直接呼ばれる Server Action のみカウント / helper / private fn は対象外）。本再定義は DEC-006 撤廃ではなく**意図の正確な記述化**。
2. **オーナー判断要請 10 件（§4）の全項目決議の記録**
3. **第 1 波 5.5 人日の atomic 番号確定 + 着手順序確定**
4. **β 開始判定基準（§6 / 19 項目）の確定**
5. **持ち越し M-5 / dev T6.5 / dev T5b の評価 trigger 確定**（β + 1 ヶ月時点での着手判断条件）

### T0 含まないもの（持ち越し）

- 個別機能の実装着手（T1 以降）
- W12-T4 ストレステスト（並走可の別 atomic）

---

## 9. 次のアクション（オーナー承認待ち）

本 WBS をオーナーへ提示し、以下 9 件の判断を要請:

1. WBS 全体（atomic 12 件 / 12 人日 / 段階配信）の承認可否
2. オーナー判断要請項目 §4 の O-1 〜 O-9 の決定（CEO 推奨デフォルトを採択するか個別判断するか）
3. T0 起票着手承認 → 完遂後 T1 着手の順序確認

オーナー承認 GREEN を受領次第、CEO は T0 atomic を起票し、Phase 3 第 1 波の実装を順次 dispatch する。

---

## 10. 制約遵守確認

- DEC-024 罰則ゼロ厳守（本文書 grep 0 件 / 自己言及・引用は除外規定通り）
- DEC-006 完全不変（本 atomic = WBS 立案 / コード変更ゼロ / 拡張は T0 で議決）
- DEC-003 三層認可継承
- DEC-019-033 拡張ルール準拠
- 個人情報非記載（オーナー名 / 息子情報は仮名・型のみ）
- 絵文字ゼロ
- 3 軸 input report 全件参照済（research / secretary / dev 軸の核心結論を統合）

---

## 11. 参照ファイル

- 軸-1: `projects/PRJ-016/reports/research-phase3-runtime-readiness-investigation.md`
- 軸-2: `projects/PRJ-016/reports/secretary-phase3-requirements-spec.md`
- 軸-3: `projects/PRJ-016/reports/dev-phase3-feasibility-and-estimation.md`
- DEC-073 起票: `projects/PRJ-016/decisions.md` 冒頭
- 既存 ADR: `organization/knowledge/decisions/DEC-002〜007*.md`
