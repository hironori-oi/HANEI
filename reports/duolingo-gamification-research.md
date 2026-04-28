# Duolingo ゲーミフィケーション徹底調査 + 子供向け英語学習アプリ設計指針

**案件**: PRJ-016 HANEI（小学生向け英検 3 級半年合格 Web アプリ）
**作成部門**: リサーチ部門
**作成日**: 2026-04-29
**調査時間**: 約 2 時間
**情報源**: Duolingo Engineering Blog / Lenny's Newsletter / First Round Review / Yu-kai Chou / Smashing Magazine / SDT 学術論文 / Brain Balance Centers / Nir Eyal Hooked / 各社公式 + UX 解説 計 30 件超

---

## 1. 要旨（Executive Summary）

Duolingo がモバイル教育市場を支配する核心は「単一機能の天才性」ではなく **Streak（連続日数）× League（リーグ）× XP × Notification** の四位一体の相互強化ループにある。Streak 単独では Day-7 retention 12%→55% に到達せず、Notification（bandit AI による個別最適化）と League（社会的競争）が日次トリガーを供給し、XP がその場での達成感を即時供給することで成立している。HANEI においては、Duolingo の **白帽（intrinsic）軸 ―― Self-Determination Theory の Competence / Relatedness を満たす Streak Freeze・友達 Streak・キャラ伴走** を中核に据え、**黒帽（loss aversion）軸の過度な使用を抑制**する戦略を推奨する。理由は、(1) 小学生は Erikson 第 4 段階「勤勉性 vs 劣等感」のため、罰よりも褒めで industry を育てる必要があること、(2) 保護者が二者目のステークホルダーとして「ガイルト型 UX」を嫌うこと、(3) HANEI は Duolingo と異なり「半年で英検 3 級合格」という終端ゴールを持つため、無限ループ最適化ではなく **逆算カリキュラム × 達成可視化** が KPI になること、の 3 点である。

最重要 5 要素（P0）: **(A) Streak + Streak Freeze、(B) 5 〜 7 分の bite-sized レッスン + 即時フィードバック、(C) XP + 日次ゴール（10/20/30/50 XP の 4 段階）、(D) 連続正解 Combo Bonus、(E) AI コーチによる励まし notification（ただし sad-Duo パターンは封印）**。

---

## 2. Duolingo の核心設計

### 2.1 Streak（連続日数）

**基本仕様**

- 「連続して日次目標を達成した日数」を炎アイコン + 数字で表示
- 1 日でも逃すと **0 にリセット**（Streak Freeze 装備時を除く）
- ロケール TZ ベース、日付境界を IANA TZ で個別管理（Smashing Magazine の実装ガイダンス）

**心理メカニズム（多重）**

| 心理要素 | 効き方 |
|---|---|
| Loss Aversion（CD8） | 100 日達成は「トロフィー」、失う痛みが得る喜びの ~2 倍 |
| Identity（自己同一化） | 「300 日続けている自分」が自分らしさになる、break = self-betrayal |
| Sunk Cost | 既投下の努力を捨てられない |
| Zeigarnik Effect | 未完タスクが脳内に残留、自然リマインドになる |
| 早期は「達成」、後期は「損失回避」 | 2→3 日（+50%）の達成感 vs 200→201 日（+0.5%）の損失回避（Duolingo 公式） |

**Streak Freeze（救済機構）**

- ジェム購入 / 自動付与 / Free 層は装備上限あり、Super 層は緩和
- 装備上限を 1 → 2 に上げただけで DAU +0.38%（公式 A/B test）
- 価格: 200 ジェム（$2.99 〜 $11.99 で換金される pack）
- 「Slack（猶予）を与えると逆にモチベが上がる」UPenn / UCLA 研究にも整合

**Streak Wager（A/B test 由来の派生）**

- 仮想通貨を賭け「7 日間続く」と倍返し報酬
- Day-7 retention +14% / Day-14 retention +14% / Day-1 も統計有意
- 「自発的なコミットメント表明」が retention の最強ドライバー

**Weekend Amulet（A/B test 由来）**

- 金曜に装備すると週末の break が許される
- 1 週後の復帰 +4%、Streak 喪失 -5%
- 「Pace > Sprint」哲学（binge user は離脱率が高い）

**Streak Society（500 日以上の特典）**

- 公式 Help Center に存在: 365 日ごとの milestone と称号、特別バッジ

**Milestone アニメーション**

- 7 日目だけで新規 retention +1.7%（公式）
- 14 / 30 / 50 / 100 / 365 日で派手な celebration

**Friend Streak（社会化）**

- 友達と「共有 Streak」を最大 5 本維持可能
- 共有 Streak 保持者は **日次レッスン完了率 +22%**

**HANEI への含意**

- Streak は強力だが「黒帽過多」になりやすい。**子供 + 保護者**の二者 UX では、罰よりも保護的な救済機構（自動 Freeze 付与・親のリマインド権限）が必須。
- 識別子: 炎ではなく、英検合格に向かう **「桜の木が育つ」「飛行機が空港に近づく」など goal-aligned なメタファ**を推奨（後述 5 章 P0）。

---

### 2.2 XP / レベル

**XP 獲得経路（Duolingo 現行）**

| 行動 | XP |
|---|---|
| 通常レッスン完了 | 20 XP |
| Combo Bonus（連続正解） | +1 〜 +5 XP |
| Story 完了 | 14 〜 28 XP |
| Unit テストアウト | 50 XP |
| Legendary 完了 | 40 XP |
| 全 Daily Quests 達成 | Triple XP boost 解禁 |
| Unit 完了報酬 | 15 分 2x XP |

**日次ゴール（4 段階）**

- 10 / 20 / 30 / 50 XP の自己選択
- これを満たすと streak が継続
- 元は「日次目標 = streak 条件」だったが、2019 年頃に **「1 レッスンだけ」で streak 継続可能に分離** → Day-14 retention +3.3% / 新規ユーザの streak 保持率 +19%（公式）

**心理フィードバックループ**

