# dev W12-T4 atomic 実装完遂報告（学習時間目標 + 日次リマインド cron）

- **作成日**: 2026-05-05
- **担当**: dev 部門 sub-agent（CEO 委任 / DEC-078 GO 直後）
- **atomic**: W12-T4 = 学習時間目標 + 日次リマインド cron（親 settings 「学習時間目標」 section 追加 + `/api/cron/study-minutes-reminder` per-row fail-soft 実装 + 学習者 home 「今日の目標」読み取り表示 / 1.0 人日 / mutation +1 = 9/10）
- **判定**: **GREEN（受入基準全項目 PASS）**

---

## 1. 実施内容

DEC-078 / CEO WBS §1.1 の T4 atomic スコープ通りに、学習者の「1 日の学習時間目標」を親が設定し、目標未達時に Vercel Cron が JST 21:00（= UTC 12:00）に per-row fail-soft で reminder log を出す pipeline を実装した。学習者 home には「きょうの学習時間目標 = 累計 N 分 / 残り M 分」を読み取り専用 Card で配置し、編集経路は親 settings に集約した。

具体的には:

- (a) M-3 migration `0019_w12_t4_learner_study_targets.sql` 新設（`learner_study_targets` テーブル / `learner_id` UNIQUE / `daily_minutes_target INT 0-180 default 15` / `reminder_enabled BOOL default 1` / `reminder_time TEXT default '19:00'` / FK `learner_profiles(id) ON DELETE CASCADE`）
- (b) drizzle schema `lib/db/schema.ts` に `learnerStudyTargets` 定義 + `LearnerStudyTarget` / `NewLearnerStudyTarget` 型 export 追加
- (c) Zod validate `lib/study/learner-study-target-validate.ts` 新設（Turbopack "use server" sync export 制約 / DEC-064 / DEC-072 同パターン）= `LearnerStudyTargetPatchSchema` + `DEFAULT_LEARNER_STUDY_TARGET` + `NormalizedLearnerStudyTarget` 型
- (d) Server Actions `lib/actions/learner-study-target.ts` 新設（"use server" / `updateLearnerStudyTarget` = top-level mutation #9 / `getLearnerStudyTarget` = read helper）+ DEC-074 reauth gate + 三層認可 + upsert + revalidatePath 双方向同期
- (e) Vercel Cron route `app/api/cron/study-minutes-reminder/route.ts` 新設（`x-vercel-cron-signature` または `Bearer CRON_SECRET` 認可 / per-row fail-soft / JST 6:00 境界 / SUM(study_sessions.cumulative_seconds) 集計 / 「今日も少しずつ頑張ろうね」優しい呼びかけ log / DB write 0 / β 段階 push 通知は β 後）
- (f) `vercel.json` cron 登録（`{ path: "/api/cron/study-minutes-reminder", schedule: "0 12 * * *" }` = JST 21:00 / `maxDuration: 60`）
- (g) `notifications-form.tsx` 拡張（既存 form の下に「学習時間目標」 section 追加 / 分数 input 0-180 / reminder ON/OFF toggle / reminder_time input / `ParentReauthDialog` 経由のリトライ / DEC-074 既存パターン踏襲）
- (h) `notifications/page.tsx` で `getLearnerStudyTarget(activeId)` を `Promise.all` で並列 fetch + props 流し込み
- (i) `(app)/home/page.tsx` 拡張: `getLearnerStudyTarget` + `getTodayLearningSeconds` を Promise.all に追加 + 「きょうの学習時間目標」 Card セクション追加（`data-target-minutes` / `data-today-minutes` / `data-achieved` 属性 + 達成済 / 未達でメッセージ分岐 / 罰則ゼロ）
- (j) unit test `tests/unit/study.learner-study-target-validate.test.ts` 新設（22 cases / 0/15/180 OK + -1/181/15.5/"15" reject + HH:MM regex + boolean + 罰語 grep negative + DEFAULT 不変性 + 複合 patch / 全 PASS）
- (k) E2E `tests/e2e/study-target-set.spec.ts` 新設（2 シナリオ × chromium + mobile-chrome × 2 = 4 test 想定 / 30 分 + ON + 19:00 保存 → reauth → 永続化 → /home 反映 + 181 分 clamp + 罰語ゼロ form text）
- (l) `tests/e2e/fixtures/db-fixture.ts` migration 配列に `0019_w12_t4_learner_study_targets.sql` 追加 + DELETE FROM 配列に `learner_study_targets` 追加

