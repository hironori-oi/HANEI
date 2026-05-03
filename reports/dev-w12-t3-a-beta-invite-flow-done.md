# PRJ-016 HANEI - W12-T3-A β invite flow（招待コード生成 + redeem 動線）完遂報告

- 案件: PRJ-016 HANEI
- atomic: Phase 2 W12-T3-A (= 0.5 人日 / W12-T3 を 3 atomic に分解した第 1 弾)
- 根拠 DEC: DEC-069 (本 atomic) / DEC-068 / DEC-067 / DEC-066 / DEC-065 / DEC-024 / DEC-003 / DEC-006 / DEC-055
- 完遂日: 2026-05-03
- HEAD (HANEI repo): `bfd2c55..eea5448`

## 概要

β 受入準備の最初のインフラ = 招待コード基盤を最小構成で構築。CLI で運営者が招待コードを発行し、signup フローで `BETA_INVITE_REQUIRED=true` のときのみ invite_code を必須化、race-safe な atomic UPDATE で redeem する。dev/staging/E2E は env 未設定 default で既存挙動完全維持（regression 0）。

## 実装内容

### 1. DB schema（migration 0017）

`app/drizzle/0017_w12_beta_invite.sql` (新規 / 52 行):

- `beta_invite_codes` テーブル新設
  - `id` (TEXT PK / `bic_${uuid}` 形式) / `code` (TEXT / unique) / `created_by` / `note` / `max_redemptions` (INT default 1) / `redemption_count` (INT default 0) / `expires_at` / `disabled_at` / `created_at` (ms epoch)
  - 個人特定要素ゼロ（DEC-003 第三層 = テーブル設計時点で構造排除）
- `users.beta_invited_by_code` (TEXT nullable) 追加
  - 履歴記録のみ / FK 不要（コード削除耐性）
- index: `code_idx` (unique) + `active_idx` (`disabled_at`, `expires_at`)

`app/src/lib/db/schema.ts` の Drizzle スキーマも対応追記 + 型 export `BetaInviteCode`。

### 2. 純関数 lib（Turbopack `"use server"` sync export ban / 9 度目構造定着）

`app/src/lib/beta/invite-codes.ts` (新規 / 137 行 / DOM-free / DB-free / `"use server"` 不在):

- `INVITE_CODE_LENGTH = 8` / `INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"` (`0/O/1/I/L` 除外で配布誤読防止)
- `normalizeInviteCode(input: unknown): string` — trim + 内部空白除去 (`\u3000` 全角含む) + uppercase / 非文字列耐性
- `validateInviteCodeFormat(code): { ok: true } | { ok: false; reason: "empty" | "length" | "alphabet" }` — DB-free で早期 fail
- `generateInviteCode(): string` — `node:crypto.randomBytes` + rejection sampling (threshold=248) で一様分布 / Math.random 不使用
- `isBetaInviteRequired(): boolean` — `process.env.BETA_INVITE_REQUIRED === "true"` の厳格判定（`"1"` / `"yes"` 不可）

### 3. signup action 改修（既存最大流用 / 新規 mutation 0）

`app/src/app/(auth)/signup/actions.ts` (修正 / 211 行):

- 入力 schema に `invite_code` (optional) 追加
- **user 作成より前** に invite check を実行:
  1. `normalizeInviteCode` で正規化
  2. `validateInviteCodeFormat` 形式検証 → fail = `?error=invite_invalid` redirect
  3. DB SELECT (`beta_invite_codes.code = ?`) → 不在 = `?error=invite_not_found`
  4. `disabled_at` あり = `?error=invite_disabled`
  5. `expires_at < now` = `?error=invite_expired`
  6. `redemption_count >= max_redemptions` = `?error=invite_full`
- user 作成 (Better Auth `auth.api.signUpEmail`) → families → family_members → parent_consents の既存フロー維持
- **redeem は user 作成後 / `db.transaction` 内で atomic UPDATE**（DEC-055 厳守）:
  ```ts
  await tx.update(betaInviteCodes)
    .set({ redemptionCount: sql`${betaInviteCodes.redemptionCount} + 1` })
    .where(and(eq(betaInviteCodes.id, inviteId),
               lt(betaInviteCodes.redemptionCount, betaInviteCodes.maxRedemptions)))
    .returning({ id: betaInviteCodes.id });
  ```
  - 0 行 update = race で他 client に先取りされた → `?error=invite_full` redirect
  - 成功 = `users.beta_invited_by_code` に code 文字列を記録（FK 不要 / 履歴のみ）
- 最終 `/verify-email` redirect は既存挙動維持

### 4. signup UI（条件付きレンダリング）

`app/src/app/(auth)/signup/page.tsx` (修正):

- `isBetaInviteRequired()` が `true` のときのみ invite_code Input を表示（Server Component で server side 判定）
- `data-testid="invite-code-input"` 付与（E2E から fill しやすく）
- ERROR_MESSAGES に 5 件追加（全て中立文言 / DEC-024 罰則ゼロ厳守）:
  - `invite_invalid`: 「招待コードを確認してください」
  - `invite_not_found`: 「招待コードを確認してください」
  - `invite_disabled`: 「ご利用いただけない招待コードです」
  - `invite_expired`: 「招待コードの有効期限が切れています」
  - `invite_full`: 「この招待コードの上限に達しました」

### 5. CLI 発行 script（運営者ローカル実行）

`app/scripts/generate-beta-invite.ts` (新規 / 156 行):

- `bun run scripts/generate-beta-invite.ts --count=N --note=... --max=N --expires=YYYY-MM-DD`
- 暗号学的乱数で N 件生成 → DB INSERT → TSV stdout（`code\tid\tnote\texpires_at`）
- TURSO 接続: `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` / `file:./local.db` フォールバック
- 衝突時は再生成（unique index で構造担保）

