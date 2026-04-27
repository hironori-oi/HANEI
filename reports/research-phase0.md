# PRJ-016 Phase 0 リサーチレポート

- **作成日**: 2026-04-26
- **作成部署**: リサーチ部門
- **対象案件**: PRJ-016 小学生向け英語学習Webアプリ
- **真のゴール**: 英語をはじめて学ぶ小学6年生が半年以内に英検3級に合格できる
- **調査方針**: WebSearch / WebFetch を活用、根拠リンクは全て [^n] 形式で巻末に展開

---

## エグゼクティブサマリー（CEO/オーナー向け 5項目）

1. **「半年で英検3級合格」は条件付きで現実的**。アルファベット・フォニックスから始める純ゼロスタートの場合は 200〜300時間の学習が一般的目安[^11][^12]。毎日1時間×6か月=180時間で「ほぼ届く」ラインで、毎日1時間＋週末2時間（合計約210時間）の設計と「英検5級→4級→3級」の段階的合格を中間マイルストーンに据えれば現実的に到達可能。**ただし「英検4級合格者からのスタート」のほうが安全圏**であり、ターゲットを「英検4級レベル → 半年で3級」と「ゼロ → 半年で3級」に分割し、商品ストーリーは「半年で3級」、内部設計は「ゼロからは7〜8か月」が誠実。
2. **gpt-5-mini は 2025-08-07 リリース済み・$0.25/1M入力・$2/1M出力・400Kコンテキスト**[^28][^29]。子ども向け運用でも価格・速度・品質ともに採用に値する。代替候補は gpt-4.1-mini / gpt-4o-mini（よりさらに安価）。**OpenAI Moderation API + 専用 system prompt + 出力フィルタの三重ガード**で運用するのが必須[^32][^33]。
3. **適応学習は MVP では「FSRS（語彙SRS） + IRT 2PL風の難易度推定 + ヒューリスティックBKT」のハイブリッドが最適**。FSRS は 7億レビューで学習済み、SM-2比 20-30% 効率改善[^21]。Duolingo の Birdbrain（IRTベースのロジスティック回帰）が事実上の業界標準で、PoC レベルの再現は数百行のコードで可能[^19]。DKT（深層）は MVP では不要・データ不足で過剰投資。
4. **問題プールは「自社オリジナル AI 生成 + 人手検収」一択**。英検過去問・旺文社編集物の商用利用は協会/出版社の許諾が必要で、無断流用は著作権侵害となる[^25]。Phase 1 で 5級1500問・4級2000問・3級2500問（合計 約6000問）を gpt-5-mini で生成→英語講師（ココナラ等で確保）が抜き取りQA→主席エディタが最終承認、というパイプラインを Phase 0 で確立する。
5. **無料運用維持は「Vercel Hobby + Supabase Free」だと 50〜100名規模が上限**。Vercel Hobby は商用利用禁止[^36]、500MB DB[^37]、100GB 帯域。**有料前提の現実解は Vercel Pro $20 + Supabase Free（または Pro $25）+ OpenAI 従量** で月額 50〜100名で約 ¥8,000〜15,000、500名で ¥30,000〜60,000 程度。「無料で 100名」は技術的には可能だが、Vercel Hobby の商用禁止条項に抵触するため、有償サービス化前提なら最初から Pro 必須。

---

## 1. 英検5/4/3級 出題範囲の体系化（一次ソース確認済み）

### 1-1. 級別レベル・語彙数・想定対象

| 級 | 想定レベル | 推定語彙数 | 一次試験技能 | 二次試験 | 出典 |
|----|-----------|-----------|--------------|----------|------|
| 5級 | 中学初級程度 | 約600語 | リーディング・リスニング（任意でスピーキング） | なし（録音式スピーキングテストは級認定外） | [^1][^4][^7] |
| 4級 | 中学中級程度 | 約1,300語 | リーディング・リスニング（任意でスピーキング） | なし | [^4][^7] |
| 3級 | 中学卒業程度 | 約2,100語 | リーディング・ライティング・リスニング | あり（面接形式の英語インタビュー約5分） | [^2][^4][^7] |

### 1-2. 英検3級 一次試験 構成（公式仕様）

| セクション | 内容 | 大問構成 | 設問数 | 時間 |
|-----------|------|----------|--------|------|
| リーディング | 短文の語句空所補充／会話文の文空所補充／長文の内容一致選択 | 大問1〜3 | 30問 | リーディング・ライティング合計 65分[^2] |
| ライティング | 意見論述（QUESTION型・25-35語）+ Eメール返信（2024年度から追加） | 大問4・5 | 2問 | 同上 |
| リスニング | 第1部：会話の応答（1回読み）／第2部：会話の内容一致（2回）／第3部：パッセージ内容一致（2回） | 第1〜3部 | 30問 | 約25分[^3] |

- 試験時間合計: 約90分（一次）+ 約5分（二次）[^2]
- 2024年度第1回検定からリニューアル：3級以上にライティング Eメール返信問題が追加され「内容・語彙・文法」の3観点で4段階評価[^5]

### 1-3. 英検3級 ライティング（QUESTION型）公式採点基準

| 観点 | 配点 | 内容 |
|------|------|------|
| 内容 | 0〜4点 | 自分の意見と2つの理由を正しく述べているか |
| 構成 | 0〜4点 | 英作文のルール（接続表現・段落構成）を守っているか |
| 語彙 | 0〜4点 | 不適切な表現・スペルミスがないか |
| 文法 | 0〜4点 | 文法ミスがないか |

- 満点 16点・語数目安 25-35語・「QUESTIONに答えていない」場合は全観点0点[^6]
- 出典: 英検公式「ライティングテスト（英作文）の採点に関する観点および注意点（3級）」[^6]

### 1-4. 英検3級 二次試験（面接）流れと評価

**流れ**: 入室 → 着席 → あいさつ・自己紹介・問題カード受取 → 黙読・音読 → パッセージに関する質問3問 → 受験者自身への質問2問 → 退室[^9]

**評価観点**（公式）: 応答内容、発音、語彙、文法・語法、情報量、積極的にコミュニケーションを図ろうとする意欲・態度（attitude）[^9]

### 1-5. CSE スコアと合格ライン