- レッスン完了直後の +20 XP アニメーション = ドーパミン即時報酬
- Combo Bonus = 「連続正解」を内的に意識づけ、競争でなく自己効力感の強化
- 累積 XP が League のランキング指標になり、社会化フックに接続

**HANEI への含意**

- 学習量と XP の対応を「**英検合格まで残り何 XP**」逆算式に設計可能（Duolingo は無限ループだが、HANEI は終端あり）
- ゴール XP を「合格に必要な総 XP（例: 30,000 XP）」とすれば「進捗の見える化 = 自己効力感」が両立
- ゴールをユーザに選ばせる UX（autonomy 充足）は SDT 観点でも必須

---

### 2.3 League / Leaderboard

**10 階層構造**

Bronze → Silver → Gold → Sapphire → Ruby → Emerald → Amethyst → Pearl → Obsidian → Diamond

**昇降格ルール（実測）**

| リーグ | 昇格人数（30 人中） | 降格 |
|---|---|---|
| Bronze | 上位 20 名 | なし |
| Silver | 上位 15 名 | 下位 5 名 |
| Gold | 上位 10 名 | 下位 5 名 |
| Sapphire〜Obsidian | 上位 10 名 | 下位 5 名 |
| Diamond | （Tournament 進出） | 下位 5 名 |

**Diamond Tournament**

- 上位 10 名が Quarterfinals → Semifinals → Finals
- 各ラウンドで脱落、最終勝者に special reward

**マッチング**

- 学習習慣・タイムゾーンが類似する 30 人で構成
- 異なる言語コースの学習者が混在

**心理メカニズム**

- Octalysis CD5（Social Influence & Relatedness）+ CD2（Accomplishment）+ CD8（Loss Avoidance）
- 「あと 1 レッスンで昇格」の場面で daily action が誘発される

**プライバシー**

- Profile を Private にすると leaderboard 不参加可能
- これが **autonomy（SDT 第 1 ニーズ）** を担保している点が重要

**HANEI への含意**

- 小学生対象では **完全ランダム匿名化必須**（COPPA / 学校・名前マッチング NG）
- 「同じ受験日のクラスメイト 30 人」型マッチが理想（共闘感 + 競争）
- League は P1（差別化要素）でローンチ後段階導入を推奨。MVP では過度な競争 UX は industry vs inferiority の inferiority 側を刺激するリスクあり

---

### 2.4 Hearts → Energy（2025 年移行）

**Hearts（旧）**

- 5 個の体力、誤答 1 で -1
- 0 になるとレッスン継続不可、5 時間でリチャージ
- Super Duolingo は無制限

**Energy（2025 年 7 月導入）**

- 25 単位のバッテリー、**問題ごとに 1 消費**（正誤に関わらず）
- 5 連続正解で雷エフェクト + 1 〜 5 リチャージ
- 広告視聴で 3 〜 5 リチャージ / ジェム購入 / Practice
- 無料層は日次上限あり、Super / Max は無制限

**変更理由**

- 「誤答ペナルティ」が学習を萎縮させていた（公式声明）
- Energy は「使い切ったら今日は終わり」の柔らかい区切り
- ただし community 反応はミックス（Android Authority 等が「結局課金プレッシャ」と批判）

**HANEI への含意**

- **小学生に体力・エネルギー系は推奨しない**。「間違えたら罰」は industry vs inferiority の劣等感側を強化、保護者からの苦情リスクあり。
- 代替: 「体力」ではなく「**今日のミッション枠（5 ミッション分）**」のように「今日の予定が終わった」ことだけを通知する非ペナルティ型
- 課金導線は別途、保護者の月額課金前提で設計（後述）

---

### 2.5 Gems / Shop

**通貨歴史**

- 旧: Lingots（Web）/ 現: Gems（モバイル統一）
- 2017 年に切り替え、購買頻度を高めて経済を活性化
- 換算比 ~20 gems = 1 lingot 相当

**獲得経路**

- レッスン完了の chest（宝箱）
- League の表彰台（podium）入賞
- 月次 challenge 達成
- Friend / Daily Quests
- Streak milestone

**Shop アイテム**

| アイテム | 価格 | 効果 |
|---|---|---|
| Streak Freeze | 200 gems | 1 日の break 許容 |
| Legendary Challenge | 100 gems | 高難度モード解放 |
| Timer Boost | 450 / 1,800 / 4,500 gems | Time Race モードの時間追加 |
| XP Boost (15min 2x) | 各種 | XP 倍率 |

**直接購買**

- $2.99 〜 $11.99 の pack
- App Store / Play Store 経由

**心理メカニズム**

- Octalysis CD4（Ownership & Possession）= 蓄積した宝の所有感
- CD7（Unpredictability）= chest が獲得 gem 数ランダム
- インフレ抑制ロジックあり（持ちすぎると単位あたり価値減）

**HANEI への含意**

- 子供向けに直接ジェム購入を露出させるのは **児童保護観点で NG**（COPPA / 経産省ガイドライン）
- 代替: 「**保護者ストア**」でリアル課金は親側に集約、子供は学習で稼いだジェムを **キャラ着せ替え・部屋装飾** に使う閉じた経済に限定

---

### 2.6 Notifications & 復帰促進

**Bandit Algorithm**

- 各ユーザに最適な通知文・タイミングを ML で個別決定
- ~200 million 通知の効果分析から言語別差異を発見（"Time for [language]" は中国語学習者に効くが英語学習者にはイマイチ）
- 「Novelty effect」を避けるため、forgetting curve を流用して同一通知の間隔を制御

**タイミング**

- 23.5 〜 24 時間後 = 最終学習時刻からの再リマインドが最も効く（First Round Review）
- 「sad Duo」通知は通常通知の **+50% open rate**（複数ソース）

**コピーテストの勝ち事例**

- 「Continue」→「Commit to my goal」で retention 大幅増
- 「Discard my progress」→「Later」でサインアップ ↑
- "Hi, it's Duo" 個別化メッセージが面白系・命令系・クイズ系を破った（DAU +5%）
- 成長マインドセット（"hard work is paying off"）が能力礼賛（"you're smart"）を上回り D14 +7.2%

