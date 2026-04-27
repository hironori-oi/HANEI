# PRJ-016 HANEI - W5 G-6 E2E スモーク実装レポート (Dev / E2E 担当)

- 担当: Dev (E2E)
- スプリント: W5 / DEC-036 G-6
- ステータス: 完了 (E2E グリーン / 既存ゲート全パス)
- 日付: 2026-04-27

---

## 1. 目的 (Why)

W5 ギャップ埋め G-6:
「signup → email-verify (mock skipped) → onboarding/learner → /home → /study/eiken-5/vocab → 4 択解答 → 即時フィードバック → 次問」
を Playwright で 1 spec / フル ハッピーパスとして自動化し、CI でも回せるスモークとして MVP コアループを担保する。

---

## 2. 成果物 (What)

### 2-1. 新規作成ファイル

| ファイル | 役割 |
|---|---|
| `tests/e2e/study-smoke.spec.ts` | W5 G-6 ハッピーパス 1 spec (全 7 ステップ) |
| `src/lib/actions/exam-date-validation.ts` | sync helper / 型を `"use server"` 外に分離 |
| `src/app/(auth)/signup/schema.ts` | Zod schema を `actions.ts` から分離 |
| `src/app/(auth)/login/schema.ts` | 同上 |
| `src/app/(auth)/verify-email/schema.ts` | 同上 |
| `src/app/onboarding/learner/schema.ts` | 同上 |

### 2-2. 修正ファイル

| ファイル | 内容 |
|---|---|
| `tests/e2e/fixtures/db-fixture.ts` | `problem_explanations` を 5 件追加 seed (G-4 フィルタ通過用) / DDL 行コメント先頭で statement 全削除されるバグを修正 |
| `playwright.config.ts` | webServer 起動時に `tests/e2e/.tmp/` を pre-mkdir (build より前に SQLite ファイルを open できるように) / timeout 120s → 180s |
| `src/lib/auth/auth.ts` | `nextCookies()` plugin を有効化 (Server Action redirect 後に Better Auth セッション cookie を維持するため) |
| `src/lib/actions/exam-date.ts` | sync export と type re-export を分離モジュールから import に変更 (Turbopack `"use server"` 制約) |
| `src/app/(parent)/components/exam-date-dialog.tsx` | sync helper を `exam-date-validation` から import |
| `src/app/(auth)/{signup,login,verify-email}/actions.ts` | inline schema 削除 + 別ファイルから import |
| `src/app/onboarding/learner/actions.ts` | 同上 |
| `tests/unit/auth.actions.test.ts` | schema import パスを `/schema` 経路へ更新 |
| `tests/unit/exam-date.validation.test.ts` | helper import パスを `exam-date-validation` 経路へ更新 |

合計: 新規 6, 修正 9 = **15 ファイル**

---

## 3. シナリオ詳細 (`study-smoke.spec.ts`)

```
1. /signup
   - email/password/parent_name + 同意 3 種
   - 「アカウントを作成する」クリック → /verify-email にリダイレクト

2. /onboarding/learner (session cookie 維持)
   - ニックネーム入力 + target_level=5 + exam_date=今日+6ヶ月
   - 「この内容で進める」クリック → /home

3. /home
   - 「きょうのミッション」見出し / こんにちは挨拶
   - 受験日カウントダウン (examDate + 「あと N 日」)
   - れんぞくきろく / Lv. N
   - 「英検5級の進捗」+ progressbar 4 本以上 (空状態でエラーが出ないことを確認)
   - CTA「語彙(英検5級)をはじめる」

4. /study/eiken-5/vocab
   - kotodama-tori (data-mood=thinking)
   - choice-A〜D 4 ボタン
   - study-prompt 非空
   - audio-player は表示されない (G-2 gate 確認)

5. choice-A クリック
   - study-feedback 表示
   - せいかい / おしい heading
   - study-explanation 非空
   - kotodama mood が cheerful/celebrating/sad/encouraging のいずれかに遷移

6. study-next クリック
   - study-feedback 非表示
   - /home に戻る or /study に留まる (どちらでも OK)
```

---

## 4. ゲート結果 (数字付き)

| ゲート | コマンド | 結果 |
|---|---|---|
| 1. 型 | `npx tsc --noEmit` | exit 0 (エラー 0) |
| 2. lint | `npm run lint` | 0 errors / 0 warnings |
| 3. 単体 | `npm run test` | **16 files / 157 tests passed** (Duration 2.13s) |
| 4. E2E (G-6 単体) | `npx playwright test tests/e2e/study-smoke.spec.ts --project=chromium` | **1 passed (22.0s)** |
| 5. E2E 全体 (chromium) | `npx playwright test --project=chromium` | **18 passed / 1 failed** (失敗は事前から存在) |

### E2E の "1 failed" について (正直報告 / Skip しない)

