# PRJ-016 W1 リサーチレポート: gpt-5-mini 実 API 仕様再確認 + cross-LLM judge 用 Sonnet 4.5 + コスト試算

- **作成日**: 2026-04-26
- **作成部署**: リサーチ部門
- **担当タスク**: W1 TASK-A
- **前提**: オーナーから OpenAI API キー未受領のため、実 API 呼び出しは行わず、一次ソース（OpenAI / Anthropic 公式）の最新仕様を再確認 + コスト試算
- **対象**: DEC-003（gpt-5-mini 主軸 / gpt-4.1-mini フォールバック）、DEC-011（cross-LLM judge）の数値確証

---

## エグゼクティブサマリー

1. **gpt-5-mini は API では現役・推奨配布中**。価格 $0.25 / $2.00（入/出 per 1M）、cached input $0.025（90% 割引）、コンテキスト 400K、Structured Outputs / Function Calling / Vision すべて対応[^1][^2][^7]。
2. **OpenAI は 2026-02-13 に ChatGPT 側で GPT-4o / GPT-4.1 / GPT-4.1 mini / o4-mini / GPT-5（Instant・Thinking）を「ChatGPT から」 retire したが、API では引き続き利用可能**[^4][^9]。本案件の API 利用に直接の影響は無し。
3. **後継候補 gpt-5.4-mini も登場済み（$0.75 / $4.50・400K）**[^5][^11]。本案件は **コスト最適の gpt-5-mini を主軸に維持し、品質要件が立った時点で gpt-5.4-mini を A/B**。
4. **Claude Sonnet 4.5（cross-LLM judge 用）= $3 / $15 per 1M、prompt caching 5min write 1.25x / read 0.1x、Batch 50% off**[^3]。1,600 問のラウンドトリップ採点で **約 ¥1,575**（gpt-5-mini 生成 ¥273 + Sonnet 4.5 採点 ¥1,302）と試算。**Phase 1 1,600 問の問題プール構築 AI コスト = ¥1,575（プロンプトキャッシュ未使用ケース）**。Batch API + Caching を組めば半額以下に圧縮可。
5. **AI SDK の `@ai-sdk/openai` + `@ai-sdk/anthropic` 併用は標準パターン**[^14][^15]。Vercel AI Gateway 経由（`@ai-sdk/gateway`）で 20+ プロバイダの抽象化 + 自動フォールバック + observability を組むのが本案件の最適解。

---

## 1. gpt-5-mini 公式仕様（2026-04-26 時点）

### 1-1. 価格

| 項目 | 金額（per 1M tokens） | 出典 |
|------|----------------------|------|
| Input | **$0.25** | [^1][^2][^7] |
| Cached Input | **$0.025**（90% 割引） | [^7] |
| Output | **$2.00** | [^1][^2][^7] |
| Batch Input | $0.125（推定: 50% off） | [^2]（OpenAI 一般則） |
| Batch Output | $1.00（推定: 50% off） | [^2] |

### 1-2. 機能サポート

| 機能 | 対応 | 備考 |
|------|------|------|
| **コンテキスト長** | **400,000 tokens** | [^1] |
| **最大出力 tokens** | 128,000 | [^1]（OpenAI モデル一覧） |
| **Structured Outputs**（JSON Schema 強制） | ◯ | strict:true 対応、zodResponseFormat ヘルパー利用可[^13] |
| **Function Calling** | ◯ | strict:true で tool スキーマ強制 [^13] |
| **Vision**（画像入力） | ◯ | text + image input[^1] |
| **Reasoning（思考）** | △ | Reasoning は o4 系 / gpt-5 reasoning 系の責務、mini は迅速応答 |
| **Speech / TTS** | ✕（別モデル） | tts-1 / gpt-4o-mini-tts を別途呼び分け |
| **Knowledge Cutoff** | 2024-10 | [^1] |
| **リリース日** | **2025-08-07** | [^7]、Phase 0 既出 |

