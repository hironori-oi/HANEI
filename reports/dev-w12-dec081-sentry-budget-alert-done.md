# Dev Report: DEC-081 β 開始前必須 2 項目 atomic 完遂報告

PRJ-016 HANEI / Phase 3 第 1 波 / W12-T6 (DEC-081)
2026-05-05 / 担当: dev sub-agent / 委任元: CEO

---

## 1. 実装サマリ

DEC-081「β 開始前必須 2 項目 atomic（Sentry 実発火必須化 + 月次予算 alert / 0.7 人日）」を完遂。
β 開始 19 項目判定 RED 5 件のうち 2 件（Sentry 実発火 / 月次予算 alert）を構造的に GREEN 化。

### 新規ファイル (4 件)

| ファイル | 行数 | 役割 |
|---|---|---|
| `app/src/app/api/cron/monthly-budget-alert/route.ts` | 132 | 月次予算 alert cron route (毎日 09:00 JST) |
| `app/src/app/api/admin/sentry-test/route.ts` | 64 | 故意発火 admin endpoint (β 前 smoke 用) |
| `app/tests/unit/cron.monthly-budget-alert.test.ts` | 196 | cron route unit test (12 cases) |
| `app/tests/unit/admin.sentry-test.test.ts` | 165 | admin endpoint unit test (9 cases) |

### 変更ファイル (2 件)

| ファイル | 変更内容 |
|---|---|
| `app/vercel.json` | cron `/api/cron/monthly-budget-alert` schedule `0 0 * * *` 追加 + functions maxDuration 60 追加 |
| `docs/sentry-alert-setup.md` | § 7-9 追記（故意発火手順 + Rule 5 月次予算 alert + β 開始前 6 step オーナーチェックリスト） |

---

## 2. 検証結果

| 項目 | 結果 |
|---|---|
| `bun run typecheck` | **PASS** (warning 0) |
| `bun run lint` | **PASS** (warning 0) |
| `bun run test` | **902 PASS / 60 files** (baseline 881 → +21 / regression 0) |
| `bun run build` | **PASS** (page 25 / cron 5 / api/admin 1 / api/auth 1 / api/ai 1 認識) |

### 新規 unit test 内訳 (合計 21 cases)

#### `cron.monthly-budget-alert.test.ts` (12 cases)

- 認可 4 cases
  - x-vercel-cron-signature あり → 200 + alerted=false
  - Authorization: Bearer <CRON_SECRET> あり → 200 + alerted=false
  - 両方なし → 401
  - CRON_SECRET 不一致 → 401
- 閾値判定 5 cases (default budget ¥3,000)
  - ¥0 → no alert / Sentry 未呼出
  - ¥2,399 (79.97%) → no alert / Sentry 未呼出
  - ¥2,400 (80.0%) → severity=warning / Sentry captureMessage 呼出
  - ¥3,000 (100.0%) → severity=error / message に severity=error
  - ¥3,600 (120.0%) → severity=fatal / message に severity=fatal
- env 上書き 2 cases
  - MONTHLY_BUDGET_JPY=5000 で current=¥4,000 (80%) → warning alert
  - NaN / 0 / 負値 → default 3000 fallback
- DB error 吸収 1 case
  - DB select throw → 200 + alerted=false / Sentry captureException 呼出 (DEC-068 精神)

#### `admin.sentry-test.test.ts` (9 cases)

- 認可 4 cases
  - admin role → 200 + Sentry capture 呼出
  - parent role → 401 / Sentry 未呼出
  - learner role → 401 / Sentry 未呼出
  - unauthenticated → 401 / Sentry 未呼出
- level クエリ 5 cases
  - level=warning → captureMessage(warning) + captureException 双方呼出
  - level=error → captureException のみ呼出
  - level=fatal → captureException のみ呼出
  - level=invalid → default error 扱い
  - level クエリなし → default error 扱い

---

