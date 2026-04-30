# PRJ-016 意思決定記録（Decisions）

## DEC-060: Phase 2 W11-T1 Family 内 Streak 着手 GO 判定（2026-05-01 / CEO 着手判断）

- **状況**: DEC-059 で Phase 2 W10 全 5 タスク (T1-T5) atomic 採用 / `c337bf9` main push 完遂直後、オーナー「phase2 続きの実装を進めてください」継続マンデート受領。`phase2-gamification-implementation-plan.md` §W11 (lines 228-267) は「保護者連動・家族化（7 人日）」で 5 タスク（W11-T1 Family Streak P0 / W11-T2 親→子応援メッセージ P0 / W11-T3 Family Leaderboard P1 / W11-T4 Daily Push 通知 P0 / W11-T5 Weekly Digest 強化 P1）。
- **判断**: **W11-T1 Family 内 Streak（P0 / 1.5 人日）を最初の atomic として着手 GO**。
- **採択理由**:
  1. **最小スコープ・基盤性**: families テーブルに `familyStreakDays` / `lastFamilyActiveDate` カラム追加 + 既存 learner streak roll-up パターンを家族集計に拡張するだけ。W11-T3 Family Leaderboard が同じ family scope 集計基盤を再利用できるため、T3 着手前提条件を整える。
  2. **外部ブロッカー無し**: W11-T4 (Daily Push 通知) は VAPID 鍵 / Service Worker / push subscription 等オーナー側設定が前提（Phase 2 後段または DEC-029 系手動セットアップ枠で扱うのが安全）。W11-T2 (応援メッセージ) は moderation pipeline / kotodama-tori 代読 modal の UX 設計 + family_messages テーブル + スパム/不適切語フィルタが絡み 2 人日 / W11-T1 より重い。**W11-T1 だけは外部依存ゼロで完遂可能**。
  3. **HANEI 独自差別化軸**: 兄弟救済設計（1 人でも当日学習すれば family streak 維持）は Duolingo Family Plan を超える「日本の家族にフィットする」核心。Phase 2 の最大訴求 USP の最初の 1 ピース。
  4. **W10 で確立した knowledge を再利用可能**: JST 6:00 境界（`getJstQuestDate`）/ atomic UPDATE with UNIQUE INDEX による idempotency / DEC-055 厳守 / 3 層認可（requireAuth → requireFamilyOwner → scopedQueries(familyId)）/ DEC-024 punishment-zero copy / Next.js 16 Turbopack `"use server"` sync export 禁止対応。
- **dev へのブリーフ要点（同梱必須）**:
  1. **migration 0015**: `families.family_streak_days INTEGER NOT NULL DEFAULT 0` / `families.last_family_active_date TEXT NULL`（JST 6:00 境界 quest_date 形式 `YYYY-MM-DD` UTC string）
  2. **`updateFamilyStreakOnLearn(familyId, learnerId, now)` server action**: 任意 learner の当日学習発生時に family streak を atomic に進める。学習発生は既存の `updateLearnerStreakOnQuestComplete` / `recordStudySession` 等の終端で 1 回だけ呼ばれる（idempotency 必須 / 同日 2 回目以降は no-op）。
  3. **`getFamilyStreak(familyId)` server function**: 当日 family streak 表示用。`getJstQuestDate(now) === lastFamilyActiveDate` の場合のみ family streak が「生きて」いる扱い、前日の場合は表示時点で「+1 候補」として返す（roll-over の判定は write 経路で確定）。
  4. **保護者ダッシュボード `/parent/dashboard` に「家族のれんぞく X 日」表示**: 既存「今日 X 分学習」セクションの隣 or 上に追加。学習者ごとの個人 streak とは独立した別セクションで、兄弟がいる家庭では「家族みんなで今日もつながった」感を強調するコピー（DEC-024 punishment-zero / 罰やプレッシャーを示さない）。`data-family-streak-days` 属性で E2E 検証 hook 提供。
  5. **学習者向け `/home` または `/study` 完了画面に family streak ミニ表示**: 「家族のれんぞく X 日」を kotodama-tori が読み上げるコピー or バッジで提示（必須ではないが UX 連動として推奨）。
  6. **unit test 追加**: `family-streak.test.ts` で純関数 `computeFamilyStreakRollover(prev, lastActiveDate, todayDate)` を 6+ ケース網羅（同日 2 回目 no-op / 連続日 +1 / 1 日空き reset / JST 境界跨ぎ / 初回学習で 1 設定 / null lastActiveDate）。`"use server"` ファイル外の純関数として `src/lib/study/family-streak-rollover.ts` 等に切り出す（W10-T5 で確立した Turbopack 制約対応パターン）。
  7. **E2E 1 件**: `family-streak.spec.ts` = 同一 family に learner A / learner B を作成 → A が当日学習 → family streak が 1 になる → B が同日学習しても family streak は 1 のまま（兄弟救済の冪等性）→ 翌日 A だけ学習で family streak 2 に進む（reload 後保持）/ B が学習しなくても family streak は維持される（兄弟救済の本旨）。
- **受入基準**:
  - vitest 全件 PASS（W10-T5 時点 603 + 新規 unit test）
  - typecheck **0 errors** / lint **0 errors / 0 warnings** / next build ✓
  - migration 0015 `bun drizzle-kit generate` 確認可能
  - family-streak E2E green（port 3100 fallback）
  - 保護者ダッシュボード `data-family-streak-days` 属性で正しく表示
  - DEC-024 / DEC-006 / DEC-055 厳守、3 層認可厳守
  - 既存 learner 個人 streak ロジックを破壊しない（W7 で確立した `learner_streaks` 系の動作は不変）
- **報告先**: `projects/PRJ-016/reports/dev-w11-t1-family-streak-done.md`、レビュー部門呼び出しは CEO（次に呼ぶ）
- **優先度**: P0（W11 全体 7 人日のうち最小・基盤、Phase 2 W11 atomic 第 1 弾）
- **次の atomic 候補**: W11-T1 完遂後 → W11-T2 (親→子応援メッセージ) を P0 として続けるか、または W11-T3 (Family Leaderboard) を T1 基盤上に薄く乗せるかを CEO 再判定（W11-T2 は moderation pipeline が必要なため知見蓄積に値する / W11-T3 は T1 基盤の即活用で速い）。

---

## DEC-059: W10-T5 過学習防止「もう少しで終わるよ」UX 実装 → レビュー APPROVE → main push（2026-04-30 / CEO 最終決裁）

- **状況**: DEC-058 (W10-T4 `29ca2e7` push) 完遂を受け W10-T5 (P1 / 1 人日 / `phase2-gamification-implementation-plan.md` §W10-T5) に即着手。CEO ブリーフ「同梱必須 4 点 = study_sessions 0014 / learner_preferences 拡張 / session_cumulative E2E / overtime_cumulative E2E」を厳守。dev 1 セッション完遂 → レビュー部門 **APPROVE**（Critical / Major 指摘ゼロ / Minor 3 件は後続吸収可）→ CEO 判断で main push 実行。W10 過学習防止 UX を Phase 2 完遂の最終層として被せ、W10 全 5 タスク (T1 ハネキン / T2 Shop / T3 Daily Quest / T4 5-7 分セッション / T5 過学習防止) が atomic に揃う。
- **採用実装（dev done レポート §1-7 全採用）**:
  1. **`study_sessions` migration 0014**: `(learner_id, client_session_id)` UNIQUE INDEX で `startOrResumeStudySession` 冪等性 / `(learner_id, session_date)` INDEX で当日 SUM 高速化 / `end_reason` 4 種 (`natural` / `abort` / `overtime` / `hard_limit`)。Phase 2 plan §W10-T4 で繰越した永続化を W10-T5 過学習統計と兼ねて投入（DEC-058 の宣言通り）
  2. **`study-time.ts` 純関数**: `OVERLEARNING_NUDGE_THRESHOLD_SECONDS=30*60` / `OVERLEARNING_HARD_LIMIT_SECONDS=60*60` / `clampHeartbeatDeltaSeconds(0..60)` / `clampSessionCumulativeSeconds(0..14400)` / `describeTodayMinutes(s) → {tone, primary, hint}` (neutral / warm / celebrate)。罰則ゼロ哲学コピーをコード側で機械化
  3. **`study-sessions.ts` server actions**: 三層認可 (requireAuth → requireLearnerOwner → familyId スコープ) + SQL `MIN(cap, col + delta)` で原子的 heartbeat / `ended_at IS NULL` ガードで二重 close を no-op 化
  4. **30 分 nudge (client modal)**: 1 秒 tick で `hasReachedOverlearningNudge(seconds)` 検知 → 2 ボタン (「やすむ」 → endStudySession('abort') / 「もうすこし やる」 → 1 度きり dismiss)。**強制ではなく促し** (DEC-024)
  5. **60 分 hard_limit (server gate)**: `/study/[level]/[skill]/page.tsx` で `getTodayLearningSeconds()` を server で先取り → 60 分以上なら問題 fetch せず gate ページ (`data-testid="overlearning-hard-limit-gate"`) を返す。コピーは「きょうは じゅうぶん がんばったね。あした また あおうね」(祝福調)
  6. **保護者ダッシュボード「今日の学習時間」 Card**: `data-testid="today-learning-card"` / `getTodayLearningSeconds(learner.id)` で個別集計 / tone 切替で前向きコピー
  7. **`learner_preferences.preferredSessionMinutes`** 拡張: W10-T4 SessionPicker の「いつもの長さ」を 5/7/10/null で cross-device 永続化 / `setPreferredSessionMinutes` server action 追加
- **検証結果**:
  - **unit 603 件 GREEN** (W10-T4 時点 573 件 + W10-T5 で +30 件 / `study-time.ts` 26 + `learner-preferences` 4)
  - typecheck / lint / build (Turbopack production / 23 routes) 全 clean
  - **session_cumulative E2E 2/2 PASS** (port 3100 / 24.4s) — M-A1 リグレッションガード + 30 分 nudge modal
  - **overtime_cumulative E2E 1/1 PASS** (port 3100 / 23.5s) — 60 分 server gate + DEC-024 streak 不変 + 罰語ゼロ assert
  - drizzle-kit generate clean / E2E fixture migration 0014 適用成功
- **付随リファクタ（dev 完遂時に発生 / atomic 同梱）**:
  - **Turbopack 厳格化対応**: `"use server"` ファイル `learner-preferences.ts` から sync 関数 `normalizePreferences` を `src/lib/study/learner-preferences-normalize.ts` へ分離（Next.js 16 Turbopack で「Server Actions must be async functions」がビルドエラー化したため）
  - **`E2E_PORT` env 対応**: `playwright.config.ts` が `E2E_PORT` で port 切替可能に (dev 占有 3000 と E2E 3100 共存)
  - **React 19 純度規則対応**: `useRef<number>(0)` lazy init + `showOverlearningHardLimit` を派生値化（state 不要 / `react-hooks/purity` / `set-state-in-effect` 全解消）
- **レビュー部門判定（review-w10-t5-overlearning-prevention.md）**: **APPROVE / Critical / Major 指摘ゼロ**
  - **DEC-024 罰則ゼロ準拠**: 罰語 0 hit (OverlearningModal / hard_limit gate / study-time.ts / dashboard 全文検索) + unit/E2E 両方で `not.toContain("だめ"|"やりすぎ"|"ペナルティ")` 機械化済 / streak は `study-sessions.ts` に write 0 hit で **構造的に減算経路ゼロ**
  - **K-1 / K-2 準拠**: 56px tap area / 平仮名中心 / 半角数字 / aria-label / role="dialog" 完備
  - **アーキテクチャ整合性**: migration 0014 libSQL 互換 / `MIN(cap, col + delta)` 1-statement 原子性 / 三層認可全 server action 適用 / React 19 純度 OK
  - **テストカバレッジ**: unit 30 件で境界 + 罰語排除網羅 / E2E が「reload 越え冪等 / 30 分 nudge / 60 分 server-gate / streak 不変」網羅
  - **既存機能整合性**: W10-T4 sessionStartTime と W10-T5 cumulative tracking は独立 setInterval で衝突なし / 直リンク (sessionId 無し) は legacy 互換 trackingActive=false だが server-side hard_limit gate は全 entry で効く保険設計あり
- **Minor 指摘 3 件（後続吸収可 / push 阻害なし）**:
  - **M-1**: Phase 1 直リンクの cumulative tracking 不在を W10 締め DEC で 1 行明記推奨（→ 本 DEC-059 の本セクション「Minor 指摘」記述で吸収済）
  - **M-2**: heartbeat の `visibilitychange + sendBeacon` 連携を W11 polish or β 直前で追加推奨（実害最大 10 秒 / 30/60 分閾値精度には影響しない）
  - **M-3**: `getTodayLearningSeconds` の SUM 集計デノーマライズ案を Phase 3 β 拡大時に再検討
- **CEO 判断**:
  - **APPROVE 採用 / W10-T5 atomic commit を `29ca2e7..HEAD  main -> main` で push** （commit メッセージは review レポート §推奨アクション 1 案を採用）
  - **本番 Turso への migration 0014 適用**: W10-T4 で 0013 を適用したのと同手順 (drizzle migrations / 手動でも CREATE TABLE IF NOT EXISTS なので冪等)
  - **オーナーへの smoke 確認依頼**: 保護者ダッシュボード「今日 X 分」表示の 1 回手元確認（M-1〜M-3 は CEO 受領 / 後続タスクで吸収）
- **Phase 2 W10 完遂状況**:
  - W10-T1 ハネキン経済 ✓ (`6dd1f1a` push 済)
  - W10-T2 Shop UI ✓
  - W10-T3 Daily Quest ✓ (`8ff21a7` push 済)
  - W10-T4 5-7 分セッション ✓ (`29ca2e7` push 済)
  - W10-T5 過学習防止 ✓ (本 DEC-059 で push)
  - **→ Phase 2 W10 全 5 タスク完遂** = ハネキン経済 (T1) + 蓄積 (T2) + 達成導線 (T3) + 量の可視化 (T4) + やりすぎ抑制 (T5) が atomic に揃い、Phase 2 ゲーミフィケーションが体験として完成。次は Phase 2 W11 (polish / 保護者 weekly digest 等) もしくは Phase 3 (β 公開準備) をオーナー判断に委ねる
- **関連**: DEC-058 (W10-T4 push), DEC-057 (W10-T3 push), DEC-055 (W10-T1 ハネキン経済), DEC-024 (罰則ゼロ哲学), DEC-006 (Phase 1 完全無料), `phase2-gamification-implementation-plan.md` §W10-T5, `reports/dev-w10-t5-overlearning-prevention-done.md`, `reports/review-w10-t5-overlearning-prevention.md`

---

## DEC-058: W10-T4 5-7 分セッション自動設計 実装 + M-A1 構造バグ即時修正 → main push（2026-04-30 / CEO 最終決裁）

- **状況**: DEC-057 (W10-T3 `8ff21a7` push) 完遂を受け W10-T4 (P0 / 1.5 人日 / `phase2-gamification-implementation-plan.md` §W10-T4) に即着手。dev `ecf92cc` で本体 + W10-T3 review minor (M-1 / M-2 / M-4) 同梱 atomic commit → レビュー部門 **CONDITIONAL APPROVE**（致命的構造バグ M-A1 + 関連 M-A2 / M-A3 を指摘）→ dev `29ca2e7` で M-A1 + M-A2 + M-A3 を 1 atomic commit で同時修正 → 静的検査 / unit 573 件 / E2E port 3100 quests.spec.ts 4/4 PASS で全緑 → CEO 判断で `8ff21a7..29ca2e7  main -> main` push 完遂。W10-T3 push 直後の continuous CEO call で 1 セッションで W10-T4 完遂。
- **採用設計（dev done レポート §1-3 全採用）**:
  1. **純関数 `composeStudySession({learnerId, durationMinutes, now})`**: AI 呼び出しゼロ / DB I/O ゼロ / `(learner, day, duration)` で deterministic な planSize + review:fresh:weakness 構成比を返す。Phase 2 plan §W10-T4 推定問題数表 (5 分 = 5-8 / 7 分 = 8-12 / 10 分 = 12-18) を内部 PLAN_VARIANTS table で展開、mulberry32 + cyrb53 派生 hash で variant 選定（W10-T3 と同じ手法 / 再現性 100%）
  2. **`/study` Server Component + SessionPicker Client**: 三層認可 (`requireAuth` → `getFamilyIdForUser` → `requireLearnerOwner`) → 3 択カード（K-1 56px タップ領域 / Heroicons / ふりがな-ready / Amber Gold）→ `?dur=&session=<uuid>` 付き遷移。「いつもの長さで」は `useSyncExternalStore` で localStorage 購読（effect 内 setState 回避 / hydration mismatch 警告は W11 polish 候補）
  3. **SessionCompleteModal**: `natural` (planSize 到達) / `abort` (「ここまでにする」) / `overtime` (経過時間 >= duration*1.5) の 3 reason。**overtime は強制終了せず**「もうすこし やる」/「おしまいに する」両提示で明示選択を強制（DEC-024 罰則ゼロ哲学整合 / M-A3 修正で背景クリック skip 不可化）
  4. **StudyClient session-mode**: planSize 到達 / 「ここまで」/ overtime 5 秒 polling で session modal 起動 / 既存 LessonCompleteModal は `sessionActive` 時のみ抑制 → session-mode 外の Phase 1 直リンク `/study/eiken-5/vocab` は従来通り
- **同梱した W10-T3 review minor**:
  - **M-1**: `tests/e2e/quests.spec.ts` test 1 を「signup → /home で既に 3 件 lazy gen 済 → /quests 遷移後も同 id 集合」spec に書き換え（production 不変）
  - **M-2**: `drizzle/0013_w10_coin_idempotency_unique.sql` で `coin_transactions(learner_id, reason, reference_id) WHERE reference_id IS NOT NULL` partial UNIQUE INDEX 投入。DEC-055 で謳っていた冪等チェックを **DB 層で強制**
  - **M-4**: `/home/page.tsx` の `getOrGenerateTodayQuests` を `.catch → null` fallback でガード（リボン非表示で /home 全体エラー化を防止）
- **致命的レビュー指摘 M-A1 と即時修正（commit `29ca2e7`）**:
  - **M-A1 構造バグ**: `page.tsx:158` の `<StudyClient key={problem.id} ...>` により router.refresh() で次問題遷移時に StudyClient が unmount → remount し、`sessionAnswers` / `sessionEarnedCoins` / `sessionStartTime` / `overtimeOffered` の useState が **毎問初期化** → planSize 到達 natural 完了 modal が**絶対に発火しない** / overtime polling も `sessionStartTime` リセットで事実上発火不能 / 「セッション X / N もん」進捗ライン常に 0/N 表示
  - **修正**: `key={sessionId ? "session:<sessionId>" : "problem:<id>"}` に切替で session-mode 中は unmount せず、UI state (selected / feedback / essayDraft) だけ render-time prev 比較 + setState で問題切替時にリセット（"Storing previous render information" 公式パターン採用、`react-hooks/set-state-in-effect` lint 警告を回避）
  - **副次効果**: W8-T2 combo state も session-mode 中 persist するように → むしろ W8-T2 本来意図する UX に近い改善方向（要 session cumulative E2E で W10-T5 内 ガード追加）
  - **M-A2**: `SessionCompleteModal` useEffect の deps から `summary` (毎 render 新参照) を除去 → confetti 二重発火リスク解消
  - **M-A3**: `reason === "overtime"` 時の背景 onClick を無効化 → overtime 提案を必ず明示選択させる（DEC-024 整合）
- **品質ゲート結果**:
  - typecheck / lint clean
  - **unit 573 件 GREEN**（既存 542 + W10-T4 新規 31 / W8-T2 combo 21 件 / W8-T3-T4 audio 15 件 全 PASS / regression なし）
  - E2E discovery 62 tests / 10 files / port 3100 実走 quests.spec.ts 4/4 PASS
  - レビュー判定: CONDITIONAL APPROVE → M-A1 + M-A2 + M-A3 修正後 即 APPROVE 相当
- **push 実行**: `8ff21a7..29ca2e7  main -> main` 完遂（HANEI repo `https://github.com/hironori-oi/HANEI.git`）
- **永続化方針（CEO 確定）**: `study_sessions` テーブル / migration 0014 は **W10-T5 で投入**。理由 = (i) atomic commit スコープ管理 (ii) W10-T5 過学習防止 UX で `actual_duration_seconds` / `outcome` / `problem_count` / `correct_count` を再利用 (iii) Phase 1 では URL 伝搬で十分機能する
- **W10-T5 着手判断**: **GO**（過学習防止「もう少しで終わるよ」UX / P1 / 1 人日 / `phase2-gamification-implementation-plan.md` §W10-T5）。W10-T5 内で以下を同梱必須:
  - **session cumulative E2E 1 件**: `signup → /study?dur=5 → 2 問解答 → SessionCompleteModal data-reason="natural"` で M-A1 修正の regression ガード（レビュー §4 不足カバレッジ #1）
  - **overtime cumulative E2E 1 件**: 5 分選択 → 7.5 分以上滞在 → overtime modal の明示選択動作確認
  - **`study_sessions` テーブル**: W10-T4 で繰越した永続化を W10-T5 過学習統計と兼ねて投入
  - **`learner_preferences` 拡張**: 端末跨ぎ「いつもの長さで」永続化
- **繰越事項**:
  - **M-N1** (StudyClient session-abort-cta button K-1 タップ領域 56px) → W11 polish
  - **N-1** (claimQuestReward `not_completed` reward 0 統一) → W11 polish
  - **`study-smoke.spec.ts:60` baseline 失敗** → 本修正前 `ecf92cc` でも同箇所失敗 = W10-T4 regression ではない / production build + e2e fixture DB 問題で別タスク調査
  - **SessionPicker SSR/CSR hydration mismatch** (useSyncExternalStore + localStorage) → W11 polish
- **影響**:
  - 開発: `src/lib/study/session-composer.ts` (新規 / 純関数 31 unit), `src/components/study/{SessionPicker,SessionCompleteModal}.tsx` (新規), `src/app/(app)/study/{page.tsx,[levelCode]/[skillCode]/{page.tsx,StudyClient.tsx}}` (改修), `drizzle/0013_w10_coin_idempotency_unique.sql` (M-2 / DB 層冪等強制), `tests/e2e/quests.spec.ts` (M-1 修正), `tests/e2e/fixtures/db-fixture.ts` (migration 追加)
  - 体験: 学習導線が「ホーム → 時間選択 (5/7/10 分) → 自動構成された問題セット → kotodama-tori celebration」で初めて完結。W10-T1 + T2 + T3 と組み合わせて「達成 → 蓄積 → 報酬 → 振り返り」の閉じたループが体験として通る
  - W10-T5: 過学習防止「もう少しで終わるよ」UX で「やりすぎ抑制」を最終層として被せ、Phase 2 W10 の 5 タスクを完遂する見通し
- **罰則ゼロ哲学整合**: 0 問完了でも「きょうも きてくれて ありがとう」/ 不正解多くても「ことだまトリも うれしそう」/ overtime も強制終了なし / 否定形コピーなし (unit test で `(ない|だめ|失敗|やめろ)` regex 排除確認)
- **関連**: DEC-057 (W10-T3 push), DEC-055 (W10-T1 ハネキン経済), DEC-024 (罰則ゼロ哲学), DEC-006 (Phase 1 完全無料), `phase2-gamification-implementation-plan.md` §W10-T4 / §W10-T5, `reports/dev-w10-t4-session-design-done.md`, `reports/review-w10-t4-session-design.md`, `reports/dev-w10-t4-session-design-fix-done.md`

---

## DEC-057: W10-T3 Daily Quest デイリーミッション 実装完遂 + レビュー APPROVE → main push（2026-04-30 / CEO）

- **状況**: DEC-056 (W10-T2 /shop UI 案B atomic commit `0e9cd76`) 完遂を受けて W10-T3 (P0 / 2 人日 / `phase2-gamification-implementation-plan.md` §W10-T3) に着手。dev 部門が「決定論的生成 + lazy generation + atomic claim + best-effort 進捗 hook」の 4 軸で 1 atomic commit 実装完了 → レビュー部門投入 → APPROVE → main push までを 1 セッションで完遂。
- **採用設計（dev 部門 done レポート §1-5 全採用）**:
  1. **決定論的生成**: `mulberry32` PRNG + `cyrb53` 派生 hash seed `(learnerId|questDate)` で同 (learner, date) は何度呼んでも同 3 件 + 同 target が出る → unit test 25 件で実証。AI 呼び出しゼロ / コスト 0 / 再現性 100%
  2. **lazy generation**: Vercel Hobby plan の cron 1/day 制約に巻き込まれない設計。`/home` または `/quests` 初回アクセスで `getOrGenerateTodayQuests` が発火 → DB UNIQUE `(learner_id, quest_date, quest_type)` + アプリ層 deterministic 同一性の **二重防御** で race-safe
  3. **JST 6:00 境界**: `getJstQuestDate` で「今日」を 6:00 JST 開始 = DEC-024 罰則ゼロ哲学整合（夜更かし学習者が 0:01 に取り損ねる UX を排除 / 海外渡航は Phase 2 範囲外で日本標準時 DST なしを利用）
  4. **claim atomic**: `WHERE id=? AND learner_id=? AND status='in_progress'` の atomic UPDATE で連打 / 並行 tab に race-safe / `coin_transactions.referenceId` (`quest_<id>` / `all_done_<date>`) で冪等保証
  5. **all-done bonus**: 同日 3 件全 claimed で 1 度だけ +30 ハネキン bonus (referenceId `all_done_<date>` で重複防止)
  6. **submitAnswer hook**: `incrementQuestProgress` を best-effort (try-catch 握り潰し) で結線 / `problem.skillId` の `-N` 剥がし regex で skill code 抽出
  7. **Phase 1 = 6 種 quest_type**: `mock_warmup` のみ `enabled=false` (Phase 3 用) / `streak_keep` を 1 件目固定 / 残り 2 件は deterministic shuffle で重複なく抜く
- **新設 / 修正ファイル (実装本体)**:
  - 新規: `drizzle/0012_w10_daily_quests.sql`, `src/lib/quest/{jst-date,quest-templates,quest-generator}.ts`, `src/lib/actions/quests.ts`, `src/components/quest/{DailyQuestCard,DailyQuestSummaryRibbon}.tsx`, `src/app/(app)/quests/page.tsx`, `tests/unit/quest.{jst-date,templates,generator}.test.ts` (56 件), `tests/e2e/quests.spec.ts` (4 ケース)
  - 修正: `src/lib/db/schema.ts`, `src/lib/actions/study.ts`, `src/app/(app)/home/page.tsx`, `tests/e2e/fixtures/db-fixture.ts`
- **品質ゲート結果（レビュー部門 `review-w10-t3-daily-quest.md`）**:
  - **判定**: APPROVE (条件なし承認)
  - **必須観点 A-H 全 8 項目**: 決定論性 / 7 type バランス / JST 6:00 境界 / 冪等性 race / DEC-055 coin_transactions 影響なし / DEC-024 罰則ゼロ整合 / 三層認可 / submitAnswer hook best-effort — 全て根拠ベースで OK
  - **静的検査**: typecheck / lint clean / unit 542 件 GREEN
  - **E2E**: port 3100 で実走 PASS 3/4（4 ケース中 production 仕様で意味のある 3 件 = lazy gen 冪等 / claim+bonus / 重複 claim skip は **3/3 PASS**。残 1 件 fail は test 側の assertion 前提誤り = M-1: signup → /home が既に lazy gen を発火させるため `before === 0` が成立しない / production code は完全に正しい）
  - **Critical / Major: 0 件 / Minor: 4 件 (M-1〜M-4) / Nits: 1 件**
