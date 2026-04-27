# PRJ-016 HANEI / Phase 1 W5 部署別ブリーフ（CEO 事前下書き）

**作成日**: 2026-04-26
**作成者**: CEO（オーナー手動 smoke 中の並行作業）
**用途**: オーナーが db:seed → ai:generate-explanations を完遂しログを共有してくれた直後、CEO が即時に Dev / Research / Designer を **3 部署並列発令**できるようブリーフを事前完成させる
**前提**: DEC-027 完了 / Turso に 822 問投入済 / 解説 `inserted=N (N>0)` / TTS 完遂 / 累計 133 tests PASS

---

## 0. W5 のテーマ

**「模試本体実装週」** — 学習者向け模試（5 級 / 4 級 / 3 級）の実施フローを end-to-end で動作させる週。

W4 で完成した「模試結果画面」「受験日カウントダウン」「学習者切替」を **実データで動かす**ために、出題 → 解答 → 採点 → 保存 → 結果画面表示 → AI 弱点改善提案 まで通す。

W3 / W4 申し送りの計 12 件（Dev 5 + Research 5 + Designer 2）を統合発令。

---

## 1. Dev 部署ブリーフ（W5 / T-1〜T-7）

### 必読コンテキスト
1. `organization/roles/dev.md`
2. `projects/PRJ-016/decisions.md`（DEC-001〜027、特に DEC-026 / 027 = W4.5 補修 + Windows cmd 教訓）
3. `projects/PRJ-016/reports/dev-w4-report.md`（W4 で実装した模試結果画面の構造）
4. `projects/PRJ-016/reports/dev-w4-5-fix-report.md`（seed-id-mapper / seed-runner / 自然 ID 規則）
5. `projects/PRJ-016/app/src/lib/db/schema.ts`（mock_exam_results / problems / users / family_members 等）
6. `projects/PRJ-016/app/src/app/(parent)/parent/mock-exam-results/page.tsx`（W4 完成、表示は OK だが実データ未接続）
7. `projects/PRJ-016/app/scripts/seed-id-mapper.ts`（W4.5 で確定した自然 ID マッピング）

### タスク

**T-1: 模試実施フロー本体 (出題画面)**
- `/study/mock-exam/[levelCode]` ルート新規作成（learner レイアウト下、保護者ではなく学習者画面）
- 5 級 / 4 級 / 3 級 各レベル 30 問のセッションを動的に生成（seed-id-mapper 経由で当該レベルの problems から出題プールを抽出 → ts-fsrs の優先度を考慮しつつランダム 30 問抽出）
- タイマー実装（5 級 25 分 / 4 級 35 分 / 3 級 50 分、英検公式に準拠）
- 中断救済: ブラウザリロード対策として localStorage に進捗を 30 秒毎に保存、再開可能
- ことだまトリの「mock-exam-encouragement」状態を中盤・終盤の 2 回挿入（Designer ガイド W4 / 学習者キャラ 10 状態 + W5 で +1）

**T-2: 採点ロジック + mock_exam_results 保存**
- Server Action `lib/actions/mock-exam.ts` 新規:
  - `submitMockExam({ examId, answers })` で全問採点
  - `mock_exam_results` テーブルへ insert（learnerId / level / totalScore / skillScores JSON / submittedAt / durationSec）
  - 5 軸スコア（vocab / grammar / listening / reading / writing）を計算 = W4 のレーダーチャート連動
- 三層認可厳守: 学習者本人のみ submit 可能（requireLearner + scopedQueries）
- 副次効果として ts-fsrs の SRS スケジュールを更新（誤答した問題は復習キューへ）

**T-3: 同年齢層比較ロジック（プライバシー配慮）**
- 「全 5 級受験者の平均スコア」「同学年（小4 / 小5 / 小6）の平均スコア」を集計
- ただし **個人特定不可となる集計のみ**（最低 N=10 人未満は集計表示せず「比較データ準備中」と表示）
- 比較表現は Designer の W5 マイクロコピー集（T-Designer-2）に従い、傷つけない表現で出力（例: 「あなたは vocab が得意ジャンルです」○、「あなたは平均より下です」×）
- `lib/study/peer-comparison.ts` 新規

**T-4: 弱点改善提案 AI 動的化**
- 現状の Designer ガイド W4 では静的テンプレ 3 種（vocab 弱め / grammar 弱め / listening 弱め）が用意されている
- `lib/ai/coaching-suggestions.ts` 新規:
  - 入力: 5 軸スコア + 直近誤答 TOP10 + 学習者プロファイル
  - 処理: gpt-5-mini を `generateObject` で呼び、3 件の改善提案 JSON を取得
  - 三重ガード厳守（NG 辞書 + Moderation API + 出力フィルタ）
  - 個別学習者コストガード（既存 `cost-guard.ts` の ¥10/日 上限を活用）
- 静的テンプレからの fallback は維持（API 障害時 / コスト天井時）