## 3. DEC-006 再拡張版 数値遵守

| 項目 | 上限 | 着手前 | 完遂後 | 差分 |
|---|---|---|---|---|
| **page routes** | 32 | 25 | **25** | **+0 (不変)** |
| **mutation (Server Action)** | 10 | 9 | **9** | **+0 (不変)** |
| **GET handler** | 15 | 11 | **12** | **+1 (admin/sentry-test 新規)** |
| **cron route** | (上限なし) | 4 | **5** | **+1 (monthly-budget-alert 新規)** |

DEC-081 の §スコープ宣言と完全一致。GET margin 3 / page margin 7 / mutation margin 1 すべて上限内。

---

## 4. 制約遵守確認

- [x] **DEC-024 罰則ゼロ哲学**: admin / cron 専用 / user-facing 文言なし / 罰語 grep 0 件
  (cron route + admin endpoint + runbook + unit test 全件 / 「罰則ゼロ哲学」自体は DEC-024 名称引用のため除外規定通り)
- [x] **DEC-003 三層認可**:
  - cron: 第一層 = `x-vercel-cron-signature` / 第二層 = Bearer CRON_SECRET fallback / 第三層 = 全体集計のみ (個別 row 非露出)
  - admin endpoint: 第一層 = middleware / 第二層 = `getSession()` で role === "admin" 検証 / 第三層 = side-effect ゼロ
- [x] **DEC-006 再拡張版**: page 25/32 不変 / mutation 9/10 不変 / GET 11→12/15 (+1) / cron 4→5 (+1)
- [x] **DEC-055 冪等性**:
  - cron: DB write 0 / snapshot 評価のみ / Sentry message 重複は fingerprint で集約
  - admin endpoint: side-effect ゼロ / 何度叩いても DB 不変
- [x] **DEC-068 per-row fail-soft 精神**:
  - cron: 1 query 失敗時 try/catch で 200 + alerted=false 返却 + Sentry captureException
  - Sentry capture 自体の失敗も二重 try/catch で console fallback
- [x] **DEC-076 / DEC-078 SQL aggregate-only**: cost-guard.ts と同パターン (`COALESCE(SUM(cost_jpy), 0)`)
- [x] **罰語 grep 0 件** (cron route + admin endpoint + runbook § 7-9 + unit test 2 ファイル)
- [x] **既存 vitest 881 PASS regression 0** (881 → 902 / +21 / 既存 60 files PASS 維持)

---

## 5. オーナー実行手順 (β 開始前必須 6 step / runbook § 9 と一致)

`docs/sentry-alert-setup.md` § 9 と同内容。所要時間目安 **20〜25 分**。

- [ ] **Rule 1〜4** (§ 2〜§ 5) を Sentry UI で設定 (10〜15 分)
- [ ] **Rule 5** (§ 8 / 月次予算 alert) を Sentry UI で設定 (5 分)
- [ ] Vercel Production env `MONTHLY_BUDGET_JPY=3000` 設定確認 (§ 6 + § 8)
- [ ] `/api/admin/sentry-test?level=error` で 1 回故意発火 (§ 7)
- [ ] Sentry email 到達確認 + issue resolve (§ 7 step 4-5)
- [ ] β 実子使用開始 GO 報告 (CEO 経由)

---

## 6. 環境変数追加 (Vercel Production env)

| 変数名 | 値 | 必須? | 用途 |
|---|---|---|---|
| `MONTHLY_BUDGET_JPY` | `3000` | 推奨 (未設定時は default 3000) | 月次予算 alert 閾値 (¥) / 80%/100%/120% で 3 段階 alert |

