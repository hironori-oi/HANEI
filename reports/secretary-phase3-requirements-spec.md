# 秘書部門 Phase 3 受入条件 spec — PRJ-016 HANEI 本格運用準備（息子実使用前提 / 7 要望統合）

- 案件: PRJ-016 HANEI（小学生向け英検 3 級学習 PWA）
- 対象フェーズ: Phase 3（本格運用準備 / β1 名運用 → 1 ヶ月運用 → 拡大）
- 関連 atomic: DEC-073 軸-2 secretary 担当
- 起点 DEC: DEC-073（Phase 3 計画立案 atomic）
- 継承 DEC: DEC-006 / DEC-024 / DEC-019-033 / DEC-061 / DEC-062 / DEC-063 / DEC-066〜072
- 報告日: 2026-05-05
- 担当: secretary（受入条件 spec 起草）/ CEO 委任ベース

---

## 0. 本文書の役割

オーナー 7 要望を Phase 3 atomic 分解前段階で「受入条件 + 優先順位 + 依存関係」に翻訳する。dev `dev-phase3-feasibility-and-estimation.md`（technical scope / 工数）+ research `research-phase3-runtime-readiness-investigation.md`（外部 API / 運用必須項目）と並列起草され、CEO 統合 `ceo-phase3-runtime-readiness-wbs.md` で 1 つの WBS に集約。**What に限定 / How は dev に委ねる**。

---

## 1. 7 要望の受入条件 spec（ユーザーストーリー型）

### F-1. 受験日登録 + 残日数表示

#### ユーザーストーリー
- 学習者として、英検受験予定日を登録して残日数を見たい。なぜなら本番までの距離が見えると毎日の学習に意味付けができるから。
- 親として、受験日をいつでも確認・修正したい。なぜなら家族で受験を支えるためにスケジュール把握が前提となるから。
- 親として、子の home と保護者 dashboard で同じカウントダウンを見たい。なぜなら親子で同じ目標を見ることが継続動機になるから。

#### 受入条件（Acceptance Criteria）
- [ ] AC-1: Given 親が settings 画面を開いている / When 受験日（YYYY-MM-DD）を入力して保存する / Then 当該 family に対し受験日が永続化される
- [ ] AC-2: Given 受験日が保存されている / When 学習者が home を開く / Then 「英検3級まであと N 日」が表示される（N >= 0）
- [ ] AC-3: Given 受験日が保存されている / When 親が保護者 dashboard を開く / Then 同一の N 日表示が学習者画面と一致する
- [ ] AC-4: Given 親が受験日入力中 / When 過去日（today より前）を入力する / Then 保存前に注意表示で確認を促し、保存可能だが home 表示は「受験日が過去になっています。次の受験日を設定してください」に切替わる
- [ ] AC-5: Given 受験日が未設定 / When 学習者が home を開く / Then 「受験日を設定する」CTA が親可視で表示され、学習者画面では穏やかな案内のみ
- [ ] AC-6: Given 受験日が今日 / When home を開く / Then 「いよいよ今日です」相当の中立コピーで表示される（罰語ゼロ / 命令形回避）
- [ ] AC-7: Given 受験日変更が発生 / When 親が新しい受験日を保存 / Then 変更履歴が DB に最低 1 世代保存される（任意 / Could）

#### Out of Scope / 既存基盤 / DEC
- Out: 受験会場 / 受験番号管理、受験申込フロー、模試日程自動生成（mock-exam 改修は別 atomic）
- 既存: `src/lib/actions/exam-date.ts` / `exam-date-dialog.tsx` / `exam-date-validation.ts` / W4 exam-date-modal 成果物
- DEC: 既存 mutation 拡張で +0 が望ましい（DEC-006）

---

### F-2. アカウント設定・変更

#### ユーザーストーリー
- 親として、表示名 / 学年 / 親 email / 通知設定をいつでも変更したい。なぜなら成長や生活変化に応じて更新する必要があるから。
- 親として、退会・データ削除を自分で実行したい。なぜなら個人情報の取扱いに対する責任を果たすため。
- 学習者として、アバターや表示名は自分でも変えたい。なぜなら自分のアカウントという感覚が継続動機になるから。