- **push 実行**: HANEI repo (`projects/PRJ-016/app/`) `8ff21a7 feat(W10-T3): デイリーミッション (Daily Quest) 実装` を `0e9cd76..8ff21a7  main -> main` で remote `origin/main` (https://github.com/hironori-oi/dummy/HANEI.git) に push 完遂
- **繰越事項（W10-T4 で同時対応）**:
  - **M-1**: `quests.spec.ts` ケース 1 を「signup → /home 後に 3 件生成済」に書き換え（production code 不変 / test 側 1 行修正）
  - **M-2**: `coin_transactions` partial UNIQUE INDEX `(learner_id, reason, reference_id)` を `0013_w10_coin_idempotency_unique.sql` で投入（DB 層 race-safe をさらに堅牢化 / W10-T4 か W11 polish）
  - **M-4**: `/home` Server Component の Promise.all 内で `getOrGenerateTodayQuests` を try-catch wrap（リボン非表示 fallback / Phase 2 hardening）
  - **M-3**: `incrementQuestProgress` の loop 内 UPDATE 一括化（Phase 2 perf / W11 以降）
- **W10-T4 着手判断**: **GO**（5-7 分セッション自動設計 / P0 / 1.5 人日 / `phase2-gamification-implementation-plan.md` §W10-T4）。M-1 を W10-T4 の 1 line 修正で同時 close、M-2 / M-4 は W10-T4 内で同時投入推奨
- **影響**:
  - 親リポ: `dashboard/active-projects.md` に W10-T3 APPROVE / push 完遂を反映、`reports/dev-w10-t3-daily-quest-done.md` + `reports/review-w10-t3-daily-quest.md` を tracked 化（W10-T2 レビュー artifact `review-w10-t2-shop.md` も同タイミングで commit）
  - HANEI repo: 経済 + 蓄積導線 + 達成導線 (T1 + T2 + T3) が体験として接続。W10-T4 (5-7 分セッション) で「今日やる量の可視化」と「Daily Quest 進捗」が同期。W10-T5 (過学習防止) で「やりすぎ抑制」を最終層として被せる構造
- **関連**: DEC-056 (W10-T2 /shop 案B), DEC-055 (W10-T1 ハネキン経済), DEC-024 (罰則ゼロ哲学), DEC-006 (Phase 1 完全無料), DEC-052 (W9-B アクセサリ slot mutex / regression なし), DEC-008 (品質ゲート 68 項目), `phase2-gamification-implementation-plan.md` §W10-T3, `reports/dev-w10-t3-daily-quest-done.md`, `reports/review-w10-t3-daily-quest.md`

---

## DEC-056: W10-T2 /shop UI スコープ確定 — 案B採用 (Streak Freeze 追加購入 + kotodama feed のみ / アクセサリ購入経路は閉鎖)（2026-04-30 / オーナー承認 / CEO）

- **状況**: DEC-055 で W10-T1 ハネキン経済 foundation (schema / ledger / Server Actions / submitAnswer hook) が atomic commit 完了。次は W10-T2 = `/shop` UI に着手するに当たり、アクセサリ category を W9-B (DEC-052) の解禁条件 (level / streak / xp / badge) と shop 購入解禁の **デュアル経路** にするか、**W9-B 解禁条件のみに限定**するかが設計分岐点となった。
- **採用案 (案B / CEO 推奨 → オーナー承認)**:
  - **アクセサリ category は /shop に出さない**。W9-B (DEC-052) の達成条件解禁のみを唯一の獲得経路として維持。
  - **/shop UI スコープ = 2 category のみ**:
    1. **Streak アイテム**: Streak Freeze 追加購入 (W8 で 1 個無料配布済み = base, ハネキンで予備在庫を増やす)
    2. **kotodama-tori エサ (feed)**: 特殊エサで mood ブースト (Octalysis CD3「自分の選択で何かを変えられる」を担当)
- **却下した案A (デュアル経路)**:
  - アクセサリ全 12 種 = W9-B 解禁条件達成 OR ハネキン購入で先取り の併用
  - **却下理由**:
    1. **DEC-052 の slot mutex / 解禁演出設計の希釈**: アクセサリは「課題達成の証」としての意味付けで slot mutex (帽子/メガネ/ペンダント) と解禁時の祝祭演出が組まれている。ハネキン課金で先取り可能になると「達成の証」の象徴性が薄れ、設計意図と乖離する。
    2. **Octalysis CD3 (Empowerment of Creativity & Feedback) は kotodama feed で十分充足**: feed による mood ブーストは「子どもが自分の選択でキャラ状態を変える」体験そのものであり、CD3 の本質要件を満たす。アクセサリ購入経路を加える必要なし。
    3. **経済設計の単純化**: アクセサリ購入を許すと「達成 vs 課金」の二択で子どもに不要な選好負荷を強いる。子ども向け × 親観察前提の本プロダクトでは、課金導線を最小に絞り、達成導線を主軸にするほうが教育倫理面でも整合。
- **/shop UI 詳細仕様**:
  - **ページ上部**: 現残高 (ハネキン X 個) を **大きく表示** (HanekinBalanceHeader コンポーネント新設、Amber Gold + 黄金グロー)
  - **2 category タブ or 縦並びセクション**: 「Streak アイテム」「ことだまトリのエサ」(子ども向け語感)
  - **購入フロー**: 各アイテムカード → 「買う」CTA → confirm dialog (購入後の残高プレビュー) → `spendCoins` Server Action 呼出 (DEC-055 の `coin_transactions` に `freeze_purchase` / `feed_purchase` reason で行を追加 + 在庫テーブル更新) → 即時所有反映 + tossy toast 「ありがとう！」
  - **残高不足時**: 「ハネキンが X 個足りないよ」表示 + 「クエストで貯める」CTA (`/quests` への動線)
  - **冪等性**: `reference_id` に client-generated UUID を載せ、同一 UUID の再 submit は no-op (DEC-055 の冪等チェック index `(learner_id, reason, reference_id)` を活用)
- **/home 動線への残高 / shop 導線追加**:
  - W9-Polish (DEC-054) で導入した 3 ボタン構成 (`/badges` / `/accessories` / `/messages`) に **「ショップ」ボタンを追加して 4 ボタン構成**
  - もしくは **header に残高バッジ常時表示** (`HanekinBalanceBadge` 小サイズ、ボタン化して `/shop` に遷移)
  - **採用**: 4 ボタン化 + header 残高バッジの **両方**。残高バッジは全ページ共通 layout に配置 (`/home` 以外でも常時可視)
- **W9-B (アクセサリ) との明示的な切り分け**:
  - `/shop` ページに「アクセサリは ことだまトリと一緒にがんばると もらえるよ」のヘルプテキストを配置 (子ども向け語感)。`/accessories` への内部リンクで導線を担保 (購入はできないが解禁条件と現状の確認は可能)
- **新設テーブル / 列追加 (Dev 部門で migration 0011 必須)**:
  - `learner_inventory` (新設): `id` / `learner_id` / `item_type` ('streak_freeze' | 'kotodama_feed_*') / `quantity` (integer notNull default 0) / `last_acquired_at` / `last_used_at` — 在庫管理
  - インデックス: `(learner_id, item_type)` UNIQUE で 1 学習者 1 item_type = 1 行
  - feed の細分化 (普通エサ / 特上エサ / 雨の日限定エサ など) は `item_type` の suffix で管理
- **価格設計 (初期値 / 後続調整可)**:
  - **Streak Freeze**: 30 ハネキン / 1 個 (W8 base 1 個 + 購入 max 5 個まで在庫保持)
  - **普通エサ**: 5 ハネキン / 1 個 (mood +1)
  - **特上エサ**: 20 ハネキン / 1 個 (mood +3 + 24h 持続)
  - **雨の日限定エサ**: 15 ハネキン / 1 個 (天気 API 連動の演出強化、Phase 3 候補だが価格枠だけ確保)
- **品質ゲート**:
  - `submitAnswer` 経路で残高変動が起きたら `/shop` の残高表示が optimistic update で即時反映 (revalidatePath or React Query mutate)
  - E2E: 残高 0 → 購入失敗 / 残高十分 → 購入成功 → 在庫 +1 + 残高 -price + transaction 記録 + 冪等性 (同一 UUID 二重 submit が no-op)
  - a11y: 「買う」ボタンの aria-label 日本語固定 (子ども × screen reader)、価格は数字 + 「ハネキン」明示 (currency aria-label)
  - K-1 タップ領域 56px / K-2 文字サイズ + ふりがな維持
- **W10-T2 から外す事項 (W10-T3 以降 / Phase 3 候補)**:
  - 期間限定セール / バンドル販売 / ガチャ的要素は **不採用** (子ども向け × dark pattern 回避)
  - 親による残高チャージ (リアル課金) は **Phase 1 完全無料方針 (DEC-006) に矛盾するため不採用**
  - 残高履歴の保護者ダッシュボード可視化は W10-T4 (保護者 weekly digest) に統合
- **影響**:
  - 開発: `/shop` page + `HanekinBalanceHeader` + `HanekinBalanceBadge` + `ShopItemCard` + `ConfirmPurchaseDialog` + `spendCoins` Server Action 拡張 (item_type 引数追加) + migration 0011 (learner_inventory) + E2E 1 spec 新設
  - PM: WBS の W10-T2 を「2.5 人日 → 2 人日 (案B でスコープ削減)」に更新
  - レビュー: DEC-052 slot mutex / W9-B 解禁演出 への regression 確認を品質ゲート必須項目に追加
- **関連**: DEC-055 (W10-T1 ハネキン経済 foundation), DEC-052 (W9-B アクセサリ slot mutex), DEC-054 (W9-Polish /home 統合), DEC-006 (Phase 1 完全無料), DEC-024 (罰則ゼロ励まし主軸), Octalysis CD3, `phase2-gamification-implementation-plan.md`

---

## DEC-055: W10-T1 ハネキン (はね金) 経済 foundation — schema + migration 0010 + ledger 純関数 + Server Actions + submitAnswer hook を atomic commit（2026-04-29 / CEO）

- **状況**: DEC-054 で W9 が「体験完成」として `/home` 上に統合表示された後、Phase 2 第3週 (W10) に着手。W10 は `phase2-gamification-implementation-plan.md` で「経済システム + 5 分セッション最適化 (8 人日)」と定義され、5 サブタスク (T1〜T5) で構成される。**W10-T1 (P0 / 2 人日) = 閉じた経済「ハネキン (はね金)」** は他全タスク (T2 Shop UI / T3 Daily Quest 報酬 / T5 過学習防止 — Streak Freeze 追加購入経路) の前提条件であり、最優先で着手。
- **決裁**:
  - **命名**: 仮想通貨は **「ハネキン (はね金)」** で確定。`gems` / `coins` 等の既製語を避ける独自命名で、HANEI ブランド (半英=はんえい / はね) と整合。子どもが「はね金 (キン)」として親しみやすく、JP-locale の語感も保つ。
  - **DB Schema (1 列追加 + 1 table 新設)**:
    - `learner_profiles.coin_balance` (`integer notNull default 0`) — denormalized cache. 真のソースは `coin_transactions.amount` の累計。
    - `coin_transactions` 新設 (1 行 = 1 トランザクション): `id` / `learner_id` / `amount` (正=獲得 / 負=消費 / 0 不可) / `reason` (9 種 enum) / `reference_id` (冪等チェック用) / `memo` / `created_at`
    - インデックス 2 本: `(learner_id, created_at)` 時系列 + `(learner_id, reason, reference_id)` 冪等チェック高速化
  - **9 種 reason enum**: 獲得 5 種 (`lesson` / `streak` / `badge` / `quest` / `level_up`) + 消費 3 種 (`shop_purchase` / `freeze_purchase` / `feed_purchase`) + 両方向 1 種 (`manual_adjust` 運営サポート用)
  - **`lib/economy/ledger.ts` (純関数 / DB I/O ゼロ)**:
    - `validateAmount` / `validateSpend` / `computeNewBalance` / `validateReasonAmountSign` / `reduceTransactionsToBalance` / `rewardForBadgeTier`
    - `COIN_REWARDS` 定数: `LESSON_CORRECT=2` / `LESSON_INCORRECT=0` (罰則ゼロ / DEC-024 励まし主軸 と整合) / `STREAK_DAY=5` `WEEK=20` `MONTH=100` / `BADGE_BRONZE=30 SILVER=60 GOLD=100 PLATINUM=200` / `QUEST_COMPLETE=15 ALL_DONE=30` / `LEVEL_UP=50`
    - 設計値: 60 分学習 (≒ 30 問正解) で ≒ 60 ハネキン獲得 = アクセサリ小物 1 つ買える / 200 ハネキン = Streak Freeze 1 枚追加購入
  - **`lib/actions/coins.ts` (Server Actions / 三層認可)**:
    - `getCoinBalance(learnerId)` / `listTransactions(learnerId, opts)` / `hasReceivedFor(learnerId, reason, refId)` (冪等チェック) / `awardCoins({...})` / `spendCoins({...})`
    - `awardCoins`: `validateAmount` + `validateReasonAmountSign` + (任意) 冪等チェック → INSERT(coin_transactions) + UPDATE(coin_balance += amount) を Server Action 内で連続実行 (SQLite serialized writes 前提)
    - `spendCoins`: `validateSpend(balance, cost)` で残高検証 → INSERT(amount=-cost) + UPDATE(coin_balance -= cost) WHERE coin_balance >= cost (atomic conditional)
    - 全 Server Action は内部で `requireAuth + requireLearnerOwner` を再実行 (FormData 改ざん防御 / 三層認可第二層)
  - **`submitAnswer` hook 統合**: 正解時のみ `awardCoins({ learnerId, amount: COIN_REWARDS.LESSON_CORRECT, reason: "lesson", referenceId: problemId })` を呼ぶ。冪等チェック OFF (同 problemId 再正解は再付与 OK = 学習進捗のインセンティブ)。award 失敗は `try/catch` で握り、学習体験は中断しない (best-effort)。`SubmitAnswerResult` に `coinDelta` + `coinBalance` を追加し、UI が次画面で残高表示できる設計。
  - **e2e fixture**: `tests/e2e/fixtures/db-fixture.ts` の migrations 配列に `0010_w10_coin_economy.sql` を追加。
  - **Unit Tests** (`tests/unit/economy.ledger.test.ts`): 31 tests / 8 group (REASONS / validateAmount / validateSpend / computeNewBalance / validateReasonAmountSign / rewardForBadgeTier / reduceTransactionsToBalance / COIN_REWARDS 設計検証) で純関数の不変条件を完全網羅。
  - **品質ゲート**: typecheck=clean / lint=clean / vitest **40 files / 486 tests = all green** (455 → 486, +31) / `next build` で 全 route 正常出力 (新 actions は server-only なので route 増減なし)
  - **課金システム化禁止 (DEC-012)**: 外部購入導線ゼロの閉じた経済として実装。Stripe / Apple IAP / Google Play Billing 等の連携コードは一切なし。
- **理由**: W10 の 4 タスク (T2 Shop / T3 Quest / T5 Freeze 追加購入) すべてがハネキン foundation を必要とし、T1 を atomic commit として確実に通すことで以降のサブタスクが「UI と hook 追加」に集中できる。`coin_balance` の denormalized cache + `coin_transactions` の append-only ledger 二段構成は、(1) 残高表示の高速化 (PK 1 query) (2) 監査トレイル (3) 冪等チェック (`reference_id` で重複付与検出) を同時に満たす定石。symptom: ハネキンが見えるのは W10-T2 (Shop UI) で `/shop` ページが追加されてから / 学習中の獲得演出は W10-T2 か polish 増分で `StudyClient.tsx` 側に表示する予定。
- **影響**: W10 残タスク = T2 (Shop UI) → T3 (Daily Quest) → T4 (5-7 分セッション) → T5 (過学習防止) の順で atomic commit を継続。次は **W10-T2 `/shop` UI** を着手予定 (アクセサリ購入 + Streak Freeze 追加購入 + kotodama feed の 3 カテゴリ)。

## DEC-054: W9-Polish — /home に W9 三系統を統合表示 (CharacterWithAccessories overlay + 件数バッジ) を atomic commit（2026-04-29 / CEO）

- **状況**: DEC-053 で W9 (進化キャラ + バッジ + アクセサリ + 親メッセージ) の 4 系統が本番投入可能になったが、`/home` では 3 系統が **個別動線ボタン** に留まっており「ことだまトリ + 装着アクセサリ + バッジ件数 + 未読メッセージ件数」が **一望できない** 状態だった。W9 体験統合面の polish が残課題。
- **決裁**:
  - **キャラ表示の差し替え**: `/home` 中段の `<KotodamaStageDisplay input={kotodamaInput} svgSize={140} />` を、**`<CharacterWithAccessories>` overlay 付き** の inline Card レイアウトに置換。子は自分の装着アクセサリ (hat / scarf / wing_charm) を着けた状態で **「いま、自分のことだまトリがどう成長しているか」** を一望できる。
  - **stage 情報の保持**: `describeKotodamaStage(kotodamaInput)` を /home page 内で直接呼び、Card 右側に stage 説明 / nextStageHint / 最終段階メッセージを変わらず表示。**KotodamaStageDisplay コンポーネントは差し替えるが、表示情報量は維持**。
  - **件数バッジ統合**: 3 ボタン (バッジ / アクセサリ / メッセージ) すべてに件数を表示:
    - `バッジ ({badgeCount} / 8)` — 既存の表示を維持
    - `アクセサリ ({accessoriesUnlockedCount} / 12)` — `loadAccessoriesPageData(activeId).unlocked.length` を新規計算
    - `おうえん メッセージ <未読 N 通 pill>` — 未読 0 のときは `(未読 0 通)` グレー表示、未読あれば primary 色丸バッジで強調
  - **データ取得**: 既存 `Promise.all` 配列に `loadAccessoriesPageData(learner.id)` と `getMessagesForLearner(learner.id)` を追加 (並列化済み / 認可は内部の三層認可で再確認)。
  - **a11y**: 未読件数バッジに `aria-label="未読 N 通"` を付与、`tabular-nums` で桁ぶれを防止。`data-testid="home-messages-link"` + `data-unread={unreadMessagesCount}` を追加し、E2E が未読件数を直接 assert 可能に。
  - **品質ゲート**: typecheck=clean / lint=clean / vitest 455 tests = all green / `next build` で `/home` route が ƒ (dynamic) として正しく出力される (新規 import = `loadAccessoriesPageData` + `getMessagesForLearner` + `CharacterWithAccessories` + `describeKotodamaStage`)。
- **理由**: W9 で実装した 4 系統を **/home という日常起点の画面で物理的に統合** することで、子は学習を始める前に「自分の成長状態」を視覚的に確認でき、親メッセージの未読件数も入口で把握できる。`KotodamaStageDisplay` の Card レイアウトを inline 化したのは、`bareSvg` モードを `CharacterWithAccessories` 経由で利用するためで、表示情報量は同等。`getMessagesForLearner` は内部で `requireParent` を呼ぶ設計のため、Phase 1 親プロキシ運用 (DEC-024) と整合。
- **影響**: W9 が「実装完了」から「体験完成」へ昇格。次の atomic increment は W10 (W10-T1 ハネキン経済 / W10-T2 Shop UI / W10-T3 Daily Quest / W10-T4 5-7 分セッション設計 / W10-T5 過剰学習防止 UX) もしくは Phase 3 計画策定 (β 公開準備) をオーナー判断に委ねる。

## DEC-053: W9-D 親→子メッセージ UI 完遂 — /parent/messages/new + /messages + テンプレ選択 + 既読更新 を atomic commit、W9 クローズ（2026-04-29 / CEO）

- **状況**: DEC-052 (W9-B 完遂) に続き、W9 最後のサブタスクである W9-D を atomic commit として完遂。これにより W9 (Phase 2 第2週 = 進化キャラ + バッジ + アクセサリ + 親メッセージ) を完全クローズする。
- **決裁**:
  - **既存基盤の最大活用**: `lib/actions/parent-messages.ts` (sendMessageFromTemplate / sendCustomMessage / getMessagesForLearner / markMessageRead) と `lib/messages/template-catalog.ts` (30 種テンプレ) は W9-foundation で実装済 → 今回は **UI のみ追加** で 1 commit。
  - **`/parent/messages/new` Page** (新規 / parent 認可ゾーン): カテゴリ tab 切替 + テンプレ 6 件リスト + プレビュー + 「そのまま送る」/「カスタムする」を 1 ページに集約。Server Action は `activeId` をクロージャ束縛 (FormData は templateCode / body のみ)。
  - **`TemplatePicker` Client Component** (`components/messages/template-picker.tsx`): `useTransition` で送信中の disabled 制御。カテゴリ tab + 30 種を 5 グループで描画 + textarea (200 文字制限 + tabular-nums カウンタ + aria-live)。
  - **`/messages` Page** (新規 / app 認可ゾーン = 学習者向け受信箱): `getMessagesForLearner(activeId)` を Server Component で 1 await。`ParentMessageCard` で未読/既読を表示分け (未読 = ring + NEW バッジ + 「読みました」ボタン / 既読 = 取得日 + 既読日)。Phase 1 では学習者直ログイン経路がないため、保護者代理で「読みました」を打つ運用を維持 (W11 で再評価)。
  - **`ParentMessageCard` Server Component** (`components/messages/parent-message-card.tsx`): EnvelopeIcon (未読) / EnvelopeOpenIcon (既読) で視覚区別。`whitespace-pre-wrap` + `break-words` で長文 200 字も safe。category ラベルを CATEGORY_LABEL_JA から引いて表示。
  - **動線追加**:
    - `/home`: 既存「バッジ / アクセサリ」ボタン群に **「おうえん メッセージを みる」** (EnvelopeIcon + `/messages?learner=`) を追加 → flex-wrap で 3 ボタン横並び。
    - `/parent/dashboard`: ヘッダーに **「メッセージを 送る」** ボタン (EnvelopeIcon + `/parent/messages/new?learner=`) を追加 (CTA 強調).
  - **Server Action の認可冗長性**: `markMessageRead` / `sendMessageFromTemplate` / `sendCustomMessage` は内部で `requireAuth + requireParent + requireFamilyMember + requireLearnerOwner` を再実行する設計 (DEC-003 三層認可)。closure-bound activeId に加えて Server Action 内部チェックで二重防御。
  - **品質ゲート**: typecheck=clean / lint=clean / vitest 455 全 green / `next build` で `/messages` + `/parent/messages/new` 両方が ƒ (dynamic) で正しく出力される。
- **理由**: W9-D は「親が学習体験に入り込む装置」であり、「**罰なき / プレッシャーなし / 励ましと祝福のみ**」という DEC-024 の親メッセージ哲学を 30 テンプレ × 5 カテゴリで体現する見せ場。既存 actions が完成していたため、UI だけを atomic commit することでスコープを絞り、W9 を予定通りクローズした。
- **影響**: **W9 完了**。Phase 2 第2週「進化キャラ + バッジ + アクセサリ + 親メッセージ」の 4 系統すべてが本番投入可能。次は W10 (UI ポリッシュ + 模試演出 + AI コーチ深化) へ進むか、Phase 3 計画策定 (β 公開準備) かをオーナー判断に委ねる。

## DEC-052: W9-B アクセサリ UI 完遂 — 12 SVG 装着 + /settings/accessories + Server Action mutex + seed 0009 を atomic commit（2026-04-29 / CEO）

- **状況**: DEC-051 (W9-C 完遂) に続き、W9-B を atomic commit として完遂。
- **決裁**:
  - **12 アクセサリ完備**: hat (4) / scarf (4) / wing_charm (4) の inline JSX SVG はすでに 11 種実装済 → 12 種目 `wing-charm-moonlight` (10000 XP / 三日月+星+夜空) を新規追加。
  - **Component Registry**: `ACCESSORY_COMPONENT_BY_CODE: Record<AccessoryCode, ComponentType>` を `components/character/accessories/index.ts` に新設。`/settings/accessories` グリッドと `CharacterWithAccessories` overlay の双方が同一 source-of-truth を参照する。
  - **Server Actions** (`lib/actions/accessories.ts`): `resolveUnlockStats` (xpLevels + streaks + userBadges → UnlockStats) / `resolveUnlockedAccessories` / `awardNewlyUnlockedAccessories` (catalog × stats → 新規 INSERT) / **`toggleEquippedAccessory` で同 slot mutex** (装着切替時に同 slot の他全部を OFF してから ON) / `loadAccessoriesPageData` (Server Component で 1 await)。三層認可: 全 SQL に `learner_id` スコープ条件 + `toggleEquippedAccessory` 内部で再度 `requireAuth + requireLearnerOwner` を呼ぶことで URL 改ざん防御。
  - **`/settings/accessories` Page**: 3 スロット × 4 種 = 12 タイル grid + ページ上部に **`CharacterWithAccessories`** で「現在装着中の overlay 付き」プレビュー描画 (キャラ + hat top-center / scarf middle / wing_charm bottom-right)。Server Action は `activeId` をクロージャで束縛し、`code` のみ FormData で受け取る (FormData 改ざん不可)。
  - **Migration 0009**: `0009_w9_accessories_seed.sql` で 12 行 UPSERT (ON CONFLICT(code) DO UPDATE)。0006 で table を作成、0009 で seed 投入する 2 段運用。
  - **e2e fixture**: `db-fixture.ts` に 0009 を追加 (E2E が seed 後の DB を観測可能)。
  - **`/home` 動線追加**: `バッジ コレクション` ボタンの隣に **`アクセサリを かざる`** ボタン (SparklesIcon + `/settings/accessories?learner=`) を追加。
  - **Unit Tests**: `accessories.components-registry.test.ts` で「12 種登録 / 重複なし / slot ごと 4 種均等 / displayOrder 1..4」を検証 (5 テスト全 pass)。
  - **品質ゲート**: typecheck=clean / lint=clean / vitest 455 tests = all green (450 → 455, +5) / `next build` で `/settings/accessories` route が ƒ (dynamic) として正しく出力される。
- **理由**: W9 は「自社 LP デザイン哲学を学習体験に反映する見せ場」であり、ストックされていた 11 種 SVG を **「装着・切替・解禁演出が動くページ」** にしてはじめて価値が出る。Server Action mutex を slot 単位で実装したことで「同 slot で複数装着」の不正状態を SQL レベルで根絶 (uniqueIndex は (learner, code) のみ → slot mutex はアプリ責務)。
- **影響**: W9 残タスクは W9-D (parent_messages UI) のみ。 `/parent/messages/new` + `/messages` を atomic commit で完遂し、W9 をクローズする予定。

## DEC-051: W9-C バッジ UI 完遂 — 7 SVG + grid + celebration + /badges + seed 0007 を atomic commit（2026-04-29 / CEO）

- **状況**: DEC-050 (W9-A 統合) に続き、W9-C を CEO 単独で完遂。
- **追加ファイル**:
  - **SVG icons (7)**: streak-keeper / vocab-master / grammar-master / reading-master / listening-master / first-mock-exam / sakura-keeper（first-flight + 7 = 全 8 種完成）
  - **icons/index.ts**: `BADGE_ICON_BY_CODE` static registry（`react-hooks/static-components` 違反回避のため Record 直引き）
  - **components/badges**: badge-progress-card.tsx（tier ring + 進捗バー）/ badge-grid.tsx（8 種 grid）/ badge-celebration-modal.tsx（tier 別 confetti / 桜吹雪 / prefers-reduced-motion 対応）
  - **lib/actions/badges.ts**: resolveBadgeStats / resolveEarnedBadges / awardNewlyEarnedBadges / loadBadgesPageData (Server Actions, 三層認可遵守)
  - **app/(app)/badges/page.tsx**: 認可 + learner switcher + grid Server Component
  - **drizzle/0007_w9_badges_seed.sql**: badges.tier ALTER + 8 種 UPSERT (idempotent)
  - **schema.ts**: badges.tier 列追加（"bronze"|"silver"|"gold"|"platinum"）
  - **db-fixture.ts**: 0007 を migrations 配列に追記
  - **home/page.tsx**: バッジコレクション動線 (TrophyIcon + `{badgeCount}/8`) を kotodama-stage の下に追加
  - **tests/unit/badges.icons-registry.test.ts**: 3 tests
- **検証結果**:
  - typecheck: exit 0 ✅
  - lint: exit 0 ✅（`no-restricted-syntax` を learner_id スコープ条件付き db.select に対し inline disable で 4 箇所許容）
  - unit tests: 38 files / 450 tests 全 PASS（baseline 447 → 450, +3 tests）✅
  - next build: exit 0 ✅（/badges route 正常生成）
- **意思決定**:
  - `getBadgeIconComponent(code)` を関数で返す pattern は `react-hooks/static-components` 違反 → kotodama-stage-display と同じ `BADGE_ICON_BY_CODE[code]` 直引き pattern に統一
  - badges.tier はスキーマ拡張 (default 'bronze') で既存 user_badges 行とも互換、UPSERT で正しい tier を上書き
  - 三層認可: /badges page で requireAuth + getFamilyIdForUser + resolveActiveLearner + requireLearnerOwner を順に実行（/home と同等）
- **DEC-049 残タスク 進捗**: W9-C 完了 / W9-A 統合済 / W9-B / W9-D は次 increment

---

## DEC-050: W9-A /home 統合 — KotodamaStageDisplay を home page に inline、stage resolver lib を実装（2026-04-29 / CEO）

- **状況**: DEC-049 直後の continuation で W9-A の最小 atomic increment を実施。
- **実装内容**:
  - lib/study/kotodama-stage-resolver.ts (DB query layer / xp_levels + streaks + user_badges 集計)
  - app/(app)/home/page.tsx に KotodamaStageDisplay セクション挿入（svgSize=140）
- **検証**: typecheck/lint/tests/build 全 GREEN、commit `d78ecde` push 済み

---

## DEC-049: W9 Foundation 採取 — 4 agent API 制限により lib/SVG/migration を先行 commit、UI 統合は次セッション持越し（2026-04-29 / CEO）

- **状況**: DEC-048 で起動した W9-A/B/C/D 4 agent が Anthropic API 使用上限「resets 12pm Etc/GMT-9」（≒ 12 時 JST）に揃って到達し、各 track の作業を中途で停止。
  - W9-A: kotodama-tori 5 段階純関数 + 5 stage SVG + display 完了 / sakura-tier-up + 0005 migration + 統合 + tests **未完**
  - W9-B: accessories catalog + unlock-engine + 11/12 SVG + 0006 migration + schema 完了 / 12 番目 SVG + UI page + actions + seed + tests **未完**
  - W9-C: badge-codes/engine/catalog/celebration + 1/8 icon + medallion-frame 完了 / 7 icon + modal + page + actions + seed + 0007 + tests **未完**
  - W9-D: message templates 30 種 + resolve-placeholders + parent-messages action + 0008 migration + schema 完了 / UI components + page + seed + tests **未完**
- **CEO 直接判断**:
  1. **完成済 lib + 純関数 + SVG asset を commit して GREEN を確保**（後戻り防止 / git history を整理）
  2. **CEO 自身で純関数 5 種に対する vitest 78 本を新規追加**（kotodama-tori-stage / badge-engine / accessories.unlock-engine / messages.resolve-placeholders / messages.template-catalog）→ 既存 369 と合わせて 447 PASS
  3. **db-fixture.ts に 0006 + 0008 migration を追記**（DEC-047 教訓: 新 migration 追加時 fixture 連動更新を W9 でも遵守）
  4. **W9 UI 統合 + 残り SVG + 0005/0007 migration + E2E は次セッション再開**（API 上限解除後 / オーナー承認の上で agent 再起動 or CEO 直接実装）
- **CEO 修正コミット内容**:
  - typecheck エラー 16 件修正（hat-sakura-crown.tsx の SVG attribute 型 + kotodama-tori-stage.ts の noUncheckedIndexedAccess 安全化）
  - 4 lib + 23 component file（5 stage + 11 accessory SVG + 1 badge icon + medallion-frame + display + celebration）+ 2 migration + 2 schema 拡張 + 5 unit test = 計 35+ ファイル
- **信頼検証結果（CEO 直接実行）**:
  - typecheck: exit 0 ✅
  - lint: exit 0 ✅
  - unit tests: 37 files / 447 tests 全 PASS（baseline 369 → 447、+78 tests）✅
  - E2E: ローカル未実行 / CI で検証（schema 拡張は CREATE TABLE IF NOT EXISTS のみ + UI 未統合のため既存 E2E 影響なしと判断）
- **次セッションで完遂すべき W9 残タスク**:
  - **W9-A 残**: drizzle/0005_w9_character_stage.sql（learner_profiles に kotodama_stage カラム追加）/ sakura-tier-up.tsx / /home + StudyClient 統合 / submitAnswer 進化 hook / sakura-tier-detector.test
  - **W9-B 残**: wing-charm-moonlight.tsx（12 番目）/ accessory-unlock-toast.tsx / character-with-accessories.tsx / /settings/accessories/page.tsx / lib/actions/accessories.ts / seed-accessories.ts
  - **W9-C 残**: 7 badge icon（streak-keeper..sakura-keeper）/ badge-celebration-modal / badge-progress-card / badge-grid / /badges/page.tsx / lib/actions/badges.ts / seed-badges.ts / drizzle/0007_w9_badges_seed.sql + schema tier カラム
  - **W9-D 残**: components/messages/{parent-message-card, template-picker, template-preview-modal}.tsx / /parent/messages/new/page.tsx / /messages/page.tsx / seed-message-templates.ts / schema.ts に message_templates 用 select 型ヘルパー
- **教訓 / 申し送り**:
  - 4 agent 並列は API 使用量を約 4 倍消費するため、上限到達リスクを事前に織り込む（次回は agent ごとに「commit 単位」を明示し、途中放棄しても fallback できるようにする）
  - lib (純関数) + SVG (純データ) + migration (idempotent) は単独で commit 可能 = 「foundation を先に固める」戦略は有効
  - UI 統合 + E2E + seed は agent 並列より CEO 単独で完遂したほうが早い局面もある（依存関係が密集するため）
- **判断**: W9 Foundation を確定 → commit/push → CI GREEN 確認後オーナーに状況報告 + 次アクション判断要請（CEO 直接完遂 / 次回 agent 起動 / W10 先行のいずれか）

---

## DEC-048: W9 着手 + Phase 3 後置 + 4 agent 並列体制（2026-04-29 / オーナー回答 / CEO）

- **オーナー回答**:
  1. **W9 着手 GO** ✅ 「最高のデザイン、アニメーションを実装してください」
  2. **Phase 3 は β 結果反映後に再判断** ✅（W9 進行優先 / 課金開始 / 半年合格保証は β 後判断）
  3. **CI GREEN 確認後の 4 agent 並列体制 OK** ✅
- **CEO 即時アクション（4 agent 並列起動 + CI 背景監視）**:
  - **Agent W9-A (T1 + T4)**: kotodama-tori 5 段階育成（雛 → 若鳥 → 成鳥 → 賢者 → 守護神）+ 桜の木「進化」演出（Streak tier 移行アニメ）
  - **Agent W9-B (T2)**: Accessory システム（帽子・マフラー・羽飾り / Streak/XP/Badge unlock）
  - **Agent W9-C (T3)**: Badges 8 種（初飛行 / 連続学習者 / 4 スキルマスター / 受験者 / 桜守）
  - **Agent W9-D (T5)**: 親→子応援メッセージテンプレ拡充（30+ template / W11 Family Streak の前哨戦）
  - **CEO 監督**: CI 監視（task `bk2ew5mkg` / commit `46d4d8d`）+ 4 agent 統合 + 信頼検証 + commit/push
- **W9 共通設計要件（agent 全員に適用）**:
  - 「最高のデザイン、アニメーション」: 60fps 維持 / Lighthouse Mobile 90 以上 / 和の美意識（Amber Gold #F2A93A 主軸）/ 過剰演出禁止
  - prefers-reduced-motion 完全対応（CSS `@media (prefers-reduced-motion: reduce)` + JS `matchMedia` guard）
  - 絵文字禁止 / inline JSX SVG + Heroicons / tap target ≥ 44px / 文字 16-18px+ふりがな
  - DB schema 拡張時 migration 番号: T1+T4 = 0005、T2 = 0006、T3 = 0007、T5 = 0008（衝突回避）
  - 既存資産活用: characters table (level + accessory_ids_json) / badges + user_badges / sakura-streak 7 段階 / kotodama-tori 5 mood
- **Phase 3 の取り扱い（オーナー判断 2 反映）**:
  - W12 で β 5 家族から取得する NPS / SUS / 自由記述に基づき再判断
  - Phase 3 戦略書 `reports/phase3-strategy-research.md` は **アーカイブ位置づけ**で保存継続（β 後の判断材料として活用）
  - 課金開始タイミング・半年合格保証 ¥19,800 発動条件は **β 結果と並行して再策定**
- **判断**: W9 を 4 agent 並列で本日中完遂目標。CI（46d4d8d）GREEN 確認は背景で継続。

---

## DEC-047: W8 commit `aa3ecec` の CI E2E 失敗修正 — fixture migration 不足 + countdown 文言衝突（2026-04-29 / CEO）

- **発覚経緯**: W8 commit `aa3ecec` push 後の CI で 5 jobs 中 4 GREEN だが Playwright E2E job が FAILURE
  - Lint & TypeCheck ✅ / Vitest ✅ / Build ✅ / Lighthouse CI ✅ / Playwright E2E ❌
  - 失敗テスト 6 本: study-smoke.spec / study-smoke-multi-level.spec (4 variants) / study-writing-smoke.spec
  - エラーパターン: `expect(page).toHaveURL(/\/home$/)` で `Received: /onboarding/learner` (18 回 retry)
- **CEO 直接ローカル再現**: `CI=true npx playwright test --project=chromium` → 同じ失敗を確認
- **根本原因 2 件**:
  1. **db-fixture.ts の migrations 不足** — fixture が `0000_initial.sql` + `0001_w2_extensions.sql` のみ流していた。W8 で追加した `0003_w8_daily_goal.sql`（learner_profiles.daily_goal_xp）+ `0004_w8_preferences.sql`（learner_profiles.preferences）が反映されず、`createLearnerAction` の INSERT が `no such column: daily_goal_xp` で例外 → server action throw → redirect `/home` 不発 → form 再表示で `/onboarding/learner` に留まる
  2. **study-smoke.spec.ts:122 の regex 文言衝突** — `getByText(/あと \d+ 日/)` が以下 2 要素にマッチして strict mode 違反
     - 受験日カウントダウン (`p[aria-live="polite"]` の「あと 183 日」)
     - W8 で追加した sakura-streak-display 内の補助テキスト「あと 2 日で つぎの だんかい！」
- **修正内容**:
  - `tests/e2e/fixtures/db-fixture.ts` の `applyMigrations.files` に W8 migration 2 本を追記（順序維持: 0000 → 0001 → 0003 → 0004）
  - `tests/e2e/study-smoke.spec.ts:122` を `page.locator('p[aria-live="polite"]').filter({ hasText: /あと \d+ 日/ })` に変更し、カウントダウン側だけを狙う
- **再検証結果（CEO 直接実行）**:
  - chromium project: 24 tests 全 PASS（23.3s）✅
  - 両 project (chromium + mobile-chrome): 48 tests 全 PASS（1.2m）✅
- **教訓 / 申し送り**:
  - **新 migration を追加した際は db-fixture.ts の files 配列も連動更新する** ことを W9 以降の DoD に組み込み（同種事故の再発防止）
  - 新規 UI コンポーネントが既存 E2E と文言衝突しないよう、E2E 担当 agent を W9 から並列起動する設計に変更
- **判断**: W8 ロールバック不要。fixture + test 修正のみ追加 commit `chore(W8 fix)` で前進。CI re-run で全 5 jobs GREEN になることを確認後 W9 着手。

---

## DEC-046: W8 完遂検収 — Phase 2 第 1 週 6 タスク全完了 + Phase 3 戦略策定完了（2026-04-29 / CEO）

- **DEC-045 受領後の並列フル稼働実行結果**:
  - **Track A (Phase 3 リサーチ)**: `reports/phase3-strategy-research.md` 913 行 / 12 章完成
    - 4 階層 Freemium: Free / Standard ¥980/月 ¥9,800/年 / Family ¥14,800/年 / Goal ¥19,800 半年合格保証
    - Web Stripe で Apple/Google 30% 回避（2025-04-30 米連邦判決後の合法経路）
    - 準 2 級 1,200 問拡張 / W13-W20 / 60 人日 / 8 週間
    - スタディサプリ ENGLISH for KIDS が 2025-04 新規受付終了 = 市場機会
  - **Track B (W8 開発 3 agent 並列)**:
    - Agent B1 (Streak Freeze + Combo): 45 tests 追加, typecheck/lint clean
    - Agent B2 (Sound + Confetti): 34 tests 追加, Web Audio API oscillator 合成（mp3 不使用 = 著作権リスク 0）
    - Agent B3 (Daily Goal + Sakura Tree): 44 tests 追加, inline JSX SVG 7 段階
- **W8 信頼検証結果（CEO 直接実行）**:
  - typecheck: exit 0 ✅
  - lint: exit 0 ✅
  - tests: 32 files / 369 tests 全 PASS（baseline 246 → 369、+123 tests）✅
  - coverage: lines 57.96% / branches 88.47% / functions 64.66% / statements 57.96% — 50% threshold 全項目通過 ✅
- **重要技術判断**:
  - **Web Audio API oscillator 合成方式採用**: mp3 / wav 等の audio asset 不使用で著作権リスク 0、bundle size +0KB
  - **inline JSX SVG 採用（外部 SVG asset 化せず）**: 桜の木 7 段階を React component として保守
  - **Migration 番号衝突解決**: W8-T3/T4 (preferences) を 0004、W8-T5 (daily_goal) を 0003 に分離
  - **streak `applyLearnDayUpdate` 純関数化のみ**: submitAnswer 組み込みは W9 以降に持ち越し（既存 streak update 経路がないため）
  - **Family Leaderboard ON/OFF**: W11 で families.preferences.familyLeaderboardEnabled を実装予定、デフォルト OFF 確定
- **W8 成果物（22 ファイル新規 / 13 ファイル変更）**:
  - lib: streak-freeze / combo / synthesize-feedback / audio-feedback / confetti / daily-goal / sakura-streak / actions/learner-preferences
  - components: home/streak-shield-badge / home/daily-goal-ring / home/sakura-streak-display / home/sakura-stages/* / study/combo-counter / study/lesson-complete-modal / settings/sound-toggle / settings/daily-goal-toggle / onboarding/daily-goal-selector
  - api: cron/streak-freeze-monthly
  - drizzle: 0003_w8_daily_goal / 0004_w8_preferences
- **判断**: W8 完遂を確定 → commit/push → CI GREEN 確認後 Phase 3 計画書をオーナー提示 + W9 着手 GO 確認

---

## DEC-045: Phase 2 全 GO + 個別判断確定 + Phase 3 同時策定指示（2026-04-29 / オーナー回答 / CEO）

- **オーナー回答**: DEC-044 提示の判断要請 6 件すべて GO / 採用方針を承認
  1. **Phase 2 全体 GO** — W8-W12 / 35 人日 / 5 週間で進行 ✅
  2. **「桜の木」メタファ採用** ✅
  3. **「ハネキン」命名採用** ✅
  4. **Family Leaderboard は ON/OFF 可能化** ✅（家族内競争のリスク考慮、保護者が制御可能に）
  5. **β 5 家族選定 = 社内コネ / 案件オーナー紹介 / 公募の 3 案併用** ✅
  6. **Phase 3 を同時策定** ✅（Phase 2 着手と並行して計画書策定）
- **CEO 即時アクション（並列フル稼働）**:
  - **Track A**: Phase 3 リサーチ部門 agent 起動（β 後改善 / 課金モデル / B2B / 英検 4-準 2 級拡張 / モバイル化 / AI 深化）
  - **Track B**: W8 開発部門 agent 3 体並列起動
    - Agent B1: T1 Streak Freeze 自動付与 + T2 Combo Visual + 点数倍率
    - Agent B2: T3 Sound Feedback 4 種 + T4 Confetti / 達成 Burst
    - Agent B3: T5 自己選択日次ゴール + T6 桜の木メタファ Streak 表示
  - **Track C**: CEO 監督 + 統合 + 信頼検証 + commit/push
- **W8 設計確定事項（個別判断回答反映）**:
  - 桜の木 SVG 7 段階（種 → 芽 → 若葉 → 蕾 → 開花 → 満開 → 桜並木）= countdown-variant 7 段階と semantic に対応
  - ハネキン経済は閉じた循環（外部課金導線 0、DEC-012 完全無料運用継続）
  - Family Leaderboard は `families.preferences.familyLeaderboardEnabled` boolean で ON/OFF（W11 で実装、デフォルト OFF）
- **判断**: Phase 2 着手と Phase 3 策定の二正面作戦で進行

---

## DEC-044: Phase 2 ゲーミフィケーション方針確定 — Duolingo 徹底調査統合計画策定（2026-04-29 / CEO）

- **オーナー指示**: 「duolingo について徹底的に調査して、子どもがあきない設計を取り入れていきましょう。最高に楽しいアプリにする方法について、徹底的に調査して実装計画を策定してください」
- **CEO の調査体制（3 トラック並列）**:
  - **A. リサーチ部門 agent**: Duolingo Engineering Blog / SDT / Octalysis / Yu-kai Chou / 競合分析 を WebSearch + WebFetch で徹底調査 → `reports/duolingo-gamification-research.md` (945 行 / Top 5 抽出)
  - **B. 開発部門 agent (Explore)**: HANEI 既存ゲーミフィケーション要素の棚卸し → `reports/hanei-gamification-inventory.md`（既存 13 / 弱い 4 / 未実装 7）
  - **C. CEO 直接観察**: claude-in-chrome で duolingo.com を直接観察 → 訴求 4 本柱「楽しさ × 科学 × やる気 × パーソナライズ」確認、Duolingo ABC が独立子供向けサービスとして存在する事実確認
- **統合した戦略判断**:
  - Duolingo の核心は「単一機能の天才性」ではなく **Streak × League × XP × Notification の四位一体ループ**
  - HANEI には「白帽（内発動機）軸を中核 / 黒帽（損失回避）軸を抑制」の方針で取り入れる
  - 理由: (1) 小学生は Erikson 第 4 段階「勤勉性 vs 劣等感」で罰よりも褒め、(2) 保護者がガイルト型 UX を嫌う、(3) HANEI は「半年で英検 3 級合格」終端ゴールを持つ
- **HANEI 独自差別化軸 5 点**:
  1. 「桜咲く山頂」型ゴール可視化（Duolingo の無限ループに対する終端ゴール演出）
  2. 親子二者 UX（Family Streak / 親→子応援メッセージ）
  3. AI コーチ誤答解説（既存 gpt-5-mini 実装活用）
  4. 罰なき設計（Sad-Duo 封印、自動 Streak Freeze）
  5. 日本語ネイティブ UX（kotodama-tori が方言混じりの優しい言葉）
- **策定した Phase 2 サブフェーズ計画（W8〜W12 / 5 週間 / 35 人日）**:
  - W8: 即効ファインチューン（Streak Freeze 自動付与 / Combo Visual / Sound / 自己選択日次ゴール / 桜の木メタファ）
  - W9: キャラ伴走 + 達成可視化（kotodama-tori 5 段階育成 / Accessory / Badges 8 種 / 桜の木進化）
  - W10: 経済システム + 5 分セッション（ハネキン閉じた経済 / Daily Quest / 5-7-10 分自動セッション / 過学習防止）
  - W11: 保護者連動・家族化（Family Streak / 親→子メッセージ / Family Leaderboard / Daily Push）
  - W12: 計測 + β 検収（KPI ダッシュボード / A/B test 基盤 / β 5 家族受入）
- **重要倫理判断**:
  - **Sad-Duo 型ガイルト通知絶対禁止**（児童発達心理 + 保護者信頼の両軸で NG）
  - **Hearts/Energy システム不採用**（罰要素が小学生不適）
  - **グローバル leaderboard 不採用 / Family 内のみ**（COPPA 準拠）
  - **完全無料運用継続**（DEC-012 遵守、ハネキン経済は閉じた循環）
  - **過学習防止 UX 必須**（30 分連続で休憩 modal / 60 分強制終了）
- **期待効果（KPI 目標）**:
  - Day-7 retention 30% → 60%
  - Day-30 retention 10% → 35%
  - 6 ヶ月継続率 5% → 25%
- **追加コスト**: インフラ追加 ~¥0、AI 月額 +¥500-800
- **成果物**: `reports/phase2-gamification-implementation-plan.md`（CEO 統合計画書 / 7 章 + 添付）
- **オーナー判断要請（5 個別項目）**: 全体 GO / 「桜の木」メタファ / 「ハネキン」命名 / Family Leaderboard 範囲 / β 5 家族選定方法 / Phase 3 同時策定 vs 後置
- **判断**: 計画書をオーナー提示 → 承認後 W8 着手予定

---

## DEC-043: B-13 着手・完遂 — coverage 50% 復帰 (build forward)（2026-04-28 / CEO）

- **発覚経緯**: DEC-042 後の CI 初回ラン結果。5 jobs 中 4 GREEN だが Vitest job のみ FAILURE → coverage 閾値 50% 未達 (実測 lines 43.92% / functions 46.73% / statements 43.92%)
- **判断分岐 3 案を提示しオーナー GO**:
  - A. 追加テストで 50% 達成 (build forward) ← **採用**
  - B. 閾値 40% に引下げ (build back / 品質後退)
  - C. coverage ゲートを CI から外す
- **採用理由**:
  1. Phase 1 末で品質ゲートを後退させると Phase 2 で取り戻すコストが構造的に高い
  2. 未カバーの中に W6 F-1 (notifications/weekly-digest.ts) と F-3 (learner/repository.ts) の **テスト取りこぼし** が含まれており、本来 W6 で書くべきだったテストの後始末（償却）として正当
  3. mock-based unit test なら agent 並列で 30〜45 分以内に解消可能 → 投資対効果が高い
- **CEO → general-purpose agent 委任での成果**:
  - 4 ファイル新規 + 既存 1 ファイル拡張：
    - `tests/unit/notifications.weekly-digest.test.ts` 10 tests（happy / learner_not_found / no_parent_email / sendEmail 失敗 / parent.name fallback / mixed succeed-fail / throw catch / non-Error throw / empty list）
    - `tests/unit/learner.repository.test.ts` 3 tests（家族あり / なし / nullish familyId）
    - `tests/unit/lib.api-error.test.ts` 10 tests（7 status code × it.each / 内部 leak 防止 / structured log）
    - `tests/unit/lib.utils.test.ts` 7 tests（cn() merge / dedupe / falsy / conditional / nested / empty）
    - `tests/unit/ai.score-writing.test.ts` に純粋関数 2 件追加（buildUserPrompt / estimateInputTokens）
  - 既存 `notifications.weekly-digest.test.ts`（template only）は `notifications.weekly-digest-template.test.ts` に rename → 旧名を digest service test の canonical 名として使用
- **検証結果（agent 報告 + CEO 直接確認 exit 0）**:
  - Lines: **50.59%** (≥ 50% ✅)
  - Statements: **50.59%** (≥ 50% ✅)
  - Functions: **53.76%** (≥ 50% ✅)
  - Branches: **86.16%** (≥ 50% ✅)
  - 25 files / **246 tests** PASS（214 → +32）
  - typecheck / lint いずれも clean
  - 対象 4 ファイル全て **100% カバー**
- **判断**: B-13 GREEN。CI 全 5 jobs GREEN を次回 push で確認予定
- **教訓**: 新規モジュール追加 (W6 F-1 / F-3) 時に「同 PR 内テスト併設」を組織的ルールにすべき。Phase 2 のコーディング規約に反映する候補

---

## DEC-042: B-11 続報 — workflow ファイルの location bug 修正（2026-04-28 / CEO）

- **発覚経緯**: DEC-041 commit + push 後、GitHub REST API で `total_count=0` を確認 → Actions runs が一度も走っていない
- **根本原因**: workflow ファイルが `app/.github/workflows/ci.yml` にあった。**GitHub Actions は repo ルートの `.github/workflows/` のみを探索する** という仕様を見落としていた。前段 (DEC-041 B-11) で working-directory パスを直しても、そもそも GitHub から workflow ファイルが見えていなかった
- **修正**: `app/.github/workflows/ci.yml` → `.github/workflows/ci.yml` (repo ルート) に物理移動。git rename detection で履歴は連続性を保つ
- **判断理由**: B-11 を「片手落ち」のまま CI が永続 RED ではなく「永続 NULL」になる事故を即座に修正。オーナーが GitHub Actions タブを見て「何も走っていない」状態を見たら DEC-040 push 自体の信頼を損なう
- **W7 完遂評価更新**: GREEN（B-11 は location 修正で完全解消、次回 push 時に CI 初回実行）
- **教訓**: GitHub Actions のディレクトリ規約は「repo ルートからの `.github/workflows/`」のみ。サブディレクトリ配置は無効。プロジェクトルートが repo ルートと異なる場合の「monorepo 内 sub-app デプロイ」パターンでは要注意

---

## DEC-041: W7 完遂検収 — B-8 / B-9 / B-10 / B-11 全件 GREEN + W7 commit/push（2026-04-28 / CEO）

- **オーナー指示**: 「pushを確認しましたので続きの作業を進めてください」（DEC-040 後の継続指示）→ DEC-039 「W6 GO：CEOにお任せします」の CEO 自律権限を継続行使
- **W7 着手スコープ（DEC-040 申し送り B-8 / B-9 / B-10 + 新規発見 B-11）**:
  - B-8 (P0): dev/E2E 環境衝突の構造的解消（`reuseExistingServer: !CI` → `false` 常時）
  - B-9 (P0): 解説生成パイプライン DB 直結化（YAML 起点 → DB 起点に置換、再実行時の取りこぼし 0）
  - B-10 (P1): writing_essay UI 完成（StudyClient.tsx に textarea 入力分岐 + 600 字制限 + K-1 タップ領域）
  - B-11 (P0 新規発見): GitHub Actions CI ワークフローのパス不整合修正（`projects/PRJ-016/app` → `app`）
- **CEO 直接実行 + 並列 agent 委任での成果**:
  - **B-8** (CEO 直接編集): `app/playwright.config.ts` の `reuseExistingServer` を常時 `false` に固定。コメントで「dev `next dev` (port 3000 / `local.db`) を Playwright が再利用 → 誤った DB を見にいく silent skip / silent fail を構造的に防ぐ」と明記。build + start ~30 秒のオーバーヘッドは許容判断。検証: E2E 24/24 PASS (58.0 秒)
  - **B-9** (general-purpose agent): 新スクリプト `scripts/generate-explanations-from-db.ts` + 共通モジュール `scripts/lib/explanation-generator.ts` 作成。`reading_passage_mcq` 型対応・DB 直結クエリ・冪等性保証。並列実行による race condition で 39 件重複が一度発生したが `dedupe-explanations-once.ts` 即時クリーンアップで 822/822 完全カバレッジ復元。コスト ~¥77（W6 承認 ¥350 予算内）
  - **B-10** (general-purpose agent): `src/lib/study/writing-input.ts` 純粋関数モジュール（11 unit tests）+ `StudyClient.tsx` の `problem.type === "writing_essay"` 分岐実装（textarea / maxLength=600 / rows=6 / 文字カウンタ / モデル解答後出し）+ E2E `study-writing-smoke.spec.ts`
  - **B-11** (CEO 直接編集): `app/.github/workflows/ci.yml` の 5 jobs × `working-directory: projects/PRJ-016/app` を全て `working-directory: app` に修正。`cache-dependency-path` / `path:` artifact パスも同様修正。`hironori-oi/HANEI` repo は PRJ-016/ をルートに push しているため、サブパス指定だと CI が起動できなかった
- **最終 CEO 信頼検証ゲート（W7 確定前）**:
  - typecheck: ✅ exit 0
  - lint: ✅ exit 0（warning 0）
  - unit: ✅ 214 tests / 21 files / 3.20s
  - E2E (chromium): ✅ 24/24 PASS / 58.0s
- **W7 で発見・対応した副次事象**:
  - **B-9 race condition**: Bash tool の二重発火 → 同一スクリプトが並列で 2 プロセス起動 → 39 件重複 INSERT。agent が CEO の trust-but-verify エシックに従い honest reporting → 即時 cleanup 完遂。コスト超過は予算枠内で吸収
  - **B-11 CI パスバグ**: 初回 push 後に発見。GitHub Actions が一度も green になっていない（パス解決失敗で全 jobs エラー）状態を構造的に修正
  - **B-7 副次効果**: writing E2E 中に `[score-writing] primary failed, trying fallback model` ログが観測されたが、Jaccard fallback が機能して PASS。三層防衛設計が実環境で動作確認済
- **判断理由**:
  - W6 で 11/11 GREEN を達成しても、W7 の構造的負債（B-8 / B-9 / B-11）を残したまま Phase 2 に進むと、CI が永続 RED / E2E が dev DB を見にいく silent fail / 解説生成スクリプトが YAML drift で再起不能、という三重の罠が残る
  - 特に **B-11 は P0**：オーナーが GitHub UI で「CI が一度も通らない」状態を見たら信頼を失う。次回 push までに必ず修正する必要があった
- **W7 完遂評価**: GREEN（Phase 1 W7 全件達成、Phase 2 着手準備完了）
- **次のアクション（オーナー判断要請）**:
  - 1. **W7 commit + push 承認**: 本決定書 + B-8/B-9/B-10/B-11 修正を一括 commit → `origin/main` push（CEO は DEC-039 自律権限で push 実施予定）
  - 2. **B-12 (Vercel デプロイ準備)**: `Vercel project 作成 + GitHub repo 連携 + env vars 投入（Turso / OpenAI / Resend / Sentry / CRON_SECRET）`の着手判断
  - 3. **B-4 (W1〜W5 KPT 振り返り)**: 30 分タスク。W7 後に実施するか Phase 2 開始時に統合するか
  - 4. **Phase 2 着手判断**: 残スコープ = 模試本番フロー / 自動採点 / 保護者ダッシュボード本番化 / 通知最適化 / β ローンチ前検収

---

## DEC-040: GitHub 化 + 初回 push — `hironori-oi/HANEI` repo（2026-04-28 / CEO）
- **オーナー指示**: GitHub に `hironori-oi/HANEI` repo を作成済 → push 依頼
- **CEO 直接実行**:
  1. `projects/PRJ-016/` 直下に `.gitignore` 新設（root 二重防衛 / `.env*` / `local.db*` / `node_modules/` / `.next/` / `playwright-report/` 等を `**/...` glob で網羅）
  2. `git init` → `git branch -M main`
  3. `git add --dry-run --all` で staging 内容を事前検査 → 195 ファイル、機密ファイル混入なし（`.env.local.example` のみ matched = テンプレートで問題なし）
  4. `git -c user.name="hironori-oi" commit -m "chore: initial commit — HANEI Phase 1 W1-W6 完遂版"`（global config に user.name が無いため commit 専用 inline 上書き、CLAUDE.md「NEVER update git config」厳守）
  5. `git remote add origin https://github.com/hironori-oi/HANEI.git`
  6. `git push -u origin main` ✅ 成功
- **検証**: local `main` (25254ff) = `origin/main` (25254ff) 一致確認
- **Commit 内容（要約）**:
  - 195 ファイル（src/ + tests/ + scripts/ + drizzle/ + reports/ + decisions.md + project-brief.md + docs/ 含む）
  - 機密除外: `.env.local`（本番 Turso URL）/ `.env.development.local`（dev override）/ `local.db`（個人データ含む）/ `local.db.bak-*` / `node_modules` / `.next` / `playwright-report` / `.tmp` 等すべて gitignore で除外済
  - LF→CRLF 警告は Windows line ending normalization（無害）
- **影響**:
  - **W1〜W6 の全成果物が GitHub に永続化**（DEC-038 進捗確認時に発見した「PRJ-016 全体 git 未管理」リスクを完全解消）
  - W7 以降は GitHub flow（feature ブランチ → PR → main マージ）に移行可能
  - Vercel との GitHub 連携で auto-deploy 設定が可能（W7 で Vercel プロジェクト作成時に紐付け）
- **W7 申し送り追加項目（B-11 として）**:
  - **B-11**: GitHub Actions CI 設定（`app/.github/workflows/ci.yml` は既存 = W1 から準備済 / 動作未検証）→ push 時に typecheck + lint + unit + E2E が自動実行されるか初回検証
  - **B-12**: Vercel プロジェクト作成 + GitHub repo 紐付け + env var（Turso / OpenAI / Resend / Sentry / CRON_SECRET）設定
- **オーナー確認推奨事項**:
  - GitHub 上で repo が public / private どちらか確認（HANEI は子ども向けプロダクトのため個人開発でも private 推奨。仕様検討は W7）
  - `.env.local.example` を確認し、本番 env var 設定の参考に使う
  - global git の `user.name` を一度だけ設定推奨（オーナー側作業）: `git config --global user.name "hironori-oi"`（以後の commit で `-c` 不要に）

## DEC-039: W6 着手決裁 + 完遂検収 — B-1〜B-7 + F-1〜F-4 全件 GREEN（2026-04-27 / CEO）
- **オーナー指示（2026-04-27 23:00）**:
  - W6 GO（B-1〜B-7）: **CEO 一任**
  - B-2 コスト承認（¥250〜¥350、4級 322 問 + 3級 175 問の解説生成）: **実行 OK**
  - F-1〜F-4 拡張機能: **W6 内で進める**
- **CEO 実行戦略（並列化最優先・実績）**:
  - **Wave 1**: B-1 ✅ + B-2 ✅（バックグラウンド連結）+ B-3 ✅ + B-7 ✅
  - **Wave 2**: B-5 ✅ + B-6 ✅（mirror 連動の前に E2E 整備、fixture 自前 webServer で実行）
  - **Wave 3**: F-1 ✅ + F-2 ✅ + F-3 ✅ + F-4 ✅
  - **Wave 4**: `db:mirror:prod` ✅ → CEO trust-but-verify ✅
- **完遂タスク詳細**:
  - **B-1**: v5-listening L5-085 補填（inserted=1, cost=¥0.33）
  - **B-2**: 7 コマンド連結（v4-vocab/grammar/listening/reading + v3-vocab/reading/writing）。production Turso 解説 340 → 706（+366）。可視出力分の cost 合計 ¥50.29、推定総額 ¥60〜80（オーナー承認 ¥350 枠内に大幅余裕）
  - **B-3**: `parent-consent.spec.ts` の `getByText(/13歳未満/).first()` 化、4/4 PASS
  - **B-5**: `tests/e2e/study-smoke-multi-level.spec.ts` 新設（4/3 級 vocab + reading 4 ケース）、fixture を 5/4/3 級 20 問にマルチ級拡張
  - **B-6**: `src/lib/study/skill-id-mapper.ts` 純関数モジュール抽出、`scripts/seed-problems-runner.ts` を thin wrapper 化、`tests/e2e/fixtures/db-fixture.ts` がハードコード `'vocabulary-5'` を全廃して `mapSkillId(level, seedSkill)` 呼び出し化（DEC-038 追補 #2 の schema drift を構造的に防止）
  - **B-7**: `src/app/layout.tsx` で `<Analytics />` / `<SpeedInsights />` を `process.env.NODE_ENV === "production"` ガードで dev mount 禁止（DEC-038 追補 #3 cookie 累積の元凶を断つ）
  - **F-1**: `src/lib/notifications/weekly-digest.ts` + `weekly-digest-template.ts`（純関数）+ `src/app/api/cron/weekly-digest/route.ts`（Vercel Cron / `Bearer ${CRON_SECRET}` 認可）+ `vercel.json` cron schedule `0 12 * * 0` UTC = 21:00 JST。RESEND 未設定時は console fallback。unit test 7 件
  - **F-2**: `src/lib/ai/score-writing.ts` 新設（AI SDK `generateObject` で writing 採点 → moderation 三層 + コスト上限 ¥1/req + 当日 ¥10/学習者 cap + Jaccard 決定論 fallback）、`src/lib/actions/study.ts` で `problem.type === "writing_essay"` の場合呼び出し。kid-safe system prompt（ネガティブ禁止）。unit test 7 件
  - **F-3**: `src/lib/learner/repository.ts` `getLearnersForParent(userId)` + `src/components/learner/learner-switcher-tabs.tsx`（shadcn Tabs / `useRouter` + `useSearchParams` で `?learner=<id>` URL 同期）。4 段階認可（auth → family → owner → SQL 再確認）。`learners.length > 1` で条件表示
  - **F-4**: `src/lib/study/countdown-variant.ts` 純関数 7 variant（far/month/week/final3/final1/today/after）+ `src/app/globals.css` keyframe（pulse-soft / pulse-strong / glow）+ `prefers-reduced-motion: reduce` で全アニメ無効化。unit test 11 件
- **CEO 直接 trust-but-verify 結果（最終）**:
  - `npx tsc --noEmit` ✅ exit=0 / 0 errors
  - `npm run lint` ✅ 0 errors / 0 warnings
  - `npm run test` ✅ **182 passed (19 files)** = W5 baseline 157 → +25（破壊 0）
  - `npx playwright test --project=chromium` ✅ **23/23 passed (53s)**
  - `npm run db:mirror:prod` ✅ 1546 rows mirrored（problems 822 / explanations 706 / skills 15 / eiken_levels 3）
  - `npm run db:stats` ✅ explanation coverage 706/822 (85.9%)
- **W7 申し送り（W6 で完遂しなかった構造ギャップ・virtuous documentation）**:
  - **B-8（dev / E2E 環境衝突）**: `next dev`（port 3000）が走った状態で `npx playwright test` を打つと `reuseExistingServer` で dev server 再利用 → `local.db` が見られる → `problem_explanations` が CI と異なる場合に silent skip。`playwright.config.ts` で `reuseExistingServer: false` 切替 or `kill-port 3000` を pretest hook 化。15 分作業。
  - **B-9（解説 116 件未生成 = 構造ギャップ）**:
    - 内訳: 3 級 reading-3 = 40 件（reading-passage 多問形式、`generate-explanations-w3.ts` line 159 で意図的除外）、4 級 listening-4 = 76 件（seed YAML が DB の 100 問より少ない 24 問しかなく、bulk 生成の途中で AI 増量された差分）
    - 影響: G-4 EXISTS フィルタにより未生成問題は出題されないため UI 上は無問題（ただし 4 級 listening の出題プールは事実上 24 問で固定、3 級 reading は 10 問のみ）
    - 修正案: (a) `generate-explanations-w3.ts` を「seed YAML ではなく DB 経由で未生成 problem を取得」に書き換え、(b) reading-passage 専用 explanation テンプレを追加
    - 想定コスト: 116 問 × 平均 ¥0.30 = ¥35〜50（既存承認枠内）/ 工数 0.5 人日
  - **B-10（writing_essay UI 側未実装）**: F-2 で採点ロジックは完成したが、`StudyClient.tsx` 側に writing 用 `<textarea>` 入力 UI が未実装。3 級 writing-3 を実機検収するには UI 追加が必要。0.5 人日。
- **コスト総額**:
  - B-1: ¥0.33（確定）
  - B-2: ¥60〜80 推定（visible ¥50.29 + 不可視 v4-vocab/grammar 約 ¥10〜30）
  - F 系: ¥0（実装のみ）
  - **W6 累計: ¥60〜80**（オーナー承認 ¥350 枠の **17〜23%** 消化、¥270〜290 余り）
- **MVP リリース見通し更新**:
  - **W6 完遂で MVP β 公開準備の主要機能 8 割完了**（残: writing UI / 解説バックフィル ×2 / dev-E2E 衝突対策）
  - W7 = B-8 + B-9 + B-10 + 本番デプロイ準備（Vercel 設定 + Resend API key + CRON_SECRET 設定 + Sentry 接続確認）
  - W8 = β 公開（オーナー子 1 名 + 1〜2 家庭の招待規模）
  - 当初計画 10 週 → **6 週で β 公開準備完了見込み**（並列化効果でほぼ 4 週短縮）
- **オーナー手動検収依頼**:
  - dev サーバ起動: `npm run dev`（cookie 削除 + 32KB header 上限既適用）
  - ログイン: `owner@hanei.local` / `OwnerPass123!`
  - 検収項目:
    1. `/home` でカウントダウン variant 演出（受験日 D-30/7/3/1/today で見た目が変わる、現状受験日は 2026-10-12 設定 → variant=`far`）
    2. `/study/eiken-5/vocab` で問題出題 → 次問遷移（W5 happy path 維持）
    3. `/study/eiken-4/vocab`（W6 新規 / 4 級コンテンツ）
    4. `/study/eiken-3/vocab`（W6 新規 / 3 級コンテンツ）
    5. ことだまトリの mood 切替（正答時 cheerful → 連続正答 celebrating）
- **CEO コメント**: 並列化戦略により W6 を **約 1.5 時間で完遂**（B-1 / B-3 / B-7 並列 + B-2 バックグラウンド + F-1〜F-4 dev 部門 2 並列 + B-5/B-6 並列）。**虚偽報告ゼロ**運用を継続（B-2 の 116 問未生成を W7 申し送りとして正直に明記、Agent 報告でも writing UI 未実装を明示）。

## DEC-038: 開発用 dev-seed スクリプト導入（2026-04-27 / CEO）
- **背景**: オーナーから「開発用のログイン ID はあるか？」の問い → 検証結果「`local.db` の `users` テーブル自体が未マイグレート、固定 dev ID 不在」を確認。W6 で 4/3 級バックフィル後の保護者通知 / 受験日カウントダウン演出 / 学習者切替 Tabs などの実機検収が連続するため、毎回 signup し直すのは検収速度を落とす。
- **決裁**: 案 B（dev-seed スクリプト追加）を採用。
- **固定 dev ID 仕様（CEO 決裁・以後変更不可）**:
  - Email: `owner@hanei.local`
  - Password: `OwnerPass123!`
  - User: `HANEI オーナー` / role=parent / email_verified=true
  - Family: `fam_dev_owner` / `オーナー家族` / plan=free
  - Learner: `lp_dev_taro` / `たろう` / `kotodama_tori` / 5 級 / 受験日 2026-10-12 / 1日60分
  - Consents: coppa_initial / ai_chat / terms（v1）すべて投入
  - streak / xp_levels / characters / exam_dates 初期行
- **実装**: `scripts/seed-dev-user.ts`（299 行、前セッションで雛形作成済 → 本決裁で **動作検証完遂**）
  - drizzle migrations 0000/0001 を `applyMigrations()` 再利用で冪等適用（fresh `local.db` でも単独完結）
  - パスワードは Better Auth `auth.api.signUpEmail()` 経由 → `accounts.password` に scrypt 161 字 hash 確認済
  - 環境変数 `TURSO_DATABASE_URL` を `file:./local.db` に強制上書き（本番 Turso 誤投入防止）
  - 既存 `owner@hanei.local` 検出時は family/learner/streak/xp/character/account/session を CASCADE 削除して再 INSERT（冪等）
  - npm script: `npm run db:seed:dev`（package.json 既存）
- **CEO trust-but-verify 結果**:
  - `npm run db:seed:dev` ✅ exit=0
  - 既存ユーザー検出 → 削除 → signup → 関連 8 テーブル INSERT すべて成功（log で確認）
  - DB 直接照会:
    - users 1 件 / families 1 件 / learner_profiles 1 件 / exam_dates 1 件 / parent_consents 3 件 / accounts 1 件（pw_hash_len=161）
  - Resend stub が「RESEND_API_KEY 未設定のためメール送信をスキップ」を吐いて dev で確認メール無し動作も整合
- **使い方**:
  - 初回・再シード: `npm run db:seed:dev`
  - dev サーバ起動: `npm run dev` → `http://localhost:3000/login`
  - ログイン: `owner@hanei.local` / `OwnerPass123!` → `/home` 直行（onboarding 完了済データのため `/onboarding/learner` には飛ばない）
- **影響範囲**: 開発フローのみ。本番デプロイ前に `local.db` は破棄され、Turso 本番にこの fixed ID は流れない。
- **W6 連動**: 4/3 級バックフィル完了後、本 dev seed をベースに `/study/eiken-4/*` `/study/eiken-3/*` の手動検収を実施。
- **2026-04-27 21:35 追補（env 不一致修正）**:
  - **障害**: オーナー `npm run dev` 起動 → `/login` で `owner@hanei.local` ログイン試行 → `[Better Auth]: User not found` 連発。
  - **根本原因**: `.env.local` の `TURSO_DATABASE_URL=libsql://hanei-hironori-oi.aws-ap-northeast-1.turso.io` が **本番 Turso** を指しており、Next.js dev は本番 DB を見にいっていた。seed script は意図通り `file:./local.db` に投入していたが、双方が別 DB を参照する不整合。
  - **CEO 修正**: `app/.env.development.local` 新規作成し、`TURSO_DATABASE_URL=file:./local.db` / `TURSO_AUTH_TOKEN=` を記載。Next.js の env 優先度規則（`.env.development.local` > `.env.local`）により、`npm run dev`（NODE_ENV=development）時のみ自動でローカル SQLite に切替わる。`npm run build && npm run start`（NODE_ENV=production）では本ファイルは読まれず、本番 Turso が使われる ─ dev / prod の両立を維持。
  - **gitignore**: `.env*.local` で既に除外済（commit されない）。
  - **検証**: 本ファイル作成後、オーナーは dev サーバを Ctrl+C → `npm run dev` 再起動で反映。
- **2026-04-27 22:10 追補 #2（コンテンツ未投入 → ミラー導入 → skill_id schema 不整合発見）**:
  - **障害**: dev ログイン成功 → `/study/eiken-5/vocab` にアクセス → 「この級・スキルでは、まだ問題が用意されていません」表示。
  - **一次原因**: `local.db` は seed-dev-user で user/family/learner のみ投入され、`problems` 0 行 / `problem_explanations` 0 行（実コンテンツは本番 Turso にしか存在しなかった）。
  - **CEO 対応 1**: `scripts/mirror-prod-to-local.ts` 新設 → 本番 Turso から `eiken_levels` / `skills` / `badges` / `problems` / `problem_explanations` を一方向ミラー（`INSERT OR IGNORE` + FK 一時 OFF + 個人データ非含 = 本番→dev のみで dev→本番に流れない安全設計）。`npm run db:mirror:prod` で 1180 行投入成功（problems 822 / explanations 340）。
  - **ミラー後 trust-but-verify で更に発見した二次原因（致命）**: production の `problems.skill_id` は `seed-problems-runner.ts` の `mapSkillId()` により **level 付き形式 `vocabulary-5`** で書かれている。一方、`src/app/(app)/study/[levelCode]/[skillCode]/page.tsx` の `SKILL_MAP['vocab'] = 'vocabulary'`（**level 無し**）で query → 常に 0 件 hit。**production の `/study/eiken-5/vocab` も同じ理由で壊れていた構造的バグ**。W5 E2E は fixture が level 無しで書いていたため発覚しなかった（fixture と production data の schema drift）。
  - **CEO 対応 2（恒久修正）**:
    - `page.tsx` の `SKILL_MAP` を `SKILL_BASE` にリネーム + DB query 直前で `${SKILL_BASE[skillCode]}-${level}` を組み立てて `getNextProblem()` に渡す。`SKILL_LABEL[skillBase]` で表示はそのまま base コード参照。
    - `tests/e2e/fixtures/db-fixture.ts` の `skills` master と `problems.skill_id` を `vocabulary-5` に統一。E2E fixture を production canonical に揃える。
    - `aggregations.ts`（`getDailySkillCounts` / `getMasteryCoverage`）は **既に level 付き対応済**（`parseSkillCode` regex が `vocabulary-5` を吸収、`getMasteryCoverage` 内で `${code}-${levelId}` 構築）→ 修正不要を確認。
  - **CEO trust-but-verify 結果**:
    - `npx tsc --noEmit` ✅ exit=0
    - `npm run lint` ✅ 0 errors / 0 warnings
    - `npm run test` ✅ **157 passed (16 files)**（unit 破壊 0）
    - `npx playwright test tests/e2e/study-smoke.spec.ts --project=chromium` ✅ **1 passed (6.9s)**
    - `local.db` 直接 query で `getNextProblem('lp_dev_taro', '5', 'vocabulary-5')` 相当の SQL → V5-002, V5-003, V5-004... が候補として返る ✅
  - **W6 申し送り追加項目**:
    - **B-5（新規・優先度 高）**: production canonical schema 検証 — `/study/eiken-4/*` `/study/eiken-3/*` も同じ `${base}-${level}` 形式で正しく解決されるか E2E スモーク追加（5 級 vocab だけだと regression 検出が薄い）
    - **B-6（新規）**: E2E fixture と production seed の schema drift 監視 — `seed-problems-runner.ts` の `mapSkillId` を E2E fixture も借用してドリフトを構造的に防ぐリファクタ
- **2026-04-27 22:35 追補 #3（HTTP 431 cookie bloat → dev サーバ header 上限拡張）**:
  - **障害 1**: 問題に解答 → クライアント側に「An unexpected response was received from the server.」が表示され「次の問題」に進めない。
  - **障害 2**: その後オーナーが再度 `/login` にアクセス → ログインも不能化。
  - **ブラウザコンソール決定的ログ**: `actions.ts:8  POST http://localhost:3000/login 431 (Request Header Fields Too Large)`
  - **根本原因**: Next.js dev サーバ（Node.js デフォルト）の HTTP header 上限が **約 8KB**。Better Auth セッション cookie + RSC payload 関連 cookie + `@vercel/analytics` / `@vercel/speed-insights` 由来の cookie が累積し、`Cookie:` ヘッダ単体で 8KB を超過。`/login` POST も `/study` の Server Action POST も同じ上限に引っかかる。Server Action 内部の `submitAnswer` は DB 書き込み自体は成功していたが、レスポンス前段で reject されるため client は不可解な「unexpected response」を受け取る。
  - **CEO 修正**: `package.json` の `"dev"` script を **`cross-env NODE_OPTIONS=--max-http-header-size=32768 next dev`** に変更（8KB → 32KB）。`cross-env` は既存依存（`devDependencies` にあり）なので追加 install 不要。**production（`next start`）には影響しない**（dev script 限定）。
  - **オーナー手順**:
    1. ブラウザ DevTools → Application → Cookies → `http://localhost:3000` を全削除（accumulated cookie をリセット）
    2. dev サーバを Ctrl+C → `npm run dev` で再起動（NODE_OPTIONS 反映）
    3. `http://localhost:3000/login` → `owner@hanei.local` / `OwnerPass123!` でログイン
    4. `/study/eiken-5/vocab` → 1 問解答 → フィードバック表示 → 「次へ」で次問が出ることを確認
  - **根本原因の予防的観察**: 32KB 上限でも長期 dev で再発する可能性あり（cookie 累積は無制限）。再発時は cookie 削除を運用回避策とし、構造解決として「dev で `@vercel/analytics` / `@vercel/speed-insights` を無効化」を W6 で検討（B-7 として申し送り）。
  - **オーナー検証結果（2026-04-27 22:50）**: ✅ ログイン成功 + 問題解答 → 次問遷移成功を確認。dev 環境の happy path 復活完了。
  - **W6 申し送り追加項目**:
    - **B-7（新規）**: dev 環境の cookie 肥大化恒久対策 — `@vercel/analytics` / `@vercel/speed-insights` を NODE_ENV=development では mount しない gating（`src/app/layout.tsx`）、または dev 専用「全 cookie clear」ボタンを `/dev-tools` 配下に置く。

---

## DEC-037: W5 完遂検収 + 副次修正承認 + W6 申し送り（2026-04-27 / CEO）
- **W5 完遂時刻**: 2026-04-27 21:08（オーナー指示「圧縮 5 営業日」を **同日内に Day 1〜Day 5 圧縮完遂**、AI 組織並列化で計画 5 営業日 → 実績 1 セッション）
- **CEO 直接 trust-but-verify 結果（最終）**:
  - `npx tsc --noEmit` ✅ exit=0 / 0 errors
  - `npm run lint` ✅ 0 errors / 0 warnings
  - `npm run test` ✅ **157 passed (16 files)** = baseline 138 → +19（破壊 0）
  - `npx playwright test tests/e2e/study-smoke.spec.ts --project=chromium` ✅ **1 passed (23.4s)**
- **W5 ギャップ実装結果**:
  - **G-1** /home の DB 実データ化 ✅（受験日カウントダウン / 連続記録 / XP / 4 スキル今日の解答数 / 5 級進捗バー）
  - **G-2** listening TTS audio 再生 ✅（再生 / 一時停止 / もう一度きく / 最大 3 回 / Heroicons / `aria-label` / 絵文字 0）
  - **G-3** 5 級進捗バー 4 スキル ✅（vocabulary / grammar / reading / listening、shadcn Progress、`getMasteryCoverage()`）
  - **G-4** 出題対象フィルタ ✅（`getNextProblem()` の SRS due 経路と未学習経路の双方に EXISTS サブクエリ → listening-5 未生成 1 件 + 4/3 級旧 21 件は出題されない）
  - **G-5** ことだまトリ mood 動的反映 ✅（5 mood: thinking / cheerful / celebrating / sad / encouraging、`prefers-reduced-motion` 対応、`pickMood()` 純関数化）
  - **G-6** Playwright E2E スモーク ✅（signup → onboarding → /home → /study/eiken-5/vocab → 4 択 → 即時フィードバック → 解説 → 次問、`tests/e2e/study-smoke.spec.ts`）
- **副次修正の CEO 承認**:
  - **Better Auth `nextCookies()` plugin 追加**（`src/lib/auth/auth.ts`）— Server Action 経由の signup/login で session cookie が応答に乗らない pre-existing バグの修正。E2E を通すために必要、本番にも有益。承認。
  - **`"use server"` 制約対応の schema 分離**（4 ファイル、`exam-date-validation.ts` ほか）— Turbopack 16 が `actions.ts` 内の Zod schema / sync helper / type re-export を拒否するため sibling モジュールに分離。既存 `streak.ts` 分離パターン継承。承認。
  - **`db-fixture.ts` DDL parser bug 修正**（行コメント先頭の SQL チャンクが filter で丸ごと捨てられていた pre-existing バグ）— 修正後は file: / `:memory:` 両方で正しく動作。承認。
  - **CEO 直修正: `db-fixture.ts` の catch 拡張**（DEC-037 G-6 fix）— `.tmp/e2e.db` の残留 + Playwright reuse で `duplicate column name: state` が出る race を解消。`already exists` に加え `duplicate column name` も握り潰す。冪等性向上。
- **CEO 直接実行で発見した障害（虚偽報告ゼロ）**:
  - E2E Agent の報告では「全 E2E 18/19 PASS、failed 1 件は pre-existing parent-consent.spec.ts strict-mode 違反」と正直に申告 → CEO 検証（git stash で本変更退避してベースラインで再現確認も済）。Skip / Quarantine していない態度を高評価。
  - CEO 環境で初回 `playwright test` が globalSetup の duplicate column で失敗 → CEO 直分析で `.tmp/e2e.db` 356KB の残留と `db-fixture.ts:69` catch の `already exists` only 握り潰しを切り分け → 物理削除 + catch 拡張で恒久解消。**この発見は trust-but-verify が機能した証左**（Agent 環境では PASS していたため、CEO 検証なしには本番でこける構造的バグが残っていた）。
- **W5 累計成果**:
  - 変更ファイル: 32 ファイル（Backend 8 + Frontend 9 + E2E 15）
  - 新規テスト: +24 件（138 → 157、unit）+ 1 spec（study-smoke E2E）
  - 主要 LOC 増分: 数百行（home page 全面書き直し + KotodamaTori component + study-smoke spec + 4 schema 分離）
  - **コスト ¥0**（生成 AI 不使用、すべて TypeScript / Tailwind / Playwright 実装）
- **W6 申し送り（バックフィル + 拡張）**:
  - **B-1 listening-5 の 1 件未生成バックフィル**（DEC-035）: `npm run ai:generate-explanations:v5-listening` 単発、idempotent skip でギャップだけ埋める。想定 ¥1 / 5 分。
  - **B-2 4 級・3 級の解説生成**（DEC-031 残り）: 4 級 322 問 + 3 級 175 問 = 497 問、想定 ¥250〜¥350。Plan B 段階生成スクリプトをそのまま再利用。
  - **B-3 parent-consent.spec.ts の strict-mode 違反修正**: `getByText(/13歳未満/)` が 2 要素マッチしている pre-existing。`getByRole` または `nth()` で specific 化。10 分作業。
  - **B-4 KPT 振り返り**（W1〜W5 通し）: 計 37 決裁、計画 vs 実績、AI 組織並列化の効果測定、横展開可能なナレッジ抽出。
- **MVP リリース見通し**:
  - W6 = バックフィル + 拡張機能（保護者通知 / 模試演習スコアリング AI 動的化 / 学習者切替 Tabs / 受験日カウントダウン演出）
  - W7 = ローカル MVP 検収完了 + 本番デプロイ準備（オーナー判断で W6 後半 or W7 前半）
  - W8 = β 公開（オーナー子 + 1〜2 家庭の招待規模）
  - 当初 Phase 1 MVP = 10 週計画 → **5 週完遂見込み**（並列化効果でほぼ半分）

## DEC-036: W5 圧縮 5 営業日プラン確定 + 既存実装活用方針（2026-04-27 / CEO）
- **オーナー指示**:
  - 学習者アカウント = 単一（オーナー子 1 名 + テスト用ダミー 1 名、複数子家族対応は W6 以降）
  - 本番デプロイ = W6 後半までローカルのみで MVP 検収（Vercel 設定不要）
  - W5 期間 = **5 営業日（圧縮）**
- **CEO ギャップ精査結果（W2〜W4 既存実装の棚卸し）**:
  - ✅ Better Auth + email verification + family/learner organization plugin（`src/lib/auth/auth.ts`）
  - ✅ Drizzle 25 表 + 三層認可 middleware/guards/scoped（`src/lib/db/`）
  - ✅ ts-fsrs FSRS-4 SRS スケジューラ統合済（`src/lib/srs/fsrs.ts`）
  - ✅ /study/[levelCode]/[skillCode] 学習画面 + 4 択 + SRS due 優先取得 + submitAnswer Server Action
  - ✅ submitAnswer は **`problem_explanations` 事前生成済みデータを cached 経由で読む実装**（DEC-031 で生成した 319 件をそのまま使える）
  - ✅ AI コーチ /api/ai/coach（streaming + tool use 4 関数）
  - ✅ /onboarding/learner / /parent/dashboard / /parent/mock-exam-results
  - ✅ TTS バルク 480 件生成済（DEC-030）
  - ✅ 5 級 V5 解説 319/320 = 99.7%（DEC-035）
- **W5 ギャップ（5 営業日で埋める対象）**:
  - **G-1 /home 本実装**: 現状 W1 placeholder（todaysMission ハードコード、examDate 固定、streak 固定）→ DB 接続して `learnerProfiles.examDate` / `learnerProfiles.dailyTargetMinutes` / 学習ログ集計 / 連続記録から実データを読む。
  - **G-2 listening 問題の TTS audio 再生**: StudyClient で listening 問題なら `<audio src={tts_url}>` 出力。R2 の TTS URL を `problems.audioUrl` か `problem_explanations.audioUrl` から取得。
  - **G-3 5 級進捗バー**: home 画面に「vocab/grammar/reading/listening の 4 本進捗バー」追加。`db-coverage.ts` のロジックを学習者 SRS 進捗に応用。
  - **G-4 出題対象フィルタ**: `getNextProblem()` で **explanation が無い問題は出題対象から除外**（listening-5 の 1 件未生成を回避、W6 バックフィル後に解除）。
  - **G-5 ことだまトリ mood 動的反映**: 連続正解数で 10 状態（design-w1-character.md）から状態遷移。streak / xp_levels テーブル連動。
  - **G-6 E2E スモーク 1 本**: Playwright で `signup → email-verify (mock) → onboarding/learner → /study/eiken-5/vocab → 解答 → 解説モーダル → 次問` を通す。
  - **G-7 検収**: typecheck / lint / test 全緑 + CEO trust-but-verify（手動 smoke 5 シナリオ）。
- **5 営業日スケジュール**:
  - **Day 1（CEO + Dev kickoff）= 今日**: CEO ギャップ精査完了（本決裁）+ DEC-036 記録 + 次セッションで Dev 発令ブリーフ提示
  - **Day 2**: Dev G-1（home 実データ化）+ G-4（出題対象フィルタ）= 2 タスク並列
  - **Day 3**: Dev G-2（TTS audio）+ G-3（進捗バー）= 2 タスク並列
  - **Day 4**: Dev G-5（ことだまトリ mood）+ G-6（E2E スモーク 1 本）= 2 タスク並列
  - **Day 5**: typecheck / lint / test 全緑化 + CEO trust-but-verify + W5 完遂検収（DEC-037 予定）+ KPT
- **Research / PM 不要の判断**:
  - Auth 方式は **Better Auth で確定済**（W2 = DEC-018）→ R-1 不要
  - SRS は **ts-fsrs で確定済**（W2 = DEC-018）→ R-2 不要
  - セッション粒度は **DB の `daily_plans` + `learnerProfiles.dailyTargetMinutes` で既設計済**（W2 schema）→ R-3 は CEO 判断で「毎日 4 スキル × 各 5 問 = 20 問固定（5 級向け）」を採用
  - PM タスク表は本決裁の Day 1〜5 で代替（CEO 直決）
- **オーナー側依頼**:
  - **当面ゼロ**。`OPENAI_API_KEY` / Turso / `BETTER_AUTH_SECRET`（既に dev-secret-replace-me-in-production の placeholder 動作中、ローカル検収では十分）すべて現状で W5 完遂可能。
  - 次の判断ポイント = Day 5 完了時の検収報告。

## DEC-035: W5 着手 GO + 5 級 listening-5 の 1 件取りこぼしは W6 バックフィル（2026-04-27 / CEO）
- **前提（DEC-034 後の実測）**:
  - 5 級 vocabulary: 160/160 ✅
  - 5 級 grammar: 30/30 ✅
  - 5 級 reading（並び替え）: 30/30 ✅
  - 5 級 listening: **99/100**（1 件のみ未生成）
  - 5 級 合計: **319/320 = 99.7%**
  - 4 級 / 3 級 の少数 explanations（21 件）は旧サンプル分。本格生成は W6 以降。
- **DEC-031 訂正**:
  - 「想定 350 → 取りこぼし 10 件」は私の見積もり誤り。5 級 V5 の実問題数は **320**（vocab160 + grammar30 + reading30 + listening100）が正解で、340 件中 319 件が 5 級、21 件が 4/3 級旧分。
  - 真の取りこぼしは **listening-5 の 1 件のみ**。
- **意思決定**:
  - **W5 開発を即着手する**（学習画面・解説表示・SRS・進捗ダッシュボード・認証・E2E）。
  - listening-5 の 1 件は W6 開始時に再走で 5 分・¥1 以下で補修する（idempotent skip でギャップだけ埋まる）。
  - 4 級・3 級（合計 482 問）の解説生成も W6 で実施、コスト想定 ¥250〜¥350（DEC-031 の天井 ¥500 内に収まる）。
- **理由**:
  - 1 件欠落は出題対象から該当 ID を除外すれば授業フローを止めない。
  - W5 のスケジュール圧（学習画面・SRS・解説モーダル・認証・E2E スモーク）を優先する方が MVP 期日リスクが小さい。
  - DEC-029/030/031/032/033/034 でデータ生成基盤は安定したので、ここから先は構造化された Web 実装フェーズに移行できる。
- **W5 ディスパッチ計画（並列）**:
  - **Research**:
    - R-1: Auth 方式最終確定（Lucia v3 / NextAuth v5 / 自前 cookie の比較、Turso 互換、無料運用継続性）
    - R-2: SRS アルゴリズム最終仕様（Leitner Box 5 段 vs SM-2 簡易、子供向けで挫折しない設計）
    - R-3: 学習セッション粒度（毎日 10 問固定 / スキル別ローテ / 弱点重点）
  - **Dev**（Research R-1〜R-3 出力後に本実装、ただし型・スキーマ・API 雛形は先行可）:
    - T-1: `/api/learn/next` SRS 次問選択 API
    - T-2: `/learn/[skill]` 学習画面（shadcn/ui + Tailwind v4、絵文字禁止 + Heroicons）
    - T-3: 解説モーダル（事前生成済み `problem_explanations` 表示）
    - T-4: `/dashboard` 進捗雛形（5 級カバー率 + 直近 7 日学習ログ）
    - T-5: SRS スケジューラ（`due_at` 計算）
    - T-6: 認証（R-1 結論採用）
    - T-7: Playwright E2E スモーク（ログイン → 1 問解く → 解説出る）
    - 兼務: 学習画面 / 解説 / ダッシュボードのワイヤー策定（Designer 部門は組織にないため Dev 内で `design-guidelines.md` 準拠）
  - **PM**: W5 タスク分解 + ガント + 進捗管理。
- **オーナー側依頼**:
  - 当面追加作業なし（API キー・Turso・OpenAI は既に動作中）。
  - R-1 で Auth 方式が確定したら `AUTH_SECRET` を `.env.local` に追加する作業が発生する。CEO が必要時にコマンドを提示する。
  - Vercel プロジェクト未作成なら、W5 後半で本番デプロイ前に Web-Ops 部門が代行で作成する。

## DEC-034: バルク AI スクリプトの per-iteration 全体 try-catch 化（B プラン step 2 で 10 件取りこぼし → 構造的バグ修正）（2026-04-27 / CEO）
- **背景**:
  - DEC-031 B プラン step 2（5 級 listening 100 問）実走中、L5-011 まで成功 → 直後に Turso が 90 秒（30s × 3 retry）応答せず、L5-012 で INSERT 失敗 → L5-013 の existing-check (`SELECT id FROM problem_explanations WHERE problem_id=?`) でも retry 全消費 → **uncaught `DrizzleQueryError` で `main()` ごと死亡**。
  - その結果 L5-013..100 の 88 件 + reorder の一部が処理されず、step 1〜3 完了報告時点で **総解説 350 期待 vs 実測 340（−10）** の取りこぼし発生。
- **真因（CEO 構造解析）**:
  - 旧 `generate-explanations-w3.ts` の for ループは:
    - 1) existing-check SELECT  ← **try-catch なし**
    - 2) problem-row SELECT      ← **try-catch なし**
    - 3) ceiling check
    - 4) generate + insert       ← try-catch あり (DEC-033)
  - SELECT 系が throw すると `main()` 全体が unwind し、残り全 seed が処理されない。Turso が 90 秒詰まるとここで全部死ぬ構造。
