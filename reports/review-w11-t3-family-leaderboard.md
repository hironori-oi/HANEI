# レビュー結果 - W11-T3 家族内ランキング Family Leaderboard (HANEI / PRJ-016)

- 案件: PRJ-016 HANEI（小学生向け英検 PWA / Phase 2 ゲーミフィケーション）
- タスク: W11-T3 Family Leaderboard「家族内ランキング」(P1 / 1.5 person-days)
- レビュー日: 2026-05-02 (CEO 経由)
- レビュー対象: projects/PRJ-016/reports/dev-w11-t3-family-leaderboard-done.md + projects/PRJ-016/app/ 実体 (uncommitted)
- ベースライン: 15f3b92 (W11-T1 / DEC-060 完遂 / 本番 Turso migration 0015 適用済)
- 着手判定: DEC-061

## 総合判定

**APPROVE** — main push 推奨。

DEC-061 で確定した受入基準 7 項目を全て満たし、DEC-024 罰則ゼロ哲学 / DEC-003 三層認可 + COPPA / DEC-061 データソース選択肢 A / DEC-055 idempotency (read-only による構造的成立) の 4 大設計原則を構造レベル（純関数 + server-only helper の分離 / SQL レベル `family_id WHERE` 強制 / 1224 ranking で「最下位」経路ゼロ / DB write 0 件で `xp_levels.totalXp` 非破壊）で保全している。Critical / Major 指摘なし。後続吸収可能な Minor 改善余地のみ M-1〜M-4 として列挙する（push の阻害要因ではない）。

レビュー側で `bun run typecheck` (0 errors) / `bun run lint` (0 warnings) / `bun run test` (**47 files / 633 tests PASS / 3.78s**) / `bun run build` (✓ 23 routes / Turbopack production) / `bun run e2e tests/e2e/family-leaderboard.spec.ts` (**6/6 PASS / 27.7s**) / `bun run e2e tests/e2e/family-streak.spec.ts --workers=1` (**6/6 PASS / 30.7s**) を再実行し、全グリーンを確認済（dev 報告と完全一致）。

---

## チェック結果（受入基準 / DEC-061）

| # | 項目 | 結果 | 備考 |
| --- | --- | --- | --- |
| 1 | vitest 全件 PASS（W11-T1 時点 619 + 新規 14 = 633）| OK | レビュー側で再実行 → **47 files / 633 tests PASS / 3.78s**。`tests/unit/family-leaderboard-ranking.test.ts` は **14 ケース** (computeWeeklyXpRanking 10 + isAllZeroXp 4) |
| 2 | typecheck **0 errors** / lint **0 errors / 0 warnings** / next build OK (23 routes) | OK | `bun run typecheck` / `bun run lint` clean を再確認。`bun run build` も `✓ Compiled successfully in 5.8s` / `Generating static pages 23/23` |
| 3 | family-leaderboard E2E green | OK | `bun run e2e tests/e2e/family-leaderboard.spec.ts` → **6/6 PASS / 27.7s** (chromium + mobile-chrome × 3 ケース)。dev 報告と一致 |
| 4 | family-streak E2E に regression なし | OK | `bun run e2e tests/e2e/family-streak.spec.ts --workers=1` → **6/6 PASS / 30.7s**。W11-T1 の 3 ケース × 2 project が引き続き green。本タスクの Promise.all 並列追加は既存 row 操作を壊していない |
| 5 | 保護者 dashboard で `data-leaderboard-rank` / `data-learner-id` / `data-weekly-xp` / `data-kotodama-stage` 属性表示 | OK | `src/app/(parent)/parent/dashboard/page.tsx:285-348` で `data-testid="family-leaderboard-card"` 配下に 4 種属性を出力 |
| 6 | DEC-024 / DEC-003 + COPPA / DEC-061 / DEC-055 厳守 | OK | 詳細は下記「重点レビュー結果 A〜E」参照 |
| 7 | 既存ロジック非破壊（W7 個人 streak / W11-T1 家族 streak / `xp_levels.totalXp` 累計 XP / `submitAnswer` write 経路）| OK | `family-leaderboard*.ts` に `db.insert` / `db.update` / `db.delete` は **0 hit**（grep 確認）。schema 変更ゼロ（migration 0015 までで停止 / 新規 0016 なし）。Promise.all への 1 行追加のみで既存 5 並列 → 6 並列 |

