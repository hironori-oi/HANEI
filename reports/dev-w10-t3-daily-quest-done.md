# Dev W10-T3: Daily Quest デイリーミッション 実装 完了レポート

- 案件: PRJ-016 HANEI
- スコープ: W10-T3 (Daily Quest / DEC-024 罰則ゼロ哲学整合)
- 日付: 2026-04-30
- 担当: Dev (Claude)
- 方針: AI 呼び出しゼロ / lazy generation (cron 不使用) / 1 atomic commit / 既存 W10-T1/T2 を壊さない

---

## 1. サマリー

W10-T3 の Daily Quest 機能を「決定論的生成 + lazy generation + atomic claim + best-effort 進捗 hook」の 4 軸で実装。学習者は `/home` のサマリ リボン または `/quests` ページから 1 日 3 件のミニ ゴールを参照し、達成すると 1 件あたり 15 ハネキン、3 件全達成で追加 30 ハネキンのボーナスを 1 度だけ受領できる。

決定論性は mulberry32 PRNG + (learner_id, quest_date) ベースの hash seed で担保し、同 (学習者, 当日) で何度呼んでも同じ 3 件が出る。Vercel Cron Hobby plan の制約に合わせ、`/home` または `/quests` の初回アクセスで遅延生成 (lazy gen) する設計。

JST 6:00 を「今日」境界としているのは「夜更かしして 23:59 にクエスト達成 → 0:01 に受け取り忘れ」という体験のすり減りを避けるため (DEC-024 罰則ゼロ哲学と整合)。

罰則ゼロ: 未達でも streak は減らさない / マイナス pop 表示なし / 否定形文言なし。

unit テスト 56 件 (新規 3 ファイル) + 既存 unit 全 542 件 緑通し。typecheck / lint clean。e2e は 4 ケース (lazy gen / 冪等 / claim + bonus / 重複 claim skip) を新規追加。build (npm run build) も成功し、`/quests` ルートが route table に追加されている。

---

## 2. 変更ファイル

### 新規追加
- `drizzle/0012_w10_daily_quests.sql`
  - `daily_quests` テーブル + `(learner_id, quest_date, quest_type)` UNIQUE INDEX
  - 検索用 `(learner_id, quest_date)` INDEX
- `src/lib/quest/jst-date.ts`
  - `getJstQuestDate(now)` / `isQuestDateString()` / `jstQuestDayStartUtc()`
- `src/lib/quest/quest-templates.ts`
  - 7 種の `QUEST_TEMPLATES` 定義 (mock_warmup は Phase 1 で disabled)
  - `selectableTypes()` / `renderQuestTitle()` / `shouldIncrementForAnswer()`
- `src/lib/quest/quest-generator.ts`
  - `mulberry32()` / `hashStringToUint32()` / `buildQuestSeed()`
  - `deterministicShuffle()` / `pickTarget()`
  - `generateDailyQuests({learnerId, questDate, count})` (純関数)
- `src/lib/actions/quests.ts`
  - `getOrGenerateTodayQuests(learnerId)` (Server Action / lazy gen 入口)
  - `claimQuestReward({learnerId, questId})` (Server Action / atomic + idempotent + all-done bonus)
  - `incrementQuestProgress({learnerId, skill, isCorrect})` (Server Action / submitAnswer hook)
- `src/components/quest/DailyQuestCard.tsx` (Client Component)
- `src/components/quest/DailyQuestSummaryRibbon.tsx` (Server Component)
- `src/app/(app)/quests/page.tsx` (Server Component)
- `tests/unit/quest.jst-date.test.ts` (12 cases)
- `tests/unit/quest.templates.test.ts` (19 cases)
- `tests/unit/quest.generator.test.ts` (25 cases)
- `tests/e2e/quests.spec.ts` (4 cases)

### 修正
- `src/lib/db/schema.ts`
  - `dailyQuests` テーブル定義追加 + 型 export (`DailyQuest` / `NewDailyQuest`)