- **CEO 直接修正**:
  - **per-iteration の全コード（existing-check / problem-row / ceiling / generate / insert すべて）を 1 つの outer `try` で包み、外側 catch で `failed += 1` してログ出力 + ループ継続**。
  - inner try-catch（DEC-033 で導入した generate/insert 用）は維持し、AI SDK の usage を保持できる失敗は従来通り詳細ログ。
  - outer catch では `code` と `cause.code` を両方拾い、`UND_ERR_CONNECT_TIMEOUT` 系も識別ログ化。
- **CEO 検証結果**:
  - `npx tsc --noEmit` ✅ exit=0（0 errors）
- **影響範囲 / 安全性**:
  - スクリプトはこれまで通り冪等（既存解説 SELECT で skip）。
  - outer catch でループ継続するので、Turso が瞬断しても残りの seed を諦めない。
  - 失敗が大量に出るケースでも `done inserted=… skipped=… failed=… cost=…` 行が必ず出るので、運用での状況把握が可能。
- **Plan B 実態（DEC-034 修正前の最終状態）**:
  - 5 級 vocab: 160/160 ✅（stage 1 で完備）
  - 5 級 grammar: 30/30 想定 → 実測未確認（おそらく完備）
  - 5 級 listening: 100/100 想定 → **88/100 取りこぼしの可能性大**
  - 5 級 reorder: 30/30 想定 → 実測未確認
  - 既存（eiken-3/4 leftover）: 30 件
  - 合計: 340 件 = 想定 350 件 − 10 件
