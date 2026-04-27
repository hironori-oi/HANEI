# PRJ-016 HANEI W3 オーナー手動 smoke チェックリスト

作成: Dev / 2026-04-26 (W3 完了時)
所要時間: 5〜10 分 (8 項目)
前提: `projects/PRJ-016/app/.env.local` に W2 までのキーが埋まっていること
        (Turso / OpenAI / Anthropic / Resend / R2 / Vercel)

---

## 0. 事前準備

```bash
cd projects/PRJ-016/app
cp .env.example .env.local       # まだ無ければ
# .env.local に以下を最低限揃える
# TURSO_DATABASE_URL=libsql://...
# TURSO_AUTH_TOKEN=...
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# RESEND_API_KEY=re_...
# R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME
```

---

## 1. DB マイグレーション (Turso 本体)

**目的**: W2 拡張テーブル (problem_explanations / tts_assets / xp_levels / streaks / characters / exam_dates) が本番 Turso に存在することの確認。

```bash
npm run db:migrate
```

### 成功時の応答例

```
[migrate] applying migrations from drizzle/...
[migrate] 0000_initial.sql applied
[migrate] 0001_w2_extensions.sql applied
[migrate] done. tables = 25
```

### 失敗時のよくある原因

- `TURSO_AUTH_TOKEN` 失効 (1y)。Turso ダッシュボードで再発行
- `TURSO_DATABASE_URL` の Region 不一致 → `libsql://hanei-xxx.turso.io` 形式か確認
- `relation already exists` → 既に適用済み。`drizzle-kit introspect` で diff 確認

---

## 2. OpenAI gpt-5-mini (一次モデル) smoke

**目的**: Coach 一次モデルの API 鍵 + 残クレジット + リージョン疎通。

```bash
node -e "
import('openai').then(async ({ default: OpenAI }) => {
  const c = new OpenAI();
  const r = await c.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [{ role: 'user', content: 'say ok' }],
    max_tokens: 5,
  });
  console.log('OK', r.choices[0].message.content);
});
"
```

### 成功時の応答例

```
OK ok
```

### 失敗時のよくある原因

- 401 → API キー誤り or organization 設定外し
- 429 → 残クレジット切れ。OpenAI Billing で課金枠
- model_not_found → gpt-5-mini が org に未開放。`gpt-4.1-mini` で fallback 確認

---

## 3. OpenAI Moderation (kids-safe ガード)

**目的**: 学習者入力モデレーションが通る ことの確認。

```bash
node -e "
import('openai').then(async ({ default: OpenAI }) => {
  const c = new OpenAI();
  const r = await c.moderations.create({
    model: 'omni-moderation-latest',
    input: 'hello',
  });
  console.log('flagged =', r.results[0].flagged);
});
"
```

### 成功時の応答例

```
flagged = false
```

### 失敗時のよくある原因

- Moderation API は通常無料枠だが、地域制限で不可なら CloudFront proxy 必要
- 401 → 上記 §2 と同じ原因

---

## 4. Anthropic Claude Sonnet 4.5 (LLM judge)

**目的**: 第二意見ジャッジ (DEC-007) のキー疎通。

```bash
node -e "
import('@anthropic-ai/sdk').then(async ({ default: A }) => {
  const c = new A();
  const r = await c.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8,
    messages: [{ role: 'user', content: 'say ok' }],
  });
  console.log('OK', r.content[0].type === 'text' ? r.content[0].text : '?');
});
"
```

### 成功時の応答例

```
OK ok
```

### 失敗時のよくある原因

- 401 → ANTHROPIC_API_KEY 誤り
- model_not_found → モデル ID は `claude-sonnet-4-5` (- 区切り) を厳守

---

## 5. OpenAI tts-1 (音声合成)

**目的**: 200 単語 × 3 voice = 600 generation 前のキー疎通確認。
`scripts/generate-tts-w3.ts` を本番実行する前に必ず通す。

```bash
node -e "
import('openai').then(async ({ default: OpenAI }) => {
  const c = new OpenAI();
  const r = await c.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: 'apple',
  });
  const buf = Buffer.from(await r.arrayBuffer());
  console.log('bytes =', buf.length);
});
"
```