#### 受入条件（Acceptance Criteria）
- [ ] AC-1: Given 親が認証済 / When `/settings` を開く / Then 表示名 / 学年 / アバター / 親 email / 通知 ON-OFF / パスワード変更 / 退会経路の項目が一覧表示される
- [ ] AC-2: Given 親が表示名を変更しようとする / When 保存ボタンを押す / Then 親パスワード再確認 dialog が出て、確認成功後にのみ保存される
- [ ] AC-3: Given 親が学年を変更する / When 保存する / Then 既存の `learner_profiles.grade` 相当の値が更新され、適応学習エンジン側で参照される（参照経路の存在のみ要件 / 再診断は別途）
- [ ] AC-4: Given 親が親 email を変更する / When 保存する / Then 確認メールが新 email に送信され、確認リンク click 後に切替わる（Should / Phase 3 後段で許容）
- [ ] AC-5: Given 親が通知 ON-OFF を切替える / When 保存する / Then push / email 通知の宛先・送信可否が即時反映される
- [ ] AC-6: Given 親がパスワードを変更する / When 旧パスワード + 新パスワード（2 回）を入力 / Then 認証基盤（Supabase Auth）経由で更新され、他端末セッションは継続可（Phase 3 では強制 logout 不要）
- [ ] AC-7: Given 親が退会経路を開く / When 退会理由を任意で入力し最終確認 dialog で yes を選ぶ / Then `learner_profiles` / `families` / `answer_logs` 等の個人特定可能データが論理削除（または匿名化）され、復旧は手動申請のみ
- [ ] AC-8: Given 学習者がログイン中 / When 学習者向け settings（簡易版）を開く / Then アバター変更のみ可能で、それ以外は「親に頼んでね」表示
- [ ] AC-9: Given 全 settings 操作後 / Then DEC-024 罰語ゼロ（不具合 / 失敗 / 無効 / 不正 / だめ等）grep 0 件

#### Out of Scope / 既存基盤 / DEC
- Out: MFA、親アカウントの複数化（共同親）、ソーシャルログイン拡張
- 既存: `src/app/(app)/settings/accessories/page.tsx` のみ = settings トップ route 新設が前提 / Supabase Auth 既存
- DEC: DEC-024（コピー全件審査）/ DEC-001（親パスワード再確認は三層認可補強）/ DEC-019-033（PII / 退会 redaction）/ DEC-006 mutation +1〜+2 想定 = 代替案 dev 検討必須

---

### F-3. 長期目標 / 短期目標の設定

#### ユーザーストーリー
- 親として、長期目標（例: 6 ヶ月後の英検 3 級合格）と短期目標（今週 / 今日）を階層構造で設定したい。なぜなら大きな目標は階段化しないと子が手応えを得にくいから。
- 学習者として、当日 / 今週 / 月次 / 受験本番までの到達点を可視化したい。なぜなら自分の進捗が見えると継続できるから。
- 親として、達成 / 未達を「結果」として淡々と記録したい。なぜなら次の調整材料にするため（叱責経路は構造的に不在）。

#### 受入条件（Acceptance Criteria）
- [ ] AC-1: Given 親が設定画面を開いている / When 長期目標（合格目標日 + 任意自由文 50 文字以内）を入力する / Then 1 family につき 1 件の長期目標が永続化される
- [ ] AC-2: Given 長期目標が設定済 / When 親が短期目標（月次 / 週次 / 当日）を設定する / Then それぞれ独立に保存され、階層関係（当日 < 週次 < 月次 < 長期）が UI で表示される
- [ ] AC-3: Given 短期目標に「今週 X 問解く」が設定済 / When 学習者が home を開く / Then 当週の達成率が進捗 bar で表示される
- [ ] AC-4: Given 短期目標が達成済 / When 学習者が home を開く / Then 中立的な「達成」表示が出る（罰語ゼロ / 過剰演出回避）
- [ ] AC-5: Given 短期目標が未達成のまま期間終了 / When 翌期間に入る / Then 中立コピーで「次は X 問を目指す」リコメンドのみ表示し、罰語 / 叱責コピーは構造的に発生しない（DEC-024 / DEC-061 連動）
- [ ] AC-6: Given 親が目標を編集する / When 保存する / Then 履歴は最低当該期間 1 世代を保持する
- [ ] AC-7: Given 学習者向け UI / When 学習者が目標設定画面を開こうとする / Then 「親に頼んでね」表示で、学習者は閲覧のみ可能（Must）/ 学習者編集は Could 扱い

#### Out of Scope / 既存基盤 / DEC
- Out: AI 目標自動推奨（Phase 4 候補）、親子チャット相談、友達との目標共有
- 既存: streak / leaderboard / weekly-digest 基盤連動表示 / 新規テーブル `family_goals` 想定
- DEC: DEC-061 / DEC-063 と同設計思想（罰語の出口を構造的に持たない）/ DEC-006 mutation +1 想定

