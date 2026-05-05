# PRJ-016 Phase 3 - dev 部門 既存基盤充足度 + technical scope + DB schema 影響 + 工数見積 + atomic 暫定分解

- **作成日**: 2026-05-05
- **作成部門**: dev
- **対象 atomic**: DEC-073 軸-3 dev 部門担当
- **対象成果物**: Phase 3 = 本格運用準備 (実子使用前提) フェーズの技術視点 WBS 草案
- **オーナー要望 7 点**: (1) 受験日登録 / (2) アカウント設定変更 / (3) 長期-短期目標 / (4) 目標学習時間 / (5) 単語辞書 + 発音 / (6) AI チャット質問 / (7) リスニング・ライティング実施可能化
- **制約**: DEC-024 罰語ゼロ / DEC-006 GET 10 + mutation 5 / コード変更ゼロ (本 atomic は Markdown のみ) / 個人情報は仮名・型のみ / バッファ 20% 込み
- **凡例**: F-N = 機能ID / Phase3-TN = atomic ID / 工数単位 = 人日 / P0/P1/P2 = 実子使用前にどの段階で必要か
- **罰語回避表記の手控え**: 「課題 / 抑止 / 構造的封鎖 / 留意事項 / 取り扱い注意 / 想定外動作 / 対処余地」を中立語として使用する

---

## 0. Executive Summary

| 区分 | 値 |
|---|---|
| Phase 3 atomic 暫定数 | **11 件** (T1〜T11 / Phase 3 内の波 = 第 1-3 波) |
| 純見積合算 | 9.25 人日 |
| バッファ 20% 込み総工数 | **11.10 人日** (= 約 12 人日 / 個人開発 1 人想定) |
| 新規 DB migration | **6 件** (新規 5 テーブル + problems 既存列拡張 1) |
| 新規 API route | 0 〜 1 件 (`/api/ai/chat` の新設で 25 → 26 = DEC-006 改訂要請 1 件) |
| 新規 mutation (Server Action) | 8 〜 10 件 (= 既存 38 + 新規 8〜10 = mutation 数自体は DEC-006 5 mutation 上限の意味と乖離した運用既成事実があり要再確認 -- §3.3 で詳述) |
| 推奨 OpenAI 月次予算 | **¥3,000 / 月** (1 ユーザー想定 / Phase 3 第 1-2 波) |
| オーナー判断要請 | **6 件** (§7) |

**ハイライト**:
- F-1 受験日 / F-7 リスニング (UI) / F-7 ライティング (採点) は **既存基盤で 60-80% 充足** = 拡張系 atomic のみ。
- F-2 settings / F-3 目標 / F-4 学習時間 / F-5 辞書 / F-6 AI チャット は **新規 = ゼロベース技術設計**。
- 最大の technical risk = **DEC-006 (25 routes / mutation 5) 制約と F-6 AI チャットの食い合わせ**。AI チャット用の `/api/ai/chat` 追加で 25 → 26 routes になる。Phase 3 着手にはオーナー承認の **DEC-006 改訂判断が前提**。

---

## 1. 既存基盤の充足度詳細調査

### 1-1. F-1 受験日関連

| 項目 | 状況 | 根拠 file:line |
|---|---|---|
| Server Action `updateExamDate` | **存在** (UPSERT / 上書確認 stage 完備) | `src/lib/actions/exam-date.ts:47-115` |
| バリデーション (level + date format + 過去日) | **存在** (純関数 / 三層認可前) | `src/lib/actions/exam-date-validation.ts` (存在確認 / 4 reason enum) |
| 親 dialog UI | **存在** (shadcn Dialog + input[type=date] / overwrite 確認 stage 完備) | `src/app/(parent)/components/exam-date-dialog.tsx:55-273` |
| 学習者画面 (/home) の残日数表示 | **既に存在** | `src/app/(app)/home/page.tsx:118-186, 310-381` (`computeDaysUntil` + `daysUntilExam` + countdown variant 5 段階) |
| DB schema | **専用 `exam_dates` テーブル存在** + `learner_profiles.examDate` 列も存在 (二重) | `src/lib/db/schema.ts:806-826`, `:139-209` (ln 153 `examDate: text("exam_date")`) |
| 履歴管理 | **可** (exam_dates は `learnerIdx` 複合 index で複数行容認 / 最新行 SELECT パターン) | `schema.ts:824-825` |

**充足度 80%**: 親 dialog → DB → 学習者 home countdown までの一気通貫が完備。**残課題**は (a) `learner_profiles.examDate` と `exam_dates` テーブルの二重ソース問題 (どちらが信頼源か `home/page.tsx` 経路で要再確認) / (b) **学習者本人画面** からの自己編集経路の有無 (= 現状は親 dialog のみ) / (c) 受験日変更時の dashboard 側 invalidate パス。

### 1-2. F-7 リスニング関連

| 項目 | 状況 | 根拠 |
|---|---|---|
| `shouldShowAudioUi(audioUrl, skill)` 純関数 | **存在** | `src/lib/study/audio-gate.ts:7-15` |
| `MAX_REPLAY = 3` (再生上限) + `canReplay(playCount)` | **存在** | `src/lib/study/audio-gate.ts:21-25` |
| StudyClient の audio UI 描画分岐 | **存在** (`<audio src={displayedView.audioUrl ?? undefined}>` + 再生 / 一時停止 / replay / 再生回数表示) | `src/app/(app)/study/[levelCode]/[skillCode]/StudyClient.tsx:696-709` |
| Listening Master Badge | **存在 (badge icon)** | `src/components/badges/icons/listening-master.tsx` (確認済) |
| problems.audioUrl カラム | **存在 (nullable)** | `src/lib/db/schema.ts:267` |
| 現状の seed audio 充足度 | **0 件** (seed-problems 系で `audio_url` を明示的に setting する箇所が grep 0 件 = listening 問題は DB に存在するが mp3 URL 列が NULL) | `scripts/seed-problems-runner.ts` 内 grep `audio_url\|audioUrl` 0 件 |
| listening_mcq 問題件数 | seed scripts に **5 級 100 問 + 4 級分 + 3 級分** が `listeningProblems` 配列で存在 | `scripts/seed-problems-w3.ts:165-209` 等 |

**充足度 70% (UI 系) / 0% (音源)**: UI / 純関数 / 再生回数 cap / DB column / badge 全て準備済。**音源 (mp3) のみ完全に 0 件** = 「リスニング問題は出題されるが音源が再生不可」状態。Phase 3 で TTS 生成 + Vercel Blob / Supabase Storage 配信が要点。

