# PRJ-016 HANEI キャラクターデザインガイド「ことだまトリ」（W1）

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W1 キャラクター制作開始（生成プロンプト + ガイドライン）
- **DEC 連携**: DEC-004（ことだまトリ採用）/ DEC-012（無料運用 = 制作コスト最小化）

---

## 1. キャラクター設定

### 1.1 名前

**ことだまトリ**（kotodama-tori / 言霊鳥）

「**言葉（ことば）**」と「**言霊（ことだま）**」を組み合わせた名前。日本古来の「言葉には魂が宿る」という言霊思想と、英語の言葉を運ぶ小さな鳥のメタファー。

### 1.2 設定（バックストーリー）

> 「ことだまトリは、世界中の言葉の魂を集めて運ぶ、小さくて優しい鳥です。
> 英語という新しい言葉に出会う子どもたちの隣で、言葉のひとつひとつが持つ力（言霊）を伝えていきます。
> 急がせたりはしません。怒ったりもしません。
> 半年という時間を、子どもといっしょに、ゆっくり・しっかり・たのしく、歩いていきます。」

### 1.3 役割

- **AI コーチの可視化**: GPT-5 mini の応答を ことだまトリ のセリフとして表示
- **学習中の伴走者**: 正解時の喜び / 不正解時のやさしい訂正 / 連続記録の祝福
- **保護者にも信頼される存在感**: かわいいだけでなく、品の良さ・知性を感じる造形

### 1.4 性格・トーン

| 軸 | 方向 |
|---|---|
| 落ち着き | 高（焦らせない / 罪悪感誘導しない） |
| 励まし | 高（プロセスを褒める / 比較は過去の自分） |
| 知性 | 中〜高（賢いが偉そうではない） |
| ユーモア | 控えめ（暴走しない、品を保つ） |
| 上下関係 | フラット（先生ではなく相棒） |
| 子どもっぽさ | 低（小4〜小6 + 保護者にも違和感ない中性的トーン） |

---

## 2. ビジュアル仕様

### 2.1 基本造形

| 部位 | 仕様 |
|---|---|
| 全体プロポーション | 2.5 頭身、丸み主体、シルエットで一目でそれと分かる強度 |
| 体色（メイン） | Amber Gold `#F2A93A`（DEC-004 確定） |
| 体色（グラデ） | 上半身明るい `#F4B14F` → 下半身落ち着いた `#D78A1A` の柔らかいグラデ（任意） |
| 羽 | Mint `#6FE7C9`（アクセント、両翼の先端のみ） |
| くちばし | 小さめ、暖色 `#F7C16A`（強調しすぎない） |
| 目 | 大きめ、黒目主体（白目少なめ）、ハイライト 2 点で生きた印象 |
| 頭の羽飾り | 小さなアホ毛 1〜2 本（個性付け、HANEI ロゴと連動可能） |
| 足 | 細く短く、橙色 `#D78A1A` |
| 質感 | 紙の絵本のような、わずかにテクスチャあり（ベタ塗りでない） |
| 線 | 線画あり、線色 `#5E3905`（ブランド 900）、太さ控えめ |

### 2.2 表情・ポーズの基準

#### 表情 7 種

| Variant | 用途 | 特徴 |
|---|---|---|
| `idle` | 待機・通常 | 軽くまばたき、自然体 |
| `cheer` | 正解時・励まし | 翼を少し広げ、目が三日月（笑顔） |
| `support` | 応援・励まし | 翼を上げ、顎を上げて前向き |
| `gentle-correct` | 優しく訂正 | 首をかしげ、目はやさしく開く |
| `thinking` | 考え込む | 翼で頬を支え、目をやや細める |
| `level-up` | レベルアップ祝う | 飛び上がり、紙吹雪と共に |
| `sleepy` | 夜の労い・離脱期 | 目を閉じかける、片翼で目をこする |

#### ポーズ 6 種

| Variant | 用途 |
|---|---|
| `standing` | 通常立ち |
| `flying` | 軽く浮いている（メインビジュアル） |
| `sitting-on-card` | 学習カードの上にちょこんと座る |
| `holding-book` | 小さな本を持つ（学習文画面） |
| `pointing` | 翼で前方を指す（ヒント表示） |
| `waving` | 朝・夜の挨拶 |

### 2.3 配色（再掲・実装互換）

| Token | HEX | 役割 |
|---|---|---|
| `--brand-500` | `#F2A93A` | 体メイン |
| `--brand-300` | `#F7C16A` | くちばし・体明部 |
| `--brand-700` | `#B57010` | 線・足 |
| `--mint-500` | `#6FE7C9` | 翼先端 |
| `--ink-900` | `#1F1B16` | 目・線 |
| `--brand-50` | `#FEF6E7` | 目のハイライト |