---

## DEC 整合性チェック表

| DEC | 内容 | 評価 | 担保箇所 |
| --- | --- | --- | --- |
| DEC-024 | 罰則ゼロ哲学 | **構造的に準拠** | (1) 純関数 `computeWeeklyXpRanking` は `rank` プロパティ (位置情報) のみ生成。罰メッセージは構造的に出口を持たない / (2) 1224 ranking で「最下位」概念が定義されない（同 XP は同順位 / 単独 learner は `[1]` / 全員 0 XP は全員 `1`）/ (3) UI 側コピー切替 3 状態 (solo / allZero / 通常) で罰語の出口を物理的に塞ぐ / (4) 全員 0 XP のとき 1 位の冠 (`TrophyIcon`) を出さない (`isFirst = row.rank === 1 && !leaderboardAllZero`) で「ゼロ起算で 1 位を称える不自然さ」を回避 / (5) E2E 3 ケース全てで罰語 6 種 (`だめ` / `やりすぎ` / `ペナルティ` / `最下位` / `ビリ` / `下位`) を `not.toContain` で機械化 / (6) ソース全文 grep で UI 表示への罰語混入 0 hit (ヒットは全てコメント・AI prompt 禁止語・W11-T3 のコード解説のみ) |
| DEC-003 + COPPA | 三層認可 + 児童間比較の構造防御 | **強く準拠** | (1) 第 1 層 `requireAuth` / 第 2 層 `requireParent` + `requireFamilyMember` / 第 3 層 SQL で `eq(learnerProfiles.familyId, familyId)` を **必須**（`family-leaderboard.ts:73-76`）/ (2) `learner_id IN family_scope` への絞り込みは前段の learner 一覧 SELECT で family_id 絞り込み済の `learnerIds` のみを `inArray` に渡す → グローバル ranking が SQL レベルで構築不可能 / (3) 呼び出し元 (parent dashboard) が `requireLearnerOwner` も通過済で **多重防御** / (4) `// eslint-disable-next-line no-restricted-syntax -- family_id 単一スコープ済 (DEC-003 / DEC-061)` コメントが「scoped query 経由ではない理由」を明示しレビュー証跡として有効 |
| DEC-061 | データソース選択肢 A (answer_logs × 10 XP/問近似) | **準拠** | (1) `LEADERBOARD_XP_PER_CORRECT = 10` 定数化（`family-leaderboard.ts:36`）/ (2) `answer_logs.is_correct=true` カウント × 10 = 週間 XP 近似値。`xp_levels.totalXp` テーブルへの touch 0 hit / (3) 親 UI に「直近 7 日の 正解数を 集計しています」と**明示**（`dashboard/page.tsx:354`）/ (4) 「累計 XP と数値が違うのはなぜ？」という保護者の困惑を構造防止 |
| DEC-055 | idempotency（read-only による構造的成立） | **構造的に準拠** | (1) `family-leaderboard*.ts` は **DB write メソッドを 1 つも持たない**（`db.insert` / `db.update` / `db.delete` 全 0 hit）/ (2) read-only ゆえ「同日 N 回呼んでも DB 状態不変」が型レベルで保証 / (3) `submitAnswer` への hook 追加もなし → 書込経路に副作用ゼロ |
| DEC-061 (受入基準) | family_id WHERE / kotodama-tori stage 同梱 / 単独 / 全員 0 XP / 1224 ranking | **準拠** | unit 14 ケースで純関数の不変条件 (1224 / 同 XP 同順位 / 単独 / 全員 0 / 空 / 50 件安定 / 負値 NaN 防御 / 非配列 throw / kotodama-tori stage 伝搬 / 小数 floor) + isAllZeroXp 4 ケース全網羅。E2E 3 ケース (chromium + mobile-chrome × 3 = 6) で UI レイヤ可視化を確認 |

---

## 重点レビュー結果

### A. 純関数 `computeWeeklyXpRanking` の不変条件（罰語出口の構造的封鎖）

