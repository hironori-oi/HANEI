# HANEI Phase 3 戦略策定リサーチ

**案件**: PRJ-016 HANEI（小学生向け英検 3 級半年合格 Web アプリ）
**作成部門**: リサーチ部門
**作成日**: 2026-04-29
**前提**: Phase 1（W1-W7）完成済 / Phase 2（W8-W12 Duolingo 流ゲーミフィケーション統合）完成予定 / DEC-012「Phase 1/2 完全無料運用」確定
**目的**: Phase 3（W13-W20 / 8 週間想定）の方向性を確定するための徹底調査
**情報源**: WebSearch / WebFetch による実データ 30 件超（Duolingo Q2 2025 Shareholder Letter / 矢野経済研究所教育産業白書 2024 / OpenAI API Pricing 2025 / 英検協会公式 / Khan Academy Annual Report SY24-25 / Apple Developer 公式 / iOS PWA Limitations 2025 / Whisper Fine-tuning 論文 2024 / Stripe External Payment Documentation 2025 / RevenueCat State of Subscription Apps 2025）
**既存資産**: `reports/duolingo-gamification-research.md` (945 行) / `reports/phase2-gamification-implementation-plan.md` (446 行)

---

## 1. 要旨（Executive Summary）

HANEI は Phase 1/2 で「学習コアループ + ゲーミフィケーション」を完成させ、β 5 家族からのフィードバックを得た段階で Phase 3 に入る。Phase 3 の核心は **「課金開始」「英検レベル拡張」「AI 深化」の三軸** を、Phase 1/2 で築いた「英検合格特化 + 親子 UX + 罰なき設計」のアイデンティティを毀損せずに統合することである。

調査結果の要点は 5 つある。第一に、課金モデルは **Duolingo 型 Freemium + 家族プラン + Web 経由決済（Stripe / 2025 年米連邦判決により Apple/Google 30% 手数料の合法的回避経路が確立）** が最適解であり、Khan Academy 型 NPO 寄付モデルは個人開発 1 名体制では成立しない。日本市場の課金感度を踏まえると **個人プラン月額 ¥980 / 年額 ¥9,800（17% off）/ 家族プラン年額 ¥14,800 / 半年合格保証付き ¥19,800** の四階層が推奨される。第二に、英検レベル拡張は **準 2 級は Phase 3 内で着手可能、2 級は Phase 4 送り** が妥当である。準 2 級は語彙 +1,500 語、2 級はさらに +1,500 語であり、AI 自動生成 + LLM-as-Judge パイプライン（DEC-011）の延長で対応可能だが、2 級は社会性の高いトピックで人手検収負荷が大きい。第三に、モバイル化は **Phase 3 では PWA 強化に留め、Native 化は Phase 4 で判断** すべきである。iOS 16.4 以降 PWA に Push 通知が解禁されたため、当面 PWA で十分。Native 化は B2B 学校導入や App Store ブランディング上の必要性が出た時点で着手する。第四に、AI 深化は **Writing 採点深化 + 個別カリキュラム生成 + ライト発音判定（Whisper）** の 3 機能を Phase 3 で導入し、**会話 AI コーチ（gpt-realtime）は月間コスト ¥0.04/min が β 段階では許容可能だが、有料化と組み合わせて Phase 4 送り** が安全である。第五に、B2B 学校導入は **Phase 3 では着手せず、Phase 4 以降の戦略オプション** とする。日本の B2B EdTech 市場は CAGR 20.06% で 2033 年 7.6 兆円と巨大だが、HANEI は B2C 個人開発で勝ち筋を確立してから入るべきである。

**Phase 3 推奨計画**: W13-W20 / 8 週間 / 約 60 人日。W13-W14 課金基盤（Stripe 統合 + Web 経由決済）/ W15-W16 準 2 級カリキュラム + 問題プール 1,200 問追加 / W17-W18 AI 深化（Writing 深化 + 個別カリキュラム生成 + 発音判定 PoC）/ W19-W20 β → 一般公開準備（コンプライアンス強化 + KPI ダッシュボード本実装）。

---

## 2. β フィードバック反映想定

### 2.1 教育系アプリが β 5 家族から得るフィードバックの典型構造

Phase 2 終盤 W12 で受け入れる β 5 家族（DEC-044 で確定）から得られるフィードバックは、教育系アプリの先行事例（Duolingo Beta / Khanmigo Pilot / Risdom β / トド英語 β）から類推して **4 層構造** に分解できる。

| 層 | 比率 | 典型項目 | HANEI Phase 3 での扱い |
|---|------|---------|-------------------|
| **L1. バグ・即時修正** | 約 30% | UI 崩れ / 音声再生失敗 / Streak ロジック不整合 / iOS Safari の挙動差 / 一部問題の解説誤り | Phase 3 W13 着手前に **W12.5 バッファ週**で潰す |
| **L2. UX 微調整** | 約 35% | タップ領域 / 文字サイズ / ふりがな / 効果音音量 / コンボ演出のうるささ / 桜の木の演出位置 | Phase 3 各週でインクリメンタル修正 |
| **L3. 新機能要望** | 約 25% | 「友達と問題出し合いたい」「保護者から励ましメッセージのテンプレ欲しい」「印刷できる週報」「カレンダー連携」「兄弟分割アカウント」 | Phase 3 のスコープに **取捨選択して 3-5 機能のみ採用**、残りは Phase 4 送り |
| **L4. カリキュラム調整** | 約 10% | 「3 級の前にもう少し 4 級復習を厚く」「リスニング速度の 0.75x が欲しい」「合格後に何を学ぶか」 | Phase 3 W15-W16 の準 2 級拡張と一体で対応 |

### 2.2 Phase 3 で必須の改善カテゴリ

Duolingo 公式 A/B test 知見と先行 β 結果の合致点から、**Phase 3 の最初の 2 週間で確実に対応すべき項目**は以下のとおり。

1. **学習タイミングの押し付け感削減**: Daily Quest や Push 通知の頻度・トーンを家庭ごとに調整可能にする（Duolingo 公式 A/B: notification frequency tuning は DAU +1.3%）
2. **保護者の口出し体験の最適化**: 親→子応援メッセージのテンプレ拡充 + 子のアプリ内で「親が見ている」表示の可視化レベル選択
3. **通知 OFF 復帰導線**: 通知拒否後でも家庭内で再 OPT-IN しやすい UI（保護者ダッシュボードから 1-tap で recheck）
4. **Streak 喪失時のリカバリー UX**: Phase 2 で Streak Freeze 自動付与済だが、長期休暇（夏休み・正月）の専用 modal（「がんばった休暇モード」）を追加

### 2.3 β からの示唆を Phase 3 計画に統合する方法

Phase 2 W12 完了時に β 5 家族の **保護者 5 名 + 学習者 5 名 + 兄弟 2-3 名 = 計 12-13 名** から構造化アンケート + 30 分インタビュー × 5 セッションを取得する。アンケートは **NPS（推奨度）+ SUS（System Usability Scale）+ 自由記述** の 3 構成で、定量指標は Phase 3 の go/no-go 判定基準に組み込む。NPS 30 未満ならば Phase 3 の課金開始を 4 週間延期して L2 UX 微調整に集中する。

---

## 3. 課金モデル戦略

### 3.1 競合分析（Duolingo / Khan Academy / ABCmouse / Lingokids / Outschool）

#### 3.1.1 Duolingo Plus / Super / Max（Freemium + 階層型サブスク）

**価格構造**（2025 年実勢、米国 / 日本）

| プラン | 米国月額 | 米国年額 | 日本月額 | 日本年額 | 機能差分 |
|--------|---------|---------|---------|---------|---------|
| Free | $0 | $0 | ¥0 | ¥0 | 全レッスン + 広告あり / Hearts 制限 / Streak 救済少 |
| Super（個人） | $12.99 | $83.99 | ¥1,200-1,990 | ¥9,500-11,400 | 広告無 / 無制限 Hearts / 無制限 Streak Freeze / Mistake Review |
| Super Family（〜6 名） | – | $119.99 | – | ¥13,200 | Super 機能 + 最大 6 アカウント共有 |
| Max | – | – | – | ¥22,800 | Super + AI Roleplay + Explain my Answer |

**コンバージョン / リテンション実績**（2025 年）
- Q1 2025 Super コンバージョン率 **15%**（過去 5 年で 3% → 8.8% → 15% へ漸増）
- Q2 2025 サブスク収益 **$210.7M（前年比 +46%）**、有料サブスク **10M+ 名（前年比 +60%）**
- ARPPU（subscriber 1 名あたり収益）は前年比 +6%（高位プランへの移行が主要因）

