# Review report — W12-T3-C (DEC-071) Hotfix体制 + Sentry alert env化 + α→β migration announce skeleton

## 判定: APPROVE-WITH-MINOR (commit 直前 polish 4 件吸収済)

Critical 0 / Major 0 / Minor 4 / Nit 3。本 atomic は env 化が既存挙動と完全互換に保たれ、PII strip 構造も維持されており、DEC-024/003/006/013/055 すべて invariance を確認。コード変更面の regression risk は構造的にゼロと判定。Minor 4 件は CEO による commit 直前 polish (本 review 直後) で全件吸収済 → **commit GO**。

---

## レビュー対象 (8 ファイル / +471 lines / +commit polish 後)

### NEW (3)
- `app/RUNBOOK.md` (237 → 240 lines / 8 章構成)
- `projects/PRJ-016/docs/beta-invite-email-template.md` (114 → 114 lines)
- `projects/PRJ-016/docs/sentry-alert-setup.md` (120 lines)

### MODIFIED (5)
- `app/sentry.client.config.ts` (+29/-7) — env 化 + NaN ガード + kill switch
- `app/sentry.server.config.ts` (+20/-3) — 同上 (server 側)
- `app/sentry.edge.config.ts` (+20/-3) — 同上 (edge ランタイム)
- `app/.env.local.example` (+7/0) — Sentry runtime tuning 6 entries
- `app/src/app/page.tsx` (+9/-2) — LP footer 「クローズドβ公開中。ご利用は無料です（招待制）。」+ mailto

---

## Critical (must fix before merge)

なし。

---

## Major (should fix before merge)

なし。

---

## Minor (commit 前修正推奨 → 全件 polish 吸収済)

### Minor-1: RUNBOOK §6.1 hotfix 手順の `bun run` 表記が project 標準の npm と不整合 [FIXED]

**File**: `app/RUNBOOK.md:139-142`
**Issue**: `bun run typecheck` 等が記載されていたが、本プロジェクトは `package-lock.json` 同梱 = npm 運用 (`DEPLOYMENT.md` も `npm run db:generate` で統一)。incident 発生時 (5 分以内に切り分け前提) に「bun: command not found」で時間浪費するリスク。
**Fix 適用済**: 全行を `npm run` に置換 + `npm run e2e -- ...` の `--` 慣用記法注記追加 + 「本 repo は npm 運用 (DEPLOYMENT.md と統一)」の補足追記。

### Minor-2: RUNBOOK §5.2 自己参照 `§5.2 の出力から…` がループ参照 [FIXED]

**File**: `app/RUNBOOK.md:121`
**Issue**: §5.2 内で「§5.2 の `npx vercel ls --prod` 出力から…」と自己参照になっており、初見の運用者が一瞬混乱。
**Fix 適用済**: 「上の `npx vercel ls --prod` 出力から」に書き換え。

### Minor-3: beta-invite-email-template `{オーナー個人 email}` placeholder と LP `support@hanei.app` の表記揺れ [FIXED]

**Files**:
- `projects/PRJ-016/docs/beta-invite-email-template.md:79`
- `app/src/app/page.tsx:78`

**Issue**: メールテンプレは `{オーナー個人 email}` placeholder を「Phase 3 で確定」としているが、LP は既に `mailto:support@hanei.app` を確定埋め込み。受信者が LP と招待メールで異なるアドレスを見る可能性。
**Fix 適用済**: テンプレ §3 placeholder 表に「LP footer の `mailto:` は `support@hanei.app` を採用済のため、特段の理由がなければ同一値に揃える」と注記追加。

### Minor-4: RUNBOOK §7.2 Sentry quota 超過 playbook で server/edge 側に Replay env がないことの非言及 [FIXED]

**File**: `app/RUNBOOK.md:175`
**Issue**: client 側 env のみ言及されており、運用者が「server 側にも `NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` があるはず」と探す時間を発生させうる。
**Fix 適用済**: 「`replaysOnErrorSampleRate` は Sentry Replay = client (browser) 専用機能のため、server / edge 側に同等 env はない」と一行注記追加。

---

## Nit (style / future-proofing / 本 atomic では未対応 / Phase 3 候補)

### Nit-1: `sentry.{server,edge}.config.ts` の `dsn` 取得が `NEXT_PUBLIC_` prefix env を参照

**Files**: `app/sentry.server.config.ts:14` / `app/sentry.edge.config.ts:14`
**Note**: `process.env.NEXT_PUBLIC_SENTRY_DSN` を server/edge でも参照しているのは Next.js + Sentry SDK の慣行 (両 env が build-time に解決され runtime 双方で同値) のため**現状動作は正しい**。ただ「server/edge は NEXT_PUBLIC prefix 不要」とコメントに書いた直後に DSN だけ `NEXT_PUBLIC_` を使っているのは読み手を一瞬迷わせる。コメント側を「sample rate / kill switch については NEXT_PUBLIC prefix 不要」と限定するとより親切 — Phase 3 候補。

### Nit-2: `tracesSampleRate` の env パース処理が 3 ファイルで重複

**Files**: `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`
**Note**: NaN ガード + default fallback の同一ロジックが 3 箇所で重複。`src/lib/sentry/parse-env.ts` のような小さな pure helper に切り出すと DRY 化できる。ただし Sentry 公式テンプレが「3 ファイル分離」を前提としており、helper を import するとテストや bundle splitting の挙動を再検証する必要があるため、本 atomic では切り出さない判断は妥当 — Phase 3 候補。

### Nit-3: RUNBOOK §1 で「二次連絡先なし (β 期間中は許容)」とあるが、SEV-1 発生時にオーナーが連絡不能のケースが未記述

