/**
 * study.writing-input.test.ts (W7 / B-10)
 *
 * writing_essay UI 補助の純関数テスト。
 * - validateWritingInput: 0/1〜9/10〜600/601 字 の境界
 * - pickWritingScoreLabel: score → "できた" / "もうすこし"
 * - scoreToPercent: 0..1 → 0..100 整数
 *
 * vitest 環境は node のため React render テストは含まない (vitest.config.ts)。
 */

import { describe, it, expect } from "vitest";
import {
  WRITING_INPUT_MIN_LENGTH,
  WRITING_INPUT_MAX_LENGTH,
  WRITING_LABEL_PASS_THRESHOLD,
  validateWritingInput,
  pickWritingScoreLabel,
  scoreToPercent,
} from "@/lib/study/writing-input";

describe("validateWritingInput()", () => {
  it("0 字は isValid=false / errorMessage=null (まだ書き始めていない placeholder 状態)", () => {
    const r = validateWritingInput("");
    expect(r.isValid).toBe(false);
    expect(r.errorMessage).toBeNull();
    expect(r.length).toBe(0);
  });

  it("1〜9 字 (下限未満) は isValid=false で kid-safe メッセージを返す", () => {
    const r = validateWritingInput("hello");
    expect(r.isValid).toBe(false);
    expect(r.errorMessage).toBe("もう少しだけ書いてみよう。");
    expect(r.length).toBe(5);
  });

  it("ちょうど 10 字 (下限) は isValid=true", () => {
    const text = "a".repeat(WRITING_INPUT_MIN_LENGTH);
    const r = validateWritingInput(text);
    expect(r.isValid).toBe(true);
    expect(r.errorMessage).toBeNull();
    expect(r.length).toBe(10);
  });

  it("ちょうど 600 字 (上限) は isValid=true", () => {
    const text = "a".repeat(WRITING_INPUT_MAX_LENGTH);
    const r = validateWritingInput(text);
    expect(r.isValid).toBe(true);
    expect(r.length).toBe(600);
  });

  it("601 字 (上限超過) は isValid=false で kid-safe メッセージ", () => {
    const text = "a".repeat(WRITING_INPUT_MAX_LENGTH + 1);
    const r = validateWritingInput(text);
    expect(r.isValid).toBe(false);
    expect(r.errorMessage).toBe("ここまでで送ってみよう。");
  });

  it("英文 / かな / 全角 / 改行 すべて文字数 1 として数える (kid-safe で種別を弾かない)", () => {
    const r = validateWritingInput("I like りんご。\nIt is sweet.");
    expect(r.isValid).toBe(true);
    expect(r.length).toBeGreaterThanOrEqual(WRITING_INPUT_MIN_LENGTH);
  });
});

describe("pickWritingScoreLabel()", () => {
  it("score >= 0.6 (PASS_THRESHOLD) は 'できた'", () => {
    expect(pickWritingScoreLabel(WRITING_LABEL_PASS_THRESHOLD)).toBe("できた");
    expect(pickWritingScoreLabel(0.75)).toBe("できた");
    expect(pickWritingScoreLabel(1)).toBe("できた");
  });

  it("score < 0.6 は 'もうすこし' (negative 表現は使わない)", () => {
    expect(pickWritingScoreLabel(0.59)).toBe("もうすこし");
    expect(pickWritingScoreLabel(0)).toBe("もうすこし");
  });

  it("NaN / 範囲外 / Infinity は 'もうすこし' にフォールバック (kid-safe デフォルト)", () => {
    expect(pickWritingScoreLabel(Number.NaN)).toBe("もうすこし");
    expect(pickWritingScoreLabel(-1)).toBe("もうすこし");
    // Number.isFinite(Infinity) は false なので 'もうすこし' フォールバック
    expect(pickWritingScoreLabel(Number.POSITIVE_INFINITY)).toBe("もうすこし");
    expect(pickWritingScoreLabel(Number.NEGATIVE_INFINITY)).toBe("もうすこし");
  });
});

describe("scoreToPercent()", () => {
  it("0..1 を 0..100 整数に四捨五入", () => {
    expect(scoreToPercent(0)).toBe(0);
    expect(scoreToPercent(0.5)).toBe(50);
    expect(scoreToPercent(0.755)).toBe(76);
    expect(scoreToPercent(1)).toBe(100);
  });

  it("範囲外は clamp", () => {
    expect(scoreToPercent(-0.5)).toBe(0);
    expect(scoreToPercent(1.5)).toBe(100);
    expect(scoreToPercent(Number.NaN)).toBe(0);
  });
});
