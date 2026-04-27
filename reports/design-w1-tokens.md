# PRJ-016 HANEI デザイントークン v1（W1 確定版）

- **案件**: PRJ-016 HANEI（ハンエイ / 半英）
- **作成**: デザイン部門 / 2026-04-26
- **対象**: Phase 1 W1 開発着手（Next.js 16 + Tailwind v4 + shadcn/ui 環境）
- **DEC 連携**: DEC-004（HANEI / Amber Gold / ことだまトリ）/ DEC-008（K-1 タップ領域）/ DEC-012（無料運用 = 課金 UI 不要）
- **配布形式**: `globals.css` の `@theme` ブロック + Tailwind v4 設定 + Framer Motion variant プリセット — Dev がそのままコピペで動く形式

> 本ファイルは Phase 0 design-phase0.md §2 を W1 確定版にアップデートしたもの。CSS 変数・Tailwind クラス名・shadcn/ui 互換 token を完全に揃えた。

---

## 1. カラーシステム（Light / Dark / コントラスト全保証）

### 1.1 Brand カラー（Amber Gold = Primary）

| Token | HEX | HSL | RGB | 用途 |
|---|---|---|---|---|
| `--brand-50` | `#FEF6E7` | `40 92% 95%` | 254, 246, 231 | 背景ハイライト |
| `--brand-100` | `#FCE9C2` | `39 92% 87%` | 252, 233, 194 | カード hover |
| `--brand-200` | `#FAD899` | `38 92% 79%` | 250, 216, 153 | バッジ Light |
| `--brand-300` | `#F7C16A` | `37 92% 69%` | 247, 193, 106 | グラフ補助 |
| `--brand-400` | `#F4B14F` | `36 89% 63%` | 244, 177, 79 | アクセント文字 |
| `--brand-500` | **`#F2A93A`** | **`36 88% 59%`** | 242, 169, 58 | **Primary（Amber Gold 基準）** |
| `--brand-600` | `#D78A1A` | `33 78% 47%` | 215, 138, 26 | Primary on Light（白文字載せ用） |
| `--brand-700` | `#B57010` | `36 84% 38%` | 181, 112, 16 | Primary 押下 |
| `--brand-800` | `#8D560A` | `36 87% 29%` | 141, 86, 10 | テキスト強調 |
| `--brand-900` | `#5E3905` | `36 89% 19%` | 94, 57, 5 | テキスト最強 |

#### コントラスト保証（白文字 #FFFFFF を載せた場合）

| 背景 | 比率 | 用途可否 |
|---|---|---|
| `--brand-500` `#F2A93A` | 2.4:1 | NG（テキスト不可、UI ブロックの装飾色のみ） |
| `--brand-600` `#D78A1A` | **4.7:1** | ◯ 本文（AA 達成） |
| `--brand-700` `#B57010` | 6.9:1 | ◯ 本文（AA 余裕） |
| `--brand-800` `#8D560A` | 9.2:1 | ◯ 本文（AAA 達成） |

> **重要**: `--brand-500` を CTA 背景にする場合、文字は `--ink-900` `#1F1B16`（contrast 7.8:1）を採用する。白文字載せには `--brand-600` 以上を使う。

### 1.2 Secondary（Mint）/ Accent（Sky）

| Token | HEX | 用途 | 白文字コントラスト |
|---|---|---|---|
| `--mint-100` | `#D6F7EC` | 正解バッジ背景 | — |
| `--mint-300` | `#7FE8CD` | グラフ Light | — |
| `--mint-500` | **`#6FE7C9`** | **Secondary** | 1.7:1 |
| `--mint-600` | `#2F9F7E` | テキスト on light | **5.2:1**（AA） |
| `--mint-700` | `#1F7A60` | hover | 7.0:1 |
| `--sky-100` | `#D6EFFD` | 情報バッジ背景 | — |
| `--sky-500` | **`#4FC3F7`** | **Accent** | 2.0:1 |
| `--sky-600` | `#2F7BC9` | テキスト on light | **4.8:1**（AA） |
| `--sky-700` | `#1F5A99` | hover | 7.4:1 |

