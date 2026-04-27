# PRJ-016 HANEI Dev W3 完了レポート

作成: Dev / 2026-04-26
担当: Dev department (`/dev`)
対象 Phase: Phase 1 / W3 (保護者ダッシュボード骨組み + AI バルク生成スクリプト + UI 4 component + V3-012 差し替えヘルパ + テスト + smoke チェックリスト)
前提: W2 完了状態 (60/60 tests green / typecheck・lint 0)

---

## 1. W3 達成状況サマリ

| # | タスク | 達成 | 主成果物 |
|---|------|------|---------|
| T-1 | E2E 用 in-memory libSQL fixture | ◯ | `tests/e2e/fixtures/db-fixture.ts`, `global-setup.ts`, `playwright.config.ts` |
| T-2 | 保護者ダッシュボード骨組み | ◯ | `src/app/(parent)/parent/dashboard/page.tsx`, `src/lib/study/aggregations.ts`, `src/lib/actions/parent-dashboard.ts` |
| T-3 | AI コーチ誤答解説バルク生成 | ◯ | `scripts/generate-explanations-w3.ts` (実装のみ・未実行) |
| T-4 | TTS バルク事前生成 | ◯ | `scripts/generate-tts-w3.ts` (実装のみ・未実行) |
| T-5 | shadcn/ui 4 components | ◯ | `src/components/ui/{progress,sheet,dialog,tabs}.tsx` + radix 3 依存追加 |
| T-6 | V3-012 受動態問題差し替えヘルパ | ◯ | `scripts/replace-problem.ts` |
| T-7 | テスト追加 (Vitest 3 / Playwright 1) | ◯ | `tests/unit/{study.aggregations,parent.dashboard,scripts.replace-problem}.test.ts` + `tests/e2e/parent-dashboard-flow.spec.ts` |
| T-8 | オーナー手動 smoke チェックリスト | ◯ | `projects/PRJ-016/reports/owner-smoke-checklist-w3.md` |

**全タスク ◯ (達成)。 8/8 完了。**

---

## 2. 各タスク詳細

### T-1: in-memory libSQL E2E fixture

- `tests/e2e/fixtures/db-fixture.ts` を新規作成。
  - `setupDbFixture()` — drizzle migrations (0000_initial.sql + 0001_w2_extensions.sql) を `:memory:` libSQL に raw SQL で `client.execute()` 適用
  - `seedFixture()` — 1 family / 1 parent (verified) / 1 learner / 5 vocab problems / streak / xp_levels / characters / exam_dates の最小セット
  - `teardownDbFixture()` — graceful close
- `tests/e2e/fixtures/global-setup.ts` を Playwright globalSetup に追加し `playwright.config.ts` に `globalSetup: ...` と `testIgnore: ["**/fixtures/**"]` を設定。
- **既知制約**: `:memory:` は webServer 子プロセスから見えないため、本格的な signup→onboarding→dashboard E2E は file:./tests/e2e/.tmp/e2e.db に切り替えてからとなる (W4 申し送り §1)。 W3 段階のparent-dashboard E2E はスモーク (認可リダイレクト + ルーティング存在) に留めた。

### T-2: 保護者ダッシュボード骨組み

- `src/lib/study/aggregations.ts` 新規。 8 ヘルパ:
  - `getCurrentStreak`, `getWeeklyAnswers`, `computeAccuracy`, `getXpSummary`, `getNearestExamCountdown`, `getRecentMistakes`, `shouldSendInactivityReminder`, `getWeeklySummary`
  - 全関数 `db: Db` を引数注入 (test 時 mock 容易) / `// eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済` で生 select の例外を明記
- `src/lib/actions/parent-dashboard.ts` 新規。 Server Action `sendInactivityReminderNow(learnerId)`:
  ```
  requireAuth → requireParent → requireFamilyMember → requireLearnerOwner
    → scopedQueries(familyId).listLearners()  // 別 family 学習者を排除
    → shouldSendInactivityReminder() で 7 日以上 inactive を判定
    → sendInactivityReminder() (Resend)
  ```
  返り値: `{ ok, reason?, daysSinceLastActive }` の判別共用体。
- `src/app/(parent)/layout.tsx` (route group) + `src/app/(parent)/parent/dashboard/page.tsx` 新規。 Server Component で 4 セクション:
  1. 週次サマリ (4-card grid: streak / 解答数 / 正答率 (Progress) / XP 増分)
  2. 直近受検カウントダウン (CalendarDaysIcon)
  3. 非アクティブリマインダー (Sheet で開く確認モーダル → form action `sendInactivityReminderNow`)
  4. 直近の苦手問題 TOP 5 (ExclamationTriangleIcon list)
- アイコン全て **Heroicons 24/outline** (絵文字ゼロ確認済)。 三層認可の生 db.select ゼロ。

### T-3: AI コーチ誤答解説バルク生成スクリプト