公式（公益財団法人 日本英語検定協会）による各級満点スコア（合格基準スコア）[^10]:

| 級 | 1次試験 合格基準CSEスコア | 1次試験 満点 | 2次試験 合格基準 | 2次試験 満点 |
|----|--------------------------|-------------|------------------|-------------|
| 5級 | 419/850（公式表での級満点 **425点**）※1 | 850 | – | – |
| 4級 | 622/1000（級満点 **500点**）※1 | 1000 | – | – |
| 3級 | 1103/1650（得点率約66%） | 1650 | 353/550（得点率約64%） | 550 |

※1: 「各級の合格基準CSEスコア」と「級ごとの技能満点」は別概念で、級満点（5級425・4級500・3級550）は1技能あたりの満点を示す[^10]。一次試験の合格基準スコアは [^8] による。各技能60〜66%程度が合格ライン目安。

### 1-6. 試験回数・受験料・実施形態（2026年度）

- **従来型**: 年3回（2026-05-31 / 2026-10-04 / 2027-01-24）、本会場試験[^13]
- **英検S-CBT**: 毎週土日（一部平日）に開催、3級〜準1級が対象、同一検定回で同じ級を最大3回まで受験可[^13]
- **検定料**: 2026年度第1回検定から全級一律で100円引き下げ[^13]（個別金額は公式 PDF 参照）
- 本案件で「受験日逆算プラン」を作るには、**従来型 vs S-CBT 両方をアプリ内カレンダーに登録できる設計**が必須

---

## 2. 「半年で英検3級合格」の実現性検証

### 2-1. 一般に必要と言われる学習時間

| 起点 | 必要学習時間（目安） | 期間（毎日30分） | 期間（毎日1時間） | 出典 |
|------|---------------------|-----------------|-------------------|------|
| 中学英語の基礎完了 | 約15時間 | 1か月 | 0.5か月 | [^11] |
| 英検4級合格レベル | 約200時間 | 13か月強 | 約半年 | [^11] |
| ゼロからの小学生 | 約200〜300時間（実例：10か月） | – | 6〜10か月 | [^11][^12] |

### 2-2. 本案件のターゲット時間配分（仮説）

毎日1時間 × 180日 = **180時間** + 週末ボーナス（土日各30分）= **約204時間**

→ 「英検4級合格者からスタート」なら半年で3級は **十分到達可能**。「アルファベットからのゼロスタート」では **やや厳しい（実例の最短ライン）** ため、以下の補強が必要：

1. **5級チェックポイント**を 開始から **6週目** に設定（マイルストーン感の演出）
2. **4級チェックポイント**を 開始から **14週目** に設定
3. **3級本番**を 24週目（半年）に設定
4. ライティング・面接の集中強化を 18〜23週目に配置

### 2-3. CSE 換算での「合格圏」可視化

- 3級一次合格 ≒ 1103/1650 CSE = 各技能で 60〜66% 正答[^8]
- アプリ内に「**Mock CSE Score**」を実装し、模試の正答率から推定 CSE を毎週通知することで、保護者と本人に「あと何点」を可視化できる
- これは Santa アルクが TOEIC で実装している予測スコア機能[^17]と同じ思想で、本案件の差別化に直結

---

## 3. 競合分析（10サービス比較）

### 3-1. 比較表

| # | サービス | 対象年齢 | 対応英検級 | 料金（最安） | AI機能 | ゲーミフィケーション | 強み | 弱み | 学べる点 |
|---|---------|---------|-----------|-------------|--------|---------------------|------|------|---------|
| 1 | スタディサプリ ENGLISH for KIDS[^14] | 3〜8歳 | 非対応 | 月1,580円（年契約） | 発話練習（音声認識） | キャラ・ストーリー | リクルートのコンテンツ品質、発話練習 | 英検カリキュラム非対応・**2026-05末で新規申込停止予定** | キャラ世界観・親モード |
| 2 | トド英語[^15] | 3〜8歳推奨 | 一部単語のみ | 年16,800円（クーポン33%OFF=11,256円） | 適応学習（個別最適化）、フォニックス順序 | 称号・実績・ご褒美 | 4技能カバー・15日でアルファベット完了 | 英検直接対応なし | 適応学習UX、兄弟割 |
| 3 | Lepton Bridge（オンライン）[^16] | 小学生 | 英検2級まで（最終目標） | 月9,790円〜 + 教材費 | なし | – | TOEIC600・英検2級まで進む長期カリキュラム | AI機能なし、価格高 | 4技能バランス設計 |
| 4 | 英検ネットドリル（旺文社）[^18] | 小学生〜 | 5〜準1級 | 1年7,700円（5級）〜9,680円（4級） | AI弱点分析・自動採点 | 弱め | 「でる順パス単」「過去問」を内蔵、合格率90% | デザインが古い、ゲーム性弱 | コンテンツ網羅性、面接対策 |
| 5 | Duolingo / Duolingo ABC[^20] | 子ども（ABCは未就学〜小学低学年） | 非対応 | ABC無料／本体は月1,100〜1,300円 | Birdbrain（IRT風の適応学習） | XP・ストリーク・リーグ | UI/UX世界最高峰、Birdbrain論文公開[^19] | 英検対応なし、子ども特化弱い | **streak・XP・ハート・リーグの心理設計**、Birdbrain |
| 6 | Khan Academy Kids[^22] | 2〜8歳 | 非対応 | 完全無料・広告なし | – | キャラ育成 | 5,000以上のアクティビティ、優れた児童心理設計 | 英検非対応、英語圏の英語学習者向け | **完全無料運用の継続性、UI が子どもにとって直感的** |
| 7 | ELSA Speak[^23] | 全年齢（初心者〜上級） | 非対応 | 月1,500〜3,000円程度（無料7日） | 発音判定 AI（%表示）、AIスピーチ分析 | 弱め | 発音判定の精度が業界TOP、AccuracyScore相当 | 子ども特化UIなし | **発音判定アルゴリズムの精度・ASR後処理** |
| 8 | Cambly Kids[^24] | 4〜15歳 | 非対応 | 月7,000円台〜（30分レッスン） | レッスン録画 | – | ネイティブ講師との実会話、復習用録画 | 講師質ばらつき、AI機能なし | 録画・親モードの提示方法 |
| 9 | Santa アルク（TOEIC）[^17] | 大人主体 | TOEIC | 無料+月額 | 12問診断で95%精度のスコア予測、適応学習 | 弱め | **20時間で平均165点UP の実証データ**、IRT実装 | TOEIC専用、子どもUIなし | **診断テストとスコア予測の見せ方** |
| 10 | Speak[^26] | 大人主体 | 非対応 | 月3,000円程度 | OpenAI 提携 GPT による会話特化 | 弱め | 7日で1万語発話の会話量 | 子どもUIなし | **AIロールプレイ会話 UX** |