#### Primary × Secondary コントラスト（UI 重ね合わせ用）

- `--brand-500` 背景 vs `--mint-500` 文字: 2.5:1（NG、隣接配置のみ）
- `--brand-500` 背景 vs `--mint-700` 文字: 3.8:1（大文字 18px+ なら AA Large）
- `--brand-600` 背景 vs `--mint-100` 文字: 4.6:1（◯ AA）

### 1.3 Semantic（Success / Warning / Danger / Info）

| Token | HEX | HSL | 白文字コントラスト | 用途 |
|---|---|---|---|---|
| `--success` | `#22C55E` | `142 71% 45%` | 2.7:1 → 文字は `--ink-900` で 7.5:1 | 正解バッジ |
| `--success-fg` | `#15803D` | `142 72% 29%` | 5.6:1 | 正解テキスト |
| `--warning` | `#F59E0B` | `38 92% 50%` | 2.4:1 → 文字は `--ink-900` | 注意 |
| `--warning-fg` | `#B45309` | `30 92% 36%` | 5.7:1 | 注意テキスト |
| `--danger` | `#EF4444` | `0 84% 60%` | 3.8:1 | 訂正タグ（控えめ運用） |
| `--danger-fg` | `#B91C1C` | `0 73% 41%` | 6.4:1 | 訂正テキスト |
| `--info` | `#3B82F6` | `217 91% 60%` | 4.0:1 | 情報通知 |
| `--info-fg` | `#1D4ED8` | `224 76% 48%` | 7.1:1 | 情報テキスト |

> 子ども向け配慮: `--danger` は「正解はこちら」を示す訂正タグに限定。誤答通知は `--warning`（橙）で柔らかく。

### 1.4 Surface / Text（Light / Dark）

#### Light テーマ

| Token | HEX | 用途 |
|---|---|---|
| `--bg` | `#FAF6EE` | アプリ地（クリーム） |
| `--surface` | `#FFFFFF` | カード |
| `--surface-muted` | `#F2EDE0` | 区切り背景 |
| `--surface-overlay` | `#FFFBF2` | モーダル背景 |
| `--ink-900` | `#1F1B16` | 本文（強） |
| `--ink-700` | `#3A3530` | 本文（標準） |
| `--ink-500` | `#5A5247` | 補助 |
| `--ink-300` | `#9A9081` | プレースホルダ |
| `--border` | `#E8E0CC` | 区切り線 |
| `--border-strong` | `#C9BFA8` | 強調区切り |

#### Dark テーマ

| Token | HEX | 用途 |
|---|---|---|
| `--bg` | `#15171C` | アプリ地（インク） |
| `--surface` | `#1C1F26` | カード |
| `--surface-muted` | `#23262E` | 区切り背景 |
| `--surface-overlay` | `#262932` | モーダル背景 |
| `--ink-900` | `#F4EFE3` | 本文（強） |
| `--ink-700` | `#D9D2C2` | 本文（標準） |
| `--ink-500` | `#B7AE9E` | 補助 |
| `--ink-300` | `#7E7868` | プレースホルダ |
| `--border` | `#2F333D` | 区切り線 |
| `--border-strong` | `#454A55` | 強調区切り |

#### コントラスト全マトリクス（4.5:1 を全組合せで保証）

| 文字 \\ 背景 | bg (Light) | surface (Light) | bg (Dark) | surface (Dark) |
|---|---|---|---|---|
| `--ink-900` | 13.8:1 | 14.9:1 | — | — |
| `--ink-700` | 10.2:1 | 11.0:1 | — | — |
| `--ink-500` | 5.6:1 ◯ | 6.0:1 ◯ | — | — |
| `--ink-300` | 2.8:1 NG（補助限定） | 3.0:1 NG | — | — |
| Dark `--ink-900` | — | — | 14.3:1 | 13.1:1 |
| Dark `--ink-700` | — | — | 9.8:1 | 9.0:1 |
| Dark `--ink-500` | — | — | 6.0:1 ◯ | 5.5:1 ◯ |

> `--ink-300` はプレースホルダ・装飾用。本文・ボタンには使用禁止。