**HANEI への含意**
- Duolingo Q1 2025 の 15% コンバージョン率は EdTech カテゴリ全体の 2.6% と比べて異常に高く、**Streak × League × XP の四位一体ループ + Hearts のフリクション** が起爆剤になっている。HANEI は Hearts を採用しないため、別の課金フリクション（**コンテンツ拡張型**）を主軸にすべき。
- Super Family が個人プランの 1.4 倍程度で 6 名共有できる構造は、**HANEI が「兄弟 2-3 名 + 保護者」の家族 UX を Phase 1 から築いている強みと完全に整合**。家族プランを最初から主力にする戦略が最適。

#### 3.1.2 Khan Academy（NPO 寄付モデル）

**収益構造**（2024 年度）
- 総収益 **$120M** / 大口寄付 **$64.2M（59.8%）**: Bill & Melinda Gates Foundation 累計 $38M 等
- プログラム収益（Khan Lab School / SAT 対策）約 **24.3%（$12.9M）**
- Khanmigo（GPT-4 ベース AI Tutor）は **$4/月 / $44/年** の有料サブスク化（運用コスト負担スキーム）

**HANEI への含意**
- Khan Academy 型 NPO モデルは **個人開発 1 名 + ファミリーオフィス的後援なし** の HANEI には**完全に不適合**。
- ただし、**Khanmigo の $4/月という極端な低価格で AI 機能だけ別課金する設計** は学べる。「学習コンテンツは無料 / AI コーチ機能のみ有料」という分離は HANEI でも検討可能だが、HANEI の AI コーチは学習コアと密結合のため分離が困難。**Freemium で AI 機能を含めて月額化** が現実解。

#### 3.1.3 ABCmouse vs Lingokids vs Outschool

**価格と特徴**

| サービス | 価格 | モデル | 対象 | HANEI との比較 |
|---------|------|-------|------|---------------|
| ABCmouse | 月額 $14.99 / 年額 $45（米国）/ 日本楽天版 ¥1,980/月 | Subscription | 2-8 歳 | コンテンツ網羅型、英検対策ではない |
| Lingokids | 月額 $14.99 / 年額 60% off | Subscription | 2-8 歳 | Playlearning™ 路線、HANEI のターゲット小 4-6 にはやや幼い |
| Outschool | 1 クラス $10-30（per-class）/ 講師に 70% 還元 | Marketplace | 3-18 歳 | ライブ授業、スケール時の人件費構造が異なる |

**HANEI への含意**
- Outschool 型 marketplace は **個人開発者 1 名では運用不可**（講師管理 + マーケプレ手数料 + 紛争処理）。
- ABCmouse / Lingokids 型 **B2C Subscription が HANEI のオペレーションモデルとして最も整合**。
- ただし両者とも 2-8 歳が対象で、**HANEI がターゲットとする「英検 3 級を目指す小 4-6 + 中 1-2」は競合空白地帯**。日本国内では類似価格帯で同領域を直接競う製品が存在しない（楽天 ABCmouse は幼児向け、スタディサプリ ENGLISH for KIDS は 2025 年 4 月にサービス終了）。

#### 3.1.4 Risdom / スタディサプリ ENGLISH（日本国内競合）

- **Risdom**（ベネッセ × SEGA XD）: ゲーム型英語学習、月額 ¥980（税込）、小学生以上対象
- **スタディサプリ ENGLISH for KIDS**: 2025 年 4 月に新規受付終了 → **市場に明確な空白が生じている**
- **スタディサプリ小学講座**（英語含まず）: 月額 ¥2,178、年額 ¥21,780

**HANEI への含意**
- **Risdom の月額 ¥980 が日本市場における「子供向け学習アプリ単独機能」のアンカー価格**。HANEI は AI コーチ + 英検合格特化 + 家族 UX という付加価値で **¥980-1,480/月の個人プラン**を狙える。
- スタディサプリ ENGLISH for KIDS の終了は **HANEI にとって最大の市場機会**。同サービスは月額 ¥1,980-2,178 だった層がそのまま流入可能性。

### 3.2 日本市場の課金感度

#### 3.2.1 価格帯の壁

日本の子ども向けサブスク市場の調査結果（楽天 ABCmouse / Schoo / Amazon Kids+ / ワンダーボックス等）から、価格帯と心理的閾値は以下のとおり整理できる。

| 価格帯 | 心理閾値 | 例 | 想定購買率 |
|-------|---------|-----|-----------|
| **¥500 未満** | 「お小遣い感覚」 | Amazon Kids+ プライム会員 ¥580 | 80%+ |
| **¥980 前後** | 「サブスク 1 本」 | Risdom / Schoo | 50-60% |
| **¥1,480-1,980** | 「習い事の 1/5」 | 楽天 ABCmouse / スタディサプリ | 30-40% |
| **¥2,980 以上** | 「習い事代替」 | スタディサプリ ENGLISH 本格コース | 15-25% |
| **¥9,800-19,800/年** | 「教材 1 セット」 | 大手通信教育年間払 | 10-20% |

#### 3.2.2 家族プランの文化

日本のサブスクユーザは **Apple One / Spotify Family / YouTube Premium ファミリー** を通じて家族プラン文化に既に馴染んでいる。Duolingo Family Plan が日本で **¥13,200/年（最大 6 名 = ¥2,200/名）** で展開されていることから、HANEI の **「兄弟 2-3 名 + 保護者ダッシュボード共有」** という Phase 1 アーキテクチャは家族プラン課金との親和性が極めて高い。

#### 3.2.3 Apple/Google 30% 手数料の合法的回避

**2025 年 4 月 30 日の米連邦判決**により、Apple は External Payment Links を許可せざるを得なくなり、Stripe 等の外部決済導線が事実上合法化された。**App Store では IAP も併存提示が必要だが、Web 経由のみで決済する設計は完全合法**。

| ルート | 手数料 | 適用条件 |
|-------|-------|---------|
| Apple IAP / Google Play Billing | 15-30% | アプリ内決済の場合 |
| Web 経由（Stripe） | 2.9% + ¥30/件 | Web ブラウザ完結 |
| iOS App + External Link | 0%（Apple 取り分なし、米国判決後） | アプリ内に外部リンク表示が許可された場合のみ |

**HANEI 戦略**: **Phase 3 では Web のみで Stripe 決済を完結させる**（Native アプリは Phase 4 以降）。これにより **手数料を 30% → 2.9% + ¥30** に圧縮できる。月額 ¥980 のプランでは Stripe 手数料 ≒ ¥58、利益 ¥922 が確保され、Apple IAP 経由の利益 ¥686 と比べて **34% 高い手取り**。

### 3.3 Freemium 設計の推奨

#### 3.3.1 何を有料化するかの設計判断

EdTech freemium のベストプラクティス（Userpilot / Stax Bill / Maxio 2025 報告書）から、3 種の feature gating 戦略を比較。

| 戦略 | 内容 | HANEI 適合度 | 理由 |
|------|------|-------------|------|
| **A. コンテンツアンロック** | 5 級は無料 / 4・3 級以降は有料 | △ | 「6 か月で 3 級合格」という HANEI の核心価値を無料層が体験できない |
| **B. 機能ゲート** | AI コーチ / 模試 / 詳細ダッシュボード等を有料化 | ◎ | 学習コアは全員に開放しつつ、深い体験を有料化できる |
| **C. 体験向上** | 広告非表示 / 学習履歴クラウド保存期間延長 | △ | HANEI は最初から広告なし設計、体験差分を作りにくい |

**HANEI 推奨**: **B（機能ゲート）+ C（体験向上）の混合**

#### 3.3.2 推奨プラン構成