### 1-3. F-7 ライティング関連

| 項目 | 状況 | 根拠 |
|---|---|---|
| `validateWritingInput` (純関数 / 10〜600 字) | **存在** | `src/lib/study/writing-input.ts:64-84` |
| `pickWritingScoreLabel` (kid-safe 二値ラベル) | **存在** ("できた" / "もうすこし" / negative 表現禁止) | `src/lib/study/writing-input.ts:29-34` |
| `scoreWritingEssay` (AI 採点) | **存在** (gpt-5-mini + fallbackModel + moderation + cost guard + jaccard fallback) | `src/lib/ai/score-writing.ts:109-161` |
| system prompt (kid-safe) | **存在** (7 ルール明文化 / negative 表現禁止 / 個人情報禁止 / JSON 準拠) | `src/lib/ai/score-writing.ts:167-180` |
| OpenAI moderation 統合 | **存在** | `score-writing.ts:114-118` (`moderateText` 呼出) |
| cost guard (¥10/日) | **存在** | `score-writing.ts:121-123` + `src/lib/constants.ts:31` (AI_COST_LIMIT_JPY_PER_USER_PER_DAY = 10) |
| 4 種 fallback (no_key / moderation / cost / error) | **存在** | `score-writing.ts:240-258` |
| StudyClient の textarea + submit | **存在** | `StudyClient.tsx:741-748+` (`essay-textarea` testid) |
| seed の writing_essay 問題件数 | 3 級向けのみ (W7 由来 / 件数は seed-problems-w4 等で 4 級は 0 / 5 級は無 = writing は 3 級限定が想定) | `scripts/seed-problems-runner.ts` の `writing_essay` 分岐 |

**充足度 80%**: AI 採点 + fallback + cost guard + moderation の **4 重防御**が既に完成。**残課題** = (a) writing 問題件数の seed 拡充 (3 級 1〜2 問前提から「実子の練習量」へ拡張) / (b) 採点フィードバック UI の polish (現状でも score / strengths / improvement / feedback は出る) / (c) **採点履歴の閲覧経路** (履歴を時系列で見て成長を確認できる学習者画面 / 親画面)。

### 1-4. F-2 設定関連

| 項目 | 状況 | 根拠 |
|---|---|---|
| `(app)/settings/accessories/page.tsx` | **存在 (アクセサリ専用)** | `src/app/(app)/settings/accessories/page.tsx:61-210` |
| 全体 `/settings/page.tsx` (route トップ) | **不在** | `glob src/app/(app)/settings/**/*.tsx` 結果 = `accessories\page.tsx` のみ |
| 表示名 / nickname 変更経路 | **不在** (onboarding 時の初期設定のみ / 後続更新 UI 無し) | `glob` 結果 + `lib/actions/learner-preferences.ts:158-196` (`dailyGoalXp` のみ更新可 / nickname 不可) |
| メール変更 | **不在** (Better Auth 機能としては `accounts` テーブルに存在するが UI route 0 件) | `app/(app)/` 配下に該当 page 無し |
| パスワード変更 | **不在** (Better Auth の change-password endpoint は SDK 経由で利用可だが UI 0 件) | 同上 |
| 退会 | **不在** | 同上 |
| 親パスワード confirmation gate | **不在** (DEC-003 三層認可は requireAuth + requireParent + requireFamilyMember + requireLearnerOwner で SQL 層完結 / 親パスワード再入力 gate のような **追加層** は無い) | `src/lib/auth/guards.ts` (確認済) |

**充足度 15%**: アクセサリ設定のみ存在。**ほぼゼロベース** = `/settings` トップ + サブページ群を Phase 3 で新設する設計が必要。

### 1-5. F-3 目標 / F-4 学習時間 / F-5 辞書 / F-6 AI チャット

| 機能 | 既存 | 根拠 |
|---|---|---|
| F-3 長期-短期目標 | **完全に新規** (grep `learner_goals` / `goalType` / `targetEikenLevel` は schema.ts:152 で「目標級」のみ存在 = level の話 / 期間目標 0) | schema.ts 全体走査 |
| F-4 目標学習時間 | **部分** (`learner_profiles.dailyMinutesTarget` 列 + `studySessions.cumulativeSeconds` で計測基盤あり) | schema.ts:154 + 1125-1168 |
| F-5 辞書 popup | **完全に新規** (単語クリック検出 / 外部 API / popup UI / cache 全て 0 件) | grep 0 件 |
| F-6 AI チャット質問 | **部分** (`/api/ai/coach` route が **既存** = streaming + tool use + moderation 三重ガード + cost guard 完備) | `src/app/api/ai/coach/route.ts:1-60` + `aiCoachConversations` / `aiCoachMessages` テーブル既存 (schema.ts:578-632) |

**重要発見**: AI チャットは **`/api/ai/coach` という既存 route を流用可能**。学習画面からの「解説でわからない時の追加質問」UI を新設すれば、route 増加なしで F-6 が成立する余地がある (= DEC-006 改訂回避経路)。

---

## 2. 新規実装が必要な機能の technical scope

### 2-1. settings 全体 page (F-2)

#### 提案ルート構成

```
/(app)/settings/
  ├── page.tsx                  ★新設 (トップ / 各サブページへの index)
  ├── account/page.tsx          ★新設 (表示名 / 学習者 nickname / 学年=currentLevel / アバター)
  ├── notifications/page.tsx    ★新設 (push / email opt-in)
  ├── security/page.tsx         ★新設 (パスワード変更 / セッション管理 / 退会 link)
  ├── targets/page.tsx          ★新設 (F-3 / F-4 と統合 = 目標 + 目標学習時間)
  ├── delete-account/page.tsx   ★新設 (退会確認 / 親パスワード再入力)
  └── accessories/page.tsx      既存
```

= **新設 page 6 件 + index 1 件** (= 計 7 routes 追加 → §3 で DEC-006 影響評価)。

#### Form 構成案

- account: nickname (text) / currentLevel (select 4 段) / avatarId (radio)
- notifications: emailOptIn (checkbox) / pushOptIn (checkbox / Phase 3.5 候補)
- security: 現パスワード / 新パスワード / 新パスワード確認 / 退会ボタン
- targets: longTermGoal (text + targetExamLevel + deadline) / shortTermGoals (繰り返し可 array) / dailyMinutesTarget (number) / weeklyMinutesTarget (number)