**評価: 強く準拠（1224 ranking で「最下位」概念が定義されない）**

#### A-1. 1224 ranking 実装の正確性

`family-leaderboard-ranking.ts:84-92`:

```ts
let lastXp = Number.NaN;
let lastRank = 0;
sorted.forEach((row, idx) => {
  const rank = row.weeklyXp === lastXp ? lastRank : idx + 1;
  ranked.push({ ...row, rank });
  lastXp = row.weeklyXp;
  lastRank = rank;
});
```

- 同 XP は前 row の rank を引き継ぎ、異なれば `idx + 1` で再計算 = 1224 ranking (1, 1, 3) の正準実装。
- `lastXp = NaN` 初期化により最初の row は必ず `idx + 1 = 1` を取る（NaN ≠ 任意値）。
- unit `同 XP は同順位 (1224 ranking)` ケースで `[1, 1, 3]` を assert 済。

#### A-2. 単独 learner ケースの構造保証

- `family-leaderboard-ranking.ts:84-92` の forEach は配列 length=1 のとき `idx=0` → `lastRank=0` → `lastXp=NaN ≠ row.weeklyXp` → `rank = 0 + 1 = 1` を必ず返す。
- **「最下位」概念は 1224 ranking 上に定義されない**（rank=1 のみ）。罰語の出口が構造的に存在しない。
- unit `単独 learner は 1 位 (罰語ゼロ)` ケース + E2E `単独 learner` ケース で機械化。

#### A-3. 全員 0 XP の「全員 1 位」化

- `weeklyXp` が全員 0 → 安定ソート後も全員 `weeklyXp=0` → 最初の row が `lastXp=NaN` → `rank=1`、以降同 XP なので全員 `lastRank=1` を引き継ぐ。
- UI 側 `isAllZeroXp(leaderboard)` 判定で「今週はまだ。今日 はじめよう」へコピー切替 + 1 位の冠 (`TrophyIcon`) を抑止 (`!leaderboardAllZero` ガード)。
- unit `全員 0 XP でも rank は 1, 1, 1` ケースで assert 済。

#### A-4. 防御的正規化の網羅性

`family-leaderboard-ranking.ts:62-75`:

| 入力 | 正規化先 | unit ケース |
| --- | --- | --- |
| 負値 (`-5`) | `0` | `負値 / NaN weeklyXp は 0 へ正規化` |
| `NaN` | `0` | 同上 |
| 文字列 `weeklyXp` | `0` (Number.isFinite で false) | 上記ケースで型キャスト経由でカバー |
| 小数 (`10.7`) | `Math.floor(10.7) = 10` | `小数 XP は floor 正規化` |
| `null` / `undefined` rows | `TypeError` throw | `非配列入力は throw` |
| 空配列 | `[]` (例外なし) | `空配列は空配列を返す` |
| `r === null` などの個別 falsy row | `filter` で除外 | 上記の防御フィルタで暗黙カバー |

防御の意図がコメントで明記され、不正 DB row が混入しても UI が落ちない設計。

#### A-5. 安定ソートの再現性

- `sort((a, b) => b.weeklyXp - a.weeklyXp || a.learnerId.localeCompare(b.learnerId))` で同 XP 内は learnerId 昇順固定。
- unit `大量 row (50 件) でも安定ソート` で 50 件のシード入力で再現性確認。
- レビュー上の懸念: V8 の `Array.prototype.sort` は ES2019 以降 stable だが、本実装は **明示的に同 XP 内 tie-breaker を持つ** ため V8 実装に依存しない。OK。

### B. `getFamilyWeeklyLeaderboard` の COPPA 構造防御 (DEC-003)

**評価: 強く準拠（SQL レベルで `family_id` 必須）**

#### B-1. 二段階 SELECT の絞り込み連鎖

`family-leaderboard.ts:71-94`:

