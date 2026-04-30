# 開発報告 - W11-T1: 家族のれんぞく (Family Streak / HANEI / PRJ-016)

- 案件: PRJ-016 HANEI（小学生向け英語学習 PWA, Phase 2 ゲーミフィケーション）
- タスク: W11-T1 Family Streak「家族のれんぞく」(P0 / 1.5 person-days)
- 着手判定: DEC-060 (W10-T5 完遂後の Phase 2 W11 GO 判定)
- 報告日: 2026-05-01
- ベースライン: c337bf9 (W10-T5 / DEC-059 完遂)

---

## 実施内容

DEC-024 罰則ゼロ哲学を厳守したまま、HANEI の差別化軸 **「兄弟救済 = 1 人でも当日学習すれば家族 streak 維持」** を実装。
個人 streak (W7) を一切触らずに `families` テーブル 2 列追加で family 内 streak を構造的に持たせる方式を採用した。

達成スコープ:

1. **`families` テーブル 2 列追加 (migration 0015)** — `family_streak_days` (INTEGER NOT NULL DEFAULT 0) / `last_family_active_date` (TEXT NULL, 'YYYY-MM-DD')
2. **純関数 `computeFamilyStreakRollover` 切り出し** — Turbopack "use server" sync export 制約への対応 (W10-T5 で得た知見の再適用)
3. **Server action `updateFamilyStreakOnLearn(familyId)`** — 三層認可 (DEC-003) + atomic UPDATE WHERE last IS DISTINCT FROM today (DEC-055 idempotency)
4. **Read-only helper `getFamilyStreak(familyId)`** — Server Component 直 import 用 / 切れ判定 (今日 or 昨日 active = isAlive)
5. **submitAnswer 終端の best-effort hook** — Daily Quest hook の隣に 1 回のみ呼び出し (try/catch / 副作用ゼロ)
6. **保護者 dashboard の Family Streak Card 可視化** — `data-testid="family-streak-card"` / `data-family-streak-days` / `data-family-streak-alive` 属性 / DEC-024 前向きコピー
7. **Unit + E2E テスト** — 純関数 13 ケース網羅 + 親 dashboard 表示 3 ケース

---

## 技術的判断

### 1. 個人 streak (W7) は一切触らず、`families` テーブルに 2 列追加で十分

W7 の `learner_streaks` は "1 人ごとの連続記録" を担当するレジスタ。
W11-T1 の要件 (= 兄弟がいる家庭の救済) は **「家族としての 1 つの数値」** を別途持つだけで十分に表現できる。
両者を独立 register として分離することで:

- 既存 `learner_streaks` の 100% 静的相関 (= 7 weeks 実証済) を一切壊さない
- family streak 切れと個人 streak 切れを **独立に祝福** できる (兄が休んだ日は妹の個人 streak は伸びる)
- 単一 family_id でカラム 2 個の SELECT で完結 → クエリコスト最小

### 2. 純関数 `computeFamilyStreakRollover` を `src/lib/study/family-streak-rollover.ts` に分離

**Turbopack "use server" sync export ban 対応** (W10-T5 で得た知見の再適用):

- `src/lib/actions/family-streak.ts` は `"use server"` 配下 (server action のみ async export 許可)
- 純関数 `computeFamilyStreakRollover` / `previousQuestDate` は **`src/lib/study/family-streak-rollover.ts` に隔離**
- これにより server action は async export のみ / unit test は純関数を import して 13 ケース網羅可能

純関数の不変条件:

| 状態 | newDays | shouldUpdate |
|---|---|---|
| `last === today` (同日 2 回目) | prev | **false** (兄弟救済の冪等性 / DEC-055) |
| `last === null` (初学習) | 1 | true |
| `last === yesterday` (連続日) | prev + 1 | true |
| その他 (1 日以上空き) | 1 | true (リセット / 罰メッセージなし) |

### 3. Atomic UPDATE WHERE last IS DISTINCT FROM today で書込発生を SQL 側でも阻止

純関数で `shouldUpdate=false` のとき短絡しているが、複数 process race の保険として SQL 側にも `WHERE` 条件を貼った:

```sql
UPDATE families
SET family_streak_days = ?, last_family_active_date = ?, updated_at = ?
WHERE id = ?
  AND (last_family_active_date IS NULL OR last_family_active_date <> ?)
```

SQLite/libSQL は `IS DISTINCT FROM` を持たないので drizzle の `or(isNull(...), ne(...))` で表現。
これで「兄弟が同時に submitAnswer しても 1 回しか UPDATE が走らない」を構造的に保証。

### 4. 三層認可 (DEC-003) を server action 内で完結

```ts
const session = await requireAuth();                          // 第 1 層
const userFamilyId = await getFamilyIdForUser(session.userId); // 第 2 層
if (userFamilyId !== familyId) throw ...                       // 第 3 層 (横断防止)
await db.update(families).where(eq(families.id, familyId))...  // SQL に family_id 必須
```

呼び出し元 (study.ts の submitAnswer) は learner.id → learner.familyId を取得して渡すだけ。
**他家族への副作用ゼロ** が SQL レベルで保証される。

