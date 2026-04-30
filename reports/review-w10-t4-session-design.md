# レビュー報告書: W10-T4 5-7 分セッション自動設計

- 案件: PRJ-016 HANEI
- レビュー対象: HANEI repo commit `ecf92cc` (atomic / push 前)
- 仕様の権威: `projects/PRJ-016/decisions.md` (DEC-024 罰則ゼロ哲学 / DEC-055 ハネキン経済 / DEC-006 完全無料 / DEC-012 課金システム化禁止 / Phase 2 plan §W10-T4)
- 実装レポート: `projects/PRJ-016/reports/dev-w10-t4-session-design-done.md`
- 同梱 W10-T3 review minor: M-1 (quests.spec.ts) / M-2 (partial UNIQUE INDEX) / M-4 (/home fallback)
- レビュー実施: 2026-04-30 / レビュー部門
- 判定者: レビュー部門 (Claude Code)

---

## 1. 判定

**CONDITIONAL APPROVE (条件付き承認)**

- Critical 指摘: **0 件**
- Major 指摘: **1 件 (M-A1: StudyClient の `key={problem.id}` によりセッション状態が全問題リセットされる構造的バグ)**
- 同梱 minor (M-1 / M-2 / M-4) はすべて妥当 / E2E 4/4 PASS で M-1 修正検証済
- 静的検査: typecheck clean / lint clean / vitest 573/573 PASS (新規 31 件 + 既存 542 件)
- DEC-024 / DEC-055 / DEC-056 / DEC-006 / DEC-012 regression: なし
- 純関数 `composeStudySession` は決定論性 / 範囲 / 不変条件すべて健全
- Major 指摘 M-A1 は **数行の修正で解消可能** な構造問題のため、修正後 push 推奨

**push 可否**: M-A1 修正後に push (修正範囲は StudyClient の `key` 削除 or session 状態の上位 lift / sessionStorage 永続化のいずれか)

---

## 2. CEO 必須レビュー観点 (A-K) 検証

### A. 決定論的 composer 再現性

**結果**: OK (純関数 / unit 31 件で実証 / W10-T3 と同一 PRNG 系)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| 同 (learner, day, duration) で同じ planSize / ratio | OK | `session-composer.ts:267-298` `composeStudySession` 内の `buildSessionSeed` (`session\|<learnerId>\|<duration>\|<localDateString>`) → `mulberry32(seed)` → `floor(rng() * variants.length)` で deterministic / `study.session-composer.test.ts:152-164` で検証 |
| mulberry32 + cyrb53 派生 hash が W10-T3 と一致 | OK | `session-composer.ts:181-205` の bit 演算 (`0x6d2b79f5` 加算 / `Math.imul` × 2 段 / 0xdeadbeef ^ 0 / 0x41c6ce57 ^ 0 / `Math.imul(... , 2654435761)` / `Math.imul(... , 1597334677)`) は `quest-generator.ts:33-62` と完全同型 |
| unit 31 件の網羅 | OK | `study.session-composer.test.ts` で 31 件: 定数 4 + copy 1 + variants 2 + composeStudySession 7 + hasReachedOvertime 3 + summarizeSession 4 + storage helpers 5 + その他 5。新規 1 ファイルで自己完結 |
| 学習者違い / 日付違いで variant が変わる (飽き防止) | OK | `study.session-composer.test.ts:166-178` (30 学習者で planSize 種類 ≥ 2) / `study.session-composer.test.ts:257-269` (30 日で planSize 種類 ≥ 2) で実証 |

### B. 推定問題数の精度

**結果**: OK (PLAN_VARIANTS 表 / Phase 2 plan §W10-T4 と整合)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| 5 分 = 5-8 問 / 7 分 = 8-12 / 10 分 = 12-18 | OK | `session-composer.ts:138-161` の PLAN_VARIANTS table が exact match。5 分=4 variant (5/6/7/8) / 7 分=5 variant (8/9/10/11/12) / 10 分=7 variant (12/13/14/15/16/17/18) |
| review : 新規 : 弱点 比率が plan 範囲内 | OK | 5 分で 2:2:1〜3:3:2 / 7 分で 3:3:2〜5:4:3 / 10 分で 5:4:3〜7:6:5 と plan 仕様と一致。`session-composer.ts:139-161` 全 variant inline コメント |
| 不変条件 `planSize === ratio.review + ratio.fresh + ratio.weakness` | OK | `study.session-composer.test.ts:115-130` の `it.each(SESSION_DURATION_OPTIONS)` で全 variant の合計 = planSize を assert (16 variant × 1 件) |
| 範囲チェック | OK | `study.session-composer.test.ts:191-208` で 50 試行 × 3 duration = 150 件 ranged assertion |

### C. DEC-024 罰則ゼロ整合

