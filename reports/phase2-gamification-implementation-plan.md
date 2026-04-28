# PRJ-016 HANEI Phase 2 ゲーミフィケーション実装計画書

**案件**: PRJ-016 HANEI（小学生向け英検 3 級半年合格 Web アプリ）
**作成部門**: CEO（リサーチ部門 + 開発部門 + CEO 観察の統合）
**作成日**: 2026-04-29
**情報源**:
- `reports/duolingo-gamification-research.md`（リサーチ部門 945 行レポート）
- `reports/hanei-gamification-inventory.md`（開発部門 現状棚卸し）
- CEO 直接観察: duolingo.com トップページの訴求 4 本柱
- CLAUDE.md（組織ルール / 絵文字禁止 / AI 感を出さない）
- design-guidelines.md / client-communication.md

---

## 1. Executive Summary

Duolingo の核心は **単一機能の天才性ではなく「Streak × League × XP × Notification の四位一体の相互強化ループ」**。Day-7 retention を 12% → 55% に持ち上げているのは、Streak 単独ではなく Notification（bandit AI 個別最適化）が日次トリガーを供給し、League が社会的競争を、XP が即時達成感を、Streak が長期 identity を提供する四位一体の構造である。

HANEI には **「白帽（内発動機）軸を中核」「黒帽（損失回避）軸を抑制」** の方針で取り入れる。理由：
1. 小学生は Erikson 第 4 段階「勤勉性 vs 劣等感」期 → **褒めで industry を育てる**必要、罰は劣等感を増幅
2. 保護者が第二の UX 主体 → **ガイルト型通知（sad-Duo）は封印**、保護者から見て安心できる設計が必須
3. HANEI は「半年で英検 3 級合格」という**終端ゴールを持つ** → Duolingo の無限ループ型ではなく**逆算カリキュラム × 達成可視化**が KPI

### 推奨 Phase 2 サブフェーズ構成（W8〜W12 / 5 週間）

| 週 | テーマ | 主要納品 | 投資工数 |
|---|--------|----------|----------|
| **W8** | 即効ファインチューン | Streak Freeze 自動付与 / Combo Visual / Confetti / Sound Feedback / 自己選択日次ゴール | 7 人日 |
| **W9** | キャラ伴走 + 達成可視化 | Kotodama-tori 5 段階育成 / Badges 8 種 / 桜の木メタファカウントダウン | 8 人日 |
| **W10** | 経済システム + 5 分セッション | Gems & Shop（閉じた経済）/ Daily Quest / 5-7 分自動セッション設計 | 8 人日 |
| **W11** | 保護者連動・家族化 | Family 内 Streak / 親→子応援メッセージ / Family Leaderboard / Daily Push | 7 人日 |
| **W12** | 計測 + β 検収 | A/B test 基盤 / KPI ダッシュボード / β 5 家族受入 | 5 人日 |
| **合計** | | | **35 人日 / 5 週** |

### 投資判断
- **追加コスト**: 開発工数のみ（agent 並列で実工期 2-3 週間圧縮可）
- **インフラ追加**: ほぼゼロ（既存 Turso / Vercel / Resend で完結）
- **AI 課金増**: Daily Quest / コーチ通知で gpt-5-mini 月 ~¥500-800 増（Phase 1 同水準）
- **期待効果**: Day-7 retention 30% → 60% / Day-30 retention 10% → 35% / 6 ヶ月継続率 5% → 25%

---

## 2. 既存資産マトリクス（活用度評価）

開発部門棚卸し結果ベースで、Phase 2 起点として「すでに動いている武器」を再評価：

### 2.1 即活用可能（W8 即着手）

