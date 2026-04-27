# PRJ-016 W1 リサーチレポート: LLM-as-Judge パイプライン仕様（DEC-011 詳細化）

- **作成日**: 2026-04-26
- **作成部署**: リサーチ部門
- **担当タスク**: W1 TASK-C
- **対象**: DEC-011（AI 自動生成 + cross-LLM judge + 決定論的 QA + オーナー抜き取り 5%）の実装可能仕様
- **連動**: research-w1-models.md（コスト・モデル選定）

---

## エグゼクティブサマリー

1. **生成プロンプト**: gpt-5-mini に対して **System / User / zod 強制 JSON Schema** の 3 層構造。級 × 技能 × CEFR × kid-safe 制約を System に固定、生成バリエーションは User の seed に依存（temperature 0.7-0.8）。**過去問流用禁止 + 子ども不適切表現禁止 + 絵文字禁止 + 固有名詞架空化** を厳守。
2. **採点プロンプト（cross-LLM judge）**: Claude Sonnet 4.5 に **5 観点 100 点満点** で採点（正解妥当性 40 / 選択肢適切性 20 / 難易度整合 20 / 著作権懸念 10 / 子ども不適切表現 10）→ 80+ pass / 60-79 review_needed / 60- fail。**position bias 回避のため選択肢順序ランダム化**、**verbosity bias 回避のため reasons[] は 3 件以内・各 100 字以内**。
3. **決定論的 QA**: `text-embedding-3-small` で重複検出（cosine 類似度 **0.92 以上で重複**）+ 設問形式バリデーション（4択・各選択肢 5-40 字・正解バランス）+ メタデータ完全性 5 項目。
4. **オーナー抜き取り 5%**: 各級各技能 5%（合計 80 問）を **学習 UI 上で本人と同じ画面で確認**できる「QA モード」+ 「この問題おかしい」フラグ DB（`problem_flags`）+ 学習者「誤問報告ボタン」の 2 系統で人手フィードバックを収集。
5. **再生成キュー**: Trigger.dev v3（推奨）or Vercel Cron + Inline。**fail = 即時再生成 / review_needed = 最大 3 回再生成 / 3 回失敗で人手レビュー必須キューに移管**。各問題に `regeneration_history` JSON 列を追加し、再生成回数 + verdict 履歴を可観測化。

---

## 1. 生成プロンプト（gpt-5-mini）

### 1-1. System Prompt（共通基盤）

```
あなたは英検 {level} 級の問題作成者です。日本英語検定協会の公式仕様（出題範囲・採点基準）に厳格に準拠し、英語をはじめて学ぶ小学生（10〜13 歳）向けに 100% オリジナルの問題を作成します。

【厳守事項】
1. 過去問・市販問題集・既存サービスの問題を一切引用・改変しない（既存パターンの単純な置換も禁止）
2. 登場人物名は架空の英語圏一般名のみ（Mike / Lily / Ben / Anna / Tom / Mary など）
3. 固有名詞（地名・施設名・商品名）は全て架空 or 一般名（"a city", "a park", "a school", "the library"）
4. 文化的に偏りのない題材（特定宗教・政治・実在企業・国際紛争を避ける）
5. {level} 級 CEFR {cefr} 相当の語彙のみ使用、それ以外の難語禁止
6. 子ども不適切表現禁止（暴力・性的・差別・恐怖・自殺・自傷・薬物・賭博・酒）
7. 絵文字使用禁止（UI 規約に準拠）
8. 出力は必ず指定された JSON スキーマに準拠（Structured Outputs strict:true）
9. ですます調 + やさしい日本語で解説（ひらがな多め、漢字には必要に応じて読み仮名）

【{level} 級の出題範囲】
{level_specific_range}

【今回の出題技能】
{skill}: {skill_specific_instruction}

【正答ラベル】
正答は均等分布させる（0,1,2,3 を均等に・連続 3 回同じ正答禁止）
```

### 1-2. Level / Skill 別 出題範囲（System 動的差し替え部）

#### 5 級 / vocab（語彙）