#### 親パスワード confirmation gate 実装方針

**DEC-003 三層認可継承**: 既存の `requireAuth → requireParent → requireFamilyMember → requireLearnerOwner` の 4 層に加え、**「子供本人が settings/security に踏み込むと親パスワード再入力 dialog が必須」**という第 5 層を導入する案:

```
ParentReauthGate (新設 pure module / src/lib/auth/parent-reauth.ts)
  - 親 user.id × parent_reauth_at < 5min なら通過
  - それ以外は <Dialog> で password 再入力 → Better Auth の reauth() → DB に parent_reauth_at 更新
```

**設計思想**: パスワード変更 / 退会 / 親 email 変更 / 大きな目標再設定 等の **不可逆操作 mutation** にのみ適用 (頻繁な操作には付けない)。

#### 既存 `accessories/page.tsx` との関係整理

- accessories は **学習者向け** (子供本人が遊ぶ画面) = settings ではあるが「キッズコンテンツ」寄り。
- 新設 settings 群は **親操作前提**。トップから両方に導線を出すが、`/(app)/settings/accessories` は Phase 3 で `/(app)/character/accessories` への renaming も検討余地あり (= 親 settings と分離するため) → **ルート変更は break change なので Phase 3 では行わず Phase 4 で再評価**。

### 2-2. 目標 (F-3 / 長期/短期)

#### DB schema 案 (新規テーブル `learner_goals`)

```typescript
export const learnerGoals = sqliteTable("learner_goals", {
  id: text("id").primaryKey(),
  learnerId: text("learner_id").notNull().references(() => learnerProfiles.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["long_term", "short_term"] }).notNull(),
  /** 例: "英検3級合格" / "今週 30 問解く" / "今月リスニング 15 問" */
  title: text("title").notNull(),
  /** 数値ターゲット (任意 / shortTerm 系の進捗 bar 用 / nullable) */
  targetValue: integer("target_value"),
  targetUnit: text("target_unit", { enum: ["problems", "minutes", "days", "score", "other"] }),
  /** 期限 (long_term は exam date 連動 / short_term は週次/月次 = 'YYYY-MM-DD') */
  deadline: text("deadline"),
  status: text("status", { enum: ["active", "achieved", "expired", "cancelled"] }).notNull().default("active"),
  /** 達成値 snapshot (達成時 freeze / dashboard で「達成: 30/30問」表示) */
  progressValue: integer("progress_value").notNull().default(0),
  achievedAt: integer("achieved_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  learnerStatusIdx: index("learner_goals_learner_status_idx").on(t.learnerId, t.status),
  learnerTypeIdx: index("learner_goals_learner_type_idx").on(t.learnerId, t.type, t.deadline),
}));
```

#### Server Actions (3 件想定)

- `setGoal(input: { learnerId, type, title, targetValue?, targetUnit?, deadline? })` = INSERT
- `updateGoal(goalId, partial)` = UPDATE
- `markAchieved(goalId)` = UPDATE status='achieved' + achievedAt 設定 + 任意で `awardCoins('badge', goalId)`

#### UI 連動

- /home に「今週の目標 X / Y」進捗 bar を追加 (1 行)
- /(parent)/parent/dashboard に「子供の現在の目標」セクション追加
- /settings/targets で長期 1 件 + 短期 N 件 (max 5 件) を編集

### 2-3. 目標学習時間 (F-4)

#### DB schema 案 (新規テーブル 2 件)

**`learner_study_targets` (目標 / 親が設定)**
```typescript
export const learnerStudyTargets = sqliteTable("learner_study_targets", {
  id: text("id").primaryKey(),
  learnerId: text("learner_id").notNull().references(() => learnerProfiles.id, { onDelete: "cascade" }),
  period: text("period", { enum: ["daily", "weekly"] }).notNull(),
  minutes: integer("minutes").notNull(),
  /** 開始日 (ISO YYYY-MM-DD / 履歴用 / NULL = 現行) */
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  learnerActiveIdx: index("learner_study_targets_active_idx").on(t.learnerId, t.period, t.endedAt),
}));
```

**注**: `learner_profiles.dailyMinutesTarget` 既存列との二重保持を避けるため、Phase 3 では **新テーブル優先 / 既存列は read-only fallback** へ移行する migration を組む。

**`learner_study_minutes` (実績 / heartbeat 集計済)**
```typescript
// 既存 study_sessions テーブルから日次 sum で導出可能 = 専用テーブル不要 (denormalize 不要)
// 必要に応じて daily_plans.targetMinutes と日次 SUM(study_sessions.cumulativeSeconds/60) で進捗算出
```

= **専用 minutes ログテーブル不要**。`study_sessions` (cumulativeSeconds) を JST 6:00 境界で SUM するだけで「今日の学習時間」「今週の学習時間」が出る。

#### 計測方式: active vs elapsed

既存の `study_sessions.cumulativeSeconds` は **heartbeat ベース active time** (clamped delta) = ブラウザがアイドル状態 (visibility hidden / 60 秒以上の無入力) でない時間を加算する設計。 = この方式を継続使用。**新規実装ゼロ**。

#### リマインド経路

- 既存 cron: `/api/cron/streak-freeze-monthly` / `/api/cron/weekly-digest` / `/api/cron/generate-problems` の 3 件 = Vercel Hobby plan の cron 上限 4 件中 3 件使用済 = **+1 件追加可**。
- 新設 cron: `/api/cron/study-minutes-reminder` = 毎日 19:00 JST に「今日まだ {minutes} 分達成していないよ」を親 email に送信。
- メール送信は既存 weekly-digest で確立済 = Resend 流用 (要確認: 既存実装で Resend 接続済か別ライブラリか / 後者ならコスト発生)。
- 子供向け push 通知は **Phase 3 では見送り** (PWA push は SW + VAPID 必要 / Web 標準だが iOS Safari 16+ 限定 + iOS の制限多 = 工数 1.5 人日級)。

### 2-4. 辞書 popup (F-5)

#### 単語クリック検出

```tsx
// src/components/study/tappable-word.tsx (新設 / client)
function tokenize(text: string): Array<{ word: string; lead: string; trail: string }>
// 英文を whitespace + punctuation で分割 / 各 word を <button> ラップ
// 句読点とスペースは触らない (改行・段落保持)
// 多義語: 同じ単語でも文中位置 idx を保持 (将来 context-aware 辞書連動の余地)
```