**Sad Duo 文化現象**

- 「Duolingo guilt」というミーム
- 「You've let Duo down」「You made Duo sad」が SNS で拡散
- 一部ユーザは恐怖を感じて離脱（LinkedIn / Android Authority の批判記事）

**HANEI への含意**

- **小学生に対する罪悪感型 push は完全に禁止**。AI 感を出さない、優しい伴走者キャラを推奨。
- Bandit + 個別最適化の枠組み自体は流用価値高い（Phase 2+ の P1 機能）
- 通知は **保護者経由ルートも追加**: 学習 24 時間途絶で保護者にメール →「今日もお子さんの学習を応援してあげましょう」型のポジティブ復帰メッセージ
- 23.5 〜 24 時間後の reminder は採用するが、文面は「Duo が悲しい」ではなく「**今日のミッションがまだだよ。15 分でできるよ**」型

---

### 2.7 Lessons UX（5 分セッション哲学）

**設計思想**

- 1 レッスン = 3 〜 5 分（micro-learning）
- 「**始められない壁**」を最小化する設計（公式 Duolingo Method 5 原則の 1 つ）
- 「**Will they come back tomorrow?**」を「Will they sign up today?」より優先（Duolingo Handbook）

**5 つの教育原則（公式）**

1. Interactive Learning（受動でなく能動）
2. Personalized Adaptation（AI で難易度・順序最適化）
3. Focused Curriculum（CEFR 等の国際基準準拠）
4. Sustained Motivation（streak / point / 競争）
5. Joyful Experience（キャラ・ストーリーで楽しい）

**1 レッスンの構造**

- 約 15 exercises
- 各 exercise で即時 feedback（正解音 + アニメ / 誤答訂正）
- Combo Bonus = 連続正解で +1 〜 +5 XP

**Hints & Scaffolding**

- 単語タップで翻訳ヒント
- 文法説明は「Bite-sized explanation」型
- 学習中の即時支援が abandon rate を下げる

**Pacing 哲学**

- Binge user は離脱率が高い、Pacer のほうが retention 良
- 「短く・毎日」を強制する設計（Energy も同方向）

**HANEI への含意**

- **小学生の集中時間: 6 歳 12-18 分 / 8 歳 16-24 分 / 10 歳 20-30 分 / 12 歳 24-36 分**（Brain Balance Centers）
- 1 セッション = **5 〜 7 分**（小 3〜小 6）が妥当、これを 1 日複数回繰り返す設計が王道
- 1 時間学習という brief 要件 = **5 〜 7 分 × 8 〜 12 セッション**に分解、小休憩込み
- 即時フィードバックは小学生にこそ重要。ただし**子供向け feedback は研究的に「33% は気づかれず、39% は読まれない」**（PMC 11 歳児眼球追跡研究）→ 視覚的（絵 / 音 / アニメ）で feedback を補強

---

### 2.8 Mascot & ナラティブ

**Duo（メインマスコット）**

- 緑のフクロウ、2011 年誕生
- 知識・知恵の象徴（spectacled owl がモデル）
- 「友達」キャラとして lesson 中・通知中に登場

**主要キャラ群（公式 5 名）**

| キャラ | 性格 | 役回り |
|---|---|---|
| Bea | 野心家・神経質・Type-A | 高 achiever 学習者の代弁 |
| Zari | 外向的・8 部活兼務 | 社交 / 高エネルギー代表 |
| Lily | 内向的・皮肉屋・Goth | 学習に冷めた態度の代弁 |
| Lin | のんびり屋・サンドイッチ好き | 力抜きキャラ |
| Lucy | おばあちゃん（Lin の祖母） | 多世代家族の表現 |

**設計哲学**

- 「世界中のどの学習者にも、最低 1 人共感できるキャラがいる」
- 性格を **対比ペア**に（Zari 外向 ⇔ Lily 内向 / Bea 神経質 ⇔ Lin のんびり）
- 名前は多言語で発音容易・誤解語義回避をクロスチェック

**ナラティブ機能**

- レッスン中の例文に登場 → 文脈と感情を付与
- 通知のキャラ別 voice
- Story モードで対話劇

**HANEI への含意**

- **小学生対象の唯一無二の伴走キャラ**を立てる必要（Duolingo Duo に相当）
- かわいすぎず、英検合格までの「**先輩**」ポジが理想（小学生にとって少し年上の中学生キャラ）
- 性別 / 体型 / 文化バックグラウンドの多様性も考慮（Duolingo の哲学を踏襲）
- AI 感を出さない: キャラ名は完全に人間的に。AI コーチがキャラを「動かす」が、子供にはキャラとして提示する（design-w1-character.md と整合確認）

---

## 3. 子供向けエンゲージメント設計の理論基盤

### 3.1 Self-Determination Theory（Deci & Ryan）適用

**3 基本心理ニーズ**

| ニーズ | 定義 | ゲーム機構の対応 | Duolingo 実例 |
|---|---|---|---|
| Autonomy（自律性） | 自分が選んだ・自分のためにやっている感覚 | 目標カスタム・コース選択・skip | 日次目標 10/20/30/50 XP の選択 / League opt-out |
| Competence（有能感） | 自分はできるという感覚 | progress bar・level up・badge・適切な難易度 | XP・バッジ・League 昇格・skill tree 完了率 |
| Relatedness（関係性） | 他者とつながる感覚 | friend・guild・mentor・avatar・ストーリー | Friend Streak / Friend Quest / キャラ |

**研究知見**

- 「Game element 単独では効果なし、3 ニーズを満たす設計のとき効果」（Sailer et al., 2017, ScienceDirect）
- Badge / Leaderboard / Performance Graph は **Competence** に効く
- Avatar / Story / Teammate は **Relatedness** に効く
- 「Just adding game elements does not always guarantee desired results」（複数論文）

**HANEI への含意**

