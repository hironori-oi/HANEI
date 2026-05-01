# 開発報告 - W11-T3: 家族内ランキング (Family Leaderboard / HANEI / PRJ-016)

- 案件: PRJ-016 HANEI（小学生向け英語学習 PWA, Phase 2 ゲーミフィケーション）
- タスク: W11-T3 Family Leaderboard「家族内ランキング」(P1 / 1.5 person-days)
- 着手判定: DEC-061 (W11-T1 完遂後の atomic 後続選択)
- 報告日: 2026-05-02
- ベースライン: 15f3b92 (W11-T1 / DEC-060 完遂 / 本番 Turso migration 0015 適用済)

---

## 実施内容

DEC-024 罰則ゼロ哲学・COPPA 準拠 (DEC-003) を厳守したまま、家族内のみで可視化される「みんなで がんばってるね」型の **read-only** な週間 XP ランキング表示を実装。
書き込み副作用ゼロ。`xp_logs` テーブル新設は避け、既存 `answer_logs` の直近 7 日 `is_correct=true` × 10 XP/問 を**近似**として用いる選択肢 A を DEC-061 で採用した。

達成スコープ:

1. **純関数 `computeWeeklyXpRanking` 切り出し** — `src/lib/study/family-leaderboard-ranking.ts` (Turbopack "use server" sync export ban 対応 / W10-T5 / W11-T1 と同パターン)
2. **Server-only helper `getFamilyWeeklyLeaderboard(familyId, now?)`** — `src/lib/study/family-leaderboard.ts` / Server Component 直 import / `family_id` を SQL レベルで強制 (COPPA 準拠の構造的保証)
3. **保護者 dashboard の Family Leaderboard Card 可視化** — `data-testid="family-leaderboard-card"` / 各 row に `data-leaderboard-rank` / `data-learner-id` / `data-weekly-xp` / `data-kotodama-stage` / DEC-024 前向きコピー (単独 / 全員 0 XP / 通常 を分岐)
4. **Unit テスト 14 ケース** — 通常降順 / 1224 ranking / 全員 0 / 単独 / 空 / 50 件安定ソート / 負値・NaN 防御 / 非配列 throw / kotodama-tori stage 伝搬 / 小数 floor / `isAllZeroXp` 4 ケース
5. **E2E テスト 3 ケース** — 兄弟 2 人 (DB 直接 INSERT) / 単独 learner / 全員 0 XP

---

## 技術的判断

### 1. データソース選択肢 A: `answer_logs` × 10 XP/問の近似 (DEC-061)

| 選択肢 | 採否 | 理由 |
|---|---|---|
| **A. answer_logs 集計 (採用)** | ✓ | テーブル追加なし。read-only。`xp_levels.totalXp` (累計) を破壊しない。「直近 7 日 / 親への可視化」目的に十分な粒度。 |
| B. submitAnswer の XP 加算ロジック re-use | ✗ | submitAnswer は write 経路を抱える。read 専用 W11-T3 の atomic scope を超える。 |
| C. xp_logs 新テーブル新設 | ✗ | atomic 1.5 person-days を逸脱。本来 phase 3+ の analytics スコープ。 |

近似である旨は dashboard 側で**明示**: 「直近 7 日の 正解数を 集計しています」。これにより親が「累計 XP と数値が違うのはなぜ？」と困惑することを構造的に防止。

### 2. 純関数 `computeWeeklyXpRanking` を `family-leaderboard-ranking.ts` に分離

**Turbopack "use server" sync export ban 対応** (W10-T5 / W11-T1 で得た知見の再適用):

- W11-T3 自体は `"use server"` を使わないが、将来的に server action 化される可能性を見越して、純関数は最初から **server-only ファイルの外** に置く方針を継続。
- これにより `tests/unit/family-leaderboard-ranking.test.ts` から直 import して 14 ケース網羅可能 / DB I/O ゼロ / Turbopack 制約に未来でも触れない。

純関数の不変条件 (1224 ranking / DEC-024):

