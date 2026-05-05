/**
 * HANEI - β feedback 送信ロジック (W12-T3-B / DEC-070)
 *
 * 設計指針:
 *  - **Turbopack `"use server"` sync export ban パターン 10 度目構造定着**:
 *    純関数 (DOM-free / DB-free / `"use server"` 不在 / Sentry SDK は外部送信のみ).
 *  - feedback-button.tsx (client component) と unit test の双方から共有可能.
 *  - DEC-024 罰則ゼロ: バリデーション失敗の理由 enum も中立語のみ
 *    (`"empty" | "too_long"`) 採用、ユーザー向け文言生成は呼び出し側で行う.
 *  - DEC-006 不変: 新規 mutation 0 / 新規 server action 0 / 新規 API route 0.
 *    Sentry.captureFeedback は外部 envelope = Next.js mutation budget 対象外.
 *  - DEC-055 idempotency: Sentry 側の event dedupe を信頼.
 *    クライアント側は submitting state で二重送信抑止 (button.tsx 責務).
 *
 * 参照: DEC-070 §本 atomic スコープ
 */

import * as Sentry from "@sentry/nextjs";

/** β feedback の最大文字数 (DEC-070 §1 form 要素 textarea 1000 文字制約). */
export const FEEDBACK_MAX_LENGTH = 1000;

/**
 * feedback 入力のバリデーション結果.
 *
 *  - `"empty"` = trim 後 0 文字 (空メッセージ送信を構造的に防ぐ)
 *  - `"too_long"` = trim 後 1000 文字超 (UI 側で onChange でも抑止可能だが多層防御)
 */
export type FeedbackValidationFailure = "empty" | "too_long";

/**
 * 純関数: feedback 文字列の trim + バリデーション結果.
 *
 *  - DOM-free / DB-free / Sentry SDK 不依存.
 *  - 失敗時は `{ ok: false; reason }` で早期 fail.
 *  - 成功時は trim 済み message を返す (呼び出し側はこれを Sentry に渡す).
 */
export function validateFeedbackMessage(
  raw: unknown,
):
  | { ok: true; message: string }
  | { ok: false; reason: FeedbackValidationFailure } {
  const str = typeof raw === "string" ? raw : "";
  const trimmed = str.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (trimmed.length > FEEDBACK_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, message: trimmed };
}

/**
 * Sentry.captureFeedback に渡す引数の構造.
 *
 *  - `name` / `email` は親 (parent role) の表示名 / メールを optional ヒントとして渡す.
 *  - DEC-070 §1 props: `userName?` `userEmail?` を component から受け取り、
 *    そのまま Sentry に渡す (Sentry プロジェクト UI で運営者が返信できるように).
 *  - PII 取り扱い (DEC-070 §判断根拠 4): captureFeedback は user_feedback envelope =
 *    sentry.client.config.ts の beforeSend 経路と分離 = ユーザーが任意提供したメール/
 *    名前は保持される (返信運用可能 / 子ども向けでも親本人意思 = 同意ベース OK).
 */
export interface FeedbackSubmitInput {
  message: string;
  name?: string;
  email?: string;
}

/**
 * Sentry.captureFeedback ラッパー.
 *
 *  - 実装は `Sentry.captureFeedback({ message, name, email })` を呼ぶだけだが、
 *    unit test で `vi.mock("@sentry/nextjs")` 経由で呼出引数を検証するため、
 *    薄いラッパーとして純関数化しておく.
 *  - `Sentry.captureFeedback` は同期で eventId(string) を返す (sentry/core の
 *    feedback.js 確認済 = `scope.captureEvent(...)` 経由 / Promise ではない).
 *  - 呼び出し側 (feedback-button.tsx) は同期完了として扱い、submitting state
 *    を解除する.
 *  - 失敗時 (Sentry SDK 未初期化等) は throw する設計とし、呼び出し側 try/catch
 *    で `[role="alert"]` に中立エラー文言を出す.
 *
 * 戻り値: Sentry が発行した eventId (string). DSN 未設定環境では空文字列が
 * 返る (Sentry SDK は `enabled: Boolean(dsn)` で内部的に no-op 化される).
 */
export function submitFeedback(input: FeedbackSubmitInput): string {
  const eventId = Sentry.captureFeedback({
    message: input.message,
    name: input.name,
    email: input.email,
    associatedEventId: undefined,
  });
  // sentry SDK は eventId 未生成時 undefined を返すため、空文字列にフォールバック.
  return typeof eventId === "string" ? eventId : "";
}
