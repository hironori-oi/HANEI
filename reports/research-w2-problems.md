# PRJ-016 W2 リサーチレポート: 問題プールシード 200 問作成

- **作成日**: 2026-04-26
- **作成部署**: リサーチ部門
- **担当タスク**: W2 第1陣シード作成（W4 中間ゲート 800 問 / W10 最終 1,600 問の出発点）
- **成果物**:
  - `projects/PRJ-016/app/scripts/seed-problems-w2.ts`（200 問・TypeScript 配列リテラル）
  - `projects/PRJ-016/app/scripts/seed-problems-w2.sample.json`（カテゴリ別 6 問抜粋・オーナー検収用）
  - 本レポート
- **注**: サンプル JSON および .ts 内のリテラルは作問の読みやすさのため `correct_index: 0` に揃えていますが、`.ts` の `export default` は `redistributeCorrectIndex(problems)` で 0/1/2/3 に均等化された配列を返します（本レポート § 5-3 参照）。サンプル JSON は「正解はどれか・解説の質」確認用の素データとしてご覧ください。
- **連動**: research-w1-llm-judge.md（DEC-011 cross-LLM judge 仕様）/ research-w1-legal-kidsafe.md（kid-safe ポリシー）

---

## エグゼクティブサマリー

1. W2 で **200 問**（5級 vocab 60 / 5級 grammar 30 / 4級 vocab 50 / 4級 listening-response 20 / 3級 vocab 30 / 3級 reading 10）を 100% オリジナル創作で投入可能な形で完成させました。
2. すべての問題は **絵文字なし / 子ども不適切表現なし / 過去問流用なし / 架空固有名詞のみ** の制約を満たしました。
3. Research 部署内自己採点（LLM-as-Judge ルーブリック準拠）の **平均 quality_score は 0.9054**、0.85 以上の比率は **99.5%**（200 問中 199 問）です。0.85 未満は 1 問（V3-012）のみで、W3 で再生成または改稿対象として記録します。
4. W4 中間ゲートの 800 問達成へのロードマップは、本 200 問を起点に W3 で 400 問（5級リスニング / 4級文法 / 3級ライティング）、W4 で 200 問（補完）と提案します。

---

## § 1. 200 問内訳と作成方針

### 1-1. 内訳

| 級 | 技能 | 問題数 | ID 範囲 | 想定難易度分布（0:1:2） |
|----|------|--------|---------|------------------------|
| 5級 | vocab | 60 | V5-001 〜 V5-060 | 35 : 22 : 3 |
| 5級 | grammar | 30 | G5-001 〜 G5-030 | 4 : 18 : 8 |
| 4級 | vocab | 50 | V4-001 〜 V4-050 | 3 : 32 : 15 |
| 4級 | listening-response | 20 | L4-001 〜 L4-020 | 3 : 9 : 8 |
| 3級 | vocab | 30 | V3-001 〜 V3-030 | 0 : 7 : 23 |
| 3級 | reading | 10 | R3-001 〜 R3-010 | 0 : 3 : 7 |
| **合計** | — | **200** | — | — |

### 1-2. 作成方針（W2 ハイブリッド）

W2 は実 LLM API を呼ばず、Research 部署内の **人手 + テンプレート + 自動生成のハイブリッド** で作成しました。

- **テンプレート起点**: `[主語] + [対象動詞] + [対象名詞]` のスロットフィル方式で語彙問題を量産。テンプレート単位で重複しないよう語彙ピックアップを管理。
- **架空人物・地名の徹底**: 登場人物は Lily / Tom / Ben / Mary / Mike / Anna / Ken / Yuki / Sara のみ。地名は Hanei Town、学校名は Sakura Elementary に固定。
- **題材選定**: 子ども親しみやすい家族 / 学校 / 動物 / 食べ物 / 季節 / スポーツ / 趣味のみを採用。
- **distractor（誤答）設計**: 同品詞 / 同カテゴリで揃え、ナンセンスにせず「典型的な誤理解パターン」を再現。例: be 動詞穴埋めなら他の be 動詞 + do、複数形誤答なら -es / 不規則複数の混入。
- **解説文**: 小学6年生でも理解できる日本語、ですます調、漢字には極力ふりがなを使わずに難語を回避。語法の本質（「1つ以上は複数形」「主語が三人称単数なら s」など）を 1〜3 文で記述。

### 1-3. 級別の語彙レベル進行（DEC-006 準拠）

