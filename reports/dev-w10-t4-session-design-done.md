# Dev W10-T4: 5-7 分セッション自動設計 実装 完了レポート

- 案件: PRJ-016 HANEI
- スコープ: W10-T4 (セッション設計 + 完了演出 + W10-T3 review minor M-1/M-2/M-4 同梱)
- 日付: 2026-04-30
- 担当: Dev (Claude)
- 方針: AI 呼び出しゼロ / 純関数 + Client Component / 1 atomic commit / 既存 W10-T1/T2/T3 を壊さない / 三層認可 / 罰則ゼロ哲学

---

## 1. サマリー

W10-T4 の「5-7 分セッション自動設計」を以下 3 軸で実装:

1. **純関数 `composeStudySession`**: `(learnerId, durationMinutes, now)` から (learner, day, duration) で deterministic に planSize と review:fresh:weakness 構成比を返す。Phase 2 plan §W10-T4 の問題数表 (5 分 = 5-8 / 7 分 = 8-12 / 10 分 = 12-18) を内部 variant table で展開し、mulberry32 + cyrb53 派生 hash で variant を選ぶ。
2. **`/study` Server Component + `SessionPicker` Client Component**: 三層認可 → SessionPicker (Heroicons / 56px tap / ふりがな-ready) → click で `?dur=&session=<uuid>` 付き URL に遷移。「いつもの長さでいい」を `useSyncExternalStore` で localStorage 購読。
3. **セッション完了演出**: `SessionCompleteModal` を新設し、StudyClient に session prop を opt-in で導入。planSize 到達 (= natural) / 「ここまでにする」(= abort) / 経過時間 +50% 超え (= overtime offer) で適切なコピー / confetti で表示。strict shutdown はせず罰則ゼロ整合を維持。

同梱 minor (W10-T3 review):
- **M-1**: `tests/e2e/quests.spec.ts` test 1 を「signup → /home の段階で既に 3 件 lazy gen 済」「/quests 遷移後も同 id 集合」spec に修正
- **M-2**: `drizzle/0013_w10_coin_idempotency_unique.sql` 追加 (DEC-055 補強 / coin_transactions partial UNIQUE INDEX)
- **M-4**: `/home/page.tsx` の `getOrGenerateTodayQuests` を `.catch(...) → null fallback` でガードし、リボン表示も `questSummary &&` で gating

unit テスト 31 件 (新規 1 ファイル) + 既存 unit 全 542 件 緑通し (合計 573 件)。typecheck / lint clean。Playwright list 62 ケース。

罰則ゼロ哲学整合:
- 1 問もできなくても完了 modal は「きょうも きてくれて ありがとう」
- overtime は「もうすこし やる」「おしまいに する」両方を提示し強制終了しない
- planSize 到達時もユーザは router.push("/home") かどうかを自分で選ぶ

---

## 2. 変更ファイル

### 新規追加
- `drizzle/0013_w10_coin_idempotency_unique.sql` (M-2)
  - `coin_transactions(learner_id, reason, reference_id) WHERE reference_id IS NOT NULL` partial UNIQUE INDEX
- `src/lib/study/session-composer.ts`
  - `SessionDurationMinutes` (5|7|10) / `SESSION_DURATION_OPTIONS` / `isSessionDurationMinutes`
  - `getSessionCopy` (子ども向け headline / subtext / aria-label)
  - `SESSION_OVERTIME_RATIO` (= 0.5) / `hasReachedOvertime`
  - `PLAN_VARIANTS` 内部 table (5 分 = 4 / 7 分 = 5 / 10 分 = 7 variant)
  - `composeStudySession({learnerId, durationMinutes, now})` (純関数)
  - `summarizeSession(answers, earnedCoins)` (純関数)
  - `LAST_SESSION_DURATION_STORAGE_KEY` / `readLastSessionDurationFromStorage` / `writeLastSessionDurationToStorage`
- `src/components/study/SessionPicker.tsx` (Client Component)
- `src/components/study/SessionCompleteModal.tsx` (Client Component)
- `src/app/(app)/study/page.tsx` (Server Component / 三層認可)
- `tests/unit/study.session-composer.test.ts` (31 cases)

### 修正
- `src/app/(app)/study/[levelCode]/[skillCode]/page.tsx`
  - `searchParams` から `?dur=` / `?session=` を解釈 (optional / 後方互換)
  - StudyClient に session-related props を渡す (planSize は server で `composeStudySession` 計算)
- `src/app/(app)/study/[levelCode]/[skillCode]/StudyClient.tsx`
  - session prop (sessionDurationMinutes / sessionPlanSize / sessionId) を optional 追加
  - sessionAnswers / sessionEarnedCoins を内部集計
  - planSize 到達 / 「ここまで」/ overtime で `SessionCompleteModal` を起動
  - sessionActive 中は LessonCompleteModal の自動起動を抑制 (重複を回避)
- `src/app/(app)/home/page.tsx` (M-4)
  - `getOrGenerateTodayQuests(learner.id)` を `.catch(err => { console.error(...); return null; })` で wrap
  - `questSummary === null` 時はリボン非表示 + `questClaimableCount` も 0 に倒す
  - メイン CTA を `/study?learner=<id>` へ変更し時間選択を経由 (既存 `/study/eiken-N/vocab` 直リンクは outline ボタンとして残置)
- `tests/e2e/quests.spec.ts` (M-1)
  - test 1 を「signup → /home で既に 3 件 / /quests 遷移後も同 id 集合」spec に書き直し
- `tests/e2e/fixtures/db-fixture.ts` (M-2)
  - migration list に `0013_w10_coin_idempotency_unique.sql` を追加

---

## 3. 主要 diff のポイント

### 3-1. PLAN_VARIANTS table (deterministic / AI ゼロ)