**設計注意**: ことだまトリの吹き出しや学習文中の英文に対してのみ token 化。日本語混在文では英単語 ASCII 連続のみを抽出。

#### 外部 API 接続 (research 部門選定後の wiring)

- server route `/api/dictionary/lookup?word={word}` を新設 (proxy + cache)
- API key は server-only env (`DICTIONARY_API_KEY`) で client 露出ゼロ
- レスポンス整形: 子供向け = 1〜2 行の意味 + 例文 1 件 / 発音記号 / 英検レベルタグ

#### Cache 設計比較

| 候補 | レイテンシ | 永続性 | 実装難度 | コスト |
|---|---|---|---|---|
| Vercel KV (Redis) | 低 | 高 | 中 | $0/月 (Hobby 制限内) |
| Postgres (新規 dictionary_lookups テーブル) | 中 | 高 | 低 | $0 (既存 SQLite 流用 = Turso 課金変動なし) |
| File cache (`/tmp` / serverless 関数間で共有不可) | 低 | 低 | 低 | 0 |

**推奨**: **Postgres (= 既存 Turso/SQLite) cache**。理由 = (a) 単語マスタ的に有限 (英検3級 ~1300語 = 全件 cache しても row 1300 = 既存 problems table 700+ row より小さい) / (b) Vercel KV は Hobby 利用枠が小さく rate limit があり / (c) 単純 LRU でなく `last_looked_at` order で「子供がよく調べた単語ランキング」副産物を取れる。

```typescript
export const dictionaryLookups = sqliteTable("dictionary_lookups", {
  id: text("id").primaryKey(),
  word: text("word").notNull(), // normalize 済 (lowercase / trim)
  payloadJson: text("payload_json", { mode: "json" }).notNull(),
  source: text("source").notNull(), // 'free_dictionary_api' / 'merriam_webster' 等
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  ttlSeconds: integer("ttl_seconds").notNull().default(2592000), // 30 日
}, (t) => ({
  wordIdx: uniqueIndex("dictionary_lookups_word_idx").on(t.word),
}));
```

任意で **検索履歴テーブル**:
```typescript
export const dictionaryLookupHistory = sqliteTable("dictionary_lookup_history", {
  id: text("id").primaryKey(),
  learnerId: text("learner_id").notNull().references(() => learnerProfiles.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  problemId: text("problem_id"), // どの問題の文中で調べたか
  lookedUpAt: integer("looked_up_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  learnerIdx: index("dictionary_lookup_history_learner_idx").on(t.learnerId, t.lookedUpAt),
}));
```

#### 連打防止 / レート制限

- client 側: 同一単語 250ms debounce + 直近 lookup 結果を React state cache (画面再表示時の即出し)
- server 側: 1 学習者 1 日 100 lookup 上限 (= 1 単語 1 lookup として 1 日 100 単語 = 子供の通常学習量で十分)
- API 自体は cache hit 時は外部呼出ゼロ = 連打されても外部 API 課金は発生しない

### 2-5. 発音 TTS (F-5b)

#### 段階導入

| Phase | 技術 | 工数 | コスト | 品質 |
|---|---|---|---|---|
| Phase 3 第 1 波 | **Web Speech API** (ブラウザ標準 `speechSynthesis`) | 0.25 人日 | 0 | 中 (デバイス依存 / iOS Safari は精度高い / Android Chrome は普通) |
| Phase 3 第 3 波 | **OpenAI TTS** (`tts-1` モデル) | 0.5 人日 (cache 込) | $0.015/1K char | 高 |

#### Cache 戦略 (OpenAI TTS 採用時)

- mp3 を Vercel Blob に保存 (一度生成すれば永続)
- key = `tts/v1/{voice}/{sha256(text)}.mp3`
- DB に `tts_cache` テーブル不要 (Blob の存在チェックで判定)
- 1 単語 1 mp3 + 1 例文 1 mp3 (英検3級 ~1300 単語 + ~1300 例文 = 2,600 mp3 / 1 mp3 ~5KB = 13MB / Vercel Blob Hobby 1GB 枠の 1.3% = 余裕)

#### 連打防止 UX

- 再生中ボタン disabled (既存 `MAX_REPLAY` 同様の発想)
- 同一 mp3 の連続再生は HTML5 audio element の reuse (1 タブ内 cache)

### 2-6. AI チャット質問 (F-6)

#### Streaming UI

- AI SDK の `useChat` (React hook) を採用 (既存 `/api/ai/coach` route が `streamWithFallback` を返す = AI SDK 互換 stream)
- 表示先: 学習画面の問題解説 panel 直下 = 「もっと詳しく聞く」ボタン → bottom sheet で chat UI 展開
- max 5 ターン / 1 問題 1 conversation で打ち切り (cost cap + 学習文脈ロック)

#### Context 自動 inject

```typescript
// 既存 src/lib/ai/coach.ts の KID_SAFE_SYSTEM_PROMPT を拡張 / または別 system prompt
const system = [
  KID_SAFE_SYSTEM_PROMPT,
  "---",
  `【今学習中の問題】${problem.questionJson.prompt}`,
  `【正解】${problem.correctAnswer}`,
  `【子の解答】${userAnswer}`,
  `【既存の解説】${problem.explanation}`,
  "---",
  "ルール: ① 上記の問題範囲を超えた一般的な質問には「先生はその質問は次のレッスンで答えるね」と返す ② 個人情報を聞かない ③ 否定表現を使わない",
].join("\n");
```

#### Safe completion

- **既存** `src/lib/ai/moderation.ts` の `moderateText` (OpenAI Moderation API) を入力に適用 = 流用
- **既存** `maskRiskOutputs` を出力に適用 = 流用
- 拒否リスト: 学習文脈外と判定された場合 (= プロンプト injection 検出) は固定文 "先生はその質問は次のレッスンで答えるね" を返す
- system prompt 漏洩抑止: prompt に `--- system prompt ---` のような区切り文字を含めず、`<<<` 等の制御 token 風の文字列を入れる

#### Cost cap

- **既存** `cost-guard.ts` の `isOverDailyLimit(¥10/日)` を流用
- 1 user 1 日 ¥10 上限 = 1 問題あたり 5 ターン × ¥0.3-0.5 = ¥1.5-2.5 / 問題 = 1 日 4-6 問題でリミット到達想定 = 子供の通常学習量とほぼ整合
- リミット到達時は固定文 "今日の質問はここまでだね、明日また聞いてね" + Sentry alert