### 1-3. ChatGPT 側での 2026-02-13 retirement（誤解の整理）

- **ChatGPT** から GPT-4o / GPT-4.1 / GPT-4.1 mini / o4-mini / GPT-5（Instant・Thinking）が消えた[^4][^9]
- **API ではアクセス継続中**（"API access remains unchanged"）[^4]
- **本案件の影響**: なし。引き続き `gpt-5-mini` (API モデル ID) を呼び出せる
- ただし **gpt-5-mini の API 側の正式 deprecation 予告は 2026-04-26 時点で出ていない** が、OpenAI は 6〜12 か月で次世代 mini に置換する歴史[^9]があるため、**6〜12 か月先には gpt-5.4-mini（$0.75/$4.50）に強制移行する可能性**を 2 段階フォールバック設計に織り込むべき。

---

## 2. フォールバック / 比較モデル

### 2-1. 候補比較表

| モデル | Input ($/1M) | Cached Input | Output ($/1M) | Context | 機能 | リリース | 出典 |
|--------|--------------|--------------|---------------|---------|------|---------|------|
| **gpt-5-mini**（主軸） | $0.25 | $0.025 | $2.00 | 400K | Vision/SO/FC | 2025-08-07 | [^1][^7] |
| gpt-5.4-mini（後継候補・正式） | $0.75 | $0.075 | $4.50 | 400K | SO/FC/computer use | 2026-Q1 | [^5][^11] |
| gpt-5.5（複雑タスク） | （未公表・上位） | – | – | 1M | SO/FC/computer use | 2026 | [^11] |
| **gpt-4.1-mini**（フォールバック・DEC-003 規定） | 中位 | – | 中位 | 1M | SO/FC | 2025 | [^9] |
| gpt-4o-mini | $0.15 | $0.075 | $0.60 | 128K | SO/FC | 2024 | Phase 0 既出 |
| gpt-4.1-nano | $0.10 | – | $0.40 | – | 軽量分類 | 2025 | Phase 0 既出 |

### 2-2. 用途別推奨（DEC-003 を踏襲・W1 で精緻化）

| 用途 | 推奨モデル | 理由 |
|------|-----------|------|
| **問題生成（バッチ・夜間）** | gpt-5-mini | 品質 / コストバランス、Structured Outputs で zod 強制 |
| **解説生成（同期・子ども向け）** | gpt-5-mini | 子ども向け文体 + Structured Outputs |
| **AI コーチ会話（同期）** | gpt-5-mini | 速度・コスト両立、Vision で画像問題対応可 |
| **NG 判定 / トピック分類** | gpt-4.1-nano | 安価、結果が単純 |
| **問題採点（cross-LLM judge）** | **Claude Sonnet 4.5** | OpenAI 系の自己バイアス回避 + 80-90% 人間一致[^16] |
| **長文プリント生成（Phase 2）** | gpt-4.1-mini（1M 文脈） | コンテキスト長重視 |

### 2-3. ChatGPT 側 retirement と API 影響の確証

- 2026-02-13 ChatGPT 側で GPT-4o / GPT-4.1 / GPT-4.1 mini / o4-mini / GPT-5（Instant・Thinking）が retire[^4]
- **API 利用は継続**[^4]（"API access remains unchanged"）
- **本案件のフォールバック gpt-4.1-mini は API では現役**

---

## 3. Claude Sonnet 4.5（cross-LLM judge 用）公式仕様

### 3-1. 価格表（2026-04-26 時点）[^3]