### 3-2. 競合から抽出する「子どもが毎日触りたくなる」ベストプラクティス

1. **streak（連続記録）+ 復活アイテム**（Duolingo流）— 心理的サンクコストで離脱率を低下
2. **キャラの育成・着せ替え**（トド英語・Khan Kids流）— 学習が「お世話」と等価に
3. **完了直後のドーパミン演出**（Khan Kids の「キラキラ」、Duolingo の XP+音）— レッスン1本完了で 3秒の派手な達成演出
4. **保護者モード**（スタディサプリ流）— 親に「子どもの言葉」を録音で聞かせる体験は親契約継続率に直結
5. **診断テスト → スコア予測**（Santa アルク流）— 開始3分で「あなたの今の英検換算スコアは X」と提示
6. **発音判定の％表示**（ELSA流）— 二択合否ではなく0-100%でフィードバック
7. **ハート/ライフ制**（Duolingo流）— 不正解で減るリソースは課金転換にも直結（小学生では緩めに）
8. **リーグ/フレンド**（Duolingo, Khan Kids）— 直接対戦ではなく「同じ週のがんばりリスト」式が子ども向きで安全

**本案件の差別化軸**: 上記を全部とるのではなく **「英検合格に必要十分な絞り込み」+「Duolingoレベルの心理設計」+「英検3級専用 AI コーチ」**の3点合わせが空白市場（英検ネットドリルはデザイン弱、Duolingo は英検なし、トド英語は対象年齢狭い）。

---

## 4. 適応学習アルゴリズム比較と推奨

### 4-1. 主要アルゴリズム比較

| アルゴリズム | 数式の核 | 長所 | 短所 | 必要データ量 | 実装難易度 | 出典 |
|-------------|---------|------|------|-------------|-----------|------|
| **SuperMemo SM-2 / Anki** | 5段階自己評価 → ease factor 更新 → 次回間隔 = 前回×ease | 単純・初日から動く・誰でも理解できる | ease hell、個別化なし、ブランク復帰に弱い | 最小 | ★（数十行） | [^21] |
| **FSRS** | 三成分記憶モデル（D=Difficulty / S=Stability / R=Retrievability）、機械学習で最適化 | SM-2比 20-30% 少ない復習で同じ定着率、ブランク復帰に強い | パラメータ理解にやや学習コスト、初期は推奨デフォルトでOK | 中（個人で200カード程度から個別最適化） | ★★（オープン実装あり） | [^21] |
| **IRT 1PL/2PL/3PL** | P(正解\|θ) = c + (1-c)/(1+e^-a(θ-b)) | 学習者θ（能力）と問題b（難易度）を分離推定、CATで50%短時間化 | パラメータ推定に500-1000受験者必要（3PL）、c は子どもで重要 | 大 | ★★ | [^27] |
| **BKT (Bayesian Knowledge Tracing)** | HMMで「未習得→習得」の遷移、guess/slip/transition の3パラメータ | 解釈可能、スキル単位で「習得した感」を出せる、低データで動く | 連続的な習熟度ではなくバイナリ、複合スキル困難 | 小〜中 | ★★ | [^30] |
| **DKT (Deep Knowledge Tracing)** | RNN/LSTM で行動列から正答確率予測 | 高精度、複雑な学習過程をモデル化 | ブラックボックス、数万パラメータ、解釈不可、データ大量必要 | 大（数万〜数十万履歴） | ★★★★ | [^30] |
| **Duolingo Birdbrain** | IRT風ロジスティック回帰（学習者能力 × 項目難易度）、毎回更新 | 業界実績、論文公開、理論シンプル | 公式実装非公開だが再現は可能 | 中 | ★★ | [^19] |

### 4-2. 本案件 MVP への推奨アルゴリズム構成

**推奨構成（Phase 1 MVP）**:

1. **語彙学習 = FSRS**（オープンソース実装あり、すぐ動かせる、効果検証済み）
2. **問題出題 = Birdbrain風 IRT 2PL**
   - 学習者の英検級スコア相当（θ）を初期診断テスト（10-15問）で推定
   - 各問題に b（難易度・運用ログから初期値を AI 生成時にラベル付）
   - 解答ごとに オンライン勾配降下法（学習率 0.1）で θ を更新
3. **スキル習得管理 = 軽量 BKT**
   - 文法項目（be動詞・三単現・現在進行形・受動態 など）単位
   - guess=0.2 / slip=0.1 / transition=0.1 のヒューリスティック初期値
   - 「習得したよ！」演出のトリガーになる
4. **DKT は採用しない**（MVP データ不足、解釈性ゼロで保護者説明が困難）

**Phase 2 以降**: 1万人規模の学習履歴が貯まったら DKT を補助モデル（推薦の re-rank）に追加検討。

### 4-3. 受験日逆算プランの設計指針

- 受験日 D 日後 → 残り (D / 7) 週間 → 各週の必須CSE目標 = 線形補間で算定
- 毎週末に「予測CSE vs 目標CSE」を AI コーチがコメント
- 遅延が出たら「平日+15分／週末ボーナス」を自動提案

---

## 5. 生成AIコーチ（gpt-5-mini 可否 / 代替 / 安全運用）

### 5-1. gpt-5-mini の現状（2026-04 時点）

| 項目 | 値 | 出典 |
|------|-----|------|
| 提供状況 | **公開済み（2025-08-07 リリース）** | [^28][^29] |
| 入力価格 | $0.25 / 1M tokens | [^28] |
| 出力価格 | $2.00 / 1M tokens | [^28] |
| キャッシュ入力 | （あり、最大90%引き想定） | [^29] |
| コンテキスト長 | 400,000 tokens | [^28] |
| 後継候補 | gpt-5.4-mini（$0.75/$4.50・2026-03 リリース） | [^29] |