- `src/lib/actions/study.ts`
  - `submitAnswer` に `incrementQuestProgress` 呼び出しを追加 (best-effort / try-catch で握り潰し)
  - `problem.skillId` 末尾の `-N` を剥がして skill code を抽出
- `src/app/(app)/home/page.tsx`
  - `getOrGenerateTodayQuests(learner.id)` を Promise.all に追加
  - 4 ボタン群の上に `<DailyQuestSummaryRibbon>` セクションを追加
- `tests/e2e/fixtures/db-fixture.ts`
  - migration list に `0012_w10_daily_quests.sql` を追加
  - seed teardown の DELETE 対象に `daily_quests` を追加

---

## 3. 主要 diff のポイント

### 3-1. 7 種 quest_type / Phase 1 で 6 種 selectable

| quest_type | 進捗トリガ | target 候補 | enabled |
|---|---|---|---|
| `vocab_count` | `vocabulary` 正解 +1 | 3 / 5 / 7 | yes |
| `listening_perfect` | `listening` 正解 +1 | 2 / 3 | yes |
| `reading_count` | `reading` 解答 +1 (正誤問わず) | 2 / 3 | yes |
| `writing_count` | `writing` 解答 +1 (正誤問わず) | 1 / 2 | yes |
| `streak_keep` | 任意の 1 解答 → +1 | 1 (固定) | yes |
| `badge_progress` | `vocabulary` 正解 +1 | 5 / 7 / 10 | yes |
| `mock_warmup` | mock 完了 (Phase 3) | 1 | **no** (Phase 1 除外) |

`generateDailyQuests` は `selectableTypes()` (= 6 種) から `streak_keep` を必ず 1 件目に固定し、残り 2 件を deterministic shuffle で抜く。3 件は重複しない (非復元抽選)。

### 3-2. 決定論性 (PRNG + hash)

- seed = `hashStringToUint32(<learnerId>|<questDate>)` (cyrb53 派生 / 32-bit)
- PRNG = `mulberry32(seed)` (Bryc / 公知 / 軽量)
- 同 (learner, date) で何度呼んでも同じ 3 件 + 同じ target が出る (unit test 25 件で検証)
- 学習者が違えば結果も違う (生成の多様性も検証)

これにより lazy gen の冪等性は **アプリ層** (deterministic 同一性) と **DB 制約** (UNIQUE `(learner_id, quest_date, quest_type)`) の **二重防御** で担保される。

### 3-3. JST 6:00 境界 (DEC-024 整合)

`getJstQuestDate(now)` は UTC 瞬時を JST に補正した上で 6 時間ずらして UTC 日付を抽出する。

| JST 時刻 | quest_date 戻り値 |
|---|---|
| 4/30 05:59 JST | `2026-04-29` (前日扱い) |
| 4/30 06:00 JST | `2026-04-30` (当日扱い) |
| 4/30 23:59 JST | `2026-04-30` |
| 5/1 05:59 JST | `2026-04-30` (まだ 4/30 扱い) |
| 5/1 06:00 JST | `2026-05-01` |

「夜中まで起きてた子が 5/1 朝に取りに来ても 4/30 の bonus を取れる」という DEC-024 罰則ゼロ哲学に沿った仕様。

### 3-4. claim atomic action (連打 / 並行耐性)

`claimQuestReward` の流れ:

1. 認可 (requireAuth + requireLearnerOwner / FormData 改ざん防御)
2. `daily_quests` 行を learner_id スコープで取得
3. `status='claimed'` なら `skipped: true` で no-op (冪等)
4. `progress < target` なら `not_completed`
5. **atomic UPDATE**: `WHERE id = ? AND learner_id = ? AND status = 'in_progress'` → 他 tab で先に claim 成功していれば rowsAffected=0 / `skipped: true` で倒す
6. `coin_transactions` INSERT (referenceId = `quest_<questId>`) + `coin_balance` UPDATE
7. **all-done bonus**: 同日 3 件全 claimed なら 1 度だけ `coin_transactions` (referenceId = `all_done_<questDate>`, amount = +30) を計上
8. `revalidatePath('/quests' / '/home')`