---

## 3. 生成プロンプト 10 種（gpt-image-2 / Midjourney 共通フォーマット）

> **使用方針**: ムード探索・ラフ作成段階で AI 生成を活用。最終キャラ確定段階は外部イラストレーターに発注（DEC-012 無料運用なので予算最小化、現段階では AI 生成のみで進行する設計）。

### 共通プレフィックス

```
A small, gentle bird character named "Kotodama-tori", 2.5-head proportion, soft amber gold body (#F2A93A) with mint green wing tips (#6FE7C9), large warm eyes with two small highlights, small orange beak (#F7C16A), tiny tuft of hair on top of head, thin orange legs, picture book illustration style, soft paper texture, hand-drawn warm outline, NOT 3D, NOT photorealistic, NOT chibi-style overcute, kid-friendly but with quality and warmth that parents trust, isolated on cream beige background (#FAF6EE)
```

### 共通サフィックス

```
, flat illustration, soft watercolor texture, picture book aesthetic, vector-friendly clean shapes, no text, no logo, no watermark, no signature, suitable for educational app for elementary school kids, gentle Japanese aesthetics
```

### 10 ポーズ・表情プロンプト

#### 1. 喜ぶ（cheer / 正解時）

```
[共通プレフィックス], cheering pose with small wings spread wide, eyes curved into happy crescent shapes, body tilted slightly back in joy, sparkles around but subtle (no confetti), expression of "you got it right!"
[共通サフィックス]
```

#### 2. 励ます（support / 学習開始時）

```
[共通プレフィックス], encouraging pose with one wing raised pointing forward, beak slightly open as if saying "let's go", warm confident eyes, body leaning slightly forward, expression of "I believe in you, let's start"
[共通サフィックス]
```

#### 3. やさしく訂正する（gentle-correct / 不正解時）

```
[共通プレフィックス], head tilted gently to one side, eyes still warm and open (NOT sad, NOT disappointed), one wing softly placed on its own chest, body slightly bowing, expression of "let's look at this together one more time", warm and reassuring NOT scolding
[共通サフィックス]
```

#### 4. 考え込む（thinking / 質問対応中）

```
[共通プレフィックス], thinking pose with one wing on cheek, eyes half-closed in contemplation, head slightly tilted up, small question mark above head (subtle, not cartoonish), expression of "hmm, let me think about that with you"
[共通サフィックス]
```

#### 5. レベルアップ祝う（level-up / 称号獲得）

```
[共通プレフィックス], jumping in mid-air with both wings spread fully, eyes bright and excited, paper confetti around (gold and mint colors), small star above head, expression of pure celebration, dynamic motion lines very subtle, joy of a meaningful milestone
[共通サフィックス]
```

#### 6. 連続記録に火がつく（streak-fire / 連続日数達成）

```
[共通プレフィックス], standing proud with chest puffed slightly, a small warm flame floating beside (golden orange, NOT aggressive red, like a candle flame), eyes determined but gentle, expression of "your streak is growing", flame should look warm and encouraging not threatening
[共通サフィックス]
```

#### 7. 受験日カウントダウン真剣（serious-countdown / 受験 30 日前）

```
[共通プレフィックス], standing straight with both wings down at sides, eyes focused and determined but still warm, holding a small calendar in one wing, expression of "we're getting closer, let's keep our pace", calm seriousness NOT anxiety, NOT pressuring
[共通サフィックス]
```

#### 8. 朝の挨拶（morning-wave / 朝のログイン）

```
[共通プレフィックス], waving cheerfully with one wing, eyes bright and open, body slightly bouncing, soft morning light effect (warm yellow), small dewdrop or sun ray subtle in background, expression of "good morning, ready for today?"
[共通サフィックス]
```

#### 9. 夜の労い（night-rest / 夜のログアウト）

```
[共通プレフィックス], sitting gently with eyes nearly closed, one wing softly waving goodnight, small crescent moon subtle in background, soft purple-blue tint to lighting, expression of "you did well today, sleep well", peaceful and tender
[共通サフィックス]
```

#### 10. 寝顔（sleeping / 離脱期・休憩中）

```
[共通プレフィックス], curled up sleeping pose, eyes fully closed with small "z z z" floating above (gentle and small NOT cartoonish), one wing tucked under head as pillow, breathing softly, expression of complete peace, warm and safe atmosphere
[共通サフィックス]
```