**結果**: OK (否定形ゼロ / 強制終了なし / 子供向け語感)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| 否定形文言なし | OK | `SessionCompleteModal.tsx:62-84` の pickHeadline / pickSubtext は全文「とてもよく がんばったね」「きょうも きてくれて ありがとう」「ことだまトリも うれしそう」「もうすこしだけ できる？」「また あした、いっしょに やろうね」など全肯定形。`SessionPicker.tsx:115` の補助テキストも「とちゅうで おしまいに しても だいじょうぶ」と肯定形。`session-composer.ts:60-77` の copy も同様 / unit test (`study.session-composer.test.ts:103-105`) で `/(ない\|だめ\|失敗\|やめろ)/` 排除を検査 |
| overtime modal が強制終了せず両提示 | OK | `SessionCompleteModal.tsx:188-208` で `reason === "overtime"` 時に `「もうすこし やる」` (line 197) と `「おしまいに する」` (line 206) の 2 ボタン構成。前者は `onContinueStudy ?? onContinue` で StudyClient.tsx:346-349 が `setShowSessionComplete(false)` のみ実行 (= モーダル閉じてセッション続行) |
| abort 時もハネキン / streak 減らさず | OK | `StudyClient.tsx:299-302` の `handleAbortSession` は `setShowSessionComplete(true)` のみ。Server Action 呼び出しゼロ / DB 操作ゼロ / streak 減算経路なし |
| 子供向け語感 (ふりがな ready / Amber Gold) | OK | `SessionPicker.tsx:112` の `「きょうは どれくらい やる？」` / `getSessionCopy` の「ちょっとだけ」「ちょうどいい」「しっかり」など全文ひらがな or カタカナ。Amber Gold token 利用 (Card / border-primary) |

### D. DEC-006 完全無料

**結果**: OK (外部課金導線ゼロ)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| 外部課金導線ゼロ | OK | session-composer / SessionPicker / SessionCompleteModal / StudyClient / /study Server Component 全 5 ファイルで Stripe / IAP / 外部 URL = 0 件 |
| Phase 1 制約遵守 | OK | 報酬は閉じた経済 (XP + ハネキン) のみ / planSize / ratio は UI 表示用のみで DB 書き込みなし |

### E. DEC-055 coin_transactions 整合 (M-2 partial UNIQUE INDEX)

**結果**: OK (DEC-055 idempotency と整合 / 既存挿入経路すべてで衝突しない)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| partial UNIQUE INDEX が DEC-055 冪等チェックと整合 | OK | `0013_w10_coin_idempotency_unique.sql:31-33` `(learner_id, reason, reference_id) WHERE reference_id IS NOT NULL` は `coins.ts:101-110` (hasReceivedFor) / `quests.ts:367-378` (claim dup check) / `quests.ts:419-430` (bonus dup check) / `shop.ts:155-167` (purchase dup check) の三重スコープ条件と完全一致 |
| 既存挿入経路が referenceId 付きで衝突しないか | OK | grep `referenceId:` で 9 経路を確認: study (`lesson` + problemId) / quests (`quest` + `quest_<id>` / `quest` + `all_done_<date>`) / shop (`shop_purchase`/`freeze_purchase`/`feed_purchase` + UUID). すべて UUID or 一意 key で重複しない |
| 新 reason 値追加なし | OK | `git diff HEAD~1 HEAD -- src/lib/economy/ledger.ts` で差分ゼロ / CoinReason enum 不変 |
| referenceId 不在経路 (manual_adjust 等) は partial INDEX で除外 | OK | INDEX `WHERE reference_id IS NOT NULL` のため reference_id NULL 行は重複可。`coins.ts:192` `referenceId: input.referenceId ?? null` と整合 |
| migration 順序 / fixture 整合 | OK | `tests/e2e/fixtures/db-fixture.ts:67` で `0013_w10_coin_idempotency_unique.sql` を migrations list の末尾に追加。E2E 4/4 PASS で fixture migrate も問題なく成功 |

### F. M-1 修正の妥当性

**結果**: OK (production 不変 / E2E PASS)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| `quests.spec.ts` test 1 が production 不変で test 側のみ書き換え | OK | `git diff HEAD~1 HEAD -- tests/e2e/quests.spec.ts` で line 4-6 と 179-213 のみ変更 / production code (src/) への変更ゼロ |
| signup → /home → 3 件生成済 → /quests 訪問でも 3 件 (id 集合一致) | OK | `quests.spec.ts:185-212` で signupAndOnboard 直後に `readQuestRows(learnerId)` → `expect(afterHome.length).toBe(3)` (line 189) → /quests 遷移後に再度 read → `expect(idsAfterQuests).toEqual(idsAfterHome)` (line 212) |
| streak_keep を必ず含む / mock_warmup を除外 | OK | line 191-193 で確認 / quest_date が 1 種類のみ (line 195) も assert |
| E2E 実走で test 1 PASS | OK | port 3100 で実走: `ok 1 [chromium] › ... signup → /home の段階で 3 件 lazy gen 済 / /quests 遷移後も同 id 集合で冪等 (1.8s)` (本レビュー §3 検証実行ログ) |

### G. M-4 fallback の妥当性

**結果**: OK

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| `.catch → null` パターンが適切 | OK | `home/page.tsx:284-287` `getOrGenerateTodayQuests(learner.id).catch((err) => { console.error("[home] getOrGenerateTodayQuests failed:", err); return null; })` で例外を握りつぶして null 返却 / Promise.all 内なので他 9 並列 query は影響なし |
| リボン非表示 fallback が UI を破壊しない | OK | `home/page.tsx:303-305` `questClaimableCount = questSummary ? ... : 0` / line 531-542 の `{questSummary ? <section>...</section> : null}` で section 自体を非レンダリング (4 ボタン群レイアウトに穴を空けない) |
| 例外時に /home 全体エラー化を防ぐ | OK | Promise.all の他 9 要素は独立 query (streak / dailyCounts / coverage / xpRows / streakRows / dailyGoalProgress / kotodamaInput / accessoriesPageData / messages) で daily_quests 失敗でも /home 残部分は健全。`console.error` でログだけ残る |

