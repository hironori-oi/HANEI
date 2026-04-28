/**
 * HANEI - writing_essay 入力 / 採点ラベル ヘルパ (W7 / B-10)
 *
 * - StudyClient 側の textarea 入力 / バリデーションを純関数化してテスト可能にする
 * - score (0..1) → kid-safe ラベル ("できた" / "もうすこし") の決定論変換
 *
 * 仕様:
 * - 入力上限: 600 字 (SubmitAnswerSchema.choice と一致)
 * - 入力下限: 10 字 (1〜2 単語の空送信を防ぐ kid-safe 最低ライン)
 * - 入力種別: 文字数のみで判定 (英文 / かな混じり / 空白すべて許容)
 *
 * 三層認可: 本モジュールは pure / DB アクセスなしのため認可ガード対象外。
 */

export const WRITING_INPUT_MIN_LENGTH = 10;
export const WRITING_INPUT_MAX_LENGTH = 600;
/** WRITING_PASS_THRESHOLD と一致 (score-writing.ts) — 二値ラベル切替の閾値 */
export const WRITING_LABEL_PASS_THRESHOLD = 0.6;

export type WritingScoreLabel = "できた" | "もうすこし";

/**
 * AI 採点 score (0..1) を kid-safe ラベルに変換する。
 *
 * - score >= 0.6 → "できた" (WRITING_PASS_THRESHOLD と一致)
 * - score <  0.6 → "もうすこし"
 * - 範囲外 / NaN → "もうすこし" にフォールバック (negative 表現は使わない)
 */
export function pickWritingScoreLabel(score: number): WritingScoreLabel {
  if (!Number.isFinite(score)) return "もうすこし";
  if (score < 0) return "もうすこし";
  if (score >= WRITING_LABEL_PASS_THRESHOLD) return "できた";
  return "もうすこし";
}

/**
 * score (0..1) を 0..100 整数 (パーセント) に丸める。
 * 表示用 / SRS 連携には使わない (SRS は isCorrect で分岐)。
 */
export function scoreToPercent(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score <= 0) return 0;
  if (score >= 1) return 100;
  return Math.round(score * 100);
}

export interface WritingInputValidation {
  /** 送信可能か */
  isValid: boolean;
  /** 表示用エラーメッセージ (kid-safe / null=エラーなし) */
  errorMessage: string | null;
  /** 現在文字数 (UI のカウンタ表示に使う) */
  length: number;
}

/**
 * textarea 内容を送信可否判定する純関数。
 *
 * - 0 字 → null メッセージ (まだ書き始めていない / placeholder のみ)
 * - 1〜9 字 → "もう少しだけ書いてみよう。"
 * - 10〜600 字 → 送信可
 * - 601 字以上 → "ここまでで送ってみよう。" (SubmitAnswerSchema が弾く前にクライアント側で抑止)
 */
export function validateWritingInput(raw: string): WritingInputValidation {
  const length = raw.length;
  if (length === 0) {
    return { isValid: false, errorMessage: null, length };
  }
  if (length < WRITING_INPUT_MIN_LENGTH) {
    return {
      isValid: false,
      errorMessage: "もう少しだけ書いてみよう。",
      length,
    };
  }
  if (length > WRITING_INPUT_MAX_LENGTH) {
    return {
      isValid: false,
      errorMessage: "ここまでで送ってみよう。",
      length,
    };
  }
  return { isValid: true, errorMessage: null, length };
}