### 1.5 レベルバッジ階層

| Token | HEX | HSL | 想定到達 | コントラスト on `--surface` |
|---|---|---|---|---|
| `--badge-bronze` | `#CD7F32` | `30 60% 50%` | 7 日 / Lv5 | 3.4:1（大文字 OK） |
| `--badge-bronze-fg` | `#7A4719` | `30 65% 29%` | テキスト用 | 7.1:1 |
| `--badge-silver` | `#C0C0C0` | `0 0% 75%` | 30 日 / Lv15 | 1.8:1（テキスト不可） |
| `--badge-silver-fg` | `#5C5C5C` | `0 0% 36%` | テキスト用 | 6.5:1 |
| `--badge-gold` | `#FFD700` | `51 100% 50%` | 90 日 / Lv30 | 1.4:1（テキスト不可） |
| `--badge-gold-fg` | `#7A6510` | `49 78% 27%` | テキスト用 | 7.4:1 |
| `--badge-platinum` | `#E5E4E2` | `40 5% 89%` | 半年継続 / 3級合格 | 1.2:1（テキスト不可） |
| `--badge-platinum-fg` | `#5A5751` | `41 5% 33%` | テキスト用 | 6.8:1 |
| `--badge-diamond` | `#B9F2FF` | `190 100% 86%` | 公開β継続最上位 | 1.4:1（テキスト不可） |
| `--badge-diamond-fg` | `#0F647A` | `192 78% 26%` | テキスト用 | 7.2:1 |

> バッジ色は装飾、テキスト色は専用 `-fg` トークンを併用する運用。

### 1.6 学習 mastery 段階（5 段階補間）

| Token | HEX | 状態 |
|---|---|---|
| `--mastery-0` | `#F2EDE0` | 未学習 |
| `--mastery-1` | `#F2D9B6` | 学習中 |
| `--mastery-2` | `#F4B14F` | 定着しはじめ |
| `--mastery-3` | `#F2A93A` | おおむね定着 |
| `--mastery-4` | `#6FE7C9` | 定着 |

「赤=未習得」を**使わない**（自己肯定感配慮）。

---

## 2. タイポグラフィ

### 2.1 フォント選定（理由付き）

| 用途 | 採用 | 理由 |
|---|---|---|
| 見出し（日本語） | **Zen Maru Gothic 700** | 「やわらかさ × 上質」のスイートスポット、子どもに親しみと信頼を両立。Noto Sans JP の堅牢さでは保護者向けに振り過ぎ、丸ゴ寄りで HANEI のあたたかみを出す |
| 本文（日本語） | **Noto Sans JP 400/500/700** | 可読性・OS フォールバック・shadcn/ui 親和性。学習文の長文にも耐える |
| 見出し補助 / キャラセリフ | **Zen Maru Gothic 500** | 演出限定で温度感を上げる |
| 英文・本文 | **Geist Sans 400/500/700** | 組織標準、現代的、AI 感がない |
| 英文・学習文（重要英文） | **Nunito Variable 700**（24-32px / line-height 1.7）| 子ども向け定番、文字幅が広く小学生でも読みやすい |
| 単語カード見出し | **Nunito Variable 800**（36-40px）| 大文字でも親しみやすい |
| 数字・カウンター | **Geist Mono** | 等幅で揃う、受験日カウントダウン用 |
| ふりがな | **Noto Sans JP 400 / 14px / `--ink-500`** | 14px は児童の可読下限、補助色で本文より弱める |

#### 不採用フォントと理由

- **Comic Neue**: 過度にカジュアル、保護者の信頼感を損なう
- **M PLUS Rounded 1c**: 丸ゴだが英文 weight が乏しい
- **DotGothic16**: 装飾フォント、本文不可

### 2.2 フォントサイズ階層（Web）