---

### F-4. 目標学習時間の入力 + 進捗 / リマインド

#### ユーザーストーリー
- 親として、1 日 / 1 週間の目標学習時間を分単位で設定したい。なぜなら時間で可視化することが習慣化に有効だから。
- 学習者として、今日あと何分やれば達成か home で見たい。なぜなら残り時間が見えるとあと一押しできるから。
- 親として、未到達のまま 1 日が終わりそうな時にリマインドを受けたい。なぜなら声かけ trigger が必要だから。

#### 受入条件（Acceptance Criteria）
- [ ] AC-1: Given 親が settings を開いている / When 1 日目標（5〜120 分）と 1 週間目標（30〜840 分）を保存 / Then 当該 family に永続化される
- [ ] AC-2: Given 目標時間が設定済 / When 学習者が home を開く / Then 当日進捗 bar（達成 X 分 / 目標 Y 分）が表示される
- [ ] AC-3: Given 学習中 / When 学習者が問題を解いている / Then 学習時間が「active time」（操作 30 秒無で計測停止 / 既存基盤に揃える）でカウントされる
- [ ] AC-4: Given 学習時間 ≧ 1 日目標 / When 達成 / Then 中立コピーで達成表示（DEC-024 / DEC-063 連動）
- [ ] AC-5: Given 当日まだ目標未達 / When 親が事前設定した時刻（例: 19:00 / 20:00）の前 30 分 / Then push or email リマインドが親宛に送信される（push は VAPID 鍵設定後 / 移行段階で email でも代替可）
- [ ] AC-6: Given 親が dashboard を開く / When 当週 / 当月の累積学習時間と目標達成日数が表示される
- [ ] AC-7: Given active time の計測仕様 / Then 仕様（active vs elapsed / 無操作判定閾値）が `docs/study-time-spec.md` 相当に明文化される
- [ ] AC-8: Given 連続未達期間が長期化 / When 1 週間連続で 0 分の場合 / Then 親 dashboard に「学習が止まっています。声かけのタイミングです」表示（中立 / DEC-024 厳守）

#### Out of Scope / 既存基盤 / DEC
- Out: 学習時間ランキング、自動最適化（Phase 4 候補）、端末ロック / OS レベル時間制限連動
- 既存: `study-time.ts` 純関数（W10-T5 / PAT-002 起源）/ study_session スキーマ / W11-T4 Daily Push（VAPID 鍵保留中）
- DEC: DEC-067 monthly cron 連動可能性 / DEC-006 mutation +0〜+1（既存 study_session 拡張で吸収可能性大）

---

### F-5. 単語の意味 / 発音調査（辞書 popup + TTS）

#### ユーザーストーリー
- 学習者として、問題文中の未知単語を tap で意味を見たい。なぜなら学習中に意味調査で離脱したくないから。
- 学習者として、単語の発音を聞きたい。なぜなら英検3級ではリスニング配点が大きく視覚と聴覚を結びつける必要があるから。
- 親として、よく調べた単語傾向を把握したい（Could）。なぜなら弱点語彙の家庭声かけに活用するため。

#### 受入条件（Acceptance Criteria）
- [ ] AC-1: Given 学習者が問題画面で単語をタップ / When 該当単語が dictionary lookup 対象 / Then popup で「意味（日本語）/ 品詞 / 例文 1 つ」が表示される
- [ ] AC-2: Given popup が表示中 / When 発音ボタンをタップ / Then 当該単語の音声が再生される（Web Speech API でも fallback 可 / research 部門 TTS 選定結果に従う）
- [ ] AC-3: Given popup の同一単語の連続 lookup / When 1 セッション内に 2 度目以降 / Then cache から返り API 呼出は発生しない
- [ ] AC-4: Given 単語が辞書 hit しない（固有名詞 / 文法素 / 子供向け辞書外） / When tap / Then 中立コピーで「この単語は辞書に載っていません」表示
- [ ] AC-5: Given 学習者が問題を解答中 / When 辞書 popup を開く / Then 解答ボタンへの遷移 UX を阻害しない（popup 外 tap で閉じる / 次問遷移で popup 自動 close）
- [ ] AC-6: Given 親が dashboard を開く / When「最近よく調べた単語 top 10」が表示される（Could） / Then 当該 family scope のみで集計される（COPPA 準拠）
- [ ] AC-7: Given DEC-024 厳守 / When 辞書 / 例文に罰語が含まれそうなケース / Then catalog 採用時は pre-curated / 外部 API 採用時は児童向け辞書を優先選定（research 部門指針に従う）