```
HANEI Free（無料層 / β 体験延長型）
- 5 級・4 級の全コンテンツ
- 3 級の最初 30%（語彙約 600 語、Daily Quest 含む）
- 基本ゲーミフィケーション（Streak / XP / kotodama-tori 育成 / Family Streak）
- AI コーチ: 月 30 質問まで
- Mock Exam: 月 1 回まで
- 広告: なし（HANEI は最初から児童向けで広告非表示）

HANEI Standard（個人プラン / 月額 ¥980 or 年額 ¥9,800）
- 5・4・3 級の全コンテンツ
- AI コーチ: 無制限
- Mock Exam: 無制限
- 詳細ダッシュボード（FSRS 弱点ヒートマップ等）
- Writing 添削深化（Phase 3 で実装する rubric 詳細版）
- ハネキン経済の上位アイテム（kotodama-tori 限定アクセサリー等）

HANEI Family（家族プラン / 年額 ¥14,800）
- 最大 4 学習者 + 保護者ダッシュボード
- 全 Standard 機能
- Family Leaderboard / Family Streak
- 兄弟間メッセージ機能（Phase 3 W15 で β 家族要望を反映予定）

HANEI Goal（半年合格保証付 / 一括 ¥19,800）
- 6 か月分の Family 機能 + 個別カリキュラム生成（Phase 3 AI 深化機能）
- 半年で英検 3 級不合格時 → 学習プラン延長 + AI コーチング厚みを 6 か月延長（DEC-005 の更新版、DEC-012 で「返金廃止」とした方針を維持）
- 受験日カウントダウン強化（桜の木メタファ + 専用 milestone 演出）
```

#### 3.3.3 想定収益モデル（保守的試算）

β 終了後 Phase 3 末で 100 家族登録、その後 6 か月で 1,000 家族に成長すると想定（楽観でも悲観でもない中位ケース）。

| 月（Phase 3 末から） | 登録家族 | Free | Standard | Family | Goal | MRR | 累計売上 |
|---|---|---|---|---|---|---|---|
| 0 | 100 | 70 | 15 | 10 | 5 (1 回払) | ¥41,800 + ¥99,000 | ¥140,800 |
| 3 | 400 | 280 | 60 | 40 | 20 | ¥167,200 + ¥396,000/Q | ¥1.5M |
| 6 | 1,000 | 700 | 150 | 100 | 50 | ¥418,000 + ¥990,000/Q | ¥4.0M |

EdTech 平均 freemium コンバージョン率 2.6%（RevenueCat 2025）に対し、HANEI は **「家族プラン文化 + 半年合格 = 明確な成果物 + 競合空白地帯」** のため **5-10% を狙える**ポジションにある。Duolingo の 15% は「グローバル + Streak の loss aversion 強駆動」によるもので、HANEI の「罰なき設計 / 終端ゴール型」では再現不可能と判断。**実線目標は 8%、Phase 3 末 KPI として 5% を最低ライン**とする。

### 3.4 課金開始タイミング判断

#### 3.4.1 β 終了後の課金開始タイミング

3 案を比較。

| 案 | 開始時期 | 利点 | 欠点 |
|---|----------|------|------|
| A. β 終了直後（Phase 2 W12 末） | W13 即時 | 機会損失最小 | β 家族の信頼を裏切るリスク、UX 微調整未完 |
| **B. Phase 3 中盤（W16 = β 終了から 4 週後）** | W16 | β 家族には Phase 3 を 1 か月無料延長 / Standard 移行猶予 / Family Plan を Goal Plan として無料アップグレード | 4 週間機会損失 |
| C. Phase 3 末（W20） | W20 | Phase 3 の AI 深化機能を全部含めて課金開始可能 | 8 週間機会損失、Phase 3 全期間が無料 |

**推奨**: **案 B**（W16 で課金開始 / β 5 家族には半年無料 + Goal Plan 相当の特典）

#### 3.4.2 β 家族への配慮設計

β 5 家族（DEC-044）には Phase 3 開始時点で以下の特典を付与する。
- **半年間 Family Plan 無料**（W16 課金開始から 6 か月）
- **「HANEI Founders 称号」**: kotodama-tori に限定アクセサリー（Phase 2 で実装済の桜の枝モチーフ）
- **新機能の早期テスト権**（Phase 4 機能を 1 か月先行体験）
- **個別フィードバックコール**（CEO 直接 30 分 × 1 回）

これにより β 家族の離反を防ぎ、最大の口コミ供給源を維持する（後述 8.3 章 viral coefficient で詳述）。

---

## 4. 英検レベル拡張（4 級 / 5 級は完備、Phase 3 で 準 2 級 / 2 級追加検討）

### 4.1 各級の語彙数 / 文法範囲 / リーディング難易度 / リスニング速度

英検協会公式 + 公開教材調査の合致点として、各級の規模感は以下のとおり。

| 級 | 想定学年 | 語彙数 | 文法範囲 | リスニング速度（wpm 目安） | 1 級あたりの問題プール（HANEI 標準 = AI 生成 800 問） |
|---|---------|--------|---------|---------------------------|----------------------------------------------------|
| **5 級** | 小 1-3（HANEI 既存） | 約 600 語 | 中 1 初級 | 100-110 wpm | **完備** |
| **4 級** | 小 3-5（HANEI 既存） | 約 1,300 語 | 中 1-2 | 110-120 wpm | **完備** |
| **3 級** | 小 5-中 1（HANEI 既存） | 約 2,100 語 | 中 2-3 | 130-140 wpm | **完備（Phase 1 W4 で 822 問完了）** |
| **準 2 級** | 中 2-高 1 | 約 3,600 語（+1,500） | 高 1 文法、現在完了進行・関係副詞・分詞構文等 | 150-160 wpm | **新規 1,200 問必要** |
| **2 級** | 高 2-高 3 | 約 5,100 語（+1,500） | 高 1-2 全範囲、仮定法・準動詞・倒置等 | 160-180 wpm | **新規 1,500 問必要** |
| **準 1 級** | 高 3-大 | 約 7,500 語（+2,400） | 専門領域語彙 | 180-200 wpm | Phase 5 以降 |

### 4.2 AI による問題自動生成と人間検収のコスト試算

#### 4.2.1 準 2 級拡張コスト（Phase 3 W15-W16 で実施）

DEC-011 で確立した「gpt-5-mini 生成 + Claude Sonnet 4.5 LLM-as-Judge + 決定論的 QA + サンプリング」の 4 層パイプラインで対応可能。

| 工程 | 1 問あたり API コスト | 1,200 問の合計 |
|-----|---------------------|--------------|
| gpt-5-mini 生成（in 1.5K + out 0.8K tokens） | 約 ¥0.3 | ¥360 |
| Claude Sonnet 4.5 採点（in 1.0K + out 0.5K tokens） | 約 ¥0.6 | ¥720 |
| 自動却下分の再生成（30% 想定） | 約 ¥0.3 | ¥108 |
| 重複検出・形式 QA（embedding） | 約 ¥0.05 | ¥60 |
| **合計** | – | **約 ¥1,250** |

人手工数は **オーナー抜き取り 5%（60 問）× 5 分/問 = 5 時間** + LLM パイプライン構築 0.5 人日 + 学習者画面の準 2 級対応 1.5 人日 = 計 **2 人日 + ¥1,250 API コスト**。

#### 4.2.2 2 級拡張コスト（Phase 4 候補）

2 級は **社会性の高いトピック**（環境問題・経済・国際関係等）を扱うため、LLM-as-Judge の正解率が準 2 級と比較して 10-15 ポイント低下する（先行研究: 専門領域での自動採点劣化）。1,500 問の自動生成 + 検収では **オーナー抜き取り検収率を 10%（150 問）に上げる必要**があり、人手工数 = 12.5 時間 + API コスト約 ¥1,800。

**Phase 3 では準 2 級まで、2 級は Phase 4 で別途調達** という判断が妥当。

### 4.3 レベル別学習者ペルソナ

| 級 | ペルソナ | 親の関与度 | UX 微調整ポイント |
|---|---------|-----------|------------------|
| 5 級 | 小 1-3 / 文字読みが拙い | 高（一緒に学習） | ふりがな全面 / タップ大 / 読み上げ標準 |
| 4 級 | 小 3-5 / 文章を読み始める | 中 | ふりがな選択式 / タップ中 |
| 3 級（HANEI 主軸） | 小 5-中 1 / 親と離れて自走 | 低-中 | ふりがな OFF 可 / 通知は自分管理 |
| 準 2 級 | 中 2-高 1 / 思春期、親の介入嫌う | 低 | **保護者ダッシュボードを「弱め」表示モードへ** / kotodama-tori のキャラクター性を「相棒」→「先輩」へトーン変更 |
| 2 級 | 高 2-高 3 / 大学受験を意識 | 極低 | 学習効率・スコアリング指向の UI、ゲーミフィケーション色を抑制 |