### 6. env flag pass-through（既存 E2E regression 0 担保）

`app/playwright.config.ts` (修正):

- `BETA_INVITE_REQUIRED === "true"` のときのみ `webServer.env` に pass-through
- 未設定時 = invite_code Input 非表示 = 既存 signup spec 影響ゼロ

### 7. db-fixture 拡張

`app/tests/e2e/fixtures/db-fixture.ts` (修正):

- migrations 配列に `0017_w12_beta_invite.sql` 追加
- truncation list に `beta_invite_codes` 追加（worker 並列 seed 衝突回避）

## テスト

### unit (vitest)

`app/tests/unit/beta.invite-codes.test.ts` (新規 / 174 行 / 17+ test cases):

- `normalizeInviteCode`: 4 cases (基本 / タブ改行全角 / 既正規化 / 非文字列耐性)
- `validateInviteCodeFormat`: 8 cases (正常 / empty / length 7 / length 9 / 0 / O / 小文字 / ハイフン)
- `generateInviteCode`: 4 cases (length / alphabet 適合 / 排他文字 0 / 衝突 0 @ 500 件)
- `isBetaInviteRequired`: 4 cases (未設定 / true / false / "1"/"yes" 厳格化)

**vitest 結果**: 54 files / **835 PASS** (baseline 53/801 → +17 追加 / regression 0)

### E2E (Playwright)

`app/tests/e2e/signup-beta-invite.spec.ts` (新規 / 316 行):

- `test.describe.configure({ mode: "serial" })` — SQLite worker 並列回避
- `test.beforeEach` で `BETA_INVITE_REQUIRED !== "true"` なら `test.skip` (env 未設定での既存 E2E 巻き込み防止)
- 4 spec × 2 browsers (chromium + mobile-chrome) = 8 PASS:
  1. 正常 redeem: 有効 code → `/verify-email` 遷移 + DB 検証 (`redemption_count=1` / `users.beta_invited_by_code = code`)
  2. 不正 code: `AB0DEFG1` (除外文字 `0`) → `?error=invite_invalid` + 中立文言検証
  3. 上限到達: pre-seed `redemption_count=max_redemptions=1` → `?error=invite_full` + 中立文言検証
  4. 期限切れ: pre-seed `expires_at = now - 1h` → `?error=invite_expired` + DB 検証 (`redemption_count` は 0 のまま = UPDATE 不発)
- `[role="alert"]:not(#__next-route-announcer__)` で Next.js hidden alert 衝突回避

**E2E 結果**:
- signup-beta-invite (BETA_INVITE_REQUIRED=true): **8 PASS** (33.3s)
- 既存 E2E regression (env なし / admin-kpi 4 + admin-kpi-experiment 2 + shop 6): **12 PASS** (48.6s)

## 検証通過

| 項目 | 結果 | baseline 比 |
|------|------|-------------|
| typecheck | 0 errors | 維持 |
| lint | 0 warnings | 維持 |
| vitest | 54 files / 835 PASS | 53/801 → +1 file / +34 件 (うち 17+ が DEC-069) |
| next build | 25 routes | 不変 (DEC-006 GET 10 / mutation 5 厳守) |
| E2E signup-beta-invite | 8 PASS | 新規 |
| E2E regression | 12 PASS | 維持 (regression 0) |

## DEC 厳守確認

- **DEC-024 罰則ゼロ**: 5 エラー全て中立文言 / 「無効です」「不正です」不在
- **DEC-003 三層認可**: middleware (signup 公開) / server action (invite check) / DB 個人特定要素 0
- **DEC-006 GET 10 / mutation 5 不変**: 新規 route 0 / 新規 mutation 0 / 既存 signup action に追記のみ
- **DEC-055 idempotency**: race-safe atomic UPDATE `WHERE redemption_count < max_redemptions` + transaction で構造担保
- **Turbopack `"use server"` sync export ban (9 度目)**: `src/lib/beta/invite-codes.ts` 純関数隔離

## 既知の Minor / 持ち越し（review 部門指摘）

- **M-1**: race-loss redeem 時の孤児 user/family/consents（DEC-069 §F で T3-C スコープ外と既明示 / W13 以降 backlog）
- **M-2**: doc コメント path 揺れ（`scripts/beta-invite-issue.ts` 表記 → 実装 `scripts/generate-beta-invite.ts`）
- **M-3**: `require("node:crypto")` ESM 化検討（Next.js 16 server-only 確定後）
- **N-1**: `validateInviteCodeFormat` シグネチャ unknown 統一
- **N-2**: page.tsx `autoCapitalize="characters"` 追加（モバイル UX 改善）

→ Critical/Major 0 / Minor 3 + Nit 2 = APPROVE 判定でマージ。

## β 運営インフラ完備

これにより β 招待運営の最小構成が完成:
- 運営者 = CLI で N 件発行 → 配布
- ユーザー = signup 画面で invite_code 入力 → atomic redeem → /verify-email
- 構造的に二重 redeem / 上限超過 0 / 既存 dev/staging/E2E に regression 0

## 次 atomic（CEO 推奨）

- **W12-T3-B**: β ユーザー feedback 収集動線（0.5 人日 / P0）
- **W12-T3-C**: 緊急 hotfix 体制 + Sentry 強化 + α→β 移行アナウンス（0.5 人日 / P0）
- **W12-T4**: ストレステスト + Sentry alert 設定（0.5 人日 / P1）
- **W11 KPT**: 並行可 / 0.25 人日