```
【5 級 vocab 出題範囲】
- 中学初級程度・推定語彙数 600 語
- be 動詞 / 一般動詞（現在形）/ 代名詞 / 疑問詞 / 数 / 曜日 / 月 / 季節 / 天気 / 食べ物 / 動物 / 学校
- 英文 1 文（5-10 語）の中の 1 語を空所にして 4 択
- 選択肢は同じ品詞で揃える（動詞穴埋めなら 4 つとも動詞）
```

#### 4 級 / grammar（文法）

```
【4 級 grammar 出題範囲】
- 中学中級程度・推定語彙数 1,300 語
- 過去形 / 過去進行形 / 未来形 / 助動詞 / 比較 / 不定詞 / 動名詞
- 英文 1〜2 文（5-15 語）の中の 1 語/句を空所にして 4 択
- 文法ポイントを明確に問う（時制・語形変化・前置詞）
```

#### 3 級 / reading（読解）

```
【3 級 reading 出題範囲】
- 中学卒業程度・推定語彙数 2,100 語
- 受動態 / 現在完了 / 関係代名詞 / 間接疑問
- 短文 60-100 語 + 内容一致選択 4 択 × 1〜3 問
- 子どもの日常（学校・家族・部活・週末・趣味）を題材
```

#### 3 級 / listening（リスニング・台本）

```
【3 級 listening 出題範囲】
- 第1部: 会話の応答（A→B→A の 3 ターン目を 4 択）
- 第2部: 会話の内容一致（A↔B の 2-3 ターン会話 + 質問 + 4 択）
- 第3部: パッセージ内容一致（30-50 語のパッセージ + 質問 + 4 択）
- 出力は台本（speakers + 行ごとセリフ）+ 質問 + 4 択
```

#### 3 級 / writing（ライティング）

```
【3 級 writing 出題範囲】
- QUESTION 型 25-35 語の意見論述 / E メール返信
- お題例: "What sport do you like?" / "What food do you like?" / "Where do you want to go?"
- 採点観点: 内容 4 / 構成 4 / 語彙 4 / 文法 4 = 16 点満点（公式準拠）
- 模範解答 + 採点ルーブリック + 子ども向け解説をセットで生成
```

### 1-3. User Prompt（generation seed）

```
level: {3|4|5}
skill: {vocab|grammar|reading|listening|writing}
target_grammar_point: 受動態（is/are/was/were + 過去分詞）
target_vocab: ["read", "book", "library", "yesterday"]
difficulty: medium  // easy | medium | hard
seed: {ランダム文字列、温度の代わりに seed で多様性確保}
```

### 1-4. 出力 JSON スキーマ（zod 強制）

```typescript
import { z } from 'zod';

export const ProblemSchema = z.object({
  problem_id: z.string().regex(/^PRB-[0-9A-Z]{8}$/),  // クライアント側で UUID v4 → 短縮
  level: z.enum(['5', '4', '3']),
  skill: z.enum(['vocab', 'grammar', 'reading', 'listening', 'writing']),

  // 問題本体（skill により形が変わる）
  question: z.string().min(5).max(500),
  passage: z.string().optional(),  // reading / listening 用
  audio_script: z.string().optional(),  // listening 用（speaker タグ付き）

  // 4 択（writing は除く）
  choices: z.array(z.string().min(1).max(120)).length(4).optional(),
  correct: z.number().int().min(0).max(3).optional(),

  // writing 専用
  writing_prompt: z.string().optional(),
  model_answer: z.string().optional(),
  rubric: z.object({
    content: z.number().int().min(0).max(4),
    structure: z.number().int().min(0).max(4),
    vocab: z.number().int().min(0).max(4),
    grammar: z.number().int().min(0).max(4),
  }).optional(),

  // 解説（必須）
  explanation: z.string().min(20).max(800),

  // メタデータ
  metadata: z.object({
    cefr: z.enum(['A1', 'A2', 'B1']),
    target_vocab: z.array(z.string()).max(10),
    target_grammar: z.string().optional(),
    estimated_time_sec: z.number().int().min(10).max(180),
  }),

  // 生成情報
  generated_at: z.string().datetime(),
  generated_model: z.string(),  // 'gpt-5-mini' / 'gpt-5.4-mini'
});

export type Problem = z.infer<typeof ProblemSchema>;
```