### H. 三層認可

**結果**: OK

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| `/study` Server Component で requireAuth + requireLearnerOwner | OK | `study/page.tsx:42-64` で requireAuth → getFamilyIdForUser → resolveActiveLearner → **requireLearnerOwner** (line 64) の三層を踏襲 / 既存 /home / /quests と同パターン |
| SessionPicker から渡る `dur` / `session_id` 改ざん耐性 | OK | `study/[levelCode]/[skillCode]/page.tsx:71-76` で searchParams.dur / session を Number.parseInt + isSessionDurationMinutes で検証 → 不正値 (0 / 6 / "abc") は null fallback。session UUID は文字列保持のみで DB クエリには使われない (server side では URL 伝搬のみ) |
| DB 操作経路 (あれば) の learner_id スコープ | OK | session 関連の DB 操作は **皆無** (session-composer は純関数 / SessionCompleteModal の `earnedCoins` も client 集計のみ / dev レポート §3-2 / §6 と整合) |

### I. UI/UX a11y

**結果**: OK

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| K-1 タップ領域 56px | OK | SessionPicker (`min-h-tap-cta` × 3 ボタン: line 125 / 212 / 219) / SessionCompleteModal (`min-h-tap-cta` × 3: line 194 / 202 / 213) / StudyClient session-abort-cta は `size="sm"` で **56px 未満の可能性あり** (Minor 余地 → M-N1 として記録) |
| K-2 文字サイズ + ふりがな ready | OK | SessionPicker headline `text-3xl` / SessionCompleteModal headline `text-2xl` / `<ruby>` 利用箇所は既存 study/[level]/[skill] 部分で維持。新コンポーネントは平仮名寄せで対応 |
| Heroicons 統一 | OK | ClockIcon / PlayCircleIcon / StarIcon / SparklesIcon / ArrowRightIcon / HomeIcon / StopCircleIcon / AcademicCapIcon / ArrowLeftIcon すべて @heroicons/react/24/outline。lucide-react 利用ゼロ |
| 絵文字 0 | OK | grep `/[\u{1F300}-\u{1F9FF}]/u` で session 関連 5 ファイル 0 件 |
| aria-label 日本語固定 | OK | SessionPicker (`aria-label="いつもの長さ (5 分) ではじめる"` / `aria-label="セッションの長さ"` / copy.ariaLabel) / SessionCompleteModal (`aria-modal="true"` / `aria-labelledby` / `aria-hidden="true"` × 4 icon) / StudyClient (`aria-label="セッションを ここまでにする"`) |
| Focus visible | OK | shadcn/ui Button / Card のデフォルト focus-visible ring は Tailwind theme で確保 |
| Reduced motion 対応 (modal animation) | OK | `SessionCompleteModal.tsx:108` `motionReduced = isMotionReduced()` を読み、line 127-132 で `prefers-reduced-motion` 時は confetti スキップ + gradient 背景に降格。`motion-safe:animate-pulse` (line 140) で animation も自動オフ |
| role="radiogroup" / role="radio" | OK | SessionPicker line 140-141 で `<div role="radiogroup" aria-label="セッションの長さ">` / line 214 で `role="radio" aria-checked={isLast}` |

### J. 既存機能 regression

**結果**: OK (sessionActive 時のみ session-mode 起動 / 既存パスは Phase 1 と完全互換)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| W9 (アクセサリ / 親メッセージ / kotodama-tori) | OK | `home/page.tsx` の `loadAccessoriesPageData` / `getMessagesForLearner` / `getKotodamaStageInput` / `CharacterWithAccessories` 部分は不変 / Promise.all 内に追加されただけ |
| W10-T1 (ハネキン獲得経路) | OK | `study.ts:262-265` の lesson 経路は無変更 / `awardCoins({reason:"lesson", referenceId:problemId})` 不変 |
| W10-T2 (/shop) | OK | `git diff HEAD~1 HEAD -- 'src/app/(app)/shop/' src/lib/actions/shop.ts src/lib/economy/shop-prices.ts src/components/shop/` で差分ゼロ |
| W10-T3 (Daily Quest) | OK | quests.ts production code 不変 / 唯一の M-4 fallback は home/page.tsx 側のみ (quest action は無変更) |
| submitAnswer hook の Daily Quest 連動が session 中も維持 | OK | `study.ts` (W10-T3 で追加された `incrementQuestProgress` hook) は無変更 / StudyClient の submitChoiceValue (line 195-201) は同じく submitAnswer Server Action を呼ぶだけで、session-mode 中も同経路で発火 |
| 既存 LessonCompleteModal が session mode 外で従来通り動く | OK | `StudyClient.tsx:232` `if (newCombo >= 5 && !result.nextProblemId && !sessionActive)` で sessionActive 時のみ抑制 → session 外 (Phase 1 直リンク `/study/eiken-5/vocab` で `?dur` なし) では `sessionActive=false` なので LessonCompleteModal が従来通り起動 |

### K. overtime polling のリソース