### 成功時の応答例

```
bytes = 18432
```
(15〜25 KB が目安。0 なら失敗)

### 失敗時のよくある原因

- 401 → キー誤り
- voice が enum 外 → `nova / alloy / shimmer / onyx / echo / fable` のいずれか
- 429 → tts-1 の RPM 制限。3 voice × 200 を 2 RPS で sequential 実行する設計済

---

## 6. Resend テストメール (保護者向けトランザクション)

**目的**: 認証メール / 非アクティブリマインダー (W3 新規) の送信確認。

```bash
node -e "
import('resend').then(async ({ Resend }) => {
  const r = new Resend(process.env.RESEND_API_KEY);
  const x = await r.emails.send({
    from: 'HANEI <noreply@updates.hanei.app>',
    to: 'ai-lab@improver.jp',
    subject: 'HANEI smoke',
    text: 'W3 smoke ok',
  });
  console.log('OK', x.data?.id ?? x.error);
});
"
```

### 成功時の応答例

```
OK { id: 'e7a1...uuid...' }
```
オーナーの inbox に届くこと。

### 失敗時のよくある原因

- domain not verified → updates.hanei.app の SPF/DKIM 設定を Resend で確認
- from 不正 → Resend で verified domain でない `@hanei.app` などを使うと失敗
- 422 → to が test-mode 制限内のアドレスでない (本番化前は test mode 注意)

---

## 7. R2 presigned PUT/GET (TTS / 録音 cache)

**目的**: TTS バルク生成スクリプトが書き込む R2 の権限確認。

```bash
npm run r2:smoke
# (もし無ければ scripts/r2-smoke.ts を W4 で追加)
```

または手動:

```bash
node -e "
import('@aws-sdk/client-s3').then(async ({ S3Client, PutObjectCommand, GetObjectCommand }) => {
  const c = new S3Client({
    region: 'auto',
    endpoint: \`https://\${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com\`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  await c.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: 'smoke/w3.txt',
    Body: 'ok',
  }));
  console.log('PUT ok');
  const g = await c.send(new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: 'smoke/w3.txt',
  }));
  console.log('GET ok', g.ContentLength);
});
"
```

### 成功時の応答例

```
PUT ok
GET ok 2
```

### 失敗時のよくある原因

- AccessDenied → R2 API トークンに `Object Read & Write` 権限が付与されていない
- NoSuchBucket → `R2_BUCKET_NAME` のタイポ (例: hanei-tts vs hanei_tts)
- endpoint 違い → `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` を厳守 (s3 サブドメインは別物)

---

## 8. Vercel 環境変数 push (preview 環境への反映)

**目的**: ローカル `.env.local` の鍵を Vercel preview に同期する手順確認。

```bash
# 確認のみ (push しない)
vercel env ls preview
```

push する場合:
```bash
vercel env add OPENAI_API_KEY preview < /dev/null  # 対話で値入力
# もしくは
vercel env pull .env.preview.local
```

### 成功時の応答例

```
> Vercel CLI 39.x.x
> Environment Variables (preview):
TURSO_DATABASE_URL    Encrypted   Updated 2d ago
TURSO_AUTH_TOKEN      Encrypted   Updated 2d ago
OPENAI_API_KEY        Encrypted   Updated 1h ago
...
```

### 失敗時のよくある原因

- not linked → `vercel link` で当該 project に紐付け
- 権限不足 → Vercel Org の Member 以上が必要
- key 名のタイポ → `NEXT_PUBLIC_` prefix の有無で client/server 露出が変わる点に注意

---

## 完了基準

| # | 項目 | OK/NG |
|---|------|-------|
| 1 | DB migrate | ☐ |
| 2 | OpenAI gpt-5-mini | ☐ |
| 3 | OpenAI Moderation | ☐ |
| 4 | Anthropic Sonnet 4.5 | ☐ |
| 5 | OpenAI tts-1 | ☐ |
| 6 | Resend test mail | ☐ |
| 7 | R2 PUT/GET | ☐ |
| 8 | Vercel env ls | ☐ |

8/8 OK で **W3 完了 (本番 smoke クリア)**。 1 件でも NG なら CEO に共有してください。