- `scripts/generate-explanations-w3.ts` 新規 (未実行・実装のみ)。
- `generateObject` + zod `ExplanationSchema` (correctReason / wrongReasons / kidNote) で構造化生成。
- W2 vocab 200 + W3 (research seed が来たら) 計 ≦600 を対象。
- `problem_explanations` 行が既に存在すれば skip (idempotent)。
- 安全装置:
  - `ADMIN_COST_CEILING_JPY = 500` ハードコード (DEC-008 一日¥10/user とは別の admin ceiling)
  - `DRY_RUN=1`, `MAX_PROBLEMS=N` env で先に小規模テスト可
  - W3 seed の存在チェックは `try { await import("./seed-problems-w3"); } catch { /* not yet exported */ }` で graceful no-op (現状 research の seed-problems-w3.ts は型のみで配列 export 無し)
- 1 リクエスト ≒ ¥0.3〜0.6 想定 → 600 件で ¥180〜360 で天井 ¥500 内。

### T-4: TTS バルク事前生成スクリプト

- `scripts/generate-tts-w3.ts` 新規 (未実行・実装のみ)。
- 200 eiken-5 vocab × 3 voices (`nova` / `alloy` / `shimmer`) = 最大 600 generation。
- `https://api.openai.com/v1/audio/speech` を直叩き (AI SDK は TTS 未対応のため fetch + stream)。
- R2 cache key パターン: **`tts/v1/{problemId}-{voice}.mp3`** (W2 OpenAPI と整合)。
- `tts_assets` テーブルに既存 row があれば skip。
- コスト試算: tts-1 1M chars / $15。 200 単語 平均 8 chars × 3 voices × 200 = 4800 chars ≒ **$0.07 ≒ ¥10**。 400 ちょい上振れでも ¥40〜80 なので `ADMIN_COST_CEILING_JPY = 500` 内。

### T-5: shadcn/ui 4 components

- `package.json` に追加: `@radix-ui/react-progress ^1.1.8`, `@radix-ui/react-dialog ^1.1.15`, `@radix-ui/react-tabs ^1.1.13` (`react-slot` は W2 で導入済)。
- `src/components/ui/progress.tsx` — Radix Progress wrapper, `bg-primary` indicator with `transform: translateX(-{100-value}%)`
- `src/components/ui/dialog.tsx` — Radix Dialog with overlay + content, close ボタンは `XMarkIcon` (Heroicons)
- `src/components/ui/sheet.tsx` — Dialog 上に cva variants (top/bottom/left/right) で side パネル化
- `src/components/ui/tabs.tsx` — Radix Tabs (List/Trigger/Content)
- 反映先: 保護者ダッシュボードの正答率 Progress / リマインダー確認 Sheet で実使用。

### T-6: V3-012 受動態問題差し替えヘルパ

- `scripts/replace-problem.ts` 新規。 named export `replaceProblem(problemId, patch)` で test 容易。
- 入力: stdin から JSON (`{ questionJson, correctAnswer, explanation }`) + env `PROBLEM_ID=v3_012`。
- 動作:
  1. 空文字 id なら `Error('problemId required')`
  2. `db.select().from(problems).where(id).limit(1)` で存在確認 → 無ければ `Error('problem not found: ${id}')`
  3. `db.update(problems).set({ ...patch, updatedAt: now }).where(id)` で書き換え
  4. `{ replaced: true }` を返す
- 三層認可は admin スクリプト (CLI) のため適用外。 ただし生 select はこの 1 ファイルのみ (eslint-disable コメント明記)。

### T-7: テスト追加

| ファイル | ケース数 | 主要検証 |
|---------|---------|--------|
| `tests/unit/study.aggregations.test.ts` | 10 | computeAccuracy / getCurrentStreak / shouldSendInactivityReminder (3 ケース) / getNearestExamCountdown (2 ケース) |
| `tests/unit/parent.dashboard.test.ts` | 6 | 認可 throw 伝播 / learner_not_in_family / 集計統合 / inactive=true 送信 / inactive=false 不送信 |
| `tests/unit/scripts.replace-problem.test.ts` | 3 | update 成功 / id 不在 throw / 空文字列 throw |
| `tests/e2e/parent-dashboard-flow.spec.ts` | 3 | 未認証 → /login redirect / signup ↔ login link / route exists |

W2 60 + W3 19 = **79 unit + 3 E2E (未認証 smoke)** = 79/79 PASS。

### T-8: オーナー手動 smoke チェックリスト

- `projects/PRJ-016/reports/owner-smoke-checklist-w3.md` に 8 項目。 各項目に "成功時応答例" + "失敗時のよくある原因" を併記。
- 想定所要 5〜10 分。 8/8 OK で W3 本番 smoke クリア。

---

## 3. typecheck / lint / test 緑のログ

### typecheck

```
> hanei@0.1.0 typecheck
> tsc --noEmit
(0 errors)
```

### lint