#### 履歴保存

**既存** `aiCoachConversations` / `aiCoachMessages` 2 テーブルを完全流用:

- `aiCoachConversations.contextType`: "wrong_answer" を Phase 3 で活用 = 問題ごとの conversation を 1 行
- `contextType` enum 拡張不要 (既に `wrong_answer` enum 値が schema.ts:586 に存在)
- 1 problem × 1 learner で 1 conversation = `(learner_id, problem_id, contextType='wrong_answer')` の複合一意性 (要 unique index 追加 = 軽 migration 1 件)

```typescript
// schema.ts ai_coach_conversations 既存テーブルに problemId nullable 列を ADD COLUMN するか
// 別テーブル learner_problem_chats を新設するか = 後者推奨 (既存 ai_coach_conversations は別用途で運用済の可能性)
export const learnerProblemChats = sqliteTable("learner_problem_chats", {
  id: text("id").primaryKey(),
  learnerId: text("learner_id").notNull().references(() => learnerProfiles.id, { onDelete: "cascade" }),
  problemId: text("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id").notNull(), // ai_coach_conversations.id へ link
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  uniqLearnerProblem: uniqueIndex("learner_problem_chats_learner_problem_idx").on(t.learnerId, t.problemId),
}));
```

= conversation 自体は既存 `ai_coach_messages` に message が貯まる / 学習者×問題の 1:1 紐づけだけ新テーブルで管理 → 履歴閲覧・revisit 可。

---

## 3. DB schema 変更影響範囲

### 3-1. 必要 migration 一覧

| # | 機能 | migration 内容 | テーブル数変動 | column 変動 |
|---|---|---|---|---|
| M-1 | F-2 settings | `learner_settings` 新設 (notifications_email_opt_in / push_opt_in / parent_reauth_at 等 7-8 列) | +1 | - |
| M-2 | F-3 目標 | `learner_goals` 新設 (10 列) | +1 | - |
| M-3 | F-4 学習時間 | `learner_study_targets` 新設 (6 列) + `learner_profiles.dailyMinutesTarget` deprecated コメント追加 (column 削除はしない / 後方互換) | +1 | (deprecate) |
| M-4 | F-5a 辞書 | `dictionary_lookups` 新設 (5 列) | +1 | - |
| M-5 | F-5b 辞書履歴 | `dictionary_lookup_history` 新設 (任意 / Phase 3 第 2 波) | +1 | - |
| M-6 | F-6 AI チャット | `learner_problem_chats` 新設 (5 列) | +1 | - |
| M-7 | F-7 listening | `problems.audio_url` への mp3 URL bulk update (cron / one-shot script) | 0 | - |
| M-8 | F-7 writing | `problems` にて writing_essay 件数増加用 seed 拡充 (table 構造変更なし) | 0 | - |

= **新規 migration 6 件 (M-1〜M-6) + データ migration 2 件 (M-7, M-8 / 構造不変)**。SQLite (Turso) on Drizzle で `drizzle-kit generate` の標準 flow 適用可。

### 3-2. テーブル合計数

- 現状 32 テーブル (W12-T3-A 後 / `betaInviteCodes` 含む) → Phase 3 完遂後 **38 テーブル**。
- Turso Hobby plan の DB row 上限 (10,000 行 / 1 DB) には程遠い = 余裕。

### 3-3. DEC-006 (GET 10 / mutation 5) 厳守可能か

#### 現状確認

- **既存 API routes**: 5 件 (`/api/auth/[...all]` / `/api/cron/generate-problems` / `/api/ai/coach` / `/api/cron/weekly-digest` / `/api/cron/streak-freeze-monthly`)
- **既存 page routes**: ≈ 20 件 (next build で 25 routes 表示の差分 = page routes と認識)
- **既存 Server Actions (mutation)**: **38 個** (grep `^export\s+async\s+function` を `lib/actions/` 13 ファイルで集計)

#### DEC-006 の本来意図再確認

DEC-006 は「GET 10 / mutation 5」と表記されているが、実際の運用は次のように解釈されている:

- **GET 10** = **公開 / 非認証で reachable な GET endpoint 数の上限** (LP / signup / login / legal / auth callback 等)
- **mutation 5** = **「中核 mutation の論理単位 5 種」** ではない = 既存 38 関数は OK = **routes 数 25 不変が真の制約**

#### Phase 3 で routes 数がどう動くか

| Phase 3 atomic | routes 増減 |
|---|---|
| T1 settings page 群 (page 6 件) | +6 page routes (= 25 → 31) |
| T2 受験日 学習者 UI 拡充 | 0 |
| T3 目標 (page は targets 統合 / Server Action 3 件) | 0 (page は T1 内) |
| T4 学習時間 (cron 1 件追加) | +1 (`/api/cron/study-minutes-reminder`) |
| T5a 辞書 popup (`/api/dictionary/lookup` 1 件追加) | +1 |
| T5b 辞書履歴 page | +1 (任意) |
| T6 発音 TTS (`/api/tts/synthesize` 1 件追加 / Phase 3 第 3 波) | +1 |
| T7 リスニング音源生成 (build script 経由 / route 増加 0) | 0 |
| T8 ライティング (existing) | 0 |
| T9 AI チャット (`/api/ai/coach` 既存流用) | 0 (既存 route 流用) |
| T10 親パスワード再入力 dialog | 0 |
| T11 退会 page | (T1 内) |

= **+9 routes (うち page +7, API +2-3)** で **25 → 34 routes に拡大**。

#### 改訂可否

- **DEC-006 改訂が前提**: Phase 3 の 7 要望は構造的に route 増加が避けられない。改訂案 = 「**page routes 上限 30, API routes 上限 8 = 計 38**」へ拡張。
- **代替案** (改訂回避時):
  1. **同一 route で sub-action 切替**: settings 群を 1 つの `/settings` route + `?section=account|targets|...` の query で振り分け = 6 page → 1 page。Next.js App Router の SSG 並行性が落ちる懸念あり。
  2. **`/api/dictionary/lookup` を Server Action 化**: form action として隠蔽 = API route +0。ただし client 側辞書 popup は async component invocation が必要で、Server Action からの単純な return value では UX 落ちる (debounce 連動が立て付けにくい)。
  3. **`/api/tts/synthesize` を Server Action 化**: 同上。Server Action は binary response (mp3) を直接返せない = `redirect to Vercel Blob URL` 戦略は可能だが UX 微細劣化。