---

## 2. 採点プロンプト（cross-LLM judge / Claude Sonnet 4.5）

### 2-1. System Prompt

```
あなたは英検 {level} 級問題の校閲者・第三者評価者です。OpenAI 系 LLM（gpt-5-mini）が生成した問題を、独立した立場から採点します。

【採点観点】（重み付き 100 点満点）

1. 正解妥当性（40 点）
   - 正解とされている選択肢は本当に正しいか
   - 他の選択肢が正解と解釈できる余地はないか（曖昧性チェック）
   - 文法・語法上のミスはないか

2. 選択肢適切性（20 点）
   - 4 つの選択肢は適切に紛らわしいか（distractor として機能するか）
   - 選択肢の文字数バランス（極端に長い・短いものが混在していないか）
   - 同じ品詞で揃っているか

3. 難易度整合（20 点）
   - {level} 級 CEFR {cefr} 相当の語彙・文法のみで構成されているか
   - 易しすぎ / 難しすぎないか

4. 著作権懸念（10 点）
   - 過去問・市販問題集の文を流用していないか
   - 実在の固有名詞（地名・施設・商品・人物）が含まれていないか

5. 子ども不適切表現（10 点）
   - 暴力・性的・差別・恐怖・自殺・自傷・薬物・賭博・酒の表現がないか
   - 絵文字・カジュアル過ぎる表現がないか
   - 文化的偏見がないか

【判定閾値】
- quality_score >= 80: pass（合格）
- quality_score 60-79: review_needed（再検討）
- quality_score < 60: fail（不合格・再生成）

【出力形式】
必ず以下の JSON スキーマに準拠（Structured Outputs strict:true）。
reasons[] は最大 3 件、各 100 字以内（verbosity bias 回避）。
improvement_hints[] は最大 3 件、各 80 字以内、具体的な修正案。
```

### 2-2. User Prompt

```
以下の問題を採点してください。

{Problem JSON 全体（problem_id 含む）}

採点を開始してください。
```

### 2-3. 出力 JSON スキーマ（zod 強制）

```typescript
export const VerdictSchema = z.object({
  problem_id: z.string(),
  judge_model: z.string(),  // 'claude-sonnet-4-5'
  judged_at: z.string().datetime(),

  quality_score: z.number().int().min(0).max(100),
  verdict: z.enum(['pass', 'fail', 'review_needed']),

  // 観点別スコア（rubric の透明性）
  scores: z.object({
    correctness: z.number().int().min(0).max(40),
    distractors: z.number().int().min(0).max(20),
    difficulty: z.number().int().min(0).max(20),
    copyright: z.number().int().min(0).max(10),
    kid_safety: z.number().int().min(0).max(10),
  }),

  reasons: z.array(z.string().min(5).max(100)).max(3),
  improvement_hints: z.array(z.string().min(5).max(80)).max(3),
});
```

### 2-4. Bias 回避策（W1 TASK-A の cross-LLM judge research[^16] に基づく）

| Bias 種別 | 影響 | 本案件の対策 |
|-----------|------|-------------|
| **Position bias** | 選択肢の順序で正答位置に偏り（GPT-4 で 40% 不一致[^16]） | 採点前に **choices 順序を固定（A=B=C=D 入れ替え不可）** + 生成側で **正答ラベルを 0/1/2/3 均等分布** |
| **Verbosity bias** | 長文の方が高評価される傾向（〜15% inflation[^16]） | reasons / hints の文字数上限を厳格化（100/80 字）、quality_score は categorical integer scoring（categorical な観点別 0-40 / 0-20 等） |
| **Self-preference bias** | LLM が同じファミリーを高評価する傾向 | **gpt-5-mini が生成 → Claude Sonnet 4.5 が採点**（cross-family）= 標準[^16] |
| **Calibration drift** | 同一問題でも実行ごとに ±5 点ぶれる | quality_score は categorical な閾値（80/60）で離散化、ぶれが pass/fail に直結しない |