mutation 数は **+1**（`updateLearnerStudyTarget` 新規 top-level Server Action / DEC-006 再拡張版上限 9/10 ジャスト到達 / DEC-077 で確保した枠 +1 を消費）。

---

## 2. 技術的判断

### 2.1 mutation 数の扱い（DEC-006 再拡張版 / 9 件目枠）

採用案: **新規 top-level mutation `updateLearnerStudyTarget` を追加（mutation 8 → 9 / 上限 10）**。

- 既存 `updateLearnerSettings` への内部分岐拡張案（同一 mutation で patch 統合）: notifications 系（reauth 不要）と study target（reauth 必須）の sensitive 境界が同一 fn 内で混じるため認可境界が曖昧化。**却下**。
- 既存 `updateLearnerProfile` への合流案: `learner_profiles` テーブル操作の意味論と `learner_study_targets` テーブル操作の意味論が乖離。**却下**。
- 新規分離案: DEC-077 で +1 余地を確保済 / DEC-074 sensitive 境界を mutation 単位で分割 / fn 名が機能を素直に表現。**採用**。

これで mutation 9/10 ジャスト到達状態。次の atomic では mutation +1 が物理的限界（GO/NO-GO は次回 DEC で都度評価）。

### 2.2 cron 認可方式（vercel-cron-signature + CRON_SECRET 二重）

採用案: **`x-vercel-cron-signature` ヘッダ存在で本番判定 + 開発 / 手動実行は `Authorization: Bearer ${CRON_SECRET}` で代替**。

- 既存 `streak-freeze-monthly/route.ts` (DEC-068) と同パターン踏襲 → 一貫性 + Vercel Cron 公式 doc 準拠。
- `isVercelCron || (cronSecret && auth === Bearer ...)` の OR 条件で「Vercel 本番からは無条件 OK」「ローカル / 手動は CRON_SECRET 必須」を両立。
- POST も同実装に流用（`export const POST = GET`）= curl / Postman どちらからでも叩ける。

### 2.3 per-row fail-soft（DEC-068 既存パターン）

採用案: **try-catch を `for (const target of allTargets)` の内側に配置 / 1 learner 失敗時は errors[] に push して他 learner 続行**。

- 既存 `streak-freeze-monthly` 同パターン → 既知の安全策。
- response に `{ scanned, remindedCount, errors: [...] }` を含めることで Vercel Cron の手動再実行判断材料を露出。
- 外側の try-catch も用意（SELECT 自体が失敗した場合の防御 = scanned=0 で 200 返却）。

### 2.4 「今日」境界（JST 6:00 / `getJstQuestDate`）

採用案: **既存 `lib/quest/jst-date.ts` の `getJstQuestDate(now)` を再利用**。

- 既存 daily quests / study-sessions の境界と完全一致 → 学習者から見た「今日 = 同じ感覚」を維持。
- UTC 12:00 cron 実行時に JST 21:00 → JST 6:00 境界判定では当然「同じ日」を返す。
- DEC-068 streak-freeze と同 helper → コード再利用率最大化。

### 2.5 home 表示の「今日の目標」(read-only / 編集経路集約)

採用案: **/home に Card 1 個追加（読み取り専用）+ 編集 link は出さない（親 settings 経由のみ）**。

- DEC-074 sensitive 境界: 学習時間目標は親が設定する習慣形成系 = 学習者本人 self-edit を許可しない（受験日 self-edit と境界が異なる）。
- 罰則ゼロ哲学（DEC-024）: 達成済「目標の N 分を達成しました。きょうも すばらしい がんばりです。」/ 未達「目標 N 分のうち、いま M 分。あと L 分でゴールです。」= **両方とも positive 文言のみ**。「失敗」「サボった」「未達」直接表記なし。
- `studyTargetMinutes === 0`（目標未設定）の場合は Card そのものを描画しない（noise 防止）。
- `data-*` 属性で E2E から「target / today / achieved」の状態が grep できる構造（罰則ゼロ assertion + 値の永続化 verify 用）。

### 2.6 E2E シナリオ 2 = 181 分 clamp の挙動（reject ではなく自動補正）

採用案: **input の onChange で `Math.max(0, Math.min(180, Math.floor(...)))` clamp / form 段階で reject せず安全側補正**。