**File**: `app/RUNBOOK.md:23`
**Note**: 個人開発単独運用前提なので構造的にしようがないが、「β 期間中許容」だけだと「ではどうなるか」が未定義。最低限、「オーナー連絡不能時は Vercel deployment alert + Sentry alert が email 蓄積され、復帰後 §4.5 事後フローで対応する」と一行加えるとリスク受容根拠が明確になる — Phase 3 (有料化検討時) 候補。

---

## DEC 厳守確認 (PASS)

| DEC | 観点 | 結果 |
|---|---|---|
| **DEC-024 罰則ゼロ** | RUNBOOK / メールテンプレ / sentry-alert-setup.md / LP footer / SEV-1 連絡テンプレを全文 grep (`不具合\|失敗\|無効\|不正\|だめ\|やる気\|クレーム\|落ち`) → **0 件**。RUNBOOK §2 で「障害」「復旧」「対応」を中立技術用語と宣言した上で使用、§8 の文面設計補足で「ユーザー側に責を帰す表現は使わない」と明記。SEV-1 テンプレの「申し訳ございません」はマナー文言として正当化済。**PASS**。 |
| **DEC-003 三層認可** | 新規 server-side mutation / route 0。既存 `beforeSend` PII strip 保持。**invariance PASS**。 |
| **DEC-006 GET 10 / mutation 5** | 新規 API route 0 / 新規 server action 0。LP は既存 `page.tsx` に `mailto:` 追加のみ (route 増やさず)。**invariance PASS**。 |
| **DEC-013 Vercel Pro 単一プラン** | RUNBOOK §5.3 で「DEC-013 により Vercel Pro 単一プラン前提。Hobby 分岐は構造的に存在しない」と明記。**PASS**。 |
| **DEC-055 idempotency** | 本 atomic で mutation 触らず。**invariance PASS**。 |
| **DEC-070 連動** | RUNBOOK §3.2 / §1 で feedback button の SEV-2 級受信経路として記載済 / sentry-alert-setup.md §5 (Rule 4) で User Feedback alert を独立ルール化。**PASS**。 |
| **DEC-071 (本 atomic スコープ)** | decisions.md 冒頭で「含む / 含まない」を厳密に分離した内容と完全一致。**PASS**。 |

---

## セキュリティ確認 (PASS)

- `sendDefaultPii: false` 維持 (3 ファイル全て)。
- `beforeSend` の PII strip (email / ip_address) は既存挙動維持。
- server / edge では更に request headers の `cookie` / `authorization` を削除 = 認証情報漏洩防止 (既存挙動 / 本 atomic で破壊せず)。
- `kill switch` (`NEXT_PUBLIC_SENTRY_ENABLED !== "false"`) のロジックは「明示的に文字列 `false`」のみ disable = `undefined` / `""` / `"true"` / `"1"` は enabled = env 未設定 (既存運用) との後方互換が完全に成立。
- API キー / シークレットのハードコード **なし**。`.env.local.example` は値プレースホルダのみ。
- Path traversal / SQL injection / XSS は本 atomic に該当面なし (純粋に Markdown ドキュメント + env 化 + LP 文言更新)。

---

## パフォーマンス確認 (PASS)

- env パース (3 箇所 × 各 1 回 = init 時のみ実行) のオーバーヘッドは無視可。
- LP `mailto:` 追加は React に何ら追加 cost なし。
- `enabled = false` 時に Sentry が initialize 自体をスキップする挙動 = quota 超過時の bundle / runtime cost が縮小可能 = Operations 観点で改善。

---

## ドキュメント品質確認

- **RUNBOOK.md**: 5 分以内切り分け / 30 分以内判断という「緊急時に読み切れる粒度」設計を 8 章で完遂。Severity → Critical Path → Response → Rollback → Hotfix → Playbook → 連絡テンプレ の流れは実運用に整合。Minor-1, Minor-2, Minor-4 修正で完成度満点。
- **beta-invite-email-template.md**: プレースホルダ表 + 配布方法 + 招待コード発行手順 + 設計判断補助メモまで網羅。`scripts/generate-beta-invite.ts` が実在することを確認、手順は実行可能。Minor-3 で表記揺れも解消。
- **sentry-alert-setup.md**: 4 ルールが Trigger / Filter / Action の 3 列で構造化され UI 操作即可。Vercel env チェックリスト + 通知先設定 + 動作確認 (任意) も記載 = 運営者向けに必要十分。

---

## 受入基準対応

| 基準 | 結果 |
|---|---|
| typecheck warning 0 | dev 報告 GREEN / CEO 抜き打ち GREEN |
| lint warning 0 | dev 報告 GREEN / CEO 抜き打ち GREEN |
| vitest 55/846 PASS | dev 報告 GREEN (env 化は既存値同値で test 影響なし設計) |
| next build 25 routes | dev 報告 GREEN (新規 route 0 = 構造不変) |
| E2E 14 PASS / regression 0 | dev 報告 GREEN |
| beta-feedback E2E 4 PASS (T3-B regression 0) | CEO 抜き打ち GREEN (chromium 2 + mobile-chrome 2) |
| 罰語 grep 0 件 | 独立検証で **0 件確認** |

---

## 関連ファイル (絶対パス)

- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app/RUNBOOK.md`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app/sentry.client.config.ts`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app/sentry.server.config.ts`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app/sentry.edge.config.ts`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app/.env.local.example`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app/src/app/page.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/docs/beta-invite-email-template.md`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/docs/sentry-alert-setup.md`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/decisions.md` (DEC-071)
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app/package.json` (Minor-1 検証根拠)
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app/DEPLOYMENT.md` (Minor-1 検証根拠 / npm 運用)

---

**End of review-w12-t3-c-hotfix-sentry-announce.md**