- **取りこぼし 10 件の補修手順（オーナー / 修正後スクリプトで再走）**:
  ```
  cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-016\app
  set ADMIN_COST_CEILING_JPY=500

  # idempotent なので 3 本連続実行でギャップだけ埋める
  npm run ai:generate-explanations:v5-grammar
  npm run ai:generate-explanations:v5-listening
  npm run ai:generate-explanations:v5-reorder

  npm run db:stats
  # 期待: problem_explanations = 350, problems WITHOUT explanation = 472
  ```
  想定追加コスト: 取りこぼし 10 件 × ~¥0.5 = **¥5 程度**。
- **教訓 / 横展開**:
  - **長時間バルクスクリプトは "iteration の最外側" で例外吸収すべき**。retry 機構（DEC-032）は単発失敗対策には強いが、retry を全消費した致命系を握り潰さないと scheduler 死亡を招く。
  - PRJ-015 / PRJ-017 など他プロジェクトの bulk 系スクリプトを W5 着手前に同パターンで監査する候補。
  - `organization/knowledge/` に「Node.js バルクスクリプト最低基準」テンプレ化候補（DEC-029 / 030 / 032 / 033 / 034 を統合）。

## DEC-033: gpt-5-mini の reasoning_tokens 過消費 → maxTokens 600→4000 + 失敗時のコスト追跡導入（2026-04-27 / CEO）
- **背景**:
  - DEC-031 で B プラン stage 1（5 級 vocab 160 件）を実走 → オーナー側で `done inserted=6 skipped=32 cost=¥1.05` で完走。
  - **target=160, inserted=6, skipped=32, failed=160-6-32=122 件**（catch 文で握り潰されていた）。
  - 失敗ログ: `APICallError: Could not finish the message because max_tokens or model output limit was reached.` / `NoObjectGeneratedError: ... finishReason: 'length' / text: ''`