### 3-bonus（追加プロンプト）

#### 11. 保護者ビュー用（trustworthy / 保護者画面）

```
[共通プレフィックス], standing in slightly more formal pose, wings folded politely, eyes warm and intelligent, holding a small open notebook, expression of "your child is doing well", suitable for parent-facing dashboard, slightly more sophisticated and reassuring tone
[共通サフィックス]
```

---

## 4. プロンプトエンジニアリング Tips

### 4.1 NG ワード（生成時に絶対避ける）

- `cute`, `kawaii`, `chibi`, `super cute` — 過度なかわいさ偏重で AI 感が出る
- `sad`, `crying`, `tears`, `disappointed` — 自己肯定感設計に反する
- `red eyes`, `angry`, `scolding` — 子ども向けに不適
- `realistic`, `photorealistic`, `3D render` — 紙質感の世界観に反する
- `complex background` — 単独切り抜き素材として使えなくなる

### 4.2 OK 強調ワード

- `gentle`, `warm`, `soft`, `kind`, `picture book illustration`
- `quality kids book aesthetic`, `Japanese gentle design`
- `soft watercolor texture`, `clean vector-friendly shapes`

### 4.3 反復生成戦略

1. 共通プレフィックス + 1 ポーズプロンプトで **8 枚バッチ生成**
2. 体型・表情・色味の最も整った 1 枚を「マスター」に選定
3. マスター画像を `--cref`（Midjourney）or image-to-image（gpt-image-2）で**参照**しつつ別ポーズを生成
4. 全 10 ポーズの一貫性が取れたら確定

---

## 5. 著作権・商用利用配慮

### 5.1 OpenAI（gpt-image-2）