| 既存資産 | 完成度 | Phase 2 での役割 |
|---------|--------|-----------------|
| **kotodama-tori（言霊鳥）+ mood システム** | 80% | **Duo に相当する伴走キャラ**。5 mood × 5 レベル × アクセサリー育成に拡張すれば差別化軸の最強候補 |
| **Streak（streaks テーブル + freezeTickets カラム）** | 85%（freeze 機能未実装） | freeze logic を 2 日で実装可能、DB 既設のため migration 不要 |
| **XP（xp_levels テーブル + getXpSummary）** | 70%（視覚化弱い） | DB 完備。日次ゴール（10/20/30/50 XP）は集計関数追加のみ |
| **Mock Exam + countdown-variant** | 80% | 受験日カウントダウンは HANEI 固有の最強ドライバー。「桜の木」メタファ追加で **Duolingo を超える「ゴール可視化」** が可能 |
| **Weekly Digest（aggregation pipeline）** | 75% | 全 aggregation 関数 modular。Daily Push / Family 通知への流用が即可能 |
| **FSRS SRS** | 90% | パーソナライズ学習の基盤として無傷で活用 |

### 2.2 部分実装で強化必要（W9-W10）

| 既存資産 | 現状 | 強化方針 |
|---------|------|---------|
| **Badges（DB スキーマのみ）** | criteriaJson 定義済 / unlock logic 未実装 | W9 で 8 種 unlock logic + UI 実装 |
| **キャラクター育成** | characters テーブル + level / accessoryIds 既設 | W9 で accessory unlock システム + level 進行 mechanism |
| **Combo / 連続正解** | computeRunningStreak（mood 遷移のみ）| W8 で visual burst + 点数倍率 + 効果音 |
| **即時フィードバック音** | UI のみ（CheckCircleIcon / XCircleIcon）| W8 で正解 / 不正解 / コンボ / Level Up の 4 種音追加 |

### 2.3 完全未実装（W10-W11 で構築）

- League / Leaderboard → **Family 内限定**で実装（COPPA 配慮、グローバル不可）
- Hearts / Energy → **採用しない**判断（罰要素が小学生不適）
- Gems / Virtual Currency / Shop → **閉じた経済**で実装（課金なし、純粋な内発報酬）
- Daily Quest → W10 で実装
- Narrative / Story → **W12+ 以降の Phase 3 検討**（Phase 2 では伴走キャラ強化に集中）

---

## 3. Phase 2 サブフェーズ詳細計画

### W8: 即効ファインチューン（7 人日）

**ねらい**: 1 セッションあたりの「楽しさ密度」を 2 倍にする。既存学習ループの即時性を磨く。

#### W8-T1: Streak Freeze 自動付与（P0 / 1 人日）
- Free 層: 月 2 枚自動補充、装備上限 2 枚
- 受験日 30 日前に追加 1 枚ボーナス（HANEI 固有の goal-aligned 演出）
- DB: `streaks.freezeTickets` カラム既存 → cron で月初付与のみ追加
- UI: 連続日数横に「保護シールド」アイコン（Heroicons `ShieldCheckIcon`）+ ツールチップ
- **理由**: Duolingo 公式 A/B で装備上限 1→2 で DAU +0.38%。子供は喪失体験で離脱しやすいため救済を厚く

#### W8-T2: Combo Visual + 点数倍率（P0 / 1.5 人日）
- 連続正解 3 / 5 / 10 で「コンボ XP 倍率 1.5x / 2x / 3x」発動
- visual: 画面右上に combo カウンター + 数字が踊る animation（`@keyframes combo-pulse`）
- kotodama-tori 既存 mood "celebrating" との連動（streak >= 3 で発動済の logic 拡張）
- **理由**: 即時フィードバックループの強化。「次の問題で繋がる」期待が retention の核

#### W8-T3: Sound Feedback 4 種（P0 / 1 人日）
- 正解 / 不正解 / コンボ達成 / レベルアップ の 4 種
- ファイルサイズ < 10KB / 各 0.3 秒以下（Web Audio API）
- ブラウザ自動再生ポリシー対応（最初のクリック後にコンテキスト初期化）
- **絵文字禁止 / AI 感を出さない**: 効果音は「鈴の音」「拍手」「上昇音階」など clean な楽器音、ピコピコ系は避ける
- ミュート設定を learner_profiles.preferences に追加（保護者が制御可）
- **理由**: 11 歳児眼球追跡研究で「Feedback テキストの 33% は気づかれず、39% は読まれない」（リサーチ報告）。視覚 + 音 + アニメ多層化が必須

