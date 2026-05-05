# PRJ-016 HANEI - W12-T3-C 緊急 hotfix 体制 + Sentry alert 強化 + α→β 移行アナウンス 完遂報告

- 案件: PRJ-016 HANEI
- atomic: Phase 2 W12-T3-C (= 0.5 人日 / W12-T3 を 3 atomic に分解した第 3 弾 / W12 最終 atomic)
- 根拠 DEC: DEC-071 (本 atomic) / DEC-070 / DEC-069 / DEC-068 / DEC-067 / DEC-066 / DEC-065 / DEC-024 / DEC-003 / DEC-006 / DEC-013 / DEC-055
- 完遂日: 2026-05-05
- 状態: stage 状態 (CEO trust-but-verify → review → commit/push 待ち)

## 概要

β リリース可能状態の最終段として、(a) 緊急 hotfix 体制を `RUNBOOK.md` に体系化、(b) Sentry alert 強化のため config を env 化 + 運営者向け checklist を整備、(c) α→β 移行アナウンス文面 + LP footer 更新で「招待をご希望の方は」mailto 経路を新設。**新規 server action 0 / 新規 API route 0 / 新規 migration 0 / build 25 routes 完全不変**。research §5.2 の工数内訳通り 4.0h で完遂。Markdown 文書 3 件 + sentry config env 化 3 ファイル + LP 1 ファイル + .env.local.example 1 ファイル = 計 8 ファイル変更（うち新規 3）。

## 実装ファイル一覧

### 新規 (3 ファイル / 計 471 行)

| ファイル | 行数 | 用途 |
|---------|------|------|
| `app/RUNBOOK.md` | 237 | 運用中の異常時対応手順書。8 章構成 (使い方 / 連絡先 / Severity / Critical Path / Incident Response 5 ステップ / Vercel Rollback UI+CLI / Hotfix / 既知 incident playbook 3 件 / SEV-1 連絡テンプレ inline)。個人開発単独運用前提 (DEC-013) / payment 構造除外 (DEC-006/012) 明示。 |
| `projects/PRJ-016/docs/beta-invite-email-template.md` | 114 | β 招待メール本文テンプレ。research §C-1 完全準拠。件名 + 本文 + 招待コード placeholder + 4 step 開始手順 + ご利用無料 + 「ご意見を送る」ボタン誘導 + お問い合わせ。配布方法 (メール/DM/個別) + 招待コード発行手順 (`bun run scripts/generate-beta-invite.ts`) も併記。 |
| `projects/PRJ-016/docs/sentry-alert-setup.md` | 120 | Sentry プロジェクト UI で設定する alert ルール checklist。Rule 1 Error Spike / Rule 2 New Issue / Rule 3 Regression / Rule 4 User Feedback Received の 4 ルール + Vercel Production env 9 項目 checklist + 通知先 email 設定手順。 |

### 修正 (5 ファイル)

| ファイル | delta | 用途 |
|---------|-------|------|
| `app/sentry.client.config.ts` | +29 / -7 (合計 51 行) | hardcode → env 化 (`NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_ENABLED`)。`Number.parseFloat` + `Number.isFinite` で NaN ガード = default 値 fallback。`beforeSend` PII strip / `replaysSessionSampleRate: 0` / `sendDefaultPii: false` は完全保持。 |
| `app/sentry.server.config.ts` | +20 / -3 (合計 43 行) | 同上 (server runtime 用 / `SENTRY_TRACES_SAMPLE_RATE` / `SENTRY_ENABLED`)。`beforeSend` cookie/authorization strip / `sendDefaultPii: false` 維持。 |
| `app/sentry.edge.config.ts` | +20 / -3 (合計 42 行) | 同上 (edge runtime 用)。 |
| `app/.env.local.example` | +7 / 0 | 既存 §Sentry セクション末尾に 6 env (NEXT_PUBLIC × 3 + server/edge × 2) + 区切りコメント 1 行 = 7 行追記。 |
| `app/src/app/page.tsx` | +9 / -2 | LP footer 「現在クローズドβ準備中。ご利用は無料です。」→「クローズドβ公開中。ご利用は無料です（招待制）。」+ 隣接 `<p>` で `mailto:support@hanei.app` 招待希望リンク追加。DEC-024 罰則ゼロ。 |

## 検証通過

| 項目 | 結果 | baseline 比 |
|------|------|-------------|
| typecheck | **0 errors** | 維持 |
| lint | **0 warnings** | 維持 |
| vitest | **55 files / 846 PASS** (4.55s) | 維持 (regression 0) |
| next build | **25 routes** | 不変 (DEC-006 GET 10 / mutation 5 厳守 / 新規 route 0 / 新規 server action 0 / 新規 API route 0) |
| E2E admin-kpi (chromium 2 + mobile-chrome 2) | **4 PASS** | 維持 |
| E2E shop (chromium 3 + mobile-chrome 3) | **6 PASS** | 維持 |
| E2E beta-feedback (chromium 2 + mobile-chrome 2) | **4 PASS** | 維持 |
| **E2E regression 合計** | **14 PASS** (45.7s) | DEC-071 §受入基準 完全充足 |
| 罰語 grep (RUNBOOK / 招待メール / sentry-alert-setup / page.tsx) | **0 件** (全 4 ファイル) | DEC-024 完全充足 |

