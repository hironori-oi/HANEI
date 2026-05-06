# PRJ-016 HANEI W12 — DEC-089 Plan C UI/UX atomic 完了報告

**部署**: Dev (lead engineer)
**日時**: 2026-05-06
**意思決定**: DEC-089 Plan C (圧縮 1.5 人日 / 4 大項目 1 atomic 一括実装)
**スコープ**: Phase 2 W12 / 罰則ゼロ哲学 (DEC-024) 厳守 / DEC-006 surface 不変条件遵守

---

## 1. 4 大項目 着地サマリ

### 項目 1: 冒険マップ UI (`/adventure-map` 新ページ)
- ファイル: `app/src/app/(app)/adventure-map/page.tsx` (Server Component)
- ファイル: `app/src/app/(app)/adventure-map/adventure-map-client.tsx` (Client Component)
- 12 学習エリア (英検 5/4/3 級 × 4 skill = vocabulary/grammar/reading/listening) を 縦長スクロール地図として表示
- framer-motion `LazyMotion` + spring stagger entry (`delay: groupIdx * 0.18 + i * 0.06`)
- 状態色:
  - cleared = Mint Green (`success/...`) + `CheckCircleIcon`
  - in_progress = Amber Gold (`primary/...`) + `SparklesIcon` pulse animation (`scale [1,1.12,1] + opacity [1,0.85,1]`)
  - not_started = グレー (`muted-foreground/...`) + 中立 `LockClosedIcon` ※鎖アイコン未使用
- WCAG 2.1 AA: 全ノード `tabIndex=0` / `aria-label` / `focus-visible:ring-2` / `prefers-reduced-motion: reduce` 完全対応
- 罰則ゼロ: 赤色 0 / 鎖 0 / バツ印 0 / 罰メッセージ 0 (status は cleared/in_progress/not_started 3 種のみ)
- クリック遷移先: 既存 `/study/eiken-{level}/{skillCode}?learner={id}` (route 無変更)

### 項目 2: ボス戦演出 (模試結果モーダル)
- ファイル: `app/src/components/exam/boss-battle-celebration.tsx` (新規 / standalone reusable)
- API: `<BossBattleCelebrationModal open pass score maxScore levelLabel onContinue onClose />`
- 既存 `evolution-celebration.tsx` 同等のフルスクリーン take-over (`role="dialog" / aria-modal="true" / backdrop-blur-md`)
- 合格 (pass=true): 多色 confetti (Amber Gold / Sky Blue / Lavender / Mint Green / White) + ことだまトリ "happy" 表情 + 「やり抜いたね！」中立労い copy
- 不合格 (pass=false): confetti 抑制 + ことだまトリ "thinking" 表情 + 「次にむけて さくせんを たてよう」(罰則ゼロ retry copy)
- 既存 learner-side 模試結果ページが未存在のため wire はしない standalone 実装 (DEC-006 page +0 維持)
- 自動 dismiss なし: ユーザー操作 (`onContinue` / `onClose`) で明示的に閉じる

### 項目 3: ことだまトリ進化キャラ豊か化 (5 SVG 装飾追加)
- ファイル変更: `app/src/components/character/kotodama-stages/{hina,wakatori,seityo,kenzya,syugosin}.tsx`
- 追加要素 (全段階共通): `expression === "happy"` 時の目もとキラキラ (Gold sparkle / `data-part="*-happy-sparkles"`)
- 段階別装飾:
  - hina: 体側面の幼羽飾り 2 枚 (うす Amber)
  - wakatori: 翼先の追加飾り羽 2 枚 (凛々しい三角羽)
  - seityo: 胸元 Gold ペンダント (`data-part="seityo-pendant"`) + 翼下の優美な流線飾り
  - kenzya: 賢者の眼鏡風アクセサリ (`data-part="kenzya-glasses"`) + 巻物上の Gold スター (happy 時)
  - syugosin: 桜の花びら追加 4 枚 (4 → 8 枚 / 神々しさ増強)