**結論**: gpt-5-mini は問題なく採用可能。コスト試算は次節。

### 5-2. 代替モデル比較（万一 gpt-5-mini が用途に合わなかった場合）

| モデル | 入力 / 出力（$/1M） | コンテキスト | 用途適性 | 出典 |
|--------|---------------------|------------|---------|------|
| **gpt-5-mini**（推奨） | $0.25 / $2.00 | 400K | 子ども会話・解説生成・問題生成 全部こなせる | [^28] |
| gpt-4.1-mini | 中位 | 1M | 長文プリント生成にだけ強み | [^29] |
| gpt-4o-mini | $0.15 / $0.60 | 128K | コスト最安、品質はやや劣る | [^29] |
| gpt-4.1-nano | $0.10 / $0.40 | – | 単純な分類・スコアリング向け（解説生成には不足） | [^29] |
| o4-mini | 中位 | 200K | 推論強化、コスト高、英検チャットでは過剰 | [^29] |

**運用案**: タスクごとにモデルを使い分け。
- 解説生成・自由質問対応 → **gpt-5-mini**
- 単純な分類（NG判定・トピック分類） → **gpt-4.1-nano**
- 問題生成（バッチ・夜間） → **gpt-5-mini**（品質重視）

### 5-3. コスト試算（学習者1人・月）

仮定: 1日 1時間学習、AIコーチ会話 平均 30 ターン/日（入力300token・出力200token平均）

- 月30日 × 30ターン × 500token = 45万token / 月 / 人
  - 入力 27万 × $0.25/1M = $0.0675
  - 出力 18万 × $2.00/1M = $0.36
  - **合計 約 $0.43 / 月 / 人 ≒ ¥65 / 月 / 人**
- 100名で月 ¥6,500、500名で月 ¥32,500

→ サブスク月額 ¥1,000 想定なら粗利率十分確保。

### 5-4. 子ども向け AI チャット 安全運用設計

**OpenAI 公式の方針（2025-12 アップデート）**[^32]:
- 自動分類器（テキスト・画像・音声）でリアルタイム検出
- 16歳未満アカウントには特別な安全モード（ロールプレイ禁止、性的・暴力的内容禁止）
- 保護者リンク機能、quiet hours 設定、メモリ無効化、警告通知

**本案件の三重ガード設計**:

```
[ユーザー入力]
  ↓
[① Moderation API] - violence/sexual/hate/self-harm を即時0.0-1.0スコア化
  ↓ 閾値超で謝罪+話題転換
[② System Prompt + RAG] - 後述の「キッズコーチ憲章」を常駐
  ↓
[gpt-5-mini]
  ↓
[③ 出力後フィルタ] - 出力に対しても Moderation API を再実行
  ↓
[ユーザー表示]
```

**System Prompt（キッズコーチ憲章）の必須項目**[^33][^34]:

```
あなたは小学生（10〜13歳）向けの英語学習コーチ「{キャラ名}」です。
- 子どもにやさしく、はげまし、ほめる
- 性的・暴力的・差別的な話題は絶対に出さない／質問されたら即「英語の話にもどろう」
- 子どもに本名・住所・電話番号・学校名を聞かない／教えられても保存しない
- 自殺・自傷・虐待を示唆する発話があれば「保護者・先生・189（児童相談所）に相談しよう」と必ず案内し、それ以上深追いしない
- 英語以外（恋愛相談・家庭相談など）に深く立ち入らず「それはおうちの人に話してみよう」で英語学習に戻す
- 専門用語を使わず、ひらがな多めの日本語で話す
- 嘘や不確実な情報を断定しない（「先生に確認してね」を使う）
- 出力は必ず100文字以内・絵文字なし
```

**RAG 設計**: 自社問題プール + 解説 + 英検頻出表現を Vector DB（pgvector）化、コーチが質問対応する際に必ず社内ナレッジを引かせる → ハルシネーション低減・回答が英検準拠に統一。

**関数呼び出し設計**:
- `recommend_next_problem(level, weak_skill)` 弱点に応じた問題ID返却
- `explain_mistake(problem_id, user_answer)` 誤答解説生成
- `update_study_plan(exam_date, current_cse)` 学習計画再生成

### 5-5. プロンプトインジェクション対策[^35]

- ユーザー入力は必ず `<user_input>...</user_input>` でサニタイズタグで囲む
- system message は最上位で固定、ユーザー部分での「以前の指示を無視」系を検出
- jailbreak試行（DAN 系）が検出されたら一律「英語学習にもどろう」で打ち返し
- セッションログを保護者ダッシュボードで確認可能に（透明性）

---

## 6. 音声・TTS / ASR ベンダー比較

### 6-1. TTS（読み上げ）ベンダー比較[^31]

| ベンダー | 価格 | 声の数 | 子ども向け声 | 商用利用 | 音質 | 推奨用途 |
|---------|------|-------|-------------|---------|------|---------|
| **OpenAI tts-1** | $15 / 1M chars | 6 | 限定的 | OK | 中 | バルク読み上げ・コスト重視 |
| **OpenAI tts-1-hd** | $30 / 1M chars | 6 | 限定的 | OK | 中-高 | リスニング教材本番 |
| **OpenAI gpt-4o-mini-tts** | $0.60/1M text + $12/1M audio | 拡充中 | あり | OK | 高 | 動的セリフ |
| **ElevenLabs** | 有料$5〜$330/月 | 1,200+ | 子ども声多数 | OK（Creator以上） | **最高** | キャラ別の声を演じる |
| **Google Cloud TTS** | 約$16 / 1M chars | 220+（WaveNet含む） | 中〜多 | OK | 中-高 | 多言語・量産 |
| **Azure Neural TTS** | 約$16 / 1M chars | 多数 | あり | OK | 高 | スピーキングスタイル切替 |
| **Amazon Polly** | $4-16 / 1M chars | 中 | あり | OK | 中 | コスト重視 |

**推奨構成（MVP）**:
- **キャラのセリフ・ストーリーボイス → ElevenLabs**（差別化・子どもが「この子の声」と認識する記憶価値）
- **問題文・例文の単純読み上げ → OpenAI tts-1**（バルク・キャッシュしてB2へ）
- 完成音声は Supabase Storage にキャッシュし、同じ問題は再生成しない（コスト最小化）