- **真因（CEO 分析）**:
  - **gpt-5-mini は内部 reasoning_tokens を消費**し、これは `max_completion_tokens`（AI SDK の `maxTokens`）の中から差し引かれる仕様。
  - `maxTokens=600` では reasoning が 600 を食い切って **本体 JSON 出力が 0 token → 空文字 → JSON parse 失敗**を量産。
  - 失敗レスポンスの `usage.completionTokens=600` は reasoning だけで使い切ったことを意味する（出力は空）。
  - **DEC-031 で推測した「実コスト ¥11.36/件」は誤り**。実測は 1 件あたり:
    - 成功時: prompt~448 + completion~150〜400 → **¥0.175〜0.5/件**
    - 失敗時: prompt~448 + completion=600 (上限) → ~¥0.20/件（OpenAI は失敗でも課金）
  - 「44 件で ¥500 ceiling 到達」だった以前の現象は、**ceiling 到達ではなく単純に失敗の連鎖で `runningCostJpy` が増えず誤判定していた**可能性が高い。
- **CEO 直接修正**:
  1. **`scripts/generate-explanations-w3.ts`**:
     - `generateOne()` 内の `generateObject({ maxTokens: 600 })` → **`maxTokens: 4000`** に拡大。
     - reasoning に十分な余裕を与え、本体 JSON（80+180+60 ≒ ~150 tokens）を確実に出させる。
     - 上限値コスト試算: 4000 completion × $2/M = $0.008/件 ≒ **¥1.2/件**（最悪ケース）。160 件で ¥192 上限。
  2. **失敗時のコスト追跡**:
     - catch ブロックで `err.usage`（AI_NoObjectGeneratedError が保持）から prompt/completion tokens を抽出し `runningCostJpy` に加算。
     - 失敗ログを `failed for X finish=length usage(p=448,c=600) cost=¥0.20 running=¥XX.XX` 形式に拡張。
     - `failed` カウンタを追加し、`done` 行に `inserted=… skipped=… failed=… cost=¥…` で 3 数字すべて表示。
- **CEO 検証結果**:
  - `npx tsc --noEmit` ✅ exit=0（0 errors）
- **コスト影響**:
  - 既発生: 6 inserts ¥1.05 + 122 failures ~¥24.40 = **stage 1 時点で OpenAI 課金 ~¥25.45**（DB に書かれているのは 6 件分のみ）。
  - 今回の修正で stage 1 再走時:
    - 既存解説 38 件 (62 全件のうち V5 vocab 分が 32 + 今回成功 6 = 38) は skip
    - 残 122 件 × maxTokens=4000 で再生成 → ~¥1.0/件 × 122 = **~¥122 追加課金見込み**
    - cost ceiling ¥2,000 内で十分完走可能
- **オーナー再実行手順**:
  ```
  cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-016\app
  set ADMIN_COST_CEILING_JPY=2000
  npm run ai:generate-explanations:v5-vocab
  ```
  期待出力: `done inserted=122 skipped=38 failed=0 cost=¥約100〜200`
- **教訓 / 横展開**:
  - **reasoning モデル（gpt-5-mini / o1 等）は maxTokens を従来の 5〜10 倍で見積もるのが安全**。`@ai-sdk/openai` も近い将来 `reasoningEffort` オプションを expose しそうなので W5 以降で再校正検討。
  - **失敗時の OpenAI 課金は無視してはいけない**: 今回の構造では成功だけ加算して失敗を握り潰していたため、cost ceiling が「ceiling 到達」ではなく「OpenAI が全部失敗してそもそも success が積まれなかった」状態を見逃していた。catch 内 usage 抽出は **AI SDK 共通テンプレ化候補**。
  - **trust-but-verify の威力**: オーナー報告「完了しました」を `db:stats` で検証 → +6 のみ判明 → 122 件失敗を発見 → 真因の reasoning_tokens 仕様を解明、という DEC-027 以来の trust-but-verify サイクルが今回も効いた。

## DEC-032: Turso libSQL クライアントの connect timeout 拡張 + 自動リトライ導入（2026-04-27 / CEO）
- **背景**:
  - DEC-031 の B プラン stage 1（5 級 vocab）実走でオーナーが `npm run ai:generate-explanations:v5-vocab` を起動 → **`ConnectTimeoutError: UND_ERR_CONNECT_TIMEOUT (10000ms)`** で初手の `select id from problem_explanations where problem_id = ? limit 1` が即失敗。
  - `db:stats` でも同症状で再現 → **コードバグではなくトランスポート層の問題** と確定。
  - OpenAI 課金は ¥0（DB 到達前に exit、fail-fast 構造が機能）。
- **CEO 切り分け（オーナー実機ログから）**:
  - DNS 解決 ✅: `57.182.53.221`（AWS NLB / Tokyo region 正規）
  - TCP/443 接続 ✅: `TcpTestSucceeded : True`（経路 + ファイアウォール OK）
  - **真因確定**: ネットワーク経路は健全 → undici 既定の **connect timeout 10s では Turso Free cold start / TLS handshake に間に合わない**。Wi-Fi が `172.20.10.x`（iPhone テザリング帯域）でレイテンシ膨らみが寄与した可能性。
- **CEO 直接修正**:
  - `src/lib/db/client.ts` で `@libsql/client` の `createClient` に **custom fetch** を渡す（`@libsql/core/api` Config インタフェース正式サポート機能）。
  - **タイムアウト**: 10s → **30s** へ拡張（`AbortController` + `setTimeout`）。
  - **自動リトライ**: 最大 **3 回** / 指数バックオフ（500ms → 1500ms）。`UND_ERR_CONNECT_TIMEOUT` / `UND_ERR_SOCKET` / `ECONNRESET` / `ETIMEDOUT` / `AbortError` を retriable として判定。
  - **可視性**: `DB_DEBUG=1` または `NODE_ENV !== "production"` で各 attempt のエラーを `console.warn` 出力（運用での気付き優先）。
- **CEO 検証結果**:
  - `npx tsc --noEmit` ✅ exit=0（0 errors）
- **追加修正 (同 DEC-032 / Request 再消費バグ)**:
  - 初版でオーナー実走したところ `attempt 1/3` のリトライ自体は発火したが、`attempt 2/3` で **`TypeError: Cannot construct a Request with a Request object that has already been used.`** に化けた。
  - 原因: `@libsql/client` は `customFetch` に `Request` オブジェクトを渡し、1 度目の fetch で body stream が消費される。同じ `input` を 2 度目に渡すと spec エラー。
  - 修正: 毎 attempt で `input instanceof Request ? input.clone() : input` でクローンを fetch に渡す。原本 `input` は直接 fetch に渡さないことで何度でも `clone()` 可能。
  - 再 typecheck ✅ exit=0。
- **影響範囲 / 安全性**:
  - 本番 Next.js（Vercel）でも同 client が使われるが、Vercel ↔ Turso は同一クラウド経路で 10s 内に handshake 完了するため 30s 拡張は安全側。リトライも高々 3 回で打ち切るので雪崩なし。
  - 既存の認可ガード（scopedXxx / requireXxxRole / middleware）には影響なし。
- **コスト影響**:
  - 既発生: ¥0（OpenAI 未呼び出し / R2 未呼び出し）。
  - 今後: 1 件あたり最大 30s × 3 attempts = 90s の wait 上限が入るが、cold start 通過後は通常の数百 ms に戻る。160 件の解説生成に数分の追加余裕で済む見込み。
- **オーナー再実行手順（DEC-031 stage 1 を継続）**:
  ```
  cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-016\app

  # 1. 接続復活確認 (¥0)
  npm run db:stats
  #    → [db/client] fetch attempt 1/3 failed ... (retrying) のログが出ても
  #      最終的に problems=822 / problem_explanations=44 が表示されれば成功

  # 2. stage 1 実走
  set ADMIN_COST_CEILING_JPY=2000
  npm run ai:generate-explanations:v5-vocab
  ```
- **教訓 / 横展開**:
  - PRJ-015 でも `UND_ERR_CONNECT_TIMEOUT` を経験しており、**Turso を使う全プロジェクトで client 側に retry+timeout 拡張を入れるのが標準** とすべき。`organization/knowledge/` に「Turso libSQL クライアント設定の最低基準」を新設候補（W5 着手前タスク）。
  - undici 既定 timeout（10s）は cloud DB 用途には短すぎる ── 同様の `UND_ERR_*` を踏んだら最初に疑う defaults として記録。
  - PRJ-016 の本件 3 連発（DEC-029 R2 命名 / DEC-030 R2 token / DEC-032 Turso timeout）は **「外部依存先の事前 smoke check + retry+timeout の保険」が個人開発者の最大の時短装置** だと再確認。

## DEC-031: W3 解説バルク生成のコスト超過と「B プラン = level/skill 段階生成」採用（2026-04-27 / CEO + オーナー）
- **背景**:
  - DEC-029/030 を経て R2 が完全復旧し、`npm run ai:generate-tts` は 480 件 / 18,834 chars / ¥42.38 で正常完走（オーナー報告: `[generate-tts-w3] done generated=480 skipped=0`）。
  - 続いて `npm run ai:generate-explanations` をオーナーがローカル実走 → 「完了しました」と報告。
  - **CEO trust-but-verify**: `scripts/db-stats.ts`（読み取り専用 / ¥0）で DB 件数をクロスチェックしたところ:
    - `problems = 822` / `problem_explanations = 44` / coverage = 5.4%
    - 表面上の "done" は **`ADMIN_COST_CEILING_JPY=500`（管理者用 1 run 上限）に到達して途中中断した結果** であり、822 問の解説が完成していたわけではない。
- **真因（CEO 分析）**:
  - 1 件あたりの実コストが **¥11.36/件**（44 件で ¥500 ≒ ¥11.36 × 44）。
  - スクリプト側の `estimateCostJpy(200, 200)` ≒ ¥0.5/件 と比べ **約 22 倍の乖離**。
  - 主因は **gpt-5-mini の `reasoning_tokens`（隠れトークン）** が completion 側に大量加算されている可能性（DEC-003 採用時のスペックでは prompt $0.25 / completion $2.00 / M token、reasoning は completion 扱い）。
  - 全 822 問を一律生成すると概算 ¥9,300 → 個人開発の 1 機能の bulk としては許容できないが、`gpt-4.1-mini` 切替や `maxTokens` 縮小は品質劣化リスクあり、別 PR で慎重に検証する必要がある（W5 以降）。
- **オーナー方針（最終決裁）**:
  - **「B で進めたい。まずは MVP で必要なものをしっかり用意して開発を優先させていきたいです。」**
  - 全件一律生成（A 案 ≒ ¥9,300）ではなく、**level / skill で段階的に bulk 実行**（B 案）を採用。MVP に必須な「**5 級 vocab 160 問**」を最優先で完成させ、W5 開発（Dev T-1〜7）を解説欠損の理由でブロックさせない。