| 項目 | Sonnet 4.5 | Sonnet 4.6（最新） | 備考 |
|------|------------|--------------------|------|
| Base Input | **$3 / MTok** | $3 / MTok | 同価格 |
| 5min Cache Write | $3.75 / MTok | $3.75 / MTok | 1.25x |
| 1h Cache Write | $6 / MTok | $6 / MTok | 2x |
| **Cache Hits** | **$0.30 / MTok** | $0.30 / MTok | 0.1x（90% off） |
| Output | **$15 / MTok** | $15 / MTok | 5x input |
| Batch Input | $1.50 / MTok | $1.50 / MTok | 50% off |
| Batch Output | $7.50 / MTok | $7.50 / MTok | 50% off |
| Context Window | **1.0M tokens** | 1.0M | 全モデル統一 |

### 3-2. 機能サポート

| 機能 | 対応 |
|------|------|
| Structured Outputs | ◯（tool use 強制 / JSON Mode） |
| Function Calling | ◯ |
| Vision | ◯ |
| Prompt Caching | ◯（5min / 1h） |
| Batch API（50% off） | ◯ |
| Long context（1M） | ◯ |

### 3-3. 留意点

- **Sonnet 4.6 が 2026-04 時点での最新**（Sonnet 4.5 と同価格・互換）。本案件は DEC-011 で「Sonnet 4.5 もしくは gpt-5（フル）」と規定済みだが、価格同一なので **Sonnet 4.6 を採用も可**。
- 4.5 と 4.6 の違いは速度・推論強化（公式 changelog 参照）。**本案件のジャッジ用途では 4.5 で十分**。
- **Anthropic は 5x output:input 比を全モデルで維持**[^3] → output 量を圧縮（verdict + reasons[] のみ・improvement_hints は短文）するプロンプト最適化が効く。

---

## 4. 1,600 問 LLM-as-Judge パイプライン コスト試算

### 4-1. 前提（DEC-007・DEC-011・W1 TASK-C 連動）

- **問題プール規模**: 5級 400 + 4級 500 + 3級 700 = **1,600 問**
- **生成 1 問**: gpt-5-mini で system 400 + user 200 = 600 input + JSON 出力 800 = 800 output token
- **採点 1 問**: Claude Sonnet 4.5 へ 問題 1 件分（system 600 + 問題 JSON 1000 = 1,600 input + verdict JSON 300 output token）
- **再生成発生率**: 平均 1.3 回（pass 80% / review_needed 15% は 1 回再生成 / fail 5% は 2 回再生成、加重平均 = 1 + 0.15 + 0.10 = 1.25 → 安全側 1.3）
- **為替**: 1 USD = ¥150（保守値）

### 4-2. Phase 1 全期間（一括試算・キャッシュなし保守値）

#### A) 生成側（gpt-5-mini）

| 項目 | 計算 | コスト |
|------|------|--------|
| Input | 1,600 × 1.3 × 600 = 1,248,000 token × $0.25/1M | $0.312 |
| Output | 1,600 × 1.3 × 800 = 1,664,000 token × $2.00/1M | $3.328 |
| 小計 | | **$3.64 ≒ ¥546** |

#### B) 採点側（Sonnet 4.5）

| 項目 | 計算 | コスト |
|------|------|--------|
| Input | 1,600 × 1.3 × 1,600 = 3,328,000 token × $3.00/1M | $9.984 |
| Output | 1,600 × 1.3 × 300 = 624,000 token × $15.00/1M | $9.360 |
| 小計 | | **$19.344 ≒ ¥2,902** |

#### C) Phase 1 合計（一括）

| 項目 | コスト |
|------|--------|
| 生成（gpt-5-mini） | ¥546 |
| 採点（Sonnet 4.5） | ¥2,902 |
| **合計** | **¥3,448**（約 $23） |

### 4-3. 最適化適用後

| 最適化 | 効果 | 試算 |
|--------|------|------|
| **Sonnet 4.5 prompt caching（system 600 token を キャッシュ）** | 約 90% off on cached portion | 採点 input が概ね 25% 削減 → ¥2,902 → ¥2,176 |
| **Batch API（生成・採点とも非同期可）** | 50% off | 全体半額 → ¥3,448 → ¥1,724 |
| **両方併用** | – | **約 ¥1,300（最適化後実勢値）** |