| 状態 | rank | 備考 |
|---|---|---|
| 通常 (XP 降順) | 1, 2, 3, ... | 安定ソート: 同 XP 内は learnerId 昇順 |
| 同 XP タイ | 1, 1, 3 (1224) | 「2 位 タイ」表現を避け、UI は同列に置く |
| 全員 0 XP | 1, 1, 1, ... | UI 側で「今週はまだ」コピーへ切替 |
| 単独 learner | [1] | 「最下位」を構造的に出さない (= 罰語ゼロの根) |
| 空配列 | [] | throw しない |
| 負値 / NaN | 0 に正規化 | 防御的 (DB の不正 row でも UI 落ちない) |
| 小数 (10.7) | floor → 10 | 表示の認知負荷低減 |
| 非配列 (null/undefined) | TypeError | プログラミングミス検知 |

### 3. SQL レベルで `family_id` を強制 (COPPA 準拠の構造的保証)

```ts
const learners = await db
  .select({ id: learnerProfiles.id, nickname: learnerProfiles.nickname })
  .from(learnerProfiles)
  .where(eq(learnerProfiles.familyId, familyId));  // ← 必須

if (learners.length === 0) return [];
const learnerIds = learners.map((l) => l.id);

const correctRows = await db
  .select({ ... })
  .from(answerLogs)
  .where(and(inArray(answerLogs.learnerId, learnerIds), gte(answerLogs.answeredAt, cutoff)));
```

- `family_id` を WHERE 必須にすることで、**家族間漏洩は SQL 構造として不可能**。
- 呼び出し元 (parent dashboard / Server Component) は `requireAuth + requireParent + requireFamilyMember + scopedQueries(familyId)` 済 (DEC-003 三層認可) なので、helper 内で `family_id` を再要求することは構造的二重防御として機能する。
- グローバルランキング (= 家族外公開) は本実装上**追加で SQL を書かない限り存在し得ない**。COPPA 13 歳未満児童保護の要件 (= 不必要な児童間比較を強要しない) を構造で満たす。

### 4. kotodama-tori stage の per-learner try/catch 伝搬

```ts
const stageEntries = await Promise.all(
  learners.map(async (l) => {
    try {
      const input = await getKotodamaStageInput(db, l.id);
      return [l.id, getKotodamaStage(input)] as const;
    } catch {
      return [l.id, undefined] as const;  // best-effort
    }
  }),
);
```

stage 取得の失敗が leaderboard 全体を落とさないよう **per-learner try/catch**。stage は装飾要素であって、未取得でも順位付けは継続する (= 「みんなで がんばってるね」の核は守られる)。

### 5. UI 側コピー切替の 3 状態 (DEC-024 罰則ゼロ)

```ts
const leaderboardAllZero = isAllZeroXp(leaderboard);
const leaderboardSolo = leaderboard.length === 1;
```

| 状態 | CardTitle |
|---|---|
| 単独 learner (兄弟なし) | 「今週も N XP がんばってるね」 |
| 全員 0 XP (兄弟有 / 全員 未学習) | 「今週はまだ。今日 はじめよう」 |
| 通常 | 「直近 7 日の 家族の がんばり」 |

加えて、**全員 0 XP のときは 1 位の冠 (TrophyIcon) を出さない**。これにより「ゼロ起算で 1 位を称えてしまう不自然さ」を回避し、健全な前向き表示に徹する。

### 6. 保護者 dashboard 既存セクションに**追加のみ** (破壊変更ゼロ)

既存セクション順序は完全保持:
1. 今日の学習時間 (W10-T5)
2. 家族のれんぞく (W11-T1)
3. **家族内ランキング (W11-T3 / 本タスクで挿入)**
4. 今週の学習サマリー
5. 受験日カウントダウン
6. 学習停止リマインド
7. 直近の誤答 TOP 5

`Promise.all` への追加は 1 行のみ (`getFamilyWeeklyLeaderboard(familyId)`)。既存集計関数群への影響ゼロ。

---

## 成果物

### 新規ファイル