---

## 3. 決定論的 QA（第2次防衛線）

### 3-1. 重複検出

#### アルゴリズム

```typescript
// OpenAI text-embedding-3-small を使用（$0.02/1M token・1536 次元）
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: problems.map(p => `${p.question}\n${p.choices?.join('|')}\n${p.passage ?? ''}`),
});

// pgvector / Turso vector 拡張で類似度検索
// SELECT problem_id FROM problems
//   WHERE vector_cosine_distance(embedding, $1) < 0.08
//   AND problem_id != $2  -- 自分自身を除外
//   AND level = $3 AND skill = $4;  -- 同じ級・技能内のみ重複扱い
```

#### 閾値

- **cosine similarity ≥ 0.92**（= cosine distance ≤ 0.08）= 重複扱い → fail / 再生成キュー
- 閾値根拠: text-embedding-3-small で「同じ問題の言い換え」「文法ポイント同一・語彙ほぼ同じ」が概ね 0.92 以上[^17]
- **キャリブレーション**: Phase 1 開始 1 週間で 100 問サンプリング → 0.85 / 0.90 / 0.92 / 0.95 で人手判定一致率を見て微調整

### 3-2. 設問形式バリデーション

```typescript
function validateProblemFormat(p: Problem): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // 4 択 skill のチェック
  if (['vocab', 'grammar', 'reading', 'listening'].includes(p.skill)) {
    if (!p.choices || p.choices.length !== 4) errors.push('choices must be exactly 4');
    if (p.correct === undefined || p.correct < 0 || p.correct > 3) errors.push('correct index invalid');

    // 選択肢の文字数バランス（最長 / 最短 比 が 3 倍以内）
    const lens = p.choices?.map(c => c.length) ?? [];
    const max = Math.max(...lens), min = Math.min(...lens);
    if (max / Math.max(min, 1) > 3) errors.push('choice length imbalance');

    // 各選択肢 5-40 字（vocab/grammar）/ 5-120 字（reading/listening 質問）
    const limit = ['vocab', 'grammar'].includes(p.skill) ? 40 : 120;
    if (lens.some(l => l < 1 || l > limit)) errors.push('choice length out of range');
  }

  // listening は audio_script 必須
  if (p.skill === 'listening' && !p.audio_script) errors.push('listening requires audio_script');

  // reading は passage 必須
  if (p.skill === 'reading' && !p.passage) errors.push('reading requires passage');

  // writing は writing_prompt + model_answer + rubric 必須
  if (p.skill === 'writing') {
    if (!p.writing_prompt || !p.model_answer || !p.rubric) errors.push('writing fields missing');
  }

  // 解説 20-800 字
  if (p.explanation.length < 20 || p.explanation.length > 800) errors.push('explanation length out of range');

  return { ok: errors.length === 0, errors };
}
```

### 3-3. メタデータ完全性チェック

```typescript
function validateMetadata(p: Problem): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const expectedCefr = { '5': 'A1', '4': 'A2', '3': 'B1' };
  if (p.metadata.cefr !== expectedCefr[p.level]) errors.push('cefr mismatch with level');
  if (p.metadata.target_vocab.length === 0) errors.push('target_vocab empty');
  if (!p.metadata.estimated_time_sec || p.metadata.estimated_time_sec < 10) errors.push('estimated_time_sec invalid');
  return { ok: errors.length === 0, errors };
}
```

---

## 4. オーナー抜き取り 5%（DEC-011 既定）

### 4-1. 抜き取り対象選定

- **各級各技能から 5%** = 5級 400×5% + 4級 500×5% + 3級 700×5% = 20 + 25 + 35 = **80 問**（DEC-011 試算と一致）
- 抜き取り基準: **quality_score 60-79 review_needed の問題を優先**、残り枠は pass の問題から **ランダムサンプリング**

