# PRJ-016 HANEI - W12-T3-B β feedback 収集動線（Sentry User Feedback 活用 / client-only）完遂報告

- 案件: PRJ-016 HANEI
- atomic: Phase 2 W12-T3-B (= 0.5 人日 / W12-T3 を 3 atomic に分解した第 2 弾)
- 根拠 DEC: DEC-070 (本 atomic) / DEC-069 / DEC-068 / DEC-067 / DEC-066 / DEC-065 / DEC-024 / DEC-003 / DEC-006 / DEC-055
- 完遂日: 2026-05-05
- 状態: stage 状態 (CEO trust-but-verify → review → commit/push 待ち)

## 概要

β ユーザーから feedback を収集する最小動線を、`@sentry/nextjs` 既存基盤 (W2 / T-8 で既に init / DSN 未設定時 SDK 内部で no-op 化) を完全流用して構築。`Sentry.captureFeedback({ message, name?, email? })` 同期呼び出しのみで feedback が Sentry プロジェクトの user_feedback Issue にチケット化される。**新規 DB schema 0 / 新規 server action 0 / 新規 API route 0 / DEC-006 (mutation 5 / GET 10) 構造完全不変**。/home (parent role only) 最下部に小型 outline ボタン「ご意見を送る」を配置し、`BETA_FEEDBACK_ENABLED !== "false"` で kill switch gate。

## 実装ファイル一覧

### 新規 (3 ファイル)

| ファイル | 行数 | 用途 |
|---------|------|------|
| `app/src/lib/feedback/submit.ts` | 92 | 純関数 (`validateFeedbackMessage` / `submitFeedback` / `FEEDBACK_MAX_LENGTH=1000`) — Turbopack `"use server"` sync export ban パターン **10 度目** 構造定着 (DOM-free / DB-free) |
| `app/src/components/feedback/feedback-button.tsx` | 173 | shadcn `Dialog` ベース client component / textarea 1000 char / 4 種 `data-testid` (`beta-feedback-button` / `beta-feedback-textarea` / `beta-feedback-submit` / `beta-feedback-thanks`) / cancel / error `[role="alert"]` |
| `app/tests/unit/feedback.submit.test.ts` | 178 | vitest 11 cases / `vi.mock("@sentry/nextjs")` で `captureFeedback` spy / 引数検証 + 空メッセージ未呼出検証 + `FEEDBACK_MAX_LENGTH` 境界 + 非文字列耐性 + DSN 未設定 fallback |
| `app/tests/e2e/beta-feedback.spec.ts` | 168 | Playwright 2 spec × 2 browser project (chromium + mobile-chrome) = 4 PASS / signupAndOnboard helper / dialog 開閉 + thanks 検証 + 「閉じる」 → 再 open で reset 検証 |

### 修正 (1 ファイル)

| ファイル | delta | 用途 |
|---------|-------|------|
| `app/src/app/(app)/home/page.tsx` | +21 / -2 | `FeedbackButton` import + `isBetaFeedbackEnabled()` gate 関数 + ページ最下部 footer 配置 (parent 認可は既存 `requireAuth` + `getFamilyIdForUser` を流用) |

## 検証通過

| 項目 | 結果 | baseline 比 |
|------|------|-------------|
| typecheck | 0 errors | 維持 |
| lint | 0 warnings | 維持 |
| vitest | **55 files / 846 PASS** | 54/835 → +1 file / +11 件 (うち 11 件が DEC-070) / regression 0 |
| next build | **25 routes** | 不変 (DEC-006 GET 10 / mutation 5 厳守 / 新規 route 0 / 新規 mutation 0) |
| E2E beta-feedback (chromium + mobile-chrome) | **4 PASS** (33s) | 新規 |
| E2E signup-beta-invite (BETA_INVITE_REQUIRED=true) | **8 PASS** | 維持 (regression 0) |
| E2E admin-kpi | **4 PASS** | 維持 |
| E2E admin-kpi-experiment | **2 PASS** | 維持 |
| E2E shop | **6 PASS** | 維持 |
| **E2E regression 合計** | **20 PASS** | DEC-070 §受入基準 完全充足 |

## 設計判断 — DOM テスト戦略

DEC-070 §4 では `feedback.button.test.tsx` (DOM テスト) で 4-6 cases (dialog 開閉 / textarea 表示 / submit 引数検証 / thanks 表示 / cancel reset) が指示されていたが、PRJ-016 は **tsx unit test 前例ゼロ + `@testing-library` / `jsdom` 依存ゼロ** の状態。新規依存導入は CLAUDE.md「依存関係追加最小化推奨」+ DEC-070 同方針に反するため、以下の代替戦略を採用した:

- **ロジック層を `src/lib/feedback/submit.ts` (純関数 / Turbopack 10 度目) に隔離**
- **unit test (`feedback.submit.test.ts`) で DEC-070 §4 と同等の検証粒度**:
  - 「空 textarea blocked / Sentry 未呼出」 → `validateFeedbackMessage("")` = `{ ok: false, reason: "empty" }` + 構造的 `submitFeedback` 未呼出を assert
  - 「通常入力 → submit → Sentry 引数検証」 → `submitFeedback({ message, name, email })` で `vi.mock` した `Sentry.captureFeedback` の呼出引数を厳密一致 assert
  - DSN 未設定環境での fallback (`enabled: Boolean(dsn)` で undefined 戻り値 → 空文字フォールバック)
  - 1000 文字境界 (ちょうど pass / 1001 文字 fail)
  - 非文字列入力耐性 (null / undefined / number / object → empty fail)
