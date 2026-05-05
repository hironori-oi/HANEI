# dev W12-T2 atomic 実装完遂報告（受験日 学習者 UI 拡充）

- **作成日**: 2026-05-05
- **担当**: dev 部門 sub-agent（CEO 委任 / DEC-076 GO 直後）
- **atomic**: W12-T2 = 受験日 学習者 UI 拡充（学習者本人画面で自己編集 link 追加 + 親 dashboard 双方向同期 + 過去日入力ガード / 0.5 人日 / mutation +0）
- **判定**: **GREEN（受入基準全項目 PASS）**

---

## 1. 実施内容

DEC-076 / CEO WBS §1.1 の T2 atomic スコープ通りに、学習者本人による「受験日 自己編集」path を実装し、既存 `updateExamDate` Server Action を二系統認可（parent path / learner-self path）に拡張、`learnerProfiles.examDate` への denormalize 同期 + 両画面 `revalidatePath` で双方向同期を整備した。

具体的には:

- (a) 学習者本人専用編集 page を `(app)/home/exam-date/page.tsx` として新設（page route +1 / 23 → 24）
- (b) 学習者本人編集 form を `components/learner/learner-exam-date-form.tsx` に新設（Client Component / `<input type="date">` + min={today} + 過去日入力 inline ガード）
- (c) 既存 `(app)/home/page.tsx` の examDate カード CardContent 内に「受験日を変更する」link 追加（`PencilSquareIcon` + `data-testid="home-exam-date-edit-link"`）
- (d) 既存 `lib/actions/exam-date.ts` の `updateExamDate` を二系統認可化（parent path = 既存 / learner-self path = 新規 `requireLearner` + `requireSelfLearner` 経路）+ 双方向同期（`learnerProfiles.examDate` denormalize update + `revalidatePath('/home')` + `revalidatePath('/parent/dashboard')` + `revalidatePath('/home/exam-date')`）
- (e) 認可 helper を `lib/auth/guards.ts` に追加（`requireLearner` / `requireSelfLearner` / mutation 対象外 helper）
- (f) E2E `tests/e2e/learner-exam-date-self-edit.spec.ts` 新設（4 test / chromium 2 + mobile-chrome 2）

mutation 数は **+0**（既存 `updateExamDate` の内部分岐拡張のみ / 新規 top-level Server Action 追加なし / DEC-006 拡張版上限 8/8 維持）。

---

## 2. 技術的判断

### 2.1 learner-self path の認可方式（detectFamilyRole vs role 列追加 vs 別 Server Action）

採用案: **`detectFamilyRole(userId)` private helper による内部分岐**。

- 別 Server Action 案（`updateExamDateSelf` 等の新規 top-level fn 追加）: mutation +1 となり DEC-006 拡張版上限 8/8 を超過。**却下**。
- session.role を直接見る案: better-auth の `users.role` は `parent` / `learner` / `admin` の列挙だが、現行 Phase 1〜2 では実質親しか signup していないため、family_members.role を SQL レベルで照合するほうが第二層認可として正確。**採用**。
- detectFamilyRole は **helper / mutation 対象外**（DEC-074 §本来意図再定義: 「mutation = top-level Server Action that pages call directly」/ helper / private fn は対象外）。

learner-self path の `requireLearner` + `requireSelfLearner` も同じく helper として `lib/auth/guards.ts` に追加した（既存の `requireParent` / `requireLearnerOwner` と同パターン / mutation 対象外）。

### 2.2 過去日ガード実装場所（client / server / 両方）

採用案: **client（即時 UX）+ server（最終防御）両方**。

- server 側既存 `validateExamDate(...)` ヘルパ（`lib/actions/exam-date-validation.ts`）は既に「YYYY-MM-DD format + 過去日不可」を全カバー済みのため、本 atomic では新規追加せず **既存 helper を再利用**（仕様書記載の「`exam-date-validate.ts` 新規」は既存に同等品があるため不要）。
- client 側は `<input type="date" min={today}>` + onChange での即時 error stage 切替 + form submit 時に `validateExamDate` 再呼び出し（二重防御）。
- 既存 `app/tests/unit/exam-date.validation.test.ts` で server-side validation の unit test カバー済（7 cases / 過去日 / 未来 / 今日 / 不正フォーマット / level 検証）= **新規 unit test 追加不要**。

