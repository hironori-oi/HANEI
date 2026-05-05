# Sentry Alert 設定 checklist (運営者向け)

> PRJ-016 HANEI / W12-T3-C (DEC-071) で起草した、Sentry プロジェクト UI で設定すべき alert ルールの checklist。
> コード側の env 化は本 atomic で完了済 (`sentry.{client,server,edge}.config.ts`)。
> **本ファイルに記載した手順は Sentry プロジェクト UI で人間 (オーナー) が実施する範囲**。コード対象外。

---

## 0. 前提

- Sentry プロジェクト: HANEI (DSN は `NEXT_PUBLIC_SENTRY_DSN` env 経由でコードに渡し済)。
- 通知先: オーナー個人 email (Sentry プロフィールに登録済の email を使用)。
- 設定手順は Sentry の UI 操作で完結する (CLI 操作不要)。
- 設定所要時間: 4 ルール合計で 10〜15 分程度。

---

## 1. 共通設定 (Alerts ページ to do)

1. Sentry にログインし、HANEI プロジェクトを選択。
2. 左サイドバー `Alerts` → `Create Alert Rule` を開く。
3. 各ルールごとに「Issue Alert」または「Metric Alert」のいずれかを選ぶ (本書では Issue Alert ベースの 4 ルールを推奨)。

---

## 2. Rule 1: Error Event Spike (短時間集中検知)

| 項目 | 設定値 |
|---|---|
| Alert 名 | HANEI - Error Event Spike |
| Trigger | `When` Number of events in an issue is more than `5` in `5 minutes` |
| Filter | `event.environment` equals `production` |
| Action | Send a notification to email (オーナー個人アドレス) |

- **狙い**: 個別 user の偶発エラー (1 件) は無視 / 同一 issue が 5 件超で「広範囲影響」と判定。
- **β 規模感**: 30〜50 家庭規模では 5 件 = 全ユーザー 10〜17% 該当 = SEV-1 級。

---

## 3. Rule 2: New Issue Detected (新規 fingerprint)

| 項目 | 設定値 |
|---|---|
| Alert 名 | HANEI - New Issue Detected |
| Trigger | `A new issue is created` |
| Filter | `event.environment` equals `production` AND `event.level` equals `error` or `fatal` |
| Action | Send a notification to email |

- **狙い**: 既知 issue は §2 spike rule で十分。新規 fingerprint = 「直前 push or β 利用拡大で表面化した未知の経路」を即検知。

---

## 4. Rule 3: Regression Detected (resolved → unresolved)

| 項目 | 設定値 |
|---|---|
| Alert 名 | HANEI - Regression Detected |
| Trigger | `An issue changes state from resolved to unresolved` |
| Filter | `event.environment` equals `production` |
| Action | Send a notification to email |

- **狙い**: 一度 resolve したものが再発 = hotfix 不完全 / 別経路から同症状 = SEV-2 級として早期気づき。

---

## 5. Rule 4: User Feedback Received (DEC-070 連動)

| 項目 | 設定値 |
|---|---|
| Alert 名 | HANEI - User Feedback Received |
| Trigger | `A new user feedback is received` (Sentry SDK 8+ の user_feedback envelope) |
| Filter | `event.environment` equals `production` |
| Action | Send a notification to email |

- **狙い**: T3-B (DEC-070) で feedback button 経由ユーザーが「ご意見」送信した瞬間にオーナーへ通知 → 24h 以内返信運用が可能。
- **β 規模感**: 30〜50 家庭規模なら手動運用で十分対応可。

---

## 6. Vercel Production env チェックリスト

Sentry alert ルールが正しく機能するためには、Vercel Production 側の env も整えておく必要がある。以下を `Settings → Environment Variables → Production` で確認:

- [ ] `NEXT_PUBLIC_SENTRY_DSN` = Sentry プロジェクトの DSN (`https://...@sentry.io/...`)。
- [ ] `SENTRY_AUTH_TOKEN` = Sentry プロジェクトで発行した auth token (source map upload 用 / `next.config.ts` の `withSentryConfig` が build 時に参照)。
- [ ] `SENTRY_ORG` = Sentry の organization slug。
- [ ] `SENTRY_PROJECT` = `hanei`。
- [ ] `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (任意 / 未設定時 default `0.1`)。
- [ ] `NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` (任意 / 未設定時 default `1.0`)。
- [ ] `NEXT_PUBLIC_SENTRY_ENABLED` (任意 / 未設定時 default `true` / 緊急時の kill switch)。
- [ ] `SENTRY_TRACES_SAMPLE_RATE` (任意 / server / edge 用 / default `0.1`)。
- [ ] `SENTRY_ENABLED` (任意 / server / edge 用 / default `true`)。

---

## 7. 通知先 email の設定

1. Sentry 右上のアバター → `User Settings` → `Notifications`。
2. `Email` チェックを ON に設定し、配信先アドレスがオーナー個人 email であることを確認。
3. プロジェクト単位で別 email にしたい場合は、`Project Settings → Alerts → Notification Settings` で個別指定。

---

## 8. 動作確認 (任意 / 後続 W12-T4 stress test atomic で実施推奨)

- ローカルで `Sentry.captureException(new Error("test"))` を 6 回連続で送信し、Rule 1 が email を発火するか確認。
- 一度 resolve した issue を再度 trigger して Rule 3 (regression) を確認。
- Feedback button から実テストを送信し、Rule 4 を確認。

---

## 9. 関連ドキュメント

- `app/RUNBOOK.md` §7.2 Sentry quota 超過時の対処。
- `app/sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` (env 化済)。
- `decisions.md` DEC-071 / DEC-070 / DEC-069。

---

**End of Sentry Alert 設定 checklist**