```ts
// 1) family の learner 一覧 (family_id WHERE 必須)
const learners = await db
  .select({ id: learnerProfiles.id, nickname: learnerProfiles.nickname })
  .from(learnerProfiles)
  .where(eq(learnerProfiles.familyId, familyId));

if (learners.length === 0) return [];
const learnerIds = learners.map((l) => l.id);

// 2) 直近 7 日の answer_logs (learner_id IN family scope)
const correctRows = await db
  .select({ ... })
  .from(answerLogs)
  .where(and(inArray(answerLogs.learnerId, learnerIds), gte(answerLogs.answeredAt, cutoff)));
```

- 第 1 SELECT で `family_id = ?` により learner ID を family scope に絞る。
- 第 2 SELECT は第 1 SELECT で絞った `learnerIds` のみを `inArray` に渡す → **構造的に他家族の answer_logs に到達不可能**。
- `learners.length === 0` の早期 return により family 不在時の `inArray([])` SQL が発行されない (drizzle は `inArray` 空配列を `0=1` 等価に変換するが、念のため早期 return で意図を明示)。

#### B-2. 認可スコープの呼び出し元と関数内の役割分担

- `getFamilyWeeklyLeaderboard` 自体は `requireAuth` を内蔵せず、呼び出し元 (parent dashboard) で `requireParent` + `requireFamilyMember` + `requireLearnerOwner` を通過済の `familyId` のみを受ける設計（W11-T1 `getFamilyStreak` と同パターン）。
- 関数内の SELECT は `eq(learnerProfiles.familyId, familyId)` を必須にしているため、誤って認可前の任意 familyId を渡されても **第 3 層 SQL 認可で family scope に絞り込まれる**。
- `// eslint-disable-next-line no-restricted-syntax -- family_id 単一スコープ済 (DEC-003 / DEC-061)` コメントがレビュー証跡として有効。

#### B-3. familyId 入力検証

`family-leaderboard.ts:59-61`:

```ts
if (!familyId || typeof familyId !== "string") {
  throw new TypeError("[family-leaderboard] familyId is required");
}
```

- 空文字 / null / undefined / 非 string を弾く防御。プログラミングミスで「全家族の leaderboard」を誤発行する経路を構造的に塞ぐ。

### C. データソース選択肢 A (DEC-061) の正確性と非破壊性

**評価: 良好（read-only / 累計 XP 非破壊 / 親への近似明示）**

#### C-1. 非破壊性の構造保証

- `family-leaderboard*.ts` 全 2 ファイルに対し `db.insert` / `db.update` / `db.delete` を全文 grep → **0 hit**。
- `xp_levels.totalXp` への参照ゼロ → 累計 XP は破壊し得ない。
- migration ファイルも `0016_*` が **存在しない**（drizzle/ ディレクトリは 0015 までで停止）= schema 変更ゼロ。
- `submitAnswer` への hook 追加もなし → 書込経路への副作用ゼロ。

#### C-2. 7 日 window の境界整合

`family-leaderboard.ts:64-69`:

```ts
const today = getJstQuestDate(now ?? new Date());
const todayStartUtc = jstQuestDayStartUtc(today);
const cutoff = new Date(
  todayStartUtc.getTime() - (LEADERBOARD_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000,
);
```

- W10/W11 で確立した `getJstQuestDate` + `jstQuestDayStartUtc` 連携を再利用。
- `WINDOW_DAYS - 1` (= 6 日前) を引くことで **「今日含む 7 日間」** を表現（5/2 実行時 → cutoff = 4/26 JST 6:00 UTC = 4/25 21:00 UTC）。
- `gte(answeredAt, cutoff)` で境界跨ぎでも JST 6:00 を起点に正確に切り出される。
- レビュー上、本タスクは window 計算 unit が独立では存在しないが、W11-T1 で `previousQuestDate` / `getJstQuestDate` の境界 unit が複数存在し再利用 = 既存 unit でカバーされる。

#### C-3. 近似値である旨の親 UI 明示

- `dashboard/page.tsx:354`: 「直近 7 日の 正解数を 集計しています。みんなで つみあげていきましょう (DEC-024 罰則ゼロ)。」
- これにより親が「累計 XP と数値が違うのはなぜ？」と困惑することを構造的に防止。
- DEC-061 §dev へのブリーフ要点 5 「家族設定 ON/OFF は P1 として Phase 2 完遂後の polish に回す」は本タスク外で OK。