### 6-2. ASR（発音判定）ベンダー比較

| ベンダー | 発音判定機能 | 子ども音声対応 | 価格 | 出典 |
|---------|------------|---------------|------|------|
| **Whisper API（OpenAI）** | **発音判定機能なし**（純粋な書き起こしのみ） | 中（音声認識自体は可） | $0.006/分 | [^31] |
| **Azure Speech Pronunciation Assessment** | **AccuracyScore / FluencyScore / ProsodyScore / CompletenessScore / PronScore** + 単語レベルフィードバック、33言語対応 | 高 | 従量課金 | [^31] |
| **ElevenLabs Speech-to-Text** | 一部対応 | 中-高 | サブスク内 | [^31] |
| **Google Speech-to-Text** | confidence あり、発音判定は限定的 | 中 | 従量課金 | [^31] |

**推奨**: 発音練習機能を入れるなら **Azure Speech 一択**。AccuracyScore はそのまま「発音80点！」のUIに使える。Whisper は書き起こしのみで、発音判定には別ロジック（音素アライメント）が必要[^31]。

---

## 7. 大量問題プール戦略（AI生成 × 人手検収）

### 7-1. 著作権上の制約[^25]

- 英検過去問（問題文・選択肢・イラスト）の著作権は **公益財団法人 日本英語検定協会** が保有
- 旺文社の「でる順パス単」「過去6回全問題集」等は **編集著作物としての権利を旺文社が保有**
- 私的利用の範囲を超える商用利用は **明確に著作権侵害**
- 申請窓口: chitekizaisan@eiken.or.jp

**結論**: **過去問流用は禁止**。本案件は「**100% 自社オリジナル AI 生成 + 人手検収**」で問題プールを構築する。これは法務リスクと、Phase 2 でのスケール（数千問のCMS化）を両立する唯一の方針。

### 7-2. 競合各社の問題調達方法（推定）

- 英検ネットドリル（旺文社）: 旺文社自社編集 → デジタル化（権利関係クリア）
- スタディサプリ KIDS: 自社オリジナル動画・アクティビティ
- トド英語: 自社オリジナル（韓国 Enuma 社）
- Duolingo: 自社制作 + AI 生成（GPT-4 で 2023 から大規模生成[^19]）

→ AI 生成に既に舵を切る業界トレンドで、本案件の方針は時流に合致。

### 7-3. AI 生成 + 人手検収パイプライン（推奨）

```
┌─────────────────────┐
│ 1. シラバス設計 (人) │  英検範囲を CEFR / 級別文法項目 / 頻出語彙で構造化
└─────┬───────────────┘
      ↓
┌─────────────────────┐
│ 2. 問題生成 (AI)     │  gpt-5-mini に「3級・受動態・正答=B」等の制約で生成
│  - 4択選択肢         │  各問100バリエーション、温度0.8
│  - 解説              │  「なぜAは違うか」も生成
│  - 難易度初期ラベル  │  CEFR推定 + 文長 + 頻出度
└─────┬───────────────┘
      ↓
┌─────────────────────┐
│ 3. AI セルフレビュー │  gpt-5-mini を別 system prompt で「校閲役」として再評価
└─────┬───────────────┘
      ↓
┌─────────────────────┐
│ 4. 人手検収 (講師)   │  英語講師（ココナラ/クラウドワークスで時給¥2-3000確保）
│  - 文法/語法チェック │  100問あたり 3-4時間
│  - 自然性チェック    │
│  - 文化的配慮        │
└─────┬───────────────┘
      ↓
┌─────────────────────┐
│ 5. 主席エディタ承認  │  最終 OK で本番投入
└─────┬───────────────┘
      ↓
┌─────────────────────┐
│ 6. 運用ログで再校正  │  正答率0%/100%の問題は自動アラート→再検収
└─────────────────────┘
```

**Phase 1 目標プール**（リサーチ部門推奨値）:
- 5級: 1,500問（語彙500・文法400・読解300・リスニング300）
- 4級: 2,000問（同比率）
- 3級: 2,500問（語彙700・文法600・読解500・リスニング500・ライティング150・面接150）
- **合計 約6,000問**

**生成コスト試算**:
- 1問生成 ≒ 入力500 + 出力800 token = 約 $0.0017
- 6000問 × $0.0017 = **約 $10（¥1,500）** ※AI 生成コスト
- 人手検収コスト: 6000問 × 2分/問 ÷ 60 × ¥2,500/h = **¥500,000**
- 合計約 50万円（Phase 1）

### 7-4. 著作権を侵害しないオリジナル文の生成プロンプト戦略

```
あなたは英検{級}の問題を作る出題者です。
【厳守事項】
- 過去問・市販問題集の文を一切引用・改変しない（既存パターンの単純な置換も禁止）
- 登場人物名は架空（Mike, Lily 等の英語圏一般名のみ）
- 固有名詞（地名・施設名・商品名）は全て架空または一般名（"a city", "a park", "a school"）
- 文化的に偏りのない題材（特定宗教・政治・実在企業を避ける）
- {級} CEFR {A1/A2/B1} 相当の語彙のみ使用
- 出力は JSON: { "passage": ..., "question": ..., "choices": [...], "answer": ..., "explanation": ... }
```

---

## 8. 法務・子ども向け運用ガイドライン

### 8-1. 日本の改正個人情報保護法（2025-2026 検討中）[^39]

- **方針**: 16歳未満を本人とする場合、原則として **法定代理人（保護者）の同意を必須化** する方向で検討中（2026-01-09 公表の制度改正方針）
- 現行運用: 12〜15歳以下は個別具体的に判断（ガイドライン）
- 例外: 本人が16歳未満であることを事業者が知らないことに正当な理由があれば免除
- 出典: 個人情報保護委員会 FAQ 1-62、TMI法律事務所コラム[^39]

### 8-2. 米国 COPPA（参考・将来海外展開時）[^38]

- 13歳未満から個人情報を収集する前に「verifiable parental consent」必須
- 2025-06-23 に大幅改正（FTC）、コンプライアンス期限 2026-04-22
- 永続識別子（device ID, IP, cookie）、生体情報、位置情報、行動推論データを「個人情報」に追加
- 罰則: 1違反あたり最大 $51,744（2025年基準）