- **Autonomy 重視必須**: 学習者が「やらされている」と感じた瞬間、家庭学習は破綻する
  - 受験日を本人に登録させる
  - 1 日のミッション選択肢（語彙・文法・リスニング・読解）を本人選ばせる
- **Competence 重視必須**: 英検合格という具体的 milestone がそもそも competence の最大化装置
  - 模試スコア推移グラフ
  - 弱点・強み可視化
- **Relatedness は段階導入**: 小学生には保護者・キャラ・AI コーチ（擬似友達）の 3 経路を最初から、友達機能は Phase 2 以降

---

### 3.2 Octalysis 8 コアドライブ × HANEI

| # | コアドライブ | 帽子 | 脳半球 | Duolingo 実装 | HANEI 推奨実装 |
|---|---|---|---|---|---|
| CD1 | Epic Meaning & Calling | White | Right | "Free language education for the world" | 「英検 3 級合格で英語が好きな自分に」「家族を喜ばせる」 |
| CD2 | Development & Accomplishment | White | Left | XP / League / Skill tree | 模試スコア推移 / 単元クリア / 合格まで残り XX |
| CD3 | Empowerment of Creativity | White | Right | (弱) Story 一部 | キャラ着せ替え / 部屋カスタム / 自作例文 |
| CD4 | Ownership & Possession | White | Left | Gems / 装備 | ジェム / 育成キャラ / コレクション図鑑 |
| CD5 | Social Influence & Relatedness | White | Right | League / Friend Quest | 保護者からの応援 / キャラとの絆 / 模試友達ランク（Phase 2） |
| CD6 | Scarcity & Impatience | Black | Left | Heart 回復待ち / 期間限定 quest | 受験日カウントダウン（自然な scarcity） |
| CD7 | Unpredictability & Curiosity | Black | Right | 宝箱 / Daily Quest | 宝箱でジェム獲得 / AI コーチからの突発励まし |
| CD8 | Loss & Avoidance | Black | Left | Streak / Heart loss | Streak のみ採用、罰要素は最小化 |

**設計哲学**

- White Hat 5 つを濃く実装（CD1, CD2, CD3, CD4, CD5）
- Black Hat 3 つは抑制的に（CD6: 受験日カウントダウンのみ、CD7: 弱め、CD8: Streak のみで Heart 系なし）
- Yu-kai Chou 自身の指摘: **Black Hat を多用すると短期 KPI は上がるが長期離脱が増える**

---

### 3.3 小学生（7-12 歳）の発達心理ベース設計

**Erikson 第 4 段階: 勤勉性 vs 劣等感**

- 6-12 歳の中心課題
- 「自分は何かを達成できる存在だ」という感覚（competence）の獲得
- 失敗を罰すると **inferiority（劣等感）** が固着し生涯影響
- 「**Effort 自体を褒める**」(Carol Dweck Growth Mindset) が王道
- Duolingo の A/B test も "your hard work is paying off" 型が能力礼賛型を D14 +7.2% で上回った

**集中時間（Brain Balance Centers）**

| 年齢 | 集中時間 |
|---|---|
| 6 歳 | 12 〜 18 分 |
| 8 歳 | 16 〜 24 分 |
| 10 歳 | 20 〜 30 分 |
| 12 歳 | 24 〜 36 分 |

- 一般式: 年齢 × 2 〜 3 分が標準、上限 5 分 / 年齢
- HANEI 1 時間学習設計の含意: **5 〜 7 分セッション × 8 〜 12 回**、間に短い休憩・キャラ会話を挟む

**フィードバック処理**

- 11 歳児の眼球追跡研究: feedback の **33% は見られず、見られた中の 39% は読まれない**（PMC）
- → テキスト feedback だけでは不十分、**視覚 / 音 / アニメ**で多層化必須
- 子供の cognitive development に合わせた語彙・文体（HANEI ではひらがな + 振り仮名想定）

**社会的承認欲求**

- Erikson 段階で「ピアと比較する」のが正常発達
- ただし「順位」よりも「**成長**」の比較を強調すべき（自己内成長 = 過去の自分との比較）
- 保護者・教師からの **言語的承認** が最も効く

**HANEI への含意**

- すべての feedback を「**頑張った！**」「**前回より早く解けたね**」「**この間違いから学べる**」に統一
- 語彙レベル: 小 4 で習う漢字までしか使わない、それ以上は振り仮名
- 集中時間 25-30 分の上限を尊重、1 時間 = 短セッション x 多回
- 罰系 UX（Heart 喪失・Streak 0 リセット時の悲しい演出）を最小化、Streak Freeze 自動付与で救済優先

---

### 3.4 強化スケジュールと習慣化

**Skinner: Variable Ratio Reinforcement**

- ランダム頻度の報酬は **最高の継続性**を生む（slot machine の原理）
- 既知 / 予測可能な報酬は早期に習慣化失敗
- Nir Eyal の Hooked Model 4 ステップ:
  - **Trigger** → **Action** → **Variable Reward** → **Investment**

**Variable Reward の 3 種**

1. **Tribe（部族）**: SNS いいね・friend reaction
2. **Hunt（狩り）**: 情報・物質報酬（chest / gems）
3. **Self（自己）**: 達成感・mastery 感

**Duolingo 実装例**

- 宝箱（Hunt）: 開封ごとに獲得 gem 数ランダム
- League ランキング（Tribe）: 週次の順位変動
- Skill 完了（Self）: ゴールド化 / Legendary 解放

**習慣化の研究**

- BJ Fogg Behavior Model: B = MAP（Motivation × Ability × Prompt）
- 3 要素同時必須、欠けると行動起こらず
- Tiny Habits 派: action を「歯磨きと同じくらい小さく」設計
- Duolingo 5 分レッスンはこの哲学の実装

**Zeigarnik 効果**

- 未完了タスクは脳内に残留しやすい
- Streak は「未完了」状態を継続的に脳内に置く装置

**HANEI への含意**