### D. Turbopack "use server" sync export 制約 / モジュール分離

**評価: 準拠（W10-T5 / W11-T1 で確立した分離パターンの 3 度目の再適用）**

| ファイル | 用途 | "use server" 配置 | sync export |
| --- | --- | --- | --- |
| `family-leaderboard-ranking.ts` | 純関数 | **なし** | OK (sync export 可) |
| `family-leaderboard.ts` | server-only helper | **なし** | OK (async export のみ / Server Component 直 import 可) |
| `(parent)/parent/dashboard/page.tsx` | Server Component | （Server Component 暗黙 server 境界） | dynamic 認可境界で OK |

- W11-T3 自体は `"use server"` ファイルを新規追加していないが、将来的に server action 化する可能性を見越して **純関数を最初から server-only ファイルの外に分離** する W10-T5 / W11-T1 確立済パターンを再適用。
- これにより `tests/unit/family-leaderboard-ranking.test.ts` から純関数を直 import して 14 ケース網羅可能 / DB I/O ゼロ / Turbopack 制約に未来でも触れない。
- レビュー側で `bun run build` を実行 → Turbopack production build 成功 (✓ 23 routes / Compiled in 5.8s)。

### E. UI 側コピー切替 3 状態（DEC-024 罰則ゼロの最終出口）

**評価: 良好（罰語の出口を物理的に塞ぐ 3 状態分岐 + 1 位の冠抑止）**

`dashboard/page.tsx:285-358` の Family Leaderboard Card:

| 状態 | 判定式 | CardTitle | 1 位の冠 |
| --- | --- | --- | --- |
| 単独 learner | `leaderboardSolo = leaderboard.length === 1` | 「今週も {N} XP がんばってるね」 | 表示 (本人を称える / 比較対象なし) |
| 全員 0 XP | `leaderboardAllZero = isAllZeroXp(leaderboard)` | 「今週はまだ。今日 はじめよう」 | **抑止** (`isFirst = row.rank === 1 && !leaderboardAllZero`) |
| 通常 | 上記 2 つ以外 | 「直近 7 日の 家族の がんばり」 | 1 位のみ表示 |

- **3 状態判定の独立性**: solo は length=1 でのみ true / allZero は 0 件 + 全員 0 で true / 通常は両方 false。drift しない。
- **冠抑止の意図**: 全員 0 XP のときに 1 位の TrophyIcon を出すと「ゼロ起算で 1 位を称える」不自然さを生むため、`!leaderboardAllZero` でガード。健全な前向き表示に徹する。
- **per-row attribute 完備**: `data-leaderboard-rank={row.rank}` / `data-learner-id={row.learnerId}` / `data-weekly-xp={row.weeklyXp}` / `data-kotodama-stage={row.kotodamaToriStage ?? ""}` で E2E hook を機械的に提供。
- **aria-label 完備**: `<ol aria-label="家族の 週間 XP ランキング">` / `<li aria-label="${rank} 位: ${nickname}、今週 ${weeklyXp} XP">` で screen reader 読み上げが意味的に完結。
- **K-1 / K-2 (小学生向け UX 規範) 親 UI 緩和準拠**: 「がんばってるね / みんなで がんばってるね / 今週はまだ。今日 はじめよう」と平仮名中心 = 子供がのぞき見ても破壊的でない。

### F. per-learner try/catch による best-effort 化 (kotodama-tori stage)

**評価: 良好（stage 取得失敗が leaderboard 全体を落とさない）**

`family-leaderboard.ts:107-117`:

```ts
const stageEntries = await Promise.all(
  learners.map(async (l) => {
    try {
      const input = await getKotodamaStageInput(db, l.id);
      return [l.id, getKotodamaStage(input)] as const;
    } catch {
      return [l.id, undefined] as const;
    }
  }),
);
```

- stage は装飾要素であって順位付けの本質ではないため、取得失敗で `undefined` を返し leaderboard 全体は継続。
- `Promise.all` で並列化されているが各 promise が個別 try/catch で守られているため、1 件の失敗が全体を reject しない。
- UI 側 `stageLabel = row.kotodamaToriStage ? getKotodamaStageLabel(...) : null` で undefined を許容（`{stageLabel ? <span>... : null}`）。
- レビュー上、`getKotodamaStageInput` が DB connection エラーで全 learner 失敗するケースでも leaderboard 自体は順位 + XP 表示が継続する。

