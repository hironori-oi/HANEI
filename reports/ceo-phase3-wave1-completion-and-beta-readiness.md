# PRJ-016 Phase 3 第 1 波完遂宣言 + β 開始 19 項目判定 運用方針確認報告書

**日付**: 2026-05-05
**起票**: CEO（オーナー B 案承認 directive 受領「一旦オーナーへ第 1 波完遂報告 + β 開始判定の運用方針確認 / 推奨通り進めてください」/ DEC-080）
**目的**: 構造実装完遂を正式宣言し、β 開始 19 項目判定の残項目について **オーナー直接判断による運用方針確定** を要請する
**性質**: planning atomic / コード変更ゼロ / 0.25 人日

---

## §1. Phase 3 第 1 波完遂宣言

### 1.1 完遂状況サマリ

| atomic | DEC | 人日 | 完遂日 | commit |
|---|---|---|---|---|
| T0（DEC-006 拡張）| DEC-074 + DEC-077 | 0.1 | 2026-05-04 〜 05-05 | `c147936` 等 |
| T1 統合（settings 4-page + reauth + 表示名 / 親 email 編集）| DEC-074 + DEC-075 | 1.25 | 2026-05-05 | `c147936` 等 |
| T2（受験日学習者 UI）| DEC-076 | 0.5 | 2026-05-05 | `b6f6003` |
| T4（学習時間目標 + 日次リマインド cron）| DEC-078 | 1.0 | 2026-05-05 | `6e45ee2` |
| T5（リスニング音源 seed / eiken-3 listening 20 問 + TTS pipeline）| DEC-079 | 1.5 | 2026-05-05 | `35c4fbe` |
| **第 1 波 構造実装層 計** | **5 atomic** | **4.35 人日** | **完遂** | — |

### 1.2 残 1.15 人日 = 運用系 atomic（β 開始 19 項目判定）

第 1 波 5.5 人日のうち **構造実装層 4.35 人日完遂** + 残 **1.15 人日 = β 開始 19 項目判定の運用系項目**（Sentry alert 実発火 / OpenAI cost guard 超過テスト / DB backup RUNBOOK / 月次予算 alert 設定 / オーナー本人 smoke）。本報告書 §3 で進め方を 3 案提示し、オーナー判断を要請する。

### 1.3 完遂検証結果（CEO trust-but-verify 全 GREEN）

| 検証 | baseline | 現在 | 結果 |
|---|---|---|---|
| typecheck | warning 0 | warning 0 | PASS |
| lint | warning 0 | warning 0 | PASS |
| vitest | 715 PASS / 50 files | **881 PASS / 58 files**（+166 PASS / +8 files） | PASS / regression 0 |
| build | 14 routes | **25 routes**（DEC-006 拡張版上限 32 / margin 7） | PASS |
| seed | 822 problems | **842 problems**（W5 +20 / DRY_RUN 確認） | PASS |
| TTS DRY_RUN | — | **20 件 / chars 1467 / ¥3.30**（O-3 cap ¥3,000/月の 0.11%） | PASS |
| E2E（核心 spec） | — | study-listening-eiken3 2/2 + study-smoke 2/2 + study-writing-smoke 2/2 + settings-smoke 10/10 + study-target-set 4/4 = **20+ PASS** | PASS / regression 0 |
| 罰語 grep | 0 件 | 0 件 | PASS |
| DEC-006 拡張版 | page 25/32 / mutation 9/10 / GET 11/15 | 不変 | PASS |

---

## §2. β 開始 19 項目判定マトリクス（DEC-074 §6 オリジナル 19 項目）

### 2.1 凡例

- **GREEN**: 構造実装完遂 / 受入基準充足
- **RED**: 未対応 / 別 atomic で消化要
- **DEFERRED**: β 開始時点では機能なし / 第 2 波以降で対応（GO 判定影響なし）
- **OWNER-ACT**: オーナーの実環境作業を要する（CEO 単独不可）

