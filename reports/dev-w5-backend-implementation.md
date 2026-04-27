# Dev W5 Backend Implementation Report (G-1 / G-3 / G-4)

担当: Dev (Backend)
対象: PRJ-016 HANEI W5 ギャップ埋め 6 タスクのうち G-1 / G-3 / G-4
根拠: DEC-036 (W5 圧縮 5 営業日プラン)
状態: 全タスク実装完了 + typecheck / lint / test 全緑

---

## 1. 変更ファイル一覧

実装本体:
- `projects/PRJ-016/app/src/lib/study/repository.ts`
  - G-4: `getNextProblem()` の SRS due 経路 + 未学習経路の双方に
    `EXISTS (SELECT 1 FROM problem_explanations WHERE problem_id = problems.id)`
    を追加し、explanation 未生成の問題を出題対象から除外。
- `projects/PRJ-016/app/src/lib/study/aggregations.ts`
  - G-1 用: `getDailySkillCounts(db, learnerId, now?)`
    - 当日 (ローカル日 = JST 想定) の解答数を skill 別 (vocabulary / grammar / listening / reading / writing) に集計。
    - `problems.skillId` の prefix (`vocabulary`/`grammar`/...) を解析して 5 軸へマップ。
  - G-3 用: `getMasteryCoverage(db, learnerId, levelId)`
    - 4 スキル (vocabulary / grammar / reading / listening) について
      `{ skill, mastered, total }` を返す。
    - `total` は `problem_explanations` 行 EXISTS (G-4 と整合)。
    - `mastered` = `answer_logs.is_correct = true` を 1 回以上記録した distinct 問題数。
    - `skillId` は `${code}-${levelId}` (例: `vocabulary-5`) でクエリ。
- `projects/PRJ-016/app/src/app/(app)/home/page.tsx`
  - 全面書き直し。W1 placeholder の hardcode (examDate / streak / todaysMission) を撤廃。
  - `requireAuth()` → `getFamilyIdForUser()` → `scopedQueries(familyId).listLearners()` で
    家族内 learner を取得。家族未所属 / learner 未登録時は `/onboarding/learner` にリダイレクト。
  - 受験日カウントダウンは `learnerProfiles.examDate` から計算 (未設定時は適切な空状態)。
  - Streak は `getCurrentStreak(db, learner.id)`、XP/Lv は `xp_levels` から取得。
  - 今日のミッションは `getDailySkillCounts()` の実データ + `dailyMinutesTarget` を 4 等分した target で表示。
  - G-3: 級別進捗 Card を追加。`getMasteryCoverage()` で 4 スキル分の Progress を描画。
    日本語ラベルは `<ruby>` でひらがなをふりがなとして併記。
  - 絵文字 0 件、Heroicons 利用、shadcn/ui Card + Progress、min-h-tap-cta などのトークン維持。
- `projects/PRJ-016/app/eslint.config.mjs`
  - `scripts/**/*.ts` の `no-restricted-syntax` 例外を追加 (運用 / バルク管理スクリプトは
    family スコープ外で動く設計のため認可ルール対象外)。

テスト:
- `projects/PRJ-016/app/tests/unit/study.aggregations.test.ts`
  - `mockSelectChain` を `groupBy` / `innerJoin` 対応に拡張。
  - 連続呼び出し用の `mockSelectChainSeq` を追加。
  - `getDailySkillCounts()` 3 ケース、`getMasteryCoverage()` 2 ケースを追加 (合計 +5)。

副次変更 (lint --fix によるクリーンアップ):
- `projects/PRJ-016/app/scripts/generate-explanations-w3.ts` — 不要 eslint-disable 2 行削除
- `projects/PRJ-016/app/scripts/replace-problem.ts` — 不要 eslint-disable 1 行削除

---

## 2. 検収結果

| ゲート | 結果 |
|--------|------|
| `npx tsc --noEmit` | exit=0 / 0 errors |
| `npm run lint` | 0 errors / 0 warnings |
| `npm run test` | **138 passed (14 files)** / 失敗 0 / skip 0 |

baseline は 133 件 → 新規 5 件追加で 138 件。既存テストの破壊は 0。