### G. E2E 戦略の妥当性（W11-T1 と同パターン / SQLITE_BUSY 構造的吸収）

**評価: 妥当（unit 14 + E2E 3 で defense-in-depth / preexisting flakiness の構造的吸収）**

#### G-1. write path 不在の代替カバレッジ

- DEC-061 §dev へのブリーフ要点で「W11-T3 は read-only / E2E は DB 直セット → 親 dashboard 表示」が明示済。
- 純関数 `computeWeeklyXpRanking` の 14 ケース + isAllZeroXp 4 ケース = **18 unit ケース** で write path を持たない構造の正確性を保証。
- SQL 経路 (`getFamilyWeeklyLeaderboard`) は drizzle layer + SQL レベル `family_id WHERE` 強制で構造的に保全。

#### G-2. SQLITE_BUSY 既知 flakiness の構造的吸収

`tests/e2e/family-leaderboard.spec.ts:72-87`:

```ts
async function execWithRetry<T>(fn: () => Promise<T>, maxAttempts = 16): Promise<T> {
  // SQLITE_BUSY / database is locked のときのみ exp backoff (100ms 〜 1500ms / jitter 付き) で retry
  // 最大 16 回試行 → 約 数秒の retry budget
}
```

加えて `test.describe.configure({ mode: "serial" })` で worker 内 serial 化 → fullyParallel=true でも spec 内 race を回避。
- 結果: workers=2 でも `6 passed (27.7s)` を 1 回で達成（dev 報告と一致）。
- W11-T1 の `family-streak.spec.ts` は workers=1 強制で吸収していたが、W11-T3 は **execWithRetry + serial の二重保険** でより堅牢。
- レビュー上、preexisting SQLITE_BUSY は本タスクが原因ではなく fullyParallel=true × file: SQLite の構造的事象。本実装の対応は modal で十分。

#### G-3. 家族 streak E2E への regression check

- レビュー側で `bun run e2e tests/e2e/family-streak.spec.ts --workers=1` 実行 → **6/6 PASS / 30.7s** を確認。
- W11-T1 の data-attr (`data-family-streak-days` / `data-family-streak-alive`) と動作が完全に保たれている = Promise.all への 1 行追加 (5 並列 → 6 並列) は既存 row への副作用ゼロ。

### H. 保護者 dashboard 既存セクション順序の保持

**評価: 良好（既存セクション順序の完全保持 / 追加のみで挿入）**

| 順序 | セクション | aria-labelledby | 由来 |
| --- | --- | --- | --- |
| 1 | 今日の学習時間 | `today-learning` | W10-T5 |
| 2 | 家族のれんぞく | `family-streak` | W11-T1 |
| 3 | **家族内ランキング (本タスク)** | **`family-leaderboard`** | **W11-T3 / 新規** |
| 4 | 今週の学習サマリー | `weekly-summary` | W3 |
| 5 | 受験日カウントダウン | `exam-countdown` | W3 |
| 6 | 学習停止リマインド | `inactivity-reminder` | W4 |
| 7 | 直近の誤答 TOP 5 | `recent-mistakes` | W3 |

- 既存 6 セクションの構造はそのままで、W11-T1 と W3 の境目に W11-T3 を挿入。
- `<section aria-labelledby="family-leaderboard">` で section アクセシビリティ確保 / `<TrophyIcon className="h-6 w-6 text-primary" aria-hidden="true" />` で装飾アイコンを ARIA から除外。
- 学習者切替時は `familyId` が learner 切替に依存しない family scope のため、A/B 切替でも leaderboard は同じ（兄弟救済の本旨と整合 / W11-T1 と同設計）。

---

## マイナー指摘（後続タスクで吸収可）

### M-1: `weeklyXp` 数値カラム名と「正解数 × 10」近似の関係を helper 内コメントで再強調