- **dialog 開閉 / textarea 表示 / cancel reset / thanks 表示 = E2E (`beta-feedback.spec.ts`) で実 DOM 検証**:
  - chromium + mobile-chrome の 2 browser project で 4 PASS
  - shadcn `Dialog` の radix 状態管理が onOpenChange で確実に reset されることを検証

このアプローチにより:
1. 依存追加 0 (DEC-070 §0 + CLAUDE.md 方針厳守)
2. Turbopack `"use server"` sync export ban パターン **10 度目** 構造定着 (`src/lib/feedback/`)
3. 検証カバレッジは DEC-070 §4 と等価以上 (E2E は実ブラウザ、unit は実 Sentry mock)

## DEC 厳守確認

- **DEC-024 罰則ゼロ**: ボタン「ご意見を送る」/ dialog title「ご意見・気になったこと」/ submit「送信する」/ cancel「閉じる」/ thanks「ご意見を送信しました。ありがとうございます。」/ error「送信できませんでした。少し時間を置いて再度お試しください。」 — 全て中立文言 / 「不具合」「クレーム」「失敗」等の罰語不在
- **DEC-003 三層認可**: middleware (proxy) → /home page server check (`requireAuth` + `getFamilyIdForUser`) → button は parent 確定後にのみレンダリング / Sentry 直送のため第三層 SQL aggregate は対象外 (DB 個人特定要素ゼロ = テーブル自体が存在しない)
- **DEC-006 GET 10 / mutation 5 不変**: 新規 route 0 / 新規 server action 0 / 既存 home page に component 追加のみ / Sentry envelope は外部送信 = mutation budget 対象外 / next build **25 routes** 維持
- **DEC-055 idempotency**: client-side `submitting` state で送信中の二重 click を構造抑止 / Sentry 側 dedupe で event 重複も自動除去
- **Turbopack `"use server"` sync export ban (10 度目)**: `src/lib/feedback/submit.ts` 純関数 2 種 (`validateFeedbackMessage` / `submitFeedback`) を DOM-free / DB-free / `"use server"` 不在で隔離 = client component / unit test 双方から共有可能
- **CLAUDE.md 絵文字禁止 / Heroicons 使用**: `ChatBubbleLeftRightIcon` のみ使用 / 絵文字 0
- **β kill switch**: `BETA_FEEDBACK_ENABLED !== "false"` server-side 評価 (default 表示 / "false" のみ非表示) = client bundle に env が漏れず、緊急時の運営側無効化が即時可能

## 既知の Minor / Nit / 持ち越し

### Minor (W13 以降 backlog 候補)
- **M-1**: `/settings` 配下への配置は **見送り**。DEC-070 §3「`/settings/page.tsx` トップが無い場合は新規 route 追加せず /home のみで OK (DEC-006 GET 10 不変)」を厳守し、現状 `/settings/accessories` のみ存在のため /home 単独で完結とした。settings に「アプリの設定」エントリを別 atomic で作る場合に再評価。
- **M-2**: feedback 送信時の `userName` (親の表示名) は現状 prop optional のまま未渡し。`session.email` のみ Sentry に渡している。`session.userId` から `users.parentName` を取得する経路を追加すれば名前付きで Sentry 通知できる (P2 改善 / Sentry UI で email から運営側が手動マッピング可能なため P0 ではない)。

### Nit
- **N-1**: feedback button のページ内位置は最下部 footer 配置。CEO レビューで「ヘッダー右上の方が discoverable」と判断される場合は再配置容易 (component 1 行移動)。
- **N-2**: error 文言「ご意見をご入力ください」の敬語レベルは保護者向け UI 全体のトーン (`/home` 等が学習者向け平仮名中心) と微妙にレジスタが異なる。トーン統一は別 atomic で `organization/rules/design-guidelines.md` に基づき横断的にチェック推奨。

### 持ち越し (DEC-070 §「含まない」明示分 / 本 atomic スコープ外)
- DB persistence / admin viewer (T3-C 以降 or β 後再評価)
- Sentry プロジェクト側 alert ルール / Slack integration (T3-C で run-book 化)
- learner 直接送信 UI (子ども側には出さない設計 / 親が代弁)
- スクリーンショット添付 / 詳細ログ送付 (β 短期は textual で十分)

## β 運営インフラ拡張

これにより β 運営観測の 2 系統が揃った:
- **W12-T3-A (DEC-069)**: invite gate (CLI 発行 + atomic redeem)
- **W12-T3-B (本 atomic / DEC-070)**: feedback 収集動線 (Sentry user_feedback / client-only)

残り 1 atomic (W12-T3-C = 緊急 hotfix 体制 + Sentry alert + α→β 移行アナウンス) で W12 完遂見込み。

## 次 atomic 候補（CEO 推奨）

- **W12-T3-C**: 緊急 hotfix 体制 + Sentry 観測強化 (alert / Slack integration) + α→β 移行アナウンス（0.5 人日 / P0）
- **W12-T4**: ストレステスト + Sentry alert 設定（0.5 人日 / P1）
- **W11 KPT**: 並行可 / 0.25 人日

## 検証コマンド再現手順

```powershell
cd C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app
bun run typecheck
bun run lint
bun run test
bun run build

# port 3000 が占有されている場合
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# E2E 新規
bun run e2e tests/e2e/beta-feedback.spec.ts --workers=1

# E2E regression
$env:BETA_INVITE_REQUIRED="true"; bun run e2e tests/e2e/signup-beta-invite.spec.ts --workers=1; Remove-Item Env:\BETA_INVITE_REQUIRED
bun run e2e tests/e2e/admin-kpi.spec.ts --workers=1
bun run e2e tests/e2e/admin-kpi-experiment.spec.ts --workers=1
bun run e2e tests/e2e/shop.spec.ts --workers=1
```