#### Out of Scope / 既存基盤 / DEC
- Out: 自前辞書 DB 構築、同義語 / 語源データ、学習者カスタム単語帳
- 既存: なし = 新規実装 / 辞書 API 選定は research 結果に従う / TTS は Web Speech API 代替可
- DEC: DEC-006 GET +1〜+2 想定（API key 露出回避のため server proxy が必要 = 直叩き不可の可能性大）

---

### F-6. AI チャット質問（解説後の追加質問）

#### ユーザーストーリー
- 学習者として、解説でわからない時に「もっと聞く」で AI に追加質問したい。なぜなら 1 度の解説では理解しきれないこともあるから。
- 親として、利用回数 / コストが想定範囲に収まることを把握したい。なぜなら無料運用継続が重要だから（DEC-066 継承）。
- 親として、学習文脈外の質問が構造的に拒否されることを保証したい。なぜなら子供向けサービスとして安全性が前提だから。

#### 受入条件（Acceptance Criteria）
- [ ] AC-1: Given 学習者が解説画面を見ている / When 「もっと聞く」ボタンを押す / Then 当該問題の文脈（問題文 / 選択肢 / 子の解答 / 正解 / 既存解説）を自動で context に注入した chat 画面が開く
- [ ] AC-2: Given chat 画面が開いている / When 学習者が自由文を入力して送信 / Then 1 ターン目の応答が streaming 表示される
- [ ] AC-3: Given 1 ターン目応答後 / When 学習者が追加質問する / Then マルチターン継続が可能（最大 N 往復 / N は research / dev 推奨値で確定 = Phase 3 では 5 往復目安）
- [ ] AC-4: Given 学習者が学習文脈外の質問をする / When 送信 / Then 「学習以外のことは答えられません。問題に戻りましょう」相当の中立返答で safe completion される（DEC-024 厳守）
- [ ] AC-5: Given 月次利用回数が事前設定上限に達する / When 学習者が次の質問を送信 / Then 「今月の質問回数の上限に達しました。来月またね」相当で構造的に拒否される
- [ ] AC-6: Given chat 履歴 / When 親が dashboard を開く / Then 「今月の chat 利用回数」「直近 chat の要約」が見える（履歴全文閲覧は Could / Phase 3 では回数 + 要約のみで可）
- [ ] AC-7: Given 子が個人情報（名前 / 住所 / 電話番号）を入力 / When 送信 / Then redaction or 中立返答で個人情報は LLM 経由でも保存されない（PII 保護 / DEC-019-033 連動）
- [ ] AC-8: Given chat 終了 / When 学習者が問題画面に戻る / Then 解答 / 次問遷移経路が阻害されていない

#### Out of Scope / 既存基盤 / DEC
- Out: 親 AI チャット（Phase 4 候補）、親子間チャット、音声入出力
- 既存: OpenAI 接続（PIT-006 既存 / writing 採点経路）流用 / 新規テーブル `chat_messages` 想定
- DEC: DEC-006 mutation +1 / GET +1 想定 = dev 代替案検討（既存 endpoint 寄せ）/ safe completion + prompt injection 対策 research 推奨準拠

---

### F-7. リスニング・ライティングの実施可能化

#### ユーザーストーリー
- 学習者として、リスニング問題で実際の英文音源を聞いて解答したい。なぜなら英検3級では配点の約 1/3 を占めるから。
- 学習者として、書いた英作文への採点 / フィードバックを受けたい。なぜなら writing が伝わるかを確認しないと改善できないから。
- 親として、リスニング / ライティング得点推移を dashboard で見たい。なぜなら 4 技能バランス把握が前提だから。