`family-leaderboard.ts:36-39` で `LEADERBOARD_XP_PER_CORRECT = 10` が定数化されており、Card 下部の親 UI コピー (`dashboard/page.tsx:354`) で「直近 7 日の 正解数を 集計しています」と明示済。

ただし、純関数 `computeWeeklyXpRanking` は `weeklyXp: number` と汎用名で受け取り、実体が「正解数 × 10 の近似値」であることを呼び出し元が知らないと意味が落ちる。将来 DEC 変更で「正解数 × 5」「正解数 × 15」等に係数変更したとき、純関数 unit テストの fixture を読むだけでは追跡しにくい。

**推奨**: `family-leaderboard.ts` 上部の docstring §データソース選択肢 A 採用 にすでに明記されているので必須ではないが、`LEADERBOARD_XP_PER_CORRECT` 定数の宣言行に「DEC-061 で定義 / 変更時は dashboard コピーも追従要」とコメント 1 行追加すると保守性が上がる。push 阻害なし。

### M-2: 全員 0 XP / 単独 0 XP の UI コピー優先順位を docstring 化

`dashboard/page.tsx:288-292` で `leaderboardSolo` を `leaderboardAllZero` より先に判定するため、「単独 learner かつ 0 XP」のときは「今週も 0 XP がんばってるね」が出る。E2E spec の test 3 はこの順位優先を許容して `hasZeroPositive` で判定しているが、ソースコメントでも明示すると将来の改修ミスを防げる。

```tsx
{leaderboardSolo
  ? `今週も ${leaderboard[0]?.weeklyXp ?? 0} XP がんばってるね` // ← solo 優先 (0 XP でも solo)
  : leaderboardAllZero
    ? "今週はまだ。今日 はじめよう"
    : "直近 7 日の 家族の がんばり"}
```

**推奨**: `// solo 優先: 単独 learner なら 0 XP でも 「がんばってるね」(罰語ゼロ / DEC-024)` の 1 行コメントを追加。push 阻害なし。

### M-3: kotodama-tori stage 取得失敗の観測可能性

`family-leaderboard.ts:112-114` で stage 取得 catch がログ送信なし。stage 全件失敗が継続したとき「leaderboard に stage 表示が一切出ない」原因が production で追跡しにくい。

**推奨**: W11 polish or β 直前に `console.warn` / Sentry ブレッドクラムを「@keep: family-leaderboard kotodama-stage best-effort fail」コメント付きで追加。本タスクのスコープ外で OK。W11-T1 の M-3 と同種の申し送り（best-effort 失敗の観測戦略を W11 polish で一括検討）。

### M-4: E2E test 3「全員 0 XP」を「兄弟有 + 全員 0 XP」ケースまで拡張

現状の test 3 は単独 learner で answer_logs を入れない条件。`hasZeroPositive` は solo / allZero どちらでも通るため、「兄弟が 2 人いて両方 0 XP のとき allZero 分岐が確実に出る」検証が直接は機械化されていない。

純関数 unit `全員 0 XP でも rank は 1, 1, 1` と `isAllZeroXp` 4 ケースで構造保証されているので致命的ではないが、E2E でも 1 ケース追加すると一貫性が上がる:

- 「兄弟 2 人 + 両方 answer_logs ゼロ → 「今週はまだ。今日 はじめよう」が含まれる + 1 位の TrophyIcon が出ない」

push の阻害要因ではない。W11 polish で追加可。

---

## メジャー指摘

**なし。**

## クリティカル指摘

**なし。**

---

## 推奨次アクション

### main push 可否

**push 可**。レビュー側で以下を確認済:

- `bun run typecheck` clean (0 errors)
- `bun run lint` clean (0 errors / 0 warnings)
- `bun run test` 633/633 PASS (W11-T1 baseline 619 + W11-T3 +14)
- `bun run build` ✓ 23 routes (Turbopack production / Compiled in 5.8s)
- `bun run e2e tests/e2e/family-leaderboard.spec.ts` 6/6 PASS / 27.7s (chromium + mobile-chrome × 3 ケース)
- `bun run e2e tests/e2e/family-streak.spec.ts --workers=1` 6/6 PASS / 30.7s (W11-T1 regression check)
- migration 新規ゼロ (drizzle/ は 0015 までで停止 / schema 変更なし)
- DEC-024 / DEC-003 + COPPA / DEC-061 / DEC-055 を構造レベル（純関数 + server-only helper 分離 / SQL `family_id WHERE` 必須 / 1224 ranking で「最下位」経路ゼロ / read-only による idempotency 自動成立）で保全
- M-1〜M-4 はいずれも push の阻害要因にならない後続改善