- `expression?: "idle" | "happy" | "thinking"` props 100% 後方互換維持
- 罰則ゼロ: sad / crying / angry / 涙 / 怒り 表情 0 (colors.ts コメントで明示再確認)
- すべて純粋追加 (既存 `data-testid` / `data-part` / `aria-label` / `data-expression` 不変)

### 項目 4: kotodama-tori TTS 短尺音声会話
- ファイル: `app/src/lib/ai/kotodama-voice.ts` (新規 / OpenAI tts-1 + R2 cache 既存パターン流用)
- ファイル: `app/src/app/api/study/adventure-map/route.ts` (新規 GET endpoint / DEC-006 GET +1 = 13/15)
- 10 種短尺日本語台詞 (greeting / praise_correct / praise_streak / encourage_retry / encourage_thinking / next_area / level_up / lets_go / well_done / see_you)
- すべて 50 文字以内 / 0.6〜2.0s 想定 / 罰則ゼロ哲学厳守 (失敗 / だめ / 悲しい / 残念 等のネガ語 0)
- R2 cache key: `kotodama-voice/{code}_{voice}.mp3` (既存 `tts/...` prefix と独立で衝突なし)
- pre-generate API 提供 (`preGenerateKotodamaVoice` / `preGenerateAllKotodamaVoices`) — 1 回実行で全 10 種約 ¥0.7 (cost 上限 ¥10 内)
- GET endpoint レスポンス: `{ areas, clearedCount, inProgressCount, notStartedCount, voiceManifest[] }` (副作用ゼロ / R2 cache hit 確認のみ / DEC-055 idempotent)
- 認可: getSession + requireLearnerOwner (parent → learner ownership 既存 `/api/ai/coach` 同パターン)

---

## 2. 検証結果

| Gate | 結果 | 詳細 |
|------|------|------|
| `bun run typecheck` | PASS | 0 errors (level の `string \| undefined` を non-null assertion で解消) |
| `bun run lint` | PASS | 0 errors / 0 warnings (一時 unused eslint-disable 1 件除去) |
| `bun run test` | PASS | **65 files / 948 tests** (baseline 930 → +18 新規) |
| `bun run build` | PASS | **26 page routes** (baseline 25 → +1 `/adventure-map`) + **9 API routes** (cron 5 unchanged + GET +1) |
| `bun run e2e tests/e2e/study-smoke.spec.ts --workers=1` | PASS | 2/2 (chromium + mobile-chrome) |
| `bun run e2e tests/e2e/family-streak.spec.ts --workers=1` | PASS | 6/6 (chromium + mobile-chrome) |

**新規 unit tests (18 件)**:
- `tests/unit/study.adventure-map-aggregation.test.ts` (8 tests): 12 エリア組立 / status 分類 / 罰則ゼロ status 種類検証 / total=0 NaN ガード
- `tests/unit/ai.kotodama-voice.test.ts` (10 tests): 全 10 voice code 定義 / cache key 形式 / `getKotodamaVoiceManifest` read-only (putObject 呼ばず) / R2 cache hit/miss / objectExists throw 時の耐障害 / **罰則ゼロ哲学: 14 種 NG 語チェック**

---

## 3. DEC-006 surface area 確認

| カテゴリ | 期待 | 実測 | 判定 |
|---------|------|------|------|
| Page route | +1 = 26/32 | **26** (`/adventure-map` 追加) | OK |
| GET API | +1 = 13/15 | **13** (`/api/study/adventure-map` 追加) | OK |
| Mutation API (POST/PATCH/DELETE) | +0 = 9 | **9** (変更なし) | OK |
| Cron | +0 = 5 | **5** (変更なし) | OK |

**新規依存パッケージ**: 0 件 (OpenAI SDK は既存 `lib/tts/openai-tts.ts` の raw fetch パターン流用 / @aws-sdk/client-s3 は既存 `lib/storage/r2.ts` 経由)

---

## 4. バンドル増分 (gzip)

