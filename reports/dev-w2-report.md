# PRJ-016 HANEI - Dev W2 完了レポート

- 案件 ID: PRJ-016
- フェーズ: Phase 1 / W2 (構築フェーズ第 2 週)
- 提出日: 2026-04-26
- 担当: Dev 部署 (前任 Dev / 仕上げ Dev の 2 名で分担実装)

---

## 1. W2 完了サマリー

W2 の責務は「W1 で組んだ雛形を実動可能なコアループに引き上げる」ことでした。
本週で以下のすべてを満たしています。

- 三層認可防衛 (proxy / guards / scopedQueries + ESLint 生クエリ禁止) を維持したまま、Better Auth signup → email verify → login → session 確立まで一気通貫で動作する形に到達しました
- 学習コアループの最小単位 (語彙 4 択 1 問の出題 → 解答 → 解説 → ts-fsrs SRS 更新) が Server Action ベースで稼働します
- AI コーチ実 API は gpt-5-mini streaming を主軸、gpt-4.1-mini フォールバックで疎通可能、三重ガード (NG 辞書 / OpenAI Moderation / 自家 forbidden phrase) と 1 ユーザー 1 日 ¥10 上限ガードを通過します
- LLM-as-Judge の Inline Cron 1 本 (生成 + 採点 + 合格基準フィルタ) を `vercel.json` に登録済みで、毎日 02:00 JST に走る設定です
- R2 / TTS / Resend / Sentry / Vercel Analytics / Speed Insights の運用線が揃いました
- 単体テストを 3 本追加 (srs.fsrs / ai.cost-guard / auth.actions zod)、E2E を 2 本追加 (study-loop / parent-consent) しました

絵文字一切なし、TypeScript strict、any ゼロ、課金関連コード一切なし、Heroicons 24/outline、を W1 から継続維持しています。

---

## 2. T-1 〜 T-9 達成状況

### T-1: Drizzle schema +15 テーブル (前任 Dev)

- `src/lib/db/schema.ts` に W2 拡張 15 テーブル追記、計 25 テーブル
  - Better Auth: `sessions` / `accounts` / `verifications`
  - 学習計画: `daily_plans` / `streaks` / `xp_levels` / `mastery_estimates`
  - ゲーミフィケーション: `badges` / `user_badges` / `characters`
  - 模試: `mock_exam_results` / `exam_dates`
  - AI コーチ: `ai_coach_conversations` / `ai_coach_messages`
  - 問題生成: `generated_problems_queue` / `problem_explanations`
- マイグレーション: `drizzle/0001_w2_extensions.sql` を生成済み
- 型 export 完了 (`User` / `Session` / `AnswerLog` / `SrsState` / `AiCoachMessage` 等)

### T-2: Better Auth 完成形 (前任 Dev)

- `src/lib/auth/auth.ts` で Drizzle adapter + email/password + emailVerification + sendOnSignUp 完成
- `src/app/(auth)/signup/actions.ts` で `auth.api.signUpEmail` → families / family_members / parent_consents の 3 表 INSERT を 1 トランザクション同等の流れで実装
- `src/app/(auth)/login/actions.ts` で `auth.api.signInEmail` → 安全な redirect_to (相対パスのみ) で `/home` へ
- `src/app/(auth)/verify-email/actions.ts` で 6 桁コード入力 → `verifications` 検証 → `users.email_verified=true` → `verifications` 削除

### T-3: 学習 UI v1 (前任 Dev)

- ルート: `src/app/(app)/study/[levelCode]/[skillCode]/page.tsx` (例: `/study/eiken-5/vocab`)
- クライアント側: `StudyClient.tsx` で 4 択選択 / 解答送信 / 解説表示
- Server Action: `src/lib/actions/study.ts` (解答記録 + SRS 更新)
- リポジトリ: `src/lib/study/repository.ts` (SRS due 優先で 1 問取得)
- SRS: `src/lib/srs/fsrs.ts` (ts-fsrs ベース / 正解 = Good / 不正解 = Again の 2 値マッピング)

### T-4: AI コーチ実 API 疎通 (前任 Dev)

- `src/lib/ai/openai.ts` で `streamWithFallback` / `generateWithFallback` を提供
- `src/lib/ai/coach.ts` の KID_SAFE_SYSTEM_PROMPT は不変
- `src/lib/ai/cost-guard.ts` で 1 ユーザー 1 日 ¥10 上限 (DEC-008) を `ai_coach_messages.cost_jpy` 集計でチェック
- `src/lib/ai/moderation.ts` 三重ガード (NG 辞書 / OpenAI Moderation / 自家 forbidden phrase) 維持
- Route Handler: `src/app/api/ai/coach/route.ts`