- **Tribe**: 保護者からのリアクション（高評価 ハートマーク 等）が代替
- **Hunt**: ジェム獲得 + キャラアイテム解放
- **Self**: 模試スコア成長・単元マスタ表示
- 30 日壁: 開始 30 日以内に習慣ロックインしないと離脱、よって最初 30 日は **過剰なくらいの positive feedback** を投下

---

### 3.5 モチベーション減衰の典型パターン

**ドロップポイント**

| タイミング | 典型原因 | 対策 |
|---|---|---|
| Day 1 | サインアップ後の初期体験不足 | 初回診断 → 即学習 → 即報酬 |
| Day 7 | 「飽き」の最初の壁 | streak 7 日 milestone celebration（Duolingo 公式 +1.7% retention） |
| Day 14 | 習慣化前の離脱 | 強い Day 14 milestone + 保護者通知 |
| Day 30 | 習慣化最終壁 | 自動 Streak Freeze 付与 / モチベ補強 |
| Day 90 | 「目的不明」 | 模試結果可視化 / 受験日カウントダウン強調 |

**Binge / Burnout パターン**

- 週末に大量学習 → 平日に来ない（Duolingo 観察）
- HANEI 対策: 「今日のミッション完了」で **強制終了** 推奨（過学習防止）

---

### 3.6 保護者を巻き込む設計

**Duolingo Family Plan**

- 1 つの Super アカウントで最大 5 ユーザ
- 居住地・氏名一致不要
- 共有: 広告なし / Hearts（Energy）無制限

**Friend Streak**

- 共有 streak 維持者は日次レッスン完了率 +22%
- 友達追加した学習者はコース完了率 **5.6 倍**

**HANEI 独自の保護者統合（Duolingo を超える点）**

- HANEI の保護者は **第二ターゲット = 決裁者**
- 必須機能:
  - 週次レポートメール（学習時間・進捗・弱点）
  - 受験日カウントダウン（保護者にも見える）
  - 学習停止アラート（24 時間途絶で保護者通知）
  - 応援メッセージ送信（保護者 → 子供）
  - 課金は保護者に集約（子供は Free / 保護者が Premium 決済）
- 推奨拡張:
  - 親子で取り組む weekly challenge
  - 親が決めた合格祝福ご褒美（デジタル / 現実）連動

---

## 4. 競合分析

### 4.1 Khan Academy Kids

**特徴**

- 0-8 歳対象の専用子供版（K-2 範囲）
- 児童発達専門家との協働開発
- アダプティブ学習（AI でリアルタイム難易度調整）
- 即時 feedback + バッジ + 証書
- ストーリーと友達キャラで没入

**ゲーミフィケーション**

- 視覚的報酬（star / badge）
- 達成証書のダウンロード可能（保護者印刷）
- ストーリーモード（読み聞かせ）

**強み**

- 完全無料 + 広告なし（Khan Academy Foundation 寄付モデル）
- 保護者ダッシュボード堅牢
- 児童心理に深く根ざした UX

**弱み**

- 8 歳以上のスケーラビリティなし（HANEI のターゲット 4-6 年生は対象外）
- 言語学習特化ではない

**HANEI への学び**

- 児童発達専門家との QA レビュー（Phase 2 で外部コンサル）
- 保護者ダッシュボードを最初から堅牢化（Khan に学ぶ）
- 完全無料 + 保護者課金（Premium）モデル検討

---

### 4.2 ABCmouse

**特徴**

- 2-8 歳対象、10,000+ 学習活動
- 構造化された linear カリキュラム
- ゲーミフィケーション + バッジ + アニメーション

**強み**

- アカデミック網羅性
- 保護者向け progress 可視化
- 月額 $12.99 程度の固定課金（家計に組み込みやすい）

**弱み**

- カリキュラム硬直、選択肢少
- 子供だけでは進められず親の伴走必須
- モバイル UX が遅め

**HANEI への学び**

- linear vs adaptive のバランス: HANEI は adaptive 主軸、linear なロードマップ（受験日逆算）を併走
- 月額固定課金モデルが家計フィットの実証

---

### 4.3 Lingokids

**特徴**

- 2-8 歳対象、Playlearning™ 独自メソッド
- 3,000 英単語、社会情緒学習も
- 動画 / 歌 / 音声を多用、研究では発音・理解度向上を確認

**強み**

- 楽しさ最優先
- インタラクティブ性高い

**弱み**

- アカデミック評価指標が弱い（学習の効果計測が限定的）
- 過度なゲーム化で「学んでいる感」が薄れる批判（The Learning Standard）
- ステッカー報酬が **cognitive overload を誘発**（複数批評）

**HANEI への学び**

- 楽しさだけでは英検合格は担保できない、**「真の learning」と「楽しい UX」の両立**が HANEI の差別化価値
- 過度なゲーミフィケーションは逆効果、**バランスポイント**を意識

---

### 4.4 ELSA Speak

**特徴**

- AI ベースの英語発音矯正アプリ
- 即時フィードバック（音素レベル）
- ゲーミフィケーション + レベルアンロック
- 大人〜中高生向け（小学生も使用可）

**強み**

- 発音矯正の精度が業界最高クラス
- 個別最適化された改善提案
- セッション後の即時 unlock がモチベ駆動

**弱み**

- 文法・読解・ライティングは弱い
- 子供向け UX に最適化されていない

**HANEI への学び**

- **発音判定機能は希望要件にあるが、ELSA レベルの精度実現は MVP では困難**。MVP は録音 + AI による定性 feedback で代替、Phase 2+ で精度強化
- AI による即時個別フィードバックは HANEI の核心価値（gpt-5-mini）

---

### 4.5 比較サマリ