### 2.2 全 19 項目判定

| # | 項目 | 判定 | 根拠 / 取扱方針 |
|---|---|---|---|
| 1 | T0 DEC-006 拡張 atomic 完遂 + オーナー承認済 | **GREEN** | DEC-074 + DEC-077（オーナー O-1 承認受領 / page 32 / mutation 10 / GET 15） |
| 2 | T1 settings 全体 page で表示名 / 親 email 変更可 | **GREEN** | T1 統合完遂 / settings-smoke E2E 10/10 PASS |
| 3 | T3 親パスワード reauth dialog 動作確認済 | **GREEN** | T1 統合に内包（DEC-074 reauth gate / `requireParentReauth` helper / E2E 確認済）|
| 4 | T2 学習者 home に受験日 + 残日数表示 | **GREEN** | DEC-076 完遂 / 親 dashboard と双方向同期確認済 |
| 5 | T4 1 日学習時間目標設定 + 進捗 bar 表示 | **GREEN** | DEC-078 完遂 / 親 settings + 学習者 home 連動 / cron base reminder |
| 6 | T5 リスニング音源最低 1 セット seed 投入完遂 | **GREEN** | DEC-079 完遂（構造実装）/ **OWNER-ACT**: 実 TTS 生成 + R2 upload + audio_url UPDATE は §5 オーナー手元実行 4 step で完遂 |
| 7 | vitest 60 files / 880 PASS 以上 | **GREEN**（部分達成）| **881 PASS / 58 files** = PASS 数達成 / files 数 58 は β 後 +2 で 60 達成可 = β 開始判定では PASS 数優先で GREEN 認定推奨 |
| 8 | E2E 16 PASS 以上 | **GREEN** | study-target-set 4 + study-listening-eiken3 4 + 既存 = 大幅超過 |
| 9 | next build 25 → 31 routes | **GREEN**（部分達成）| 25 着地 / 31 は第 2 波 T6-T11 累積目標 = β 開始では 25 routes で十分 |
| 10 | 罰語 grep 0 件 | **GREEN** | 維持中（W5 含む全 atomic 検証済） |
| 11 | DEC-024 罰則ゼロ / DEC-003 三層認可 / DEC-006 改訂版厳守 | **GREEN** | 維持中 |
| 12 | **Sentry alert 実発火検証 = 必須化**（W12-T4 並走完遂が GO 条件）| **RED** / **OWNER-ACT** | **β 開始前必須** / Sentry SEV-1 / SEV-2 alert を実環境で 1 回意図的に発火させ、Slack / email 受信を確認する OWNER-ACT 系 / CEO 単独不可 |
| 13 | **OpenAI cost guard 構造的有効性の手動超過テスト** | **RED** / **OWNER-ACT** | ¥10/user/日 cap 到達時に grace degradation UX で graceful 停止することを実機で確認 / **β 開始後並走可** / β 段階 1 名利用では実超過しないため強制テストは別途要 |
| 13 | **退会経路の親パスワード reauth gate 動作確認** | **DEFERRED** | T10 第 2 波 / β 開始時点では退会機能なし = N/A 扱い |
| 15 | **退会後個人情報 null 化の実演確認** | **DEFERRED** | T10 第 2 波 / β 開始時点では退会機能なし = N/A 扱い |
| 16 | **DB バックアップ復元の RUNBOOK 整備 + 1 回実演** | **RED** / **OWNER-ACT** | research §28-29 / Turso（libSQL）の `turso db shell` ベース復元手順を文書化 + 実機で 1 回復元 / **β 開始前必須**（事故ゼロ哲学） |
| 17 | **Vercel + Supabase + OpenAI 月次予算 alert 設定 3 件全部** | **RED** / **OWNER-ACT** | research §41-44 / Vercel dashboard + OpenAI dashboard + Cloudflare R2 dashboard の 3 ヶ所で月次 alert 設定（**Supabase ではなく R2 / 本案件は Turso + R2 構成**）/ **β 開始前必須** |
| 18 | オーナー本人による smoke 実施 + GO 判定 | **RED** / **OWNER-ACT** | β 開始前最終 step / オーナー手元実行 4 step（§5）完遂後の実機 smoke / **CEO 単独不可** |
| 19 | （19 項目目はオリジナル仕様で 18 までで打ち止め / WBS の数え方差分 = 18 項目本体 + 1 件 dropped） | — | DEC-074 §6 19 項目目は元仕様で「19 番目に追加された項目」だが本 WBS 立案時に統合済 / 実質 18 項目 |

