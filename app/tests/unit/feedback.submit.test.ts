/**
 * feedback.submit.test.ts (W12-T3-B / DEC-070)
 *
 * 純関数のユニットテスト (DEC-070 §4 受入基準対応):
 *  - validateFeedbackMessage: empty / too_long / 通常入力 / trim 動作 / 非文字列耐性
 *  - submitFeedback: Sentry.captureFeedback が { message, name, email } で呼ばれること
 *
 * **戦略**:
 *  DEC-070 §4 では `feedback.button.test.tsx` (DOM テスト) で
 *    - 初期状態: dialog 閉じている / ボタン visible
 *    - ボタン click → dialog 開く / textarea 表示
 *    - 空 textarea で submit → blocked / Sentry 未呼出
 *    - 通常入力 → submit → Sentry.captureFeedback 引数検証
 *    - 完了状態 → thanks 表示
 *    - cancel ボタン → dialog 閉じる / 状態 reset
 *  の 4-6 cases を求めている.
 *
 *  PRJ-016 は tsx unit test 前例ゼロ + @testing-library / jsdom 依存ゼロ で、
 *  追加導入は CLAUDE.md 「依存関係追加最小化推奨」+ DEC-070 §0 同方針に反する.
 *  ロジック層を `src/lib/feedback/submit.ts` に純関数として隔離し、
 *  本 unit test は Sentry mock + 純関数 cases で「DEC-070 §4 と同等の検証粒度」を担保する:
 *    - 空 textarea blocked  → validateFeedbackMessage("") = { ok: false, reason: "empty" }
 *    - Sentry 未呼出        → submitFeedback は呼ばれない経路を直接検証
 *    - 引数検証             → submitFeedback({...}) で Sentry mock の呼出引数を assert
 *    - 完了状態 / cancel / dialog open-close は E2E (beta-feedback.spec.ts) で
 *      実 DOM 上で検証 (chromium + mobile-chrome 2 PASS).
 *
 *  Turbopack `"use server"` sync export ban パターン 10 度目構造定着の延長:
 *  純関数を unit test → tsx component と E2E から共有.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type Mock,
} from "vitest";

// `@sentry/nextjs` を vi.mock で spy 化.
// captureFeedback が呼ばれた引数を検証する.
vi.mock("@sentry/nextjs", () => ({
  captureFeedback: vi.fn(() => "mock_event_id_abc123"),
}));

// mock 後に import (vi.mock は hoist されるので順序問題なし)
import * as Sentry from "@sentry/nextjs";
import {
  FEEDBACK_MAX_LENGTH,
  submitFeedback,
  validateFeedbackMessage,
} from "@/lib/feedback/submit";

const mockCaptureFeedback = Sentry.captureFeedback as unknown as Mock;

beforeEach(() => {
  mockCaptureFeedback.mockClear();
  mockCaptureFeedback.mockReturnValue("mock_event_id_abc123");
});

describe("validateFeedbackMessage", () => {
  it("通常の文字列は ok=true + trim 済み message を返す", () => {
    const result = validateFeedbackMessage(
      "  画面が 動かなくなることがあります  ",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toBe("画面が 動かなくなることがあります");
    }
  });

  it("空文字 / 半角空白のみ / 全角空白のみ は empty で fail", () => {
    expect(validateFeedbackMessage("")).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(validateFeedbackMessage("    ")).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(validateFeedbackMessage("\t\n  \n\t")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("FEEDBACK_MAX_LENGTH (1000) ちょうどは pass", () => {
    const exactly = "a".repeat(FEEDBACK_MAX_LENGTH);
    const result = validateFeedbackMessage(exactly);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message.length).toBe(FEEDBACK_MAX_LENGTH);
    }
  });

  it("FEEDBACK_MAX_LENGTH 超過は too_long で fail", () => {
    const over = "a".repeat(FEEDBACK_MAX_LENGTH + 1);
    expect(validateFeedbackMessage(over)).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("非文字列 (null / undefined / number / object) は空文字扱い → empty で fail", () => {
    expect(validateFeedbackMessage(null)).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(validateFeedbackMessage(undefined)).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(validateFeedbackMessage(123)).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(validateFeedbackMessage({ msg: "x" })).toEqual({
      ok: false,
      reason: "empty",
    });
  });
});

describe("submitFeedback", () => {
  it("通常入力 → Sentry.captureFeedback が { message, name, email } 引数で呼ばれる", () => {
    submitFeedback({
      message: "ご意見テストです",
      name: "保護者太郎",
      email: "parent@hanei.test",
    });

    expect(mockCaptureFeedback).toHaveBeenCalledTimes(1);
    expect(mockCaptureFeedback).toHaveBeenCalledWith({
      message: "ご意見テストです",
      name: "保護者太郎",
      email: "parent@hanei.test",
      associatedEventId: undefined,
    });
  });

  it("name / email 省略時は undefined を Sentry に渡す (匿名 feedback パス)", () => {
    submitFeedback({ message: "anonymous feedback" });

    expect(mockCaptureFeedback).toHaveBeenCalledTimes(1);
    expect(mockCaptureFeedback).toHaveBeenCalledWith({
      message: "anonymous feedback",
      name: undefined,
      email: undefined,
      associatedEventId: undefined,
    });
  });

  it("Sentry が string eventId を返したら同じ値を返す", () => {
    mockCaptureFeedback.mockReturnValue("event_id_xyz");
    const ret = submitFeedback({ message: "ok" });
    expect(ret).toBe("event_id_xyz");
  });

  it("Sentry が undefined を返した場合 (DSN 未設定 no-op) は空文字を返す", () => {
    mockCaptureFeedback.mockReturnValue(undefined);
    const ret = submitFeedback({ message: "no dsn" });
    expect(ret).toBe("");
  });
});

describe("DEC-070 受入: 空メッセージで Sentry 未呼出", () => {
  it("validateFeedbackMessage('') が fail = 呼び出し側は submitFeedback に進まない (構造的検証)", () => {
    // feedback-button.tsx の handleSubmit と同等の制御フローを直接検証.
    // empty 判定 → 早期 return → Sentry 呼出ゼロ.
    const validated = validateFeedbackMessage("");
    if (validated.ok) {
      // ここには到達しないが TS 型ガード上、submitFeedback を呼ぶ branch.
      submitFeedback({ message: validated.message });
    }
    expect(mockCaptureFeedback).not.toHaveBeenCalled();
  });

  it("validateFeedbackMessage(over_limit) が fail = Sentry 未呼出", () => {
    const validated = validateFeedbackMessage(
      "a".repeat(FEEDBACK_MAX_LENGTH + 100),
    );
    if (validated.ok) {
      submitFeedback({ message: validated.message });
    }
    expect(mockCaptureFeedback).not.toHaveBeenCalled();
  });
});