- 失敗 spec: `tests/e2e/parent-consent.spec.ts:17` - 「13歳未満向けの保護者同意セクションが表示される」
- 原因: `getByText(/13歳未満/)` が strict-mode で 2 要素にマッチ (説明文 + ラベル)
- 関連性: **G-6 とは無関係**。`git stash` で本変更を退避してベースラインで再実行しても同じ失敗が出ることを確認済 (pre-existing flake)
- 対応案: `.first()` を付けるか、より具体的なロケータに変更する 1 行修正で解消可能。**本タスクのスコープ外**として申し送り。

---

## 5. 詰まった点と対応

### 5-1. webServer build が SQLite Cantopen(14) で死亡

- **症状**: `npm run build` 中の "Failed to collect page data for /api/auth/[...all]" でビルド失敗
- **原因**: Next.js の page data 収集フェーズで auth route module が初期化され、その時点で libSQL client が `file:./tests/e2e/.tmp/e2e.db` を open するが、`.tmp/` ディレクトリが未作成
- **対応**: `playwright.config.ts` の webServer.command に `node -e "..."` の pre-step を入れ、build より前に `.tmp/` ディレクトリと空 DB ファイルを保証。globalSetup が後で seed する分には冪等なので問題なし

### 5-2. db-fixture の DDL split が CREATE TABLE を丸ごと捨てていた

- **症状**: `applyMigrations` 後すぐに「no such table: main.users」
- **原因**: SQL ファイル先頭が `-- HANEI...` コメントで始まり、`split(/;\s*\n/)` が出した最初のチャンクが `users` の CREATE TABLE を含んでいたが、`!s.startsWith("--")` フィルタで丸ごと削除されていた
- **対応**: 行ごとに `-- ...` を剥がしてから split するように修正

### 5-3. signup 後のセッション cookie が維持されない

- **症状**: signup → /verify-email まで遷移するが、`page.goto("/onboarding/learner")` で /login にリダイレクトされる
- **原因**: Better Auth `auth.api.signUpEmail({ asResponse: false })` は Server Action から呼ばれた際、Set-Cookie を Next.js の応答 cookie ストアに転記していなかった (= ブラウザに cookie が届いていなかった)
- **対応**: `auth.ts` に `plugins: [nextCookies()]` を追加。これで Server Action 経由の signup/login で cookie が確実に維持される
- **影響範囲**: 認証系 Server Action 全般。本番でも同じ理由で session が安定する効果がある (バックエンド Dev 領域のため申し送り対象 / 後述)

### 5-4. Turbopack `"use server"` 制約

- **症状**: build エラー「A "use server" file can only export async functions, found object」
- **原因**: `actions.ts` 内に Zod schema や sync helper / `export type` が同居しており、Turbopack 16 が拒否
- **対応**: 既存の `streak.ts` 分離パターンに倣って 4 つの schema と exam-date 用 validation を sibling モジュールに切り出し。type re-export も削除し呼び出し側に直接 import させる方針に統一

---

## 6. 受け入れ基準照合

| 受入条件 | 結果 |
|---|---|
| `tests/e2e/study-smoke.spec.ts` が存在する | YES |
| `npx tsc --noEmit` が PASS | YES (exit 0) |
| `npm run lint` が PASS | YES (0 errors) |
| `npm run test` が PASS | YES (157/157) |
| `npx playwright test tests/e2e/study-smoke.spec.ts` が 1 spec 以上 PASS | YES (1 passed) |
| 既存 Playwright spec が回帰していない | YES (パス数 17→18 に増加 / 失敗は事前から存在する 1 件のみ) |
| listening / TTS は対象外 | YES (audio-player count=0 を assert) |
| 空状態 (mastered=0) が error にならない | YES (進捗バー 4 本以上 visible を assert) |

---

## 7. CEO への申し送り (受入レビュー観点)

1. **`nextCookies()` plugin を本番有効化済**: バックエンド Dev 領域 (auth.ts) を 1 行触っているが、本番でも望ましい修正 (Server Action signup/login の cookie 設定漏れバグ修正)。バックエンド Dev に共有してください。
2. **`"use server"` 制約修正**: Zod schema と sync helper を 5 ファイル分離。既存の `streak.ts` 分離パターンに揃えており追加学習コストなし。
3. **`db-fixture.ts` DDL parser bug 修正**: 行コメント先頭で SQL チャンクが丸ごと捨てられていた pre-existing バグ。修正後は file: モード DB でも `:memory:` モードでも同様に動く。
4. **`parent-consent.spec.ts` の strict-mode 失敗** (pre-existing): G-6 とは無関係。1 行修正で解消可能だが本タスクのスコープ外として申し送り。レビュー時に併せて修正するか別チケット化を判断ください。
5. **CI 想定**: webServer の build pre-step (`node -e "fs.mkdirSync ..."`) は POSIX/Win 両対応。Playwright の webServer.timeout を 180s に拡張済 (cold build 対策)。

---

## 8. 関連参照

- DEC-036 W5 plan
- 既存 W4 fixture (`tests/e2e/fixtures/db-fixture.ts`)
- 既存 separation pattern (`src/lib/actions/streak.ts` / `streak-helpers.ts`)
- frontend report data-testid 命名規則 (`kotodama-tori`, `choice-A〜D`, `study-prompt/feedback/explanation/next`)
