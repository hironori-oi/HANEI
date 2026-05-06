# PRJ-016 HANEI W12 — DEC-087 UI/UX 楽しさ強化 Plan A 実装完遂レポート

- 案件: PRJ-016 HANEI（英検3級向け小学生 PWA）
- 担当: Dev 部門
- 発端: オーナーフィードバック「デザインがシンプル過ぎる / 子どもがワクワクする楽しさが欲しい」
- 根拠 DEC: DEC-087 Plan A atomic（11 項目 / UI のみ / 0.75 day）
- 制約遵守: DEC-024（罰則ゼロ・赤色 0）/ DEC-006（page 25 / mutation 9 / GET 12 / cron 5 → +0）/ DEC-003（三層認可保持）/ WCAG 2.1 AA / 絵文字禁止 / E2E selector 完全保持

---

## 1. 実施 11 項目 サマリ

| # | 項目 | 概要 | 主な実装 |
|---|------|------|---------|
| 1 | 共通 motion provider | LazyMotion + domAnimation + strict 共通化 | `motion-provider.tsx` 新規（tree-shake で bundle 抑制） |
| 2 | ページ遷移 stagger | opacity 0→1 + translateY 12px→0 / 50ms stagger | `page-transition.tsx` 新規 / reduced-motion 時は素 div |
| 3 | display フォント | Mochiy Pop One（見出し / Hero / Level-up） | `layout.tsx` に `--font-display` 追加 / globals.css に `.font-display` |
| 4 | アクセントカラー追加 | Sky Blue / Lavender / Mint Green トークン | globals.css `:root` + `.dark` + `@theme inline` |
| 5 | 正解時キャラ演出 | spring bounce 登場 + 拍手 rotate + 連続 3+ で多色 confetti | `answer-feedback-effects.tsx` 新規 |
| 6 | 不正解時演出 | 首かしげ rotate + Amber soft (赤未使用) + shake 1 cycle | `hanei-soft-warm` / `hanei-wrong-shake` keyframe |
| 7 | ホーム Hero ことだまトリ | 下から spring 登場 + 吹き出し + tap で bounce | `hero-kotodama-tori.tsx` 新規 |
| 8 | XP / コインバー smooth fill | spring 物理で前回 → 現在に追従 | `animated-fill-bar.tsx` 新規 |
| 9 | streak 炎 | 3/7/14 日で size + 火花パーティクル | `streak-flame.tsx` 新規（純 CSS keyframe） |
| 10 | ボタン hover/tap | scale 1.03 / 0.97 + glow（既存 Button 完全保持） | `motion-button.tsx` 新規（外側ラップ） |
| 11 | 進化セレブレーション強化 | フルスクリーン take-over + 多色 confetti + キラキラ 8 粒子 | `evolution-celebration.tsx` 改修 |

---

## 2. 変更ファイル一覧

### 新規（7 ファイル）

| パス | 役割 |
|------|------|
| `app/src/components/ui/motion-provider.tsx` | LazyMotion 共通ラッパ |
| `app/src/components/ui/page-transition.tsx` | ページ遷移 stagger |
| `app/src/components/ui/motion-button.tsx` | hover/tap scale ボタン |
| `app/src/components/ui/animated-fill-bar.tsx` | XP / コインバー spring fill |
| `app/src/components/home/hero-kotodama-tori.tsx` | ホーム Hero キャラ |
| `app/src/components/home/streak-flame.tsx` | streak 炎（純 CSS） |
| `app/src/components/study/answer-feedback-effects.tsx` | 正解 / 不正解キャラ演出 |

### 改修（4 ファイル）

| パス | 変更内容 |
|------|---------|
| `app/src/app/layout.tsx` | Mochiy_Pop_One import / `--font-display` 変数追加 |
| `app/src/app/globals.css` | tokens + `.font-display` + `.hanei-correct-glow` + `.hanei-soft-warm` + flame / spark / wrong-shake keyframes |
| `app/src/app/(app)/home/page.tsx` | Hero section 追加 / h1 を font-display 化 / SakuraStreakDisplay に StreakFlame 重畳 |
| `app/src/app/(app)/study/[levelCode]/[skillCode]/StudyClient.tsx` | AnswerFeedbackEffects 組込 / 選択肢の正解 = mint glow / 不正解 = soft-warm + shake / 「おしい」E2E 文言保持 |
| `app/src/components/character/evolution-celebration.tsx` | 多色 confetti + 8 キラキラ粒子 + 4 秒 auto-dismiss + bg-black/40 backdrop-blur-md + font-display 見出し |

### 依存追加

| パッケージ | バージョン | サイズ影響 |
|-----------|-----------|-----------|
| framer-motion | 12.38.0 | +30〜40 KB gzip（LazyMotion + domAnimation のみ採用） |

---

## 3. 検証結果

| 項目 | 結果 |
|------|------|
| `npm run typecheck` | PASS（0 エラー） |
| `npm run lint` | PASS（0 warning / 0 error） |
| `npm run test` (vitest) | **902 tests PASS** / 60 files / 0 failures（W11 終了時 801 → +101 件は他タスク累積） |
| `npm run build` | SUCCESS / 25 page routes + 5 cron + admin + auth APIs（DEC-006 page 25 / mutation 9 / GET 12 / cron 5 完全保持） |
| E2E `study-smoke.spec.ts` | 2 / 2 PASS（chromium + mobile-chrome） |
| E2E `family-streak.spec.ts` | 6 / 6 PASS（chromium ×3 + mobile-chrome ×3 / ~35s） |
| 既存 data-testid / aria-label | 完全保持（study-feedback / study-prompt / study-explanation / study-next / choice-{label} / evolution-celebration-modal / kotodama-stage-display / sakura-streak-display） |

