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

## 9. 関連ドキュメント (継続)

- `app/RUNBOOK.md` §7.2 Sentry quota 超過時の対処。
- `app/sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` (env 化済)。
- `decisions.md` DEC-071 / DEC-070 / DEC-069 / DEC-081。

---

> 以下 § 7〜§ 9 は DEC-081 (β 開始前必須 atomic) で追記。
> Sentry alert ルール 4 件 (§ 2〜§ 5) に「故意発火による実発火確認」「月次予算 alert」「β 開始前 6 step オーナーチェックリスト」を補強する。

---

## 7. 故意発火による実発火確認手順 (β 開始前必須 / DEC-081)

DEC-081 で新設した admin endpoint `GET /api/admin/sentry-test` を使い、Sentry alert ルールが
実環境で「Sentry → email」まで通電するかを 1 回だけ確認する。**β 実子使用開始前に必ず実施**。

5 step オーナー作業:

1. **Vercel Production deploy 完了確認**
   - 本 atomic を含む commit が Production environment に反映されたことを Vercel ダッシュボードで確認。
   - `MONTHLY_BUDGET_JPY` env が Production に設定済 (§ 8 参照) であることも併せて確認。

2. **オーナーが admin role でログイン**
   - 既存 admin user (Better Auth 上で `role = "admin"` 付与済) でログイン。
   - parent / learner role では 401 が返るため admin である必要がある。

3. **`/api/admin/sentry-test?level=error` を 1 回叩く**
   - ブラウザで `https://<production-url>/api/admin/sentry-test?level=error` を開く、または
     `curl https://<production-url>/api/admin/sentry-test?level=error -H "Cookie: <session>"` を実行。
   - 200 OK + `{ ok: true, level: "error", capturedAt: "<ISO>" }` を確認。

4. **Sentry UI で issue 出現 + email 到達確認**
   - Sentry ダッシュボード (HANEI プロジェクト / Issues タブ) を開き、
     `[sentry-test] level=error at ...` という issue が **30 秒以内** に表示されることを確認。
   - 登録 email アドレス (§ 7 通知設定) に Sentry からの通知メールが届くことを確認。

5. **issue を Resolve して β 開始 GO 報告**
   - 上記 issue を Sentry UI で `Resolve` ボタンを押して resolve 状態にする
     (本番運用時の「初回 issue 残留」を防止)。
   - β 実子使用開始 GO 判定要請を CEO に報告。

**注意**:
- `?level=warning` でも `?level=fatal` でも同手順で発火可能。3 段階それぞれ叩けば
  Rule 1〜Rule 5 全 5 ルールの alert ルートを一気に検証できる
  (ただし Rule 1 = Error Event Spike は 5 件超で発火するため、smoke では Rule 2 / Rule 5 中心に確認)。
- 本 endpoint は `getSession()` で role === "admin" を直接検証する API route であり、
  parent / learner / unauthenticated は 401 で弾かれる (DEC-003 三層認可第二層 / DEC-081)。
- side-effect ゼロ (DB write 0 / Sentry capture のみ) のため、何度叩いても DB 状態は変わらない (DEC-055 冪等性)。

---

## 8. Rule 5: Monthly Budget Alert (新規 / DEC-081)

DEC-081 で新設した cron route `GET /api/cron/monthly-budget-alert` (毎日 UTC 00:00 = JST 09:00) が
当月の `ai_coach_messages.cost_jpy` 合計を集計し、`MONTHLY_BUDGET_JPY` env (default ¥3,000) の
**80% (¥2,400) / 100% (¥3,000) / 120% (¥3,600)** いずれかを越えた瞬間に Sentry にメッセージを送る。

| 項目 | 設定値 |
|---|---|
| Alert 名 | HANEI - Monthly Budget Alert |
| Trigger | `When` `event.message` contains `monthly budget alert` |
| Filter | `event.environment` equals `production` AND `event.level` equals `warning` or `error` or `fatal` |
| Action | Send a notification to email |

- **狙い**: cron が ¥2,400 (80%) / ¥3,000 (100%) / ¥3,600 (120%) のいずれかを越えた瞬間にオーナーへ通知。
  severity 情報 (warning / error / fatal) は Sentry message 本文に
  `severity=<level>` の形で埋まっており、UI 側で grep / filter 可能。
- **env 設定**: Vercel Production env に `MONTHLY_BUDGET_JPY=3000` を追加
  (変更時は env 更新のみで閾値変動 / コード変更不要)。
- **Sentry capture level**: SDK level は `warning` 固定だが、message 本文の `severity=` を参照すれば
  3 段階を Sentry UI 上で区別可能。1 query / SQL aggregate-only / DEC-076・DEC-078 継承。

---

## 9. β 開始前 6 step オーナーチェックリスト (DEC-081)

β 実子使用開始前に以下 6 項目をオーナー本人が実施し、Sentry → email 通電を確認する。

- [ ] Rule 1〜4 (§ 2〜§ 5) を Sentry UI で設定 (10〜15 分)
- [ ] Rule 5 (§ 8) を Sentry UI で設定 (5 分)
- [ ] Vercel Production env `MONTHLY_BUDGET_JPY=3000` 設定確認 (§ 6 + § 8)
- [ ] `/api/admin/sentry-test?level=error` で 1 回故意発火 (§ 7)
- [ ] Sentry email 到達確認 + issue resolve (§ 7 step 4-5)
- [ ] β 実子使用開始 GO 報告 (CEO 経由)

合計所要時間目安: **20〜25 分**。

---

**End of Sentry Alert 設定 checklist**