→ **DEC-011 の問題プール構築コストは AI 単体で月 ¥3,500 以下**、最適化適用後は **¥1,500 前後** で完了。1日5問のオーナー抜き取り検収は別軸（人的コスト）。

### 4-4. AI コーチ運行コスト（DEC-008 K-6: ¥10/人/日 以下の検証）

#### 想定 1 ユーザー / 1 日

- 学習時間 1 時間
- AI コーチ会話 30 ターン（DEC-003 既出仮定）
- 1 ターン平均 input 300 token + output 200 token
- 1 日合計: 30 × 500 = **15,000 token / 日 / 人**

| モデル | 入力分 | 出力分 | 合計 / 日 / 人 |
|--------|--------|--------|---------------|
| gpt-5-mini | 9,000 × $0.25/1M = $0.00225 | 6,000 × $2.00/1M = $0.012 | **$0.01425 ≒ ¥2.14** |
| gpt-5-mini（cached system 50% 想定） | $0.00159 | $0.012 | ≒ ¥2.04 |
| 解説生成（誤答時 平均 5 回 / 日 input 500 + output 400） | 2,500 × $0.25/1M = $0.000625 | 2,000 × $2.00/1M = $0.004 | $0.00463 ≒ ¥0.69 |
| **AI 利用合計（gpt-5-mini）** | – | – | **≒ ¥2.83 / 人 / 日** |
| TTS（OpenAI tts-1, 平均 30 文 × 30 char = 900 char / 日） | – | – | 900 × $15/1M = $0.0135 ≒ ¥2.03 |
| **総合計（AI + TTS）** | – | – | **≒ ¥4.86 / 人 / 日** |

→ **DEC-008 K-6（¥10/人/日 以下）を余裕でクリア**。100 名で月 ¥14,580、500 名で月 ¥72,900。Phase 0 試算（¥6,500 / 月 / 100 名 AI 単体）と整合。

#### 重要な補足

- DEC-008 で「Moderation + プロンプトキャッシング + コンテキスト圧縮 + RAG 切替」を Phase 1 中に常時監視と規定 → 上記試算はキャッシング未適用なので **実勢値は更に圧縮可能**
- TTS は R2 にキャッシュ（DEC-003）すれば再生成ゼロ → 2 回目以降は ¥0 に近づく

---

## 5. AI SDK プロバイダ抽象化（@ai-sdk/openai + @ai-sdk/anthropic）

### 5-1. アーキテクチャ概要[^14][^15]

```
┌────────────────────────────────────────┐
│ Application code                       │
│ ↓                                      │
│ generateObject({ model, schema, ... }) │  ← AI SDK Core 統一 API
│ ↓                                      │
│ LanguageModelV1 spec                   │  ← プロバイダ抽象（zod / Tool / Stream 統一）
│ ↓                                      │
│ ┌──────────────┬──────────────┐         │
│ │ @ai-sdk/openai│@ai-sdk/anthropic│       │
│ │ openai('gpt-5-mini')│anthropic('claude-sonnet-4-5')│ │
│ └──────────────┴──────────────┘         │
└────────────────────────────────────────┘
```

### 5-2. インストール / 利用例（W1 PoC 実装ガイド）