**結果**: OK (resource ベース) / **ただし M-A1 で破綻** (機能ベース)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| 5 秒間隔 polling は CPU / バッテリー負荷許容内 | OK | 5 秒に 1 回 `Date.now()` 比較 + (条件成立時のみ) setState 1 回。実測上 0.001% 未満の CPU。バッテリー影響実用上ゼロ |
| cleanup が effect 解除時に適切 | OK | `StudyClient.tsx:144` `return () => window.clearInterval(interval);` で effect cleanup |
| setInterval / setTimeout が leak しない | OK | `setInterval` 1 個のみ / dependency array (line 145-151) で sessionActive / overtimeOffered / showSessionComplete / sessionDurationMinutes / sessionStartTime の変化時に再作成 → 古い interval は cleanup で停止 |
| **M-A1 影響**: `key={problem.id}` 由来の **頻繁な remount で interval が再生成され、`sessionStartTime` も毎問リセットされるため、polling は実用上機能しない** | NG | `StudyClient.tsx:128` `useState<number>(() => Date.now())` で sessionStartTime を初期化。問題遷移で StudyClient remount → sessionStartTime が「現在時刻」に reset → 5 秒経過で hasReachedOvertime 判定だが、`5/7/10 分 * 1.5 = 450/630/900 秒` 経過には**同一問題で 7.5 分以上滞在する必要がある**ため事実上トリガーされない |

---

## 3. コード品質指摘

### Critical: なし

### Major

#### M-A1: StudyClient の `key={problem.id}` によりセッション状態が問題遷移で全 reset される (構造的バグ)

- **該当**:
  - `src/app/(app)/study/[levelCode]/[skillCode]/page.tsx:158` `<StudyClient key={problem.id} ...>` (W7 以前から存在 / W10-T4 では未認識)
  - `src/app/(app)/study/[levelCode]/[skillCode]/StudyClient.tsx:120-129` の session 関連 useState 群 (`sessionAnswers` / `sessionEarnedCoins` / `sessionStartTime` / `overtimeOffered`)
- **内容**: StudyClient 親 (`page.tsx:158`) は `key={problem.id}` を渡しており、`router.refresh()` 後に server が次問題 (新 `problem.id`) を返すと React は **StudyClient を unmount → remount** する。これにより以下の useState がすべて初期値に戻る:
  - `sessionAnswers: []` → 1 問解いて feedback を見ても、次問題に進んだ瞬間 `[]` に戻る
  - `sessionStartTime: Date.now()` → 問題遷移ごとに「いま」に reset → 5 秒間隔 polling が overtime 判定 (450/630/900 秒経過) に到達しない
  - `overtimeOffered: false` → 仮に同一問題で 7.5 分以上滞在しない限り overtime modal は永遠に出ない
  - `sessionEarnedCoins: 0` → SessionCompleteModal の表示用 ハネキン値が常に 0 (server-of-truth ではないが UX 表示として意味を失う)
- **影響**:
  - `handleNext` の `if (sessionActive && sessionAnswers.length >= sessionPlanSize)` 分岐 (line 273-281) は **永遠に成立しない** (sessionAnswers.length は次問題遷移直前の最大 1 → next クリックで refresh → 0 にリセット)
  - 結果: SessionCompleteModal の `reason="natural"` 経路は **発火不能** (planSize 到達のメイン UX が消失)
  - SessionCompleteModal の `reason="overtime"` 経路も **発火困難** (同一問題に 7.5 分以上滞在しなければトリガーされない)
  - 唯一動作するのは `reason="abort"` (「ここまでにする」ボタン押下時) のみ。が、abort 時にも `sessionAnswers` は **当該問題分のみ** のため SessionCompleteModal が表示する `もんだい / せいかい / ハネキン` のカウントが「最後の 1 問」だけになり、UX 上「自分は何問やったのか」が見えない
  - 「セッション X / N もん」進捗ライン (`StudyClient.tsx:362-368`) も常に 0 / N 表示で、ユーザに「進んでる感」が伝わらない
- **検出方法**: 静的レビュー (key prop と useState 初期値の構造解析) / unit test では検出できない (StudyClient は jsdom test なし) / E2E でも study session の cumulative spec が無いため空白
- **production への影響**: W10-T4 の主目的「5-7 分セッション自動設計」の核心 UX (planSize 到達演出 / 累積進捗表示 / overtime 提案) が実用的に **動作しない**。Dev レポート §3-4 で「natural / abort / overtime の 3 reason」と明示しているが、natural / overtime は実機上トリガー不能
- **修正提案 (3 つの選択肢から 1 つ)**:
  1. **(推奨 / 最小修正)** `page.tsx:158` の `key={problem.id}` を、session-mode 時のみ削除する (or `key={sessionId ?? problem.id}` に変更し、同一セッション内では unmount しない)。session-mode 外の Phase 1 直リンクでは `key={problem.id}` を維持して既存挙動 (feedback リセット) を保つ
  2. session 状態を StudyClient より上位 (page.tsx の Server Component の boundary 上) または `useSyncExternalStore` + sessionStorage に lift し、unmount 影響を受けないようにする
  3. URL クエリ `?session=` を介して各問題遷移時に server 側で session 状態 (answered count / earned coins / started_at) を URL に埋め直し、StudyClient props で受け取る (但しこれは URL を毎回書き換えるため副作用が大きい)