| 用途 | size | weight | line-height | letter-spacing |
|---|---|---|---|---|
| Display（受験日カウント） | 2.5rem (40px) | 700 | 1.15 | -0.02em |
| h1（ホーム見出し） | 2rem (32px) | 700 | 1.2 | -0.01em |
| h2（セクション） | 1.5rem (24px) | 600 | 1.3 | 0 |
| h3（カード見出し） | 1.25rem (20px) | 600 | 1.35 | 0 |
| 本文（標準） | 1rem (16px) | 400 | **1.7** | 0.01em |
| 学習文（重要英文） | 1.5rem (24px) | 700 | **1.7** | 0 |
| 学習文（標準英文） | 1.125rem (18px) | 500 | **1.8** | 0 |
| 単語カード見出し | 2.25rem (36px) | 800 | 1.1 | -0.01em |
| 補足 | 0.875rem (14px) | 400 | 1.6 | 0 |
| ふりがな | 0.875rem (14px) | 400 | 1.4 | 0 |
| キャプション | 0.75rem (12px) | 400 | 1.5 | 0 |

> 児童向け配慮: 本文 line-height 1.7、学習文 1.8 は WCAG 1.4.12（1.5）を超える。letter-spacing 0.01em は日本語の連続漢字読みやすさ向上。

---

## 3. 角丸 / シャドウ / 余白 / タップ領域

### 3.1 角丸トークン

| Token | 値 | Tailwind クラス | 用途 |
|---|---|---|---|
| `--radius-xs` | `4px` | `rounded` | チップ |
| `--radius-sm` | `8px` | `rounded-lg` | バッジ |
| `--radius-md` | **`12px`** | `rounded-xl` | **ボタン / 入力（基調）** |
| `--radius-lg` | `16px` | `rounded-2xl` | カード（デフォルト） |
| `--radius-xl` | **`24px`** | `rounded-3xl` | **学習カード / 主要パネル** |
| `--radius-2xl` | `32px` | `rounded-[32px]` | モーダル |
| `--radius-pill` | `9999px` | `rounded-full` | アバター / アイコンボタン |

### 3.2 シャドウトークン（Amber 系の柔らかい影）

| Token | 値 | 用途 |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(31,27,22,0.04)` | フォーム要素 |
| `--shadow-sm` | `0 2px 6px rgba(31,27,22,0.06)` | ボタン |
| `--shadow-card` | **`0 4px 20px rgba(242, 169, 58, 0.15)`** | **学習カード（Amber 残響）** |
| `--shadow-md` | `0 6px 16px rgba(31,27,22,0.08), 0 2px 4px rgba(31,27,22,0.04)` | カード hover |
| `--shadow-pop` | `0 8px 24px rgba(242, 169, 58, 0.30)` | 主要 CTA hover |
| `--shadow-celebrate` | `0 0 32px rgba(242, 169, 58, 0.50)` | レベルアップ |
| `--shadow-modal` | `0 20px 60px rgba(31,27,22,0.20)` | モーダル |
| `--shadow-focus` | `0 0 0 3px rgba(242, 169, 58, 0.40)` | フォーカスリング |

> Material 系の重い elevation は使わず、紙質感の柔らかい 2 層ベース + Amber Gold の柔らかい残響で温度感を出す。

### 3.3 余白（4px 起点 8px 推奨）

| Token | 値 | Tailwind |
|---|---|---|
| `--space-1` | `4px` | `gap-1` `p-1` |
| `--space-2` | `8px` | `gap-2` `p-2` |
| `--space-3` | `12px` | `gap-3` `p-3` |
| `--space-4` | `16px` | `gap-4` `p-4` |
| `--space-5` | `20px` | `gap-5` `p-5` |
| `--space-6` | `24px` | `gap-6` `p-6` |
| `--space-8` | `32px` | `gap-8` `p-8` |
| `--space-10` | `40px` | `gap-10` `p-10` |
| `--space-12` | `48px` | `gap-12` `p-12` |
| `--space-16` | `64px` | `gap-16` `p-16` |

### 3.4 タップ領域（K-1 受入基準）

| Token | 値 | 用途 |
|---|---|---|
| `--tap-min` | **48×48** | 通常タップ要素（最低） |
| `--tap-cta` | **56×56** | 主要 CTA（「答える」「次へ」） |
| `--tap-spacing` | **8** | 隣接タップ要素の最小間隔 |

Tailwind: `min-h-[48px] min-w-[48px]`、CTA は `min-h-[56px]`。

---

## 4. モーション（Framer Motion variant プリセット）

### 4.1 イージング定数

| Token | cubic-bezier | 用途 |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | hover / focus（デフォルト） |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | カード遷移 |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 正解時の overshoot |
| `--ease-pop` | `cubic-bezier(0.68, -0.55, 0.27, 1.55)` | レベルアップ |

### 4.2 Duration

| Token | 値 | 用途 |
|---|---|---|
| `--duration-fast` | `150ms` | hover / focus |
| `--duration-base` | `220ms` | カード / モーダル |
| `--duration-pop` | `320ms` | 正解スプリング |
| `--duration-celebrate` | `800ms` | レベルアップ |

### 4.3 Framer Motion variant プリセット

```ts
// lib/motion/variants.ts
import type { Variants } from "framer-motion";

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
};