#### 受入条件（Acceptance Criteria）
- [ ] AC-1: Given 既存 listening skill 経路 / When 学習者がリスニング問題を開く / Then 最低 1 セット（10〜20 問規模）の音源付き問題が再生可能な状態で seed 投入されている
- [ ] AC-2: Given リスニング問題画面 / When 再生ボタンをタップ / Then 音源（mp3 等）が cache 経由で再生され、2 度目以降は再 fetch しない
- [ ] AC-3: Given リスニング問題画面 / When 学習者が再生をやり直したい / Then 1 問あたり最大 3 回まで再生可能（英検実試験準拠）
- [ ] AC-4: Given 既存 writing skill 経路 / When 学習者がライティング問題に解答 / Then 入力 → 採点 → フィードバックの一連 UX が最後まで完走可能（既存 `score-writing.ts` 流用）
- [ ] AC-5: Given ライティング採点結果 / When 学習者が結果画面を見る / Then スコア + 中立コピーの改善ヒント（DEC-024 厳守 / 罰語ゼロ）が表示される
- [ ] AC-6: Given 親が dashboard を開く / When skill 別進捗を見る / Then listening / writing の正答率 / 取組数が独立に表示される（既存 dashboard 拡張）
- [ ] AC-7: Given 音源 / When ストレージ / 配信経路 / Then 著作権上問題のない調達経路（research 部門選定）= 自前生成 OR ライセンスクリア音源
- [ ] AC-8: Given ライティング採点 / When OpenAI コスト / Then 月次コスト上限 env で制御され、上限到達時は採点 queue 化 or 中立コピーで delay 通知

#### Out of Scope / 既存基盤 / DEC
- Out: 面接（speaking）対策（Phase 4 候補）、シャドーイング音声入力、音源自動生成パイプライン整備
- 既存: `audio-gate.ts` / `displayedShowAudioUi` / `listening-master` badge / `writing-input.ts` / `score-writing.ts` / OpenAI 接続 / `problems.audio_url` 列
- DEC: DEC-006 既存 25 routes 範囲内で完結が望ましい

---

## 2. 優先順位付け（MoSCoW + 運用必須度）

### 2.1 Must Have（β1 名運用 = 息子実使用前に絶対必須）

| ID | 内容 | 理由 |
|----|------|------|
| F-2 (核心) | アカウント設定・変更（settings トップ route 新設 + 親パスワード再確認 + 親 email 変更） | settings page トップが構造上不在 = 退会経路 / パスワード変更経路を持たないまま実子使用は個人情報保護観点で看過できない。1 名運用でも親 email 変更は必須。 |
| F-1 (学習者向け表示) | 受験日 home 表示（残日数カウントダウン） | 既存 W4 基盤で親側保存はできるが、学習者 home 側カウントダウンが欠けると「半年で英検3級」コア商品 KPI への接続が消える。 |
| F-4 (基本) | 1 日目標学習時間 + 当日進捗 bar + 親 dashboard 連動 | 「毎日 1 時間」を回す商品コアは時間目標がないと観測不能。リマインドは Should に分割可だが、目標設定 + 進捗表示は β 必須。 |
| F-7-a | リスニング音源 最低 1 セット seed 投入 + 再生 UX | 4 技能のうちリスニングが 0 のまま β 開始は商品 KPI を崩す。最低 1 セット 10〜20 問で β は耐える。 |

**Must の総 atomic 目安: 4〜6 件 / 受入条件総数: 30〜35 件**

### 2.2 Should Have（β 開始後 1 ヶ月以内導入推奨）

| ID | 内容 | 理由 |
|----|------|------|
| F-3 | 長期 / 短期目標の階層設定 + 達成判定 | 受験日 + 目標時間が揃えば、間の階段（月次 / 週次 / 当日）は次のレイヤとして 1 ヶ月運用観察後に導入で UX 整合する。 |
| F-7-b | ライティング採点 UX 整備 | 既存 `score-writing.ts` 基盤あり = 採点フィードバック UI と親 dashboard 連動を 1 ヶ月以内で整える。 |
| F-5-a | 辞書 popup（外部 API 採用） | Web Speech API + 既存問題文で β は耐えるが、語彙力が前提の英検3級では 1 ヶ月以内の搭載が学習継続率を底上げする。 |
| F-4 (リマインド) | 親宛リマインド通知（push or email） | 1 日目標未達時の声かけ trigger。VAPID 鍵設定 + email fallback で 1 ヶ月以内導入。 |

**Should の総 atomic 目安: 4〜5 件 / 受入条件総数: 25〜30 件**

### 2.3 Could Have（β 1 ヶ月運用後の評価で導入判断）