- **利用規約**: [OpenAI Usage Policies](https://openai.com/policies/usage-policies/) に従う
- **商用利用**: ChatGPT の Plus / Team / Enterprise / API いずれの契約形態でも、生成画像の商用利用は許諾されている（2026-04 時点）
- **所有権**: ユーザーに帰属（OpenAI Terms of Use §7 "Content"）
- **注意**: 既存キャラクター（ディズニー、ポケモン、サンリオ等）に類似する生成は規約違反かつ著作権侵害リスク。プロンプトに既存 IP を一切含めない
- **記載要件**: 商用配布物に「OpenAI で生成」明記の義務はないが、製品プレスリリース等では透明性のため明記推奨

### 5.2 Midjourney

- **利用規約**: [Midjourney Terms of Service](https://docs.midjourney.com/docs/terms-of-service)
- **商用利用条件**: **Standard Plan（$30/月）以上**で生成した画像のみ商用可
- **Basic Plan**: 個人・非商用のみ → HANEI では使用不可
- **所有権**: 有料プラン契約中は生成画像の権利を保有、ただし Midjourney は使用権を保持
- **公開生成**: デフォルトで他ユーザーから閲覧可能 → **Stealth Mode（Pro $60/月以上）でのみ非公開**
- **HANEI 推奨**: コスト最小化方針なので **gpt-image-2 を主軸**、Midjourney は採用見送りでも可

### 5.3 推奨運用

1. **W1 段階**: gpt-image-2 で 10 ポーズすべてのラフ生成（OpenAI API 利用、コスト約 $5〜10）
2. **W2-W3 段階**: 整った 10 ポーズを SVG 化（Adobe Illustrator or AI ベクター変換）
3. **Phase 2 段階**: 公開β拡大時に外部イラストレーターに発注（**著作権譲渡契約**、表情差分追加）
4. **保管**: 生成プロンプト + 元画像 + 編集後 SVG を `projects/PRJ-016/assets/character/` に全バージョン保管（再生成可能性確保）

### 5.4 オリジナリティチェック

公開前に必ず以下を実施:

- [ ] Google 画像検索で「鳥 マスコット」「キャラクター 鳥 アプリ」で逆引き → 既存キャラとの類似なし確認
- [ ] TinEye で生成画像の逆引き → 学習元の特定キャラ流出なし確認
- [ ] 商標 J-PlatPat で「ことだまトリ」検索 → 第 9・41 類で類似商標なし確認（Research 部門 W1 タスク）
- [ ] 既存キッズアプリ（Duolingo Duo / トド英語 / Khan Academy Kids 等）のキャラと造形が明確に異なることを目視確認

---

## 6. 音声設計（Phase 2 検討メモ）

### 6.1 W1 では実装しない

無料運用維持（DEC-012）+ 学習体験の中核に集中するため、Phase 1 では **テキスト + 表情画像のみ**でコーチ表現を完結させる。音声は Phase 2 以降の差別化施策として温存。

### 6.2 Phase 2 候補: ElevenLabs カスタムボイス

| 項目 | 検討内容 |
|---|---|
| サービス | [ElevenLabs Voice Lab](https://elevenlabs.io/voice-lab) |
| 機能 | カスタム TTS ボイスを Voice Cloning or Voice Design で作成 |
| プラン | Creator $22/月（10 万文字 + 商用利用可）/ Pro $99/月（50 万文字） |
| ボイス方向 | 中性的、やや高め、年齢不詳（少年〜青年）、暖かく落ち着いた声 |
| 設定 | Stability 50 / Similarity 75 / Style 0.3（自然・落ち着き） |
| 言語 | 日本語（v3 Multilingual model 対応） |
| 用途 | 朝の挨拶 / 夜の労い / レベルアップ / 重要な励まし（5〜10 セリフのみ事前生成） |

### 6.3 代替案

- **OpenAI TTS-1**（DEC-003 確定済み）: tts-1-hd で `nova` or `shimmer` 声 を採用
  - 既に学習教材音声で採用済みのため、追加コスト 0
  - キャラ性は ElevenLabs ほど出せないが、Phase 1 の最低ラインは満たす
- **Voicy / 自前収録**: 個人開発スコープ外、見送り

### 6.4 Phase 2 受入基準（参考）

- [ ] 「ことだまトリの声」候補 3 種を ElevenLabs で生成、保護者・子ども 5 組でブラインドテスト
- [ ] 日本語イントネーションが不自然でない（特に外来語・地名）
- [ ] 商用利用ライセンス確認済み
- [ ] 1 セリフあたり生成コスト < ¥5（事前生成 + R2 キャッシュで月額 ¥0 運用）

---

## 7. ブランド一貫性ガイドライン

### 7.1 やってよいこと

- 帽子・眼鏡・マフラー等のアクセサリーで装飾（Lv 進度に応じた解禁）
- 季節装飾（クリスマス帽 / 夏の麦わら帽子 等）
- 表情・ポーズの追加（公式バリエーションは中央管理）

### 7.2 やってはいけないこと

- 体色を Amber Gold 以外に変える（ブランド毀損）
- 怒り顔・泣き顔・恐怖顔の追加（自己肯定感設計に反する）
- 戦闘ポーズ・武器・暴力的表現（B案ファンタジーの不採用理由と同様）
- 体型を大幅変更（2.5 頭身 → 5 頭身等）
- 写実的描写・3D 化（紙質感の世界観破綻）

### 7.3 派生キャラ（Phase 2 以降）

DEC-004 ではメインキャラ 1 体（ことだまトリ）に集中、サブキャラは Phase 2 以降。

候補:
- **ことば犬**（語彙担当 / Mint ベース）
- **ミミ**（リスニング担当 / Sky ベース）
- **ノート先生**（文法解説 / Indigo ベース）

派生キャラもこの章 7.1〜7.2 のルールを継承する。

---

## 8. 受入基準（W1 キャラクターゲート）

- [ ] gpt-image-2 で 10 ポーズすべてのラフ画像を生成（最低 8 ポーズが「キャラ識別可能」レベル）
- [ ] Amber Gold + Mint の配色がトークン §1.5 と一致
- [ ] 既存キャラとの類似性チェック（§5.4）クリア
- [ ] 商用利用ライセンスの根拠（§5.1〜5.2）が `decisions.md` に明記される
- [ ] 表情 7 種 × ポーズ 6 種のうち、**主要 5 ポーズ**（idle / cheer / support / gentle-correct / level-up）が画面実装可能な状態（PNG or SVG 切り抜き）
- [ ] アクセシビリティ: キャラ画像には `alt=""`（装飾扱い）または `alt="ことだまトリ"` を一貫して付与する規約を Dev に共有

---

## 9. 次アクション

1. **W1 Day 3-5**: gpt-image-2 で 10 ポーズバッチ生成、`projects/PRJ-016/assets/character/raw/` に保存
2. **W1 Day 5-7**: 整った画像を選定、SVG 化（Illustrator or potrace）、`assets/character/svg/` に投入
3. **W1 完了時**: 5 ポーズ（idle / cheer / support / gentle-correct / level-up）を Dev に渡し、ホーム・学習中画面に組み込む
4. **W2 以降**: 残り 5 ポーズ + アクセサリー差分を順次追加
5. **Phase 2 検討**: ElevenLabs カスタムボイス、サブキャラ 3 体の起案
