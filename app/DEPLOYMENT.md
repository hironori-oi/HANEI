# HANEI - DEPLOYMENT.md

PRJ-016 HANEI の本番 / プレビュー環境構築手順 (W1 時点)。

## 1. 既存リソース (DEC-013)

- **Vercel**: 既存 Pro プラン ($20/月) で運用中。新規 Hobby プロジェクトは作成しない。
- **GitHub**: `improver-ai/hanei` (private) を W1 内に作成予定。
- **ドメイン**: `hanei.app` を取得予定 (Research TASK-B 確認待ち)。

## 2. 必要な外部サービス

| サービス | プラン | 月額 | 用途 |
|---------|-------|-----|------|
| Vercel | Pro | $20 | ホスティング |
| Turso | Free | $0 | DB (libSQL / 9GB / 1B reads) |
| Cloudflare R2 | Free | $0 | TTS 音声 + 画像 (egress 無料) |
| OpenAI | 従量 | 〜¥5,000 | gpt-5-mini + tts-1 + Moderation |
| Anthropic | 従量 | 〜¥1,000 | Claude Sonnet 4.5 (LLM-as-Judge) |
| Resend | Free | $0 | メール (3,000通/月まで) |
| Sentry | Developer | $0 | エラー監視 |

## 3. 環境変数チェックリスト

`.env.local.example` を `.env.local` にコピーして埋める。Vercel Dashboard でも同名で設定。

- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `TURSO_DATABASE_URL`
- [ ] `TURSO_AUTH_TOKEN`
- [ ] `BETTER_AUTH_SECRET` (32+ 文字 / `openssl rand -base64 32`)
- [ ] `BETTER_AUTH_URL`
- [ ] `OPENAI_API_KEY`
- [ ] `OPENAI_MODEL_PRIMARY=gpt-5-mini`
- [ ] `OPENAI_MODEL_FALLBACK=gpt-4.1-mini`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `R2_ACCOUNT_ID`
- [ ] `R2_ACCESS_KEY_ID`
- [ ] `R2_SECRET_ACCESS_KEY`
- [ ] `R2_BUCKET_NAME=hanei-audio`
- [ ] `R2_PUBLIC_URL`
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM_EMAIL=noreply@hanei.app`
- [ ] `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`

## 4. Turso DB 作成手順

```bash
# 1. Turso CLI インストール (https://docs.turso.tech/cli/installation)
curl -sSfL https://get.tur.so/install.sh | bash

# 2. ログイン
turso auth login

# 3. DB 作成 (リージョン: 東京 nrt)
turso db create hanei --location nrt

# 4. 接続情報を取得
turso db show hanei --url
turso db tokens create hanei

# -> .env.local に TURSO_DATABASE_URL / TURSO_AUTH_TOKEN を設定

# 5. マイグレーション実行
npm run db:generate    # schema.ts -> drizzle/migrations/
npm run db:migrate     # turso 上に適用
# または scaffolded SQL を直接適用
turso db shell hanei < drizzle/0000_initial.sql
```

## 5. R2 バケット作成手順

1. Cloudflare Dashboard -> R2 -> Create Bucket
2. Bucket name: `hanei-audio` (環境ごとに `-dev` `-prod` サフィックス)
3. Custom Domain or Public URL を発行 (`pub-xxxxx.r2.dev`)
4. R2 -> Manage R2 API Tokens -> Create API Token
   - Permission: Object Read & Write
   - Specific bucket: `hanei-audio`
5. 発行された Access Key / Secret を `.env.local` の `R2_*` に設定

## 6. Better Auth Secret 生成

```bash
# 32 バイト以上のランダム文字列を生成
openssl rand -base64 32
# または node:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`BETTER_AUTH_SECRET` に設定。**本番と開発で別の値を使う**。

## 7. OpenAI / Anthropic / Resend キー取得

- OpenAI: https://platform.openai.com/api-keys -> "Create new secret key"
- Anthropic: https://console.anthropic.com/settings/keys
- Resend: https://resend.com/api-keys (送信元ドメイン認証要)

## 8. Vercel デプロイ手順 (既存 Pro プロジェクト)

```bash
# 1. Vercel CLI で既存プロジェクトに紐付け
npm i -g vercel
vercel link
# Project: improver-ai/hanei を選択

# 2. プレビュー deploy
vercel

# 3. 本番 deploy (main ブランチ push で自動)
vercel --prod
```

GitHub 連携を Vercel で有効化:
- main -> Production
- develop -> Preview

## 9. CI/CD

- GitHub Actions: `.github/workflows/ci.yml`
- ジョブ: lint-typecheck / test (with coverage) / build / e2e (Playwright) / lighthouse
- main / develop / pull_request で全部走る

## 10. 監視

- Sentry: `npx @sentry/wizard@latest -i nextjs` で設定 (W2 で実施)
- Vercel Analytics + Speed Insights: layout.tsx に component 配置 (W2)

## 11. ロールバック手順

1. Vercel Dashboard -> Deployments -> 直前の successful build を選択 -> Promote
2. DB マイグレーションのロールバックは drizzle が自動生成しないため、手動 SQL で対応

## 12. クローズドβ移行チェック (W10)

- [ ] 本番 Turso DB に問題プール 1,600 問 投入完了
- [ ] AI コーチ POC で kid-safe 4.0+ 達成
- [ ] Lighthouse a11y = 100
- [ ] 認可漏れ E2E 5本 PASS
- [ ] 13歳未満同意フロー E2E PASS