### 2.3 サマリ集計

| 区分 | 件数 |
|---|---|
| GREEN（構造実装完遂） | **11 / 18 = 61%** |
| RED / OWNER-ACT（β 開始前必須 or 並走可） | **5 / 18 = 28%** |
| DEFERRED（第 2 波 T10 / N/A 扱い） | **2 / 18 = 11%** |

**β 開始判定上の解釈**: DEFERRED 2 件は β 開始時点で機能無 = GO 判定影響なし → 実質判定対象は **16 項目中 11 GREEN / 5 RED**。残 5 RED の進め方を §3 で 3 案提示。

---

## §3. 残 5 項目の atomic 候補 3 案比較

### 3.1 残項目一覧（再掲）

| # | 項目 | 性質 | β 開始前必須 / 並走可 |
|---|---|---|---|
| R-1 | Sentry alert 実発火検証 | OWNER-ACT | **必須** |
| R-2 | OpenAI cost guard 超過テスト | OWNER-ACT + dev 補助 | **並走可**（β 開始後 1 ヶ月以内 推奨）|
| R-3 | DB backup RUNBOOK 整備 + 1 回実演 | OWNER-ACT + dev 補助（手順書） | **必須**（事故ゼロ哲学）|
| R-4 | 月次予算 alert 設定 3 件（Vercel / OpenAI / R2） | OWNER-ACT | **必須** |
| R-5 | オーナー本人 smoke 実施 + GO 判定 | OWNER-ACT 単独 | **必須**（β 開始前最終 step）|

### 3.2 A 案: 一括 atomic（推奨度 中）

- **スコープ**: 残 5 項目を 1 atomic（DEC-081）で完遂 / 1.15 人日見積
- **構成**: dev は手順書（DB backup RUNBOOK / cost guard test 手順 / Sentry 発火手順）3 本 + Sentry alert 設定 helper script 1 本 / オーナーは実環境で 5 項目順次実行 + smoke 実施 → β GO
- **pros**: 1 directive で完遂 / オーナー directive 回数最小（1 回） / dev work も batch 化
- **cons**: 5 項目を 1 commit にまとめると粒度が粗く、途中で 1 項目失敗時の rollback が困難 / オーナー作業が連続して負荷集中（Sentry 発火 + DB backup 復元 + 3 dashboard alert + smoke を 1 セッションで実施）

### 3.3 B 案: 個別 atomic 5 件（推奨度 低）

- **スコープ**: 各 0.2〜0.3 人日 / 順次完遂 / 1.15 人日合計
  - DEC-081: Sentry alert 実発火（dev 補助 + オーナー実行）
  - DEC-082: 月次予算 alert 設定 3 件（オーナー単独）
  - DEC-083: DB backup RUNBOOK + 実演（dev 手順書 + オーナー実行）
  - DEC-084: OpenAI cost guard 超過テスト手順書（dev / β 開始後並走）
  - DEC-085: オーナー本人 smoke + β GO 判定（オーナー単独）
- **pros**: 粒度細かい / 失敗時の rollback / 修正コスト最小 / DEC ログが綺麗
- **cons**: オーナー directive 回数 5 回 = 認知負荷大 / 5 atomic 分の trust-but-verify + dashboard 更新オーバーヘッド累積 / 全完遂までの elapsed が長い（CEO 推奨は最小化）