#### W8-T4: Confetti / 達成 Burst（P1 / 1 人日）
- レッスン完了時 / バッジ獲得時 / 受験日カウントダウンの milestone 時に発動
- canvas-confetti ライブラリ採用（< 10KB gzip）
- prefers-reduced-motion 対応必須

#### W8-T5: 自己選択日次ゴール（P0 / 1.5 人日）
- onboarding に「1 日のがんばり目標」選択 UI 追加（10 / 20 / 30 / 50 XP の 4 段階）
- /home に「今日のゴール: 残り X XP」プログレスリング表示
- 達成時に kotodama-tori celebrating + confetti
- 学習者が自分で再設定可能（settings 画面）
- **理由**: SDT の Autonomy 充足。Duolingo 公式でも retention の主軸。「自分で選んだ目標」は「与えられた目標」より達成率が高い（Locke & Latham 1990）

#### W8-T6: Daily Goal Streak 表示の goal-aligned 化（P1 / 1 人日）
- 炎アイコン（Duolingo 流）→ **「桜の木が育つ」メタファに置換**
- 1-7 日: 種 → 芽 → 若葉 → 蕾、8-30 日: 開花、31-90 日: 満開、90 日 +: 桜並木
- HANEI のアイデンティティを構築する独自ビジュアル（後述 4 章で深掘り）

**W8 完了基準**:
- 既存 E2E 24/24 PASS 維持
- 新規 unit tests: combo / sound / streak-freeze で +20 程度
- 保護者から見て「うちの子が画面に夢中になっている」が観察される（社内 5 家族デモ）

---

### W9: キャラ伴走 + 達成可視化（8 人日）

**ねらい**: kotodama-tori を **HANEI のアイデンティティそのもの**に育てる。Duolingo の Duo を超える「日本の小学生が愛着を持つキャラ」を作る。

#### W9-T1: kotodama-tori 5 段階育成（P0 / 2 人日）
- DB: `characters.level` カラム既設 → 進行式定義
- レベル: 1（雛鳥）→ 2（若鳥）→ 3（成鳥）→ 4（賢鳥）→ 5（聖鳥）
- 進行条件: 累計 XP / 解いた問題数 / 連続日数の合算 score
- 視覚: 各レベルで kotodama-tori SVG が変化（羽の色 / 装飾 / 大きさ）
- マイクロコピー: 各レベルで kotodama-tori が話す励ましメッセージのバリエーション拡大（現 5 種 → 30 種）

#### W9-T2: Accessory システム（P1 / 1.5 人日）
- DB: `characters.accessoryIds` カラム既設
- アクセサリー 12 種: 帽子 / マフラー / 眼鏡 / リボン / ペンダントなど
- 解放条件: バッジ獲得 / 受験日 milestone / 月初プレゼント
- 装着 UI: profile / settings ページに「きせかえ」セクション
- **絵文字禁止**: アクセサリーアイコンは Heroicons または独自 SVG

#### W9-T3: Badges 8 種 unlock logic + UI（P0 / 2 人日）

| Badge | 解放条件 | レアリティ |
|-------|---------|-----------|
| はじめのいっぽ | 初回レッスン完了 | Common |
| 1 週間チャレンジャー | Streak 7 日 | Common |
| 1 ヶ月マスター | Streak 30 日 | Rare |
| 100 問突破 | 累計 100 問解答 | Common |
| 500 問の旅人 | 累計 500 問解答 | Rare |
| パーフェクトレッスン | 1 レッスン全問正解 | Rare |
| 模試デビュー | 模試 1 回完走 | Rare |
| 英検 3 級合格 | 模試 80 点以上 | Legendary |

- profile / /home の「これまでのバッジ」セクションに表示
- Locked 状態は silhouette + 解放条件ヒント（dark pattern にならない透明性）
- **設計原則**: criteriaJson に `{ "type": "streak", "threshold": 7 }` 形式で機械可読化、Phase 3 でのバッジ追加が容易

#### W9-T4: 受験日カウントダウン「桜の木」進化（P0 / 1.5 人日）
- W8-T6 の goal-aligned 化を完成形に
- countdown-variant 7 段階（far/month/week/final3/final1/today/after）に対応した SVG 7 枚
- 受験日が近づくと木が大きくなる視覚
- 「あと X 日でこの木に桜が咲く」マイクロコピーが kotodama-tori から発される
- **HANEI 固有の最強差別化軸**: Duolingo は「無限の道」を歩むが HANEI は「半年で桜咲く山頂」を目指す