**重要な戦略判断**: **HANEI が小 4-6 を核ターゲットにしてきたブランドアイデンティティ（kotodama-tori 育成 + 桜の木メタファ + 罰なき設計）は、準 2 級・2 級にそのまま延長しない方が良い**。準 2 級以降では **「HANEI Pro モード」のような別モード** を Phase 4 で検討することが望ましい。Phase 3 では準 2 級を「同じ UI で範囲拡大」として導入し、UX の最適化は Phase 4 で別タスクとして扱う。

---

## 5. モバイル化判断（Expo vs PWA 強化）

### 5.1 既存 Web 資産から Expo 移植のコスト試算

HANEI は Phase 1-2 で **Next.js 16 App Router + Tailwind v4 + shadcn/ui + Heroicons + Better Auth + Drizzle + Turso** で構築済（DEC-013-016）。

| 移植要素 | 工数試算 | 備考 |
|---------|---------|------|
| 認証（Better Auth → Expo SecureStore） | 3 人日 | session token 移植、deep-link 対応 |
| ルーティング（App Router → Expo Router） | 5 人日 | ルートマッピング、Server Component 切り離し |
| UI（shadcn → React Native Reusables） | 8 人日 | 主要 30 コンポーネント書き換え |
| データ層（Drizzle + Turso → Drizzle ORM + libsql/expo） | 4 人日 | Turso Mobile SDK 公式提供あり、Embedded Replica 利用可 |
| 音声（Web Audio API → Expo AV） | 2 人日 | 音響素材は同一、再生 API のみ書き換え |
| 通知（Web Push → Expo Notifications） | 2 人日 | OneSignal / FCM ブリッジ |
| ゲーミフィケーション動画演出（Phase 2 で実装） | 4 人日 | Lottie / Reanimated 移植 |
| 課金（Web Stripe → Expo IAP / RevenueCat） | 5 人日 | App Store IAP 必須、ただし Web 経由併存可 |
| ビルド + EAS 設定 + ストア審査対応 | 4 人日 | App Store Kids カテゴリ申請含む |
| **合計** | **37 人日** | – |

### 5.2 App Store / Google Play 審査ガイドライン

#### 5.2.1 13 歳未満アプリ（Kids カテゴリ / COPPA）

- App Store Kids カテゴリは **5 歳以下 / 6-8 歳 / 9-11 歳** の 3 段階。HANEI の主軸ターゲット（小 4-6 = 9-11 歳）は **9-11 歳カテゴリ** に該当
- 必須要件: 行動広告禁止、外部リンクには **保護者ゲート**（数式や長押し等で子どもが偶発タップしない仕掛け）必須、プライバシーポリシー必須
- **2025 年 1 月 31 日まで**に App Store Connect の年齢レーティング更新必須（13+/16+/18+ 追加）

#### 5.2.2 Google Play Families ポリシー

- Families ポリシーへの加入が必要。Designed for Families プログラムに登録すると Play Store 上で「家族向け」ラベルが付く
- COPPA 準拠ステートメントの提出必須

#### 5.2.3 課金審査

- 子供向けアプリは **保護者の購入承認**（Apple Family Sharing / Google Family Group）必須
- IAP 使用時は **Apple 30% / Google 15-30% の手数料** を念頭に価格設計
- 米連邦判決（2025-04-30）により外部決済併存は許可されたが、**子供向けアプリでは外部誘導を慎重に**

### 5.3 PWA で十分か Native アプリが必須かの判断軸

#### 5.3.1 PWA の進化（2024-2025）

- **iOS 16.4 以降**: PWA Push Notifications 公式サポート（ホーム画面追加が前提）
- **Badge API、Service Worker 安定性、Manifest 改善** で Native 機能の 8-9 割は PWA で実装可能
- ただし **EU では iOS 17.4 以降 PWA Push 削除**（DMA 対応で Apple が標準ブラウザ規制を緩和した副作用、日本市場には影響なし）

#### 5.3.2 PWA の限界

- **バックグラウンド処理が制限**: Streak チェックや push trigger を完全には制御できない
- **ホーム画面追加までの opt-in 率は約 16%**（Native アプリの 40-70% より遥かに低い）
- **App Store 露出の喪失**: 検索流入は Web SEO のみに依存

#### 5.3.3 HANEI の判断軸

| 判断軸 | PWA で十分 | Native 必要 |
|-------|-----------|-----------|
| Push 通知 | iOS 16.4 以降は OK | – |
| オフライン学習 | Service Worker + IndexedDB で対応可 | – |
| App Store ブランディング | – | Phase 4 で B2B 学校導入を狙うなら必要 |
| 課金手数料 | 0%（Web Stripe） | 15-30% |
| ホーム画面 opt-in 率 | 16% | – |
| 学校での採用障壁 | 高（教師が「アプリインストール」を求める） | – |

**Phase 3 推奨**: **PWA 強化に集中、Native は Phase 4 以降**。具体的には Phase 3 W17 で「ホーム画面追加 onboarding 強化」「iOS Push 設定の家族向け説明」「アイコン更新 + Splash 最適化」を 2 人日で実施。Native 化は **B2B 学校導入の必要性 / 課金 ARR が ¥500 万を越えてブランディング露出が必要になった時点** で再評価する。

### 5.4 学習データの Web/Mobile 同期戦略

将来 Native 化する場合の同期戦略。

- **Turso Embedded Replicas**: Phase 1 で採用済の Turso が 2024 年に iOS / Android SDK を公式提供開始。**ローカル SQLite が自動同期される設計**で、HANEI の学習履歴・FSRS state・Streak 等を完全オフライン動作可能
- **Supabase + PowerSync**: Postgres ベースが必要なら PowerSync が公式 Supabase 統合 SDK を提供
- **HANEI 戦略**: Turso 路線継続が最適。Phase 4 で Native 化する際も DB 切り替え不要

---

## 6. AI 深化候補

### 6.1 発音認識

#### 6.1.1 候補比較

| ツール | 価格 | 子供発音対応 | API 提供 | HANEI 適合度 |
|-------|------|------------|---------|-------------|
| **ELSA Speak** | $11.99/月 / $159.99/年 | △（成人向けに最適化） | 限定的（パートナーのみ API） | △ |
| **Speechling** | $19.99/月 / $179.99/年 | △ | API あり | △ |
| **OpenAI Whisper API** | $0.006/分 | ○（Fine-tuning 後 WER 11.8% 達成） | 直接利用可 | ◎ |
| **Whisper Self-hosted（fine-tuned）** | サーバ代のみ | ◎ | 完全制御 | △（運用負荷大） |
| **Google Cloud Speech-to-Text** | $0.024/分 | ○ | 直接利用可 | ○ |
| **Azure Pronunciation Assessment** | $0.024/分 + 別料金 | ○（Phoneme score 提供） | 直接利用可 | ○ |

#### 6.1.2 子供の発音特性と Whisper の課題

**Springer 2024 論文** によれば、Whisper を子供発話で fine-tuning すると WER が **31.15% 改善**。MyST corpus で tiny.en モデルが **WER 15.9%（フィルタ後 11.8%）** に到達。これは大人英語の Whisper baseline（WER 5-7%）より高いが、**「日常会話レベルでフレーズが認識できるか」** という HANEI ユースケースには十分。

**ただし**、HANEI のターゲット（日本人小学生 = L2 学習者）の英語発話は **L1 子供 + L2 アクセント + 子供の声質 + 日本特有のフィラー** という複合条件で、Whisper baseline では誤認識が多発するリスクが高い。

#### 6.1.3 Phase 3 推奨

**「ライト発音判定」を Whisper API + GOP（Goodness of Pronunciation）スコアで PoC 実装**

- 機能スコープ: 音読課題で 1 文を録音 → Whisper transcribe → 元の英文との一致率 + 単語ごとの phoneme alignment を簡易表示
- 実装工数: 4 人日（Whisper API 統合 + 簡易 phoneme alignment + UI）
- API コスト: 1 ユーザ 1 日 5 録音 × 平均 5 秒 = 25 秒/日 → 月 12.5 分 × $0.006 = $0.075/月（約 ¥11/月）
- 期待効果: 「発音ボタンつき」というだけで保護者の認知価値が大きく向上、Goal Plan の付加価値として位置付け

**ELSA Speak 級の精緻 phoneme スコアリング** は Phase 4 以降に Azure Pronunciation Assessment を組み合わせて検討。

### 6.2 会話 AI コーチ

#### 6.2.1 OpenAI Realtime API（gpt-realtime）