| ID | 内容 | 理由 |
|----|------|------|
| F-6 | AI チャット質問（解説後の追加質問） | 月次 OpenAI コスト上限管理 + safe completion / prompt injection 対策が前提。β 1 ヶ月で利用 pattern を観測してから上限値を確定する方が無駄が無い。 |
| F-5-b | 発音 TTS（外部 API 採用 / Web Speech API 代替済の場合） | Web Speech API で代替可能 = 外部 API 課金は学習継続率データを見てから判断。 |
| F-1 (受験日履歴) | 受験日変更履歴の保存 | β 1 名段階では履歴不要。複数家族運用に入った段階で価値が立ち上がる。 |
| F-3 (学習者編集) | 学習者自身の目標編集 | 親パスワード経路と整合しないため、運用で必要性が確認されるまで親編集のみで十分。 |

**Could の総 atomic 目安: 3〜4 件 / 受入条件総数: 15〜20 件**

### 2.4 Won't Have（本フェーズ範囲外 / Phase 4 以降検討）

| 項目 | 理由 |
|------|------|
| 友達招待 / family 拡張（多家族 leaderboard） | β1 名 → 数家族の段階を越えてから検討。COPPA 観点でも構造拡張が必要。 |
| ゲーミフィケーション機能の拡張 | 既存 W10-W11 基盤で十分。新規追加は学習価値が確認されてから。 |
| 親 AI チャット | 親側ニーズが β 運用で観測されてから。 |
| 多言語対応（UI 英語化等） | β 段階では日本語のみ。 |
| MFA / SSO | 1 名 〜 数家族段階では過剰。 |
| 課金導線 | DEC-066「ご利用は無料です」継続前提。広告マネタイズも別 atomic（DEC-072 候補-2 系統）。 |

**判断根拠の共通軸**:
1. **Must = 個人情報保護 + 学習者向け基本表示 + 商品コア（受験日逆算 / 毎日 1 時間 / 4 技能）の最小集合**
2. **Should = β 利用 pattern 観測 + リマインド + 階段化 + 語彙学習補助**
3. **Could = コスト or 安全性で観測前段階の決め打ちが過大投資（AI / TTS / 履歴 / 学習者編集）**
4. **Won't = 単家族 β を越えた次フェーズ議論（friend / multi-family / 課金 / MFA）**

---

## 3. 依存関係グラフ

### 3.1 表形式

| 機能 | 前提機能 | 後続候補 | 同 atomic 統合可否 |
|------|---------|---------|------------------|
| F-2 settings | （無 = 全機能の前提） | F-1 / F-3 / F-4 の親側設定経路 | F-2 単独 atomic 必須 |
| F-1 受験日 | F-2（設定 route） | F-3（合格目標日 = 受験日依存） | F-1 単独 / F-3 と統合可（Could） |
| F-3 目標 | F-1（合格目標日） / F-2 | F-4（短期目標 = 時間目標と整合） | F-3 単独推奨 |
| F-4 学習時間 | F-2 / F-3（短期目標と整合 = 任意） | F-3（達成判定で時間使用） | F-4 単独推奨 |
| F-5 辞書 popup | （独立） | F-7-a（リスニング画面で辞書活用） | F-5 単独 |
| F-6 AI チャット | （独立 / OpenAI 既存接続活用） | （無） | F-6 単独 / 後段配置 |
| F-7-a リスニング | （独立 / 音源 seed のみ） | F-5（辞書併用で価値増） | F-7-a 単独 |
| F-7-b ライティング | （既存基盤拡張） | （無） | F-7-b 単独 |

### 3.2 テキスト記述（要点のみ）

- **F-2 が全機能の前提**: settings トップ route 不在 = F-1 親側保存 / F-3 / F-4 の親設定経路は全て F-2 完遂後に乗る。
- **F-1 → F-3**: 長期目標は「合格目標日 = 受験日」起点で月次 / 週次を逆算するため F-1 永続化が F-3 階層の起点。
- **F-3 ↔ F-4**: 「今週 X 問」と「1 週間 Y 分」は home 進捗 bar を共有 = Must 段階で F-4（基本）を先行 → Should で F-3 + F-4（リマインド）を整える順序が UX 整合。
- **F-5 → F-7-a**: リスニング画面で未知単語を辞書 lookup する UX を 1 ヶ月以内に揃えると統合度向上。β 開始時点では F-7-a 単独で耐える。
- **F-6 / F-7-b は独立**: それぞれ既存 OpenAI 接続経路を流用。F-6 を Could に置く理由は依存ではなくコスト / 安全性観測のため。

### 3.3 グラフ図示（テキスト ASCII）