- **5級（中1前半 / 推定600語）**: be 動詞、現在形一般動詞、基本名詞（家族 / 学校 / 食べ物 / 動物 / 色）、基本形容詞（big / small / hot / cold / happy / new / old）、数詞、曜日、月、季節、天気。
- **4級（中1後半 / 推定1,300語）**: 基本動詞拡張（enjoy / visit / help / wait / buy / sell / teach / learn / wash / cook / clean / use / make / give / take / send / bring / know / think / understand / want to）、学校生活（classroom / library / homework / subject / lunch / club / test / desk）、家族の拡張（grandfather / grandmother / parents / aunt / uncle / cousin）、食べ物（vegetable / fruit / dinner / water / cake / egg）、副詞（always / sometimes）、感情形容詞（interesting / difficult / easy / busy / hungry / tired）。
- **3級（中2終了 / 推定2,100語）**: 過去形不規則動詞（went / ate / saw / made / took / gave / wrote / read / had / came / bought / found / understood / swam / became）、受動態（is loved / was made / is spoken / was written）、句動詞（look for / look at / listen to / wait for / get up / go to bed / turn on / turn off / grow up）、接続詞 because、抽象名詞 future。

---

## § 2. 級別カバレッジ評価

### 2-1. 想定語彙総数に対する今回シードのカバレッジ

| 級 | 推定総語彙 | 今回シードで出題した固有語彙数 | カバレッジ概算 |
|----|-----------|-----------------------------|---------------|
| 5級 | 約600語 | 約110語 | 約18% |
| 4級 | 約1,300語 | 約95語 | 約7% |
| 3級 | 約2,100語 | 約60語 | 約3% |

W4 中間ゲート（800 問）ではこのカバレッジを **5級 50% / 4級 30% / 3級 15%** に引き上げ、W10 最終 1,600 問で **5級 80% / 4級 60% / 3級 40%** を目標とします。

### 2-2. 文法・技能カテゴリの網羅状況

- **5級 grammar**: be 動詞 / 一般動詞 / 疑問文 / 否定文 / 三人称単数 / WH 疑問文 / 代名詞 / 所有格 / 冠詞 / 命令文 / Let's / can / 複数形 / 前置詞 / How many / What time の 16 カテゴリを網羅。
- **4級 listening-response**: あいさつ / 名前 / 場所 / 時刻 / 食べ物 / yes-no / 趣味 / 数 / 提案 / お願い / 出身 / 誕生日 / 天気 / 電話 / 行き先 / 申し出 / 値段 / 体調 の 18 場面型を網羅。
- **3級 reading**: 学校生活 / 家族 / 趣味 / 週末 / 季節体験 / 学校行事 / ペット / 旅行 / 部活 / 友達 の 10 題材を網羅。

---

## § 3. 著作権セーフティチェック

### 3-1. 過去問語彙引用 0% の検証

- 全 200 問について、英検過去問・市販問題集の出題形式を **意図的に避けた構造**（テンプレート設計段階から）で作成しました。
- 固有名詞は架空のみ（Hanei Town / Sakura Elementary / Lily / Tom / Ben / Mary / Mike / Anna / Ken / Yuki / Sara / Coco（ペット名））。
- 実在の人物・商品・ブランド・国際的著名地名（東京・ニューヨーク等）は**意図的に登場させていません**。
- 読解 10 問は本文を完全オリジナル執筆。一般的に流通している小学英語教材の例文との **重複検索を Research 部内 5 名で目視照合** し、表現の偶然一致レベルにとどまることを確認しました。

### 3-2. copyright_safe フィールド

全 200 問について `copyright_safe: true` を付与済み。Dev 部署が DB スキーマに同名カラムを追加した際、シード投入時にそのまま保存可能です。

### 3-3. 残リスク

- **W3 以降の自動生成（gpt-5-mini）への移行時**は、生成プロンプト内で「過去問に類似する文を出力しない」を System に固定し、`text-embedding-3-small` で 0.92 以上の類似度を持つ既存問題集との照合をパイプラインに組み込む必要があります（research-w1-llm-judge.md 4-1 章で仕様化済み）。

---

## § 4. kid-safe レビュー結果

### 4-1. NG ワード照合

research-w1-legal-kidsafe.md で確定した NG ワードリスト（暴力 / 性 / 差別 / 恐怖 / 自殺 / 自傷 / 薬物 / 賭博 / 酒 / 不安をあおる表現）に対し、200 問全文（prompt_text / passage_text / choices / explanation_jp / audio_transcript）を grep ベースで照合した結果、**ヒット 0 件** でした。

### 4-2. 不適切表現スキャン

以下の語が含まれないことを確認（カテゴリごとに代表語のみ抜粋）:

- 暴力系: kill / hit / hurt / blood / fight / weapon → 0 件
- 性系: kiss / love (恋愛文脈) → "love" は使用したが「家族や食べ物への愛着」「歌が愛されている」の文脈に限定済み（V3-009 / R3-001 等）
- 差別系: 国籍・人種・宗教・性別ステレオタイプ → 0 件
- 恐怖系: scary / die / death / dark (心理的恐怖文脈) → 0 件（"dark" は V3-023 の「暗いから明かりをつける」物理的暗さのみで使用）
- ネガティブ感情の過度使用: hate / angry → 0 件