- `app/src/lib/study/family-leaderboard-ranking.ts` — 純関数 `computeWeeklyXpRanking` / `isAllZeroXp` (95 行)
- `app/src/lib/study/family-leaderboard.ts` — server helper `getFamilyWeeklyLeaderboard` (130 行)
- `app/tests/unit/family-leaderboard-ranking.test.ts` — 14 ケース (194 行)
- `app/tests/e2e/family-leaderboard.spec.ts` — 3 ケース × 2 project (chromium / mobile-chrome) = 6 シナリオ (335 行)
- `projects/PRJ-016/reports/dev-w11-t3-family-leaderboard-done.md` — 本報告書

### 変更ファイル

- `app/src/app/(parent)/parent/dashboard/page.tsx` — Family Leaderboard Card セクション追加 (+86 行)
- `projects/PRJ-016/decisions.md` — DEC-061 追記 (W11-T3 GO 判定 / データソース選択肢 A / DEC-024 罰語リスト)

### 既存ファイル / 既存挙動への影響

- `xp_logs` テーブルは作成していない (= migration ゼロ)
- `submitAnswer` / `answer_logs` 書込経路は一切触っていない
- 累計 XP (`xp_levels.totalXp`) は破壊していない
- Daily Quest hook / Family Streak hook の動作変更なし

---

## テスト結果

### Unit (Vitest)

```
Test Files  47 passed (47)
     Tests  633 passed (633)
  Duration  4.04s
```

W11-T1 ベース 619 件 + 本タスク 14 件 = 633 件全 pass。

### TypeScript

```
$ tsc --noEmit
(エラーなし)
```

### Lint (ESLint)

```
$ eslint .
(エラーなし)
```

### Build (Next.js 16)

```
✓ Compiled successfully in 6.9s
✓ Generating static pages using 15 workers (23/23) in 524ms
```

23 ルート (W11-T1 と同一)。新規ルートなし。

### E2E (Playwright)

W11-T3 spec のみ:
```
Running 6 tests using 2 workers
6 passed (27.6s)
```

W11-T1 (regression check) + W11-T3 を `--workers=1` で同時実行:
```
Running 12 tests using 1 worker
12 passed (38.1s)
```