#### W9-T5: Achievement モーダル + Share（P1 / 1 人日）
- バッジ / レベルアップ / 受験合格時に modal 表示
- 「保護者に伝える」ボタン → メール送信 / ダッシュボード通知（W11 で完成）
- スクリーンショット保存可（家族の Line / 印刷 → 冷蔵庫）

**W9 完了基準**:
- kotodama-tori が話すマイクロコピー 30 種以上
- 8 バッジ全て unlock 可能テスト済（fixture で動作確認）
- 桜の木 SVG 7 枚 polish 済（design レビュー通過）

---

### W10: 経済システム + 5 分セッション最適化（8 人日）

**ねらい**: 「短い時間で達成感」を構造化する。Duolingo の 5-7 分セッション哲学 × HANEI の英検カリキュラムをハイブリッド。

#### W10-T1: 閉じた経済システム「ハネキン（はね金）」（P0 / 2 人日）
- **絶対に課金システム化しない**（CLAUDE.md 「料金システム = Phase 1/2 ともに未実装、無料運用前提」DEC-012 遵守）
- 仮想通貨「ハネキン（はね金）」を gems と区別する独自命名
- 獲得経路: レッスン完了 / Streak milestone / Badge unlock / Daily Quest 完了
- 使い道: アクセサリー購入 / Streak Freeze 追加購入 / kotodama-tori エサ（mood ブースト）
- DB: `learner_profiles.coinBalance` + `coin_transactions` テーブル新設
- **理由**: Octalysis CD3 Empowerment（自分の選択で何かを変えられる）の充足

#### W10-T2: Shop UI（P0 / 1.5 人日）
- /shop ページ新設
- カテゴリ: アクセサリー / Streak アイテム / kotodama-tori エサ
- 価格は 30-200 ハネキン範囲（1 日のがんばりで小物 1 つ買える設計）
- 「カートに入れる」「購入確認」フローは省略（即購入 + 復元可能）

#### W10-T3: Daily Quest（P0 / 2 人日）
- 1 日 3 問のミニチャレンジを毎朝 6:00 JST に生成
- 例: 「今日は vocab を 5 問解こう」「listening パーフェクトを 1 回」「kotodama-tori と 1 レベル上がろう」
- 完了でハネキン 10-30 + XP ボーナス
- `daily_quests` テーブル新設（learner_id / quest_type / target / progress / reward / created_at）
- 生成ロジックは決定的（learner の弱点 + 進捗ベース）、AI 不要 → ランニングコスト 0
- **理由**: 「今日やる事が明確」が小学生の集中時間（12-36 分）にフィット

#### W10-T4: 5-7 分セッション自動設計（P0 / 1.5 人日）
- 学習開始時に「今から 5 分」「今から 7 分」「今から 10 分」を選べる
- 選択時間内で最適な問題セット（既習 review + 新規 + 弱点）を自動構成
- 5 分 = 5-8 問、7 分 = 8-12 問、10 分 = 12-18 問の推定
- セッション終了時に「がんばったね！」kotodama-tori celebration
- **理由**: Pacer > Binge user は retention 高い（Duolingo 公式）。binge user の離脱率高い問題を構造的に防ぐ

#### W10-T5: 過学習防止「もう少しで終わるよ」UX（P1 / 1 人日）
- 30 分連続学習で「もう一息で 30 分。今日はここで休憩しよう」 modal 提示
- 60 分で強制終了 + Streak は守られる
- 保護者ダッシュボードに「今日 X 分学習」を可視化
- **設計原則**: 過学習は子供の集中力を破壊する。Duolingo は無限ループだが HANEI は質を取る

**W10 完了基準**:
- ハネキン経済が閉じている（外部課金導線一切なし）
- Daily Quest が毎朝自動生成される（cron + 単体 reproduceable）
- 5/7/10 分セッションそれぞれの問題セット品質が CEO 信頼検証で OK

---