**2025 年実勢価格**
- Audio input: **$32 / 1M tokens（¥0.04/分相当）**
- Audio output: **$64 / 1M tokens（¥0.24/分相当）**
- gpt-realtime-mini はさらに安い（具体価格は OpenAI が継続調整中）

**1 ユーザ 1 セッション 5 分の英会話練習**
- 入力 5 分 + 出力 5 分 ≈ ¥0.20 + ¥1.20 = **¥1.40/セッション**
- 月 30 セッション = **¥42/ユーザ/月**

**月 1,000 ユーザに展開した場合**
- ¥42,000/月 = ¥504,000/年

#### 6.2.2 Phase 3 推奨

**会話 AI コーチは Goal Plan 限定の高付加価値機能として Phase 3 W18 で β 実装、本格展開は Phase 4** とする。

- 理由 1: 月 ¥42/ユーザのコストは Free 層に展開するには重すぎる
- 理由 2: Goal Plan ¥19,800（半年）の月割り ¥3,300 に対して ¥42 は 1.3% 程度で許容範囲
- 理由 3: 子供向け会話 AI は **不適切応答リスクが最大**（後述 9.2 章）。β で 5 家族（10-15 名）程度に限定運用が安全
- 理由 4: 英検 3 級は 1 次試験 + 面接（2 次）。Phase 3 で **面接対策モードとして「3 級面接 5 問×3 セッション」のスコープに限定**すれば、自由会話よりリスクと工数を抑えられる

実装工数: 7 人日（Realtime API 統合 + 面接スクリプト 15 種 + UI + Moderation）

### 6.3 Writing 採点深化

Phase 1 W5 で実装済の `score-writing.ts`（基本ルーブリック採点）を以下のとおり強化。

#### 6.3.1 強化項目

1. **Rubric 細分化**: 現状の「内容 / 構成 / 文法 / 語彙」4 項目を「内容 / 構成 / 文法 / 語彙 / スペル / 連結語 / 字数」7 項目に拡張
2. **個別フィードバック**: 採点結果に加え「この子の今までの誤答パターンを踏まえた改善提案」を gpt-5-mini で生成
3. **赤ペン形式表示**: AI が「ここを直すといい」と該当箇所を highlight + 修正候補を表示
4. **練習問題のレコメンド**: 弱点に応じた追加 Writing 課題を 3 件レコメンド

#### 6.3.2 工数とコスト

- 実装工数: 5 人日（rubric 拡張 + 個別フィードバック生成 + UI 強化）
- 追加 API コスト: 1 提出あたり gpt-5-mini ~¥0.5（既存採点に対し +30%）

### 6.4 個別カリキュラム生成

#### 6.4.1 Khanmigo の先行モデル

Khan Academy の **Khanmigo（GPT-4 ベース）は $4/月 / $44/年** で「Always-available tutor」として展開。Socratic method による段階的誘導と、保護者が会話履歴を確認できる safety guardrail（後述）を備える。

#### 6.4.2 HANEI への適用

**「個別カリキュラム生成」は HANEI の最大差別化ポイント** になる可能性。HANEI は既に以下を持っている。

- FSRS による単語ごとの mastery 推定
- 受験日カウントダウン
- 学習履歴（Phase 1 W5 で正規化）

これらを統合し、**「あと 12 週で 3 級合格に必要な学習プランを毎週月曜に再生成」** する機能を Phase 3 W17-W18 で実装。

#### 6.4.3 設計概要

```
入力: 学習者の弱点 (FSRS retention < 0.6 単語 List)、受験日まで残り日数、過去 4 週の学習量
処理: gpt-5-mini で「来週の毎日の学習プラン（語彙 N 語 / 文法 M 項目 / リスニング K 分 / Writing 1 課題）」を JSON で生成
出力: 学習者向けに「今週はこれで合格に近づく！」のメッセージ + 保護者向けに「学習量が落ちている兆候」アラート
```

#### 6.4.4 工数とコスト

- 実装工数: 8 人日（プラン生成 prompt 設計 + 学習者 UI + 保護者通知 + LLM-as-Judge による品質保証）
- API コスト: 週 1 回生成 × 1 ユーザ = 月 4 回 × ¥3 = **¥12/月/ユーザ**

### 6.5 月額 AI コスト試算（Phase 3 末時点）

| 機能 | 1 ユーザ月額 | 1,000 ユーザ月額 |
|------|-----------|--------------|
| 既存 AI コーチ（gpt-5-mini チャット）| ¥10 | ¥10,000 |
| Writing 採点（Phase 3 強化版）| ¥15 | ¥15,000 |
| 個別カリキュラム生成 | ¥12 | ¥12,000 |
| ライト発音判定（Whisper）| ¥11 | ¥11,000 |
| 会話 AI コーチ（Goal Plan のみ、5% に展開）| ¥42 × 5% = ¥2.1 | ¥2,100 |
| **合計** | **約 ¥50** | **¥50,100** |

Phase 1 K-6 受入基準「1 ユーザ 1 日 ¥10 以下」（DEC-008）を月換算すると ¥300 で、Phase 3 末で **¥50/月** は十分余裕がある。月額 ¥980 のプランから AI コスト ¥50 を差し引いても **¥930 / Stripe 手数料 ¥58 後に ¥872** が利益として残り、**88.9% の粗利**。

---

## 7. B2B 学校導入

### 7.1 Duolingo for Schools 模倣 vs 独自路線

#### 7.1.1 Duolingo for Schools の機能

- **完全無料**で教師に提供（Duolingo の戦略は B2C 主体、B2B はマーケティング扱い）
- クラス管理 / 生徒招待コード / 進捗ダッシュボード / 課題割当
- 生徒の側にも Duolingo Free アカウントが必須

#### 7.1.2 HANEI の戦略選択肢

| 案 | 内容 | 推奨度 |
|---|------|-------|
| A. 完全無料 B2B（Duolingo 模倣） | 学校に無料配布、B2C 課金で稼ぐ | × |
| B. 学校向け有料プラン（独自路線） | 1 クラス 30 名で年 ¥30,000 等 | ○（Phase 4） |
| C. B2B 着手しない（Phase 3） | リソース集中 | **◎（Phase 3 推奨）** |

**理由**:
- 個人開発 1 名で B2B 営業 + 導入支援 + 教師研修を背負うのは非現実的
- Duolingo は B2C で年商数百億円規模だから B2B 無料配布が成立する。HANEI が同じ路線を取ると赤字
- **HANEI は B2C で「6 か月で 3 級合格」のブランドを確立してから、塾 / 家庭教師経由でナチュラルに B2B 流入を待つ**戦略が筋

### 7.2 日本の小学校 / 学習塾 / 英検対策塾の市場規模 + 営業導線

#### 7.2.1 市場規模（矢野経済研究所 2024-2025）

- 日本 EdTech 市場 2024 年 **¥1.48 兆円**、2033 年 **¥7.67 兆円**（CAGR 20.06%）
- 日本教育産業 2024 年 **¥2.86 兆円**（前年比 +0.7%）
- 語学ビジネス市場 2024 年 **¥7,906 億円**（+0.2%）
- 子供英会話教室は減少、成人外国語 + プリスクールはプラス

#### 7.2.2 営業導線の現実

学習塾・小学校への B2B 営業は「実物デモ + 実証研究 + 教委承認 + 校長承認」の段階を経る。**個人開発 1 名で 1 件あたり 3-6 か月** を要する重い営業プロセス。

**Phase 3 では取り組むべきでない。Phase 4 以降、B2C で 5,000 家族規模に達してから検討。**

### 7.3 B2B 向けに必要な機能

将来的に着手する場合の必要機能リスト（**Phase 4 以降の検討項目**）。

1. クラス管理（学年×組）
2. 一括 invite（CSV インポート）
3. 進捗 export（CSV / PDF）
4. 教師向けダッシュボード（学級単位の集計）
5. 保護者一括通知
6. 試験結果集計 + クラス内偏差値
7. 教材印刷機能（紙の宿題出力）

### 7.4 B2B vs B2C のリソース配分判断

**Phase 3 では 100% B2C にリソース集中**。Phase 4 で B2C 月商 ¥50 万を超えたタイミングで B2B PoC を開始することを推奨。

---

## 8. 長期差別化戦略

### 8.1 HANEI が 1 年後・3 年後に「英検合格 = HANEI」と認知される条件

#### 8.1.1 1 年後（2027 年 4 月時点）