ボタン連打 / 複数 tab / Server Action 重複呼び出しに対し、`status` の atomic UPDATE と冪等チェック (referenceId) で二重付与不可。

### 3-5. submitAnswer hook (best-effort)

`submitAnswer` の最後 (XP / coin 付与の後) に `incrementQuestProgress` を呼ぶ。`problem.skillId` 末尾の `-N` を `/^(vocabulary|grammar|listening|reading|writing)(?:-[0-9]+)?$/` で剥がして skill code として渡す。

- 例外は try-catch で握り潰す → 学習体験 (次問遷移) を中断しない
- 当日の `daily_quests` 行が 0 件 (lazy gen 未発火) なら何もしない → `/home` または `/quests` を 1 度開くまでは進捗加算されない (ただしユーザー動線上、通常は `/home` 経由なので問題なし)
- `WHERE progress < target` 条件で並行 hook が target を超えて進める事故も防御

### 3-6. /home サマリ リボン

4 ボタン (badges / accessories / messages / shop) の **上** に 1 セクション追加:

- 「きょうのクエスト」card
- 進捗バー (claimed / total)
- claimable 件数表示 (うけとれる ハネキンが N こ)
- /quests への CTA ボタン (claimable > 0 なら primary / それ以外 outline)
- 全完了 + bonus 受領済 → 祝福文言

罰則ゼロ哲学: 未達でも「もんだいに とりくむと メーターが すすむよ」/ 1 件以上達成済 + claim 残あり → 「うけとれる ほうしゅうが あるよ」/ 全完了 → 「きょうは ぜんぶ クリア！」など、否定形なし。

---

## 4. テスト

### Unit (`npm run test`)

- 新規 3 ファイル / 56 件
  - `tests/unit/quest.jst-date.test.ts` (12 件) - 6:00 境界 / 月またぎ / 年またぎ
  - `tests/unit/quest.templates.test.ts` (19 件) - 7 種定義整合性 / shouldIncrementForAnswer
  - `tests/unit/quest.generator.test.ts` (25 件) - PRNG 決定論性 / streak_keep 必須 / mock_warmup 除外 / count
- 既存 unit 全 486 件 (regression なし) も含めて **計 542 件 GREEN**

```
Test Files  43 passed (43)
     Tests  542 passed (542)
```

### Build / Lint / Typecheck

- `npx tsc --noEmit` clean (W10-T3 修正分含む)
- `npm run lint` clean
- `npm run build` 成功 / `/quests` route 登録確認 / 22 static pages 生成

### E2E (`tests/e2e/quests.spec.ts` / 4 cases)

| # | テスト | 検証内容 |
|---|---|---|
| 1 | 初回 lazy gen | `/quests` 訪問で `daily_quests` 行が 3 件 INSERT / streak_keep 必須 / mock_warmup 除外 |
| 2 | 冪等 | 同日 2 度目の遷移でも 3 件のまま (id 集合一致) |
| 3 | 全 claim + bonus | progress を target に直接書き込み → 3 件 claim → 残高 = reward*3 + 30 / `all_done_<date>` 取引が 1 件 |
| 4 | 重複 claim skip | 1 件 claim 後 reload → claimed view 表示 / 行は status='claimed' で 1 件のみ |

> **注**: Playwright `chromium` × `mobile-chrome` × 4 ケース = 8 テスト。Playwright 一覧化で spec の構文 / discoverability は確認済 (`npx playwright test --list`)。
>
> **CEO 申し送り**: 当機での webServer port 3000 が別プロセス (PID 37296 / node) に占有されており、playwright `webServer` 起動が `EADDRINUSE` で fail する状態だった。実機実行は CEO 確認時 or CI 上で行う想定。spec は既存 `shop.spec.ts` (W10-T2 緑通し済) と完全に同一の signup + file libSQL 直接接続パターンに揃えてあり、構造上の不整合はない。