### W11: 保護者連動・家族化（7 人日）

**ねらい**: 「親子で続ける」を構造化する。HANEI 独自の最大差別化軸。Duolingo Family Plan を超える「日本の家族にフィットする」設計。

#### W11-T1: Family 内 Streak（P0 / 1.5 人日）
- 同一 family の learner 全員が共通の Family Streak を持つ
- 1 人でも当日学習すれば家族 Streak 維持（兄弟がいる家庭の救済）
- 親が learner_profile を持つ場合は親も学習に参加可能（任意）
- DB: `families.familyStreakDays` + `families.lastFamilyActiveDate` カラム新設
- **理由**: Duolingo Friend Streak は日次完了率 +22%。家族版は文化的にフィット

#### W11-T2: 親→子の応援メッセージ（P0 / 2 人日）
- 親ダッシュボードに「kotodama-tori にメッセージを送る」機能
- 例: 「今日もよく頑張ったね」「明日も応援してるよ」
- 子供が次回ログイン時に kotodama-tori が代読する modal を表示
- メッセージは事前定型 + 自由記述（自由記述は moderation 通過必須）
- DB: `family_messages` テーブル新設
- **絵文字禁止 / AI 感を出さない**: 定型は「お疲れさま」「ファイト」「うれしいね」などの自然な日本語

#### W11-T3: Family Leaderboard（P1 / 1.5 人日）
- 同一 family 内のみ可視（COPPA 準拠 / グローバル不可）
- 週間 XP ランキング表示
- 「兄が 1 位 / 妹が 2 位 / お母さんが 3 位」のような家族内健全競争
- ランキング差を協調的に演出（罰メッセージ完全封印）

#### W11-T4: Daily Push 通知（P0 / 1.5 人日）
- Web Push（PWA / push-api）で親 → 子 / システム → 親の 2 系統
- システム → 親: 「○○さんが 5 日連続学習中です」「今日まだ学習していません」（後者は ToD: 19:00 のみ、push でなく email 主軸）
- 親 → 子: 親ダッシュボードから「励ましプッシュ」を送れる（1 日 3 通まで）
- **絶対禁止**: ガイルト型（「Duo が悲しんでいます」相当）の通知。自前文言で「無理せず、できる時にやろうね」など健全な temperature
- 通知 opt-in は明示的に親が設定（一括 OFF は当然可能）

#### W11-T5: Weekly Digest 強化（P1 / 0.5 人日）
- 既存 Weekly Digest（W6 F-1）に W9-T3 のバッジ獲得サマリ + W10-T3 Daily Quest 完了率を追加
- HTML テンプレートを再 polish（モバイルメール表示最適化）

**W11 完了基準**:
- Family Streak が 5 家族デモで自然に動く
- 親→子メッセージが kotodama-tori で代読される
- COPPA 配慮レビュー通過（外部 leaderboard 一切なし）

---

### W12: 計測 + β 検収（5 人日）

**ねらい**: Phase 2 の効果を測定可能にし、β 公開準備を完成させる。

#### W12-T1: KPI ダッシュボード（CEO 専用）（P0 / 1.5 人日）
- /admin/kpi ページ新設（CEO のみ閲覧可、role=ceo or admin）
- 計測指標:
  - Day-1 / Day-7 / Day-30 retention
  - 平均セッション時間
  - Streak 中央値 / Streak Freeze 使用率
  - Daily Quest 完了率
  - バッジ獲得分布
  - 模試結果分布（4/5/3 級）
  - kotodama-tori メッセージ表示数
  - 親→子メッセージ送信頻度

#### W12-T2: A/B test 基盤（P0 / 1.5 人日）
- 簡易 feature flag システム（`learner_profiles.experiments` JSON カラム）
- 50/50 でランダム割当 → cohort 別 KPI 比較
- 初回テスト候補:
  - Streak Freeze 自動付与: 月 1 枚 vs 2 枚
  - Daily Quest 報酬: ハネキン 10 vs 30
  - kotodama-tori レベル進行速度: 通常 vs 加速