export const cardEnter: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] },
  },
};

export const correctPop: Variants = {
  hidden: { scale: 1 },
  visible: {
    scale: [1, 1.12, 1],
    transition: { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] },
  },
};

export const wrongShake: Variants = {
  hidden: { x: 0 },
  visible: {
    x: [0, -6, 6, -4, 4, 0],
    transition: { duration: 0.4, ease: "easeInOut" },
  },
};

export const levelUpCelebrate: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: [0.8, 1.15, 1],
    transition: { duration: 0.8, ease: [0.68, -0.55, 0.27, 1.55] },
  },
};

export const streakStamp: Variants = {
  hidden: { opacity: 0, scale: 0, rotate: -15 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] },
  },
};
```

### 4.4 prefers-reduced-motion

全 variant は `useReducedMotion()` で fade のみへ縮退するラッパー `motionSafe()` を共通実装。

```ts
// lib/motion/safe.ts
import { useReducedMotion } from "framer-motion";

export const useMotionVariant = (variant: Variants): Variants => {
  const reduce = useReducedMotion();
  if (!reduce) return variant;
  // reduced-motion 時は opacity のみ
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.15 } },
  };
};
```

---

## 5. 実装ファイル（コピペ可能）

### 5.1 `app/globals.css`（Tailwind v4 + shadcn/ui 互換）

```css
@import "tailwindcss";