**T-5: smoke 完走 + Vercel 環境変数 push（W3→W4→W4.5 持ち越し）**
- オーナーが **既に完遂しているはず**だが、未完なら Dev が `reports/owner-smoke-checklist-w3.md` の 8 項目を **更新版として** `owner-smoke-checklist-w5.md` に発展（DEC-026/027 の教訓を反映）
- 具体追加項目:
  - `npm run db:push` 後に Turso CLI で `SELECT count(*) FROM problems;` を実行し 822 件を確認
  - `set DRY_RUN=` `set SEED_LEVELS_SKILLS=` で環境変数残留を必ずクリアする手順を Windows cmd / PowerShell / WSL の 3 形式で明示
- `cross-env` 導入も検討（W5 中に実施可能なら yes、難しければ W6）

**T-6: AI バルク実行結果の DB 反映**
- オーナーが `npm run ai:generate-explanations` を完遂後、`problem_explanations` テーブルに N 件挿入されている想定
- 学習者画面（`/study/[levelCode]/[skillCode]`）の解説表示で **DB 解説優先 + fallback で seed の `explanation_jp` を使う**ロジックに統一
- 既存テスト 1 本追加: 解説優先順位の単体テスト

**T-7: テスト追加 + ビルド全緑確認 + 報告書**
- Vitest +10 ケース（mock-exam.actions / peer-comparison / coaching-suggestions）
- Playwright +3 ケース（mock-exam の 5 級フル受験 e2e、tab 切替で localStorage 復元、submit 後に results 画面表示）
- 累計 **133 → 約 145 tests PASS** 想定
- typecheck 0 / lint 0 / test 全緑
- 報告書: `reports/dev-w5-report.md`

### 厳守事項
- **「typecheck 0」「test PASS」を実コマンドで確認してから報告**（W3 false-positive を二度と起こさない）
- W4.5 の seed-id-mapper / 自然 ID 規則を **絶対に破壊しない**（依存スクリプト群と整合性必須）
- 模試タイマーは window タブ非アクティブ時にも動作する（performance.now ベース）
- 中断時に **回答済み問題が消えない**こと（localStorage は同期書き込み）
- 学習者向け画面の文体は「やさしい日本語 + ふりがな」、保護者向けは「敬語 + 丁寧語」を厳守（Designer W3 トーン差別化）

---

## 2. Research 部署ブリーフ（W5 / R-1〜R-5）

### 必読コンテキスト
1. `organization/roles/research.md`
2. `projects/PRJ-016/reports/research-w4-problems.md`（W4 で確立した品質基準 0.85+ / 自己採点ルーブリック）
3. `projects/PRJ-016/app/scripts/seed-problems-w2/w3/w4.ts`（既存 822 問の構造）
4. `projects/PRJ-016/app/scripts/seed-id-mapper.ts`（W4.5 で確定した ID 命名規則）

### タスク

**R-1: 5 級 reading 50 問追加**
- 新規ファイル `seed-problems-w5.ts`（W2/W3/W4 と同じ default export 構造）
- ID = `R5-001 〜 R5-050`（衝突チェック: W3 の `O5-001..030` reorder と区別、`R` プレフィックスで安全）
- 出題形式: 短文 reading（passage 30〜60 語）+ 4 択 1 問
- 著作権 100% オリジナル（架空の人物名 / 学校名 / 街名は研究 W2 のガイドライン踏襲）
- qualityScore self-grading 平均 0.85+ 必達

**R-2: 5 級 listening 30 問追加**
- ID = `L5-101 〜 L5-130`（W3 の L5-001..100 に続く番号）
- 出題形式: 質問音声 + 応答 4 択
- audio_transcript 必須（W3 と同じ JSON 構造）

**R-3: 822 問の DB seed 反映確認 + UI E2E 連動データ**
- W4.5 で seed-runner 完備済 → Research が DB に直接介入する必要はない
- 代わりに「**`npm run db:seed` 実行後の Turso に対して、各 levelCode × skillCode の問題件数が想定通り**であるか」を検証する SQL クエリ集を `research-w5-data-validation.md` に提出（オーナー or Dev が叩く）
  - 例: 5 級 vocab = 60 + 100 = **160** 件 expect / 4 級 listening = 20 + 80 = **100** 件 expect / 3 級 reading = 10 + 40 + 50 = **100** 件 expect

**R-4: TTS A/B テスト（W3 listening 100 問）**
- W4 でオーナーが `npm run ai:generate-tts` を実行（W3 listening 100 問 × 3 voice = 300 ファイル想定だが、現状は W2 5 級 vocab 200 問 × 3 = 600 ファイル運用）
- nova / alloy / shimmer のうち **小学生に最も聞き取りやすい音声**を A/B テスト設計（保護者ヒアリング想定 5 名 / 子どもヒアリング 10 名）
- 評価軸: 速度 / 抑揚 / 単語明瞭性 / キャラクター好感度
- 推奨 voice を 1 つ選ぶ + 公式運用に採用（fallback で 2 voice キープ）
- `research-w5-tts-ab.md` 提出

