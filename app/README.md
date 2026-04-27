# PRJ-016 HANEI - Application Source (`app/`)

> 半年で英検3級。AIコーチと、毎日いっしょに。

## 実体配置・管理方式

このディレクトリ (`projects/PRJ-016/app/`) は HANEI Web アプリケーションの実体です (`organization/rules/project-setup-checklist.md` 最優先ルール準拠)。

- 単一実体 (Web アプリのみ。モバイルは Phase 2 以降検討)
- 物理配置 (submodule や junction は使用していない)
- W1 時点では手動 scaffold (npx create-next-app は実行できない環境のため)

## 技術スタック (DEC-003 / DEC-013 改訂版)

- Next.js 16 (App Router) + TypeScript strict
- Tailwind v4 + shadcn/ui (button / card / input / label を手動配置) + Heroicons
- Turso (libSQL) + Drizzle ORM
- Better Auth (Drizzle adapter / family role)
- Cloudflare R2 (egress 無料 / TTS 音声 + 画像)
- AI SDK + OpenAI gpt-5-mini (主軸) / gpt-4.1-mini (フォールバック)
- OpenAI Moderation API (三重ガード Layer 2)
- OpenAI tts-1 (バルク事前生成 + R2 cache)
- Resend / Sentry / Vercel Analytics
- Vercel Pro (DEC-013: 既存 Pro 運用継続)

## 制約・方針

- **無料アプリ前提 (DEC-012)**: Stripe 等の課金関連コードは存在しません
- 絵文字禁止 (UI / コード / コミット / コピー全て)
- アイコンは Heroicons 24/outline ベース
- TypeScript strict、any ゼロ
- shadcn/ui 追加コンポーネントは原則新規 install せず src/components/ui/ に手書き配置

## ディレクトリ構成 (W1)

```
app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # signup / login (route group)
│   │   ├── (app)/home/         # ログイン後ホーム
│   │   ├── onboarding/learner/ # 子プロフィール作成
│   │   ├── api/auth/[...all]/  # Better Auth catch-all
│   │   ├── layout.tsx
│   │   ├── page.tsx            # LP
│   │   └── globals.css         # デザイントークン v1 (Amber Gold)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui (button / card / input / label)
│   │   └── theme-provider.tsx  # next-themes
│   ├── lib/
│   │   ├── auth/               # auth.ts (Better Auth) + guards.ts (三層認可)
│   │   ├── db/                 # client.ts + schema.ts (10テーブル) + scoped.ts
│   │   ├── ai/                 # openai.ts / coach.ts / moderation.ts / tools.ts
│   │   ├── storage/r2.ts       # Cloudflare R2 ヘルパ
│   │   ├── email/resend.ts     # Resend ヘルパ
│   │   └── utils.ts            # cn()
│   └── proxy.ts                # Next.js 16 proxy (旧 middleware)
├── tests/
│   ├── unit/                   # Vitest
│   └── e2e/                    # Playwright
├── scripts/
│   ├── generate-problem.ts     # DEC-011 LLM-as-Judge: 生成
│   └── judge-problem.ts        # DEC-011 LLM-as-Judge: 採点
├── drizzle/
│   └── 0000_initial.sql        # 手動マイグレーション SQL
├── .github/workflows/ci.yml    # lint / typecheck / test / build / e2e / lighthouse
├── .env.local.example
├── DEPLOYMENT.md
├── package.json
├── tsconfig.json
├── next.config.ts              # セキュリティヘッダー
├── tailwind.config.ts          # Amber Gold + Mint + Sky
├── drizzle.config.ts
└── README.md
```

## W1 完了状態 (チェックリスト)

- [x] W1-01: package.json + tsconfig + next.config + layout/page スキャフォールド
- [x] W1-02: Drizzle schema 雛形 10 テーブル + 0000_initial.sql + seed
- [x] W1-03: 認可ガード (requireAuth / requireParent / requireFamilyMember / requireLearnerOwner) + scoped queries + ESLint カスタムルール
- [x] W1-04: AI コーチ最小スケルトン (kid-safe prompt + 三重ガード moderation + tool use 4 関数 zod)
- [x] W1-05: LLM-as-Judge PoC (生成 + 採点 / モック + 実 API スイッチ)
- [x] W1-06: 学習者導線 (signup / login / onboarding / home placeholder)
- [x] W1-07: デザイントークン v1 (Amber Gold + Mint + Sky / next-themes / dark mode)
- [x] W1-08: CI (.github/workflows/ci.yml) + .env.local.example + .gitignore + next.config セキュリティヘッダー
- [x] W1-09: テスト雛形 (auth.guards / ai.coach / ai.tools 単体 + signup E2E)
- [x] W1-10: ER 図 + DEPLOYMENT.md + README

## W2 完了状態 (チェックリスト)

- [x] W2-01: Drizzle schema +15 テーブル
- [x] W2-02: Better Auth 完成形 (signup → email verify → login → session)
- [x] W2-03: 学習 UI v1 (語彙 4 択 + 解説 + ts-fsrs SRS 更新)
- [x] W2-04: AI コーチ実 API 疎通 (gpt-5-mini streaming + 三重ガード)
- [x] W2-05: LLM-as-Judge Inline Cron
- [x] W2-06: R2 + TTS helper 完成
- [x] W2-07: Resend mail 4 種
- [x] W2-08: Sentry + Vercel Analytics + Speed Insights
- [x] W2-09: W2 テスト追加 (Vitest 3 本 + Playwright 2 本)
- [x] W2-10: dev-w2-report.md 完成

## W2 以降の見通し

- W2: 残り 15 テーブル拡張 (sessions / daily_plans / streaks / ai_coach_messages 等)、Better Auth 完成形 (signup -> session 確立まで動作)、AIコーチ実 API 疎通、SRS (ts-fsrs) 統合
- W3: 学習コアループ (語彙 / 文法) 動作 + AI コーチ誤答解説生成
- W4 中間ゲート: 800 問投入 + 主要 3 モジュール動作 + AIコーチ品質 70%+
- W5-W8: リスニング / 読解 / ライティング / ゲーミフィケーション / 模試
- W9-W10: 受験日逆算プラン + 保護者ビュー + リリースゲート 34 項目通過 -> クローズドβ開始

## 開発メモ

### 起動 (W2 以降に動作する想定)

```bash
cd projects/PRJ-016/app
cp .env.local.example .env.local  # 値を埋める
npm install
npm run db:migrate                 # Turso 接続後
npm run dev
```

### ESLint 三層認可ルール

`db.select()` の生クエリは ESLint の `no-restricted-syntax` で禁止しています。
家族スコープの取得には必ず `scopedQueries(familyId).listLearners()` 等のヘルパを経由してください。
`src/lib/auth/guards.ts` 内部での読み取りは例外的に許可 (認可判定そのものに必要なため)。

### 絵文字禁止

UI / 励ましフレーズ / system prompt / コミットメッセージ / README いずれも絵文字を使いません。
代わりに Heroicons 24/outline を使用してください (`@heroicons/react/24/outline`)。