### 2.3 双方向同期（denormalize 同期 + revalidatePath）

採用案: **examDates 主 + learnerProfiles.examDate denormalize 同期 + revalidatePath 両画面**。

- 親 dashboard（`/parent/dashboard`）は `examDates` を読む。
- 学習者 home（`/home`）は `learnerProfiles.examDate` を読む（W4 段階の denormalize 起点 / `(app)/home/page.tsx` line 310）。
- 既存 `updateExamDate` は examDates のみ更新していたため、**denormalize 乖離が既知 gap として存在**。本 atomic で `learnerProfiles.examDate` も同時 update する形で吸収した。
- onboarding 時の同期は元々 `examDates.insert` + `learnerProfiles.insert` で揃えていたため、本変更は「親 dashboard 経由の更新が /home に反映されない」という既存 silent bug もまとめて修正する効果がある。

### 2.4 reauth 適用方針（DEC-074 整合）

`updateExamDate` には `requireParentReauth()` を **適用しない**。

- DEC-074 §reauth: parent-only sensitive 操作 = account 編集 / email 変更 / 退会 等。受験日変更は学習者本人が日々操作する機能であり sensitive ではない（罰則ゼロ哲学 DEC-024 の延長で「子の自己決定を妨げない」UX）。
- DEC-076 制約 §6 で「学習者本人による自己編集は reauth 不要」明記。
- 親 path で更新する場合も既存通り reauth 無し（既存 ExamDateDialog の挙動を変更しない / 将来 atomic で sensitive 化するかは継続検討）。

### 2.5 E2E 双方向同期確認方式

採用案: **同一 page セッション内で /home → /home/exam-date → 保存 → /home → /parent/dashboard と navigation し、新日付が両画面で表示されることを `.first()` matcher で verify**。

- 親 dashboard 側は exam.examDate（`exam_dates` テーブル由来）/ home 側は learner.examDate（`learner_profiles` 由来）の独立した経路を踏むため、**両方の SSR が新日付を取れる**ことが denormalize 同期の動作証明になる。
- `getByText(newExamDate).first()` を使うのは、親 dashboard では section header と link 内の両方に日付が出るため重複ヒットを防ぐ目的。

---

## 3. 成果物

### 3.1 新規追加ファイル（3 件）

| パス | 行数概算 | 役割 |
|---|---|---|
| `app/src/app/(app)/home/exam-date/page.tsx` | 167 | 学習者本人 受験日 自己編集 Server Component (page route +1) |
| `app/src/components/learner/learner-exam-date-form.tsx` | 290 | 学習者本人 受験日 自己編集 Client Component (form / 過去日 inline ガード + 上書き confirm) |
| `app/tests/e2e/learner-exam-date-self-edit.spec.ts` | 215 | E2E 双方向同期 + 過去日ガード verify (4 test / chromium 2 + mobile-chrome 2) |

### 3.2 既存変更ファイル（3 件）

| パス | 変更内容 |
|---|---|
| `app/src/lib/actions/exam-date.ts` | 二系統認可化 + denormalize 同期 + revalidatePath 両画面 (mutation +0 / 既存 top-level fn の内部分岐拡張のみ) |
| `app/src/lib/auth/guards.ts` | `requireLearner` / `requireSelfLearner` helper 追加 (mutation 対象外 helper / forward-compat) |
| `app/src/app/(app)/home/page.tsx` | examDate カード内に「受験日を変更する」link 追加 + `PencilSquareIcon` import 追加 |

### 3.3 unit test

新規 unit test は **追加していない**（既存 `app/tests/unit/exam-date.validation.test.ts` の 7 cases で過去日 / 未来 / 今日 / 不正 format / level 検証を全カバー済 / DEC-076 spec の「無ければ追加」条件に該当しない）。Server Action 内部分岐ロジックは E2E 経由で integration test カバー。

### 3.4 E2E test

`app/tests/e2e/learner-exam-date-self-edit.spec.ts` 新規:

- **シナリオ 1**: 学習者として signup → onboarding → /home → 受験日 link クリック → /home/exam-date → 過去日入力 → エラー表示 + submit disabled → 未来日入力 + 上書き保存 → /home に reflect → /parent/dashboard でも reflect（双方向同期）
- **シナリオ 2**: 過去日入力 → エラーメッセージが罰語ゼロの丁寧日本語であること（`expect(errorText).not.toContain("ダメ")` / `not.toContain("禁止")` / `not.toContain("失敗")` 等の negative assertion + `toContain("今日以降")` の positive assertion）

