# HANEI RUNBOOK

> 運用中の異常時対応手順書 (W12-T3-C / DEC-071 で新設)。
> 初回構築手順は `DEPLOYMENT.md` を参照すること。役割を明確に分離している。

---

## 0. このファイルの使い方

- β 期間中の incident 発生時に最初に開く。
- 5 分以内に切り分け → 30 分以内に hotfix or rollback の判断基準を提供する。
- 各章は短く読み切れる粒度で記載。緊急時に長文を読む余裕はない前提。
- 個人開発単独運用前提 (DEC-013 = Vercel Pro 単一プラン整合)。

---

## 1. 連絡先 / on-call 体制

- **オーナー単独運用前提** (個人開発)。エスカレーション先は存在しない。
- 通知チャネル:
  - Sentry → email (オーナー個人アドレス) — 一次経路
  - Slack 連携 — 任意 / Phase 3 候補
- 二次連絡先なし (β 期間中は許容)。
- β ユーザー側からの直接窓口は `Sentry.captureFeedback()` 経由 (DEC-070 / T3-B 実装済) と LP `mailto:` リンク (DEC-071 / T3-C 実装済) の 2 経路。

---

## 2. Severity 区分 (SLA 暫定)

> 「障害」「復旧」「対応」は本書では中立な技術用語として扱う (運用語彙 / DEC-024 罰則ゼロ哲学に矛盾しない)。

| Severity | 症状例 | 対応 SLA |
|---|---|---|
| **SEV-1** | signup / login が完全に動かない (β ユーザー新規受入不可) | 30 分以内に rollback or hotfix |
| **SEV-2** | study flow (問題回答 / submitAnswer) で error event spike | 2 時間以内に hotfix |
| **SEV-3** | 個別機能 (ハネキン shop / streak freeze grant cron 等) の異常 | 当日中に hotfix |
| **SEV-4** | UI の軽微な乱れ / 文言のゆらぎ | 翌営業日に対応 |

---

## 3. Critical Path 一覧 (β 期間中の最優先監視対象)

### 3.1 必須 critical (SEV-1 / SEV-2 直結)

- signup (invite redeem 含む / `/(auth)/signup`)
- login (`/(auth)/login`)
- verify-email (better-auth 経由)
- study フロー (submitAnswer / FSRS 更新含む)
- parent dashboard 主要 4 card (`/(app)/home`)

### 3.2 準 critical (SEV-2 / SEV-3 直結)

- streak freeze grant cron (週次)
- weekly digest cron
- ハネキン shop 購入フロー
- accessory 装着フロー
- Sentry user_feedback 受信経路 (T3-B 実装 / DEC-070)

### 3.3 β 範囲外 (構造除外)

- **payment 系**: DEC-006 / DEC-012 により Phase 1 / 2 は完全無料運用 = payment フロー実装ゼロ = critical path から構造的除外。
- Phase 3 で課金導入を検討する際に本章 §3.1 / §3.2 を更新すること。

---

## 4. Incident Response フロー (5 ステップ)

### 4.1 検知

3 経路のいずれかで incident を認識する:

1. Sentry email alert (推奨主経路 / `docs/sentry-alert-setup.md` 参照)
2. Vercel Deployment Alert
3. 手動報告 (β ユーザー feedback / `Sentry.captureFeedback` 経由 / mailto: 経由)

### 4.2 切り分け (5 分以内)

1. Sentry Issue を開く → スタックトレース + breadcrumb 確認 → 影響範囲 (1 user / 全体) を判定。
2. Vercel Deployments で直前 push の時刻を確認 (regression か否か)。
3. `/monitoring` tunnel route が機能しているか確認 (Sentry tunnel 経路 = `next.config.ts` 設定済)。

### 4.3 判断 (rollback or hotfix)

- 直前 push 起因 + SEV-1 / SEV-2 → **即 rollback** (§5 参照)。
- それ以外 → **hotfix** (§6 参照)。
- 判断に迷う場合は SEV-1 を優先し rollback を選ぶ (β ユーザー体験を最優先)。

### 4.4 実行

- §5 (Rollback) または §6 (Hotfix) の手順を進める。

### 4.5 事後

1. Sentry Issue を Resolved にマーク。
2. `decisions.md` に「§hotfix-YYYY-MM-DD」を追補:
   - 再発防止策
   - 影響範囲
   - 対応所要時間
3. β ユーザーへの通知判断:
   - SEV-1 のみ通知 (§8 のテンプレを使用)
   - SEV-2 以下は次回 weekly digest で要約

---

## 5. Vercel Rollback 手順

### 5.1 Vercel UI 経由 (推奨 / 1 分)

1. https://vercel.com/{org}/{project}/deployments を開く。
2. 直前の Production deployment (緑 status) を選択。
3. メニュー (`...`) → 「Promote to Production」をクリック。
4. 確認モーダルで Confirm。

### 5.2 Vercel CLI 経由 (UI 不調時 fallback)

```bash
npx vercel ls --prod
npx vercel promote {deployment-url} --scope={team}
```

- `{deployment-url}` は上の `npx vercel ls --prod` 出力から「直前安定版」を選ぶ。
- `--scope` は team プロジェクトの場合のみ必要。個人プロジェクトでは省略可。