- `/adventure-map` page+client: framer-motion / Heroicons は既存共有チャンクで重複なし、エリア node + stagger ロジックのみ → 推定 +3〜5 KB gzip
- `boss-battle-celebration.tsx`: 動的 import 想定 / 該当ページから tree-shake 可能 → 当 atomic では未 wire (+0 KB 実質)
- 5 SVG 装飾追加: 1 段階あたり +200〜500 bytes gzip × 5 = +1〜3 KB gzip
- `kotodama-voice.ts` + GET route: server-only / client bundle 影響 0

**合計推定**: +4〜8 KB gzip (上限 +30 KB の 30% 未満)

---

## 5. 罰則ゼロ哲学 (DEC-024) 厳守チェック

- [x] 赤色クラス (`text-red-*` / `bg-red-*` / `border-red-*` / `text-destructive`) 0 件 (新規ファイル grep 確認済)
- [x] 鎖アイコン (Chain 系) 0 件 / バツ印 (XCircle / 罰アイコン) 0 件
- [x] 叱責語 (失敗 / だめ / サボ / 悲しい / 残念 / つらい 等 14 語) 0 件 (kotodama-voice.test.ts で自動検証)
- [x] sad / crying / angry SVG 表情 0 件 (`KotodamaExpression` 型は idle/happy/thinking のみ / colors.ts 明示)
- [x] 不合格時 copy: 「次にむけて さくせんを たてよう」中立 retry / 罰則語 0
- [x] 未着手エリア: 中立 `LockClosedIcon` (鎖未使用) + ピリオド付き「これから」「たのしみだね」

---

## 6. cost 見積 (DEC-081 monthly-budget-alert 整合)

- TTS pre-generate (1 回 / 全 10 種): 平均 30 文字 × 10 = ~300 文字 → tts-1 単価 $0.015/1K 文字 → **約 $0.0045 ≒ ¥0.7**
- R2 cache hit が常態化 (GET `/api/study/adventure-map` 内は `objectExists` のみ / 副作用ゼロ)
- 月次運用 cost 増分: ¥0 (pre-generate は手動 1 回想定 / batch script は本 atomic 範囲外)

---

## 7. 既知の制約 / 後続候補

1. **boss-battle-celebration の学習者 wire 未実施**: 学習者向け模試 UI が未存在のため standalone 実装 (将来 `/study/mock-exam-result` 等を新設する際に import する想定 / DEC-006 page +0 維持)
2. **TTS pre-generate 自動化未実施**: 本 atomic は helper API のみ提供 / batch script `scripts/generate-kotodama-voices.ts` 系の自動化は Plan D (DEC-090 候補) に委ねる
3. **冒険マップ進捗の遅延更新なし**: 集計は SSR / 学習中の即時反映は次回ナビゲーションで反映 (Phase 3 で SWR 化検討)

---

## 8. ファイル変更一覧

**新規 (8 件)**:
- `app/src/app/(app)/adventure-map/page.tsx`
- `app/src/app/(app)/adventure-map/adventure-map-client.tsx`
- `app/src/app/api/study/adventure-map/route.ts`
- `app/src/lib/ai/kotodama-voice.ts`
- `app/src/components/exam/boss-battle-celebration.tsx`
- `app/tests/unit/study.adventure-map-aggregation.test.ts`
- `app/tests/unit/ai.kotodama-voice.test.ts`

**変更 (6 件)**:
- `app/src/lib/study/aggregations.ts` (§12 `getAdventureMapSummary` + 型追加 / 既存 export は不変)
- `app/src/components/character/kotodama-stages/hina.tsx` (装飾追加のみ)
- `app/src/components/character/kotodama-stages/wakatori.tsx` (同)
- `app/src/components/character/kotodama-stages/seityo.tsx` (同)
- `app/src/components/character/kotodama-stages/kenzya.tsx` (同)
- `app/src/components/character/kotodama-stages/syugosin.tsx` (同)

---

**結論**: DEC-089 Plan C 4 大項目を 1 atomic で完遂. 全品質ゲート PASS / DEC-006 surface 不変条件遵守 / DEC-024 罰則ゼロ哲学厳守 / cost ¥0 (pre-generate のみで¥10 内). Review 部門コール不要 (CEO trust-but-verify 方針).