### 8-3. UNICEF AI for Children ポリシー[^40]

UNICEF の Policy Guidance on AI for Children（v3, 2025）が示す10要件のうち本案件に最重要なもの:
1. **Provide for children's development and well-being** — 学習効果の透明性
2. **Ensure inclusion of and for children** — 多様な子どもが触れる前提
3. **Prioritize fairness and non-discrimination for children** — AI が文化偏見を出さないようプロンプト設計
4. **Protect children's data and privacy** — データ最小化・暗号化
5. **Ensure safety for children** — 危機検知（自殺・虐待）
6. **Provide transparency, explainability, and accountability** — 「なぜこの問題が出たか」を子どもにも説明できるUIを内蔵

### 8-4. 本案件の運用設計

| 項目 | 設計 |
|------|------|
| アカウント作成主体 | 保護者が登録 → 子どもプロフィールを子サブアカウントとして紐付け |
| 子どもが入力する個人情報 | **ニックネーム のみ**。本名・学校名・住所・電話番号・写真は不要 |
| 学習データ | 学習者UUID + 解答ログ + 学習時間（最小化） |
| AI チャットログ | 保護者ダッシュボードで全件閲覧可（透明性） |
| 学習データの AI 学習利用 | **しない**（OpenAI API は zero data retention 設定） |
| 危機検知 | 自殺・自傷・虐待のキーワードを検出 → 「189（児童相談所）」案内 + 保護者通知 |
| 同意フロー | 保護者がメール認証 + 利用規約に同意 → 子は何もサインアップしない |
| データ削除権 | 保護者ダッシュボードからワンクリックで全データ削除 |
| 保存場所 | 国内リージョン（Vercel + Supabase は東京リージョン選択可） |

---

## 9. 無料運用維持の試算

### 9-1. 各サービスの無料枠（2026-04 時点）

| サービス | 無料枠 | 商用利用可否 | 出典 |
|---------|-------|-------------|------|
| Vercel Hobby | 1M Function呼出 / 100GB帯域 / 4h Active CPU / 360 GB-hr Memory | **不可（個人・非商用のみ）** | [^36] |
| Vercel Pro | 1M Function（含み）+ 1TB帯域 + $20/user/月 | OK | [^36] |
| Supabase Free | 500MB DB / 50K MAU / 1GB Storage / 5GB egress / 500K Edge関数 / 1週間無アクセスで一時停止 | OK | [^37] |
| Supabase Pro | 8GB DB / 100K MAU / 100GB Storage + $25/月 | OK | [^37] |
| Turso Free | 5GB / 500M reads / 10M writes 月 | OK | [^41] |
| Turso Developer | 9GB / 1B reads / 25M writes + $4.99/月 | OK | [^41] |
| Neon Free | 0.5GB/project（合計5GB max・10プロジェクト）/ 100 CU-h | OK | [^42] |

### 9-2. ユーザー規模別 月次コスト試算

#### ケース A: 100名（β期）

| 項目 | 想定 | コスト |
|------|------|--------|
| Vercel Pro（商用化必須） | $20 | ¥3,000 |
| Supabase Free | 100名なら 50K MAU 余裕 / DB 500MB は学習ログで足りるか微妙 | ¥0 |
| OpenAI gpt-5-mini | 100名 × $0.43 | ¥6,500 |
| OpenAI tts-1 | 100名 × 50K char/月 = 5M char × $15/1M = $75 | ¥11,000 |
| Azure Speech（発音判定） | 100名 × 100リクエスト/月（5min×$1/h相当） | ¥3,000 |
| ElevenLabs Starter | キャラボイスの再利用キャッシュ前提 | ¥800 |
| **合計** | | **約 ¥24,000 / 月** |

→ **「無料運用」は不可能**。最低でも月 ¥2.4 万かかる。

#### ケース B: 500名（拡大期）

| 項目 | 想定 | コスト |
|------|------|--------|
| Vercel Pro | $20 | ¥3,000 |
| Supabase Pro | $25（DB 容量必須） | ¥4,000 |
| OpenAI gpt-5-mini | 500 × $0.43 | ¥32,500 |
| OpenAI tts-1（キャッシュ済） | 新規 500名 × 50K char × $15 | ¥55,000 |
| Azure Speech | 500名 × 100req | ¥15,000 |
| ElevenLabs Creator | $22 | ¥3,300 |
| **合計** | | **約 ¥113,000 / 月** |

ユーザー1人あたり ¥226/月。月額 ¥1,000 のサブスクなら原価率 約23%。

#### ケース C: 「真の無料運用」の限界（=オーナー希望時）

- Vercel Hobby は商用禁止だが「自社プロダクト・無償β」なら使える可能性（要法務確認）
- Supabase Free + Turso Free でDBは賄える
- AI コストは絶対ゼロ化不可（OpenAI に従量払いは必須）
- → **無料運用は「20-30名 + AI コーチ機能なし or キャラボイス静止画のみ」が限界**

### 9-3. 推奨運用モデル

- **Phase 1 MVP（β1〜2か月）**: Vercel Pro + Supabase Free + 招待制20名で月額 約¥10,000
- **Phase 2 公開β**: 上記 + ElevenLabs Starter で 100名規模 月額 約¥24,000
- **Phase 3 商用化**: サブスク ¥980/月 を100名で売って黒字化開始（売上 ¥98,000 - 原価 ¥24,000 = ¥74,000/月）

---

## 10. 重要リスクと推奨アクション