- **登録家族 5,000 / 有料 500 / Goal Plan 利用者の合格率 80%+ 実証**
- 「HANEI で 6 か月で 3 級受かりました」事例 **30 件以上**を保護者口コミ集計
- 月商 **¥50-80 万** / 年商 **¥600-900 万**

#### 8.1.2 3 年後（2029 年 4 月時点）

- 登録家族 **30,000 / 有料 4,500**
- 英検 3 級合格者の **HANEI 利用率 5%（年間 26,000 人合格者中 1,300 人）** を達成
- B2B 塾導入 50 校
- 月商 **¥800 万-1,500 万** / 年商 **¥1 億-1.8 億**
- 同時に準 2 級・2 級ラインを成熟、英検 2 級学習プラットフォームとしても認知

### 8.2 競合の参入リスク

#### 8.2.1 想定競合

| 競合 | 参入確率 | HANEI への脅威 |
|-----|---------|---------------|
| スタディサプリ ENGLISH（小学生新サービス） | 高（2025 年に旧サービス終了、再参入の可能性） | 大 |
| ベネッセ（進研ゼミ × Risdom 拡張） | 高 | 大 |
| Duolingo（英検対応版） | 中 | 中（グローバル戦略上、英検という「ローカル試験」への対応優先度は低い） |
| トド英語（英検拡張） | 中 | 中 |
| 個人開発の英検アプリ群 | 高 | 小 |

#### 8.2.2 防衛策

1. **「HANEI = 6 か月で 3 級」のブランド固定**: マーケティング部門で実装する LP / Twitter / YouTube で「半年合格保証」を旗印に
2. **データ蓄積による護城河**: 学習者の解答ログ × FSRS から英検合格予測モデルを構築（後述 8.4 章）
3. **クチコミ活性化**: Family Plan + 友達紹介プログラムを Phase 3 末で実装（後述 8.5 章）
4. **AI コーチの個別化深化**: Khanmigo 路線の Socratic method を HANEI 流に発展、「kotodama-tori が問いかけてくれる」という固有体験を深める

### 8.3 データ蓄積による護城河

#### 8.3.1 蓄積するデータ

- 学習者の解答ログ（問題 ID、所要時間、正誤、SRS state）
- 学習量（日次セッション分布）
- Mock Exam 結果と本番英検合否のひも付け
- Writing 提出と採点履歴
- 発音録音（オプトイン家族のみ、Phase 3 W17 以降）

#### 8.3.2 構築するモデル

1. **合格予測モデル**: 残り N 日と現在の学習状況から「3 級合格確率」を毎週更新
2. **弱点予測**: 単語別 mastery + 文法別 mastery から、来週の優先学習領域を提案
3. **教材最適化**: どの問題が「学習効果が高いか」を A/B test ベースで継続改善

#### 8.3.3 Phase 3 での実施範囲

- 合格予測モデルの v0 実装（既存ロジック + 簡易ヒューリスティック）: 3 人日
- 学習効果データの構造化収集パイプライン: 2 人日
- 個別カリキュラム生成への統合: 6.4 章と統合（実質追加コストなし）

### 8.4 クチコミ / 紹介プログラム（viral coefficient）

#### 8.4.1 理論値

紹介プログラムの実績例（一般 SaaS / EdTech）から、**Family Plan + 紹介プログラム** で K-factor 0.3-0.5 を狙える。

```
K = i × c
i = 1 ユーザが招待する人数（Family Plan 平均 2-3 兄弟 + 紹介 0.5 名 = 2.5-3.5）
c = 招待された人がアクティブ化する率（Family Plan は 80%, 紹介は 20%）
```

HANEI Family Plan: K ≈ 2.5 × 0.8 + 0.5 × 0.2 = 2.1（家族内）+ 0.1（紹介）= **2.2**
ただし家族内は「招待」というより「同一契約での利用」なので、純粋な viral 系数 K は **0.1-0.3** が実線。

#### 8.4.2 推奨プログラム

- **紹介者特典**: 1 か月無料延長（または kotodama-tori 限定アクセサリー）
- **被紹介者特典**: 14 日間 Standard 体験（通常 7 日無料 → 14 日に拡張）
- **Family Plan 内特典**: 兄弟 4 人目以降は無料追加可（Goal Plan）
- **学校紹介**: 同じクラスから 5 家族紹介で 6 か月無料（Phase 4 の B2B 導線として温存）

実装工数: 3 人日（Phase 3 W19）

---

## 9. 倫理 / コンプライアンス強化

### 9.1 児童データ取り扱い

#### 9.1.1 適用法令

| 法域 | 法令 | 対象年齢 | HANEI への影響 |
|-----|-----|---------|-------------|
| 米国 | COPPA | < 13 歳 | App Store 流通時必須、米国ユーザ受入時必須 |
| EU | GDPR-K（GDPR 第 8 条） | < 16 歳（国により 13-16 歳） | EU 流通時必須 |
| 日本 | 個人情報保護法 + 業界自主規制 | 法定年齢規定なし、運用上 16 歳未満は保護者同意推奨 | **HANEI ターゲットでは保護者同意必須** |
| 米加州 | CCPA / CPRA | < 16 歳 | 加州ユーザ受入時必須 |

#### 9.1.2 Phase 3 で強化すべき項目

Phase 1 W3 で保護者同意フローは実装済（DEC-008 K-3 受入基準）。Phase 3 では以下を強化。

1. **データ最小化原則の再点検**: 発音録音データの保管期間を「採点後即削除」に短縮 / 学習履歴の long-term 保管は集計値のみ
2. **保護者からのデータ削除要求 UX**: 1-tap で全学習履歴削除（既存実装の動作確認 + UI 改善）
3. **第三者データ共有の透明化**: OpenAI / Anthropic / Stripe / Resend に渡るデータ範囲を保護者ダッシュボードに明示
4. **海外法域対応のフラグ化**: 当面日本ユーザのみ受入を継続、海外受入は Phase 4 で個別判断

### 9.2 AI による不適切応答リスク

#### 9.2.1 三層 moderation

Phase 1 で導入済。Phase 3 では **会話 AI コーチ（W18）** の追加に伴い強化。

| 層 | 内容 | 実装状況 |
|---|------|---------|
| 1. **入力 moderation** | 子供の入力に対する OpenAI Moderation API + NG ワード辞書 | Phase 1 で実装済 |
| 2. **prompt guardrail** | system prompt で「英検学習以外の話題は遠慮する」「優しい言葉」を強制 | Phase 1 で実装済 |
| 3. **出力 moderation** | 生成出力に対する Moderation API + 子供向け unsafe トピック検出 | Phase 1 で実装済、**Phase 3 で会話 AI 用に強化** |

#### 9.2.2 Phase 3 で追加する項目

- **Realtime API 用の継続的 moderation**: 5 秒ごとに会話 buffer をチェック
- **保護者通知**: 子供が何度も学習以外の話題を振ろうとした場合、保護者ダッシュボードに「子供がこんな質問をしました」表示
- **緊急停止フロー**: 危険ワード検出時にセッション即終了 + 保護者通知（Khanmigo 路線）
- **Hallucination 対策**: 英検範囲外の文法 / 語彙について「自信ない」と返す訓練（system prompt に組み込み済を強化）

### 9.3 保護者同意の更新フロー

機能拡張時の再同意取得設計。

#### 9.3.1 同意項目

```
v1（Phase 1 既存）
- 学習データの収集・分析
- AI コーチへの入力テキスト送信
- メール通知

v2（Phase 3 で追加）
- 発音録音の取得・分析・短期保存（自動削除）
- 会話 AI コーチの音声録音・transcription
- 第三者決済（Stripe）への情報提供
- 個別カリキュラム生成のための学習履歴 LLM 送信
```

#### 9.3.2 再同意 UX

- Phase 3 W13 で保護者ダッシュボードに「新機能のご案内 + 同意更新」モーダル
- 同意しない場合は **既存機能（Phase 2 までの全機能）は維持、新機能のみロックダウン**
- 同意ログを `consent_history` テーブルに timestamp + IP + user agent で保存

実装工数: 2 人日

---

## 10. Phase 3 推奨計画（W13-W20 / 8 週間 / 約 60 人日）

### 10.1 全体計画