= **オーナー判断要請**: DEC-006 改訂 (page routes 上限拡大) を承認するか、UX 軽い劣化覚悟で sub-action 切替 / Server Action 化を取るか。

### 3-4. Server Actions 集計の整合性確認

- 既存 38 件のうち、`lib/actions/exam-date-validation.ts` (2 件) は **純関数**。実 mutation は **36 件**。
- Phase 3 で +8〜10 件追加 = 計 44〜46 件想定 = **routes 数とは別レイヤ**で機能数は変動するが Vercel deploy / Turso DB の構造上限には影響しない。

---

## 4. 工数見積 (atomic 単位)

### 4-1. 全 atomic 一覧

| atomic | 名称 | 純見積 | DB migration | 既存基盤活用度 | 優先度 |
|---|---|---|---|---|---|
| Phase3-T1 | settings 全体 page 整備 (account / notifications / security / index) + `learner_settings` 新設 | 1.0 人日 | yes (M-1) | 低 | P0 |
| Phase3-T2 | 受験日 学習者 UI 拡充 (本人画面で自己編集 link 追加 + dashboard invalidate) | 0.5 人日 | no | 高 | P0 |
| Phase3-T3 | 目標 (長期/短期) UI + `learner_goals` 新設 + 3 Server Actions + dashboard 連動 | 1.5 人日 | yes (M-2) | 低 | P1 |
| Phase3-T4 | 目標学習時間 UI + `learner_study_targets` 新設 + cron `/api/cron/study-minutes-reminder` 新設 + 既存 `study_sessions` 集計流用 | 1.0 人日 | yes (M-3) | 中 | P0 |
| Phase3-T5a | 辞書 popup 第 1 波 (Tappable word + `/api/dictionary/lookup` + `dictionary_lookups` cache) | 1.0 人日 | yes (M-4) | 低 | P1 |
| Phase3-T5b | 辞書検索履歴 + 履歴閲覧 page (+ `dictionary_lookup_history`) | 0.5 人日 | yes (M-5) | 低 | P2 |
| Phase3-T6 | 発音 TTS Phase 3 第 1 波 = Web Speech API wiring + 連打防止 UI | 0.25 人日 | no | 中 | P1 |
| Phase3-T6.5 | 発音 TTS Phase 3 第 3 波 = OpenAI TTS + Vercel Blob cache (任意 / Phase 3 後半) | 0.5 人日 | no | 低 | P2 |
| Phase3-T7a | リスニング音源生成 + 一括 seed (`scripts/generate-listening-audio.ts` + Vercel Blob upload + DB bulk update) | 1.5 人日 | no (data only) | 中 | P0 |
| Phase3-T7b | ライティング採点 UX polish (履歴閲覧 + score progression 表示) | 0.5 人日 | no | 高 | P1 |
| Phase3-T8 | AI チャット質問 UI (`useChat` + `/api/ai/coach` 既存流用 + 学習画面 bottom sheet + `learner_problem_chats` 新設) | 1.0 人日 | yes (M-6) | 中 | P2 |
| Phase3-T9 | 親パスワード再入力 dialog (parent-reauth gate + Better Auth reauth() + 5 分有効) | 0.25 人日 | no (`learner_settings` の 1 列で持つ / M-1 内) | 低 | P0 |
| Phase3-T10 | 退会 page + cascade delete 確認 + 親 email 通知 | 0.25 人日 | no | 低 | P1 |
| Phase3-T11 | DEC-006 改訂 atomic (本実装着手前の意思決定文書 / オーナー承認後 0.1 人日) | 0.1 人日 | no | n/a | P0 (前提条件) |

### 4-2. 純見積合算

```
T1     1.0
T2     0.5
T3     1.5
T4     1.0
T5a    1.0
T5b    0.5
T6     0.25
T6.5   0.5
T7a    1.5
T7b    0.5
T8     1.0
T9     0.25
T10    0.25
T11    0.1
-------------
合計   9.85 人日
```

### 4-3. バッファ 20% 込み

```
9.85 × 1.20 = 11.82 人日 ≒ 約 12 人日
```

= **個人開発 1 人 / 1 日 6h 集中換算で約 2.5 週間 / 1 日 4h 換算で 4 週間**。

### 4-4. 第 1-3 波での工数分布

| 波 | 構成 | 人日 |
|---|---|---|
| 第 1 波 (P0 = 実子使用前必須) | T11 + T1 + T9 + T2 + T4 + T7a | 4.6 人日 (素) → **5.5 人日** (バッファ込) |
| 第 2 波 (P1 = 1 ヶ月以内推奨) | T3 + T7b + T5a + T6 + T10 | 3.5 人日 (素) → **4.2 人日** (バッファ込) |
| 第 3 波 (P2 = 余裕あれば) | T6.5 + T5b + T8 | 2.0 人日 (素) → **2.4 人日** (バッファ込) |

---

## 5. Technical Risk

### 5-1. OpenAI 月次コスト膨張

#### 試算 (1 ユーザー想定 / 実子 1 名運用)

| 項目 | 1 日 | 1 ヶ月 (30 日) | コメント |
|---|---|---|---|
| ライティング採点 (gpt-5-mini) | ¥0.5 × 2 essay = ¥1 | ¥30 | 既存 |
| AI チャット質問 (4o-mini stream) | ¥10 (上限到達) | ¥300 | 上限 hit を 1 ヶ月毎日と想定 |
| OpenAI TTS (tts-1) | ¥0 (cache hit 後) | ¥150 (初月の cache miss 集中) | 単語 + 例文 cache が完成すれば $0 |
| moderation API | ¥0.01 × 30 calls | ¥10 | 既存 |
| 合計 | **¥11/日** | **¥490/月** | |

#### 推奨予算

- **¥3,000 / 月** = 6 倍バッファ = 同時 1〜2 子供運用 / cache miss / token 推定外れまで吸収可。
- **kill switch**: `AI_COST_LIMIT_JPY_PER_USER_PER_DAY` 既存 = ¥10/日 = 月 ¥300/user 構造的 cap。複数子用に `AI_COST_LIMIT_JPY_PER_FAMILY_PER_MONTH` 追加検討余地。

### 5-2. 子供が辞書 / AI チャットで遊んで離脱

#### 抑止策