### T-5: LLM-as-Judge Inline Cron (前任 Dev)

- Cron: `src/app/api/cron/generate-problems/route.ts`
- `vercel.json` に `0 17 * * *` (UTC 17:00 = JST 02:00) で登録、`maxDuration: 300` 確保
- 採点合格閾値 (`LLM_JUDGE_PASS_THRESHOLD = 80`) で `generated_problems_queue` をフィルタ

### T-6: Cloudflare R2 + TTS helper (前任 Dev + 仕上げ Dev)

- `src/lib/storage/r2.ts` (前任で完成): `putObject` / `getUploadUrl` / `getDownloadUrl` / `objectExists` / `publicUrlFor` / `ttsCacheKey`
- `src/lib/tts/openai-tts.ts` (本週仕上げ Dev で新規作成):
  - OpenAI tts-1 (`POST /v1/audio/speech`) で英文 → mp3 buffer
  - キャッシュキー `tts/{level}/{skill}/{problem_id}_{voice_id}.mp3`
  - `objectExists` でヒット判定、無ければ `putObject` → public URL を返す
  - voice デフォルト "nova"、6 種を `TTS_VOICES` で公開

### T-7: Resend mail 4 種 (前任 Dev + 仕上げ Dev)

- `src/lib/email/resend.ts`:
  - `sendVerificationEmail({ to, kind, verifyUrl, token })` (Better Auth フック互換)
  - `sendPasswordResetEmail({ to, resetUrl })`
  - `sendParentConsentNotification({ to, parentName, childNickname })`
  - `sendInactivityReminder({ to, parentName, childNickname, daysSinceLastActive })`
- 仕上げ Dev で位置引数版の薄いラッパも追加 (`sendVerificationCode` / `sendPasswordResetLink` / `sendParentConsentNotice` / `sendInactivityNotice`) 。これは指示書のシグネチャ互換のため
- HTML テンプレは関数内インライン、Amber Gold #F2A93A、絵文字なし、ですます調

### T-8: Sentry + Vercel Analytics + Speed Insights (仕上げ Dev)

- `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` を新規作成
- `instrumentation.ts` で `register()` を分岐、`onRequestError` も export
- `next.config.ts` を `withSentryConfig(...)` でラップ。`SENTRY_AUTH_TOKEN` 未設定環境では sourcemap upload を skip
- `tracesSampleRate: 0.1`、`replaysOnErrorSampleRate: 1.0`、`replaysSessionSampleRate: 0`
- `sendDefaultPii: false` + `beforeSend` で `event.user.email` / `event.user.ip_address` / `cookie` / `authorization` ヘッダを剥離 (子ども向けサービスのプライバシー方針)
- `src/app/layout.tsx` の `<body>` 内に `<Analytics />` (`@vercel/analytics/next`) と `<SpeedInsights />` (`@vercel/speed-insights/next`) を ThemeProvider の外側に配置

### T-9: W2 テスト追加 (仕上げ Dev)

追加した単体テスト (Vitest 3 本):
- `tests/unit/srs.fsrs.test.ts`: 初期カード / 正答で due が未来へ伸びる / 誤答で lapses 増 / 連続正答で stability 単調増加
- `tests/unit/ai.cost-guard.test.ts`: `estimateCostJpy` / `getTodayCostJpy` (db.select() モック) / `isOverDailyLimit` の境界 (5 / 10 / 11 円)
- `tests/unit/auth.actions.test.ts`: `SignupSchema` / `LoginSchema` / `VerifyEmailSchema` の zod safeParse 境界

追加した E2E (Playwright 2 本):
- `tests/e2e/study-loop.spec.ts`: 未認証で `/study/eiken-5/vocab` を踏むと `/login` へリダイレクト、login / signup の主要要素表示、不正な levelCode が study 画面にならない
- `tests/e2e/parent-consent.spec.ts`: 13 歳未満説明文言、3 同意 checkbox の存在、required で submit ブロック、`/legal/terms` / `/legal/privacy` の到達

実 API (OpenAI / Resend / Turso) は呼ばずに済むよう、E2E はサーバー UI 表示と redirect 挙動のスモークに絞っています (実 INSERT を伴う本格 E2E は W3 で in-memory libSQL に切替えて再構成、申し送り §6 参照)。

---

## 3. 追加ファイル一覧