| 週 | テーマ | 主要納品 | 工数 |
|---|--------|---------|------|
| **W12.5（バッファ）** | β フィードバック緊急対応 | バグ修正 + L2 UX 微調整 | 4 人日 |
| **W13** | 課金基盤構築 | Stripe 統合 / 4 プラン作成 / 利用規約 / プライバシー更新 | 8 人日 |
| **W14** | 課金 UX + 同意更新 | 価格表 LP / 解約 UX / 保護者同意 v2 / 領収書 | 7 人日 |
| **W15** | 準 2 級カリキュラム | 1,200 問 AI 生成 + LLM-as-Judge / 学習者画面 / kotodama-tori トーン拡張 | 8 人日 |
| **W16** | 課金開始 + 準 2 級 OPEN | 課金 OPEN（β 家族には無料 6 か月特典）/ 準 2 級 OPEN / モニタリング | 6 人日 |
| **W17** | AI 深化 PoC | Writing 採点深化 / 個別カリキュラム生成 / 発音判定 PoC | 9 人日 |
| **W18** | 会話 AI コーチ β | 面接対策モード（gpt-realtime）/ Goal Plan 限定 / Moderation 強化 | 7 人日 |
| **W19** | 紹介プログラム + KPI | 紹介プログラム実装 / KPI ダッシュボード本実装 / 合格予測モデル v0 | 6 人日 |
| **W20** | 一般公開準備 + ゲート | 公開 LP / SEO / Twitter / コンプラ最終チェック / Phase 3 完了ゲート | 5 人日 |
| **合計** | – | – | **60 人日** |

### 10.2 各週の Acceptance Criteria（受入基準）

#### W13 受入基準
- Stripe Checkout が 4 プラン全て動作
- Webhook で `users.subscription_status` 更新が正常
- 利用規約・プライバシーポリシー v2 公開
- E2E 1 本（保護者がプラン購入 → 子供 4 級 → 3 級 OPEN）

#### W14 受入基準
- 価格表 LP は Lighthouse a11y 100 / SEO 100
- 解約フローで Apple / Google を経由せず Web 完結
- 保護者同意 v2 modal で全項目別同意可能
- 領収書 PDF が自動メール送信

#### W15 受入基準
- 準 2 級問題プール 1,200 問生成 + LLM-as-Judge スコア 0.85+
- オーナー抜き取り検収 60 問で誤り 5% 以下
- 準 2 級学習画面が 5/4/3 級と同一 UX で動作
- 既存ユーザに「準 2 級も学べるようになりました」アナウンス

#### W16 受入基準
- 課金 OPEN 後 7 日で離脱率 < 10%
- β 5 家族に Goal Plan 相当無料配布完了
- KPI モニタリングで Stripe 収益が日次集計表示

#### W17 受入基準
- Writing 採点が rubric 7 項目で動作
- 個別カリキュラム生成が週 1 回自動実行
- 発音判定 PoC が 5 ユーザで動作確認

#### W18 受入基準
- 会話 AI コーチが Goal Plan ユーザに開放
- 面接 5 問 × 3 セッションで動作
- Moderation で不適切応答 0 件（10 ユーザ × 5 セッションのテストで）

#### W19 受入基準
- 紹介プログラムで 5 件以上の招待発生
- KPI ダッシュボード（保護者向け）が稼働
- 合格予測モデル v0 が全アクティブ学習者に予測値を表示

#### W20 受入基準
- 公開 LP が外部公開、Search Console 登録
- 全 Phase 3 機能が品質ゲート通過
- ハードリリース判定 GO（オーナー承認）

### 10.3 リソース配分

開発部門 + リサーチ部門 + デザイン部門の並列稼働で 60 人日を 8 週で消化。**1 週あたり平均 7.5 人日 = agent 並列を活用すれば 1 名で実工期 4-5 週圧縮可能**。

### 10.4 リスクと対応

| リスク | 確率 | 影響 | 対応 |
|-------|-----|------|------|
| 課金 OPEN 後コンバージョン率 < 3% | 中 | 大 | W19 で価格再調整、Standard 月額 ¥780 へ実験 |
| 準 2 級 LLM-as-Judge 精度劣化 | 中 | 中 | サンプリング率を 5% → 8% に上げる、Phase 3 内で対応 |
| 会話 AI コーチで不適切応答 | 低 | 大 | β 5 家族のみで 2 週運用、本格展開は Phase 4 送り |
| β 家族の離反 | 低 | 大 | 6 か月無料 + Founders 称号で予防 |
| Apple App Store 審査ブロッカー | – | – | Phase 3 では Native 化しないため該当なし |

---

## 11. 投資判断・KPI 目標

### 11.1 Phase 3 KPI 目標

| 指標 | Phase 2 末（β）| Phase 3 末（W20）|
|-----|----------------|-----------------|
| 登録家族 | 5（β）| 100 |
| アクティブ学習者 | 7（兄弟込）| 150 |
| Day-7 retention | 60% | 65%+ |
| Day-30 retention | 35% | 40%+ |
| 6 か月継続率 | 25%（推測）| 30%+ |
| 有料コンバージョン | 0% | **5-10%（10-15 家族）** |
| MRR | ¥0 | **¥40,000-80,000** |
| 累計売上 | ¥0 | **¥150,000-300,000** |
| AI 月額コスト/ユーザ | ¥10 | ¥50（追加機能込）|
| 粗利率 | – | **88%+** |

### 11.2 投資判断（CEO への提言）

#### 11.2.1 Phase 3 GO / NO-GO

**GO 条件**:
- Phase 2 W12 末で β 5 家族 NPS ≥ 30
- β 家族 5 名のうち少なくとも 4 名が「有料化したら使いたい」と回答
- Phase 2 末 Day-30 retention 30%+

**NO-GO 条件 → Phase 2.5 で UX 微調整**:
- NPS < 30
- Day-30 retention < 25%

#### 11.2.2 投資対効果

- 60 人日 × Phase 1 推定単価（自社開発のため実コスト 0、機会損失のみ）
- 6 か月後（Phase 3 末から）の MRR 目標 ¥40 万 → 年商 ¥480 万
- 1 年後（Phase 3 末から）の年商目標 ¥800-1,200 万
- 3 年後の年商目標 ¥1 億-1.8 億

**投資判断は明確に GO**。Phase 1/2 の累計 60 人日 + Phase 3 の 60 人日 = 120 人日で年商 ¥1 億規模の事業基盤構築は、個人開発 EdTech として極めて合理的。

### 11.3 Phase 4 への接続

Phase 3 末で以下が達成されていれば Phase 4 を即着手。

- 月商 ¥50 万到達
- 合格者事例 10 件
- 準 2 級コンテンツ完備

Phase 4 の主要テーマ候補:
1. Native アプリ化（Expo / iOS / Android）
2. 2 級拡張
3. B2B PoC（学習塾 1-2 校）
4. 会話 AI コーチ本格展開
5. ELSA Speak / Azure Pronunciation Assessment による精緻発音評価

---

## 12. 参考文献

### Duolingo / 課金モデル
- Duolingo Q2 2025 Shareholder Letter — https://investors.duolingo.com/static-files/0b55110c-2eb9-466d-8549-5459e0851290
- Duolingo Q2 2025 Earnings Preview（Substack）— https://swisstransparentportfolio.substack.com/p/duolingo-q2-2025-earnings-preview
- Monetization: 7 Lessons on How Duolingo Increased Premium Users by 176%（Medium）— https://medium.com/@nicobottaro/monetization-7-lessons-on-how-duolingo-increased-premium-users-by-176-from-3-to-8-8-42e8d63b58f2
- How Much Does Super Duolingo Cost In 2025?（DuolingoGuides）— https://duolingoguides.com/how-much-is-super-duolingo/
- Duolingo Family Plan — https://www.duolingo.com/family
- Duolingo（デュオリンゴ）の料金プランガイド（Notta）— https://www.notta.ai/blog/duolingo-pricing
- 【2026年最新】デュオリンゴ料金プラン徹底解説（スタシェア）— https://juku.168style.co.jp/media/2025-duolingo-fee-plan
- 【2025年最新】Duolingo Super と Max の料金まとめ（みにまるなひげ）— https://www.higeusen.com/entry/duolingo-super-max-fee
- Duolingo for Schools — https://schools.duolingo.com/
- What is Duolingo for Schools?（Zendesk）— https://duolingoschools.zendesk.com/hc/en-us/articles/6830454446093-What-is-Duolingo-for-Schools

### Khan Academy / Khanmigo
- Khan Academy Annual Report SY24-25 — https://annualreport.khanacademy.org/
- Khan Academy Statistics And Facts 2025（ElectroIQ）— https://electroiq.com/stats/khan-academy-statistics/
- How Khan Academy Makes Money（Finty）— https://finty.com/us/business-models/khan-academy/
- Meet Khanmigo — https://www.khanmigo.ai/
- Khanmigo for learners — https://www.khanmigo.ai/learners
- Khanmigo AI Product Review（Common Sense Media）— https://www.commonsensemedia.org/ai-ratings/khanmigo