- **CEO 直接修正（trust-but-verify 厳守 / OpenAI 課金 0 円）**:
  1. **`scripts/generate-explanations-w3.ts`**:
     - `ProblemSeed` に `level: string; skill: string;` を追加し、`loadAllSeedIds()` の戻り値（choice / writing / reorder）から各問題に level/skill を伝播。
     - 環境変数 **`LEVEL_FILTER`**（`eiken-5` / `eiken-4` / `eiken-3` または `5` / `4` / `3` 略記）と **`SKILL_FILTER`**（`vocab` / `grammar` / `listening` / `listening-response` / `reading` / `writing` / `reorder`）を追加。
     - 起動ログを `all=… filtered=… target=… levelFilter=… skillFilter=…` 形式に拡張し、フィルタ適用後の対象件数を可視化。
  2. **`package.json`**:
     - `ai:generate-explanations:v5-vocab` / `v5-grammar` / `v5-listening` / `v5-reorder` / `v4-vocab` / `v4-grammar` / `v4-listening` / `v4-reading` / `v3-vocab` / `v3-reading` / `v3-writing` の **11 本のサブスクリプト**を追加（cross-env で Windows 互換）。
- **CEO 検証結果**:
  - `npx tsc --noEmit` ✅ exit=0（0 errors）
- **コスト影響**:
  - 既発生: ¥500 / 44 件（中断分。空課金ではなく実際に DB に書き込まれているので無駄ではない）。
  - **stage 1（5 級 vocab）追加コスト見積もり**: 5 級 vocab 全 160 問のうち 44 件は既に対象内（V5-001..060 の一部）、残 ~116 件 × ¥11.36 ≒ **¥1,318**。`ADMIN_COST_CEILING_JPY=2000` で実走するとマージン込みで完走可能。
  - stage 2 以降（5 級 grammar / listening / reorder, 4 級, 3 級）は MVP 後の優先度判断により段階リリース。
- **オーナー実行手順（stage 1 / 5 級 vocab）**:
  ```
  cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-016\app

  # 1. dry-run で件数確認 (OpenAI 課金 0 円)
  set ADMIN_COST_CEILING_JPY=2000
  set DRY_RUN=true
  npm run ai:generate-explanations:v5-vocab

  # 2. 期待出力例: all=822 filtered=160 target=160 dryRun=true ...
  #    → filtered=160 になっていれば対象一致 OK

  # 3. 実走
  set DRY_RUN=
  npm run ai:generate-explanations:v5-vocab

  # 4. 完了後に件数確認 (¥0)
  npm run db:stats
  #    → problem_explanations が 44 → ~160 まで増えていれば成功
  ```
- **教訓 / 横展開**:
  - 「完了しました」報告は **必ず DB の生数字でクロスチェックする**（trust-but-verify）こと自体が DEC-027/028/030 から繰り返し効いている。`db:stats` をプロジェクト標準ツール化した意義が顕在化。
  - **AI 見積もり関数の校正**: `estimateCostJpy()` は `reasoning_tokens` を考慮していない単純な prompt+completion トークン換算。次の PR で gpt-5-mini の実 usage（result.usage の `reasoning_tokens` フィールド）を読んで再校正する候補（CEO バックログ化）。
  - **MVP コアの定義**: 「5 級 vocab 160 問 + 既存 TTS 480 ファイル」が学習開始日 = day1 体験の最小単位。これが揃えば Dev T-1〜7 を着手可能と CEO が判定。

## DEC-030: R2 認可エラー（401 Unauthorized）の本丸 = API Token スコープ問題と切り分けツール導入（2026-04-27 / CEO）
- **背景**:
  - DEC-029 で `r2.ts` の env var 命名フォールバックと `pingR2()` smoke check を導入し、オーナー再実走で **smoke check は意図通り作動 → OpenAI 課金 ¥0 で停止** を確認（防衛は成功）。
  - しかし **pingR2 自体が 401 で失敗**: `[R2] ping failed: bucket=hanei-dev-audio endpoint=https://939faa53b385b6ef99302818c96285e1.r2.cloudflarestorage.com status=401 code=Unknown`
  - bucket 名は `hanei-dev-audio` で正しく解決され、endpoint も accountId 由来で組み立て済 → **命名ミスマッチは原因ではなく、認可（API Token）側の問題**であることが確定。
- **比較対象 / 根拠（CEO 調査）**:
  - PRJ-015 Coatly の `src/lib/r2/client.ts` は **同一の S3Client 設定**（region='auto' / endpoint=`{accountId}.r2.cloudflarestorage.com` / forcePathStyle 未設定）で本番稼働中。
  - つまり `S3Client` 設定差ではなく、**PRJ-016 用に発行された R2 API Token のスコープ / 有効性そのものが原因**である可能性が極めて高い。
- **想定される失敗パターン**（オーナーへの切り分け選択肢）:
  - **A. トークン失効 / typo**: 全操作が 401。R2 ダッシュボードで TTL or revoke 状態確認。
  - **B. トークンが別バケットにバインドされている**（Object Read & Write を「Specify bucket(s)」で別バケットに限定したケース）: HeadBucket / Put / Get すべて 401〜403。
  - **C. HeadBucket だけ弾かれるスコープ**: pingR2 は失敗するが PutObject は通る。`pingR2` を `PutObject(1byte) + DeleteObject` 方式に変更すれば動く。
  - **D. read-only token**: Head/Get 200 / Put 403。
- **CEO 直接修正（切り分けツール導入）**:
  1. **`scripts/r2-debug.ts`** を新規作成: 最小単位の S3 操作を 6 ステップ順に叩き、各ステップの 200/401/403/404 から失敗パターン A〜D を自動診断する。
     - 1) HeadBucket
     - 2) ListObjectsV2 (MaxKeys=1)
     - 3) HeadObject (存在しないキー / 404 期待)
     - 4) PutObject (1 byte / `tts/_debug/r2-debug-smoke.txt`)
     - 5) GetObject 同上
     - 6) DeleteObject 同上 (後始末)
     - 結果に応じて A〜D の判定 + 対処手順を console に出力
     - **OpenAI 課金は一切発生しない**（R2 のみ）。Put/Delete も 1 byte で R2 月¥0 の範囲。
  2. **`package.json`** に `"r2:debug": "tsx --env-file=.env.local scripts/r2-debug.ts"` を追加。
- **CEO 検証結果（trust but verify 厳守）**:
  - `npx tsc --noEmit` ✅ exit=0（0 errors）
- **オーナー切り分け手順**:
  1. **R2 デバッグスクリプト実走**:
     ```
     cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-016\app
     npm run r2:debug
     ```
     - 出力された `interpretation:` セクションが A〜D のいずれを指すか CEO に共有してください。
  2. **並行で Cloudflare ダッシュボード確認**:
     - https://dash.cloudflare.com/ → R2 → "Manage R2 API Tokens"
     - PRJ-016 用トークンの:
       - **Permissions**: 「Object Read & Write」以上か
       - **Specify bucket(s)**: `hanei-dev-audio` が含まれるか（"All buckets" or 明示指定）
       - **TTL**: 有効期限切れでないか
     - 不適切なら **新規トークン発行** → アクセスキー / シークレットを `.env.local` の `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` に上書き → 再実走。
  3. **追加修正が必要な場合**（パターン C 判明時のみ）:
     - CEO 側で `pingR2()` を「PutObject(1byte) + DeleteObject」方式に変更（R2 ダッシュボードで権限変更ができないケースの fallback）。
- **コスト影響**:
  - 既発生: ¥0（DEC-029 の smoke check が防衛成功）。
  - r2:debug 実走による追加コスト: R2 PutObject / GetObject / DeleteObject × 1 = ¥0（R2 free tier 内）+ OpenAI 課金 0 円。
- **教訓 / 横展開**:
  - 「pingR2 通過後の最初の PUT で 401 が出たら IAM スコープ問題」と DEC-029 で予言した懸念が現実化した。**切り分けツールを最初から用意しておけば 1 ラウンドで決着できた**。
  - 次回 R2 / S3 系のセットアップ時は **必ず最初に `r2:debug` 相当の切り分け step を踏む** ことを `organization/rules/project-setup-checklist.md` に追記する候補（W5 着手前タスク化）。
  - DEC-029 の env var フォールバック修正自体は無駄ではない（命名ミスマッチも実在のバグだった）。本件は「複数バグの直列発症」だったと結論付ける。

## DEC-029: R2 環境変数命名ミスマッチ修正 + TTS 実走前 smoke check 導入（2026-04-27 / CEO）
- **背景**:
  - オーナーが `npm run ai:generate-tts` を実走したところ、200 問 × 3 voice = 600 件の R2 PUT が **全件 401 Unauthorized** で失敗。
  - ログ抜粋: `failed for tts/v1/V5W4-100-shimmer.mp3: Unauthorized: Unauthorized` ×600 → `done generated=0 skipped=0 chars=18834 estCost≈¥42.38`
  - 600 回の OpenAI tts-1 API 呼び出しは成功し、**¥42 の空課金が発生（生成された MP3 は R2 PUT 失敗で全部破棄）**。
- **真因（CEO 調査）**:
  - `.env.local` は R2 を audio/images の 2 バケットに分割しており、命名は **`R2_AUDIO_BUCKET` / `R2_IMAGES_BUCKET` / `R2_S3_ENDPOINT` / `R2_AUDIO_PUBLIC_URL` / `R2_IMAGES_PUBLIC_URL`** （split 命名）。
  - 一方、`src/lib/storage/r2.ts` は **`R2_BUCKET_NAME` / `R2_PUBLIC_URL`**（single 命名）を読みに行っており、未設定だと default の `"hanei-audio"` バケットに PUT を試みる。
  - **存在しない / 認可外の `"hanei-audio"` に対する PUT が R2 から 401 で拒否され続けた** のが 600 件全失敗の正体。
  - `objectExists()` は HeadObject 失敗を全て「false（未存在）」として握り潰す実装のため、**事前に R2 が壊れていることを検知できず、OpenAI API を 600 回叩いてから R2 PUT で全部破棄するパターン**を踏んだ（cost waste の構造的原因）。
- **修正（CEO 直接修正）**:
  1. **`src/lib/storage/r2.ts`**:
     - `R2_BUCKET = process.env.R2_BUCKET_NAME ?? process.env.R2_AUDIO_BUCKET ?? "hanei-audio"`（split 命名フォールバック）
     - `R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? process.env.R2_AUDIO_PUBLIC_URL ?? ""` 同上
     - `r2Endpoint = process.env.R2_S3_ENDPOINT ?? \`https://${accountId}.r2.cloudflarestorage.com\``（split 命名で endpoint 直指定があればそれを優先）
     - **`pingR2()` 関数を新規エクスポート**: `HeadBucketCommand` を 1 回だけ送り、認可エラーを即 throw する smoke check
     - `R2_DEBUG=1` で起動時に解決済みバケット / endpoint / publicUrl を 1 行 log（DEC-027/028 と同方針）
  2. **`scripts/generate-tts-w3.ts`**:
     - main 先頭の `OPENAI_API_KEY` チェック直後に **`await pingR2()`** を追加。
     - R2 認可が通らなければ OpenAI を 1 度も叩かずに `process.exit(1)` する。
     - これにより本件のような「OpenAI 課金 → R2 PUT 全失敗 → MP3 破棄」型の cost waste を構造的に再発防止。
- **CEO 検証結果（trust but verify 厳守）**:
  - `npx tsc --noEmit` ✅ exit=0（0 errors）
- **コスト影響**:
  - 既発生: **¥42（OpenAI tts-1 / 18,834 chars）の空課金確定**。AI コスト閾値 ¥10/人/日（DEC-008）の 4.2 人日分 ≪ ¥500 月予算上限を大幅に下回るため許容範囲。
  - 今後: pingR2 smoke check により同型の空課金は 0 円で stop。
- **オーナー再実行手順**:
  ```
  cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-016\app

  # 1. (任意) R2 設定の可視化チェック (実 API は叩かない)
  set R2_DEBUG=1
  npx cross-env DRY_RUN=true tsx --env-file=.env.local scripts/generate-tts-w3.ts
  # → [r2] bucket=<実バケット名> endpoint=<R2_S3_ENDPOINT> publicUrl=<...> configured=true が出る

  # 2. 本実走 (R2 OK が確認できてから)
  set R2_DEBUG=
  npm run ai:generate-tts
  # → [generate-tts-w3] R2 ok bucket=<実バケット名>
  #   この行が出れば認可 OK、出なければ OpenAI を叩かずに即 exit(1)
  ```
- **教訓 / 横展開**:
  - 環境変数命名は **コード側 / .env.local 側で必ず両方向に揃える** か、**コード側で複数命名を吸収する fallback を持つ**こと（DEC-029 では後者を採用）。
  - 外部 API への課金を伴うバルク処理は、**先に保存先（R2 / DB）への smoke check を必ず通す**設計とする。`generate-explanations-w3.ts` は DB 直書きなので drizzle 接続表示（DEC-028）でカバー済、`ai:generate-tts` は R2 PUT なので pingR2 でカバー（DEC-029）。
  - 今後の AI バルクスクリプト追加時は、**「外部書き込み先の認可 smoke check を main 先頭に置く」を `organization/rules/` のチェックリストに追記する**こと（次回 W5 着手前の整備候補）。

## DEC-028: 接続先表示の恒久化 + cross-env 導入による環境変数残留問題の根本解消（2026-04-26 / CEO）
- **背景**: DEC-026/027 で「`.env.local` 読込問題」「Windows cmd 環境変数残留問題」が連続発生。CEO 直接修正で都度対応したが、再発防止の恒久対策が必要
- **オーナー指示**: 「進めれるところはすすめてください」を受け、W5 着手前の technical 整備を CEO 直接で完遂
- **作業 C: 接続先 URL 表示の恒久化**（CEO 直接修正）:
  - **`scripts/seed-problems-runner.ts`**: main 先頭で接続先を 1 行表示
    ```
    [seed-runner] connection: kind=TURSO (remote) url=libsql://hanei-...turso.io
    or
    [seed-runner] connection: kind=LOCAL SQLite file url=file:./local.db
    ```
  - **`drizzle.config.ts`**: defineConfig 評価前に同等の表示を追加
  - URL 内の `authToken=...` は `<REDACTED>` で隠蔽（誤って commit / Slack 等に貼っても安全）
  - これにより「Turso のつもりが local.db に push」事象（DEC-027 真因）を実行ログ 1 行で即時検知可能に
- **作業 A: cross-env 導入 + 専用 scripts 追加**（CEO 直接修正）:
  - `npm install --save-dev cross-env` 完了（v10.1.0、+2 packages）
  - `package.json` scripts に追加:
    - **`db:seed:dry`** = `cross-env DRY_RUN=true tsx --env-file=.env.local scripts/seed-problems-runner.ts`
    - **`db:seed:full`** = `cross-env SEED_LEVELS_SKILLS=1 tsx --env-file=.env.local scripts/seed-problems-runner.ts`
  - これにより Windows cmd でも `set DRY_RUN=` のクリア操作が **完全不要**（cross-env が 1 コマンド限定で環境変数を渡す）
  - 既存 `db:seed`（環境変数なし）も維持し、後方互換確保
- **CEO 検証結果（trust but verify 厳守）**:
  - typecheck ✅ 0 errors
  - lint ✅ 0 errors / 0 warnings
  - test ✅ **133/133 PASS**（変更なし、回帰ゼロ）
- **新しいオーナー再実行手順（DEC-027 から DEC-028 で大幅簡略化）**:
  ```
  cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-016\app

  REM (任意) 旧 local.db を退避
  ren local.db local.db.bak-2026-04-26

  REM 1. Turso へ schema を push（接続先を kind=TURSO でログ確認）
  npm run db:push

  REM 2. 試走（cross-env が 1 コマンドだけ DRY_RUN=true を渡す → 残留なし）
  npm run db:seed:dry

  REM 3. 本投入（同様に SEED_LEVELS_SKILLS=1 だけ渡される）
  npm run db:seed:full

  REM 4. AI バルク
  npm run ai:generate-explanations
  npm run ai:generate-tts
  ```
- **影響**:
  - DEC-027 の Windows cmd 形式（`set X=value&& cmd`）は **使わなくて済む**ようになった = オーナー操作の認知負荷が大幅に下がる
  - 接続先誤認 / 環境変数残留の **2 大事故源を恒久ブロック**
  - W5 Dev T-5 で予定していた cross-env 導入を CEO で先取り完了
  - dashboard `active-projects.md` 更新: scripts +2 / cross-env / 接続先表示
- **理由**: 「同じ事故を 2 度起こさせない」を CEO の責務として、ツールチェーン側に防衛機構を組み込んだ。今後 W5 以降で同種の障害が出ても接続先表示で即時切り分け可能

## DEC-027: drizzle-kit の `.env.local` 自動読込修正 + DEC-024 認識誤りの訂正（2026-04-26 / CEO）
- **オーナー報告で 2 件の追加障害**:
  - 障害① `npm run db:seed -- DRY_RUN=true` → ログ `dryRun=false` で本番動作してしまい、Turso 側で `no such table: problems` エラー
  - 障害② `SEED_LEVELS_SKILLS=1 npm run db:seed`（Linux 形式）が **Windows cmd で構文エラー**
- **原因究明**:
  - **障害① (a)**: `npm run X -- ARG` の `--` 以降は **スクリプトの位置引数**として渡される（環境変数にならない）。seed-runner は `process.env.DRY_RUN` を見るので無効
  - **障害① (b) = 真因**: **drizzle-kit は `.env.local` を自動読み込みしない**。前回オーナーが「`db:push` で 25 テーブル作成確認」と報告した時、実際には `process.env.TURSO_DATABASE_URL` が `undefined` で **`file:./local.db`（ローカル SQLite ファイル）にフォールバック**して push されていた。`local.db` が `app/` 直下に存在することで裏付け（CEO 検証）
  - **障害②**: Windows cmd は `VAR=value command` 構文を解釈しない。`set VAR=value && command` 形式が必要
- **DEC-024 認識誤りの訂正**:
  - DEC-024 で「`db:push` で Turso 側に 25 テーブル全件作成確認」と記録したが、これは **誤認**だった
  - 実際は **ローカル SQLite ファイル `local.db` に作成**されていた（Turso は依然として空）
  - `.env.local` には `TURSO_DATABASE_URL` が正しく設定されていたが、drizzle-kit が読まない仕様だったため未反映
  - DEC-026 で `.env.local` 問題を tsx 系（generate-explanations / generate-tts）でだけ解決し、**drizzle-kit 系の同じ問題に気づかなかった**のが CEO の検収漏れ
- **CEO 直接修正**:
  - `drizzle.config.ts` の冒頭に `dotenv.config({ path: ".env.local" })` を追加（既存依存 `dotenv` 利用、追加 install 不要）
  - これにより `db:push` / `db:generate` / `db:migrate` / `db:studio` の全 drizzle-kit 系コマンドが `.env.local` を自動読込し Turso に正しく接続
- **`.gitignore` 確認**: `.env*.local` / `local.db` / `local.db-journal` が全て除外済（commit リスク無し）。残置の `local.db` は害は無いが、誤接続防止のため最終的にオーナーが削除推奨
- **オーナー再実行手順（Windows cmd 形式、修正後）**:
  ```cmd
  cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-016\app

  REM 0. （任意）誤投入された local.db を退避（残しても害なし、混乱回避目的）
  ren local.db local.db.bak-2026-04-26

  REM 1. Turso へ schema を push（dotenv 修正済み、自動的に Turso へ接続）
  npm run db:push

  REM 2. seed の試走（Windows cmd 形式の環境変数）
  set DRY_RUN=true&& npm run db:seed

  REM 3. 本投入（levels/skills マスタ + 822 問）
  set SEED_LEVELS_SKILLS=1&& npm run db:seed

  REM 4. AI バルク
  npm run ai:generate-explanations
  npm run ai:generate-tts
  ```
  ※ `&&` の前に半角空白を入れない（`set X=Y&& cmd` で 1 行コマンド、空白を入れると `Y` の末尾に空白が混入する Windows cmd の罠）
- **影響**:
  - **DEC-024 の「Turso 25 テーブル作成済」は事実と異なるため訂正**。実態は「ローカル SQLite に 25 テーブル」+ 「Turso は空」
  - 上記 修正後手順 ステップ 1 (`npm run db:push`) を **オーナーが Turso 接続状態で再走必須**
  - W5 開始前の technical blocker は本修正で完全解消（手順 1〜4 で 822 問 + 解説 + TTS まで完遂可能）
  - 今後の Phase 完遂判定（DEC-026 で end-to-end smoke 必須化済）に **「`db:push` 後に Turso CLI で `SELECT count(*) FROM problems;` で実テーブル存在を確認する」** を加える
- **理由**: drizzle-kit と tsx で `.env.local` 読込ポリシーが異なる事実を 1 セッション内に CEO が誤認 → オーナー実行で 2 連続障害を発生させた。この種の「ツールチェーン境界での環境変数挙動差異」は事前検出が困難だが、実コマンド smoke を完遂判定に含めることで即時検知できる体制を確立
- **追記教訓 (オーナー実行 3 回目で発覚)**: Windows cmd の `set X=Y&& cmd` 構文は **そのセッション全体に X を設定**する（Linux の `X=Y cmd` のように 1 コマンド限定ではない）。前回オーナーが `set DRY_RUN=true&& npm run db:seed`（試走）を実行した後、その後の `set SEED_LEVELS_SKILLS=1&& npm run db:seed`（本投入のつもり）も `npm run ai:generate-explanations`（解説生成のつもり）も **すべて `DRY_RUN=true` のまま動作**してしまい、Turso へは 0 件投入だった。**今後オーナーへ提示する Windows cmd 手順は「コマンド毎に `set X=value && cmd && set X=` で挟む」または「新しい cmd ウィンドウで実行」を明示する**。長期対応として `cross-env` 導入 or `--dry-run` フラグ式へリファクタ（W5 で Dev 発令予定）

## DEC-026: W4.5 緊急補修完遂 + 設計改善承認（seed-runner / 自然 ID / `.env.local` 自動読込）（2026-04-26 / CEO）
- **オーナー報告で 2 件の本番障害を検知**:
  - 障害① `npm run ai:generate-explanations` → target=471 / **inserted=0 / skipped=471**（全件 skip、cost ¥0）
  - 障害② `npm run ai:generate-tts` → **180 件全件「OPENAI_API_KEY 未設定」失敗**（途中で出力打切）
- **根本原因 3 つ**:
  1. **`scripts/seed-problems-runner.ts` 未実装**: W2 200 + W3 401 + W4 221 = 822 問の seed データは存在するが、`problems` テーブルへ投入する runner が無かった → DB は空 → 全件 skip
  2. **fake ID 生成**: `generate-explanations-w3.ts` / `generate-tts-w3.ts` が `seed_${i.toString().padStart(4, "0")}` 形式の偽 ID を作り、DB 側の自然 ID（V5-001 等）と一切照合不能
  3. **tsx が `.env.local` を自動読み込みしない**: `.env.local` には OPENAI_API_KEY が正しく設定されていたが、tsx 単体実行では Node.js 環境変数として認識されない仕様
- **CEO 検収漏れ（DEC-025 W4 完遂報告に対する自己反省）**:
  - 「typecheck 0 / lint 0 / test 98 PASS」は内部品質しか担保できておらず、**「実 DB に問題が入っているか」「環境変数が tsx に届いているか」という end-to-end 観点が欠落**
  - 今後の Phase 完遂判定には **「smoke 完走 = 実データが DB に入っている / 実コマンド成功」** を必須項目として加える
- **CEO 直接修正**（即時、Dev 起動より速い）:
  - `package.json` の AI scripts 全 5 件 + 新規 `db:seed` に **`--env-file=.env.local`** を追加（Node 20.6+ / tsx v4.x ネイティブ対応）
  - `generate-tts-w3.ts` / `generate-explanations-w3.ts` の main 先頭に **「dryRun 以外で API key 不在なら process.exit(1)」** を追加（180 件暴走防止）
- **Dev 緊急発令（W4.5 補修、想定 0.5 人日 / 同セッション内完遂）**:
  - **新規 4 ファイル**:
    - `scripts/seed-id-mapper.ts`（約 550 行 / 822 問の自然 ID 採番を一元化）
    - `scripts/seed-problems-runner.ts`（約 380 行 / `onConflictDoNothing()` 冪等 + DRY_RUN + `SEED_LEVELS_SKILLS=1` で eiken_levels + skills マスタも upsert）
    - `tests/unit/scripts.seed-id-mapper.test.ts`（9 ケース）
    - `tests/unit/scripts.seed-runner.test.ts`（26 ケース / 822 件 / 0 重複 assert）
  - **既存修正 2 ファイル**: `generate-explanations-w3.ts` / `generate-tts-w3.ts` の fake ID 生成を撤廃、`loadAllSeedIds()` 経由に書き換え
  - **ID 衝突回避**:
    - W4 L4 listening 80 問は `L4-021〜L4-100` にシフト（W2 L4-001〜020 と衝突回避）
    - W4 R3 reading-passage 40 問は `R3-011〜R3-050` にシフト（W2 R3-001〜010 と衝突回避）
    - W4 V5 vocab 100 問は別命名空間 `V5W4-001〜V5W4-100`（W2 V5 と分離）
    - replacement: `V3-012R` / `G4-080R` は seed 内 `tags` 配列から regex 抽出
- **Dev 方針逸脱の評価（CEO 承認）**:
  - **ブリーフ T-1 = 「seed-w2/w3/w4 ファイル本体に id フィールドを追加（822 件編集）」**
  - **Dev 実装 = 「seed-id-mapper.ts に採番を集約、seed ファイル本体は不変」**
  - 理由: ① 手動 822 編集の事故リスク回避 / ② 採番ロジック単体での unit test 化（822 件 / 0 重複を assert 可能）/ ③ 機能要件（V5-001 / G5-001 / L5-001 / V5W4-001 / L4-021..100 / R3-011..050 / W3-001 / O5-001 / V3-012R / G4-080R）は **完全充足**
  - **CEO 判定 = 承認**: 機能等価かつ事故リスク低減 + テスト容易化 = 設計品質向上。今後も「機能要件を満たすより安全な代替案を提示する」Dev の主体性を歓迎する旨を記録
- **CEO 検証結果（trust but verify 厳守）**:
  - typecheck ✅ 0 errors
  - lint ✅ 0 errors / 0 warnings
  - test ✅ **133/133 PASS**（W2 60 + W3 19 + W4 19 + W4.5 35 = 累計 133 / 14 ファイル / 2.42s）
  - W4.5 は **虚偽報告なし**（W3 で発生した false-positive ゼロ）
- **オーナー再実行手順（W4.5 補修後）**:
  ```bash
  cd projects/PRJ-016/app
  DRY_RUN=true npm run db:seed                  # 件数試算（822 確認）
  SEED_LEVELS_SKILLS=1 npm run db:seed          # 本番投入（levels/skills マスタ + 822 問）
  npm run ai:generate-explanations              # 解説 AI 生成（¥210〜420 想定 / ¥500/run 上限）
  npm run ai:generate-tts                       # TTS 生成（¥30〜60 想定）
  ```
- **影響**:
  - dashboard `active-projects.md` 更新: 98 tests → **133 tests** / 「seed-runner 完備 + ID 規則統一 + .env.local 自動読込」を反映
  - W5 開始前の technical blocker は **完全解消**（オーナーが上記 4 コマンドを順に叩くだけで AI バルク投入完遂可能）
  - 残オーナー作業: ① smoke 8 項目（`reports/owner-smoke-checklist-w3.md`）/ ② Vercel 環境変数 push / ③ 上記 4 コマンド実行