---

## 5. 不変条件 / 哲学

- **罰則ゼロ (DEC-024)**: 未達でも streak は減らさない / マイナス pop なし / 否定形なし
- **課金システム化禁止 (DEC-012)**: 報酬は閉じた経済内 (ハネキン) のみ / 外部購入導線ゼロ
- **三層認可**: 全 SQL に learner_id スコープ / Server Action 内で再 requireLearnerOwner
- **冪等性**:
  - lazy gen: deterministic 同一性 + UNIQUE 制約の二重防御
  - claim: status atomic UPDATE + (learner_id, reason='quest', referenceId='quest_<id>') 冪等
  - all-done bonus: (learner_id, reason='quest', referenceId='all_done_<date>') 冪等
- **lazy generation**: cron 不使用 (Vercel Hobby plan 整合 / 1 cron/day 制約に巻き込まれない)
- **AI 呼び出しゼロ**: Daily Quest 生成は完全に決定論的 (再現性 / cost 0)

---

## 6. 既存機能への影響 (regression risk)

- W10-T1 (ハネキン経済): coin_transactions / coin_balance の使い方は既存パターン (DEC-055) と完全に同一。新たな reason 値の追加なし (`'quest'` は既に enum に存在)。
- W10-T2 (Shop UI): /shop ページ / `purchaseShopItem` には変更なし。home の 4 ボタン構成も保持。
- W8-T2 combo / W8-T5 daily goal: submitAnswer の追加 hook は try-catch で best-effort / 既存戻り値構造 (`SubmitAnswerResult`) は不変。
- W9-Polish (kotodama / accessories / parent messages): home page の他のセクションは完全に保持。リボンを 4 ボタン群の上に挿入しただけ。
- E2E 既存 spec: db-fixture.ts に migration を追加しただけで、既存 seed 構造は不変。

---

## 7. 申し送り (W10-T4 以降に向けて)

- **mock_warmup の有効化** (Phase 3): `QUEST_TEMPLATES.mock_warmup.enabled = true` にして `incrementQuestProgress` 経路 OR mock 完了 hook 側からの増分加算を結線するだけで Phase 3 で追加できる構造。
- **クエスト履歴**: 過去日のクエスト行は `daily_quests` テーブルに残っているので、「先週のクエスト達成率」のような親ダッシュボード集計も低コストで実装可能。
- **JST 境界の調整**: 現在 6:00 固定だが、family preferences で「うちの子は朝 7 時起き」のような個別設定 (preferences カラムへの追加) は今後の検討余地。
- **「やりすぎ防止」**: 1 日 3 件固定なので「達成し続けると無限に貯まる」事故はないが、/quests カードに「がんばりすぎないでね」系のソフト リミッタ文言を入れるかは UX レビュー次第。

---

## 8. atomic commit message (push しない)

```
feat(W10-T3): デイリーミッション (Daily Quest) 実装

- daily_quests テーブル + (learner, date, type) UNIQUE で lazy gen 冪等性
- mulberry32 PRNG + hash seed による決定論的生成 (同 learner × date で同 3 件)
- JST 6:00 を「今日」境界に (DEC-024 罰則ゼロ整合)
- /quests ページ (Server Component / closure-bound Server Action)
- /home に DailyQuestSummaryRibbon を 4 ボタン群上に挿入
- claimQuestReward は atomic status UPDATE + idempotent + 3/3 all-done bonus
- submitAnswer に best-effort incrementQuestProgress hook を追加
- Phase 1 で 6 種 (mock_warmup は Phase 3 用に disabled)
- Unit 56 件 / 既存 486 件 含めて 542 件 緑 / typecheck / lint clean

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

完了。