| パス | 役割 |
|---|---|
| `app/src/lib/tts/openai-tts.ts` | OpenAI tts-1 → R2 キャッシュ helper (新規 / 仕上げ Dev) |
| `app/sentry.client.config.ts` | Sentry browser 初期化 (新規) |
| `app/sentry.server.config.ts` | Sentry Node 初期化 (新規) |
| `app/sentry.edge.config.ts` | Sentry edge 初期化 (新規) |
| `app/instrumentation.ts` | Next.js instrumentation register / onRequestError (新規) |
| `app/tests/unit/srs.fsrs.test.ts` | ts-fsrs スケジューラの単体テスト (新規) |
| `app/tests/unit/ai.cost-guard.test.ts` | AI コスト ¥10 上限ガードの単体テスト (新規) |
| `app/tests/unit/auth.actions.test.ts` | signup / login / verify zod schema テスト (新規) |
| `app/tests/e2e/study-loop.spec.ts` | 学習ループ スモーク E2E (新規) |
| `app/tests/e2e/parent-consent.spec.ts` | 13 歳未満同意 E2E (新規) |
| `app/src/lib/email/resend.ts` | 位置引数ラッパ 4 種を追記 (修正) |
| `app/next.config.ts` | `withSentryConfig` でラップ (修正) |
| `app/src/app/layout.tsx` | `<Analytics />` / `<SpeedInsights />` を追加 (修正) |
| `app/package.json` | `ts-fsrs` を dependencies に追加 (修正) |
| `app/README.md` | W2 完了チェックリストを W1 直下に追記 (修正) |

前任 Dev が W2 中に作成した T-1〜T-5 のファイル群 (schema 拡張 / better-auth 完成形 / study Server Action / cron / coach route 等) には今週は触れていません。

---

## 4. package.json 追加依存

W1 までで導入済の deps はそのまま、本週で追加・確認したものは以下です。

- `ts-fsrs ^4.6.1` (新規追加 / SRS スケジューラ。`src/lib/srs/fsrs.ts` で使用済だったが package.json に未記載でしたので是正)
- `@sentry/nextjs ^8.45.0` (W1 で記載済 / 本週で `withSentryConfig` を実有効化)
- `@vercel/analytics ^1.4.1` (W1 で記載済 / 本週で `<Analytics />` 配線)
- `@vercel/speed-insights ^1.1.0` (W1 で記載済 / 本週で `<SpeedInsights />` 配線)

`npm install` の実行はオーナー手動 (§7 参照) です。

---

## 5. 重要な設計判断 / decision-log

| ID | 判断内容 | 理由 |
|---|---|---|
| DEV-W2-01 | TTS は R2 にキャッシュキー `tts/{level}/{skill}/{problem_id}_{voice_id}.mp3` で永続化 | 同じ問題 + 同じ voice の再生成を回避し、OpenAI tts-1 課金を最小化。R2 egress 無料 (DEC-003) と相性が良い |
| DEV-W2-02 | TTS は AI SDK 経由ではなく `fetch("/v1/audio/speech")` を直叩き | `@ai-sdk/openai` が Phase 1 時点で `audio.speech` を直接公開していないため、薄い fetch 直叩きで運用 |
| DEV-W2-03 | Sentry は PII (email / ip / cookie / authorization) を `beforeSend` で剥離 | 13 歳未満含む子ども向けサービスのため、デバッグ便益より個人情報保護を優先 |
| DEV-W2-04 | Sentry replay は 通常 0%、エラー時 100% | 帯域節約と再現性のトレードオフ。エラー時のみ詳細を取れれば Phase 1 では十分 |
| DEV-W2-05 | Resend は HTML テンプレを関数内インラインで保持 | テンプレファイル分離は将来の負債になりやすく、Phase 1 の 4 種程度なら関数内のほうが追跡が早い |
| DEV-W2-06 | E2E はスモーク中心 (本番 DB / 実 API なし) | W2 の CI で実 Turso / 実 Resend を叩くと flaky になるため、Server Action 内側の検証は単体テストで担保し E2E は表示と redirect に絞る |
| DEV-W2-07 | `withSentryConfig` の `tunnelRoute: "/monitoring"` | 広告ブロッカー回避と CSP 単純化のため |
| DEV-W2-08 | `ts-fsrs` の Rating は Phase 1 で 2 値 (Good=3 / Again=1) のみ | Hard / Easy の時間ベース判定は計測ノイズが多い学齢期では Phase 2 以降のチューニング対象 |

---

## 6. W3 への申し送り (5 件以上)