| 軸 | Duolingo | Khan Kids | ABCmouse | Lingokids | ELSA | **HANEI 推奨** |
|---|---|---|---|---|---|---|
| 対象年齢 | 全年齢 | 2-8 | 2-8 | 2-8 | 中高〜 | 4-6 年生（10-12 歳） |
| ゲーミフィケーション | 高（10/10） | 中（6/10） | 中（5/10） | 高（8/10） | 中（6/10） | 中-高（7/10） |
| アカデミック厳密性 | 中 | 高 | 高 | 低-中 | 中 | **高（英検合格保証）** |
| アダプティブ | 高 | 高 | 低 | 低 | 高 | **高（AI コーチ）** |
| 保護者 UX | 弱（Family Plan のみ） | 強 | 強 | 中 | 弱 | **強（差別化要素）** |
| 終端ゴール | なし | なし | なし | なし | なし | **半年で英検 3 級** |
| ソーシャル | 強 | 弱 | 弱 | 弱 | 中 | **保護者軸 + Phase 2 friend** |
| 罰要素 | 中（Energy） | 弱 | 弱 | 弱 | 弱 | **弱（児童心理優先）** |

---

## 5. HANEI に転用すべき設計要素（優先度付き）

### 5.1 P0（必須・コア / Phase 1 MVP）

#### P0-1: Streak（連続学習日数）+ Streak Freeze 自動付与

- **採用**: 1 日 1 ミッション完了で streak 継続
- **アレンジ**:
  - 表現を「炎」ではなく「**桜の木が育つ**」「**飛行機が空港に近づく**」など goal-aligned に
  - Streak Freeze は最初から 2 個装備で自動付与、損失時は親アラート
- **根拠**: 公式 Day-7 retention 12%→55%、自動 Freeze で +0.38% DAU

#### P0-2: 5 〜 7 分の bite-sized セッション + 即時フィードバック

- **採用**: 1 セッション 5-7 分、1 日 8-12 セッションで 1 時間達成
- **アレンジ**:
  - feedback は視覚 + 音 + アニメで多層化（11 歳児研究の 39% 未読対策）
  - 連続正解 Combo Bonus（+1 〜 +5 XP）
- **根拠**: 集中時間に最適、Duolingo 公式 5 原則の柱、Erikson 勤勉性育成

#### P0-3: XP + 自己選択日次ゴール

- **採用**: 10 / 20 / 30 / 50 XP の 4 段階、本人選択
- **アレンジ**:
  - **総 XP = 英検合格に必要な学習量**として可視化（Duolingo は無限、HANEI は終端あり）
  - 「合格まで残り XX XP」を常時表示
- **根拠**: SDT Autonomy 充足、Duolingo 公式の retention データ

#### P0-4: AI コーチによる即時誤答解説

- **採用**: 全問に「なぜ間違えたか」「正解の理由」を AI 生成（gpt-5-mini）
- **アレンジ**:
  - **小 4 で習う漢字までしか使わない**、それ以上はふりがな
  - 励まし copy は成長マインドセット型（"頑張ったね、この間違いから学べるよ"）
- **根拠**: Duolingo A/B test "hard work is paying off" 型が D14 +7.2%、Erikson 勤勉性育成

#### P0-5: 保護者ダッシュボード + 週次レポート

- **採用**: 学習時間 / 進捗 / 弱点 / 模試スコア / 受験日カウントダウン
- **アレンジ**:
  - **HANEI 独自**: 学習停止 24 時間で保護者にアラート、保護者から子供へ応援メッセージ送信
  - 課金は保護者集約
- **根拠**: 二者目ターゲット = 決裁者、Khan Academy Kids の優位パターン

#### P0-6: 受験日カウントダウン + 逆算カリキュラム

- **採用**: 本人が受験日登録 → 週次/日次プラン自動生成
- **アレンジ**:
  - **HANEI 独自差別化**: Duolingo は無限ゴールだが HANEI は終端あり
  - カウントダウンの表現を「圧」ではなく「**ワクワク**」に（"あと 100 日でテスト！毎日 1 つで合格できるよ"）
- **根拠**: Octalysis CD2（Accomplishment）+ CD6（自然な Scarcity）

#### P0-7: 伴走キャラ（1 体）+ AI コーチ可視化

- **採用**: Duo 相当の主役キャラ 1 体（HANEI 独自）
- **アレンジ**:
  - 小学生にとって少し年上の「**先輩**」ポジ
  - キャラ着せ替えで CD4（Ownership）刺激
  - キャラの voice で誤答解説 / 励まし
- **根拠**: SDT Relatedness、Duolingo 公式 Joyful Experience 原則

#### P0-8: ジェム経済（閉じた版）

- **採用**: 学習で稼ぐジェム → キャラ着せ替え / 部屋装飾
- **アレンジ**:
  - **直接購入なし**（児童保護）
  - 保護者課金は別チャネル（Premium 月額）
- **根拠**: CD4（Ownership）刺激、児童保護要件遵守

#### P0-9: 達成バッジ + 累積マイルストン

- **採用**: 7 / 14 / 30 / 100 日 streak、語彙 100 / 500 / 1000 語など
- **アレンジ**:
  - バッジ画面は「**小学生の図鑑感**」に
  - 保護者が見て喜ぶ表現（"頑張ってる証拠"）
- **根拠**: Duolingo A/B 結果（バッジ DAU +2.4%）、SDT Competence

#### P0-10: 通知（成長マインドセット型）

- **採用**: 24 時間後 reminder、保護者経由 reminder の 2 ルート
- **アレンジ**:
  - **Sad キャラ系は完全禁止**
  - 文面: 「今日のミッションがまだだよ。15 分でできるよ」「お子さんの学習を応援してあげましょう」
- **根拠**: Duolingo A/B test 成長マインドセット D14 +7.2%、児童心理優先

---

### 5.2 P1（差別化 / Phase 2-3）

#### P1-1: League / Leaderboard（匿名 30 人マッチ）

- **採用**: ローンチ後段階導入
- **アレンジ**:
  - **完全匿名 + ニックネーム**（COPPA）
  - 「**同じ受験日のクラスメイト 30 人**」型マッチ（共闘 + 競争）
  - opt-out 必須（autonomy）
- **根拠**: SDT Relatedness、ただし inferiority 刺激リスクあるため遅延導入

#### P1-2: Friend Streak / Family Plan