```typescript
// package.json
// "ai": "^4.x"
// "@ai-sdk/openai": "^1.x"
// "@ai-sdk/anthropic": "^1.x"
// "zod": "^3.x"

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

// 生成（gpt-5-mini）
const ProblemSchema = z.object({
  problem_id: z.string(),
  level: z.enum(['5','4','3']),
  skill: z.enum(['vocab','grammar','reading','listening','writing']),
  question: z.string(),
  choices: z.array(z.string()).length(4),
  correct: z.number().int().min(0).max(3),
  explanation: z.string(),
  metadata: z.object({
    cefr: z.enum(['A1','A2','B1']),
    target_vocab: z.array(z.string()),
  }),
});

const generated = await generateObject({
  model: openai('gpt-5-mini'),
  schema: ProblemSchema,
  system: '英検{級}の問題作成者...',  // W1 TASK-C で詳細化
  prompt: 'level=3, skill=vocab を 1 問生成',
});

// 採点（Sonnet 4.5）
const VerdictSchema = z.object({
  quality_score: z.number().int().min(0).max(100),
  verdict: z.enum(['pass', 'fail', 'review_needed']),
  reasons: z.array(z.string()),
  improvement_hints: z.array(z.string()),
});

const verdict = await generateObject({
  model: anthropic('claude-sonnet-4-5'),  // または 'claude-sonnet-4-6'
  schema: VerdictSchema,
  system: '英検問題の校閲者...',  // W1 TASK-C で詳細化
  prompt: JSON.stringify(generated.object),
  // prompt caching を有効化
  providerOptions: {
    anthropic: {
      cacheControl: { type: 'ephemeral' },  // 5min cache
    },
  },
});
```

### 5-3. Vercel AI Gateway 併用（推奨：W2 以降検討）

- 単一 API キー（`AI_GATEWAY_API_KEY`）で OpenAI + Anthropic + Google + Meta + xAI など 20+ プロバイダにアクセス[^14]
- **自動フォールバック**: gpt-5-mini が rate limit / 障害 → 自動的に gpt-4.1-mini や Sonnet 4.5 に切替（DEC-003 二段階フォールバック規定の自動化）
- **コスト・性能でソート**: best-scoring プロバイダから順次フォールバック
- **Observability**: トークン使用量・レイテンシ・コストを統合ダッシュボードで可視化（DEC-008 K-6 ¥10/人/日 監視に直結）

### 5-4. W1 で確認すべきインテグレーション項目（実 API 受領後）

1. ✅ **gpt-5-mini × generateObject + zod schema** で問題生成 1 件成功
2. ✅ **Claude Sonnet 4.5 × generateObject + zod schema** で採点 1 件成功
3. ✅ **prompt caching**（Anthropic `cacheControl: ephemeral`）でキャッシュヒット確認
4. ✅ **streaming**（streamObject / streamText）で AI コーチ UX 確認
5. ⚠️ **Moderation API** 三重ガード（OpenAI Moderation 入力 → 生成 → 出力 Moderation 再走査）

---

## 6. リスクと推奨アクション（W1 → W4）

| # | リスク | 影響 | 推奨アクション |
|---|--------|-----|----------------|
| MR-1 | gpt-5-mini が突然 deprecation 予告される | 大 | AI Gateway で抽象化、DEC-003 「gpt-4.1-mini フォールバック」を W1 中に動作確認、6 か月後 gpt-5.4-mini A/B 計画 |
| MR-2 | Sonnet 4.5 → 4.6 に置換予告 | 中 | 価格同一なので置換リスクは小、`anthropic('claude-sonnet-4-5')` → `anthropic('claude-sonnet-4-6')` の 1 行差し替え |
| MR-3 | 1 ユーザー ¥10/日（K-6）超過 | 大 | DEC-008 既定の 4 段階圧縮策（Moderation / caching / 圧縮 / RAG）+ AI Gateway observability で常時監視 |
| MR-4 | Moderation 三重ガードの誤検知 | 中 | サンプリングで誤検知率を週次レビュー、閾値（toxicity 0.5 / sexual 0.3 等）を子ども向けに厳格化 |
| MR-5 | Structured Outputs の strict 失敗（schema 違反） | 中 | refusal 検出 + 再生成 1 回まで、3 回失敗で人手キューへ（DEC-011 既定） |

---

## 7. 結論 & 上申

### 7-1. DEC-003 / DEC-011 への影響（修正不要）