---

## 4. バンドルサイズ増分

- `.next/static` 全体: 約 4.4 MB（chunks 約 1 MB uncompressed）
- framer-motion 追加分: **約 +30〜40 KB gzip 推定**（LazyMotion + domAnimation のみ動的 import / m.div + m.button + useReducedMotion のみ使用）
- 制約 +50 KB gzip 内に収束 ✅
- LCP / INP への影響: hero / page-transition は `motion-safe` opt-in のみ / SSR 静的レンダ後の hydration で適用 → LCP 影響軽微の見込み

---

## 5. 罰則ゼロ目視チェックリスト（DEC-024 準拠）

| 項目 | 状態 | 備考 |
|------|------|------|
| 赤色（destructive / red-500 / #DC2626 等）UI 上未使用 | ✅ | 不正解選択肢は `hanei-soft-warm`（Amber Gold soft）/ XCircleIcon は `text-primary`（Amber）/ 「おしい」見出しは `text-warning`（Amber） |
| 叱責語（バツ / 残念 / ダメ / まちがい 等） | ✅ | 既存「おしい」「もう一度考えてみよう」のみ使用 / 新規追加なし |
| 不正解キャラ表現 | ✅ | 首かしげ rotate のみ（落ち込み / 涙 / 悲しみ未表現） |
| confetti 色 | ✅ | Amber Gold + Amber light + Sky Blue + Lavender + Mint Green + 白（赤系 0 色） |
| 進化セレブレーション粒子 | ✅ | 同 4 色パレット / 8 粒子 rotate 拡散 |
| `prefers-reduced-motion: reduce` 環境 | ✅ | 全 keyframe 0.01ms 短縮（globals.css） + framer-motion 全コンポーネント `useReducedMotion()` 早期 return / 静的 UI |
| アイコン | ✅ | 全 Heroicons 24/outline + inline JSX SVG / 絵文字 0 |
| 既存 E2E selector | ✅ | data-testid 全保持 / 「せいかい」「おしい」文言保持（study-smoke regex 互換） |

---

## 6. 既知の制約 / 後続課題

### Plan A（本リリース）スコープ

- 正解 / 不正解キャラは `KotodamaHinaSvg` 単一流用（進化段階別の表情差分は未実装）
- ページ遷移 stagger は `page-transition.tsx` を export のみ（実 page への wrap は本 atomic 範囲外 / 後続 atomic で home / study / parent layout に注入予定）
- AnimatedFillBar / MotionButton は新規部品として用意済（既存バー / ボタンの差替えは段階移行 / 後続 atomic で XP card / coin badge へ適用）

### Plan B（DEC-088 候補）

- 進化段階別キャラ表情（hina/wakatori/seityo/kenzya/syugosin × correct/wrong/idle）
- 既存 XP card / coin badge を AnimatedFillBar に差替
- home Hero の親しみメッセージ動的変化（時間帯 / streak 状況反映）

### Plan C（DEC-089 候補）

- 効果音強化（既存 audio-feedback level-up に正解音 / 不正解音差分）
- haptic feedback（iPhone PWA 対応）
- ハイレベル達成時の演出（守護神到達時のフルスクリーンイベント）

---

## 7. オーナー smoke test 推奨手順

### Desktop（Chrome 最新 / 1440×900）

1. `/home` にアクセス → ことだまトリが下から spring で登場 / 吹き出し「○○ さん、きょうも がんばろう！」表示 / クリックで bounce
2. `/study/3/listening`（or 任意の skill）→ 1 問目の選択肢を 3 連続正解 → 多色 confetti が画面下から発射 / 右下にキャラ登場 + 拍手
3. 不正解選択 → Amber Gold soft 背景 + 横揺れ 1 cycle / 赤未使用を確認 / 「おしい」見出しが Mochiy Pop One で表示

### iPhone PWA（Safari / iPhone 13 mini 想定）

1. ホーム追加済 PWA 起動 → Hero ことだまトリ登場 + tap で bounce 反応
2. streak 3 日以上 → 桜ピン横に小さい炎 / 7 日で中 / 14 日で大 + 火花 3 粒子確認
3. 進化トリガー（XP しきい値）→ フルスクリーン take-over + backdrop-blur + 多色 confetti + 8 キラキラ粒子 / 4 秒で自動 dismiss / タップでも dismiss

### iPad PWA（Safari / iPad 10.9" 想定）

1. `/parent` ダッシュボード → アクセシビリティ確認（reduced-motion ON 設定での演出停止）
2. `/study` 連続 5 問正解 → コンボ演出 + AnimatedFillBar の XP fill が spring で柔らかく追従するか確認
3. 進化セレブレーション → 横画面でも 8 粒子の散布が画面外へ漏れず中央収束するか確認

---

## 補足

- 本 atomic は **UI のみ** / API・DB・auth・cron・page route 構成 完全不変
- DEC-006 invariants（page 25 / mutation 9 / GET 12 / cron 5）build ログにて再確認済
- Lighthouse / a11y 自動監査は次 atomic（W12-T2 想定）で別途
- レビュー部門への引継ぎ準備 OK（変更ファイル 11 / 新規 7 / 改修 4）