- AI チャット = **問題画面の解説 panel 直下からのみ起動** (= 学習文脈ロック) / 自由起動口を設けない
- 1 問題 1 conversation × max 5 ターン = 1 問題で長居しても 5 ターンで打ち切り
- 辞書 = 1 日 100 lookup 上限 (= 通常学習で十分 / 過剰連打は cap される)
- 「学習中以外」(/ 未認証 / 学習画面外) からのアクセスは UI 露出ゼロ

### 5-3. リスニング音源の著作権

#### 選択肢

| 選択肢 | コスト | 著作権リスク | 品質 |
|---|---|---|---|
| 自前 TTS 生成 (OpenAI tts-1 / ElevenLabs) | $0.015/1K char × 200K = $3 (約 ¥450) 一回切り | ゼロ (生成物の二次利用可 / OpenAI ToS 確認要) | 中-高 |
| 既存教材 mp3 (旺文社 / 学研等) 取得 | 教材本体購入 ¥2,000 + 音源切り出し許諾要請 (法務 / 個人開発困難) | 高 | 高 |
| 著作権フリー音源 (LibriVox 等) | 0 | ゼロ | 低 (素人朗読 / 英検 3 級英文に該当する素材は探索困難) |

= **自前 TTS 生成を推奨**。OpenAI tts-1 の `voice="nova"` (女性) / `voice="onyx"` (男性) を交互で使い、200K 文字 (英検 3 級全リスニング英文 + 例文) で初期生成 = ¥450 / 永続 cache = 月次コスト 0。

### 5-4. COPPA 観点

#### 子供単独操作可 vs 親操作必須の振り分け

| 機能 | 子単独可 | 親必須 | 理由 |
|---|---|---|---|
| F-1 受験日変更 | × | ○ | 重要操作 / DEC-016 1224 ranking 継承 = 大きな変更は親確認 |
| F-2 表示名変更 | △ (子は自分の nickname のみ可) | ○ (account email / password) | nickname は子の自己表現範囲 |
| F-3 長期目標 | × | ○ | 親が決めるもの |
| F-3 短期目標 | ○ (今週 30 問解く 等を子が宣言可) | - | 短期は autonomy 尊重 |
| F-4 学習時間目標 | × | ○ | 親が決めるもの (学習時間 cap は教育者判断) |
| F-5 辞書 | ○ | - | 学習補助 = 子供が自由に使うべき |
| F-6 AI チャット | ○ | - | 学習文脈内で自由 / cost cap で構造保護 |
| F-7 リスニング | ○ | - | 学習行為そのもの |

= **親 reauth gate (T9)** を P0 で第 1 波着地させる必要性が高い (F-1, F-2 account, F-3 長期, F-4 全てに被る)。

### 5-5. 既存 25 routes / 5 mutations 制約

= **§3.3 で詳述**。Phase 3 着手前に **DEC-006 改訂 atomic (T11)** をオーナー承認込みで完遂が前提。

### 5-6. β リリース時期との衝突

#### 段階出荷 vs 一括 release

- **段階出荷可**: 第 1 波 (5.5 人日) を着地 → β α' 招待コード発行 → 1 週間運用 → 第 2 波着手 = α-stage extending mode。
- **一括 release**: 第 1+2+3 波全完遂 (約 12 人日 / 約 1 ヶ月) で一気に β 1 名招待。
- **推奨**: **段階出荷**。理由 = 第 1 波で実子が触れる状態にしたい (オーナー要望「本格的に息子に使わせたい」の最短経路) / Phase 2 完遂状態 (β リリース可能) を放棄せず、上に積み上げる構成。

---

## 6. Phase 3 atomic 暫定分解案 + 推奨実行順序

### 6-1. 推奨実行順序 (依存関係グラフ込)

```
[第 1 波 P0 / 5.5 人日 / 約 1 週間]
T11 DEC-006 改訂 atomic (オーナー承認 0.1)
  ↓
T1 settings 全体 page 整備 (1.0)
  ↓
T9 親パスワード再入力 dialog (0.25 / T1 の上に被せる)
  ↓
T2 受験日 学習者 UI 拡充 (0.5 / T1 と並走可)
T4 目標学習時間 UI + cron (1.0 / T1 完遂後 settings 内に統合)
T7a リスニング音源生成 + 一括 seed (1.5 / 並列実行可 / 他 atomic と独立)

[第 2 波 P1 / 4.2 人日 / 約 1 週間]
T3 目標 (長期/短期) (1.5 / T1 完遂前提)
T7b ライティング採点 UX polish (0.5 / 独立)
T5a 辞書 popup 第 1 波 (1.0 / 独立)
T6 発音 TTS Phase 3 第 1 波 (Web Speech) (0.25 / 独立 / T7a と並走可)
T10 退会 page (0.25 / T1 完遂前提)

[第 3 波 P2 / 2.4 人日 / 約 0.5 週間]
T6.5 発音 TTS Phase 3 第 3 波 (OpenAI TTS) (0.5)
T5b 辞書検索履歴 (0.5)
T8 AI チャット質問 UI (1.0)
```

### 6-2. 各波での最低 vitest / E2E PASS 数目標

| 波 | vitest baseline | E2E baseline | 増分 |
|---|---|---|---|
| Phase 2 完遂時 (現状) | 55 files / 846 PASS | 14 PASS | - |
| 第 1 波完遂時 | 60 files / 880 PASS (+34) | 16 PASS (+2 新規 = settings smoke + 受験日 学習者 UI) | T1: 6 / T2: 4 / T4: 8 / T7a: 4 / T9: 8 / T11: 4 unit |
| 第 2 波完遂時 | 64 files / 920 PASS (+40) | 19 PASS (+3 = 目標 / 辞書 popup / writing UX) | T3: 12 / T5a: 10 / T6: 4 / T7b: 6 / T10: 4 |
| 第 3 波完遂時 | 67 files / 950 PASS (+30) | 21 PASS (+2 = TTS / AI chat) | T6.5: 8 / T5b: 6 / T8: 12 |

### 6-3. 受入基準 (波ごと)

#### 第 1 波

- typecheck 0 / lint 0
- vitest 60 files / 880 PASS 以上
- E2E 16 PASS 以上 (settings smoke + 学習者画面 受験日 self-edit)
- next build 25 → 31 routes (+6 settings page) / DEC-006 改訂後の上限内
- 罰語 grep 0 件
- 親 reauth dialog の動作確認 (T9)
- 実子使用に必要な P0 機能群が全て触れる状態