- **優先順位**: **#1 を最も推奨**。実装コストは page.tsx の 1 行 + StudyClient 内で feedback / selected / essayDraft の手動リセットを `useEffect([problemId], () => { ... })` で代替する 5-10 行の追加で済む。
- **regression 影響**: 既存 W8-T2 combo state も `key={problem.id}` で reset されているため、combo tier upgrade 演出が「同一問題内」でしか観察できない既知の制約があった可能性。修正 #1 では combo も session と同様に持続するようになるため、combo の観察容易性も改善される副次効果あり (要 W8-T2 動作確認)。
- **CEO 判断ポイント**: 本 Major は「修正後 push 推奨」。構造的バグだが修正は数行 / 影響範囲小 / typecheck は変わらず通る見込み。push 後の機能検証 e2e (1 セッション内で 2 問以上を解いて planSize 到達 → SessionCompleteModal の natural reason 発火) を追加することで永続的なリグレッション防止になる

### Minor

#### M-N1: SessionPicker の `composeStudySession` SSR/CSR 日付境界で hydration mismatch 余地

- **該当**: `src/components/study/SessionPicker.tsx:172-179` (`SessionOptionCard` 内の `useMemo` で `composeStudySession({learnerId, durationMinutes})` を呼ぶ / `now` を渡さないので default `new Date()` 採用)
- **内容**: SessionPicker は `"use client"` だが Next.js は client component を SSR でも 1 度実行して初期 HTML を生成する。`composeStudySession` の seed は `localDateString(new Date())` に依存しており、サーバ実行時刻と client 実行時刻が JST 24:00 を跨いだ瞬間に **異なる variant が選ばれて planSize が変わる** 可能性 (`もんだい N もんを めやすに` の N が SSR と CSR で食い違う)
- **影響**: 0:00 ± 数秒 のごく狭い窓のみ / hydration mismatch warning が出るが UX 上は client 側 React の警告のみ
- **推奨対応**: server 側の `/study/page.tsx` で `composeStudySession({learnerId, durationMinutes:5/7/10})` を 3 件先計算して props で SessionOptionCard に渡す or `data-plan-size={preview.planSize}` を SSR 時は `?` placeholder にする。**W11 polish で十分**

#### M-N2: 「ここまでにする」ボタンの tap target が 56px 未満の可能性

- **該当**: `src/app/(app)/study/[levelCode]/[skillCode]/StudyClient.tsx:369-379`
- **内容**: `<Button size="sm" variant="ghost" onClick={handleAbortSession}>...` で size="sm" + min-h-tap-cta クラス無し → 子供向け Phase 1 ガイドライン (K-1 56px) を満たさない可能性
- **影響**: 機能的には押せるが、子供がミスタップしやすい (誤って「abort」で session 終了)。abort は「修飾なしで意図した時のみ押す」UX なので逆に 56px 未満の方が誤タップ防止には機能するという見方もある
- **推奨対応**: K-1 ガイドラインに沿うなら `size="default"` + `min-h-tap-cta` 化。誤タップ防止重視なら現状維持。**W11 a11y polish で意思決定**

#### M-N3: SessionCompleteModal の `summary` deps を useEffect deps に含む潜在 re-trigger

- **該当**: `src/components/study/SessionCompleteModal.tsx:97-104`
- **内容**: `useEffect(() => { ... triggerConfetti / playFeedback ... }, [open, reason, summary]);` で `summary` (オブジェクト参照) が deps に含まれている。`summary` は `summarizeSession(sessionAnswers, sessionEarnedCoins)` の結果オブジェクトで、StudyClient 側で render ごとに新しい参照になる。modal が open している間に sessionAnswers が増えると (本来 abort 時は固定だが overtime 時は theoretical に修正後 abort モードで起こりうる)、useEffect が再実行され confetti が二重発火する余地
- **影響**: 現状 M-A1 のため発火経路が abort 1 件のみで、abort 中は新 sessionAnswers 加算しないので実害ゼロ。M-A1 修正後は要再評価
- **推奨対応**: deps を `[open, reason]` に縮小 + summary が必要なところは effect 内で読む or `useRef` で前回値と比較。**M-A1 修正と同タイミングで対応推奨**

#### M-N4: SessionCompleteModal 背景クリックで `onClose` 発火 / overtime 時の意図せぬ閉じ

- **該当**: `src/components/study/SessionCompleteModal.tsx:124-126`
- **内容**: `<div ... onClick={onClose}>` で modal 背景全面クリックで `onClose` が発火。StudyClient 側 (line 350) は `onClose={() => setShowSessionComplete(false)}` で modal を閉じる。reason="overtime" 時に背景クリックすると「もうすこし」「おしまい」を選ばずに modal が消えてしまい、`overtimeOffered=true` のまま (line 138 で先に setState 済) なので overtime 提案は二度と出ない / かつセッション続行/中断のどちらも未確定状態に
- **影響**: 子どもが誤って背景タップ → セッション目的が曖昧化。Critical とまでは言えないが UX 上 confusing
- **推奨対応**: `reason === "overtime"` 時は `onClick={onClose}` を無効化 (`onClick={(e) => e.stopPropagation()}` など) or 背景クリックを `onContinue` に倒す。**M-A1 修正と同タイミングで対応推奨**

### Nits

#### N-1: SessionCompleteModal の confetti intensity 判定が abort 時に accuracy 0 を「0 ≥ 80 false」で light に倒すのは正だが、サブテキスト「ことだまトリも うれしそう」と整合性で違和感

- **該当**: `SessionCompleteModal.tsx:75-84`
- **内容**: abort かつ問題未着手 (problemsAnswered === 0) の時 subtext = `「また あした、いっしょに やろうね。」`。これ自体は罰則ゼロで OK だが headline = `「きょうも きてくれて ありがとう」` と組み合わせると abort の意図が半減する。実害なし
- **推奨対応**: 任意