### 4-2. オーナー QA UI 設計

#### `/owner/qa` ダッシュボード

```
┌──────────────────────────────────────┐
│ オーナー QA モード（80 問サンプル）   │
│ 進捗: 23 / 80 問   平均 quality 87.4 │
├──────────────────────────────────────┤
│ [PRB-7H3K9P2A] 3 級 / vocab          │
│ verdict: review_needed (74)          │
│                                       │
│ Q: Mike ___ a book yesterday.        │
│ ① reads  ② read  ③ reading  ④ readed │
│ 正解: ②                              │
│ 解説: yesterday なので過去形 read... │
│                                       │
│ Sonnet 4.5 採点理由:                 │
│ - readed は明らかな誤りで distractor│
│   としてやや弱い                     │
│                                       │
│ [✓ 合格] [✕ 問題あり（再生成）]      │
│ [📝 修正案を入力]                     │
└──────────────────────────────────────┘
```

#### キーボードショートカット

- `J` 次の問題へ
- `K` 前の問題へ
- `A` 合格（pass で承認）
- `D` 不合格（人手レビューキューへ）
- `R` 再生成キューへ
- `F` フラグ + コメント記入

### 4-3. DB スキーマ（追加）

```sql
-- 既存 problems テーブルに追加
ALTER TABLE problems ADD COLUMN generation_quality_score INTEGER;  -- Sonnet 4.5 のスコア
ALTER TABLE problems ADD COLUMN qa_verdict TEXT;  -- 'pass' | 'fail' | 'review_needed'
ALTER TABLE problems ADD COLUMN owner_reviewed_at DATETIME;
ALTER TABLE problems ADD COLUMN owner_verdict TEXT;  -- 'approved' | 'rejected' | 'needs_fix'
ALTER TABLE problems ADD COLUMN regeneration_count INTEGER DEFAULT 0;

-- 採点履歴
CREATE TABLE qa_verdicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id TEXT NOT NULL,
  judge_model TEXT NOT NULL,  -- 'claude-sonnet-4-5'
  judged_at DATETIME NOT NULL,
  quality_score INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  scores_json TEXT NOT NULL,  -- {correctness, distractors, difficulty, copyright, kid_safety}
  reasons_json TEXT NOT NULL,  -- string[]
  hints_json TEXT NOT NULL,    -- string[]
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id)
);

-- 人手フラグ
CREATE TABLE problem_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id TEXT NOT NULL,
  flagged_by TEXT NOT NULL,  -- 'owner' | 'learner_uuid' | 'ai_coach'
  flag_type TEXT NOT NULL,   -- 'wrong_answer' | 'unclear' | 'too_hard' | 'too_easy' | 'inappropriate'
  comment TEXT,
  flagged_at DATETIME NOT NULL,
  resolved_at DATETIME,
  resolution TEXT,  -- 'regenerated' | 'fixed_manually' | 'kept_as_is'
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id)
);
```

### 4-4. 学習者からのフィードバックループ

#### 学習 UI 内「誤問報告ボタン」

- 各問題の解説画面に **「この問題、おかしいかも」** ボタンを設置
- タップで `flag_type` 選択肢: 「答えが違う」「わかりにくい」「むずかしすぎる」「やさしすぎる」「変な内容」
- `problem_flags` テーブルに insert + flag 数が **3 件以上の問題は自動的に再生成キュー**

#### AI コーチ起動の自動フラグ

- AI コーチが解説要求された際、もし **元の解説と矛盾する説明をした** or **「この問題は判断が難しい」と言った** 場合 → 自動 `problem_flags` 追加
- 監視は AI コーチログを夜間バッチで分類

---

## 5. 再生成キュー（fail / review_needed → 再生成）

### 5-1. ワークフロー