#### commit メッセージ案

```
feat(prj-016): W11-T3 家族内ランキング (Family Leaderboard) 実装

- 純関数 computeWeeklyXpRanking / isAllZeroXp を
  src/lib/study/family-leaderboard-ranking.ts に分離
  (1224 ranking で「最下位」経路ゼロ / 同 XP 同順位 / 単独 learner = [1] /
   全員 0 XP = [1, 1, ...] / 防御的正規化 / 安定ソート / kotodama-tori stage 伝搬)
- Server-only helper getFamilyWeeklyLeaderboard を
  src/lib/study/family-leaderboard.ts に新設 (DB write 0 / read-only)
  SQL レベルで learner_profiles.family_id = ? を必須化 (COPPA 構造防御)
- 保護者ダッシュボードに Family Leaderboard Card 追加
  (TrophyIcon / data-testid=family-leaderboard-card /
   data-leaderboard-rank|learner-id|weekly-xp|kotodama-stage 属性 /
   3 状態前向きコピー切替 + 全員 0 XP のとき 1 位の冠を抑止)
- データソース選択肢 A 採用 (DEC-061): answer_logs × 10 XP/問の近似
  xp_levels.totalXp は破壊しない / 親 UI に「直近 7 日の 正解数を 集計」明示
- per-learner try/catch で kotodama-tori stage 取得失敗が
  leaderboard 全体を落とさない best-effort 化

DEC-024 罰則ゼロ: 純関数は位置情報のみ生成 / UI 3 状態切替で罰語の出口を物理封鎖。
DEC-003 + COPPA: 三層認可 + SQL family_id 必須でグローバル ranking 構築不可能。
DEC-055 idempotency: read-only で構造的に成立 (DB write 0 hit)。
DEC-061 データソース選択肢 A: read-only / 累計 XP 非破壊 / 親 UI に近似明示。

unit 633 PASS (+14) / typecheck clean / lint clean / build 23 routes /
family-leaderboard E2E 6/6 green (chromium + mobile-chrome × 3) /
family-streak E2E regression 6/6 green (workers=1).

Refs: DEC-061, DEC-024, DEC-003, DEC-055
```

### 次タスクへの申し送り

1. **W11 完遂時 (W11-T2 / T4 / T5 完遂後)**: M-1 の定数コメント明確化 / M-2 の solo 優先順位コメント追加 / M-3 の kotodama-stage best-effort 失敗ログ送信先決定（W11-T1 M-3 と一括検討） / M-4 の E2E 「兄弟有 + 全員 0 XP」ケース追加
2. **dashboard 更新**: `dashboard/active-projects.md` の PRJ-016 Phase 2 W11 進捗 25% → 50%（dev 報告 §次のアクション 3 と一致）
3. **W11-T2 / W11-T4 / W11-T5 着手判断**: dev 報告 §次のアクション 4 で提示されている通り、(a) study UI preexisting regression を解消するセットで W11-T2 着手 (P0 / 2 pd) か、(b) W11-T4 親ことば (P2 / 1 pd) を先行するか、CEO 判断を推奨。レビュー視点では W11-T1 + W11-T3 の知見蓄積を活かして W11-T2 = study UI 拡張に挑む方が組織スループット最大化に資する（study-smoke regression を W11-T2 と同 atomic で吸収）
4. **Production smoke (任意)**: 本番反映後、保護者ダッシュボードに Family Leaderboard Card が表示され、「みんなで がんばってるね」+ 1 位 / 2 位 / 3 位が data-attr で読み取れることを 1 度オーナー手動確認推奨（schema 変更なしのため migration step 不要 / 既存 answer_logs を集計するだけ）

---

レビュー部門 / 2026-05-02