#### W12-T3: β ユーザー受入準備（P0 / 1.5 人日）
- 5 家族（小学生 3-6 年生）への β 招待 LP
- 同意書（保護者 + 子供）テンプレ
- フィードバックフォーム（Google Form 連携 / GAS で集計）
- onboarding チュートリアル動画（kotodama-tori が説明、最大 90 秒）

#### W12-T4: ストレステスト + Sentry 強化（P1 / 0.5 人日）
- Family Streak / Daily Quest / Push 通知で発生する DB 同時アクセスのテスト
- Sentry エラー閾値を Phase 2 想定負荷に再調整

**W12 完了基準**:
- KPI ダッシュボードが Real-time で動く
- A/B test 1 件が cohort 割当 → 集計まで通る
- 5 家族の β invitation が送信可能な状態

---

## 4. HANEI 独自差別化軸（Duolingo を超える 5 点）

### 4.1 「桜咲く山頂」型ゴール可視化
- Duolingo: 無限の道（ゴールなし）
- HANEI: 半年で英検 3 級合格 = 桜の木が満開になる山頂
- 受験日カウントダウンが kotodama-tori と桜の木で常時可視化
- **訴求**: 「なんとなく続ける」ではなく「明確なゴールに向かって登る」

### 4.2 親子二者 UX
- Duolingo: 単独学習者中心（Family Plan は subscription bundle）
- HANEI: 親子の二者がそれぞれ役割を持つ
  - 親: 励ます / 進捗を見守る / メッセージ送る / 同意する
  - 子: 学ぶ / 達成する / 感謝を伝える
- **訴求**: 「家族で続ける英語学習」「親が罪悪感なく見守れる」

### 4.3 AI コーチ誤答解説
- Duolingo: シンプルな正解表示
- HANEI: gpt-5-mini による「なぜ間違えたか」「次回どう考えるか」を個別生成（既存実装済 / B-9 で 822/822 完備）
- **訴求**: 「家庭教師代わり」「親が教えなくても子が理解できる」

### 4.4 罰なき設計
- Duolingo: Hearts / Sad-Duo / Streak Loss = 罰要素強い（Octalysis 黒帽過多）
- HANEI: 救済機構厚く / Sad キャラ封印 / 自動 Streak Freeze
- **訴求**: 「子供が嫌いになりにくい」「保護者が安心して任せられる」

### 4.5 日本語ネイティブ UX
- Duolingo: 翻訳ベースの日本語、ぎこちない箇所あり
- HANEI: 日本の小学生・保護者にフィットした日本語マイクロコピー（kotodama-tori が方言混じりの優しい言葉）
- **訴求**: 「日本の家庭に馴染む」

---

## 5. 重要 KPI 設計

### 5.1 北極星指標（North Star Metric）
- **Day-30 retention × 1 セッション平均 XP** = 「30 日後も学習している学習者の月間 XP 総和」
- 目標: Phase 2 終了時に Day-30 retention 35% × 平均 100 XP/日 = 1050 XP/月/learner

### 5.2 サブ KPI
| カテゴリ | 指標 | Phase 1 末 | Phase 2 目標 |
|---------|------|-----------|-------------|
| Retention | Day-7 | 30% | 60% |
| Retention | Day-30 | 10% | 35% |
| Engagement | 1 日平均セッション数 | 0.8 | 1.5 |
| Engagement | 1 セッション平均時間 | 4 分 | 6 分 |
| Streak | 中央値 Streak | 3 日 | 14 日 |
| Streak | 100 日 Streak 達成率 | 0% | 5% |
| Achievement | 1 ヶ月後 Badge 獲得数 | 0 | 4 |
| 商品 | 6 ヶ月継続率 | 5% | 25% |
| 学習効果 | 模試スコア改善 | 計測なし | 月 +5 点 |

### 5.3 計測手段
- W12-T1 KPI ダッシュボードで一元管理
- 週次サマリ自動メール（CEO 宛）
- A/B test 単位での cohort 比較

---

## 6. リスク・倫理配慮

### 6.1 COPPA / 個人情報保護
- グローバル leaderboard / 友達検索は **絶対に実装しない**
- Family 内に閉じた leaderboard / streak のみ
- 13 歳未満は保護者同意フロー（既存 K-3 実装済）必須
- 自由記述の親→子メッセージは moderation 三層通過