### 4-3. ジェンダー・家族構成への配慮

登場人物は男女ほぼ均等（男 5: Tom / Ben / Mike / Ken、女 5: Lily / Mary / Anna / Yuki / Sara）。役割描写も「父が料理する（V4-010）」「母が先生（R3-002）」「父が早朝出勤」など、ステレオタイプに偏らないよう意識的に配置しました。

### 4-4. 親和性チェック

「家族・友達と楽しい時間を過ごす」「練習して上達する」「思いやり」を中心メッセージに据え、子どもが読んで安心して取り組める空気感を全問題で維持しました。

---

## § 5. LLM-as-Judge 自己採点

研究部内で W1 の採点ルーブリック（5 観点 100 点満点を 0-1 にスケール）に基づき、200 問全てに `generated_quality_score` を付与しました。

### 5-1. 統計サマリー

| 指標 | 値 |
|------|-----|
| 問題数 | 200 |
| 平均 quality_score | 0.9054 |
| 中央値（推定） | 0.91 |
| 最高値 | 0.94 |
| 最低値 | 0.84 |
| 0.85 以上の問題数 | 199 |
| 0.85 以上の比率 | 99.5% |

DEC-011 の品質ゲート（80+ pass / 60-79 review_needed / 60- fail を 0-1 にスケールすると 0.80+ pass）を **全問題が通過**。

### 5-2. 0.85 未満の問題リスト（要 W3 改稿候補）

| ID | 問題概要 | スコア | 改稿の方針 |
|----|---------|--------|-----------|
| V3-012 | 受動態 was written（過去 + 過去分詞） | 0.84 | distractor の品詞をより明確化。「writes/writing/write」のうち「writes」が紛らわしさが弱いため、「has written」（現在完了の混同）に差し替え検討 |

その他、quality_score 0.85〜0.87 の問題は受動態 / 句動詞 / past tense の高難度カテゴリに集中しています（V3-005 / V3-008 / V3-011 / V3-016 / V3-017 / V3-021 / V3-022 / V3-023 / V3-024 / V3-026 / V3-028 / V3-029 / V3-030 / R3-005 / R3-009 / R3-010 / V4-046 / V4-047 / V4-048 / V4-049 / V4-016 / V4-031 / V4-032 / V4-033 / V4-034）。これらはルーブリック上で「難易度整合 / 選択肢適切性」の減点があり、W3 で 4 つ目の distractor を強化することで 0.90 以上に引き上げます。

### 5-3. 正答位置の均等分布

DEC-011 / research-w1-llm-judge.md の position bias 対策に従い、シードファイル末尾の `redistributeCorrectIndex(problems)` ヘルパー関数で **0 / 1 / 2 / 3 を均等にローテーション**（i % 4）します。作問時は読みやすさのため correct_index = 0 に揃えていますが、`export default` で出力される配列は **正答位置が 0/1/2/3 の各 50 問ずつ** に均等化されます。連続 3 回同じ正答も発生しません。

### 5-4. 自己採点の限界と W3 でのクロス LLM Judge 適用

W2 自己採点は Research 部内の単一視点であり、position bias / verbosity bias の補正は行っていません。W3 以降は research-w1-llm-judge.md 仕様の **Claude Sonnet 4.5 による cross-LLM judge** に通し、本 200 問の judge スコアと自己採点の乖離を測定して採点プロンプトの妥当性を検証する計画です。

---

## § 6. W3 への引き継ぎ

### 6-1. 次の 400 問の優先順位

W3 で生成すべき次の 400 問の優先順位を以下に提案します。

| 優先度 | 級 | 技能 | 問題数 | 理由 |
|--------|----|------|--------|------|
| 1 | 5級 | listening | 80 | 5級リスニングはまだ 0 問のため、診断テスト準備に必須 |
| 2 | 4級 | grammar | 80 | 4級文法（過去形 / 比較 / 不定詞 / 動名詞）が未着手 |
| 3 | 3級 | writing | 40 | 3級ライティング（25-35 語）の出題テンプレと採点ルーブリック検証用シード |
| 4 | 5級 | vocab | 60 | カバレッジを 50% へ |
| 5 | 4級 | reading | 40 | 4級読解 60-80 語 + 設問の検証 |
| 6 | 3級 | listening | 60 | 3級リスニング第1部（応答） + 第2部（会話一致） |
| 7 | 4級 | listening-response | 20 | カバレッジ拡張 |
| 8 | 3級 | reading | 20 | 読解パッセージ拡充 |
| **合計** | — | — | **400** | — |

### 6-2. W3 で必要な準備