- **理由**: 1 セッション内に「障害検知 → 原因究明 → CEO 直接修正 → Dev 緊急発令 → CEO 検収」を完遂。DEC-025 の検収漏れを認め、今後の Phase 完遂判定に「end-to-end smoke」を必須化することで再発防止

## DEC-025: Phase 1 W4 完遂・W5 移行承認（2026-04-26 / CEO）
- **判定**: Phase 1 W4 を **同セッション内で 3 部署並列完遂**。Dev 8 タスク（T-1〜T-8）+ Research 221 問追加 + Designer 4 ガイド納品 + ことだまトリ 2 状態追加を並列達成。**W2 → W3 → W4 完遂を 3 セッション連続**で AI 組織並列化により圧縮達成。
- **Dev 成果（T-1〜T-8 全 ◯ / 8/8 達成）**:
  - **T-1**: 模試結果画面 `/parent/mock-exam-results`（SVG 自作レーダーチャート 5 軸 / Designer ガイド準拠 / 受験日カウントダウン連動）
  - **T-2**: 受験日設定モーダル `exam-date-dialog.tsx`（shadcn Calendar + 過去日不可 + Server Action `lib/actions/exam-date.ts`）
  - **T-3**: 学習者切替 UX `learner-switcher.tsx` + `lib/study/learner-switch.ts`（複数子家族対応 / Tabs ベース / 三層認可厳守）
  - **T-4**: E2E webServer DB 切替（`playwright.config.ts` 環境変数で in-memory libSQL / Turso fixture を起動時に切替、通し E2E 実行可能化 = W3 申し送り解消）
  - **T-5**: V3-012R 本番反映（旧 V3-012 を seed-problems-w3.ts から差し替え bulk replace）
  - **T-6**: AI バルク本番実行スクリプト改善（`generate-explanations-w3.ts` の DRY_RUN を `"true"` / `"1"` 両対応に寛容化、オーナー試走想定 `MAX_PROBLEMS=10 DRY_RUN=true` を可能に）
  - **T-7**: seed-problems-w4.ts への `#` コメント混入を `//` に緊急修正（Research 生成成果物の Python 風コメントを TypeScript 通る形に補正、Dev 自己発見・自己解消）
  - **T-8**: テスト追加（Vitest +14 ケース / Playwright +5 ケース、98/98 PASS、W2 60 + W3 19 + W4 19 = 累計 98）
  - **dev-w4-report.md** 提出
- **Research 成果**:
  - 第 3 陣 **221 問**（5 級語彙 100 = V5W4-001〜100 / 4 級リスニング 80 = L4-001〜080 / 3 級リーディング 40 = R3-001〜040 passage + 2 設問構造 / 4 級文法 G4-080 改稿 1 件 = G4-080R）
  - qualityScore 平均 **0.907**（W3 0.886 から +0.021）/ 0.85+ 比率 **100%（221/221）** / G4-080 改稿（0.84 → 0.91）
  - **累計 822 問**（W2 200 + W3 401 + W4 221）
  - 著作権違反 0 / kid-safe 違反 0
  - サンプル JSON `research-w4-samples.json`（181 行）+ `research-w4-problems.md`（336 行）
- **Designer 成果**:
  - **4 レポート計約 2,598 行**:
    - `design-w4-mock-exam-results.md`（640 行 / 10 章 / SVG 自作レーダーチャート決定 = 外部ライブラリ不採用 / 5 軸スコア表示 + 受験日カウントダウン + 弱点改善提案カード）
    - `design-w4-exam-date-modal.md`（409 行 / 9 章 / shadcn Calendar + 過去日不可 + 半年合格保証発動条件説明）
    - `design-w4-learner-switch.md`（332 行 / 6 章 / 複数子家族 UX / Tabs ベース / 切替時 ARIA live region 通知）
    - `design-w4-snippets.md`（1217 行 / JSX 10 個）
  - **ことだまトリ保護者モード追加 2 状態**: 14 番目 = `parent-encouraging`（模試後の励まし表現、結果が振るわなかった保護者向け / 累計 14 状態）/ 15 番目 = `parent-planning`（受験日設定モーダル用、計画立案的な落ち着いた表現 / 累計 15 状態）
  - **マイクロコピー +12 例**（「不合格」「失敗」を回避し「あと一歩」「次に向けて」等の前向き表現に統一 / 景表法 + 子ども保護観点）
- **CEO 検証時の所見**:
  - Dev W4 の自己報告（typecheck 0 / lint 0 / test 98/98）は CEO 検証時点でグリーン確認済（W3 で発生した false-positive 報告は今回は無し）
  - Dev W4 が自己発見・自己修正した `seed-problems-w4.ts:115` の `#` コメント問題は、Research → Dev の引継ぎで言語混在による typecheck 阻害を Dev 側でキャッチアップした好事例（trust but verify を Dev 自身が実践）
- **最終ビルド結果**:
  - typecheck ✅ 0 errors
  - lint ✅ 0 errors / 0 warnings
  - test ✅ **98/98 PASS**（W2 60 + W3 19 + W4 19、約 2.0s）
- **W5 申し送り（Dev 5 件 + Research 5 件 + Designer 2 件 = 計 12 件）**:
  - Dev: ① 模試実施フロー本体実装（出題 → 解答 → 採点 → 保存）/ ② 同年齢層比較ロジック（プライバシー配慮の集計表示）/ ③ 弱点改善提案 AI 動的化（gpt-5-mini で生成、Designer 提供テンプレを動的差し替え）/ ④ オーナー smoke 8 項目完走（W3 から持ち越し）/ ⑤ AI バルク本番実行 T-3/T-4（オーナー手動）の結果反映
  - Research: ① 5 級 reading +50 / ② 5 級 listening +30 / ③ 822 問 DB seed 反映 + UI E2E / ④ TTS A/B（W3 listening 100 問）/ ⑤ 模試結果サンプルデータ（5 級 / 4 級 / 3 級 各 3 学習者分）
  - Designer: ① 模試実施フロー UI（出題画面 / タイマー / 中断救済）/ ② 比較表現倫理（同年齢層比較を傷つけない表現マイクロコピー集）
- **進捗**: PRJ-016 = **55% → 65%**（10 週中 W4 末、Phase 1 中盤通過）/ 体制 = **822 問 + 模試結果画面 + 受験日設定 + 学習者切替 + ことだまトリ 15 状態**
- **理由**: W2 / W3 同様 1 セッションで Dev / Research / Designer 並列完遂。**3 セッション連続**で AI 組織並列化が機能。W4 で「保護者向け本格 UX（模試結果 / 受験日 / 学習者切替）」と「問題プール 800 問越え」が同時達成され、β リリース要件の 8 割をクリア。
- **影響**:
  - dashboard `active-projects.md` を「Phase 1 W3 完遂・W4 移行承認」→ **「Phase 1 W4 完遂・W5 移行承認」** に更新
  - **W5 = 模試本体実装週**（出題フロー / 採点 / 同年齢層比較 / 弱点改善提案 AI 動的化 / Research +80 問 + DB seed + TTS A/B）
  - **オーナー手動作業（W5 開始前ブロッカー）**: ① owner-smoke-checklist-w3.md の 8 項目完走（W3→W4 から持ち越し中、W5 開始前までに必達）/ ② Vercel ダッシュボードに環境変数 push（W3→W4 から持ち越し中）/ ③ AI バルク本番実行 = T-3 誤答解説 600 問（¥210〜420 想定）+ T-4 TTS 200×3 voice
  - **オーナー検収タスク（軽め）**: research-w4-samples.json の 5 問を学習者目線でサンプル確認、design-w4-mock-exam-results.md の比較表現が「不合格」「失敗」を回避できているか確認

## DEC-024: Migration 戦略 = `drizzle-kit push` 採用（β 前）+ W4 着手承認（2026-04-26 / CEO）
- **オーナー報告**: `npm run db:migrate` 実行 → 「Reading config file ...」直後にプロンプト復帰、ただし Turso 側は 0 テーブル状態のままだった。
- **原因**: `drizzle/meta/_journal.json` が存在しない。Dev は W1 / W2 で `0000_initial.sql` / `0001_w2_extensions.sql` を手書き相当で生成したが、drizzle-kit が migration を認識するための meta データ（`_journal.json` + `snapshot.json`）を整備していなかった。drizzle-kit migrate は journal を起点に未適用 SQL を判定するため、journal 不在時は何もせず無音終了する仕様。
- **対応**: オーナーに `npm run db:push`（drizzle-kit push、`_journal.json` 不要で schema.ts を Turso に直接同期）を提案。実行後、**Turso 側に 25 テーブル全件作成を確認**。
- **決裁**: PRJ-016 は β 前・単一プロダクト・履歴管理の歴史的価値が低いため、当面は `drizzle-kit push` で運用。migration 履歴の正式整備は **W7（公開β準備）に DEC-XXX で再決裁**して以下のいずれかを採用:
  - 案 A: `drizzle-kit generate` で `_journal.json` + `snapshot.json` 再生成、既存 SQL を drop して新規履歴で再起動
  - 案 B: PRJ-015 で確立した `migrate-recover.ts` パターンを移植
- **理由**:
  - β 前の Schema は流動的で、push の方が反復速度が速い（数秒で完了）
  - 公開β以降は履歴管理が必要だが、それは W7 までに決めれば十分（Turso は schema 変更時にデータ吹き飛びリスクが低い、libSQL 系は ALTER TABLE が安全）
  - PRJ-015 のセッション内で「0003 snapshot 欠落 + `__drizzle_migrations` 履歴ズレ」を解決済の知見があり、移植可能
- **影響**:
  - **W4 着手前ブロッカーは大幅解消**（残: smoke チェックリスト 8 項目 + Vercel 環境変数 push）
  - **CEO 即時発令**: W4 を 3 部署並列で発令（既存 Agent への SendMessage で文脈引継ぎ + トークン節約）
  - smoke 完走と AI バルク本番実行はオーナー手動、W4 実装作業と並行で進行可能（Critical Path にしない）
  - dashboard `active-projects.md` 更新

## DEC-023: Phase 1 W3 完遂・W4 移行承認（2026-04-26 / CEO）
- **判定**: Phase 1 W3 を **同セッション内で 3 部署並列完遂**。Dev 8 タスク（T-1〜T-8）+ Research 401 問追加 + Designer 保護者ダッシュボード画面ガイド + JSX スニペット集を並列納品。W2 完遂 → W3 完遂を **2 セッション連続**で達成。
- **Dev 成果（T-1〜T-8 全 ◯）**:
  - **T-1**: in-memory libSQL E2E fixture（`tests/e2e/fixtures/db-fixture.ts` + `global-setup.ts`）。Playwright が Turso 不要で立ち上がる
  - **T-2**: 保護者ダッシュボード `/parent/dashboard` 骨組み（4 セクション = 今週サマリー / 受験日カウントダウン / 直近誤答 TOP5 / 学習停止リマインドフック）+ `(parent)/layout.tsx` + `aggregations.ts` + `parent-dashboard.ts` Server Action。三層認可（requireParent + requireFamilyMember + scopedQueries）厳守
  - **T-3**: AI コーチ誤答解説 bulk 生成スクリプト `scripts/generate-explanations-w3.ts`（実装のみ・実行はオーナー）+ 管理用コストガード ¥500/run 上限
  - **T-4**: TTS バルク事前生成スクリプト `scripts/generate-tts-w3.ts`（5 級語彙 200 問 × 3 voice / 約 ¥30〜60、実装のみ）
  - **T-5**: shadcn/ui 4 component 追加（`progress` / `sheet` / `dialog` / `tabs`）+ Radix 3 dep（@radix-ui/react-{progress,dialog,tabs}）追加
  - **T-6**: 1 問差し替えヘルパ `scripts/replace-problem.ts` + `npm run ai:replace-problem`
  - **T-7**: テスト追加（Vitest 3 本 = study.aggregations 10 ケース / parent.dashboard 6 ケース / scripts.replace-problem 3 ケース、Playwright 1 本 = parent-dashboard-flow）
  - **T-8**: オーナー手動 smoke チェックリスト `reports/owner-smoke-checklist-w3.md`（db:migrate / gpt-5-mini / Moderation / Sonnet 4.5 / tts-1 / Resend / R2 / Vercel env の 8 項目を curl コマンド + 期待出力 + 失敗時原因付きで整理）
  - **dev-w3-report.md** 提出
- **Research 成果**:
  - 第 2 陣 **401 問**（5 級リスニング 100 + 4 級文法 150 + 3 級ライティング 100 + 5 級並べ替え 30 + 4 級リーディング 20 + V3-012R 1）
  - qualityScore 平均 **0.886** / 0.85+ 比率 **99.75%（400/401）** / 残り 1 件は W4 改稿候補
  - **V3-012 改稿**: 旧 0.84 → 新 V3-012R 0.91（distractor を「has written」に強化、受動態 vs 能動完了形の典型混同を直接問う形に）
  - 著作権違反 0 / kid-safe 違反 0
  - ライティング採点ルーブリック: 公式英検 4 観点（Content / Organization / Vocabulary / Grammar 各 0-4 = 16 点、英検協会 2017 リニューアル基準を Web 確認）+ HANEI 内部 5 軸（各 0-20 = 100 点）併設、模範解答自己採点平均 15.3/16（95.6%）
  - サンプル JSON 6 問（オーナー検収用）+ research-w3-problems.md（7 章フル）
- **Designer 成果**:
  - `design-w3-parent-dashboard.md`（780 行 / 10 章）+ `design-w3-parent-snippets.md`（735 行 / JSX 8 個 = ParentHeaderBar / GreetingBanner / SummaryCard / ProgressChart / RecentMistakes / InactivityReminder / CoachingSettings / ParentDashboardPage）
  - **学習者画面とのトーン差別化（保護者 = 敬語 + 落ち着き + 情報密度）**:
    - 文体: やさしい日本語 + ふりがな → 敬語 + 丁寧語 + ふりがな最小
    - 装飾: rounded-3xl + グラデ + 紙質感 → rounded-2xl + フラット + 線で区切る
    - アニメ: 正解 pop / 誤答 shake → カード fade-in 200ms のみ + reduced-motion 厳守
  - ことだまトリ保護者モード 3 状態追加（parent-greeting / parent-alert / parent-celebrate）= W1 character ガイドの命名規則 `parent-{intent}` を踏襲、配色 + キャラ表現フル記述
  - マイクロコピー +20 例（敬語ベース、エンカレッジ / アラート / 進捗 / リマインド 各 5 例、全文末「ですます調」確認済）
  - WCAG AA 全本文組合せコントラスト保証 + ARIA + reduced-motion + キーボード + SR 全章
- **CEO 検証時に発見した typecheck エラー 3 件と即修正**:
  - Dev エージェントは「typecheck 0 errors」と報告したが、CEO 検証で `seed-problems-w3.ts:2173` の destructuring swap が `noUncheckedIndexedAccess` 違反 + `generate-explanations-w3.ts:142` の seed-w3 import 型不整合（Research が default export を W3Bundle オブジェクト、Dev が配列前提で書いていた）の 3 件を発見
  - CEO 直接修正: ① swap を `as string` ガード + 個別代入に書き換え、② w3 import を `w3Module.default.allChoiceProblems` 経由（writing/reorder 除外）に変更
  - **trust but verify 原則の有効性確認**: 部署エージェントの「全緑報告」を鵜呑みにせず CEO が再走したことで本番投入前に検出
- **最終ビルド結果**:
  - typecheck ✅ 0 errors
  - lint ✅ 0 errors / 0 warnings
  - test ✅ **79/79 PASS**（W2 60 + W3 19、9 ファイル / 1.79s）
- **W4 申し送り（Dev 5 件 + Research 5 件 + Designer 3 件）**:
  - Dev: ① E2E webServer DB 切替で通し E2E 実行可能化 / ② AI バルク T-3/T-4 を DRY_RUN=1 → 全件本番（¥180〜360 想定）/ ③ V3-012R 本番反映 / ④ オーナー smoke 8 項目完走 / ⑤ shadcn dialog/tabs の活用先確保（学習者切替 Tabs / 設定 Dialog）
  - Research: ① 5 級語彙 100 問追加 / ② 4 級リスニング 80 問追加 / ③ 3 級リーディング 50 問追加 / ④ 0.84 改稿候補 1 件差し替え / ⑤ W3 listening 100 問 TTS A/B テスト
  - Designer: ① 模試結果画面 `/parent/mock-exam-results` / ② 受験日設定モーダル中身完成（shadcn Calendar + 過去日不可）/ ③ 学習者切替 UX 検証（複数子家族）
- **進捗**: PRJ-016 = **45% → 55%**（10 週中 W3 末、Phase 1 半分通過）
- **理由**: W2 同様 1 セッションで Dev / Research / Designer 並列完遂 + CEO 検証で型不整合を即修正。AI 組織並列化のパターンが Phase 1 全週で機能していることを再確認。
- **影響**:
  - dashboard `active-projects.md` を「Phase 1 W2 完遂・W3 移行承認」→ **「Phase 1 W3 完遂・W4 移行承認」** に更新
  - W4 はリーチ広い拡張週（追加問題 230 問 + 模試結果画面 + 学習者切替 UX + 全 600 問の AI 解説バルク本番実行 + TTS バルク本番実行）
  - **オーナー手動作業（W4 開始前ブロッカー）**: ① `npm run db:migrate` 実施 / ② owner-smoke-checklist-w3.md の 8 項目完走 / ③ Vercel ダッシュボードに環境変数 push（W3 開始前ブロッカーから持ち越し中、W4 開始前までに必達）
  - **オーナー検収タスク（軽め）**: research-w3-samples.json の 6 問を学習者目線でサンプル確認、design-w3-parent-dashboard.md の保護者トーンが意図と合うか確認

## DEC-022: ESLint flat config 完全移行 + Sentry v10 + drizzle 系 peer dep 整理（2026-04-26 / CEO）
- **オーナー報告**: DEC-021 適用後、`npm run lint` が `TypeError: Converting circular structure to JSON --- property 'react' closes the circle` で起動不能。typecheck / test は全緑。
- **原因**:
  - `FlatCompat.extends("next/core-web-vitals", "next/typescript")` 経由で eslint-config-next を継承すると、内部で `eslint-plugin-react` 等の循環参照を含む plugin オブジェクトを `JSON.stringify` しようとして起動失敗。
  - eslint-config-next v16.2.4 は **ネイティブ flat config exports** を `./core-web-vitals` / `./typescript` で公開しているため、FlatCompat 自体が不要だった。
- **修正**:
  1. **eslint.config.mjs**: FlatCompat を撤去し `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` を直接 import する flat config に書き換え（カスタム 三層認可ルール + `@typescript-eslint/no-explicit-any: error` + guards.ts/scoped.ts 例外は維持）
  2. **package.json**:
     - `@eslint/eslintrc` devDep 削除（FlatCompat 不要のため）
     - `@typescript-eslint/eslint-plugin` / `@typescript-eslint/parser` devDep 削除（eslint-config-next が `typescript-eslint` umbrella で同梱）
     - `@sentry/nextjs` `^9.0.0` → `^10.0.0`（v9.47.1 の peer は Next 15 まで、v10.50.0 で `^16.0.0-0` 対応）
     - `drizzle-orm` `^0.36.4` → `^0.45.2`（better-auth@1.6.9 の peerOptional 整合）
     - `drizzle-kit` `^0.30.1` → `^0.31.4`（同上）
  3. **.eslintrc.json**: 削除（flat config に完全移行）
  4. **コード警告 7 件除去**: `JUDGE_SYSTEM_PROMPT` → `_JUDGE_SYSTEM_PROMPT`（W3 用予約）/ `page.tsx` の未使用 `CardContent` 削除 / `study.ts` と `guards.ts` の不要な inline `eslint-disable` 撤去
- **理由**:
  - eslint-config-next の native flat config を活用することで FlatCompat 経由の循環参照を回避し、保守性が大幅に向上
  - drizzle 系を better-auth の peer に整合させることで `--legacy-peer-deps` フラグ無しでクリーン install できる状態に到達
  - Sentry v10 は SDK の API 互換が v9 とほぼ同一で typecheck / test に影響なし
- **影響**:
  - `npm install` ✅ no peer conflict / 814 packages
  - `npm run typecheck` ✅ 0 errors
  - `npm run lint` ✅ 0 errors / 0 warnings（完全グリーン）
  - `npm run test` ✅ 60/60 PASS（6 ファイル / 1.6s）
  - W3（実装着手）への blocker は完全解消

## DEC-021: typecheck / lint / test エラー一括修正（2026-04-26 / CEO）
- **オーナー報告**: `npm install` 通過後の `npm run typecheck` で 12 errors / `npm run lint` で `next lint` 廃止エラー / `npm run test` で 4 fail。
- **修正内容**:
  1. **next.config.ts**: Sentry v9 で廃止された `hideSourceMaps: true` を削除
  2. **src/lib/ai/openai.ts**: AI SDK v4 仕様に合わせ `maxOutputTokens` → `maxTokens`（型 + 4 callsite）
  3. **src/app/api/ai/coach/route.ts**: `usage.inputTokens/outputTokens` → `usage.promptTokens/completionTokens`、`maxOutputTokens` → `maxTokens`
  4. **src/lib/srs/fsrs.ts**: ts-fsrs v4.6.1 の Card 型に存在しない `learning_steps: 0` を削除
  5. **scripts/seed-problems-w2.ts**: `noUncheckedIndexedAccess` strict 対応で `as string` ガード追加
  6. **tests/unit/ai.coach.test.ts**:
     - `NG_WORDS_JA` / `NG_WORDS_EN` の import 元を `@/lib/ai/moderation` → `@/lib/ai/safety/ng-words` に変更（実際の export 元）
     - `detectNgWords()` の戻り値が `NgWordEntry[]` のため `expect(hits.map((h) => h.word)).toContain(...)` に修正
     - `ENCOURAGEMENT_PHRASES` 末尾正規表現に「ました」「ましょう」+ 末尾「。」許容を追加
  7. **package.json**: `"lint": "next lint"` → `"lint": "eslint ."`（Next.js 16 で next lint 廃止）+ devDeps `@eslint/eslintrc ^3.2.0` 追加
  8. **eslint.config.mjs** 新規: ESLint v9 flat config（`FlatCompat` 経由で `next/core-web-vitals` + `next/typescript` 継承 + 三層認可カスタムルール + guards.ts/scoped.ts での例外）
  9. **.eslintrc.json**: 残置（flat config 優先で動作影響なし、W3 で削除予定）
- **理由**: W2 で導入したライブラリのバージョン更新による API 変更追従 + Next.js 16 移行に伴う ESLint v9 flat config 化 + ts-fsrs strict 対応 + テスト戻り値型整合
- **影響**:
  - 依存追加 1 件のみ（@eslint/eslintrc）→ `npm install --legacy-peer-deps` を 1 回再実行
  - typecheck / lint / test = 全緑見込み

## DEC-020: npm install ETARGET 修正 = @anthropic-ai/sdk のレンジ拡大（2026-04-26 / CEO）
- **オーナー報告**: `npm install --legacy-peer-deps` で `@anthropic-ai/sdk@^0.34.0` の ETARGET エラー。caret semver の 0.x 挙動（`>=0.34.0 <0.35.0`）に対し、レジストリに 0.34.0 が存在しない。
- **原因**: 前任 Dev は W1 時点の Anthropic SDK 進行を `^0.34.0` と推測したが、実 publish は別バージョン番号で進行していた可能性が高い。
- **修正**: `package.json` の `@anthropic-ai/sdk` を `^0.34.0` → `>=0.30.0 <1.0.0` に変更。
- **理由**:
  - 実装側の使用箇所は `src/scripts-runtime/judge-problem-runtime.ts` の `import Anthropic from "@anthropic-ai/sdk"`（default import のみ）+ scripts コメント参照のみ。SDK の API 変更影響を最小限にできる
  - レンジを v0 系全体（0.30〜0.99）に広げることで、レジストリ実在の最新 patch を確実に取得
  - v1 メジャーがリリースされても import パス変更で破綻するリスクを避けるため `<1.0.0` で上限固定
- **影響**:
  - オーナーは `npm install --legacy-peer-deps` 再実行で進行可能
  - W3 で Anthropic SDK の正式 v1 移行を計画（その際は default import → named export `import { Anthropic }` の API 確認が必要）
- **追加ガード**: 同様の caret 0.x ETARGET リスクのある依存はないか package.json を点検 → 他は `^1.0.0` 以上 or `^0.x` でも安定リリース範囲のため問題なし

## DEC-019: npm install ERESOLVE 修正 = @sentry/nextjs を v9 に格上げ（2026-04-26 / CEO）
- **オーナー報告**: `npm install` で `@sentry/nextjs@^8.45.0` の peer 競合（peer = `next@^13.2.0 || ^14.0 || ^15.0.0-rc.0`、現状 next 16.2.4）で ERESOLVE エラー。
- **原因**: Sentry Next.js SDK v8 系は Next.js 15 までの対応。Next.js 16 を peer に含むのは v9 以降。
- **修正**: `package.json` の `@sentry/nextjs` を `^8.45.0` → `^9.0.0` に更新。
- **理由**: フォロー Dev は Sentry 配線（`sentry.client.config.ts` / `server` / `edge` / `instrumentation.ts` / `withSentryConfig`）を v8 / v9 共通の API で書いており、メジャー上げによる API 破壊は限定的。Next 16 ネイティブ対応で peer 警告解消。
- **代替策**: 仮に `^9` でも別 peer 警告が残る場合は `npm install --legacy-peer-deps` で一旦進める。Sentry SDK v10 が Next 16 stable 以降の主流になり次第 W3 で `^10.0.0` 化を検討。
- **影響**:
  - オーナー再 install で解消想定
  - Sentry config 4 ファイル + `withSentryConfig` 設定は **既存コード無修正で動作**（Sentry v9 の breaking change は主に opt-in 設定で、デフォルト動作維持）
  - W3 で実際に Sentry にエラーを送って疎通確認（オーナー手動 smoke）

## DEC-018: Phase 1 W2 完遂・W3 移行承認（2026-04-26 / CEO）
- **判定**: Phase 1 W2 を **同セッション内で完遂**。Dev 9 タスク（T-1〜T-9）+ Research 200 問シード + Designer 3 画面実装ガイド v2 を並列納品。
- **Dev 成果**:
  - **Drizzle schema +15 テーブル** (sessions / accounts / verifications / daily_plans / streaks / xp_levels / badges / user_badges / mock_exam_results / ai_coach_conversations / ai_coach_messages / mastery_estimates / characters / generated_problems_queue / problem_explanations / exam_dates) → `drizzle/0001_w2_extensions.sql`
  - **Better Auth 完成形** = signup → email verification → login → session（13 歳未満同意フロー含む）
  - **学習 UI v1** = `/study/[levelCode]/[skillCode]` 実装、4 択 + 解説 + ts-fsrs SRS 更新（ts-fsrs 4.6.1）
  - **AI コーチ実 API** = gpt-5-mini streaming + 三重ガード（NG 60 語 + Moderation + 出力フィルタ）+ tool use 4 関数 + ¥10/日コストガード
  - **LLM-as-Judge Inline Cron** = 02:00 JST 毎日、最大 50 問 / ¥100/日 上限
  - **TTS / R2 / Resend / Sentry / Vercel Analytics + Speed Insights** 全配線
  - **テスト**: Vitest 3 本（srs.fsrs / ai.cost-guard / auth.actions）+ Playwright 2 本（study-loop / parent-consent）追加
  - **dev-w2-report.md** + README W2 チェックリスト 10 項目チェック済