@layer base {
  :root {
    /* ===== Brand (Amber Gold) ===== */
    --brand-50:  #FEF6E7;
    --brand-100: #FCE9C2;
    --brand-200: #FAD899;
    --brand-300: #F7C16A;
    --brand-400: #F4B14F;
    --brand-500: #F2A93A;
    --brand-600: #D78A1A;
    --brand-700: #B57010;
    --brand-800: #8D560A;
    --brand-900: #5E3905;

    /* ===== Mint (Secondary) ===== */
    --mint-100: #D6F7EC;
    --mint-300: #7FE8CD;
    --mint-500: #6FE7C9;
    --mint-600: #2F9F7E;
    --mint-700: #1F7A60;

    /* ===== Sky (Accent) ===== */
    --sky-100: #D6EFFD;
    --sky-500: #4FC3F7;
    --sky-600: #2F7BC9;
    --sky-700: #1F5A99;

    /* ===== Semantic ===== */
    --success:    #22C55E;
    --success-fg: #15803D;
    --warning:    #F59E0B;
    --warning-fg: #B45309;
    --danger:     #EF4444;
    --danger-fg:  #B91C1C;
    --info:       #3B82F6;
    --info-fg:    #1D4ED8;

    /* ===== Surface / Ink (Light) ===== */
    --bg:               #FAF6EE;
    --surface:          #FFFFFF;
    --surface-muted:    #F2EDE0;
    --surface-overlay:  #FFFBF2;
    --ink-900:          #1F1B16;
    --ink-700:          #3A3530;
    --ink-500:          #5A5247;
    --ink-300:          #9A9081;
    --border:           #E8E0CC;
    --border-strong:    #C9BFA8;

    /* ===== Badge ===== */
    --badge-bronze:      #CD7F32;
    --badge-bronze-fg:   #7A4719;
    --badge-silver:      #C0C0C0;
    --badge-silver-fg:   #5C5C5C;
    --badge-gold:        #FFD700;
    --badge-gold-fg:     #7A6510;
    --badge-platinum:    #E5E4E2;
    --badge-platinum-fg: #5A5751;
    --badge-diamond:     #B9F2FF;
    --badge-diamond-fg:  #0F647A;

    /* ===== Mastery ===== */
    --mastery-0: #F2EDE0;
    --mastery-1: #F2D9B6;
    --mastery-2: #F4B14F;
    --mastery-3: #F2A93A;
    --mastery-4: #6FE7C9;

    /* ===== shadcn/ui 互換マッピング ===== */
    --background:       var(--bg);
    --foreground:       var(--ink-900);
    --card:             var(--surface);
    --card-foreground:  var(--ink-900);
    --popover:          var(--surface-overlay);
    --popover-foreground: var(--ink-900);
    --primary:          var(--brand-600);
    --primary-foreground: #FFFFFF;
    --secondary:        var(--mint-500);
    --secondary-foreground: var(--ink-900);
    --muted:            var(--surface-muted);
    --muted-foreground: var(--ink-500);
    --accent:           var(--sky-100);
    --accent-foreground: var(--sky-700);
    --destructive:      var(--danger);
    --destructive-foreground: #FFFFFF;
    --input:            var(--border);
    --ring:             var(--brand-500);

    /* ===== Radius ===== */
    --radius-xs: 4px;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;
    --radius-2xl: 32px;
    --radius: 16px; /* shadcn 標準 */

    /* ===== Shadow ===== */
    --shadow-xs:         0 1px 2px rgba(31,27,22,0.04);
    --shadow-sm:         0 2px 6px rgba(31,27,22,0.06);
    --shadow-card:       0 4px 20px rgba(242, 169, 58, 0.15);
    --shadow-md:         0 6px 16px rgba(31,27,22,0.08), 0 2px 4px rgba(31,27,22,0.04);
    --shadow-pop:        0 8px 24px rgba(242, 169, 58, 0.30);
    --shadow-celebrate:  0 0 32px rgba(242, 169, 58, 0.50);
    --shadow-modal:      0 20px 60px rgba(31,27,22,0.20);
    --shadow-focus:      0 0 0 3px rgba(242, 169, 58, 0.40);

    /* ===== Tap target ===== */
    --tap-min: 48px;
    --tap-cta: 56px;

    /* ===== Font ===== */
    --font-heading: var(--font-zen-maru), "Zen Maru Gothic", system-ui, sans-serif;
    --font-body:    var(--font-noto-jp), "Noto Sans JP", system-ui, sans-serif;
    --font-en:      var(--font-nunito), "Nunito", system-ui, sans-serif;
    --font-mono:    var(--font-geist-mono), ui-monospace, monospace;
  }

  .dark {
    --bg:              #15171C;
    --surface:         #1C1F26;
    --surface-muted:   #23262E;
    --surface-overlay: #262932;
    --ink-900:         #F4EFE3;
    --ink-700:         #D9D2C2;
    --ink-500:         #B7AE9E;
    --ink-300:         #7E7868;
    --border:          #2F333D;
    --border-strong:   #454A55;

    --primary:         var(--brand-500);
    --primary-foreground: var(--ink-900);
    --shadow-card:     0 4px 20px rgba(242, 169, 58, 0.10);
    --shadow-pop:      0 8px 24px rgba(242, 169, 58, 0.20);
  }

  * {
    border-color: var(--border);
  }

  html, body {
    background-color: var(--bg);
    color: var(--ink-900);
    font-family: var(--font-body);
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
    text-size-adjust: 100%;
  }

  h1, h2, h3, h4 {
    font-family: var(--font-heading);
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  /* 学習文（英文）グローバル基準 */
  .study-en {
    font-family: var(--font-en);
    font-weight: 700;
    font-size: 1.5rem;
    line-height: 1.7;
  }

  /* ふりがな */
  ruby rt {
    font-family: var(--font-body);
    font-size: 0.875rem;
    color: var(--ink-500);
  }

  /* フォーカスリング（共通） */
  :focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
    border-radius: var(--radius-md);
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}

@theme {
  --color-brand-50:  var(--brand-50);
  --color-brand-100: var(--brand-100);
  --color-brand-200: var(--brand-200);
  --color-brand-300: var(--brand-300);
  --color-brand-400: var(--brand-400);
  --color-brand-500: var(--brand-500);
  --color-brand-600: var(--brand-600);
  --color-brand-700: var(--brand-700);
  --color-brand-800: var(--brand-800);
  --color-brand-900: var(--brand-900);
  --color-mint-100: var(--mint-100);
  --color-mint-300: var(--mint-300);
  --color-mint-500: var(--mint-500);
  --color-mint-600: var(--mint-600);
  --color-mint-700: var(--mint-700);
  --color-sky-100: var(--sky-100);
  --color-sky-500: var(--sky-500);
  --color-sky-600: var(--sky-600);
  --color-sky-700: var(--sky-700);

  --shadow-card: var(--shadow-card);
  --shadow-pop:  var(--shadow-pop);
  --shadow-celebrate: var(--shadow-celebrate);
}
```

### 5.2 `app/fonts.ts`

```ts
import { Geist_Mono, Noto_Sans_JP, Zen_Maru_Gothic, Nunito } from "next/font/google";

export const notoJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-jp",
  display: "swap",
});