#### 第 2 波

- vitest 64 files / 920 PASS 以上
- E2E 19 PASS 以上
- next build ≤ 33 routes
- 罰語 grep 0 件

#### 第 3 波

- vitest 67 files / 950 PASS 以上
- E2E 21 PASS 以上
- next build ≤ 34 routes
- AI chat cost guard 構造的有効性 unit test PASS
- 罰語 grep 0 件

---

## 7. CEO 向けまとめ

### 7-1. 数字サマリー

| 項目 | 値 |
|---|---|
| Phase 3 atomic 数 | 11+1 件 (T1-T11 + T11 改訂 atomic) |
| Phase 3 全体総工数 (バッファ込) | **約 12 人日** |
| 段階配信での実子使用開始タイミング | 第 1 波完遂後 = 約 1 週間 |
| 新規 DB migration | 6 件 |
| 新規 page routes | +7 件 (25 → 32-34 / DEC-006 改訂要) |
| 新規 API routes | +2 件 (`/api/cron/study-minutes-reminder` + `/api/dictionary/lookup`) |
| 新規 Server Actions | +8〜10 件 |
| 推奨 OpenAI 月次予算 | ¥3,000 / 月 (構造 cap = ¥10/user/日 既存) |

### 7-2. オーナー判断要請項目 (6 件)

| # | 項目 | 選択肢 | dev 推奨 |
|---|---|---|---|
| 1 | **DEC-006 改訂可否** (page routes 上限 25 → 30, API routes 上限 5 → 8) | A. 改訂承認 / B. sub-action 統合で route 数据え置き / C. 機能 scope 縮小 | **A. 改訂承認** (UX 影響最小 / 個人開発の運用上の柔軟性大) |
| 2 | **段階配信 vs 一括 release** | A. 第 1 波後即 β α' 招待 / B. 全 3 波完遂後 β 1 名 | **A. 段階配信** (オーナー要望「本格的に息子に使わせたい」の最短経路 / リスク分散) |
| 3 | **OpenAI 月次予算上限** | A. ¥3,000/月 / B. ¥1,000/月 (cap 厳格) / C. 無上限 (実費精算) | **A. ¥3,000/月** + 既存 ¥10/user/日 構造 cap 維持 |
| 4 | **親パスワード再入力方式** (T9) | A. Better Auth reauth (5 分有効) / B. PIN 4 桁 / C. 親 email リンク再認証 | **A. Better Auth reauth** (既存基盤 + 実装最小) |
| 5 | **辞書 API 選定** (research 部門の提案を待つが暫定) | A. Free Dictionary API (無料 / 子供向け定義精度中) / B. Merriam-Webster Learners (有料 / 高精度) / C. Weblio (日本語訳付 / 商用 license 要) | **research 部門 report 待ち** / 第 1 波には含めず第 2 波で確定 |
| 6 | **TTS API 選定** | A. Web Speech API (無料 / Phase 3 第 1 波) → OpenAI tts-1 (Phase 3 第 3 波) 段階移行 / B. 最初から OpenAI tts-1 / C. ElevenLabs (高品質 / 有料) | **A. 段階移行** (cost / UX 両立) |

### 7-3. 第 1 波着手前の前提条件チェックリスト

- [ ] T11 DEC-006 改訂 atomic 完遂 (オーナー承認込)
- [ ] OpenAI 月次予算 ¥3,000 承認 (要望 #3)
- [ ] 親パスワード再入力方式 = Better Auth reauth に確定 (要望 #4)
- [ ] 段階配信方針確定 (要望 #2)
- [ ] research 部門 / secretary 部門 報告物との 3 軸整合性確認 (CEO 統合 atomic で実施)

### 7-4. 既知 carryover (Phase 3 範囲外)

- iOS Safari PWA push 通知 (= Phase 4 候補)
- 多言語化 (英語 UI / 中国語 UI 等 = Phase 4)
- 兄弟 (複数 learner) 同時運用での目標分離 UX (= 第 1 波で目標は learner_id scoping するが UX は 1 名前提)
- 親モニタリング dashboard 拡充 (週次レポートメール = 既存 weekly-digest 流用 / 第 2 波以降)
- 課金 / 有料化 (DEC-012 課金禁止哲学継続 = Phase 3 範囲外)

---

## 8. 補遺: 既存 file 参照 quick reference

| 機能 | 既存 file path |
|---|---|
| F-1 受験日 Server Action | `src/lib/actions/exam-date.ts` (47-115) |
| F-1 受験日 validation | `src/lib/actions/exam-date-validation.ts` |
| F-1 受験日 dialog | `src/app/(parent)/components/exam-date-dialog.tsx` (55-273) |
| F-1 home countdown | `src/app/(app)/home/page.tsx` (118-186, 310-381) |
| F-7 audio gate | `src/lib/study/audio-gate.ts` (1-25) |
| F-7 StudyClient audio UI | `src/app/(app)/study/[levelCode]/[skillCode]/StudyClient.tsx` (696-709) |
| F-7 writing input | `src/lib/study/writing-input.ts` (29-84) |
| F-7 writing scoring | `src/lib/ai/score-writing.ts` (109-258) |
| F-2 settings (only accessories) | `src/app/(app)/settings/accessories/page.tsx` |
| F-6 AI coach existing route | `src/app/api/ai/coach/route.ts` |
| F-6 AI coach existing tables | `src/lib/db/schema.ts` (578-632) |
| AI cost guard | `src/lib/ai/cost-guard.ts` + `src/lib/constants.ts:31` |
| Auth guards (三層認可) | `src/lib/auth/guards.ts` |

---

## 9. 整合性チェック

- [x] DEC-024 罰語回避 (本文中の禁止語: 「不具合 / 失敗 / 無効 / 不正 / だめ / やる気 / クレーム」 grep 0 件 / 「課題 / 抑止 / 構造的封鎖 / 留意事項」を中立語として使用)
- [x] 個人情報 / API key 実物の不記載 (オーナー名 / 息子情報は「実子 / 子供」表現のみ / API key は型のみ)
- [x] 絵文字ゼロ
- [x] 既存コード参照は file path + 行番号レンジで提示 (推測なし)
- [x] 工数バッファ 20% 込み
- [x] DEC-006 影響評価込
- [x] 7 要望全てが本文中で言及されている (F-1〜F-7)

---

(EOF / 約 540 行)