```
[generated] gpt-5-mini で生成
  ↓
[ai_judged] Claude Sonnet 4.5 で採点
  ↓
  pass → [owner_sampling]（5% 抽選）→ owner_reviewed → [active]
  fail / review_needed → [regeneration_queue]
  ↓
[regenerating] gpt-5-mini で再生成（同じ seed + improvement_hints を user prompt に追加）
  ↓
再採点 → pass なら [active] / fail なら regeneration_count++
  ↓
regeneration_count >= 3 → [human_review_queue]（オーナー必須レビュー）
```

### 5-2. 実装基盤の選定（Phase 1 W1 推奨）

#### Trigger.dev v3（推奨）[^18]

- **TypeScript 1st class、Drizzle ORM 連携容易**
- 自動リトライ・スケジューリング・チェックポイント内蔵
- Vercel Cron の 10 秒制約を超えた長時間実行 OK
- self-host or managed cloud 両対応
- **Pro tier $20/月から**（初期は self-host 無料運用も可）

```typescript
// trigger/regenerate-problem.ts
import { task } from '@trigger.dev/sdk/v3';
import { db } from '@/lib/db';

export const regenerateProblem = task({
  id: 'regenerate-problem',
  retry: { maxAttempts: 3, factor: 2 },
  run: async (payload: { problem_id: string; hints: string[] }) => {
    const problem = await db.query.problems.findFirst({ where: { problem_id: payload.problem_id } });
    if (!problem) throw new Error('not found');
    if (problem.regeneration_count >= 3) {
      // 人手レビューキューへ
      await db.update(problems).set({ status: 'human_review' }).where({ problem_id: payload.problem_id });
      return { moved_to: 'human_review' };
    }

    // 再生成
    const newProblem = await generateProblem({
      level: problem.level,
      skill: problem.skill,
      improvement_hints: payload.hints,
    });

    // 再採点
    const verdict = await judgeProblem(newProblem);

    // DB 更新 + verdict 履歴 insert
    await db.transaction(async (tx) => {
      await tx.update(problems).set({
        ...newProblem,
        regeneration_count: problem.regeneration_count + 1,
        qa_verdict: verdict.verdict,
        generation_quality_score: verdict.quality_score,
      });
      await tx.insert(qa_verdicts).values(verdict);
    });

    return { regenerated: true, verdict: verdict.verdict };
  },
});
```

#### 代替: Vercel Cron + Inline（Phase 1 当初）

- **Vercel Pro なら 5 分制限**まで可（Hobby 10 秒制約は DEC-013 の Pro 移行で解消）
- 1 問単位で並列実行（バッチ 10 件 / 5 分など）
- Trigger.dev 不要で Phase 1 開始時のシンプルさ優先

### 5-3. 再生成回数上限と人手レビュー

| 再生成回数 | 自動アクション |
|-----------|---------------|
| 0 → 1 | improvement_hints + seed 変更で再生成 |
| 1 → 2 | improvement_hints + system prompt の制約強化（出題範囲再指定）で再生成 |
| 2 → 3 | improvement_hints + 別モデル（gpt-5.4-mini フォールバック）で再生成 |
| **3 失敗** | **status='human_review' に移管、オーナー手動レビュー必須** |

---

## 6. 各層のスループット試算（Phase 1 全期間）

| Stage | 1 問あたり | 1,600 問合計 | 担当 |
|-------|-----------|-------------|------|
| 生成（gpt-5-mini） | 3-5 秒 | 80-130 分 | 自動 |
| AI 採点（Sonnet 4.5） | 4-6 秒 | 110-160 分 | 自動 |
| 決定論的 QA（embedding + format） | 1-2 秒 | 30-55 分 | 自動 |
| **小計（自動部分）** | – | **約 4-6 時間 / 1,600 問** | – |
| オーナー抜き取り 5% | 30-60 秒 / 問 | 80 問 × 45 秒 = **60 分** | オーナー（DEC-011 では 80 日に分散 = 1 日 5 分） |
| 再生成（推定 1.3 ラウンド） | 同上 | +30-50% 工数 | 自動 |

→ **Phase 1 W1-W2 で生成パイプライン構築 → W3-W6 で 1,600 問逐次生成 + 採点 + 検収を回す**スケジュールで成立。