### 5.3 注意事項

- DB migration を含む rollback は **drizzle が down migration を自動生成しない** ため、構造変更 (DROP COLUMN 等) を伴う場合は別途手動 SQL が必要。
- β 期間中は migration 0017 (W12-T3-A invite codes) が最新。今後 0018 以降で構造的変更を伴う migration を導入する際は本 §5.3 を必ず更新すること。
- DEC-013 により Vercel Pro 単一プラン前提。Hobby 分岐は構造的に存在しない。

---

## 6. Hotfix 手順

### 6.1 ローカル修正 → push

```bash
git checkout main && git pull
# 修正実装
npm run typecheck
npm run lint
npm run test
npm run e2e -- tests/e2e/admin-kpi.spec.ts tests/e2e/shop.spec.ts --workers=1
git add -p
git commit -m "hotfix: {対象 incident の概要}"
git push origin main
```

> 本 repo は `package-lock.json` 同梱 = npm 運用 (DEPLOYMENT.md と統一)。`npm run e2e -- ...` の `-- ` は playwright に追加引数を渡す慣用記法。

### 6.2 Vercel 自動 deploy

- main push で Production 自動 deploy が走る (`DEPLOYMENT.md` §8 既存 GitHub 連携)。
- 完了まで 2〜4 分。

### 6.3 確認

- Sentry に同じ Issue が再発生しないことを 30 分監視。
- β ユーザー側の症状が解消したことを feedback 経路で確認。
- 直近 Sentry breadcrumb で「同名スタックトレースが 0 件」を確認。

---

## 7. β 期間中の specific incident playbook

### 7.1 invite_codes redeem 競合 (DEC-069 known race / Minor 1)

- **症状**: 同一 invite code を複数ユーザーが同時 redeem。1 名は signup 完了、残りは孤児 user / family / consents として残留。
- **暫定対応**: Turso shell で孤児 user を DELETE (手順は `decisions.md` DEC-069 §F 参照)。
- **恒久対応**: Phase 3 候補 (signup action 内で全レコードを 1 transaction にまとめる構造改修)。

### 7.2 Sentry quota 超過 (Developer plan 5k errors/month)

- **症状**: Sentry が新規 event 受付を停止し、本番の error 観測が途絶える。
- **暫定対応**:
  1. Vercel Production env で `SENTRY_TRACES_SAMPLE_RATE=0` を設定し、深刻度 high のみ送信に切替。
  2. 必要なら `SENTRY_ENABLED=false` で全停止 (kill switch)。
  3. client 側は `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_ENABLED` を同様に調整。
  - 注: `replaysOnErrorSampleRate` は Sentry Replay = client (browser) 専用機能のため、server / edge 側に同等 env はない。
- **恒久対応**: Sentry Team plan ($26/月) 検討 (Phase 2 後半)。

### 7.3 OpenAI API 障害

- **症状**: AI コーチ応答が all timeout。
- **対応**:
  1. `gpt-4.1-mini` への fallback が AI SDK で自動切替 (DEC-003 で構造担保 / 既実装)。
  2. Sentry で `AI fallback triggered` breadcrumb 増加を監視。
  3. fallback も timeout する場合は §6 hotfix で OpenAI クライアント timeout を一時的に短縮し UX を保護。

---

## 8. SEV-1 incident 連絡テンプレ (β ユーザー向け / inline)

> 全 incident で送ると通知過多 → 学習意欲を損ねる懸念 → DEC-024 哲学に反する。
> SEV-1 のみ送信し、SEV-2 以下は次回 weekly digest で要約する。

### 件名

```
【HANEI】サービス障害のお知らせとお詫び
```

### 本文テンプレ

```
{お名前} さま

平素より HANEI をご利用いただきありがとうございます。

本日 {YYYY-MM-DD HH:MM JST} 頃から {影響範囲} で
ご不便をおかけする状況が発生しておりました。

現在は復旧しております / 復旧作業中です。

― 影響範囲: {例: ログイン / 学習画面の表示}
― 復旧時刻: {YYYY-MM-DD HH:MM JST 復旧 / 現在対応中}
― お子さまの学習データ: 失われておりません

ご迷惑をおかけし申し訳ございません。

HANEI 開発チーム
```

### 文面設計の補足

- 「お子さまの学習データは失われておりません」を必ず明記する (保護者の最大不安要素を先回り)。
- 「申し訳ございません」はマナー文言として許容 (DEC-024 が禁じる罰語ではない)。
- ユーザー側に責を帰す表現は使わない。

---

## 9. 関連ドキュメント

- `DEPLOYMENT.md` — 初回構築手順 / Vercel + Turso + R2 の設定。
- `projects/PRJ-016/docs/sentry-alert-setup.md` — Sentry プロジェクト UI で設定する alert ルール checklist。
- `projects/PRJ-016/docs/beta-invite-email-template.md` — β 招待メール本文テンプレ。
- `projects/PRJ-016/decisions.md` — DEC-071 (本 atomic) / DEC-070 / DEC-069 / DEC-024 / DEC-003 / DEC-006 / DEC-013 / DEC-055。

---

**End of HANEI RUNBOOK**