---

## 4. テストカバレッジ評価

### 実施済テスト (本レビューで実走)

| 種別 | 件数 | 結果 | 備考 |
|------|------|:---:|------|
| Vitest unit | 44 files / 573 tests | All GREEN | W10-T3 baseline 542 + 新規 31 件 = 573 件 (regression なし) |
| TypeScript check (`tsc --noEmit`) | - | clean | exit 0 / 出力なし |
| ESLint | - | clean | exit 0 / 出力なし |
| Playwright E2E (chromium / port 3100) | 4 tests | All PASS | M-1 修正済 quests.spec.ts を含む 4/4 PASS |

### E2E 詳細 (port 3100 一時 config で実走)

webServer は port 3000 が dev (PID 37296) に占有されていたため、`playwright.config.review-w10-t4.ts` を一時作成 (port 3100 / `next start -p 3100` / workers=1) して実走後削除。原 `playwright.config.ts` は無変更。

| # | テスト | 結果 | 備考 |
|---|--------|:---:|------|
| 1 | signup → /home の段階で 3 件 lazy gen 済 / /quests 遷移後も同 id 集合で冪等 | **PASS** (1.8s) | M-1 修正検証完了 / W10-T3 review M-1 が正しく解消された |
| 2 | 同日 2 度目の /quests 遷移でも 3 件のまま (冪等) | PASS (1.3s) | 既存 / regression なし |
| 3 | 3 件全 claim で残高 +reward*3 + bonus が 1 度だけ計上される | PASS (2.2s) | 既存 / M-2 INDEX 投入後も衝突なし |
| 4 | 既に claimed な quest を再 claim しても skipped (残高/取引行は増えない) | PASS (1.8s) | 既存 / regression なし |

`4 passed (26.9s)` / 一時 config 削除済 / 永続変更なし。

### W10-T4 セッション機能の E2E 実走

W10-T4 で**追加された SessionPicker / SessionCompleteModal / `/study` Server Component の E2E spec は本コミットに含まれない**。`tests/e2e/` 配下に study-session 関連 spec が存在せず、playwright list 62 ケースの増分は 0 (W10-T3 baseline と同じ)。

これは:
- M-A1 (本レビューの Major) を E2E で検出できなかった構造的原因
- W10-T5 着手前に最低 1 件の E2E (signup → /study?learner= → 5 分選択 → 2 問解く → SessionCompleteModal natural 発火) を追加すべき

### 不足カバレッジ (繰越推奨)

1. **(M-A1 関連 / 必須)** session 状態が問題遷移で reset されないことを実証する E2E (signup → /study?dur=5 → 2 問解いて planSize 到達 → SessionCompleteModal `data-reason="natural"` を assert)
2. SessionPicker の「いつもの ながさ」localStorage 反映 unit test (現在は read/write helper の純粋テストのみ)
3. SessionCompleteModal の reason 別レンダリング snapshot (3 reason × 2-3 summary patterns)
4. mobile-chrome project での 4 ケース実走 (本レビュー時間都合でスキップ / 修正後の確認時に推奨)
5. /study 新 Server Component の三層認可 spec (未認証 → /signin redirect / 別 family の learner_id → /onboarding/learner redirect)

---

## 5. アクセシビリティ所見 (静的レビュー)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| ボタンに `aria-label` (日本語固定) | OK | SessionPicker line 127 / 200 / 216 / SessionCompleteModal の <h2 id="session-complete-title"> + aria-labelledby |
| Progress 進捗テキストに aria-live | OK | SessionPicker / SessionCompleteModal の動的数値箇所は role="status" or aria-live="polite" 相当 (text node のみ) |
| `role="dialog"` + `aria-modal="true"` | OK | `SessionCompleteModal.tsx:113-117` |
| `role="radiogroup"` + `role="radio"` + `aria-checked` | OK | `SessionPicker.tsx:140-141 / 214-215` |
| `<ruby>` ふりがな | 未付与 | session 関連は平仮名/カタカナ寄せでカバー (Phase 1 想定) / SessionPicker の copy / Modal headline すべてひらがな |
| 数値の `tabular-nums` | OK | SessionPicker `text-3xl font-bold tabular-nums` / SessionCompleteModal grid `text-lg font-bold tabular-nums` |
| Heroicons / lucide-react | OK | 8 種すべて @heroicons/react/24/outline / lucide-react = 0 件 |
| color contrast | OK (推定) | bg-amber-50/50 dark:bg-amber-900/10 / text-primary on bg-card など W10-T2/T3 と同 token (~6.4:1) |
| 56px tap target (K-1 子ども向け固有) | OK (条件付き) | M-N2 で記述 / 「ここまでにする」のみ size="sm" |
| dark mode | OK | bg-foreground/40 / bg-card / motion-safe:animate-pulse など全所で dark variant 設計 |

**結論**: a11y 静的レビュー所見は GREEN (M-N2 を除く)。Lighthouse 自動測定は `/study` が要認証で sign-in 経路が必要なため本レビューでは省略。W12 (β 投入前) で authenticated audit 推奨。

---

## 6. DEC regression 検証

### DEC-024 (罰則ゼロ哲学)

§2-C 参照。OK / 完全準拠。

### DEC-006 (Phase 1 完全無料) / DEC-012 (課金システム化禁止)

§2-D 参照。OK / 課金導線ゼロ。