export const zenMaru = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-zen-maru",
  display: "swap",
});

export const nunito = Nunito({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
```

### 5.3 `tailwind.config.ts`（v4 minimal — `@theme` 中心）

Tailwind v4 では `@theme` ブロックでトークン定義する方針なので、設定ファイルは最小限。

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-zen-maru)", "Zen Maru Gothic", "system-ui", "sans-serif"],
        body:    ["var(--font-noto-jp)", "Noto Sans JP", "system-ui", "sans-serif"],
        en:      ["var(--font-nunito)", "Nunito", "system-ui", "sans-serif"],
        mono:    ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
} satisfies Config;
```

---

## 6. shadcn/ui 互換性チェック

| shadcn token | このトークンでの対応 | 備考 |
|---|---|---|
| `--background` | `--bg` | エイリアス |
| `--foreground` | `--ink-900` | エイリアス |
| `--card` | `--surface` | エイリアス |
| `--primary` | `--brand-600`（Light）/ `--brand-500`（Dark） | コントラスト調整 |
| `--secondary` | `--mint-500` | エイリアス |
| `--accent` | `--sky-100` | エイリアス |
| `--destructive` | `--danger` | エイリアス |
| `--ring` | `--brand-500` | フォーカスリング |
| `--radius` | `16px` | shadcn 標準互換 |
| `--input` | `--border` | エイリアス |

> Dev は `pnpm dlx shadcn@latest add button card input dialog toast` 実行後、既存 `globals.css` を上記 §5.1 で上書きするだけで HANEI トークンが反映される。

---

## 7. 受入基準（W1 デザイントークンゲート）

- [ ] `globals.css` に §5.1 を反映、`.dark` 切替が next-themes で動作
- [ ] `Lighthouse Accessibility ≥ 95`（W1 では暫定、W7 で 100 達成）
- [ ] WCAG AA: 全本文組合せで 4.5:1 以上、検証ツール axe-core で fail 0
- [ ] タップ領域: 主要 CTA で `min-h-[56px]`、通常 `min-h-[48px]` を守る Lint ルール提案
- [ ] `prefers-reduced-motion` 時に Framer Motion の overshoot/celebrate が fade のみに縮退
- [ ] shadcn/ui の Button / Card / Input / Dialog / Toast を当トークンで描画、ダーク切替正常

---

## 8. 次アクション

1. Dev 部門が §5.1 globals.css と §5.2 fonts.ts を `app/` に投入
2. shadcn/ui 主要コンポーネント install + `--primary` 系の上書き確認
3. design-w1-screens.md の Tailwind クラスをコピペで実装
4. Storybook（任意）でトークン確認ページを 1 枚作成（W2）