| # | リスク | 影響度 | 確率 | 推奨アクション |
|---|--------|-------|------|---------------|
| R1 | 著作権侵害（過去問流用） | 致命 | 中 | **AI生成100%オリジナル+人手検収パイプラインを Phase 0 で確定**、過去問は参照すら絶対に避ける |
| R2 | 子どもの個人情報漏洩・改正個情法違反 | 致命 | 中 | 設計初期から「ニックネームのみ」「保護者同意フロー」「ZDR API」を実装 |
| R3 | AI が不適切な発話（性的・暴力・差別） | 致命 | 中 | 入力Moderation + system prompt + 出力Moderation の三重ガード、保護者にチャット履歴公開 |
| R4 | 半年で3級が達成できず炎上 | 大 | 高 | マーケコピーは「半年で英検3級合格を目指す」。実際は4級経由を必須化、5級・4級チェックポイントを商品ストーリーに織り込む |
| R5 | OpenAI コスト暴騰（無料運用不可） | 大 | 高 | サブスク前提の事業計画に切替、無料運用は β20名のみ |
| R6 | gpt-5-mini が突然価格改定・終了 | 中 | 低 | Vercel AI Gateway でモデル抽象化、OpenAI/Gemini いつでも切替できる構成（組織方針に合致） |
| R7 | 発音判定の精度不足で離脱 | 中 | 中 | Azure Speech Pronunciation Assessment を採用、Whisper単独はNG |
| R8 | 問題プールの品質ばらつき | 中 | 高 | 講師検収時の評価フォーマットを統一、誤答率0%/100%の問題は自動再検収 |
| R9 | 子どもが「楽しくない」と即離脱 | 大 | 高 | デザイン部門と連携、Duolingo/Khan Kids水準の動的フィードバック演出を必須要件に |
| R10 | 保護者の Web リテラシー差で同意フロー突破不能 | 中 | 中 | 同意フローは「LINE通知 + 1タップ」を可能な限りサポート（将来） |

---

## 11. オーナー上申すべき未確定事項（質問形式）

1. **「半年で3級」の対外マーケコピーの強度**: 「合格を目指す」（推奨）／「合格できる」（強気）どちらか？ 達成できなかった場合の保証（次回受験料返金等）の有無は？
2. **課金モデル**: 月額サブスク ¥980〜¥1,480 / 年契約割引あり、で進めて良いか？ 完全無料は不可（原価が出る）。
3. **ターゲットを「英検4級レベル経験者」と「ゼロスタート」のどちらに置くか**: ゼロスタートは半年で3級ぎりぎり、4級経験者は半年で3級確実。マーケ訴求と内部設計を分けるか。
4. **過去問の扱い**: AI生成100%オリジナル方針で進めて良いか？（過去問流用は法務リスク高）
5. **保護者向けデータ閲覧範囲**: AIチャット履歴を「全公開」「要約のみ」「非公開」のどれにするか？（透明性 vs 子どもの心理安全のトレードオフ）
6. **キャラデザイン方針**: 案件はかわいさ重視 / 落ち着き重視 のどちら？（マーケ部門と連動）
7. **発音判定機能の優先度**: Phase 1 で必須? Phase 2 送り? Azure Speech 採用前提でMVPに入れるか?
8. **音声合成プロバイダー**: ElevenLabs（最高品質・キャラ別声）+ OpenAI tts-1（バルク）でハイブリッド運用で良いか？
9. **DB**: Supabase（標準）/ Turso（コスト最適）/ Neon（無料枠）のどれを Phase 1 で採用？ → リサーチ推奨は **Supabase**（Auth/Storage/RLS 統合・組織標準）
10. **無料運用の優先度**: 「無料維持」を最優先するか、「Pro契約 + サブスク収益化」を最優先するか？（事業判断）
11. **海外展開予定**: あるなら COPPA 準拠を Phase 1 から組み込むか？（後付けは大変）
12. **ベータ募集チャネル**: 自社HP / SNS / 既存チラシ / 保護者ネットワーク のどこから?
13. **学校向けマルチテナント**: Phase 2 想定で進めて良いか？（DB 設計の初期から tenant_id を入れるかの判断材料）

---

## 参考文献（一次ソースURL一覧）