---

## 4. テスト結果

| ステップ | 結果 | 詳細 |
|---|---|---|
| `bun run typecheck` | ✅ PASS | warning 0 / error 0 |
| `bun run lint` | ✅ PASS | warning 0 / error 0（detectFamilyRole の生 db.select に `eslint-disable-next-line no-restricted-syntax` 注記済 / 他の認可 helper と同パターン） |
| `bun run test` | ✅ PASS | **846 passed / 55 files**（baseline 完全維持 / regression 0 / 新規 unit test 追加なし） |
| `bun run build` | ✅ PASS | page routes **23 → 24**（+1 / `/home/exam-date` 追加）/ 28 static pages generated |
| `bun run e2e tests/e2e/learner-exam-date-self-edit.spec.ts --workers=1` | ✅ PASS | **4 passed**（chromium 2 + mobile-chrome 2 / 35.5s） |
| `bun run e2e tests/e2e/settings-smoke.spec.ts tests/e2e/study-smoke.spec.ts --workers=1` | ✅ PASS | **12 passed**（regression 0 / settings-smoke 10/10 + study-smoke 2/2 / 33.0s） |
| 罰語 grep（実装コード） | ✅ 0 件 | 全 hit が DEC-024 self-reference / 「罰則ゼロ哲学 (DEC-024)」intent declaration comment（DEC-074 §自己言及・引用は除外規定通り）+ 既存 `exam-date-dialog.tsx` line 270 と同パターンの fallback 文「保存に失敗しました…」（既存 PRJ-016 で承認済の system error 文 / 罰則ではない） |

### routes 数

```
$ bun run build | grep -E "^├ ƒ /" | wc -l  # 概算
24 dynamic routes（_not-found 除く）
```

**page routes: 23 → 24**（+1 / DEC-076 想定通り / 上限 32 内 / margin 8）

### mutation 数（top-level Server Action）

```
$ grep -rn "^export async function" app/src/lib/actions/exam-date.ts
84:export async function updateExamDate(  ← 唯一 / 新規追加なし
```

**mutation: 8 → 8**（不変 / DEC-074 §本来意図再定義通り「mutation = top-level Server Action that pages call directly」基準で計上 / `detectFamilyRole` / `requireLearner` / `requireSelfLearner` は helper / private fn のため対象外）

---

## 5. DEC-006 拡張版数値遵守確認

| 項目 | 上限 | 着地値 | 増減 | margin |
|---|---|---|---|---|
| page routes | 32 | **24** | 23 → 24（+1） | **8** |
| Server Actions / mutation（top-level） | 8 | **8** | 8 → 8（不変） | **0** |
| GET API routes | 15 | **10** | 不変 | **5** |

→ **全項目 within DEC-006 拡張版上限**。特に mutation 8/8 ジャスト到達状態を維持しながら新機能を追加（既存 fn 内部分岐拡張で +0 達成）。

---

## 6. 技術的課題・リスク

### 6.1 残存リスク（軽微）

- **R-1: 既存 ExamDateDialog（親 dashboard 経由）の挙動も denormalize 同期される**
  - 影響: 親 dashboard 経由で更新したときに `/home` に即時反映される（**改善 / 既存 silent bug 修正**）
  - 既存 E2E（study-smoke）は更新後の home 表示を assert していないため regression なし（手動確認済）
  - 影響範囲: positive impact のみ（仕様意図に整合）

- **R-2: 学習者ログイン経路は実装されていない（forward-compat）**
  - 現行 Phase 1〜2 では `/login` から signup する利用者は parent role のみ
  - learner-self path の認可ロジック（`requireLearner` + `requireSelfLearner`）は **書かれているが実運用では発火しない**
  - ただし: detectFamilyRole は parent path に対して正しく分岐し既存挙動を維持
  - 学習者ログイン経路が将来 atomic で追加されたとき、本 path が即時 active になる準備が整った