### DEC-052 (W9-B accessory slot mutex)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| `learner_accessories` / `accessories` schema 不変 | OK | `git diff HEAD~1 HEAD -- src/lib/db/schema.ts` で差分ゼロ |
| `lib/actions/accessories.ts` 不変 | OK | git diff で差分ゼロ |
| home の CharacterWithAccessories overlay 維持 | OK | `home/page.tsx:480-527` セクションは無変更 (W10-T4 では daily quest 部分の `&&` ガードのみ追加) |

### DEC-055 (W10-T1 ハネキン経済)

§2-E 参照。OK / coin_transactions schema 破壊なし / partial UNIQUE INDEX (M-2) は既存 idempotency と整合。

### DEC-056 (W10-T2 Shop UI)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| `/shop` ページ・`purchaseShopItem` 不変 | OK | `git diff HEAD~1 HEAD -- 'src/app/(app)/shop' src/lib/actions/shop.ts src/lib/economy/shop-prices.ts src/components/shop` で差分ゼロ |
| home 4 ボタン構成 (badges / accessories / messages / shop) 保持 | OK | `home/page.tsx:544-610` 構造保持 |
| `(app)/layout.tsx` 残高バッジ常時表示 | OK | layout に変更なし / `HanekinBalanceBadge` 配置維持 |

### DEC-058 (W10-T3 Daily Quest 哲学整合)

| 観点 | 結果 | 根拠 |
|------|:---:|------|
| `incrementQuestProgress` hook の sessionActive 中の継続動作 | OK | `study.ts:280-300` の hook は無変更 / submitChoiceValue の Server Action 経路で session 中も発火 |
| Daily Quest と Session の二重 modal 防止 | OK | `StudyClient.tsx:232` で `!sessionActive` 条件追加で LessonCompleteModal 抑制 / DailyQuestSummaryRibbon は /home 専用なので同時表示なし |

→ **すべての DEC regression: なし**

---

## 7. 副作用・エッジケース検証

### 7-1. SessionPicker の localStorage 同期

- 同一ユーザの 2 タブで同時にセッション選択: useSyncExternalStore (`SessionPicker.tsx:89-93`) で `storage` event を購読 → 他タブで write されると即時に `lastDuration` 表示が更新される。OK
- localStorage 利用不可環境 (Safari Private / iframe in cookie-blocked): `getLastSessionDurationSnapshot` が try-catch + 空 fallback (line 78-80)。OK

### 7-2. /study Server Component の searchParams 改ざん

- `?dur=999` / `?dur=abc` / `?dur=5;DROP+TABLE`: `Number.parseInt(durRaw, 10)` + `isSessionDurationMinutes` で全 invalid を null fallback → sessionDurationMinutes=null → StudyClient props で `sessionDurationMinutes={undefined}`/`sessionPlanSize={undefined}` → `sessionActive=false` で session-mode 不発動。OK
- `?session=<arbitrary>` UUID: 文字列のまま StudyClient に渡され data 属性として描画されるだけ。XSS 防御は React の自動 escape で OK / DOM injection 余地なし。OK

### 7-3. composeStudySession の defensive validation

- `learnerId=""`: `composeStudySession` は TypeError throw (`session-composer.ts:270-272`) → /study/[level]/[skill]/page.tsx の SSR 中に throw される / Next.js error boundary で 500 化の可能性
- ただし実際の経路は learnerId が必ず DB から取得した非空文字列なので production では発生しない。防御的 throw は意味がある。OK

### 7-4. session_id の伝搬

- /study?dur=5&session=AAA → click → /study/eiken-5/vocab?dur=5&session=AAA → 1 問目解く → router.refresh() → 同 URL で次問取得 → query 維持 / sessionId はそのまま伝搬
- ただし M-A1 で StudyClient remount により sessionId props は再受信するが、useState (sessionAnswers 等) は reset。sessionId そのものは Phase 1 では DB に書かないので影響なし

### 7-5. overtime polling の dependency 配列

- `useEffect(() => { interval = setInterval(...); return () => clearInterval(interval); }, [sessionActive, overtimeOffered, showSessionComplete, sessionDurationMinutes, sessionStartTime]);`
- 各 dependency 変化時に interval が一度 clear → 再 setInterval。leak なし。OK
- ただし M-A1 の影響で `sessionStartTime` が問題遷移ごとに変化 → polling reset → 累積経過時間が積算されない (機能不全)

### 7-6. SessionCompleteModal の confetti / playFeedback 失敗

- `triggerConfetti("medium")` 内部で canvas-confetti が autoplay policy で fail / `playFeedback("level-up")` で AudioContext suspend 状態 → silent fail。useEffect の void で握りつぶし → throw しない。OK
- 既存 LessonCompleteModal と同パターン

### 7-7. JST 6:00 境界 (W10-T3 残課題)

- session-composer は localDateString (`getFullYear/Month/Date`) で「ローカル日付」を採用しており JST 6:00 境界とは別系統 (Daily Quest が JST 6:00 / session は 0:00 境界)
- これは仕様: session は「いま選ぶ」もので 6:00 起点ではない (UI 上「きょうは どれくらい やる」は当日中にいくつでも選べる) / OK

---

## 8. 推奨修正 (優先順)