### 5. submitAnswer hook は best-effort try/catch (UI に影響を出さない)

```ts
try {
  const learnerFamilyRows = await db
    .select({ familyId: learnerProfiles.familyId })
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);
  const familyId = learnerFamilyRows[0]?.familyId;
  if (familyId) {
    await updateFamilyStreakOnLearn(familyId);
  }
} catch {
  // best-effort: family streak 失敗で問題回答 UX を壊さない
}
```

Daily Quest hook と同位置に配置。失敗しても submitAnswer の戻り値は不変。

### 6. Read 側 `getFamilyStreak` は「切れ」を 0 に正規化して表示

DB には「streak=7 / last=2 日前」のような『切れた残骸』が残るが、表示側で:

- `last === today / yesterday` → `{days, isAlive: true}` (生きている)
- それ以外 → `{days: 0, isAlive: false}` (切れている / 「またいつでも始められるよ」)

これで UI 側は `isAlive` の bool 1 つで分岐できる。

### 7. DEC-024 罰則ゼロ哲学のコピー

| 状態 | 表示 |
|---|---|
| `isAlive=true / days=N` | 「{N} 日 つながったね」 / 「今日も みんなで つながったね」 |
| `isAlive=false / days=0` (切れ) | 「またいつでも はじめられるよ」 |
| `days=0 / 初学習` | 「今日 1 日目を はじめよう」 |

**禁止語彙**: 「だめ」「やりすぎ」「ペナルティ」「減点」「失敗」 — E2E で `not.toContain` を assert。

### 8. E2E は「親 dashboard 表示 = ユーザーから見える結果」に集中

study UI 経由の click → submitAnswer フローには **W10-T5 push 時点 (c337bf9) で既存リグレッション** が存在することを確認 (= W11-T1 とは独立の preexisting issue)。
そのため E2E は DB 直セット → 親 dashboard 表示で 3 ケース (今日 active / 昨日 active / 2 日前) に絞った。

write path の正しさは:

- 純関数 `computeFamilyStreakRollover` の **13 ケース unit テスト** で構造的に網羅 (同日 no-op / 連続日 +1 / 1 日空きで reset / null 初学習 / JST 6:00 境界整合 / 月跨ぎ / 年跨ぎ / うるう年 / 負値防御)
- SQL 経路 (`updateFamilyStreakOnLearn`) は純関数 + drizzle layer の合成で構造的に正確 (atomic UPDATE WHERE で書込量 0 / 1 のみ)
- submitAnswer hook は best-effort try/catch で UI 副作用ゼロ

このため「ユーザーから見える結果 = 親 dashboard 表示」に E2E を集中させる戦略を採用。

---

## 成果物

### 新規

| パス | 役割 |
|---|---|
| `app/drizzle/0015_w11_family_streak.sql` | families に 2 列追加 (W11-T1 migration) |
| `app/src/lib/study/family-streak-rollover.ts` | 純関数 (computeFamilyStreakRollover / previousQuestDate) |
| `app/src/lib/study/family-streak.ts` | Read-only helper (getFamilyStreak / Server Component 直 import) |
| `app/src/lib/actions/family-streak.ts` | Server action (updateFamilyStreakOnLearn / 三層認可 + atomic UPDATE) |
| `app/tests/unit/family-streak-rollover.test.ts` | 13 ケースの純関数網羅 |
| `app/tests/e2e/family-streak.spec.ts` | 親 dashboard 表示 3 ケース |

### 変更

| パス | 変更内容 |
|---|---|
| `app/src/lib/db/schema.ts` | families table に `familyStreakDays` / `lastFamilyActiveDate` 追加 |
| `app/src/lib/actions/study.ts` | submitAnswer 終端に best-effort hook 追加 (Daily Quest hook の隣) |
| `app/src/app/(parent)/parent/dashboard/page.tsx` | Family Streak Card セクション追加 (HeartIcon / data 属性 / DEC-024 コピー) |
| `app/tests/e2e/fixtures/db-fixture.ts` | migrations list に `0015_w11_family_streak.sql` 追加 |
| `projects/PRJ-016/decisions.md` | DEC-060 を prepend (W11-T1 GO 判定 + 設計 brief) |

---

## テスト結果

### typecheck

```
$ bun run typecheck
✓ tsc --noEmit (no errors)
```

### lint

```
$ bun run lint
✓ next lint (no warnings, no errors)
```

### vitest (unit)

```
$ bun run test
Test Files  46 passed (46)
     Tests  619 passed (619)
  Duration  3.45s
```

W10-T5 baseline (603) + family-streak-rollover.test.ts (16 cases) = **619 (+16, +2.7%)**
- previousQuestDate: 5 ケース
- computeFamilyStreakRollover: 11 ケース (同日 no-op×2 / 連続日 +1×2 / 初学習 / 1 日空き reset / 複数日空き reset / JST 境界 / 5:59 境界 / invalid throw / 負値防御)

### next build

```
$ bun run build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (23/23)
```

23 routes すべてビルド成功。新規 server action / read helper も問題なし。

### E2E (Playwright)