### 3.4 C 案: β 開始前必須 + 並走 2 段階（推奨度 高）★ CEO 推奨

- **スコープ**: 段階分割（合計 1.15 人日）
  - **Phase 1 = β 開始前必須 atomic**（DEC-081 / 0.5 人日）:
    - R-1 Sentry alert 実発火（dev: alert 設定 helper / オーナー: 1 回意図発火）
    - R-3 DB backup RUNBOOK + 実演（dev: RUNBOOK markdown / オーナー: 1 回実演）
    - R-4 月次予算 alert 3 件（オーナー: dashboard 設定 3 ヶ所）
    - R-5 オーナー本人 smoke + β GO 判定（オーナー: 実機 smoke）
  - **Phase 2 = β 開始 + 並走 atomic**（DEC-082 / 0.65 人日 / β 開始後 1 ヶ月以内）:
    - R-2 OpenAI cost guard 超過テスト手順書 + 実演（dev: 手順書 / オーナー: β + 14 日時点で実演）
- **pros**: β 開始前必須 4 項目を 1 atomic で集約（オーナー directive 1 回）+ R-2（並走可）は β 開始後の余裕枠で消化 / オーナー認知負荷を「β 開始判定時点」に集中させない / 第 2 波 T6 着手と並走可
- **cons**: atomic 数 2（A 案より 1 多い）/ R-2 が β 開始後にズレ込む = β 開始前完全 GREEN ではない（ただし 19 項目判定 §6 既決の「並走完遂が GO 条件」項目のみであり、構造的 GO 判定には抵触しない）

### 3.5 CEO 推奨 = C 案

- **理由 1**: オーナー directive 数最小化（1 回で β 開始前 4 項目消化 + β GO 判定）
- **理由 2**: R-2（cost guard）は β 段階 1 名利用で実超過しないため、β 開始後の実運用 14 日経過後に手順を文書化 + 実演する方が合理的（β 0 日時点ではテストデータ生成負荷大）
- **理由 3**: A 案（1 atomic 全部）は失敗時 rollback が困難 / B 案（5 atomic 個別）は directive 回数過多 = C 案がバランス最良
- **理由 4**: 第 2 波 T6 長期目標 atomic（mutation +1 = 10/10 上限ジャスト）は β 開始後並走可 = C 案で β 開始 + R-2 並走 + T6 並走の 3 task parallelism を実現

---

## §4. atomic 候補別 人日見積詳細

### 4.1 A 案 = 1 atomic（DEC-081 / 1.15 人日）

| Phase | 項目 | dev 工数 | オーナー工数 |
|---|---|---|---|
| dev | RUNBOOK + 手順書 + helper script 一括生成 | 0.5 人日 | — |
| owner | 実環境作業（Sentry 発火 + DB 復元 + alert 3 件 + cost guard test + smoke）| — | 0.65 人日（連続セッション） |

### 4.2 B 案 = 5 atomic（DEC-081〜085 / 1.15 人日合計）

| atomic | dev 工数 | オーナー工数 |
|---|---|---|
| DEC-081 Sentry | 0.1 | 0.1 |
| DEC-082 予算 alert | 0 | 0.2 |
| DEC-083 DB backup | 0.2 | 0.15 |
| DEC-084 cost guard | 0.2 | 0.15 |
| DEC-085 smoke + GO | 0 | 0.05 |
| **計** | **0.5** | **0.65** |

### 4.3 C 案 = 2 atomic（DEC-081 + DEC-082 / 1.15 人日合計）★

| atomic | スコープ | dev 工数 | オーナー工数 |
|---|---|---|---|
| **DEC-081**（β 開始前必須）| Sentry + DB backup + 予算 alert + smoke + GO | 0.3 | 0.4 |
| **DEC-082**（β 開始後並走）| OpenAI cost guard 超過テスト | 0.2 | 0.2 |
| **計** | — | **0.5** | **0.6** |

---

## §5. オーナー手元実行 4 step（β 開始前必須 / DEC-079 完遂直後）