---

## 3. G-1 / G-3 / G-4 仕上がりサマリー

### G-1: `/home` 本実装 (DB 接続化)
- DB 接続経路を `requireAuth → getFamilyIdForUser → scopedQueries(familyId).listLearners()` に統一。生 `db.select()` は `xp_levels` 取得 1 箇所のみで、`eslint-disable-next-line no-restricted-syntax` コメント (familyId スコープ済) で明示。
- 受験日 `learner.examDate` から `daysUntilExam` を計算 (未設定時は「未設定」表示 + プロフィール案内)。
- 連続記録は `streaks.currentStreak`、XP は `xp_levels.totalXp` / `level`。
- 今日のミッション `done` は `answer_logs ⨝ problems` の skill 別 distinct 集計で実データ化。`target` は `dailyMinutesTarget / 4` (1 分 = 1 問換算 / 最低 1)。
- 学習者プロフィールが無ければ `/onboarding/learner` へ redirect。
- 絵文字 0 / Heroicons (`AcademicCapIcon` `CalendarDaysIcon` `FireIcon` `TrophyIcon` `ChatBubbleLeftRightIcon` `ChartBarIcon`) / shadcn Card + Progress + Button。

### G-3: 5 級進捗バー
- 新セクション「英検{N}級の進捗」を home 末尾近くに追加。
- 4 スキル (ごい/ぶんぽう/どっかい/リスニング) を shadcn `Progress` + `<ruby>` で表示。
- `mastered / total (pct%)` を `tabular-nums` で右寄せ表示、`aria-label` 付与で WCAG AA。
- `total` は G-4 と同じ `EXISTS problem_explanations` フィルタを共有 → 当面 5 級 listening は 99 (DEC-035 の 1 件除外) で表示される。
- 「マスター済み」= `answer_logs.is_correct=true` を 1 回以上記録した distinct 問題数 (Phase 1 暫定)。

### G-4: 出題対象フィルタ
- `getNextProblem()` の SRS due 経路 + 未学習経路の両方に explanation EXISTS を追加。
- 副次効果 (W6 まで自然解禁):
  - 5 級 listening の DEC-035 取りこぼし 1 件は出題されない。
  - 4 級 / 3 級の旧 21 件 (大半は explanation 無し) も当面出題されない (W6 バックフィルで自動解禁)。
- 関数本体に `DEC-036 G-4 = explanation 無し除外、W6 バックフィルで自然解禁` のコメントを明記。
- 既存の study.actions テストは破壊せず PASS (mock 側で submitAnswer 経由の `getNextProblem` は path 通過のみ)。

---

## 4. 申し送り (Frontend / E2E 担当者向け)

1. **/home の DOM 構造**: `<header>`/`<section>` のセマンティック構造を維持。新規 G-3 セクションは `<h2>` 「英検{N}級の進捗」+ Card 内に 4 本 Progress。E2E で進捗バーを掴む際は `aria-label="<スキル名> の進捗 NN%"` で取得可能。
2. **`<ruby>` タグ使用**: G-3 のスキルラベルで `<ruby>語彙<rt>ごい</rt></ruby>` を採用。Playwright の `getByText("語彙")` でも引っかかるが、ふりがな込みの厳密一致を避けるなら `getByLabelText` 経路推奨。
3. **空状態の設計**: 学習者ゼロ件 / examDate 未設定 / 解答ログ 0 件 / coverage total=0 のすべてに分岐あり。E2E で「初回サインアップ → onboarding 直後 → /home に来たら受験日カウントダウンが『未設定』表示」のフロー確認可能。
4. **G-4 の挙動確認**: ローカル DB で 5 級 listening の `problem_explanations` を 1 件 DELETE すれば `getNextProblem('eiken-5','listening')` がその 1 件を返さなくなることを確認可能 (W6 バックフィルで自動解禁設計なので、テスト後の rollback 不要)。
5. **TTS audio (G-2) は未着手**: 私の担当外。Frontend 担当者が `<audio src={problem.audioUrl}>` を `StudyClient.tsx` に追加する際、`problems.audioUrl` (R2 URL) は既に schema にあるので Drizzle から直接取れる。
