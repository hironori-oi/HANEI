# dev W12-T1 統合 atomic 実装完遂報告（settings 全体 + 親パスワード reauth dialog）

**注**: 本報告書は dev 部門 sub-agent が実装中に sub-agent 自身の tool budget 上限に到達したため、CEO trust-but-verify フェーズで CEO が代行生成。実装の実体（コード / migration / E2E）は dev sub-agent が完遂済（tool_uses 115 / duration 828s）。ファイル内容と検証結果から逆算で記述。

## 1. 実施内容

DEC-074 で確定した第 1 波 5 atomics の最初の実装 atomic = **T1 統合 atomic（T1 settings 全体 + T3 親パスワード reauth dialog 統合 / 1.25 人日）** を完遂。

実装範囲:
- `learner_settings` テーブル新設（M-1 migration `0018_w12_t1_learner_settings.sql`）
- 親 settings 4 page route 新設（`(parent)/parent/settings/{index, account, notifications, security}`）
- top-level Server Actions +2（`updateLearnerProfile` / `updateLearnerSettings`）
- 親パスワード reauth dialog（5 分グレース実装 / `(parent)/parent/parent-reauth-dialog.tsx`）
- `requireParentReauth` helper（`app/src/lib/actions/parent-reauth.ts`）
- learner-settings 入力 validation（`app/src/lib/study/learner-settings-validate.ts`）
- E2E settings smoke spec（chromium + mobile-chrome × 5 シナリオ = 10 tests）

## 2. 技術的判断

- **親 settings 配置**: `(parent)/parent/settings/...` 採用（学習者本人は触らない / DEC-003 三層認可で「親操作必須」境界明示 / 既存 `(app)/settings/accessories/` は学習者本人カスタマイズ系として残置・衝突無し）。
- **Better Auth reauth 実装方式**: 親パスワード再入力を Server Action で受け取り、session に紐付く `reauth_at` timestamp を保持する自前実装方式採用。Better Auth native reauth API は調査の結果プロジェクト構成では未利用方針。5 分グレース時間内なら mutation Server Action は通過。
- **learner_settings schema 設計**: 1 学習者 1 行（`learner_id` UNIQUE）/ 既存 `learner_profiles.preferences` JSON は PWA 内動作 preferences として残置 / 親操作領域だけを分離管理。`sound_enabled` は段階移行（T1 では新規保存先 upgrade、既存 preferences reads は不変）。
- **reauth dialog UX**: Modal + password input + 丁寧な日本語エラーメッセージ（罰語ゼロ）/ 「直近 5 分以内 reauth 済 → そのまま続行」「未済 → dialog 表示 → 親パスワード入力 → 5 分グレース」。

## 3. 成果物

### 新規追加ファイル（11 件）

```
app/drizzle/0018_w12_t1_learner_settings.sql                              (45 行)
app/src/lib/actions/learner-settings.ts                                   (241 行)
app/src/lib/actions/parent-reauth.ts                                      (126 行)
app/src/lib/study/learner-settings-validate.ts                            ( 54 行)
app/src/components/auth/parent-reauth-dialog.tsx                          (166 行)
app/src/app/(parent)/parent/settings/page.tsx                             (116 行)
app/src/app/(parent)/parent/settings/account/page.tsx                     (130 行)
app/src/app/(parent)/parent/settings/account/account-form.tsx             (231 行)
app/src/app/(parent)/parent/settings/notifications/page.tsx               (115 行)
app/src/app/(parent)/parent/settings/notifications/notifications-form.tsx (220 行)
app/src/app/(parent)/parent/settings/security/page.tsx                    (153 行)
app/tests/e2e/settings-smoke.spec.ts                                      (192 行)
```

### 既存変更ファイル（3 件）

- `app/src/lib/db/schema.ts` — `learnerSettings` table 定義追加（drizzle）
- `app/src/app/(parent)/layout.tsx` — settings 導線追加 / parent reauth provider 接続
- `app/tests/e2e/fixtures/db-fixture.ts` — settings テスト fixture 拡張

### migration

- `0018_w12_t1_learner_settings.sql` — `learner_settings` table 新設 + `learner_id` UNIQUE index

## 4. テスト結果

| 項目 | 結果 | 備考 |
|---|---|---|
| typecheck (`bun run typecheck` / tsc --noEmit) | **PASS** | warning 0 / error 0 |
| lint (`bun run lint` / eslint .) | **PASS** | warning 0 / error 0 |
| vitest (`bun run test`) | **846 PASS / 55 files** | baseline 846/55 完全維持・regression 0 |
| next build (`bun run build`) | **PASS** | page routes 19 → 23（+4）/ 全 27 routes（API 含）visible |
| E2E settings-smoke.spec.ts | **10/10 PASS（chromium 5 + mobile-chrome 5）** | reauth dialog 表示確認含 |
| E2E study-smoke regression | **2/2 PASS** | chromium + mobile-chrome / 学習コアループ無事 |
| E2E family-streak regression | **6/6 PASS** | 3 シナリオ × chromium + mobile-chrome / W11-T1 系 |
| 罰語 grep（実装コード） | **0 件** | 検出は全て「罰語ゼロ (DEC-024)」と書かれた intent declaration コメントのみ |

## 5. DEC-006 拡張版数値遵守確認

| カテゴリ | 旧 | 拡張上限 | T1 統合後 | margin |
|---|---|---|---|---|
| page routes | 19 | 32 | **23（+4）** | 9 件余裕 |
| Server Actions / mutation（top-level） | 6 | 8 | **8（+2）** | 0 件余裕（≦8 上限ジャスト） |
| GET API routes | 10 | 15 | **10（不変）** | 5 件余裕 |

※ mutation 8 上限到達のため、第 2 波以降の atomic で新規 top-level Server Action を導入する場合は DEC-006 再拡張 atomic（CEO 起票）が必要。helper / private fn は対象外（DEC-074 §本来意図再定義に従う）。

## 6. 技術的課題・リスク

- **mutation 8 上限到達**: T1 統合で +2 して上限に到達。次の T2（受験日 学習者 UI）/ T4（学習時間目標 + cron）/ T6（長期目標）等で新規 top-level Server Action が必要な場合は DEC-006 再拡張要。但し T2 / T4 / T6 は既存 mutation の再利用が可能な atomic も多く、必ずしも再拡張必須ではない。
- **既存 `learner_profiles.preferences.soundEnabled` と新 `learner_settings.sound_enabled` の段階移行**: T1 atomic では既存 reads 不変・新規 writes は新テーブルへ。将来 atomic（おそらく T4 or 第 2 波）で wiring 統合し、preferences.soundEnabled を deprecate 予定。
- **Better Auth reauth 自前実装の SOC**: session-bound `reauth_at` を helper で管理する自前実装は機能的に成立するが、Better Auth native の sign-in re-verification を将来活用する場合の移行 path が未明文化。β 1 ヶ月運用後に評価 / 持ち越し評価 trigger 候補。

## 7. CEO への確認事項

- 特記事項なし（trust-but-verify 全 GREEN / 受入基準全項目 PASS）。
- DEC-006 拡張版 mutation 8 上限到達のため、第 2 波着手前に「mutation 残枠 0」の認識を CEO は持っておくこと。次に top-level Server Action +1 が必要となる atomic では DEC-074 改訂 or 新 DEC で再拡張承認が必要。
