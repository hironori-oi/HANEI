# DEC-094 atomic 完遂報告 (Dev / W12 / 2026-05-06)

## 実施内容

DEC-093 で UI 救済 (preparing) は済んでいたが、production Turso DB の `(level=3 / skill=grammar-3)` と `(level=3 / skill=listening-3)` に問題が **0 件** で β 試用継続不可だった真因 (seed 未投入) を、**W5 (DEC-079) を完全な precedent としてコピー** する形で 60 問追加投入し、β 阻害最終ピースを解消した。

- **A. 新規 seed 60 問 (W6)**
  - **A-1. grammar-3 30 問 (G3-001..030)**: 4 択 mcq / 「(   )」空欄補充。範囲 = 現在完了 / 受動態 / 関係詞 / 比較 / 動名詞 vs 不定詞 / 過去進行形 / 助動詞 / 間接疑問 / there is/are / 付加疑問 / it is ... to do / want O to do / make O C。correct_index 分散 0:8 / 1:7 / 2:8 / 3:7。difficulty 分散 0 5 / 1 18 / 2 7。
  - **A-2. listening-3 30 問 (L3-021..050 / W5 と連番接続)**: listening_mcq + audio_transcript 30-100 chars。場面 14 = 学校 / 家族 / 季節 / 食事 / 趣味 / 数字 / 時間 / スポーツ / 動物 / 色 / 天気 / 旅行 / 病気 / 道案内。correct_index 分散 0:8 / 1:7 / 2:8 / 3:7。difficulty 分散 0 4 / 1 18 / 2 8。
- **B. mapper 拡張**: `assignW6Ids` 関数追加 + `loadAllSeedIds()` 内に W6 import + merge 追加 / 累計 842 → **902** 更新。
- **C. seed-runner expected count 更新**: 警告閾値 842 → 902 / ヘッダコメント更新。
- **D. テスト更新 / 新規**: W5 baseline 更新 + W6 新規 12 ケース (correct_index 分散 + 罰語ゼロ grep 含む) + scripts.seed-id-mapper / scripts.seed-runner baseline 更新。
- **E. TTS / R2 / DB apply 対応**: `loadAllSeedIds` から自動 filter する設計のため両スクリプト本体の変更不要。**ヘッダコメントのみ更新** (20 問 → 50 問 / DEC-079 + DEC-094)。
- **F. cron 起動原因調査**: 結論を decisions.md DEC-094 §F に記録 (3 行サマリ)。
- **G. decisions.md DEC-094 起票**: §背景 / §スコープ / §採番 / §β 阻害解消ロジック / §リスク・代替案 / §実装完遂デルタ 全 section 追加。

## 成果物

- `app/scripts/seed-problems-w6.ts` (NEW / 30 grammar + 30 listening)
- `app/scripts/seed-id-mapper.ts` (UPDATED / `assignW6Ids` + `loadAllSeedIds` W6 merge + 累計 902)
- `app/scripts/seed-problems-runner.ts` (UPDATED / 902 baseline / ヘッダコメント)
- `app/scripts/generate-tts-listening-3.ts` (UPDATED / ヘッダコメントのみ / 50 問対応記載)
- `app/scripts/apply-audio-urls-eiken3-listening.ts` (UPDATED / ヘッダコメントのみ / 50 問対応記載)
- `app/tests/unit/seed-id-mapper.w5.test.ts` (UPDATED / W5 filter 厳密化 + baseline 902 / 732 / 882)
- `app/tests/unit/seed-id-mapper.w6.test.ts` (NEW / 12 ケース / W5 同型 + 罰語ゼロ grep + 分散検査)
- `app/tests/unit/scripts.seed-id-mapper.test.ts` (UPDATED / 842 → 902 / 672 → 732)
- `app/tests/unit/scripts.seed-runner.test.ts` (UPDATED / 842 → 902)
- `projects/PRJ-016/decisions.md` (UPDATED / DEC-094 entry 起票 + §実装完遂デルタ)

## 検証結果

- **typecheck**: PASS (`bun run typecheck` / warning 0)
- **lint**: PASS (`bun run lint` / warning 0)
- **vitest**: **990 passed / 67 files / 0 fail / Duration 6.42s** (DEC-093 baseline 978 → DEC-094 990 / +12 = W6 新規 12 ケース)
- **next build**: SUCCESS (Compiled in 10.5s / **35 routes 全 PASS**)
- **DRY_RUN seed-runner**: **total=902 / inserted=902 / skipped=0** (60 件追加確認)
  - G3-001..030 (30 件) + L3-021..050 (30 件) = 60 件が `[dry-run] would insert` で確認済
- **DEC-024 罰語ゼロ自動検証**: W6 unit test の `BAN_WORDS grep` (失敗 / サボ / ダメ / 悪い) で 60 問全件 PASS
- **TTS / R2 / DB apply は実 OpenAI / R2 / Turso 課金が必要なため Agent 環境では未実行**。オーナーがローカルで実行する必要あり。

## オーナー次アクション (本 PR merge + Vercel deploy 後 / ローカル実行)

1. `npm run db:seed` (Turso production / 60 件 inserted 想定 + 既存 842 件は skip)
   - 既存 W5 listening-3 が production に未投入の場合は **80 件 inserted** (W5 20 + W6 60)
2. `npm run ai:generate-tts-listening-3` (OpenAI tts-1 / 50 件 / 推定 ¥10 程度)
   - 既に R2 にあれば skip / DEC-055 冪等
3. `npm run db:apply-audio-urls-eiken3-listening` (audioUrl mapping / 50 件)
4. アプリで eiken-3 grammar / listening を解いて確認

## cron 起動原因 (§F 結論 / 3 行サマリ)

1. `src/app/api/cron/generate-problems/route.ts` L73 で `generateEiken5VocabProblem()` をハードコード呼び出し → eiken-5 vocab 以外は queue 投入しても auto-generate されない (Phase 1 設計 / Phase 2 で skill/level 動的化予定だが未実装).
2. さらに `generated_problems_queue` 行が grammar-3 / listening-3 用に投入されていない可能性高 (queue 投入機構と cron 動的化が両方 Phase 2 後半 = 二段階で未到達).
3. listening は cron で TTS pipeline 統合も未実装 = audio_url を auto attach する仕組みなし (W12 で手動スクリプト `generate-tts-listening-3` + `apply-audio-urls-eiken3-listening` で先行投入).

→ DEC-094 では cron 修復 scope out / 本 atomic で seed 投入で β 阻害先送り解消 / Phase 2 後半で cron skill/level 動的化を別 PRJ で計画.

## 既知制約 / 未対応

- cron skill/level 動的化 + queue 投入機構 + TTS pipeline 統合は Phase 2 後半で別案件 (Vercel cron + LLM-as-Judge skill/level 動的化 / DEC-077 後継候補)
- TTS voice は nova 1 本のまま (DEC-079 / β + 1 ヶ月評価で多 voice 拡張判断)
- 読解 (eiken-3 reading) は既に R3-001..050 で 50 問 seed 済 / 不足判明時に別 atomic