```
     [F-2 settings]
        |
        |---> [F-1 受験日] ---> [F-3 目標]
        |                         |
        |---> [F-4 時間 (Must基本)] <----+
        |          |
        |          +-> [F-4 リマインド]
        |
[独立] [F-5 辞書] ---> [F-7-a リスニング] (UX 統合度向上)
[独立] [F-6 AI チャット]
[独立] [F-7-b ライティング採点]
```

---

## 4. DB schema 影響予測（機能視点 / dev 詳細評価とは別レイヤ）

### 4.1 機能別影響表

| 機能 | 既存テーブル拡張 | 新規テーブル | DEC-006 mutation/GET 影響想定 | 代替案 |
|------|----------------|------------|--------------------------|--------|
| F-1 受験日 | `families` or 既存 exam-date 系 1 列追加で吸収可能性大 | 履歴テーブルは Could で別途 | mutation +0（既存 update 拡張） | （代替不要） |
| F-2 settings | `learner_profiles` / `families` の既存列拡張 + Supabase Auth 既存 | `parent_notification_settings`（任意） | mutation +1〜+2（更新 / 退会） | 退会は admin 経路 RPC に寄せて user-facing route +0 化検討 |
| F-3 目標 | （拡張困難 = 階層構造） | `family_goals`（long-term / monthly / weekly / daily を type 列で多態化） | mutation +1（CRUD まとめ） | RPC 1 本 + 種別 enum で route +1 抑制 |
| F-4 学習時間 | 既存 `study_session` + `families.daily_target_minutes` 列追加 | `daily_target_log`（Could） | mutation +0〜+1 | リマインド経路は cron / push（既存 W11-T4 基盤）に寄せ、route 不変 |
| F-5 辞書 popup | （拡張不要 = 外部 API 直叩き） | `dictionary_lookup_history`（Could / 親 dashboard top10 用） | GET +1（外部 API proxy）/ mutation +0〜+1 | 外部 API は client から直叩きで route +0 化（API key 露出回避は server proxy 必須 = GET +1 不可避の可能性大）= research 結果で確定 |
| F-6 AI チャット | （拡張不要） | `chat_messages`（learner_id / problem_id / role / content / cost_tokens / created_at） | mutation +1 / GET +1 | streaming は既存 OpenAI 経路寄せ |
| F-7-a/b リスニング・ライティング | `problems.audio_url` / `score-writing.ts` 既存流用 | （新規不要） | GET +0 / mutation +0 | 音源 seed + 既存基盤完全流用 = 構造変更ゼロ |

### 4.2 DEC-006 厳守可能性

- **現状**: GET 10 / mutation 5 / 25 routes（DEC-072 §実装完遂デルタ確認済）
- **Phase 3 全機能搭載時の予測**: mutation +3〜+4（F-2/F-3/F-6）= 8〜9 mutation / GET +2（F-5/F-6）= 12 GET → 両軸とも上限超過必至
- **代替案 1（推奨）**: 拡張 DEC 起票で GET 15 / mutation 8 に明示引き上げ（構造保証は維持）
- **代替案 2**: RPC 寄せで mutation 圧縮（F-3 多態 CRUD 1 本 / F-6 OpenAI 既存経路 / F-2 退会 admin RPC）
- **代替案 3**: Could 機能（F-6 / F-5-b）を Phase 3 範囲外に変更

**secretary 推奨**: 代替案 1 + 2 併用 = GET 15 / mutation 8 に拡張 + RPC 寄せで圧縮。**dev で feasibility 確認必須**。

---

## 5. W12-T4 ストレステスト atomic との関係

**判定: 並走可（排他不要 / 推奨並走）**

- W12-T4 = 既存 Sentry / RUNBOOK / Vercel rollback の運用面検証（コード追加ゼロ）。Phase 3 = 7 要望の機能追加。**触る範囲が独立**で重複なし。
- W12-T4（オーナー操作主導 + dev 立ち会い 0.5 人日）は Phase 3 第 1 atomic（F-2 settings 新設）と同週並走可能。
- 条件ゲート: W12-T4 で致命的 alert 構成欠落が出た場合は Phase 3 を一時停止して W12-T4 修正を優先する分岐をオーナー承認時に明記。

---

## 6. CEO 向けまとめ

### 6.1 7 要望の振り分け数

- **Must（β1 名運用前必須）**: 4 件（F-2 / F-1-学習者表示 / F-4-基本 / F-7-a）
- **Should（β 開始後 1 ヶ月以内）**: 4 件（F-3 / F-7-b / F-5-a / F-4-リマインド）
- **Could（1 ヶ月運用後評価）**: 4 件（F-6 / F-5-b / F-1-履歴 / F-3-学習者編集）
- **Won't（Phase 3 範囲外）**: 6 件（友達 / multi-family / ゲーミフィ拡張 / 親 AI / 多言語 / 課金）