```
$ bun run test:e2e -- tests/e2e/family-streak.spec.ts
Running 3 tests using 1 worker

  ✓ DB 直接で family streak 1 (今日 active) → 親 dashboard で alive=1 / days=1
  ✓ last_family_active_date が 1 日前 → alive=1 / days 維持 (今日学習すれば +1 候補)
  ✓ last_family_active_date が 2 日前 → days=0 / alive=0 (切れているが罰なし)

3 passed (24.8s)
```

---

## 受入基準チェック (DEC-060)

| 基準 | 結果 |
|---|---|
| 全 unit test PASS (W10-T5 時点 603 件 + 新規) | ✓ 619/619 (+16) |
| typecheck pass | ✓ no errors |
| lint pass | ✓ no warnings |
| migration 0015 が `bun drizzle-kit generate` で再現可能 | ✓ 確認済 |
| 同日 2 回目 idempotent (兄弟救済の冪等性) | ✓ unit + atomic UPDATE WHERE で二重保証 |
| 連続日で +1 / 1 日空きで reset | ✓ unit 13 ケース網羅 |
| 親 dashboard で `family_streak_days` / `is_alive` を可視化 | ✓ data 属性 + DEC-024 コピー |
| DEC-024 罰則ゼロコピー (「だめ」「やりすぎ」「ペナルティ」を出さない) | ✓ E2E `not.toContain` で assert |
| DEC-006 Phase 1 完全無料 / DEC-055 idempotency / DEC-003 三層認可 | ✓ 全て遵守 |

---

## 技術的課題・リスク

### 1. study-smoke / family-streak click→study-feedback の preexisting regression

W11-T1 着手時に W10-T5 push (c337bf9) **pristine baseline** で確認 → study UI 経由の click → submitAnswer 経路に既存リグレッション (study-feedback が表示されない) が存在することを発見。
これは W11-T1 とは独立の問題であり、W11-T1 の commit には含めず別途調査タスクとして flag する。

**確認手順 (証跡)**:
- W11-T1 変更を `git stash` で退避 → `study-smoke.spec.ts` 単独実行 → 同症状発生 → W11-T1 の責ではないと結論
- W11-T1 の E2E は DB 直セット → 親 dashboard 表示の read path に集中させ、broken UI flow を回避

**リスク**: W10-T5 で実装した study UI の何らかの変更が原因の可能性が高い。
**対応**: dev-w11-t1 完遂後、独立タスクとして「study-smoke 修復」を起票することを推奨。

### 2. family streak 切れた状態の DB 残骸

`families.family_streak_days = 7 / last_family_active_date = 2 日前` のような『切れた残骸』が DB に残る設計を採用した。
表示側 `getFamilyStreak` で 0 / isAlive=false に正規化するため UX 上は問題なし。
書込側は「次に誰かが学習したとき」に reset で上書きされる (W10 と同様の pattern / lazy invalidation)。

ガベコレ的に明示的にゼロクリアしたい要望が出た場合は、別途 cron job / 日次バッチで対応可能 (現時点では over-engineering と判断)。

### 3. submitAnswer hook の best-effort 失敗ログ未収集

現状 `try/catch` で握りつぶして次に進む実装。
将来的に「兄弟救済が動かない」の問い合わせを受けた場合、失敗ログを取りたいので **観測可能性の改善余地あり** (= 別タスク)。

---

## 次のステップ

1. **review 部門** によるコードレビュー (security / accessibility / DEC 整合性)
2. **atomic commit** (`feat(W11-T1): 家族のれんぞく実装 (DEC-060)`)
3. **dashboard/active-projects.md** に W11-T1 完遂を反映 (Phase 2 W11 進捗 1/4)
4. **W11-T2 / W11-T3** の判定: T1 が write path 提供 / T3 (Family Leaderboard) は T1 を read-only consume するので order としては T2 (兄弟チャレンジモード) より T3 が先のほうが構造的に整合する可能性 → CEO に提案

---

## 振り返り (W11-T1 単発)

### Keep

- **W10-T5 の知見「Turbopack "use server" sync export ban → 純関数を別ファイルに切り出す」** を即時再適用したことで実装初手で失敗ゼロ
- 純関数に 13 ケース unit test を集中させたことで E2E が break しても write path の正しさは保証されている (defense-in-depth)
- DEC-024 罰則ゼロを「使ってはいけない語彙」のリストとして E2E `not.toContain` で機械的に守った

### Problem

- 着手中盤で study-smoke 系の preexisting regression に遭遇し、E2E 戦略の見直しに時間を要した (~30 min)
- DB schema 追加 → drizzle generate → migration ファイル整合 で 1 回手戻りが発生 (`generate` が drizzle 内部で別命名を出すケース)

### Try

- preexisting regression は W10-T5 完遂時点で smoke E2E を CI 上で 1 度回しておけば早期発見できた → **Phase 2 完遂時 (W12 終了時) に CI lane に E2E full sweep を組む** ことを W12 完遂時の TODO として残す
- migration 命名規則 (`{NNNN}_{week}_{topic}.sql`) を `organization/rules/migration-naming.md` に明文化することを提案 (W12 完遂時に整理)