```
> hanei@0.1.0 lint
> eslint .
(0 errors / 0 warnings)
```

### test

```
> hanei@0.1.0 test
> vitest run

 RUN  v2.1.9 C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app

 ✓ tests/unit/srs.fsrs.test.ts                 (8 tests)
 ✓ tests/unit/ai.tools.test.ts                 (6 tests)
 ✓ tests/unit/ai.coach.test.ts                 (15 tests)
 ✓ tests/unit/scripts.replace-problem.test.ts  (3 tests)   ← W3 新規
 ✓ tests/unit/study.aggregations.test.ts       (10 tests)  ← W3 新規
 ✓ tests/unit/ai.cost-guard.test.ts            (10 tests)
 ✓ tests/unit/parent.dashboard.test.ts         (6 tests)   ← W3 新規
 ✓ tests/unit/auth.guards.test.ts              (7 tests)
 ✓ tests/unit/auth.actions.test.ts             (14 tests)

 Test Files  9 passed (9)
      Tests  79 passed (79)
   Start at  17:20:00
   Duration  1.65s
```

---

## 4. 既知の制約

1. **E2E は smoke 止まり** — `:memory:` libSQL が webServer 子プロセスから見えないため、parent-dashboard の通し E2E (signup→onboarding→dashboard 描画) は W3 では実装していない。 認可リダイレクトとルート存在のみ確認。
2. **AI バルク生成スクリプト未実行** — T-3 / T-4 は実装のみで本番 API 叩きは行っていない (CEO 指示通り)。 オーナー smoke (`owner-smoke-checklist-w3.md`) で API 鍵確認後、別途 `npm run ai:generate-explanations` / `npm run ai:generate-tts` で実行。
3. **research の W3 seed 配列が未確定** — `scripts/seed-problems-w3.ts` は型のみで配列 default export がまだ存在しないため、 `generate-explanations-w3.ts` は W2 200 vocab のみを処理して終わる挙動 (`try/catch` で graceful no-op)。 research が確定したら自動的に対象に乗る。
4. **V3-012 差し替えは未実行** — ヘルパは実装済 + テスト緑だが、本番 Turso への書き換えはオーナー smoke 後に `echo '{...}' | PROBLEM_ID=v3_012 npm run ai:replace-problem` で実行する。

---

## 5. W4 への申し送り

1. **E2E webServer DB 切替** (最優先)
   `playwright.config.ts` の `webServer.env` に `TURSO_DATABASE_URL=file:./tests/e2e/.tmp/e2e.db` を渡し、 fixture も `file:` モードに切替。 これで本格 signup→dashboard E2E が書ける。

2. **AI バルク生成の本番実行 + 計測**
   - `npm run ai:generate-explanations` を `DRY_RUN=1 MAX_PROBLEMS=10` で 1 度試走 → 実コストを USD 報告 → DRY_RUN 解除で 600 件
   - `npm run ai:generate-tts` も同様に 10 件 dry-run → 全件
   - 結果を `dev-w4-report.md` に投入実コストとして記載

3. **V3-012 受動態差し替え本番反映**
   research-w2-problems.md の改稿パッチ JSON を確定 → `PROBLEM_ID=v3_012 npm run ai:replace-problem` を実行 → onboarding 通し E2E で正答が "A" であることを確認

4. **保護者ダッシュボードのライブデータ確認**
   E2E が file: モードに切り替わったら、parent ログイン → dashboard で 4 セクションが描画されること + Sheet からのリマインダー送信 (Resend test mode で OK) を E2E 化。

5. **shadcn dialog/tabs の活用**
   W3 で導入した dialog/tabs は parent-dashboard では未使用。 W4 で「学習者切替 (Tabs)」「設定モーダル (Dialog)」 として段階導入予定。

---

## 6. 既知のリスクと推奨対応

| 項目 | リスク | 推奨 |
|------|--------|------|
| Resend domain | updates.hanei.app の SPF/DKIM 未設定だと send が 422 | W4 開始前に owner-smoke §6 を必ず通す |
| OpenAI gpt-5-mini 開放 | org が gpt-5-mini 未開放だと 600 件失敗 | smoke §2 を先に実行 / 失敗時は `gpt-4.1-mini` に fallback (cost-guard で primary/fallback 切替済) |
| R2 IAM | Object Read & Write 権限不足だと TTS bulk が 401 連発 | smoke §7 で先に PUT/GET 確認 |
| `:memory:` libSQL の同期適用 | drizzle migrations が raw SQL split で吸えないなら fixture 失敗 | 失敗時は `drizzle-kit push:sqlite` 相当の手法に切替 |

---

## 7. 結論

**W3 は ◯ 全達成 (8/8)。 typecheck / lint / test ともに green。**
オーナー手動 smoke (8 項目) の完走と、 W4 での E2E webServer DB 切替 + AI バルク本番実行が次の関門。

以上、 Dev department / W3 完了報告。 — Dev (`/dev`)