既存 `CRON_SECRET` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` 等は変更不要。
変更時は Vercel env 更新のみで閾値変動 (コード変更不要)。

---

## 7. Sentry UI 設定追加 (Rule 5 / 新規)

`docs/sentry-alert-setup.md` § 8 を参照。Sentry Issue Alert として以下を新規作成。

| 項目 | 設定値 |
|---|---|
| Alert 名 | HANEI - Monthly Budget Alert |
| Trigger | `When` `event.message` contains `monthly budget alert` |
| Filter | `event.environment` equals `production` AND `event.level` equals `warning` or `error` or `fatal` |
| Action | Send a notification to email |

severity 情報 (warning / error / fatal) は Sentry message 本文に
`severity=<level>` の形で埋まっており、UI 側で grep / filter 可能。
SDK level は `warning` 固定だが、message 本文の `severity=` を参照すれば
3 段階を Sentry UI 上で区別できる。

---

## 8. § 7 確認事項 / § 8 ブロッカー (なし)

- 既知の懸念事項なし。
- 既存 cron pattern (streak-freeze-monthly / study-minutes-reminder) と完全同パターンの認可 + 構造で実装。
- E2E spec は書いていない (cron + admin = 通常 user 経路でない / unit test 21 cases で十分 / DEC-081 §効率化指示通り)。
- Sentry SDK level enum 制約 (warning が最大) のため、severity=error / fatal は SDK 側 level=warning 固定で
  message 本文に `severity=` を埋めて UI 側で区別する方式を採用 (runbook § 8 で明示)。
- `requireAdmin()` は redirect 型のため API route で使えず、本 endpoint では `getSession()` を直接呼んで
  role === "admin" を検証 + 401 JSON 返却する方式を採用 (DEC-003 三層認可第二層を維持)。

---

## 9. 参照ファイル

- DEC-081 entry: `projects/PRJ-016/decisions.md` (冒頭 / 69 行 / commit 8f8695b 起票直後)
- 既存 cron pattern (DEC-068 / DEC-078 継承元):
  - `app/src/app/api/cron/streak-freeze-monthly/route.ts`
  - `app/src/app/api/cron/study-minutes-reminder/route.ts`
- 既存 SQL aggregate pattern: `app/src/lib/ai/cost-guard.ts`
- 既存 Sentry mock pattern: `app/tests/unit/feedback.submit.test.ts`
- 既存 DB mock pattern: `app/tests/unit/ai.cost-guard.test.ts` / `app/tests/unit/auth.guards.test.ts`
- runbook: `projects/PRJ-016/docs/sentry-alert-setup.md` (§ 7-9 追記済)

---

## 10. trust-but-verify 用コマンド

CEO 側で以下を順次実行して受入確認:

```bash
cd C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-016/app
bun run typecheck    # PASS / warning 0
bun run lint         # PASS / warning 0
bun run test         # 902 PASS / regression 0
bun run build        # PASS / page 25 不変 / cron 5 / api/admin/sentry-test 認識
```

---

## 11. commit 提案 (CEO 側で trust-but-verify 後に実行)

```
feat(prj-016): DEC-081 β 開始前必須 2 項目 atomic 完遂 (Sentry 実発火 + 月次予算 alert)

- 月次予算 alert cron route 新規 (api/cron/monthly-budget-alert / 0 0 * * * UTC = 09:00 JST)
- 故意発火 admin endpoint 新規 (api/admin/sentry-test / GET / admin role 専用)
- vercel.json cron 4 → 5 / functions maxDuration 60 追加
- runbook § 7-9 追記 (故意発火手順 + Rule 5 + β 開始前 6 step チェックリスト)
- unit test 21 cases 追加 (cron 12 + admin 9 / 902 PASS / regression 0)

DEC-006 再拡張版数値: page 25/32 (不変) / mutation 9/10 (不変)
                     / GET 11→12/15 (+1) / cron 4→5 (+1)
DEC-024 罰則ゼロ哲学 / DEC-003 三層認可 / DEC-055 冪等性 / DEC-068 fail-soft 全準拠
```

---

**End of Dev Report (DEC-081 β 開始前必須 2 項目 atomic / W12-T6)**