---

## 7. 結論 & 上申

### 7-1. DEC-011 への影響（精緻化のみ・修正不要）

- **AI 自動生成 + cross-LLM judge + 決定論的 QA + オーナー抜き取り 5%** の 4 層パイプラインを実装可能仕様レベルで詳細化
- **コスト**: research-w1-models.md で確認済み（¥1,500-3,500）
- **DB スキーマ追加**: `qa_verdicts` テーブル + `problem_flags` テーブル + `problems` 5 カラム拡張 → Dev 部門 W1 後半の ER 図 v1 へ反映

### 7-2. Dev 部門への引き継ぎ事項

1. ProblemSchema / VerdictSchema を `lib/schemas/problem.ts` として実装
2. `lib/ai/generate-problem.ts` / `lib/ai/judge-problem.ts` の 2 関数（AI SDK 利用）
3. Trigger.dev v3 導入 or Vercel Cron + Inline の選択（Phase 1 当初は Cron + Inline 推奨）
4. ER 図 v1 に `qa_verdicts` / `problem_flags` を追加
5. オーナー QA ダッシュボード `/owner/qa` の UI スケルトン

### 7-3. オーナー上申なし（仕様確定済み）

---

## 参考文献

[^1]: PRJ-016 decisions.md DEC-011（問題プール戦略変更）
[^2]: research-w1-models.md（gpt-5-mini / Sonnet 4.5 仕様 + コスト試算）
[^3]: research-phase0.md §1（英検級別出題範囲・公式採点基準）
[^4]: research-phase0.md §7（問題プール AI 生成パイプライン）
[^5]: [Structured model outputs | OpenAI API](https://developers.openai.com/api/docs/guides/structured-outputs)
[^6]: [Vector embeddings | OpenAI API](https://platform.openai.com/docs/guides/embeddings)
[^7]: [How do I use embeddings for duplicate detection? - Zilliz](https://zilliz.com/ai-faq/how-do-i-use-embeddings-for-duplicate-detection)
[^8]: [Text Embeddings with OpenAI: A Practical Engineer's Guide for 2026 - TheLinuxCode](https://thelinuxcode.com/text-embeddings-with-openai-a-practical-engineers-guide-for-2026/)
[^9]: [LLM-as-Judge: A Practical Guide (2026) | SurePrompts](https://sureprompts.com/blog/llm-as-judge-prompting-guide)
[^10]: [Rubric-Based Evaluations & LLM-as-a-Judge - Medium 2026](https://medium.com/@adnanmasood/rubric-based-evals-llm-as-a-judge-methodologies-and-empirical-validation-in-domain-context-71936b989e80)
[^11]: [LLM-As-Judge: 7 Best Practices & Evaluation Templates - Monte Carlo](https://www.montecarlodata.com/blog-llm-as-judge/)
[^12]: [LLM-as-a-Judge - Langfuse Docs](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge)
[^13]: [LLM as a Judge: A 2026 Guide to Automated Model Assessment - Label Your Data](https://labelyourdata.com/articles/llm-as-a-judge)
[^14]: [Trigger.dev v3 - Improved Background Jobs](https://github.com/triggerdotdev/trigger.dev/discussions/784) / [Trigger.dev product page](https://trigger.dev/product)
[^15]: [Next.js Background Jobs: Inngest vs Trigger.dev vs Vercel Cron - HashBuilds](https://www.hashbuilds.com/articles/next-js-background-jobs-inngest-vs-trigger-dev-vs-vercel-cron)
[^16]: [Anthropic Pricing Docs - Sonnet 4.5 / 4.6 / Opus 4.7](https://platform.claude.com/docs/en/about-claude/pricing)
[^17]: [Best Embedding Models & APIs in 2026 - DeployBase](https://deploybase.ai/articles/best-embedding-models)
[^18]: [Trigger.dev cron tasks docs](https://trigger.dev/docs/tasks/scheduled)

---

**調査完了**: 2026-04-26 / リサーチ部門 / W1 TASK-C