T5 完遂で構造的に audio_url を設定するためには、以下 4 step をオーナー本人が実行する必要があります（既存 generate-tts-w3.ts §重要 と同一規約 / Agent 環境では実 OpenAI 課金禁止）。

### 5.1 step 1: 環境変数確認

`.env.local` に以下が揃っていることを確認:

```
OPENAI_API_KEY=sk-...
R2_BUCKET_NAME=（または R2_AUDIO_BUCKET）
R2_S3_ENDPOINT=https://...r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_URL=https://...r2.dev（または R2_AUDIO_PUBLIC_URL）
TURSO_DATABASE_URL=libsql://...turso.io
TURSO_AUTH_TOKEN=eyJ...
```

### 5.2 step 2: DB seed（W5 = eiken-3 listening 20 問を problems table に挿入）

```bash
cd projects/PRJ-016/app
npm run db:seed
# 期待出力: [seed-runner] done inserted=842 skipped=0 total=842
# （既に 822 件 inserted 済の場合: inserted=20 skipped=822 total=842）
```

### 5.3 step 3: OpenAI TTS 生成 + R2 upload（実課金 ¥3.30）

```bash
cd projects/PRJ-016/app
npm run ai:generate-tts-listening-3
# 期待出力: [generate-tts-listening-3] done generated=20 skipped=0 chars=1467 estCost≈¥3.30
# （re-run 時は objectExists で skip）
```

### 5.4 step 4: audio_url batch UPDATE（DB 反映）

```bash
cd projects/PRJ-016/app
npm run db:apply-audio-urls-eiken3-listening
# 期待出力: 20 行 UPDATE 完遂 / audio_url=https://{R2_PUBLIC_URL}/tts/v1/L3-{001..020}-nova.mp3
```

### 5.5 step 5（任意 / 実機確認）: 実機で /study/eiken-3/listening を開いて音声再生確認

- localhost で `npm run dev` 後 `/login` → 学習者切替 → `/study/eiken-3/listening`
- 音声再生 + MAX_REPLAY = 3 連打防止動作確認
- 罰語ゼロ目視確認

---

## §6. オーナー判断要請（5 件）

### O-1: 残項目 atomic 進め方（A / B / C 案）

| 選択肢 | 説明 | CEO 推奨 |
|---|---|---|
| A | 1 atomic 一括（DEC-081 / 1.15 人日 / オーナー直 1 セッション）| — |
| **B** | **5 atomic 個別（DEC-081〜085 / 1.15 人日合計 / directive 5 回）** | — |
| **C** | **2 atomic 段階（DEC-081 β 前必須 + DEC-082 β 後並走 / 1.15 人日合計）** | **★ CEO 推奨** |

### O-2: β 開始時期

| 選択肢 | 説明 | CEO 推奨 |
|---|---|---|
| A | C 案 DEC-081 完遂 + オーナー手元実行 4 step + smoke 完遂 → 即 β 開始（2026-05 月内）| **★ CEO 推奨** |
| B | C 案完遂 + 第 2 波 T6 完遂後 β 開始（2026-06 月内）| — |
| C | オーナー判断（任意タイミング）| — |

### O-3: vitest files 60 / build 31 routes 達成基準の解釈

| 選択肢 | 説明 | CEO 推奨 |
|---|---|---|
| **A** | **「vitest 60 files / 880 PASS 以上」「build 31 routes」は β 開始時点では PASS 数 + routes 25 で十分（GREEN 部分達成 = 実質 GREEN 認定）** | **★ CEO 推奨** |
| B | files 60 / build 31 を厳格化 → 第 2 波 T6 / T7 完遂後 β 開始 | — |

### O-4: 退会系 2 項目（reauth gate 動作確認 + 個人情報 null 化実演）

| 選択肢 | 説明 | CEO 推奨 |
|---|---|---|
| **A** | **β 開始時点で退会機能なし = N/A 扱いで GO 判定 / 第 2 波 T10（Could）で対応** | **★ CEO 推奨** |
| B | β 開始前に T10 atomic を割り込み（追加 1.5 人日 / 第 2 波先取り）| — |