- **採用**: 友達 / 兄弟姉妹で共有 streak
- **根拠**: Duolingo 公式 共有 streak で日次完了率 +22%、友達追加でコース完了 5.6 倍

#### P1-3: Daily Quests（3 つの日次目標）

- **採用**: 「語彙 10 個」「文法 5 問」「リスニング 3 問」など 3 種
- **根拠**: Duolingo 現行、Variable Reward の Self 系

#### P1-4: AI による弱点補強自動生成

- **採用**: 誤答パターンから AI が追加問題生成
- **根拠**: brief 必須要件 + Duolingo の personalized adaptation

#### P1-5: ボイスレコーディング発音判定

- **採用**: 25-35 語の英作文 / スピーキング練習
- **根拠**: brief 希望要件、ELSA レベルは Phase 3 以降

#### P1-6: 親子 weekly challenge

- **採用**: 「今週 5 単元クリア」など、達成で家族 reward
- **根拠**: Duolingo Friends Quest の親子版アレンジ、HANEI 独自差別化

---

### 5.3 P2（将来）

- **P2-1**: マルチテナント学校・塾向け SaaS（brief 「Could」）
- **P2-2**: AI 仮想クラスメイトとの会話練習
- **P2-3**: A/B test infrastructure 整備（Duolingo 流 100s of experiments 体制）
- **P2-4**: bandit algorithm による通知最適化（Duolingo 同型）
- **P2-5**: 英検準 2 級・2 級拡張（brief 「Won't / Phase 1」だが将来）

---

## 6. HANEI 独自差別化案（Duolingo を超える点）

### 6.1 終端ゴール明確型

- Duolingo: 無限ループ最適化（最終ゴール曖昧）
- **HANEI**: 半年で英検 3 級合格 = 明確な終端
- → 「**合格率 85%+ 保証**」をマーケコピーに（Lingokids も ABCmouse も達成不可能な数値）

### 6.2 保護者を一級ステークホルダーとして実装

- Duolingo: Family Plan は決済共有のみ
- **HANEI**: 保護者ダッシュボード / 応援送信 / 学習停止アラート / 進捗共有を **コア機能** に
- → 月額課金の意思決定を保護者に最適化、解約率を下げる

### 6.3 罰系を排除した安心設計

- Duolingo: Heart / Energy で間違い = ペナルティ（小学生の劣等感誘発リスク）
- **HANEI**: Heart 系なし、Streak Freeze 自動付与、間違いは「学びの種」表現に統一
- → 保護者からの満足度・信頼性で差別化

### 6.4 AI コーチング深度

- Duolingo: AI personalization は内部機能、ユーザは Duo キャラ越しに体験
- **HANEI**: gpt-5-mini で **個別の質問対応・誤答解説・追加問題生成・励まし copy 個別化**
- → AI コーチを「先生」として全面活用、家庭教師代替価値

### 6.5 模試 + 受験日逆算

- Duolingo: 学習量重視
- **HANEI**: 英検過去問模試 + 残日数からの自動再計画
- → 「家庭学習でも合格できる」UX、塾の代替

### 6.6 日本の漢字発達段階準拠

- Duolingo: 言語に対し global で同一 UX
- **HANEI**: 学年で習う漢字レベルに動的に振り仮名
- → 日本の小学生に最適化された読み心地

### 6.7 親子の二者 UX

- Duolingo: 単独学習者のみ
- **HANEI**: 親子で取り組める weekly challenge / 応援メッセージ / 合格祝福ご褒美連動
- → 家庭内コミュニケーション促進という social value 提供

---

## 7. 実装複雑度評価

| 要素 | Duolingo 流用 | HANEI 既存 | 実装工数 | 優先度 |
|---|---|---|---|---|
| Streak + Freeze | 高（仕様完コピで OK） | 一部実装済 | 中（5-8 日） | **P0** |
| 5-7 分セッション | 高（philosophy 流用） | dev-w1 で骨格あり | 小（既存拡張） | **P0** |
| XP / 日次ゴール | 高 | 一部実装済 | 小（3-5 日） | **P0** |
| Combo Bonus | 高 | 未 | 小（2-3 日） | **P0** |
| AI コーチ誤答解説 | 中（独自実装） | dev-w5 で gpt-5-mini ベース | 中（5-7 日） | **P0** |
| 保護者ダッシュボード | 低（Duolingo 弱） | design-w3 で骨格あり | 大（10-14 日） | **P0** |
| 受験日カウントダウン | 低（Duolingo 無） | design-w4 で実装済 | 小（既存） | **P0** |
| 伴走キャラ | 中（design 必要） | design-w1-character 進行中 | 中（design 5-7 日 + 実装 3-5 日） | **P0** |
| ジェム経済（閉じた） | 高（Shop 流用、課金除外） | 未 | 中（5-7 日） | **P0** |
| バッジ・マイルストン | 高 | 未 | 小（3-5 日） | **P0** |
| 通知（成長マインドセット） | 中（copy 独自） | 未 | 小（3-5 日） | **P0** |
| League | 中（COPPA 配慮） | 未 | 大（10-14 日） | **P1** |
| Friend Streak | 中 | 未 | 中（5-7 日） | **P1** |
| Daily Quests | 高 | 未 | 中（5-7 日） | **P1** |
| 親子 weekly challenge | 低（独自） | 未 | 中（7-10 日） | **P1** |
| ボイス発音判定 | 低（gpt-5 / Whisper） | 未 | 大（10-14 日） | **P1** |
| Bandit 通知最適化 | 中（infra） | 未 | 大（14-21 日） | **P2** |
| マルチテナント | 低（独自） | 未 | 特大（30+ 日） | **P2** |

**Phase 1 MVP（P0 のみ）合計推定工数: 60-80 人日**
**Phase 2 拡張（P1 追加）: 40-60 人日**

---

## 8. 重要設計原則のまとめ（HANEI 5 つの誓い）