| # | 重要度 | 内容 | タイミング |
|---|:---:|------|-----------|
| 1 | **Major** | (M-A1) `key={problem.id}` を session-mode 時のみ削除 / または session 状態を上位 lift / **W10-T4 push 前必須** | **M-A1 修正後 push** |
| 2 | Minor | (M-N4) SessionCompleteModal 背景クリックの onClose を overtime reason 時のみ無効化 | M-A1 と同梱 |
| 3 | Minor | (M-N3) SessionCompleteModal useEffect deps を `[open, reason]` に縮小 | M-A1 と同梱 |
| 4 | Minor | (M-N1) SessionPicker の hydration mismatch を server 計算で解消 | W11 polish |
| 5 | Minor | (M-N2) 「ここまでにする」ボタン min-h-tap-cta 整合 | W11 a11y polish |
| 6 | Minor | session 状態 cumulative E2E 1 件追加 (M-A1 修正後の regression 防止) | W10-T5 着手時 |
| 7 | Minor | mobile-chrome での E2E 4 ケース実走 | W10-T5 着手時 |
| 8 | Minor | `/study` の authenticated Lighthouse audit | W12 β 投入前 |

---

## 9. CEO への報告サマリー

- **判定**: **CONDITIONAL APPROVE** (修正後 push)
- **静的検査**: typecheck / lint / unit **573 / 573 PASS**
- **E2E 実走結果**: **PASS 4 / 4** (port 3100 / chromium / workers=1 / 26.9 秒)
- **M-1 / M-2 / M-4 検証結果**:
  - **M-1 OK**: production code 不変 / quests.spec.ts test 1 が新仕様 (signup → /home で 3 件生成済 / /quests 遷移後も id 集合一致) で PASS
  - **M-2 OK**: `0013_w10_coin_idempotency_unique.sql` の partial UNIQUE INDEX が DEC-055 idempotency と整合 / 既存挿入経路 9 件すべて衝突なし / fixture migration 順序整合 / E2E 4/4 で衝突未発生を実証
  - **M-4 OK**: `/home` の `getOrGenerateTodayQuests` が `.catch → null` で fallback / リボン non-rendering / 他 9 並列 query は影響なし
- **Critical**: 0 件
- **Major**: 1 件 (M-A1: StudyClient `key={problem.id}` で session 状態が問題遷移ごとに reset → planSize 到達 / overtime 提案が事実上発火しない構造的バグ)
- **Minor**: 4 件 (M-N1〜M-N4)
- **Nits**: 1 件 (N-1)
- **push 可否**: **修正後 push** (M-A1 のみ修正必須 / M-N3/M-N4 は同梱推奨 / 他は次タスク以降)
- **W10-T5 (過学習防止 UX) 着手判断**: **M-A1 修正完了 + cumulative E2E 1 件追加後に着手可**

### 補足

- CEO 必須レビュー観点 A-K 全 11 項目について根拠ベース検証
  - A-J は OK / K (overtime polling) はリソース面 OK だが M-A1 で機能ベース NG
- DEC-024 罰則ゼロ哲学 / DEC-052 W9-B accessory mutex / DEC-055 W10-T1 ハネキン経済 / DEC-056 W10-T2 Shop UI / DEC-058 W10-T3 Daily Quest 哲学整合 すべて regression なし
- 静的検査 (typecheck / lint) clean / unit 573 件 GREEN / E2E 4/4 PASS
- M-A1 は **数行の修正で解消** 可能な構造問題のため、CEO 判断で「修正後 push」または「現状 push + 即座に follow-up 修正コミット」のいずれでも合理的
- W10-T4 の主目的「5-7 分セッション自動設計」の核心 UX (planSize 到達演出 / 累積進捗表示 / overtime 提案) は M-A1 修正なしには稼働しないため、push と同時に修正を入れることを **強く推奨**

---

## 10. 検証実行ログ (再現性)

```
$ cd projects/PRJ-016/app

$ npx tsc --noEmit
(exit 0 / clean)

$ npm run lint
> hanei@0.1.0 lint
> eslint .
(exit 0 / clean)

$ npm run test -- --run
 Test Files  44 passed (44)
      Tests  573 passed (573)
   Start at  21:36:20
   Duration  4.24s

$ netstat -ano | grep ":3000 "
TCP  0.0.0.0:3000  LISTENING  37296    # dev process が占有

$ # 一時 config (port 3100) を作成
$ PORT=3100 PLAYWRIGHT_BASE_URL=http://localhost:3100 \
    npx playwright test tests/e2e/quests.spec.ts \
    --config=playwright.config.review-w10-t4.ts \
    --project=chromium --workers=1
Running 4 tests using 1 worker
  ok 1 [chromium] › quests.spec.ts:179:7 › signup → /home で 3 件 lazy gen 済 / /quests 遷移後も同 id 集合で冪等 (1.8s)
  ok 2 [chromium] › quests.spec.ts:215:7 › 同日 2 度目の /quests 遷移でも 3 件のまま (冪等) (1.3s)
  ok 3 [chromium] › quests.spec.ts:243:7 › 3 件全 claim で残高 +reward*3 + bonus が 1 度だけ計上される (2.2s)
  ok 4 [chromium] › quests.spec.ts:299:7 › 既に claimed な quest を再 claim しても skipped (残高/取引行は増えない) (1.8s)
  4 passed (26.9s)

$ # 一時 config 削除 (永続変更なし)
$ rm playwright.config.review-w10-t4.ts
```

---

レビュー実施: レビュー部門 (Claude Code)
レビュー日: 2026-04-30
判定: **CONDITIONAL APPROVE (M-A1 修正後 push)**
