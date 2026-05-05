# W12-T5 完遂報告 — β 開始用 リスニング音源 seed 投入 (DEC-079)

**日付**: 2026-05-05
**担当**: dev
**根拠**: DEC-079 (Phase 3 第 1 波 4 番目 / 1.5 人日 / mutation +0 / page +0 / data only)
**関連 DEC**: DEC-024 (罰則ゼロ) / DEC-029 (R2 smoke check) / DEC-055 (冪等) / DEC-074 (β 開始 19 項目判定 §6)

---

## 1. 実装サマリ

| 区分 | パス | 種別 |
|------|------|------|
| seed | `app/scripts/seed-problems-w5.ts` | NEW (480 行) — eiken-3 listening 20 問 (L3-001..L3-020) |
| mapper | `app/scripts/seed-id-mapper.ts` | MODIFY — `W5BundleShape` / `assignW5Ids` 追加 / total 822 → 842 |
| runner | `app/scripts/seed-problems-runner.ts` | MODIFY — 警告閾値 822 → 842 |
| TTS | `app/scripts/generate-tts-listening-3.ts` | NEW — voice=nova 専用 / cache key `tts/v1/{id}-nova.mp3` |
| URL apply | `app/scripts/apply-audio-urls-eiken3-listening.ts` | NEW — drizzle batch UPDATE / DRY_RUN gate |
| package | `app/package.json` | MODIFY — `ai:generate-tts-listening-3` / `db:apply-audio-urls-eiken3-listening` 追加 |
| unit | `app/tests/unit/seed-id-mapper.w5.test.ts` | NEW — 5 describe / 6 it |
| unit | `app/tests/unit/study.audio-gate.eiken3.test.ts` | NEW — 5 it (L3-XXX-nova URL 形式) |
| unit | `app/tests/unit/scripts.seed-id-mapper.test.ts` | MODIFY — total 822→842 / choice 652→672 |
| unit | `app/tests/unit/scripts.seed-runner.test.ts` | MODIFY — runSeed dry-run 822→842 |
| E2E | `app/tests/e2e/study-listening-eiken3.spec.ts` | NEW — audio gate + replay 3 回上限 |
| **fix** | `app/src/app/(app)/study/[levelCode]/[skillCode]/page.tsx` | **MODIFY (E2E 自己修復)** — `skill={skill}` ("listening-3") → `skill={skillBase}` ("listening") |

### 自己修復で発見した既存バグ (1 行 fix)

`page.tsx` line 246 で `<StudyClient skill={skill}>` に DB ID `"listening-3"` を渡していた。
`audio-gate.ts` の `shouldShowAudioUi` は `skill === "listening"` 完全一致を要求するため、
**全レベル / 全 listening 画面で audio UI が描画されない既存バグ**を E2E で検出。
URL skill code (= base) `skillBase` を渡すように修正 (1 行)。
他の `skill` prop 用途は無し ( `displayedView.skill` → `shouldShowAudioUi` のみ) のため副作用なし。
study-smoke (vocab) regression PASS で確認。

---

## 2. DRY_RUN 検証結果

### seed (db:seed DRY_RUN)
- total **842** ✓ (200 + 401 + 221 + 20)
- choiceProblems **672**, writingProblems 100, reorderProblems 30, readingPassageProblems 40 ✓
- L3-001 〜 L3-020 すべて level=eiken-3 / skill=listening / audio_transcript 30〜100 chars ✓
- 罰語 (失敗 / サボ / ダメ / 悪い) 0 件 ✓

### TTS (ai:generate-tts-listening-3 DRY_RUN)
- target=20 / voices=[nova] / total chars=1467
- 推定コスト約 **$0.022 ≒ ¥3.30** (tts-1 $15/1M chars 換算)
- pingR2 (DEC-029) 実行不要 (DRY_RUN は OpenAI/R2 を呼ばない)

### audio_url サンプル
```
problem_id=L3-001 audio_url=https://<R2_PUBLIC>/tts/v1/L3-001-nova.mp3
problem_id=L3-020 audio_url=https://<R2_PUBLIC>/tts/v1/L3-020-nova.mp3
```

---

## 3. オーナー実行手順 (Agent 環境では実行禁止)

ローカルに `.env.local` (OPENAI_API_KEY / R2_* / TURSO_DATABASE_URL) が揃っていることを確認した上で:

```bash
# (1) seed 投入 (842 件 / 同一 id は INSERT OR IGNORE で skip)
cd projects/PRJ-016/app
npm run db:seed-problems

# (2) TTS 生成 (R2 へ 20 mp3 アップロード / 約 ¥3.30)
npm run ai:generate-tts-listening-3

# (3) DB へ audio_url を batch UPDATE (冪等)
npm run db:apply-audio-urls-eiken3-listening
```

事前に dry-run で確認したい場合:
```bash
DRY_RUN=1 npm run ai:generate-tts-listening-3
DRY_RUN=1 npm run db:apply-audio-urls-eiken3-listening
```

---

## 4. 品質ゲート結果

| ゲート | 結果 |
|--------|------|
| typecheck (`tsc --noEmit`) | PASS |
| lint | PASS |
| vitest | **881 PASS / 58 files PASS** (前回 868 → +13) |
| build | PASS (page 25 / DEC-006 上限 32 内) |
| E2E (`study-listening-eiken3.spec.ts` chromium) | **PASS** |
| E2E (`study-listening-eiken3.spec.ts` mobile-chrome) | **PASS** |
| E2E regression (`study-smoke.spec.ts` chromium) | PASS |
| 罰語ゼロ grep (DEC-024) | 0 件 |
| 上限不変 (DEC-006) | page 25 / mutation 9 / GET 11 (data only / 変動なし) |

---

## 5. β 開始 19 項目判定への影響 (DEC-074 §6)

- **「リスニング音源最低 1 セット seed 投入」**: 20 問 (L3-001..L3-020) で達成 ✓
- 残課題: オーナーが上記 3 ステップを本番で実行 → audio_url が問題行に設定 → β user の `/study/eiken-3/listening` で再生可

---

## 6. 確認事項 / 注意点

1. **既存 audio gate バグの恒久 fix を含めた**ため、レビューの際は `page.tsx` 1 行差分も合わせて確認願います。
2. cache key 命名 `tts/v1/{id}-{voice}.mp3` は `generate-tts-listening-3.ts` と `apply-audio-urls-eiken3-listening.ts` で一致しています (DEC-079 / DEC-055 冪等)。voice 追加時は両方を必ず同時更新すること。
3. R2 公開 URL 未設定 (`R2_PUBLIC_URL` 不在) のまま apply を実行すると skip されます (warn ログ出力)。

---

## 7. 未解決事項

なし (E2E 自己修復で全 ゲート GREEN)。