Phase 2 plan §W10-T4 の問題数 / 構成比範囲を以下の table に展開:

| duration | variant | planSize | review : fresh : weakness |
|---|---|---|---|
| 5 分 | 4 種 | 5 / 6 / 7 / 8 | 2:2:1 〜 3:3:2 |
| 7 分 | 5 種 | 8 / 9 / 10 / 11 / 12 | 3:3:2 〜 5:4:3 |
| 10 分 | 7 種 | 12 / 13 / 14 / 15 / 16 / 17 / 18 | 5:4:3 〜 7:6:5 |

不変条件: `planSize === ratio.review + ratio.fresh + ratio.weakness` (unit test 各 variant で検証)。

### 3-2. 決定論性 (mulberry32 + cyrb53)

- seed = `hashStringToUint32("session|<learnerId>|<duration>|<localDateString>")`
- PRNG = `mulberry32(seed)` → `idx = floor(rng() * variants.length)`
- 同 (learner, day, duration) → 同 variant (再現性 100%)
- 学習者違い / 日付違いで異なる variant が出るので飽き防止 (unit test で実証)

### 3-3. SessionPicker / 「いつもの長さで」 (useSyncExternalStore)

`useEffect` 内 setState は `react-hooks/set-state-in-effect` lint rule に抵触するため、
`useSyncExternalStore(subscribe, getSnapshot, () => null)` で localStorage を購読。
これにより:
- SSR 時は `null` (server snapshot)
- client では `storage` event を購読して他タブの変更にも反応
- effect 内 cascading render 不発生

### 3-4. SessionCompleteModal の 3 reason

| reason | trigger | confetti / sound | コピー | 主 CTA |
|---|---|---|---|---|
| `natural` | planSize 到達 | yes (problemsAnswered + accuracy で intensity 決定) | 「とてもよく がんばったね」 | ホームへ もどる |
| `abort` | 「ここまでにする」CTA | yes (light) | 「きょうも 1 つ ふえたね」 | ホームへ もどる |
| `overtime` | 経過時間 ≥ duration*1.5 (5 秒間隔 polling / 1 回限り提案) | なし (offer 段階) | 「もうすこしだけ できる？」 | もうすこし やる / おしまいに する |

DEC-024 罰則ゼロ哲学に整合: 0 問でも責めず、不正解多くても「ことだまトリも うれしそう」のみ。

### 3-5. M-4: /home の quest 生成失敗ガード

review M-4 で指摘された「`getOrGenerateTodayQuests` 失敗 → /home 全体 500」の SPOF を以下で解消:

```ts
getOrGenerateTodayQuests(learner.id).catch((err) => {
  console.error("[home] getOrGenerateTodayQuests failed:", err);
  return null;
}),
```

`questSummary === null` の場合は:
- `questClaimableCount = 0`
- `<DailyQuestSummaryRibbon>` セクション自体を表示しない (`{questSummary ? <section>...</section> : null}`)

---

## 4. 既存機能との互換性

- **/study/[levelCode]/[skillCode]** の Phase 1 直リンク (= `?dur=` / `?session=` 無し) は引き続き動作。session-related props は全て optional で、`sessionActive === false` のフォールバック路で従来挙動 (LessonCompleteModal は維持)。
- **W10-T3 ハネキン獲得経路** に変更なし。LESSON_CORRECT (=2) / QUEST_COMPLETE (=15) / QUEST_ALL_DONE (=30) はそのまま server-of-truth。SessionCompleteModal の `earnedCoins` は client 側の表示用一時集計 (server 集計と微差あり得る = 通信遅延などで)。
- **三層認可** ( `requireAuth` → `getFamilyIdForUser` → `requireLearnerOwner` ) は `/study` 新ページに継承。

---

## 5. 品質ゲート結果

- `npx tsc --noEmit`: clean
- `npm run lint`: clean (warning / error なし)
- `npm run test -- --run`: 573 / 573 passed (新規 31 + 既存 542)
- `npx playwright test --list`: 62 tests / 10 files (E2E 実行は CEO 判断後)

---

## 6. 残課題 / W10-T5 引き継ぎ

- **永続化 (study_sessions テーブル)**: optional 扱いで本コミットには含めず。Phase 2 後半 (W11+) で「セッション履歴 / 振り返り」機能と一緒に扱う方が DB 変更を最小化できると判断。
- **「最近のセッションをもう一度」**: localStorage の lastDuration のみで端末跨ぎ非対応 (Phase 1 OK)。アカウント単位永続化は Phase 2 で `learner_preferences` 拡張案。
- **session_id を answer_logs に紐付け**: 現状 URL を伝搬するのみで DB に書いていない。W10-T5 で `answer_logs.session_id` を増やすと「セッション内正答率」分析が可能。
- **「ここまでにする」アボート時のハネキン取消なし**: server-of-truth は LESSON_CORRECT のみで、クライアント中断はサーバ側に何も飛ばないため取消不要。
- **テキスト ↔ 音声切替**: K-2 ふりがな対応は SessionPicker / SessionCompleteModal とも `<ruby>` 箇所はないが、headline/subtext は全てひらがなで構成済 (低学年互換)。読み上げは aria-label に半角数字を埋めて支援。

---

## 7. 罰則ゼロ哲学 (DEC-024) 整合チェックリスト

- [x] 否定形コピーなし (lint regex `/(ない|だめ|失敗|やめろ)/` を unit test で検査)
- [x] 連続日数を減らさない / マイナス pop なし
- [x] overtime は強制終了せず「もうすこし」を選べる
- [x] 0 問完了でも称賛コピー
- [x] 不正解 0 でも責めない
- [x] 課金導線ゼロ (DEC-006 / DEC-012 維持)