- **Research 成果**: `seed-problems-w2.ts` に **200 問シード**（5級 vocab60 + grammar30 / 4級 vocab50 + listening20 / 3級 vocab30 + reading10）、自己採点平均 **0.905** / 0.85 以上 199/200（**99.5%**）、唯一の閾値割れ V3-012 受動態は W3 改稿候補。サンプル JSON 6 問（オーナー検収用）+ correct_index 均等化ヘルパ同梱。著作権セーフ + kid-safe NG 0 件。
- **Designer 成果**: `design-w2-screens-v2.md`（home / study / diagnosis 3 画面 / 8 章 / Tailwind フル指定 + framer-motion `useMotionVariant` + ARIA + reduced-motion）+ `design-w2-style-snippets.md`（コピペ用 JSX 12 個）。ことだまトリ 10 状態マッピング表 + マイクロコピー +30 例（合計 116 例文）。shadcn/ui 追加 install 申し送り: `progress` / `sheet` / `dialog` / `tabs`。
- **W3 への申し送り**:
  1. 本格 E2E（in-memory libSQL 化）+ TTS バルク事前生成（オフラインキャッシュ）
  2. 保護者ダッシュボード骨組み（週次レポート / 受験日カウントダウン / 学習停止リマインド送信フック）
  3. Research 第 2 陣 400 問（5級リスニング + 4級文法 + 3級ライティング優先）+ V3-012 改稿
  4. AI コーチ誤答解説生成の本格化（problem_explanations への bulk insert）
  5. shadcn/ui 追加 4 components install + Designer Snippet 反映
- **オーナー手動作業（W3 開始前ブロッカー）**:
  - `npm install`（ts-fsrs / @sentry/nextjs / @vercel/analytics / @vercel/speed-insights / 等）
  - `npm run db:migrate`（0001_w2_extensions.sql 適用）
  - 実 API smoke test（gpt-5-mini streaming / Moderation / Anthropic Sonnet 4.5 / OpenAI tts-1 / Resend）
  - Vercel 環境変数 push（既設定済の `.env.local` を Vercel ダッシュボードに反映）
- **進捗**: PRJ-016 = **38% → 45%**（10 週中 W2 末）
- **理由**: W1 同様 1 セッション内に Dev / Research / Designer 並列で W2 を完遂。Dev は T-6 でストールしたが、フォローエージェントが残作業（TTS / Sentry / Analytics / W2 テスト 5 本 / 報告書）を補完。
- **影響**: dashboard `active-projects.md` を「W2 着手中」→ **「Phase 1 W2 完遂・W3 移行承認」** に更新

## DEC-017: W2 着手承認 = 環境変数設定完了 + R2 公開URL方針確定（2026-04-26 / オーナー回答 + CEO）
- **オーナー回答**: 「一通り環境変数の設定も完了しました。続きの実装を進めてください」+ 「W4 までは r2.dev、W5 で Custom Domain 切替。これで進めて良いです」
- **判定**: DEC-015 で挙げた W2 着手前ブロッカー 6 件（Turso DB / OpenAI + Anthropic API キー / Cloudflare R2 / Resend / Better Auth secret / `.env.local`）が全解消。**W2 を本日中に並列発令**。
- **理由**: 環境変数設定完了 → AI 実 API 疎通 / Turso 実 DB マイグレーション / R2 実バケット書き込みの 3 ブロッカーが消滅。W2 のスコープ（残り 15 テーブル + Better Auth 完成形 + AI コーチ実 API + ts-fsrs SRS + 学習 UI v1）に集中可能。
- **影響**:
  - W2 並列発令: Dev（重） + Research（実問題 200 問生成 + LLM-as-Judge 採点） + Designer（画面実装ガイド v2）
  - dashboard `active-projects.md` を「W1 完遂 + W2 移行承認」→「**W2 着手中**」に更新
  - W2 ゴール: 学習者が signup → email verify → login → onboarding → home → 語彙学習 1 セット → 誤答解説 → SRS 状態更新 まで end-to-end で動作

## DEC-016: R2 公開 URL = W4 まで r2.dev / W5 で Custom Domain 切替（2026-04-26 / オーナー承認 / CEO）
- **オーナー承認**: 「W4 までは r2.dev、W5 で Custom Domain 切替。これで進めて良いです」
- **決裁**: Cloudflare R2 の音声ファイル公開 URL は **W1〜W4 = `pub-xxxxx.r2.dev`（無料・即発行）**、**W5 で `audio.hanei.app` に Custom Domain 切替**（DEC-013 ドメイン取得後）。
- **理由**:
  - W1〜W4 は実装速度優先で r2.dev を直接埋め込み（即時稼働 + DNS 設定不要）
  - W5 でドメイン取得 + Custom Domain 切替によりブランディング統一 + CDN キャッシュ最適化
  - 切替時は `R2_PUBLIC_URL` 環境変数の値を変更するだけで完結（コード側の参照は env から）
- **影響**:
  - `.env.local.example` の `R2_PUBLIC_URL` コメントに「W4 まで r2.dev / W5 で audio.hanei.app」を追記
  - 監視: W4 末に Custom Domain 切替タスクを W5 着手前ブロッカーに昇格
  - 切替時の R2 オブジェクト URL 互換性確認（既存音声ファイルが切替後も再生可能であること）E2E 1 本追加

## DEC-001: 案件起案・PRJ-016 採番（2026-04-26）
- **決裁**: CEO
- **内容**: 小学生向け英語学習Webアプリを PRJ-016 として採番、Phase 0 を即時着手。
- **理由**:
  - オーナーから「最高の英語アプリを作りたい」「英検5級〜3級」「半年で英検3級合格」「AIコーチ」「ゲーミフィケーション」「徹底デザイン」「PC/スマホ Webアプリ」という明確な要件が提示された。
  - 自社プロダクト枠で個人開発、ランニング極小化が要件のため Phase 0 で技術スタック・コスト・問題プール戦略を徹底検証する必要がある。
- **影響**: `dashboard/active-projects.md` に PRJ-016 行を追加、次案件IDを PRJ-017 に進める。

## DEC-015: W1 完遂・W2 移行承認（2026-04-26 / CEO）
- **判定**: Phase 1 W1 を **本セッション内で完遂**。受入基準 11 項目（review-phase0-gate.md §8.3）を満たす状態に到達。
- **成果物**:
  - **Dev**: `projects/PRJ-016/app/` 配下に **62 ファイル scaffold**（package.json + Next.js 16 + Drizzle 10 テーブル + Better Auth + 三層認可（proxy.ts + guards.ts + scoped.ts + ESLint カスタム）+ AI コーチ最小（kid-safe prompt + 三重ガード moderation + tool use 4 関数）+ LLM-as-Judge PoC（生成 + 採点）+ 学習者導線4ページ（signup/login/onboarding/home）+ Amber Gold トークン v1 + CI 5 ジョブ + テスト雛形 4 本 + ER 図 + DEPLOYMENT.md + README）
  - **Designer**: 4 レポート（design-w1-tokens.md / design-w1-character.md / design-w1-screens.md / design-w1-microcopy.md = 86 例文）= **WCAG AA 全本文組合せ保証** + ことだまトリ 10 ポーズ生成プロンプト + 主要6画面 Tailwind クラス指定で実装可能レベル
  - **Research**: 4 レポート（research-w1-models.md / -trademark.md / -llm-judge.md / -legal-kidsafe.md）= **gpt-5-mini 公式仕様再確認（$0.25/$2.00・cached $0.025・400K・SO/FC/Vision 全対応）+ Sonnet 4.5 cross-LLM judge 1,600 問 ¥1,500-3,500 試算・AI ユーザー単価 ¥4.86/日（K-6 余裕クリア）** + 商標 HANEI 第9/41/42 類で日本国内 EdTech 衝突未確認（最終確認は J-PlatPat 公式画面要）+ ドメイン推奨 hanei.app/.jp/-app.com（hanei.com 既登録）+ 危機検知 60 語 + L1-L4 通知 + プラポリ13章雛形
- **理由**: 3 部署並列 + DEC-010〜014 の決裁が同セッション内に完了したため、W1 を本日中に着手 → 完遂まで進めた。**Phase 0 起案 → Phase 0 完遂 → オーナー回答 → DEC-010〜014 → W1 並列実装 → W1 完遂 を 1 セッションで達成**（PRJ-015 のパターンを上回る速度）。
- **影響**:
  - W2 着手承認: 残り 15 テーブル拡張 + Better Auth 完成形 + AI コーチ実 API 疎通 + ts-fsrs SRS 統合
  - **オーナー手動作業（W2 開始前ブロッカー）**: ① Turso DB 作成 + 接続文字列取得 / ② OpenAI API キー（gpt-5-mini 利用権限）+ Anthropic API キー（cross-LLM judge 用）/ ③ Cloudflare R2 バケット作成 + アクセスキー / ④ Resend API キー / ⑤ Better Auth secret 生成 / ⑥ `.env.local` 設定（30〜60 分）
  - dashboard `active-projects.md` を W1 完遂 + W2 移行に更新

## DEC-014: W1 着手命令発令 = 全ブロッカー解消 → Phase 1 開始（2026-04-26 / CEO）
- **決裁**: DEC-010〜013 で W1 着手前ブロッカーが全て解消されたため、**Phase 1 W1 を即時着手命令**として発令する。
- **W1 ゴール**: review-phase0-gate.md §8 を踏襲（料金関連を削除）。Next.js 16 + Turso + Drizzle + Better Auth + Tailwind v4 + shadcn/ui + Heroicons + デザイントークン v1（Amber Gold）+ CI + ER 図 v1 + 保護者サインアップ → ログイン動作 + AI SDK（gpt-5-mini）疎通。
- **並列起動部署**: Dev（実装）/ Designer（トークン v1 + キャララフ）/ Research（gpt-5-mini 実 API 疎通 + 商標 + ドメイン）。
- **理由**: A-01〜A-05 オーナー回答受領、課金不要・外注なし方針確定で計画が単純化。即着手で本日中に W1 進捗を最大化する。
- **影響**: 本日（2026-04-26）中に W1 並列実行 → 同日中に Day1〜2 相当の成果物を `projects/PRJ-016/` 配下に納品。

## DEC-013: Vercel = 既存 Pro プラン運用継続（2026-04-26 / CEO）
- **決裁**: オーナーの A-02 回答により、**Vercel Pro $20/月で既に運用中**。Phase 1 はこのまま Pro プランを使用する。
- **理由**: PRJ-016 専用に新規 Pro 契約する必要はなく、既存組織アカウントの Pro 枠で deploy 可能。Hobby 商用禁止条項の懸念も自動的に解消。
- **影響**:
  - DEC-003 のスタック「Vercel Hobby（β）→ Pro（公開β）2 段階」を **「Pro 単一」に簡素化**
  - Dev のコスト試算「β期間 Hobby ¥0 / 公開β以降 +$20」は「常時 Pro $20」に統一
  - 月額試算（β 100名）は ¥1,200 → **約 ¥4,200**（+ Pro $20 ≒ ¥3,000）に修正、500 名規模で月 ¥27,000 程度。
  - W1 タスクから「Hobby → Pro 切替計画」を削除、即 Pro deploy 可。

## DEC-012: 料金システム実装 = Phase 1/2 ともに未実装、無料運用前提（2026-04-26 / CEO）
- **決裁**: オーナー指示により、**現時点で料金面の実装は不要**。Phase 1（β）+ Phase 2（公開β）まで完全無料アプリとして開発し、課金システム（Stripe / Stripe Checkout / Stripe Portal / Stripe Webhook / 価格テーブル / プラン切替 / 領収証 等）は **Phase 3 以降で別途検討**する。
- **理由**: オーナーの「まずは無料で提供することを前提に作成、将来的に料金化を検討」という方針により、Phase 1 MVP のスコープが大幅に簡素化。学習体験そのものの完成度・問題プール品質・AI コーチ品質に開発リソースを集中できる。
- **影響**:
  - **DEC-006 を全面置換**: Phase 1 = 完全無料 / Phase 2 = 完全無料（公開β拡大のみ） / Phase 3 = 課金検討
  - Marketing の 3 プラン提案（無料/STANDARD ¥1,980/GOAL ¥2,980）は **Phase 3 以降の参考案として温存**、Phase 1〜2 LP では「無料」一本訴求
  - 「半年合格保証（3か月分返金 or 延長）」（DEC-005）は **無料サービスのため発動条件から「返金」を削除し「学習プラン延長＋手厚いコーチング」のみ**に再定義（Phase 2 で発動）
  - PM の WBS から「課金関連 Stripe 統合タスク（5〜8人日相当）」を削除 → **Phase 1 MVP は 48.5 人日 → 約 42 人日に縮小**
  - 受入基準 68 項目から課金関連項目（M-1 半年合格保証含む）を **Phase 3 送り**、Phase 1 MVP のゲート項目は **約 60 項目**に整理
  - AI 利用コストは無料運用前提なのでオーナー個人負担。1 ユーザー 1 日 ¥10 以下の K-6 厳格化は維持し、**Moderation + プロンプトキャッシング + コンテキスト圧縮 + RAG 切替** で Phase 1 中に常時監視

## DEC-011: 問題プール戦略変更 = 外注なし / AI 自動生成 + LLM-as-Judge + オーナー抜き取り検収（2026-04-26 / CEO）
- **決裁**: オーナーの A-03 回答により、**人手検収の外注予算 ¥30〜50 万を撤回**。問題プール 1,600 問は以下のパイプラインで内製する。
  1. **生成**: gpt-5-mini で英検公式仕様（語彙数 / 出題形式 / 採点基準）に沿った問題を生成（プロンプトには級別出題範囲・公式採点ルーブリック・kid-safe 制約を明記）
  2. **第1次自動QA（LLM-as-Judge / cross-LLM）**: Claude Sonnet 4.5 もしくは gpt-5（フル）で「正解の妥当性 / 選択肢の適切性 / 難易度の整合 / 著作権侵害ソース文の混入なし / 子ども不適切表現なし」を採点。閾値未満は自動却下 → 再生成。
  3. **第2次決定論的QA**: 重複検出（埋め込み類似度 0.92 以上は重複扱い）+ 文字数 / 設問形式 / メタデータ完全性チェック
  4. **第3次サンプリング検収**: 各級各技能から **5%（80 問程度）** を CEO（or オーナー）が日々学習 UI 上で目視チェック、誤りはマーキングして再生成キューへ
  5. **学習者フィードバックループ**: ユーザー誤答時の「この問題おかしい」報告ボタン + AI コーチが解説不可能と判定した問題を自動で再生成キューへ
- **理由**:
  - 外注ゼロでも cross-LLM verification + 決定論的 QA + 学習者フィードバックの 4 層防衛で実用品質に到達可能
  - PRJ-014（GENBA Visual）で AI 生成 + 自動 QA + サンプリングの実運用を確立済み、横展開が容易
  - オーナー抜き取り検収を「日々 5 問 × 16 週 = 80 問」程度に分散すれば負担小（1 日 5 分程度）
- **影響**:
  - PM の WBS 4.3「人手検収外注 2 人日 + ¥30 万予算」を **「LLM-as-Judge パイプライン構築 4 人日 + オーナー抜き取り 0.1 人日/日 × 80 日」** に修正
  - Dev の seed-problems.ts に **`generation_quality_score` カラム + `qa_verdict` 履歴テーブル** を追加（Phase 1 設計時）
  - 受入基準 W4 中間ゲート「800 問サンプリング 3 問でレビュー部門合格」は維持（cross-LLM のスコア閾値で自動判定 + サンプリングは CEO/オーナーが 1 日数問）
  - W1 タスクに「LLM-as-Judge パイプライン PoC（gpt-5-mini 生成 → Claude Sonnet 4.5 採点）」を追加（0.5 人日）

## DEC-010: オーナー A-01〜A-05 回答受領（2026-04-26 / オーナー回答）
- **A-01（命名 HANEI）**: ✅ 推奨で進行 → DEC-004 維持。Research の J-PlatPat 第9・41類本格商標検索 + ドメイン取得確認は引き続き W1 内で実施。
- **A-02（Vercel Pro 移行）**: ✅ **既に Vercel Pro で運用中** → DEC-013 として独立記録、DEC-003 のスタックを「Pro 単一」に簡素化。
- **A-03（外注予算 ¥30〜50 万）**: ❌ **外注なし** → DEC-011 で問題プール戦略を「AI 自動生成 + LLM-as-Judge + オーナー抜き取り検収」に全面変更。
- **A-04（半年合格保証 Phase 2 発動）**: ✅ 推奨で進行 → DEC-005 維持。ただし DEC-012（無料化）により「返金」要素は撤回、「学習プラン延長＋手厚いコーチング」のみで発動。
- **A-05（クローズドβ 30〜50 家庭 / X + 知人募集）**: ✅ 推奨で進行 → Marketing 案を採用、Phase 1 W7-W10 で募集準備、W10 リリースゲート通過と同時に募集開始。
- **追加指示**: **「料金面の実装は現時点で不要。まずは無料で提供することを前提に作成。将来的に料金化を検討」** → DEC-012 で全面反映。

## DEC-009: Phase 0 完了承認 + Phase 1 → CONDITIONAL GO（2026-04-26 / CEO）
- **判定**: Phase 0 を完了承認、Phase 1 W1 着手は **CONDITIONAL GO**。
- **条件**: 以下「W1 着手前ブロッカー」が全部解消されてから W1 を開始する。
  1. オーナー軽承認 A-01〜A-05（後述 7 章）が回答 or タイムアウト時に CEO 推奨案で進行
  2. Research 部門の gpt-5-mini 実 API 疎通確認（応答時間 / コスト / Structured Outputs 対応）完了
  3. Research 部門の J-PlatPat 第9・41類で「HANEI」本格商標検索 + ドメイン取得確認完了
  4. PM 部門の WBS 4.3「人手検収外注前提で 2人日 + ¥30万予算」修正完了
  5. Dev 部門の月額コスト試算「β=Hobby / 公開β以降=Pro」2段階修正 + AI モデル「gpt-5-mini 主軸 / gpt-4.1-mini フォールバック」修正完了
- **理由**: 5部署のレポート品質は A 評価だが、DB/Auth/Storage / 問題プール規模 / 課金モデル / KPI / 命名カラー の整合性が C-。W1 着手前に 5 部署横断で根幹を揃えないと中間レビュー以降で手戻り発生。CEO が下記 DEC-003〜008 を即決し、決裁を 1 セッションで完遂する。
- **影響**: dashboard の Phase 0 → Phase 1 移行記録、reports/review-phase0-gate.md §6 の前提条件を踏襲。

## DEC-008: 受入基準・品質ゲートを Review 部門統合版で確定（2026-04-26 / CEO）
- **決裁**: W4（12項目）/ W8（22項目）/ W10（34項目）= **合計 68 項目**を確定。Review 部門の review-phase0-gate.md §9 を正式採用。
- **理由**: PM 24 項目 + 過去案件（PRJ-014/015）知見 + Research 結論（kid-safe / コスト / 合格率）を反映した統合版が最堅牢。子ども向け固有 6 項目（K-1 タップ領域 56/48px、K-2 文字サイズ + ふりがな、K-3 保護者同意 E2E、K-4 NGワード 100語＋人手レビュー違反 0、K-5 応答時間 P95、K-6 AI コスト ¥10/人/日以下）を厳格に守る。
- **影響**: Lighthouse a11y は 100（Design 推奨）に統一、AI コスト閾値は ¥30 → ¥10/人/日 に厳格化。

## DEC-007: 問題プール Phase 1 規模 = 1,600 問 + 外注予算 ¥30〜50 万（2026-04-26 / CEO）
- **決裁**: Phase 1 = 5級400問 / 4級500問 / 3級700問 = **1,600 問**を投入。Phase 2 で 5,000 問規模に拡張。
- **理由**: Research = 6,000 / PM = 1,600 / Dev = 9,000 と乖離していたが、半年で英検3級合格を支える最小ライン（PM 受入基準のベース）+ AI 生成 + 人手検収（外注）コストの現実解として 1,600 問で着地。**英検過去問の流用は著作権侵害となるため 100% 自社オリジナル AI 生成 + 人手検収パイプラインを採用**（Research §7-3 一致）。外注予算 ¥30〜50 万を別予算化。
- **影響**: PM の WBS 4.3 を 4 人日 → **2 人日（管理工数のみ）+ ¥30 万予算** に修正。Dev の seed-problems.ts 生成スクリプトは 1,600 問を上限に調整。

## DEC-006: 課金モデル = Phase 1 完全無料 / Phase 2 で 3 プラン投入（2026-04-26 / CEO）
- **決裁**:
  - Phase 1 MVP = **完全無料**（クローズドβ 30〜50家庭）
  - Phase 2 = **無料 / STANDARD ¥1,980/月 / GOAL ¥2,980/月**（半年合格保証付き）の 3 プラン
- **理由**: Marketing 提案を全面採用。スタディサプリ ENGLISH for KIDS が 2026-05 で新規申込終了予定の市場真空に、月¥1,980〜2,980（教室の 1/3〜1/5）で参入する。GOAL プランの「半年合格保証（3か月分返金 or 延長）」は β 実績で合格率データを蓄積後の Phase 2 から発動。
- **影響**: Vercel プランは β 期間 = Hobby（自社プロダクト・無償運用解釈）/ 公開β以降 = Pro $20 に切替。

## DEC-005: 訴求コピー強度 = 「半年で英検3級合格を目指す」（2026-04-26 / CEO）
- **決裁**: マーケコピーは「半年で英検3級合格を**目指す**」を起点とする。「合格できる」「合格保証」は β 実績で合格率（暫定 50% 以上）を確認後、Phase 2 公開β以降に段階的に強化する。
- **理由**: Research §2-2 が「ゼロスタートは 200〜300 時間（7〜10 か月）、毎日 1 時間×6 か月 = 180 時間は最短ライン」と一次情報で指摘。**「ゼロから半年で合格できる」と言い切ると景表法・優良誤認のリスク + β 落第時の保証返金で CAC 赤字化リスク**。「目指す」基準なら誇大広告化を避けつつ、5級 → 4級 → 3級の中間マイルストーン（Day 1-30 / 31-90 / 91-150 / 151-180）を商品ストーリーに変換できる。
- **影響**: LP コピー / 利用規約の文面を Marketing 部門で再起草。受入基準の「合格率」は内部目標 50% / 公開時訴求 70%（GOAL プラン保証発動条件）の二段化。

## DEC-004: プロダクト名 = HANEI（仮確定）+ メインカラー = Amber Gold（ハイブリッド採用）（2026-04-26 / CEO）
- **決裁**:
  - **プロダクト名（仮確定）**: **HANEI（ハンエイ・半英）** ※ Research 部門の J-PlatPat 第9・41類本格商標検索 + ドメイン取得確認の結果次第で最終確定。
  - **メインカラー**: **Amber Gold #F2A93A（Designer 採用）** ＋ サブで Mint / Sky を残す（WCAG AA コントラスト検証済み）。
  - **メインキャラクター**: 「**ことだまトリ**」（Designer 提案）を AI コーチの可視化として採用。サブキャラ 3 体は Phase 2 以降で増やす。
- **理由**: 「HANEI」はマーケ訴求（半年で英検）と論理整合 + 3 音で覚えやすい。「ことだまトリ」は Designer の世界観の核で、子ども × 保護者の両方に刺さる。**カラーは Amber Gold（暖色 / 自己肯定感）と Marketing のターコイズが乖離していたが、Designer の WCAG AA コントラスト検証済み Amber Gold を主軸採用**。Marketing のターコイズはアクセント枠で残す。
- **影響**: Tailwind config / globals.css のトークン v1 を Amber Gold + Mint + Sky で実装。LP / アプリ UI の配色を Designer §2.1 に統一。

## DEC-003: 統合技術スタック確定 = Next.js 16 + Turso + Better Auth + Cloudflare R2 + AI SDK + OpenAI（2026-04-26 / CEO）
- **決裁**:
  - **フレームワーク**: Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + Heroicons + next-themes
  - **DB**: **Turso (libSQL) Free**（9GB / 1B reads、Vector 拡張で RAG 内蔵） + **Drizzle ORM**
  - **Auth**: **Better Auth**（Drizzle adapter / 保護者・子の家族モデル + organization plugin で家族内マルチプロファイル）
  - **Storage**: **Cloudflare R2**（egress 無料が決定打 / 音声 mp3 + 画像 PNG）
  - **AI**: **AI SDK + OpenAI gpt-5-mini（主軸） / gpt-4.1-mini（フォールバック）** + **OpenAI Moderation API（三重ガード）**
  - **TTS**: **OpenAI tts-1（バルク事前生成 + R2 キャッシュ）**。ElevenLabs（キャラ音声 Phase 2）/ Azure Speech（発音判定 Phase 2）。
  - **デプロイ**: Vercel Hobby（β 期間限定）→ 公開β / 有料化と同時に Pro $20 へ移行
  - **メール**: Resend
  - **監視**: Sentry + Vercel Analytics
- **理由**:
  - 個人開発・無料運用維持の最優先制約 + R2 egress 無料の決定打を満たす（Dev 試算: 100 名 月 ¥1,200 / 500 名 月 ¥2 万以下）
  - PRJ-015 で確立した「Turso + Better Auth + R2 + Drizzle + 三層認可防衛（middleware → guards → scoped queries）」の知見を完全流用可能（着手リードタイム短縮）
  - Supabase RLS は強力だが、家族モデル（保護者 1 + 子 N）+ AI コーチの会話履歴アクセス制御をアプリ層 3 層認可で組むほうが柔軟（PRJ-015 で実証済み）
  - Research §5 で gpt-5-mini が 2025-08-07 リリース済 + $0.25/$2.00 + 400K context が一次情報で確認されており、Dev の懸念（一般公開未確定）は事実誤認。AI SDK の provider 抽象で gpt-4.1-mini に切替可能なのでフォールバックは確保済み。
- **影響**: PM の WBS 1.3「Supabase プロジェクト作成」を「Turso DB 作成 + Drizzle migration」に書き換え。Dev のスタックを正式採用。Research の TASK-A（gpt-5-mini 実測）を W1 内に必達。

## DEC-002: Phase 0 並列招集 = 全部署起動（2026-04-26）
- **決裁**: CEO
- **内容**: Phase 0 要件定義を以下の並列タスクで進行する。
  - **Research**: 英検5〜3級カリキュラム / 競合8社以上 / SRS+IRT 適応学習アルゴリズム / 子ども向けAIコーチの安全運用 / 音声・TTS の比較 / gpt-5-mini 利用可否
  - **Designer**: 子ども向け × 保護者にも信頼される UI/UX、キャラクターシステム、ゲーミフィケーションの可視化、毎日触りたくなる設計（デザインコンセプト2〜3案）
  - **PM**: WBS / Phase 1 MVP の人日見積 / 受入基準 / 半年合格を支える学習スケジュール骨子
  - **Marketing**: 命名提案3案 / ペルソナ / 課金モデル仮説 / GTM
  - **Dev**: 技術スタック確定提案（Next.js + Supabase or Turso + AI SDK + TTS）/ データモデル / 大量問題プール運用設計
- **理由**: 半年ゴールという厳しい時間軸に対し、PRJ-015 で確立した並列 Phase 0 完遂フォーマットを踏襲することで起案当日に方向性を固める。
- **影響**: 各部署のレポートを `projects/PRJ-016/reports/` に格納、CEO で統合 → オーナーへ報告。