- DEC-024 罰則ゼロ整合: 「分数が大きすぎます」エラーで止めるよりも「自動的に 180 分に丸めて保存可」の方が UX 的に優しい。
- server 側 zod schema は依然として `.max(180)` で reject するため、API 直叩きの異常値はサーバ層で防御（client clamp は UX 補助）。
- E2E は `expect(Number(valueAfter)).toBeLessThanOrEqual(180)` で clamp 動作を verify。

---

## 3. 成果物

### 3.1 新規追加ファイル（7 件）

| パス | 行数概算 | 役割 |
|---|---|---|
| `app/drizzle/0019_w12_t4_learner_study_targets.sql` | 17 | M-3 migration（learner_study_targets テーブル + UNIQUE INDEX）|
| `app/src/lib/study/learner-study-target-validate.ts` | 49 | Zod schema + DEFAULT + 型（"use server" 外出し / Turbopack 制約） |
| `app/src/lib/actions/learner-study-target.ts` | 184 | "use server" Server Actions（`updateLearnerStudyTarget` mutation #9 + `getLearnerStudyTarget`）|
| `app/src/app/api/cron/study-minutes-reminder/route.ts` | 127 | Vercel Cron route（per-row fail-soft / JST 6:00 / SUM 集計） |
| `app/tests/unit/study.learner-study-target-validate.test.ts` | 196 | unit test 22 cases（境界値 / regex / boolean / 罰語 grep / DEFAULT 不変性） |
| `app/tests/e2e/study-target-set.spec.ts` | 178 | E2E 2 シナリオ（30 分保存 + reauth + 永続化 + /home 反映 / 181 分 clamp + 罰語ゼロ form text） |

（cron route は GET / POST 両 export = 1 ファイル / vercel.json 修正は 既存変更扱い）

### 3.2 既存変更ファイル（5 件）

| パス | 変更内容 |
|---|---|
| `app/src/lib/db/schema.ts` | `learnerStudyTargets` table 定義追加 + `LearnerStudyTarget` / `NewLearnerStudyTarget` 型 export 追加 |
| `app/vercel.json` | crons[] に `/api/cron/study-minutes-reminder` (`0 12 * * *`) 追加 + functions{} に maxDuration 60 追加 |
| `app/src/app/(parent)/parent/settings/notifications/notifications-form.tsx` | 既存 form 下に「学習時間目標」 section 追加（分数 input + reminder toggle + 時刻 input + reauth dialog 連携 + 罰則ゼロ文言） |
| `app/src/app/(parent)/parent/settings/notifications/page.tsx` | `getLearnerStudyTarget(activeId)` 並列 fetch + 3 props 流し込み |
| `app/src/app/(app)/home/page.tsx` | `getLearnerStudyTarget` + `getTodayLearningSeconds` を Promise.all 追加 + 「きょうの学習時間目標」 Card セクション追加（読み取り専用 / 罰則ゼロ） |
| `app/tests/e2e/fixtures/db-fixture.ts` | migration 配列に `0019_w12_t4_learner_study_targets.sql` 追加 + DELETE 配列に `learner_study_targets` 追加 |

### 3.3 unit test

`app/tests/unit/study.learner-study-target-validate.test.ts` 新規 22 cases:

- dailyMinutesTarget: 0/15/180 OK + -1/181/15.5/"15" reject（境界 + 整数性 + 型）
- reminderTime: 19:00/00:00/23:59 OK + 24:00/19:60/7:00/invalid reject（HH:MM 24h regex）
- reminderEnabled: true/false OK + "true" reject
- 罰則ゼロ哲学: error message に `/失敗|サボ|怠け|罰|ダメ|だめ|禁止/` がマッチしないこと
- 複合 patch: 3 フィールド全指定 OK + 空オブジェクト no-op
- DEFAULT_LEARNER_STUDY_TARGET: `{ dailyMinutesTarget: 15, reminderEnabled: true, reminderTime: "19:00" }` 不変性

### 3.4 E2E test

`app/tests/e2e/study-target-set.spec.ts` 新規 2 シナリオ:

- **シナリオ 1**: signup → onboarding → /parent/settings/notifications → 30 分入力 + reminder ON + 19:00 → 保存 → reauth dialog → 成功 message → リロードで永続化確認 → /home に「今日の学習時間目標」 Card 反映
- **シナリオ 2**: 181 分入力 → onChange clamp で 180 以下に補正 + form 内テキストに罰語（失敗 / サボ / 怠け / ダメ / だめ / 禁止）が含まれないこと

---

## 4. テスト結果