### 競合分析（Lingokids / ABCmouse / Outschool / Risdom / スタディサプリ）
- Lingokids vs ABCmouse vs Khan Academy Kids（Screenwise）— https://screenwiseapp.com/guides/lingokids-vs-abcmouse-vs-khan-academy-kids-which-learning-app-is-best
- ABCmouse Price: Detailed Breakdown 2026（Brighterly）— https://brighterly.com/blog/abcmouse-pricing/
- Lingokids Review 2025 — https://research.com/software/lingokids-review
- Outschool Pricing: Your Complete Guide 2026（Brighterly）— https://brighterly.com/blog/outschool-pricing/
- Outschool Educator Library — https://teach.outschool.com/insights/pricing/
- 英検対策アプリおすすめランキング 2026（忍者英会話）— https://eikaiwa.weblio.jp/ninja-eikaiwa/eiken-app
- 【2025年】おすすめの英検アプリ 7 選（WidgetClub）— https://widget-club.com/ja/article/eiken-apps
- 英検対策アプリ人気おすすめ 11 選（English Factor）— https://englishfactor.jp/media/application/eiken-preparation/

### 日本市場 / EdTech 市場規模
- 矢野経済研究所 教育産業市場調査 2025（日経）— https://www.nikkei.com/article/DGXZRSP697748_X01C25A0000000/
- 教育産業市場に関する調査 2025（矢野経済研究所）— https://www.yano.co.jp/press/press.php/003935
- 教育産業全体の市場規模 2024 年 0.7% 増（リシード）— https://reseed.resemom.jp/article/2025/10/16/11908.html
- 日本の EdTech 市場は 2033 年までに 767 億ドル（NewsCast）— https://newscast.jp/news/8619627
- 矢野経済研究所 語学ビジネス市場 2025（日経）— https://www.nikkei.com/article/DGXZRSP697427_Q5A930C2000000/

### 課金モデル / Freemium
- Freemium Conversion Rate Benchmarks（daydream）— https://www.withdaydream.com/library/insights/freemium-conversion-rate
- State of Subscription Apps 2025（RevenueCat）— https://www.revenuecat.com/state-of-subscription-apps-2025/
- EdTech Pricing Models（Monetizely）— https://www.getmonetizely.com/articles/edtech-pricing-models-monetizing-education-technology-effectively
- Freemium Conversion Rate Benchmarks: 2-5% Industry Standards（Geneo）— https://geneo.app/query-reports/freemium-conversion-rate-benchmarks
- Apple violated U.S. court order, ending Apple's 27% commission（Frankfurt Kurnit）— https://technologylaw.fkks.com/post/102ka4o/apple-violated-u-s-court-order-ending-apples-27-commission-on-external-purcha
- Stripe shows iOS developers how to avoid Apple's App Store commission（TechCrunch）— https://techcrunch.com/2025/05/01/stripe-shows-ios-developers-how-to-avoid-apples-app-store-commission/
- App-to-web: navigating external purchases in iOS and Android apps（RevenueCat）— https://www.revenuecat.com/blog/engineering/app-to-web-purchase-guidelines/

### 英検関連
- 5 級の過去問・試験内容（英検協会）— https://www.eiken.or.jp/eiken/exam/grade_5/
- 準 2 級の過去問・試験内容（英検協会）— https://www.eiken.or.jp/eiken/exam/grade_p2/
- 英検 2 級のレベルと合格率（Catal）— https://catal.jp/eiken/blog/grade2-level-difficulty/
- 英検準 2 級と 2 級の差（Class-Live）— https://class-live.com/eiken22/
- 知的財産権の取扱いに関する統一ガイドライン（英検協会）— https://www.eiken.or.jp/trademark/
- サイトポリシー（英検協会）— https://www.eiken.or.jp/sitepolicy/
- 英検 3 級における小 4 以下合格者の割合（note）— https://note.com/honest_sorrel930/n/n8b439fb0ba2f
- 受験の状況（英検協会）— https://www.eiken.or.jp/eiken/about/situation/

### モバイル / PWA / Expo
- PWA on iOS - Current Status & Limitations 2025（Brainhub）— https://brainhub.eu/library/pwa-on-ios
- PWA iOS Limitations and Safari Support 2026（MagicBell）— https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- Using Next.js with Expo for Web — https://docs.expo.dev/guides/using-nextjs/
- React Native for Web in 2025: One Codebase, All Platforms（Medium）— https://medium.com/react-native-journal/react-native-for-web-in-2025-one-codebase-all-platforms-b985d8f7db28
- Turso Goes Mobile With Official iOS & Android SDKs — https://turso.tech/blog/turso-goes-mobile-with-official-ios-and-android-sdks
- PowerSync: Bringing Offline-First To Supabase — https://www.powersync.com/blog/bringing-offline-first-to-supabase

### App Store / Google Play / COPPA
- COPPA Compliance in 2025 (Promise Legal Blog) — https://blog.promise.legal/startup-central/coppa-compliance-in-2025-a-practical-guide-for-tech-edtech-and-kids-apps/
- App Store Age Ratings Guide for iOS and Android（Capgo）— https://capgo.app/blog/app-store-age-ratings-guide/
- Updated age ratings in App Store Connect（Apple Developer）— https://developer.apple.com/news/?id=ks775ehf
- Apple's App Store Kids Category（Tune）— https://www.tune.com/blog/apples-kids-category-brings-focus-coppa-regulation/
- 子ども向けアプリに関するポリシー（Amazon Developer）— https://developer.amazon.com/ja/docs/policy-center/privacy-children.html
- 個人情報保護法 3 年ごと見直し検討資料（個人情報保護委員会）— https://www.ppc.go.jp/files/pdf/240410_shiryou-1.pdf

### AI 深化（発音 / 会話 / Writing / カリキュラム生成）
- OpenAI API Pricing — https://openai.com/api/pricing/
- Introducing gpt-realtime and Realtime API updates（OpenAI）— https://openai.com/index/introducing-gpt-realtime/
- ELSA Speak Pricing 2026（SaaSworthy）— https://www.saasworthy.com/product/elsa-speak/pricing
- ELSA Speak 公式 — https://elsaspeak.com/en/
- Best AI Language Learning Apps in 2025（Kippy）— https://kippy.ai/blog/best-ai-language-learning-apps-comparison
- Fine-Tuning Whisper for Children's Speech Recognition（Springer 2024）— https://link.springer.com/chapter/10.1007/978-3-031-97825-8_91
- Adapting Whisper for Lightweight ASR of Children（arXiv 2024）— https://arxiv.org/html/2507.14451v1
- Leveraging Phonemic Transcription and Whisper（Interspeech 2024）— https://www.isca-archive.org/interspeech_2024/lin24k_interspeech.pdf
- One AI Tutor Per Child（Medium）— https://saigaddam.medium.com/one-ai-tutor-per-child-personalized-learning-is-finally-here-e3727d84a2d7
- AI Tutoring in Schools（Hunt Institute 2025）— https://hunt-institute.org/resources/2025/06/ai-tutoring-alpha-school-personalized-learning-technology-k-12-education/

### Moderation / 安全
- Designing Child-Centered Content Exposure and Moderation（arXiv 2024）— https://arxiv.org/html/2406.08420v1
- A Multimodal Framework for Automated Content Moderation of Children's Videos（UCF 2023）— https://stars.library.ucf.edu/etd2023/386/
- AI Tutors Can Work—With the Right Guardrails（Edutopia）— https://www.edutopia.org/article/ai-tutors-work-guardrails/
- 子供のプライバシーと同意管理（TrustNow）— https://www.trustnow.co.jp/blog/childrens-privacy/

### 紹介プログラム / Viral
- Referral vs Viral Growth: Conversion Rate Comparison（M Accelerator）— https://maccelerator.la/en/blog/entrepreneurship/referral-vs-viral-growth-conversion-rate-comparison/
- 教育アプリをプロモーションする方法（Repro Journal）— https://repro.io/contents/how-to-promote-education-apps/

---

**作成完了**: 2026-04-29 / リサーチ部門
**次のアクション**: CEO レビュー → オーナー判断 → Phase 2 末に再点検 → Phase 3 W13 着手