### 6.2 atomic 数 + 受入条件総数（目安）

- Must atomic 4〜6 件 / 受入条件 30〜35 件
- Should atomic 4〜5 件 / 受入条件 25〜30 件
- Could atomic 3〜4 件 / 受入条件 15〜20 件
- **総計 atomic 11〜15 件 / 受入条件 70〜85 件**

### 6.3 オーナー判断要請項目（軸-2 secretary 観点）

| # | 項目 | 推奨デフォルト |
|---|------|---------------|
| O-1 | F-2 親パスワード再確認の方式（旧パス入力 / メール OTP / 親モード PIN 等） | 旧パス入力（Supabase Auth 既存挙動 + 簡素 / β1 名で十分） |
| O-2 | F-2 退会時のデータ削除粒度（論理削除 / 完全消去 / 匿名化） | 論理削除 + 個人情報フィールド null 化（復旧申請可 / GDPR-K 整合） |
| O-3 | F-4 リマインド経路（push / email / 両方） | email 先行（VAPID 鍵設定不要）→ 1 ヶ月後に push 追加 |
| O-4 | F-5 辞書 API 採用方針（外部 API / 自前 catalog / 児童向け辞書優先） | 外部 API（research 推奨選定 1 件）+ 児童向け語彙適合性優先 |
| O-5 | F-6 AI チャット月次回数上限 | 100 ターン / 月（β1 名 / OpenAI コスト上限から逆算 / dev 詳細見積後に確定） |
| O-6 | F-7-a リスニング音源調達 | research 推奨に従う（自前生成 vs ライセンス済音源）= β は最低 1 セット |
| O-7 | DEC-006 GET 10 / mutation 5 上限拡張の可否 | GET 15 / mutation 8 に拡張 DEC を起票（Phase 3 第 0 atomic で別途決議） |
| O-8 | Must 機能の β 開始 deadline | dev 工数見積後 CEO 提示 / 推奨 = 2026-05 月内 β 開始 |
| O-9 | Could 機能の評価タイミング | β 開始 + 1 ヶ月後に再評価 atomic を起票 |

### 6.4 リスク 3 件

1. **DEC-006 上限超過**: Phase 3 全機能で +6〜7 拡張必至 = dev で RPC 圧縮 feasibility を詰めた上で DEC-006 拡張 DEC を別 atomic で正式起票
2. **OpenAI コスト膨張**: F-6 + F-7-b + 既存解説生成で月次コスト上振れ可能性 = research の「コスト試算 + 月次上限 env 制御」を Must 段階から cost guard 設計
3. **子供向け UX 整合性**: 7 要望全てが DEC-024 罰則ゼロを継承（catalog pre-curated / 1224 ranking / `not.toContain` E2E 機械化）= F-3 達成判定 / F-4 未達表示 / F-6 safe completion / F-7-b 採点コピーが新たな罰語発生経路 = 既存 PAT-005 / PAT-007 / DEC-002 を 7 要望全件展開

### 6.5 secretary 推奨ロードマップ

第 0 atomic（前提整備 / 0.25 人日 = DEC-006 拡張 DEC 起票 + Must 4 件 atomic 番号確定）→ 第 1〜4 atomic（Must / 2〜3 週: F-2 → F-1 → F-4 → F-7-a）→ β 開始（W12-T4 並走）→ 第 5〜8 atomic（Should / 1 ヶ月以内: F-3 → F-7-b → F-5-a → F-4 リマインド）→ β + 1 ヶ月評価（Could Go/NoGo）→ Phase 3 完遂宣言（Must + Should 全完遂 + 1 ヶ月運用無事故 + DEC-024 罰語ゼロ継続）。

---

## 7. 制約遵守確認 + 報告先

- DEC-024 罰語ゼロ（grep 0 件 / 自己言及・引用は除外規定通り）/ 個人情報非記載 / 絵文字ゼロ / AC は Given-When-Then / What 限定 / 既存 DEC 継承宣言済
- CEO 統合先 = `reports/ceo-phase3-runtime-readiness-wbs.md`（DEC-073 軸-4）。本文書はオーナー承認 → atomic 分解 → 実装着手の順で参照される受入条件起点ドキュメント。