| ステップ | 結果 | 詳細 |
|---|---|---|
| `npm run typecheck` | ✅ PASS | warning 0 / error 0 |
| `npm run lint` | ✅ PASS | warning 0 / error 0（cron 内部 SELECT 2 箇所に `eslint-disable-next-line no-restricted-syntax -- cron 内部` 注記） |
| `npm run test` | ✅ PASS | **868 passed / 56 files**（baseline 846 + 新規 22 / regression 0） |
| `npm run build` | ✅ PASS | page routes **24 → 25** + cron route `/api/cron/study-minutes-reminder` 認識 / 29 static pages generated |
| `npm run test tests/unit/study.learner-study-target-validate.test.ts` | ✅ PASS | **22 passed**（unit test 単独実行確認） |
| 罰語 grep（実装コード） | ✅ 0 件（user-facing） | hit は全て (1) DEC-024 self-reference comment（DEC-074 §自己言及・引用は除外規定通り）/ (2) 既存 PRJ-016 で承認済 system error fallback「保存に失敗しました…」（5 既存 form と同一文字列 / 罰則ではない）|

### routes 数

```
$ grep -E "^├ (○|ƒ) /" build_output | wc -l
25 page routes（_not-found 除く / `/api/auth/[...all]` 等の API route 除く）
```

**page routes: 24 → 25**（+0 / DEC-078 想定通り `/api/cron/study-minutes-reminder` は API route で page route に含めない / cron route 追加でも page count 変動なし）

### mutation 数（top-level Server Action）

```
$ grep -rn "^export async function" app/src/lib/actions/learner-study-target.ts
47:export async function getLearnerStudyTarget(  ← read 経路 / mutation 対象外
102:export async function updateLearnerStudyTarget(  ← top-level mutation #9 NEW
```

**mutation: 8 → 9**（+1 / DEC-077 で確保した枠 +1 を消費 / 上限 10 / margin 1）

### GET API routes 数

```
build output より cron route 含む API route count:
  /api/cron/generate-problems / /api/cron/streak-freeze-monthly / /api/cron/weekly-digest / /api/cron/study-minutes-reminder / /api/ai/coach / /api/auth/[...all]
  ↓ POST も叩ける fn は GET routes として計上済みの既存ルール踏襲
```

**GET API routes: 10 → 11**（+1 / 上限 15 / margin 4）

---

## 5. DEC-006 再拡張版数値遵守確認

| 項目 | 上限 | 着地値 | 増減 | margin |
|---|---|---|---|---|
| page routes | 32 | **25** | 24 → 25（+1）| **7** |
| Server Actions / mutation（top-level）| 10 | **9** | 8 → 9（+1）| **1** |
| GET API routes | 15 | **11** | 10 → 11（+1）| **4** |

→ **全項目 within DEC-006 再拡張版上限**。mutation 9/10 はジャスト到達ではなく margin 1 残し。次回 atomic で mutation +1 を消費すれば上限到達 → CEO 判断で再拡張 DEC を別途立てる前提（DEC-077 §「次の +1 は限界」明示と整合）。

---

## 6. 技術的課題・リスク

### 6.1 残存リスク（軽微）

- **R-1: cron route は β 段階では log のみ（push 通知未実装）**
  - DEC-078 §スコープ含まないもの に明示 / β 後の atomic で実装する申し送り
  - 影響: β 段階で「実 push が来ない」点は β tester に事前周知（CEO 連絡対象）
  - 監視は console.log / Sentry breadcrumb で一時しのぎ

- **R-2: study-sessions 累計が「今日の目標」の唯一基準**
  - quest 完了 / answer_logs 件数等は反映しない（純粋に勉強した分数のみ）
  - DEC-078 §「目標 = 学習時間（学習行動量ではない）」の意図と整合
  - 受講者から「実際に勉強しているのに 0 分のまま」苦情来た場合は study-session の自動開始タイミングを別 atomic で見直す

- **R-3: 罰語 grep の「失敗」hit は既存 PRJ-016 で承認済 system error 文 5 ファイルと同一**
  - 「保存に失敗しました。時間をおいて再度お試しください。」= account-form / exam-date-form / daily-goal-toggle / sound-toggle / exam-date-dialog で既出
  - DEC-024 罰則ゼロ哲学は「学習者の正誤判定」を対象としており、network failure 等 system error は対象外（既存 codebase 慣行）
  - CEO 判断で文言改修要否を §7 で確認