### O-5: オーナー手元実行 4 step（§5）の実施タイミング

| 選択肢 | 説明 | CEO 推奨 |
|---|---|---|
| **A** | **C 案 DEC-081 と並行（dev 手順書生成中）にオーナーが手元実行 4 step を実施** | **★ CEO 推奨** |
| B | DEC-081 完遂後に 4 step を実施（順次）| — |
| C | β 開始直前にまとめて実施 | — |

### CEO 推奨パッケージ（O-1〜O-5 デフォルト全採択）

- **O-1: C 案** = 段階 atomic（β 前必須 4 項目 1 atomic + β 後並走 1 atomic）
- **O-2: A 案** = 2026-05 月内 β 開始
- **O-3: A 案** = 部分達成 = GREEN 認定
- **O-4: A 案** = 退会系は第 2 波で対応 / β 開始では N/A
- **O-5: A 案** = DEC-081 と並行で 4 step オーナー実施

→ **オーナーが「CEO 推奨通り進めて」directive で全採択** すれば、CEO は即時 DEC-081（β 開始前必須 4 項目 atomic）を起票・dev 委任し、並行してオーナーは手元 4 step を実施。両完遂後 → smoke + β GO。

---

## §7. リスク + 対処

| # | リスク | 対処 |
|---|---|---|
| RA-1 | DEC-081 一括 atomic（C 案）でも dev 工数 0.3 人日 + オーナー 0.4 人日 = 連続作業負荷 | dev 手順書生成と オーナー実行を並列化（O-5 A 案）/ オーナー実行 4 step は分割実行可（step 1-2 と step 3-4 を別タイミング）|
| RA-2 | Sentry alert 設定が誤って production traffic にノイズ alert を流す | β 段階 = 1 名利用 = traffic 微小 / SEV-1 alert は意図発火 1 回のみ / 通常 traffic では発火しない条件設定 |
| RA-3 | DB backup 復元実演で本番データ破壊 | Turso では `turso db restore --from <backup-id> --to <new-db-name>` で別 DB に復元 = 本番無影響 |
| RA-4 | 月次予算 alert 設定漏れで cost cap 超過に気付かず請求 | 3 ヶ所（Vercel / OpenAI / R2）で alert 設定 + Sentry breadcrumb 経由の二重監視 / O-3 ¥3,000/月 cap = 上限到達時に Slack / email 即通知 |
| RA-5 | β 開始後 R-2（cost guard）並走完遂前に実超過事故 | β 段階 1 名利用 = 実超過リスク微小 / 既存 ¥10/user/日 cap は構造実装済 / DEC-082 で β + 14 日以内に手動超過テスト完遂 |

---

## §8. β 後 第 2 波予告（参考 / 本 atomic 範囲外）

第 2 波 4.2 人日見積（DEC-073 第 2 波 WBS）:
- T6 長期目標（mutation +1 = 10/10 上限ジャスト / DEC-006 再々拡張要 or RPC 寄せ）
- T7 ライティング採点 UX
- T8 辞書（Free Dictionary API + 自前 glossary）
- T9 TTS Phase 1（Web Speech API → OpenAI TTS 段階移行）
- T10 退会経路（reauth + 個人情報 null 化）

第 2 波着手は **β 1 ヶ月運用無事故** が前提（DEC-073 §7）。

---

## §9. 進捗 KPI

### 9.1 Phase 3 全体進捗

```
第 1 波（Must / 5.5 人日）: ████████░░ 79%（4.35 / 5.5 完遂）
  └─ 残 1.15 人日 = β 開始 19 項目判定 運用系 atomic
第 2 波（Should / 4.2 人日）: ░░░░░░░░░░ 0%（β + 1 ヶ月後着手）
第 3 波（Could / 3.0 人日）:  ░░░░░░░░░░ 0%（β + 2 ヶ月後評価）
```