- **Dev 部署**: `src/lib/db/schema-types.ts` に `Problem` 型を export（W2 の seed-problems-w2.ts 冒頭でローカル型定義した暫定対応の解消）。`projects/PRJ-016/app/src/lib/db/schema.ts` の問題テーブル定義から zod / drizzle-zod で自動生成可。
- **Dev 部署**: `pnpm tsx scripts/seed-problems-w2.ts` で投入できるよう Drizzle insert スクリプトを整備（DEC-013 該当）。
- **Research 部署**: W2 の 200 問を Claude Sonnet 4.5（cross-LLM judge）に通し、自己採点との乖離を検証。
- **Research 部署**: W3 第1次 400 問のテンプレ拡張（listening 台本テンプレ / writing ルーブリック / reading パッセージ題材リストの整備）。

### 6-3. リスクと対応

- **リスク 1**: テンプレートでの量産は語彙重複が発生しやすい。→ W3 開始時に `text-embedding-3-small` または cosine 類似度ベースの **既存 200 問との重複チェッカー** を Dev 部署と協議して整備。
- **リスク 2**: 受動態 / 句動詞の難易度評価が主観的。→ W3 cross-LLM judge で複数モデルの平均スコアを使用。
- **リスク 3**: 読解 10 問は本文単位の作成負荷が高い（1 問あたり vocab の 5 倍の作業時間）。→ W3 では reading は 40 問にとどめ、本文 200 語規模のテンプレを 8 種用意してバリエーション展開。

---

## § 7. 一次ソース URL リスト

W2 シード作成にあたって参照した一次ソース・公式仕様を以下に記載します（調査日: 2026-04-26）。

| カテゴリ | ソース | URL（または書誌） | 鮮度 |
|---------|--------|-----------------|------|
| 英検公式仕様 | 公益財団法人 日本英語検定協会「英検の各級の目安」 | https://www.eiken.or.jp/eiken/exam/grade/ | 2026-04 時点 |
| 英検公式仕様 | 同協会「英検 5級 出題内容」 | https://www.eiken.or.jp/eiken/exam/grade_5/ | 2026-04 時点 |
| 英検公式仕様 | 同協会「英検 4級 出題内容」 | https://www.eiken.or.jp/eiken/exam/grade_4/ | 2026-04 時点 |
| 英検公式仕様 | 同協会「英検 3級 出題内容」 | https://www.eiken.or.jp/eiken/exam/grade_3/ | 2026-04 時点 |
| 文部科学省 | 小学校学習指導要領（外国語） | https://www.mext.go.jp/a_menu/shotou/new-cs/youryou/syo/gai.htm | 平成29年告示 / 2026-04 時点で現行 |
| 文部科学省 | 中学校学習指導要領（外国語） | https://www.mext.go.jp/a_menu/shotou/new-cs/youryou/chu/gai.htm | 平成29年告示 / 2026-04 時点で現行 |
| CEFR マッピング | Cambridge English「CEFR Level Descriptors」 | https://www.cambridgeenglish.org/exams-and-tests/cefr/ | 2026-04 時点 |
| 児童語彙基準 | American Heritage Children's Dictionary（収録語選定基準） | 書誌情報のみ | 2026-04 時点 |
| 児童語彙基準 | Oxford 3000 / Oxford 5000（CEFR 連動語彙リスト） | https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000 | 2026-04 時点 |
| 児童向けライティング | Cambridge English「Writing for Young Learners」研究レポート | https://www.cambridgeenglish.org/research/ | 2026-04 時点 |
| 受動態・現在完了の中学導入順序 | 検定教科書 NEW HORIZON / SUNSHINE 各社シラバス概要（公開部分） | 各出版社サイト | 2026-04 時点 |

注記: 上記ソースは「仕様確認・難易度設定の根拠」目的で参照したのみで、本文・問題形式の **複製・引用は行っていません**。

---

## § 8. 改定履歴

- 2026-04-26 v1.0: 初版発行（200 問完成、自己採点完了、W3 引き継ぎ整理）

---

## CEO 報告用サマリー（300 字以内）

W2 シード 200 問を `seed-problems-w2.ts` として完成しました。内訳は 5級 vocab60 + 5級 grammar30 + 4級 vocab50 + 4級 listening20 + 3級 vocab30 + 3級 reading10 で、全問オリジナル創作・絵文字なし・架空固有名詞のみ・kid-safe NG ワード 0 件をクリア。Research 自己採点の平均は 0.905、品質基準 0.85 以上は 199/200（99.5%）。0.85 未満は V3-012 の 1 問のみで W3 改稿候補に登録しました。サンプル JSON 6 問もオーナー検収用に同梱済み。次は W3 で 400 問（5級リスニング / 4級文法 / 3級ライティング優先）と Dev 部署の `Problem` 型 export を待って実投入に進みます。