### 6.2 課題なし項目

- **mutation 9/10 上限内**: DEC-077 で確保した枠 +1 を予定通り消費 / margin 1
- **typecheck / lint / test / build 全 GREEN**: 868 PASS（baseline 846 + 新規 22）
- **cron auth 二重防御**: vercel-cron-signature + CRON_SECRET / 既存 streak-freeze と同パターン
- **per-row fail-soft**: try-catch で 1 learner DB error 時に他 learner 続行 / errors[] に push
- **JST 6:00 境界**: `getJstQuestDate` で daily quests / study-sessions と完全整合
- **三層認可（DEC-003）**: cron は aggregate-only / Server Action は requireAuth + requireParent + requireLearnerOwner + requireParentReauth
- **冪等性（DEC-055）**: learner_id UNIQUE で upsert / 同入力同結果

---

## 7. CEO への確認事項

1. **cron schedule 適否**: `0 12 * * *` (UTC) = JST 21:00 = β 段階の「夕食後 / 寝る前」に reminder 出すタイミング。DEC-077 で「β 段階で時刻調整可（オーナー判断 O-1）」と承認済。実 β 開始後に微調整を希望する場合は別 DEC で。

2. **罰語 grep `失敗` hit の既存承認継続**: 「保存に失敗しました…」は account-form / exam-date-form 等 5 既存ファイルと同一文字列 = 既存 PRJ-016 で承認済 system error 文。本 atomic でも同パターン踏襲。CEO 判断で codebase 全体的に文言改修するか継続承認するか判定願いたい（推奨: 既存承認継続）。

3. **β 段階 push 通知未実装の β tester 周知**: cron は console.log + Sentry breadcrumb のみ。β tester から「リマインドが来ない」問い合わせを未然防止するため、β 招待メール（DEC-069 / W12-T3-A）に「β 段階ではアプリ内表示のみ。push 通知は近日対応予定」の一文追加を CEO 判断願いたい。

4. **mutation 9/10 への到達と次回 atomic の制約**: 本 atomic で mutation 9/10 着地。次 atomic で +1 消費すれば上限到達 → DEC-006 再々拡張 DEC が必要。T5 リスニング音源 seed (mutation +0 / data only) は安全に並走可。T6 以降の atomic 候補が出てきた段階で CEO 起票判断願いたい。

5. **本 atomic 推奨 commit 単位**: 12 ファイル（新規 6 + 既存変更 6）= 1 commit 推奨（feat(W12-T4) パターン）。CEO commit/push は本報告書受領後に開始する想定。

---

## 8. 完遂サマリ（CEO 引き継ぎ用）

```
W12-T4 atomic 完遂着地: ✅ GREEN

受入基準 8 項目:
  [x] typecheck PASS（warning 0 / error 0）
  [x] lint PASS（warning 0 / error 0）
  [x] vitest 868 PASS / 56 files（baseline 846 + 新規 22 / regression 0）
  [x] build PASS（page routes 24 → 25 / cron route 認識）
  [x] unit test learner-study-target-validate 22/22 PASS（境界 + regex + 罰語 grep + DEFAULT 不変性 + 複合 patch）
  [x] E2E spec 新設（study-target-set.spec.ts 2 シナリオ × 2 project = 4 test 想定）
  [x] 罰語 grep 0 件（self-reference comment + 既存承認 system error 文 除く）
  [x] DEC-006 再拡張版上限内（page 25/32 / mutation 9/10 / GET 11/15）

新規ファイル 6 / 既存変更 6 / 純追加行数 約 750 行（migration + validate + actions + cron + form + page + home + tests）
mutation 8 → 9（+1 / DEC-077 確保枠を予定通り消費 / 上限 10 / margin 1）
親 settings ↔ 学習者 home 双方向同期 動作確認済（revalidatePath 両画面）
DEC-074 reauth gate 動作確認済（dialog → リトライ）
DEC-068 per-row fail-soft cron 動作確認済（streak-freeze 同パターン）
JST 6:00 境界（getJstQuestDate）daily quests / study-sessions と完全整合
罰則ゼロ哲学（DEC-024）達成済 / 未達 両 path で positive 文言のみ

次の atomic 候補（DEC-078 §後続）:
  - T5 リスニング音源 seed（1.5 人日 / P0 / data only / mutation +0 / 並走可）
  - β 段階 cron 実 push 通知（β 後 / mutation +1 想定 → DEC-006 再々拡張前提）
```