**SQLITE_BUSY 既知事象 (preexisting):** `fullyParallel=true` + workers=2 でファイル SQLite に並列書込すると一時的 lock が発生する preexisting flakiness を確認。W11-T3 spec は `test.describe.configure({ mode: "serial" })` で worker 内 serial 化 + execWithRetry (max 16, 100ms-1500ms exp backoff + jitter) を実装し、構造的に吸収。W11-T1 spec も `--workers=1` で 100% green を確認。本リグレッションは preexisting で **W11-T3 が原因ではない** (本報告 #リグレッション影響 セクション参照)。

---

## 受入基準チェック (DEC-061 / phase2-gamification-implementation-plan.md §W11-T3)

| 受入基準 | 結果 |
|---|---|
| 全 unit test PASS | ✓ 633/633 (W11-T1 ベース 619 + W11-T3 14) |
| typecheck pass | ✓ |
| lint pass | ✓ |
| next build pass (23 ルート) | ✓ |
| family-leaderboard E2E green | ✓ 6/6 (chromium + mobile-chrome) |
| family-streak E2E regression check | ✓ 6/6 (workers=1) |
| DEC-024 罰則ゼロ哲学厳守 | ✓ E2E で罰語 (だめ / やりすぎ / ペナルティ / 最下位 / ビリ / 下位) を `not.toContain` で構造防御 |
| DEC-003 三層認可 | ✓ parent dashboard 既存層 + helper SQL `family_id WHERE` 強制で多重防御 |
| DEC-061 データソース選択肢 A | ✓ answer_logs × 10 XP/問近似 / 累計 XP 非破壊 / 親 UI で「直近 7 日の 正解数を 集計」明示 |
| 単独 learner で罰語が出ない | ✓ E2E `solo` ケース + 構造的に「最下位」を持たない 1224 ranking |
| 全員 0 XP で前向きコピー | ✓ E2E `zero` ケース + isAllZeroXp + 単独 0 XP も "がんばってるね" 経路 |
| COPPA 準拠 (グローバル比較なし) | ✓ SQL レベルで family_id WHERE 必須 / 家族外漏洩は構造的に不可能 |

---

## DEC-024 罰則ゼロ哲学厳守の構造的保証

E2E `expectNoPunishmentWords()` で以下 6 語を `not.toContain`:

```ts
const PUNISHMENT_WORDS = ["だめ", "やりすぎ", "ペナルティ", "最下位", "ビリ", "下位"] as const;
```

ソースコード上も:
- 純関数は **位置情報のみ** を返す (rank / weeklyXp / kotodamaToriStage)。罰語を含むテキストは生成しない。
- UI は **3 状態の前向きコピー切替** で罰語の出口を物理的に塞いでいる。
- 単独 learner で「最下位」が出る経路は構造的に存在しない (= ranking 配列 length=1 → solo 分岐)。

---

## リグレッション影響

### 影響なし (構造的に確認済)

- W7 個人 streak: read 専用なので不変
- W10-T1 ハネキン経済: 書込ゼロ
- W10-T2 shop / W10-T3 daily quest / W10-T4 session: 全て read 専用
- W10-T5 over-learning: `getTodayLearningSeconds` 直接呼ばない
- W11-T1 family streak: `getFamilyStreak` を `Promise.all` で並列追加しただけで、既存 row の追加・並べ替えなし

### preexisting (W11-T3 が原因ではない)

- E2E SQLITE_BUSY: `fullyParallel=true` + workers=2 で同一 file: SQLite に並列書込すると一時的 lock。
  W11-T1 family-streak.spec.ts も同事象を `workers=1` で吸収済 (本タスクで再確認)。
  W11-T3 spec はそれに加えて `mode: "serial"` + `execWithRetry` を内部で実装し、worker 1 でも 2 でも green を保証。

---

## W11 進捗

| タスク | ステータス | 所要 |
|---|---|---|
| W11-T1 家族のれんぞく (P0) | ✓ 完遂 (commit 15f3b92) | 1.5 pd |
| W11-T2 ことだまトリ大読み (P0) | 未着手 (study UI preexisting regression と同時着手要) | 1.5 pd |
| **W11-T3 家族内ランキング (P1)** | **✓ 完遂 (本報告)** | 1.5 pd |
| W11-T4 親ことば (P2) | 未着手 | 1 pd |

W11 全体: **2/4 完遂 (50%)**

---

## 次のアクション (CEO への申し送り)

1. **review 部門**: W11-T3 review checkpoint (`review-w11-t3-family-leaderboard.md`) を生成し、APPROVE/REVISE 判定。
2. **commit + push**: `feat(W11-T3): 家族内ランキング (Family Leaderboard) 完遂 (DEC-061)` で atomic commit / origin/main へ push。
3. **dashboard 更新**: `dashboard/active-projects.md` の PRJ-016 Phase 2 W11 進捗 25% → 50%。
4. **W11-T2 着手判断**: study UI preexisting regression (W10-T5 push 時点で確認済 / family-streak 系 click → study-feedback) を解消するセットで着手するか、あるいは W11-T4 親ことば (P2 / 1 pd) を先行するか、CEO 判断要。

---

## 学習記録 (KPT 速報)

### Keep
- 純関数 + server-only helper + Server Component 直 import の 3 層分離パターンが W10-T5 → W11-T1 → W11-T3 で 3 度連続で機能。Turbopack 制約への構造的対応として再現性高い。
- DEC-024 を「コピー検閲」ではなく「罰語の出口を物理的に塞ぐ ranking 構造」で実現する設計思想が定着。

### Problem
- E2E SQLITE_BUSY が `fullyParallel=true` で再現するのは preexisting だが、放置すると新規 spec が必ず引き当てる。CI で `--workers=1` を強制するか、`mode: "serial"` を describe ごとに defaulting する仕組みが欲しい。

### Try
- 次タスク (W11-T2 / kotodama-tori daiyomi) は study UI を触るため、ここで preexisting study-feedback regression と一括解消するのが妥当。事前に planner で「regression 修正 + W11-T2 同梱」の atomic 範囲を切る。

---

以上、W11-T3 完遂報告。