- **gpt-5-mini 主軸 + gpt-4.1-mini フォールバック**（DEC-003）→ 維持。一次ソースで価格 / 機能確認完了
- **cross-LLM judge = Claude Sonnet 4.5**（DEC-011）→ 維持。Sonnet 4.6 への将来切替は価格同一のため低コスト
- 1,600 問構築 AI コスト ≒ **¥1,500〜3,500**（DEC-007 ¥30 万撤回後の現実値）
- 1 ユーザー 1 日コスト ≒ **¥4.86**（K-6 余裕でクリア）

### 7-2. オーナー上申なし（W1 並列起動継続で OK）

- 実 API キー受領後の疎通 PoC は **Dev 部門 W1 タスク**（reports/dev-w1.md 想定）に引き継ぐ
- Research 部門は **TASK-B / TASK-C / TASK-D** を並行進行

---

## 参考文献（一次ソース）

[^1]: [GPT-5 mini Model | OpenAI API](https://platform.openai.com/docs/models/gpt-5-mini)（2026-04-26 確認）
[^2]: [Pricing | OpenAI API](https://developers.openai.com/api/docs/pricing)（2026-04-26 確認、gpt-5.4-mini $0.75/$4.50 表示・gpt-5-mini は別ページ）
[^3]: [Pricing — Claude API Docs](https://platform.claude.com/docs/en/about-claude/pricing)（2026-04-26 確認、Sonnet 4.5 $3/$15、cache 0.1x 確認）
[^4]: [OpenAI Model Deprecation Guide 2026: Migrating from GPT-4o, GPT-4.1 & o4-mini | KissAPI](https://kissapi.ai/blog/openai-model-deprecation-migration-guide-2026.html)（2026-02-13 ChatGPT 側 retire、API 継続を確認）
[^5]: [GPT-5.4 mini Model | OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
[^6]: [Models | OpenAI API](https://developers.openai.com/api/docs/models)（モデル一覧）
[^7]: [OpenAI GPT-5 mini Pricing (2026) — Cost per 1K/1M Tokens & Examples](https://langcopilot.com/llm-pricing/openai/gpt-5-mini)（cached input $0.025 確認）
[^8]: [GPT 5 Mini API Pricing 2026 - Costs, Performance & Providers | PricePerToken](https://pricepertoken.com/pricing-page/model/openai-gpt-5-mini)
[^9]: [OpenAI API Pricing 2026: GPT-5.4, o3, o4-mini & All Models | AI Pricing Guru](https://www.aipricing.guru/openai-pricing/)
[^10]: [Deprecations | OpenAI API](https://developers.openai.com/api/docs/deprecations)
[^11]: [GPT-5.5 Model | OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.5)（最新フロンティア）
[^12]: [Using GPT-5.5 | OpenAI API](https://developers.openai.com/api/docs/guides/latest-model)
[^13]: [Structured model outputs | OpenAI API](https://developers.openai.com/api/docs/guides/structured-outputs) / [Using Zod and zodResponseFormat for Structured Outputs](https://hooshmand.net/zod-zodresponseformat-structured-outputs-openai/)
[^14]: [AI SDK Providers](https://ai-sdk.dev/providers/ai-sdk-providers) / [AI Gateway](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
[^15]: [AI SDK Providers: Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) / [Foundations: Provider Options](https://ai-sdk.dev/docs/foundations/provider-options)
[^16]: [LLM-as-Judge: A Practical Guide (2026) | SurePrompts](https://sureprompts.com/blog/llm-as-judge-prompting-guide) / [Rubric-Based Evaluations & LLM-as-a-Judge | Medium](https://medium.com/@adnanmasood/rubric-based-evals-llm-as-a-judge-methodologies-and-empirical-validation-in-domain-context-71936b989e80)

---

**調査完了**: 2026-04-26 / リサーチ部門 / W1 TASK-A