**R-5: 模試結果サンプルデータ（5 級 / 4 級 / 3 級 各 3 学習者分）**
- 模試結果画面（W4 / `/parent/mock-exam-results`）の UI 完成度確認用に、リアルな mock データを提供
- 内容: 学習者名（架空）/ 受験日 / 5 軸スコア / 強み弱み / 対策提案
- JSON 形式で `research-w5-mock-results.json` 提出
- Dev T-3（同年齢層比較ロジック）のテスト fixture としても活用

### 厳守事項
- 100% オリジナル（過去問流用なし、英検協会公式問題は引用しない）
- 絵文字なし
- kid-safe NG 辞書 60 語に抵触なし
- 自己採点 qualityScore 0.85+ / 0.85 未満は再生成
- ID 命名規則は **W4.5 で確定したものを厳守**（衝突回避は Research が責任を持つ）

---

## 3. Designer 部署ブリーフ（W5 / D-1〜D-2）

### 必読コンテキスト
1. `organization/roles/design.md`
2. `projects/PRJ-016/reports/design-w1-tokens.md`（Amber Gold + WCAG AA + ことだまトリ 10 状態）
3. `projects/PRJ-016/reports/design-w3-parent-dashboard.md`（保護者トーン差別化）
4. `projects/PRJ-016/reports/design-w4-mock-exam-results.md`（模試結果画面 = SVG レーダー / 弱点改善提案カード）

### タスク

**D-1: 模試実施フロー UI ガイド**
- `design-w5-mock-exam-flow.md`（10 章相当、Tailwind class フル）
- 必須章: ① タイマー UI（残り時間に応じて色変化、最後 5 分で警告色） / ② 問題表示 + 4 択 / ③ 進捗バー（n/30 問） / ④ 中断救済モーダル（「続きから」「最初から」「やめる」） / ⑤ 提出確認ダイアログ / ⑥ 採点中ロード画面（ことだまトリ thinking 状態） / ⑦ 結果遷移アニメ
- ことだまトリ **学習者状態 +1** = 11 番目 `learner-mock-exam-encouragement`（中盤の励まし、ふりがな付き優しい表現）
- マイクロコピー +15 例（ですます調 / ふりがな付き）
- WCAG AA 全本文組合せ + reduced-motion 厳守
- JSX スニペット集 `design-w5-mock-exam-snippets.md`（5 component 想定 = MockExamTimer / QuestionCard / ProgressBar / InterruptDialog / SubmitConfirmDialog）

**D-2: 比較表現倫理マイクロコピー集**
- `design-w5-peer-comparison-microcopy.md`（短くて良い、200 行程度）
- 同年齢層比較を「傷つけない表現」に変換するルール集 + 50 例
- ルール例:
  - 平均スコア表示時: 「平均スコア XX 点」○ /「あなたは平均より YY 点低い」×
  - 弱み表現: 「次に伸ばすチャンス」「あと一歩」○ / 「不得意」「弱点」（保護者用は OK、学習者用は ×）
  - 強み表現: 学習者には全員に「強みジャンル」を 1 つ必ず明示する（自己肯定感確保）
  - 比較対象人数 N が少ないとき: 「データ準備中」表示、「同学年 N 人中」のような露骨な表示は避ける
- 50 例は「Before（NG 例） → After（OK 例）」形式で並べる（Dev が T-3 / T-4 で実装する際の参照材料に）

### 厳守事項
- 学習者向け = やさしい日本語 + ふりがな + 励まし基調
- 保護者向け = 敬語 + 丁寧語 + 客観的データ
- 「不合格」「失敗」「弱点」（学習者向け）など否定語は完全回避（W4 で確立）
- 景表法配慮: 「半年で必ず合格」「絶対」など断定表現は禁止、「目指す」「合格に近づく」表現を使用

---

## 4. CEO 並列発令時の注意点

### Agent 起動順
- 3 部署完全並列で OK（依存関係なし）
- ただし Dev T-1〜T-7 は他部署の成果物を **読まずに済む**よう自己完結指示（既存 W4 / W4.5 ファイルだけで作業可能）
- Designer D-1 / D-2 は Research の R-5 mock データに **依存しない**よう、独自に小さいダミーデータで設計を進める

### CEO 検収プロセス（DEC-026 教訓を踏襲）
- 「typecheck 0 / lint 0 / test PASS」を **CEO が実コマンド再走**して確認
- Dev の方針逸脱があれば理由を確認した上で承認/差戻しを判断
- W5 完遂判定に **「end-to-end smoke = 学習者が模試を通しで受けて結果画面まで遷移できる」** を必須化（DEC-026/027 教訓）

### 想定 token / 時間
- 各部署 30〜60 分（並列なので合計 60 分以内）
- 統合 + DEC-028 記録 + ダッシュボード更新で +20 分

---

## 5. オーナー復帰時の CEO アクション順

1. ✅ オーナーから `inserted=822` ログ受領 / `inserted=N (N>0) explanations` ログ受領
2. ✅ DEC-027 補足記録 確認
3. ✅ smoke checklist 補強（このブリーフ提出後、必要なら）
4. **→ ここでこのブリーフ通り 3 部署並列発令**
5. 各部署完了報告 → CEO 検収 → DEC-028 記録 → ダッシュボード更新 → オーナー報告

以上、W5 並列発令の準備完了。