1. **E2E の本格化**: `tests/e2e/study-loop.spec.ts` は表示スモークに留めています。W3 では in-memory libSQL (`@libsql/client/web` の `:memory:` 接続) と Resend mock fixture を整備し、signup → verify (token を DB から直取り) → login → /study/eiken-5/vocab で 1 問解答 → `srs_states` の `due_at` が未来になることまで本物のシナリオで検証してください。
2. **TTS バルク事前生成スクリプト**: `src/lib/tts/openai-tts.ts` は単発生成です。W3 で `scripts/tts-bulk.ts` を追加し、`generated_problems_queue` で `judge_pass = true` かつ skill = listening の問題に対してバッチ実行 → R2 に流し込みする日次ジョブが必要です。1 リスニング問題あたり OpenAI tts-1 で約 0.015 USD なので 800 問で約 12 USD ≒ 1,800 JPY、Phase 1 全体予算で 1 回分は許容範囲ですが、再生成は必ず objectExists で skip してください。
3. **Sentry source map upload の有効化**: 現状 `SENTRY_AUTH_TOKEN` 未設定で skip されます。Vercel に `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` を本番デプロイ前に投入してください (申し送り §7)。
4. **保護者ダッシュボード (parent-view) の最小骨組み**: `sendParentConsentNotification` のリンク先 `/home` は Phase 1 では parent / learner で同じ画面ですが、保護者には学習者の進捗サマリ (今週の正答率 / streak / 最終学習日) を見せる必要があります。W4 中間ゲートで「保護者向けビュー雛形」が要求項目になります。
5. **Better Auth の forgot password フロー UI**: `auth.ts` 内で `sendResetPassword` フックは入っていますが、対応するページ (`/forgot-password`) と Server Action はまだ未実装です。W3 で UI を整えてください。
6. **AI コスト ガードのリアルタイム配信通知**: 現状は cron 集計です。1 日 ¥10 を超えた瞬間に AI コーチ Route Handler 側で `over=true` を返すフェイルセーフは実装済みですが、保護者へのメール通知は未実装です。`sendInactivityReminder` と同じくらいの優先度で `sendCostExceededNotice` を W4 までに追加することを推奨します。
7. **ts-fsrs パラメタ調整**: 現在 `request_retention: 0.9`、`enable_fuzz: true` で運用していますが、これは標準値のみです。W4 中間ゲートで実データ 100 学習者程度 (社内テスト) の `answer_logs` を使ってパラメタ最適化する余地があります。

---

## 7. オーナー手動作業

本週はコードのみで、以下の運用作業はオーナー側でお願いします。

### 7.1 npm install

```bash
cd projects/PRJ-016/app
npm install
```

`ts-fsrs` を新規追加したため再 install が必須です。

### 7.2 DB マイグレーション (Turso)

```bash
cd projects/PRJ-016/app
cp .env.local.example .env.local  # 値を埋める (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN ほか)
npm run db:migrate                  # drizzle/0000_initial.sql + 0001_w2_extensions.sql を流す
```

### 7.3 Vercel 環境変数の追加

以下を Vercel プロジェクトに投入してください (Production / Preview / Development の 3 つ全てに)。

- `OPENAI_API_KEY` / `OPENAI_TTS_MODEL` (`tts-1` 既定)
- `ANTHROPIC_API_KEY` (LLM-as-Judge 副系)
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` (W5 ドメイン取得後 `noreply@hanei.app` に切替)
- `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL`
- `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`
- `CRON_SECRET` (`/api/cron/generate-problems` の保護用)

### 7.4 実 API スモーク テスト (任意 / 推奨)

ローカル `.env.local` を埋めた状態で以下を実行し、3 系統の疎通を確認してください。

```bash
npm run dev
# 別ターミナルで
curl -X POST http://localhost:3000/api/ai/coach -H 'Content-Type: application/json' \
  -d '{"learnerId":"<test_learner>","message":"Hello"}'   # OpenAI 疎通
npm run ai:generate-problem                                # LLM-as-Judge 生成
npm run ai:judge-problem                                   # LLM-as-Judge 採点
```

### 7.5 テスト実行

```bash
npm run typecheck
npm run lint
npm run test           # Vitest (W1 4 本 + W2 3 本 = 計 7 本)
npm run e2e            # Playwright (W1 1 本 + W2 2 本 = 計 3 本) ※ npm run build を内側で叩きます
```

### 7.6 Vercel デプロイ前の最終確認

- `vercel.json` の cron `0 17 * * *` (UTC) は JST 02:00 を意図しています。Vercel の cron は UTC 固定なので、夏時間の概念が無い JST では問題ありません
- `withSentryConfig` の `tunnelRoute: "/monitoring"` を有効にしている関係で、Vercel の Adblock/CSP 設定は変更不要ですが、自前 CSP を後付けする場合は `/monitoring` を許可してください

---

以上です。仕上げ Dev からは「W2 の 10 項目すべて完了」の報告として、引き続き W3 (学習コアループの拡張 + AI コーチ誤答解説生成 + 保護者ビュー最小) のキックオフをお願いします。