### 罰語 grep 詳細

```
$ grep -nE '不具合|失敗|無効|不正|だめ|やる気|クレーム' app/RUNBOOK.md
(no matches)
$ grep -nE '不具合|失敗|無効|不正|だめ|やる気|クレーム' docs/beta-invite-email-template.md
(no matches)
$ grep -nE '不具合|失敗|無効|不正|だめ|やる気|クレーム' docs/sentry-alert-setup.md
(no matches)
$ grep -nE '不具合|失敗|無効|不正|だめ|やる気|クレーム' app/src/app/page.tsx
(no matches)
```

RUNBOOK §2 で「障害」「復旧」「対応」を運用語彙として採用しているが、これらは罰語リスト外であり、本書冒頭で「中立な技術用語として扱う」と明示している (DEC-024 哲学整合)。

## 設計判断

### A. RUNBOOK 構造

- research §2.2 の章立てを完全踏襲し 8 章構成 (0〜8) + §9 関連ドキュメント。237 行 (research 目安 200〜300 行に収まる）。
- §3.3 で **payment 系を構造除外** と明示 (DEC-006 / DEC-012 整合 / Phase 3 で再評価)。
- §7 で **既知 incident playbook 3 件** を pre-defined 化 (invite redeem 競合 / Sentry quota 超過 / OpenAI 障害)。
- §8 SEV-1 連絡テンプレ inline で research §C-2 文面を取り込み。
- 個人開発単独運用前提のため Severity SLA を 30min/2h/当日/翌営業日 の 4 段階に簡素化。

### B. Sentry config env 化

- **既存挙動完全互換**: default 値が既存 hardcode (`0.1` / `1.0`) と同値 = env 未設定時の挙動は完全一致。
- **NaN ガード**: `Number.parseFloat` + `Number.isFinite` で env が壊れた場合も default 値 fallback。
- **kill switch**: `SENTRY_ENABLED=false` で全停止可能 (Sentry quota 完全枯渇時の構造的緊急停止)。
- **server / edge は `NEXT_PUBLIC_` prefix 不要**: research §3.3.1 設計通り。client は browser bundle 注入が必要のため `NEXT_PUBLIC_` 必須。
- **既存 `beforeSend` PII strip / `replaysSessionSampleRate: 0` / `sendDefaultPii: false` は完全保持**: PII 取り扱い方針 (DEC-070 §4) は本 atomic で一切変更せず。
- **テスト負荷ゼロ**: sentry.config.ts は元々 unit test 対象外 (init は side effect のみ) のため、env 化で test 影響ゼロ → vitest 846 PASS 完全維持。

### C. α→β アナウンス

- α 実ユーザー 0 名前提 (research §1.3 grep 結果 / DEC-071 §判断根拠 5 採択) → 「β 招待メール」のみ作成し「α→β 移行通知」は不要と判断。
- LP footer の文言は「準備中」→「公開中」+ 「招待制」明記の 2 段構成。実態 (T3-A 実装完了で公開可能) と整合。
- 招待希望者の流入経路として `mailto:support@hanei.app` を採用 (DEC-006 mutation/route +1 抵触回避 / 専用 form route は Phase 3 候補)。
- `support@hanei.app` は中立 placeholder。実際のオーナー個人 email は Phase 3 で確定 (DEC-071 §軽承認 4 項目に整合)。

### D. Sentry alert checklist (運営者向け)

- research §3.2 の 4 ルールを Sentry UI 操作手順として展開 (Issue Alert ベースで統一 / Metric Alert は使わない判断 = β 規模では Issue 単位で十分)。
- §6 Vercel Production env チェックリストで 9 env を全列挙 (DSN + AUTH_TOKEN + ORG + PROJECT + 5 件の sample rate / enabled flag)。
- §8 動作確認手順は「W12-T4 stress test atomic で実施推奨」と明示 = T3-C はあくまで checklist 整備までで、実発火検証は T4 持ち越し (DEC-071 §持ち越し整合)。

## DEC 厳守確認

- **DEC-024 罰則ゼロ**: RUNBOOK / 招待メールテンプレ / sentry-alert-setup / LP page.tsx の 4 文書すべてで罰語 grep 0 件確認。RUNBOOK §2 「障害」「復旧」「対応」は運用語彙として中立扱い (冒頭明示)。SEV-1 連絡テンプレでは「お子さまの学習データは失われておりません」を保護者の最大不安要素として先回り明記。
- **DEC-003 三層認可**: 本 atomic は認可面に触れず / 既存 middleware + page server check + SQL aggregate 構造を完全維持。
- **DEC-006 構造完全不変**: 新規 server action 0 / 新規 API route 0 / 新規 migration 0 / next build **25 routes** (`/`, `/admin/kpi`, `/api/ai/coach`, `/api/auth/[...all]`, `/api/cron/generate-problems`, `/api/cron/streak-freeze-monthly`, `/api/cron/weekly-digest`, `/badges`, `/home`, `/legal/privacy`, `/legal/terms`, `/login`, `/messages`, `/onboarding/learner`, `/parent/dashboard`, `/parent/messages/new`, `/parent/mock-exam-results`, `/quests`, `/settings/accessories`, `/shop`, `/signup`, `/study`, `/study/[levelCode]/[skillCode]`, `/verify-email`, `/_not-found`) 完全保持。
- **DEC-013 Vercel Pro 単一前提**: RUNBOOK §5 rollback 手順は Pro UI 前提 / Hobby 分岐ゼロ。
- **DEC-055 idempotency**: 本 atomic は I/O 面に触れず / 既存維持。
- **DEC-066 〜 DEC-070 既存 polish 維持**: feedback 動線 / invite flow / streak / shop すべて regression 0。
- **Turbopack `"use server"` sync export ban パターン**: 本 atomic は server action 追加なし = 構造的に該当範囲外 (10 度目 (DEC-070) の定着を維持)。

## 既知の Minor / Nit / 持ち越し

### Minor (W13 / Phase 3 backlog 候補)

- **M-1**: LP footer の `mailto:support@hanei.app` は中立 placeholder。オーナー個人 email が確定したら 1 行差し替えで対応 (Phase 3)。
- **M-2**: Sentry alert ルールの実 UI 設定は本 atomic コード対象外 = CEO/オーナー手動操作 (`docs/sentry-alert-setup.md` checklist 通りに次セッション内で 10〜15 分作業)。
- **M-3**: `next.config.ts` の `disableLogger` / `automaticVercelMonitors` deprecation warning は `@sentry/nextjs ^10.0.0` の Turbopack 非対応経路。本 atomic スコープ外 (W13 で `webpack.treeshake.removeDebugLogging` への移行検討)。

### Nit

- **N-1**: RUNBOOK §6.1 の hotfix コマンド例で `bun run e2e tests/e2e/admin-kpi.spec.ts tests/e2e/shop.spec.ts --workers=1` を「critical-only」セットとして提示。`beta-feedback.spec.ts` も含めるべきかは運用しながら判断 (W13 以降 KPT 候補)。
- **N-2**: 招待メールテンプレの「あなた専用の招待コード」表記は β ユーザーフレンドリーだが、`maxRedemptions > 1` の共有用コードを発行する場合は文言調整が必要 (運営者が手動で本テンプレを編集する想定で許容)。

### 持ち越し (DEC-071 §「含まない」明示分 / 本 atomic スコープ外)

- Sentry プロジェクト UI 側の実設定 (運営者手動 = 本書 §6 / §7 の checklist 通り別途実施)
- 実 alert 発火検証 (W12-T4 ストレステスト atomic で実施)
- 専用 invite 希望 form route (DEC-006 抵触回避 / Phase 3 候補)
- Slack integration / Phase 3 候補
- LP 多言語化 / Phase 3 候補

## β 運営インフラ完成

これにより β 運営観測 + 緊急対応の 4 系統が揃った:

- **W12-T3-A (DEC-069)**: invite gate (CLI 発行 + atomic redeem)
- **W12-T3-B (DEC-070)**: feedback 収集動線 (Sentry user_feedback / client-only)
- **W12-T3-C (本 atomic / DEC-071) 観測**: Sentry alert env 化 + alert checklist + RUNBOOK
- **W12-T3-C (本 atomic / DEC-071) 通知**: β 招待メールテンプレ + LP footer 更新 + SEV-1 incident テンプレ

W12 = 5/5 atomic 達成 → **Phase 2 進捗 99% 視野** (正式完遂宣言は CEO 判断で別途実施 / W12-T4 stress test を完遂させて 100% という選択肢も)。

## 次 atomic 候補（CEO 推奨）

- **W12-T4**: ストレステスト + Sentry alert 実発火検証（0.5 人日 / P1）→ §sentry-alert-setup §8 の動作確認をここで実施
- **Phase 2 完遂宣言**: T3-A/B/C で β 運営インフラ完備 = 完遂宣言する選択肢も CEO 判断
- **Phase 3 候補**: payment フロー / Slack integration / LP 多言語化 / 専用 invite form route

## 検証コマンド再現手順

```powershell
cd C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app
bun run typecheck
bun run lint
bun run test
bun run build

# port 3000 が占有されている場合
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# E2E regression
bun run e2e tests/e2e/admin-kpi.spec.ts tests/e2e/shop.spec.ts tests/e2e/beta-feedback.spec.ts --workers=1
```

## stage 状態確認 (commit せず)

```
$ git status --short  (PRJ-016 HANEI repo)
 M app/.env.local.example
 M app/sentry.client.config.ts
 M app/sentry.edge.config.ts
 M app/sentry.server.config.ts
 M app/src/app/page.tsx
 M decisions.md           ← CEO 起票済 DEC-071 (本 atomic 着手判断)
?? app/RUNBOOK.md
?? docs/beta-invite-email-template.md
?? docs/sentry-alert-setup.md
```

CEO trust-but-verify → review APPROVE 後に commit/push される想定。

---

**End of W12-T3-C 完遂報告**