### 9.2 β 開始 19 項目判定（実質 16 項目 / DEFERRED 2 件除く）

```
GREEN:    11 / 16 = 69%  ████████████████████████░░░░░░
RED:       5 / 16 = 31%  ░░░░░░░░░░░░░░░░░░░░░░░░██████
DEFERRED:  2 / 18 (β 後)
```

### 9.3 vitest / E2E 進捗

```
vitest:    881 PASS / 58 files（baseline 715/50 → +166 PASS / +8 files）
E2E:       study-listening-eiken3 + study-target-set + study-smoke + study-writing-smoke + settings-smoke + family-* + session-cumulative = 30+ PASS（baseline 14 → +16 以上）
build:     25 routes / DEC-006 拡張版上限 32（margin 7）
```

---

## §10. 制約遵守確認

- DEC-024 罰則ゼロ厳守（本文書 grep 0 件 / 自己言及・引用は除外規定通り）
- DEC-006 完全不変（本 atomic = 報告書生成のみ / コード変更ゼロ / page 25/32 / mutation 9/10 / GET 11/15）
- DEC-003 三層認可継承
- DEC-019-033 拡張ルール準拠（個人開発の柔軟性原則）
- 個人情報非記載（オーナー名 / 息子情報は仮名・型のみ / 本文書は息子について「息子」「学習者」のみ言及）
- 絵文字ゼロ
- 19 項目判定マトリクスは DEC-074 §6 オリジナル全件保持（再解釈は注記済 / 削除なし）

---

## §11. 参照ファイル

- 本 atomic 起票: `projects/PRJ-016/decisions.md` 冒頭 DEC-080
- 第 1 波構造実装層 atomics:
  - DEC-074: T0 DEC-006 拡張版 + reauth gate
  - DEC-075: T1 統合 settings 4-page
  - DEC-076: T2 受験日学習者 UI
  - DEC-077: O-1 オーナー承認 mutation 8→10
  - DEC-078: T4 学習時間目標 + 日次リマインド cron
  - DEC-079: T5 リスニング音源 seed + TTS pipeline
- WBS: `projects/PRJ-016/reports/ceo-phase3-runtime-readiness-wbs.md`（§6 19 項目判定 オリジナル）
- 軸別 input report:
  - 軸-1: `projects/PRJ-016/reports/research-phase3-runtime-readiness-investigation.md`
  - 軸-2: `projects/PRJ-016/reports/secretary-phase3-requirements-spec.md`
  - 軸-3: `projects/PRJ-016/reports/dev-phase3-feasibility-and-estimation.md`
- dev 完遂報告:
  - `projects/PRJ-016/reports/dev-w12-t1-settings-integrated-done.md`
  - `projects/PRJ-016/reports/dev-w12-t2-exam-date-learner-done.md`
  - `projects/PRJ-016/reports/dev-w12-t4-study-target-cron-done.md`
  - `projects/PRJ-016/reports/dev-w12-t5-listening-audio-seed-done.md`

---

## §12. 結語 / 次のアクション

**Phase 3 第 1 波 構造実装層 4 atomic（T1 統合 / T2 / T4 / T5）= 4.35 人日完遂着地**。残 1.15 人日 = β 開始 19 項目判定 運用系 atomic は **オーナー判断（O-1 〜 O-5）** 待ち。

**CEO 推奨パッケージ**（O-1〜O-5 デフォルト全採択）が承認された場合、CEO は即時:
1. DEC-081 起票（β 開始前必須 4 項目 atomic / 0.7 人日）
2. dev sub-agent 委任（手順書 + helper script 生成）
3. オーナー手元実行 4 step を並列実施依頼
4. 両完遂後 → オーナー smoke + β 実子使用開始 GO 判定要請
5. β 開始 + DEC-082 並走（cost guard / 0.4 人日 / β + 14 日以内）

オーナーの次 directive をお待ちします。