[^1]: [5級の過去問・試験内容 | 英検 | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/eiken/exam/grade_5/)
[^2]: [3級の過去問・試験内容 | 英検 | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/eiken/exam/grade_3/)
[^3]: [3級の試験内容 | 英検 | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/eiken/exam/grade_3/solutions.html)
[^4]: [各級の目安 | 英検 | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/eiken/exam/about/)
[^5]: [2024年度 実用英語技能検定(英検) 問題形式リニューアルサイト | 英検 | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/eiken/2024renewal/)
[^6]: [ライティングテスト（英作文）の採点に関する観点および注意点（3級） | 英検 | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/eiken/exam/2017scoring_3w_info.html)
[^7]: [準2級・3級ライティングテスト（英作文）について | 英検 | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/eiken/exam/2017outline_p23w.html)
[^8]: [英検CSEスコアでの合否判定方法について | 英検 | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/eiken/result/eiken-cse_admission.html)
[^9]: [英検バーチャル二次試験 | 3級 | 試験問題・準備 | 英検 | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/eiken/exam/virtual/grade_3/)
[^10]: [英検CSEスコアとは | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/cse/)
[^11]: [英検合格に必要な勉強時間とは？各級ごとに合格するためのポイントも紹介 | スクールウィズ](https://schoolwith.me/columns/33150)
[^12]: [小学生向けに英検３級試験の準備と学習ガイド](https://nisai-british-onlineschool.com/blog/eiken/3rd-grade/)
[^13]: [2026年度 試験日程（個人でお申し込みの方） | 英検 | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/eiken/schedule/2026-examinee.html) / [試験日程・受験案内 | 英検S-CBT](https://www.eiken.or.jp/s-cbt/administration/)
[^14]: [スタディサプリENGLISH for KIDS 公式・口コミ](https://kidshomestudy.com/eigosapuri_kids/)
[^15]: [トド英語 公式](https://campaign.todoeigo.jp/LP/lp01/)
[^16]: [Lepton Bridge オンライン英語教室](https://www.lepton.co.jp/lp/bg_001/)
[^17]: [Santaアルク TOEIC アプリ公式](https://santa.alc.co.jp/aisolution) / [Riiid プレスリリース](https://prtimes.jp/main/html/rd/p/000000015.000091600.html)
[^18]: [英検ネットドリル 公式](https://eiken-netdrill.jp/) / [英検ネットドリル 料金](https://www.e-study.jp/eiken/price/)
[^19]: [Learning how to help you learn: Introducing Birdbrain! | Duolingo Blog](https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/) / [How Duolingo's AI Learns What You Need to Learn | IEEE Spectrum](https://spectrum.ieee.org/duolingo)
[^20]: [Duolingo ABC | Google Play](https://play.google.com/store/apps/details?id=com.duolingo.literacy)
[^21]: [What spaced repetition algorithm does Anki use? - Anki FAQs](https://faqs.ankiweb.net/what-spaced-repetition-algorithm) / [FSRS vs SM-2: Complete Guide](https://memoforge.app/blog/fsrs-vs-sm2-anki-algorithm-guide-2025/) / [open-spaced-repetition/fsrs4anki tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md)
[^22]: [Khan Academy Kids 公式](https://ja.khanacademy.org/kids) / [Khan Academy Kids - Google Play](https://play.google.com/store/apps/details?id=org.khankids.android)
[^23]: [ELSA Speak 公式](https://elsaspeak.com/ja/)
[^24]: [Cambly Kids 公式](https://www.cambly.com/kids?lang=en)
[^25]: [知的財産権の取扱いに関する統一ガイドライン | 公益財団法人 日本英語検定協会](https://www.eiken.or.jp/trademark/) / [サイトポリシー | 英検協会](https://www.eiken.or.jp/sitepolicy/) / [旺文社のライセンスビジネス](https://www.obunsha.co.jp/pr/license/)
[^26]: [Speak 公式](https://www.speak.com/jp)
[^27]: [Item response theory - Wikipedia](https://en.wikipedia.org/wiki/Item_response_theory) / [Three-Parameter Logistic Model (3PL) in Item Response Theory](https://www.cogn-iq.org/learn/theory/three-parameter-logistic-model/) / [What is the three parameter IRT model (3PL)? | Assessment Systems](https://assess.com/three-parameter-irt-3pl-model/)
[^28]: [GPT-5 mini Model | OpenAI API](https://platform.openai.com/docs/models/gpt-5-mini)
[^29]: [OpenAI API Pricing](https://openai.com/api/pricing/) / [Pricing | OpenAI API](https://developers.openai.com/api/docs/pricing) / [Models | OpenAI API](https://developers.openai.com/api/docs/models)
[^30]: [Deep Knowledge Tracing (Stanford)](https://stanford.edu/~cpiech/bio/papers/deepKnowledgeTracing.pdf) / [A Survey of Knowledge Tracing: Models, Variants, and Applications](https://arxiv.org/html/2105.15106v4) / [Bayesian Knowledge Tracing](https://www.emergentmind.com/topics/bayesian-knowledge-tracing)
[^31]: [Tested 1,800+ Voices: Google vs Azure vs ElevenLabs TTS 2026](https://ttsforfree.com/en/blogs/google-vs-azure-vs-elevenlabs-tts-comparison/) / [TTS API Pricing in 2026](https://leanvox.com/blog/tts-api-pricing-comparison-2026) / [Azure AI Speech Pronunciation Assessment | Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-learning-with-pronunciation-assessment) / [Whisper API for pronunciation, intonation, etc - OpenAI Community](https://community.openai.com/t/whisper-api-for-pronunciation-intonation-etc/506601)
[^32]: [OpenAI adds new teen safety rules to ChatGPT - TechCrunch](https://techcrunch.com/2025/12/19/openai-adds-new-teen-safety-rules-to-models-as-lawmakers-weigh-ai-standards-for-minors/) / [Under 18 API Guidance | OpenAI API](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)
[^33]: [Safety best practices | OpenAI API](https://platform.openai.com/docs/guides/safety-best-practices) / [Safety guidance: Any interactions with children - OpenAI Community](https://community.openai.com/t/safety-guidance-any-interactions-with-children/3937)
[^34]: [Building simple & effective prompt-based Guardrails | QED42](https://www.qed42.com/insights/building-simple-effective-prompt-based-guardrails)
[^35]: [Prompt Injection | OWASP Foundation](https://owasp.org/www-community/attacks/PromptInjection) / [Prompt Injection vs. Jailbreaking | LearnPrompting](https://learnprompting.org/blog/injection_jailbreaking) / [Jailbreaking ChatGPT via Prompt Engineering: Empirical Study](https://arxiv.org/pdf/2305.13860)
[^36]: [Vercel Pricing](https://vercel.com/pricing) / [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby) / [Vercel Limits](https://vercel.com/docs/limits)
[^37]: [Supabase Pricing 2026 | UI Bakery](https://uibakery.io/blog/supabase-pricing) / [Supabase Free Tier Limits 2026](https://www.iloveblogs.blog/post/supabase-free-tier-limits-2026)
[^38]: [Children's Online Privacy Protection Rule (COPPA) | FTC](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa) / [Children's Online Privacy in 2025: The Amended COPPA Rule | Loeb & Loeb LLP](https://www.loeb.com/en/insights/publications/2025/05/childrens-online-privacy-in-2025-the-amended-coppa-rule)
[^39]: [個人情報保護法のいわゆる３年ごと見直しについて — 子供の個人情報等の取扱い | JIPDEC IT-Report 2025 Winter](https://www.jipdec.or.jp/library/itreport/2025itreport_winter05.html) / [個人情報保護法 制度改正方針の公表 | 牛島総合法律事務所](https://www.ushijima-law.gr.jp/client-alert_seminar/client-alert/20260109appi/) / [個情委 FAQ 1-62](https://www.ppc.go.jp/all_faq_index/faq1-q1-62/) / [TMI法律事務所 制度改正方針解説（2026-01-09）](https://www.tmi.gr.jp/eyes/blog/2026/17876.html)
[^40]: [Guidance on AI and Children (v3, 2025) | UNICEF Innocenti](https://www.unicef.org/innocenti/media/11991/file/UNICEF-Innocenti-Guidance-on-AI-and-Children-3-2025.pdf) / [Policy guidance on AI for children | UNICEF](https://www.unicef.org/innocenti/projects/ai-for-children)
[^41]: [Turso Database Pricing](https://turso.tech/pricing) / [Database Free Tier Comparison 2026](https://agentdeals.dev/database-free-tier-comparison-2026)
[^42]: [Pricing — Neon](https://neon.com/pricing) / [Neon plans - Neon Docs](https://neon.com/docs/introduction/plans)

---

**調査完了**: 2026-04-26 / リサーチ部門
**次フェーズ推奨**: 上申事項13項目をオーナーに確認 → PM部門でタスク分解（Phase 1 MVP 8〜10週） → デザイン部門と並行でキャラ・UIコンセプト