### 6.2 ガイルト型 UX の封印
- **Sad-Duo 相当の通知絶対禁止**
- 「あなたが学習していないと kotodama-tori が悲しんでいます」相当の表現は採用しない
- 不在時の通知は「無理せず、できる時にやろうね」「明日また会えるのを楽しみにしてるよ」など健全な温度

### 6.3 過学習防止
- 30 分以上連続学習で休憩促進 modal
- 60 分で強制終了（Streak は維持）
- 保護者ダッシュボードに学習時間可視化

### 6.4 課金導線の不在
- DEC-012 遵守（Phase 1/2 完全無料運用）
- ハネキン経済は閉じた循環、外部課金なし
- shop はアクセサリー / Streak Freeze / kotodama-tori エサのみ、有料化は Phase 3+ 議論

### 6.5 過剰なゲーミフィケーションの自己抑制
- 「ゲーム」ではなく「学習補助としてのゲーム要素」を貫く
- 学習離脱を促進するゲーム要素（Hearts による強制終了など）は採用しない
- 訴求コピーは「楽しく英検合格」、「ゲームのように」ではない

---

## 7. オーナー判断要請

### 7.1 全体 GO / NG
**Phase 2（W8-W12 / 35 人日 / 5 週間）の上記計画で進めて良いか？**

### 7.2 サブフェーズ優先度
- 推奨: W8 → W9 → W10 → W11 → W12 の順次着手
- 並列圧縮可能: W8-T1 (Streak Freeze) + W9-T3 (Badges) は独立に並列着手可
- 全体を 3 週間に圧縮することも技術的には可能（agent 並列フル稼働）

### 7.3 投資判断ポイント
- **インフラ追加コスト ~ ¥0**（既存 Turso / Vercel / Resend）
- **AI 月額コスト + ¥500-800**（Daily Quest / Push 通知の AI 個別化、ただし決定的ロジックで AI 不要設計が可能）
- **β 検収 5 家族の協力依頼**（W12 末）

### 7.4 個別判断要請

#### A. 「桜の木」メタファ採用
Duolingo 流の炎アイコンを使わず、「桜の木が育つ」HANEI 独自メタファに置換する。日本文化フィット + 受験日 milestone との連動 + 差別化として推奨。

#### B. 「ハネキン」（はね金）命名
仮想通貨を「Gems」ではなく「ハネキン」と日本語独自命名。HANEI のアイデンティティ化に貢献。

#### C. Family Leaderboard 採用範囲
W11-T3 の Family Leaderboard は P1（差別化）。導入時、家庭内競争を誘発しうる懸念あり。家族設定で ON/OFF 可能化を推奨。

#### D. β 検収 5 家族の選定
W12-T3 で β 招待する 5 家族をどう選ぶか。社内コネ / 既存案件オーナーの紹介 / 公募の 3 案。

#### E. Phase 3 の方向性
本計画書は Phase 2 のみカバー。Phase 3（β 後の改善 + 課金開始 + Phase 1 で見送った機能）の方向性も同時に決定するか、Phase 2 完了後に再策定するか。

---

## 8. 添付資料・参照

- `reports/duolingo-gamification-research.md`（リサーチ部門 945 行レポート、Top 5 抽出 / SDT 適用 / Octalysis 8 軸 / 競合比較）
- `reports/hanei-gamification-inventory.md`（開発部門 現状棚卸し、既存 13 / 弱い 4 / 未実装 7）
- `decisions.md`（DEC-012 = 完全無料運用 / DEC-039〜043 = W6-W7 完遂履歴）
- `organization/rules/design-guidelines.md`（絵文字禁止 / Heroicons 推奨 / AI 感を出さない）
- `organization/rules/client-communication.md`（コミュニケーションスタイル）

---

**結論**: HANEI Phase 2 は「Duolingo を真似る」のではなく「Duolingo の白帽軸を学び、子供 + 家族 + 英検合格にフィットさせて超える」設計を推奨します。35 人日 5 週間の投資で、Day-30 retention 10%→35% / 6 ヶ月継続率 5%→25% を狙えます。

オーナーのご判断をお待ちします。