1. **罰よりも褒め**: Erikson 勤勉性 vs 劣等感の劣等感側を刺激しない。誤答は「学びの種」、Streak 喪失は自動 Freeze で吸収
2. **家庭学習の伴走**: 保護者を一級ステークホルダーとして実装、課金・通知・進捗を保護者経由に
3. **明確なゴール志向**: Duolingo の無限ループではなく、英検 3 級合格まで残り XX という終端ゴール可視化
4. **AI 感を出さない**: キャラを通じた人間的体験、AI は黒衣で先輩キャラを動かす
5. **autonomy 最大化**: 受験日 / 日次ゴール / ミッション選択を本人決定権に、「やらされ感」を排除

---

## 9. 参考文献・出典

### Duolingo 公式

- [How the Duolingo Streak Builds Habit (Duolingo Blog)](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)
- [How Streaks keep Duolingo learners committed (Duolingo Blog)](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/)
- [Improving the streak: Forming habits one lesson at a time (Duolingo Blog)](https://blog.duolingo.com/improving-the-streak/)
- [Duolingo's Best Social Features](https://blog.duolingo.com/friends-social-features/)
- [Friends Quests Are Duolingo's Newest Social Feature](https://blog.duolingo.com/friends-quests/)
- [How Duolingo Leaderboards and Leagues Work](https://blog.duolingo.com/duolingo-leagues-leaderboards/)
- [Hi, it's Duo: Meet the AI behind the meme](https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/)
- [The Duolingo Method: 5 Key Principles](https://blog.duolingo.com/duolingo-teaching-method/)
- [Why Duolingo switched to Energy](https://blog.duolingo.com/duolingo-energy/)
- [Improving Duolingo, one experiment at a time](https://blog.duolingo.com/improving-duolingo-one-experiment-at-a-time/)
- [How Zari, Lin, Lucy, Bea, and Lily came to life](https://blog.duolingo.com/duolingo-female-character-origin-stories/)

### A/B Test / 製品マネジメント

- [Behind the product: Duolingo Streaks (Lenny's Newsletter)](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks)
- [The Tenets of A/B Testing from Duolingo's Master Growth Hacker (First Round Review)](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/)
- [Duolingo's Customer Retention Strategy [2026] (Trypropel.ai)](https://www.trypropel.ai/resources/duolingo-customer-retention-strategy)

### 心理学・ゲーミフィケーション理論

- [The Octalysis Framework for Gamification (Yu-kai Chou)](https://yukaichou.com/gamification-examples/octalysis-gamification-framework/)
- [Streak Design in Gamification (Yu-kai Chou, 2026)](https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/)
- [Designing A Streak System: UX & Psychology (Smashing Magazine)](https://www.smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/)
- [The Psychology Behind Duolingo's Streak Feature (JustAnotherPM)](https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature)
- [Gamification and Self-Determination Theory (Sam Kenyon, Medium)](https://medium.com/@samkenyon/gamification-and-self-determination-theory-45a28494b672)
- [Self-Determination Theory + Gamification (TechTrends, Springer)](https://link.springer.com/article/10.1007/s11528-024-00968-9)
- [Autonomy, Relatedness, and Competence in UX Design (NN/G)](https://www.nngroup.com/articles/autonomy-relatedness-competence/)
- [How gamification motivates (Sailer et al., ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S074756321630855X)
- [Hooked Model by Nir Eyal (Growth Method)](https://growthmethod.com/hooked-model/)
- [How to Use Variable Rewards (Userpilot)](https://userpilot.com/blog/variable-rewards/)

### 児童発達心理

- [Normal Attention Span Expectations By Age (Brain Balance)](https://www.brainbalancecenters.com/blog/normal-attention-span-expectations-by-age)
- [A developmental perspective on feedback (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10373990/)
- [Erikson's Industry vs. Inferiority (PsychologyNotesHQ)](https://www.psychologynoteshq.com/industry-vs-inferiority/)
- [Middle Childhood (Lifespan Development)](https://open.maricopa.edu/devpsych/chapter/chapter-6-middle-childhood/)

### 競合分析

- [Khan Academy Kids: A Complete Guide for K-2 (Edu.com)](https://www.edu.com/blog/understanding-khan-academy-kids-a-complete-guide-for-k-2-teachers-and-parents)
- [Khan Academy: eLearning Gamification through Octalysis (Octalysis Group)](https://octalysisgroup.com/2015/09/khan-academy-elearning-gamification-through-an-octalysis-lens/)
- [Top 5 English Learning Apps for Kids (Spellings.App)](https://spellings.app/blog/top-5-english-learning-apps)
- [Top 11 ABCmouse Alternatives (MentalUP)](https://www.mentalup.co/blog/abc-mouse-alternatives)
- [ELSA Speak: AI-Powered English Learning](https://blog.elsaspeak.com/en/elsa-speak-the-future-of-ai-powered-english-learning/)
- [Lingokids Review (The Learning Standard)](https://thelearningstandard.org/apps/lingokids)

### Duolingo メカニクス詳細解説

- [Duolingo XP Points Explained (Duolingoguides)](https://duolingoguides.com/what-is-xp-in-duolingo/)
- [Duolingo Leagues 2025 Guide (Duoplanet)](https://duoplanet.com/duolingo-leagues-the-essential-guide-everything-you-need-to-know/)
- [Duolingo Energy System Complete Guide (Duoplanet)](https://duoplanet.com/duolingo-energy-system/)
- [Duolingo Gems & Lingots Complete Guide (Duoplanet)](https://duoplanet.com/duolingo-gems-and-lingots/)
- [Duolingo Streak System Detailed Breakdown (Premjit Singha, Medium)](https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f)
- [Duolingo Gamification Secrets (Orizon)](https://www.orizon.co/blog/duolingos-gamification-secrets)
- [Duolingo Handbook: 9 lessons (EverydayUX)](https://www.everydayux.net/the-duolingo-handbook-9-lessons-for-designing-world-class-products/)

---

**作成者**: PRJ-016 リサーチ部門
**Phase**: Phase 2 方向性決定資料
**次工程**: PM 部門 → 全部署レビュー → CEO 決裁 → Phase 2 設計着手