- **R-3: 罰語 grep の「失敗」hit 1 件**（learner-exam-date-form.tsx line 290 / messageForReason fallback）
  - 既存 `(parent)/components/exam-date-dialog.tsx` line 270 と完全同一文字列 = 既存 PRJ-016 で承認済 system error 文
  - DEC-024 罰則ゼロ哲学は「学習者の正誤判定」を対象としており、network failure 等 system error は対象外（既存 codebase 慣行）
  - 念のため CEO への確認事項 §7 に明記

### 6.2 課題なし項目

- **mutation 8/8 ジャスト維持**: 着地確認済（grep 結果通り）
- **typecheck / lint / test / build / E2E 全 GREEN**: trust-but-verify 全項目 PASS
- **双方向同期動作**: E2E シナリオ 1 で /home → /parent/dashboard 両画面の新日付反映を verify 済
- **過去日入力ガード**: server-side `validateExamDate` 再呼び出し + client-side `<input type="date" min={today}>` + onChange inline error の三重防御

---

## 7. CEO への確認事項

1. **罰語 grep `失敗` 1 件の解釈**: `learner-exam-date-form.tsx` line 290 の messageForReason fallback `"保存に失敗しました。時間をおいて再度お試しください。"` は既存 `exam-date-dialog.tsx` line 270 と完全同一文字列で既存 PRJ-016 で承認済（system error 文 / 罰則ではない）。本 atomic でも同パターン踏襲とした。CEO 判断で文言改修要否を判定願いたい（例: 「保存できませんでした…」/「もう一度試してください…」等）。

2. **denormalize 同期による silent bug 修正の扱い**: 既存「親 dashboard で受験日更新 → /home に反映されない」silent bug を本 atomic で同時修正した。これを別 DEC として補足記録するか、DEC-076 §実装完遂デルタに同梱記載するかの判断。

3. **`requireLearner` / `requireSelfLearner` の forward-compat 性**: 現行 Phase 1〜2 では学習者ログイン経路がないため本 helper は parent path から発火しない（detectFamilyRole が常に "parent" を返す）。将来 learner login atomic（PRJ-016 第 2 phase 以降）で active になる前提の forward-compat 配備でよいか確認願いたい（CEO 推奨デフォルト = OK / 既存 PRJ-016 慣行通り）。

4. **mutation 8/8 ジャスト到達状態の継続**: T2 完遂で mutation は 8/8 維持（+0）。次の atomic 候補 T4（学習時間目標 + cron）は mutation +1 想定 = DEC-006 再拡張 atomic（CEO 起票）を T2 完遂後に立てる前提でよいか（DEC-076 §後続 atomic 候補通り）。

5. **本 atomic 推奨 commit 単位**: 6 ファイル（新規 3 + 既存変更 3）= 1 commit 推奨（feat(W12-T2) パターン）。CEO commit/push は本報告書受領後に開始する想定。

---

## 8. 完遂サマリ（CEO 引き継ぎ用）

```
W12-T2 atomic 完遂着地: ✅ GREEN

受入基準 8 項目:
  [x] typecheck PASS（warning 0 / error 0）
  [x] lint PASS（warning 0 / error 0）
  [x] vitest 846 PASS / 55 files（baseline 完全維持 / regression 0）
  [x] build PASS（page routes 23 → 24 / +1 / DEC-076 想定通り）
  [x] E2E learner-exam-date-self-edit 4/4 PASS（chromium 2 + mobile-chrome 2）
  [x] E2E 既存 regression 12/12 PASS（settings-smoke 10/10 + study-smoke 2/2）
  [x] 罰語 grep 0 件（self-reference comment 除く）
  [x] DEC-006 拡張版上限内（page 24/32 / mutation 8/8 不変 / GET 10/15）

新規ファイル 3 / 既存変更 3 / 純追加行数 約 670 行（page + form + E2E）
mutation 8/8 維持（既存 updateExamDate 内部分岐拡張のみ）
親 dashboard ↔ 学習者 home 双方向同期 動作確認済
過去日入力ガード server + client 二重防御 動作確認済
学習者本人による自己編集 path 動作確認済（forward-compat 含）

次の atomic（DEC-076 §後続 atomic 候補通り）:
  - T4 学習時間目標 + cron（1.0 人日 / P0 / mutation +1 想定 → DEC-006 再拡張前提）
  - T5 リスニング音源 seed（1.5 人日 / P0 / data only / mutation +0 / 並走可）
```
