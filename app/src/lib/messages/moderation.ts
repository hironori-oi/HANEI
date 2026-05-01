/**
 * HANEI - Parent Message Moderation (W11-T2 / 親→子 応援メッセージ moderation pipeline)
 *
 * 自由文メッセージの DEC-024 罰則ゼロ哲学を **構造的に保証** する辞書ベース moderation.
 *
 * 純関数 (Turbopack 制約):
 *   - "use server" 一切なし / DB I/O ゼロ / 同期関数のみ.
 *   - 本モジュールは "use server" ファイル外に置く. server action からは import して使う.
 *     (Next.js 16 Turbopack は "use server" ファイルからの sync export を拒否するため.)
 *
 * 設計指針 (DEC-024 / DEC-062):
 *   - 親が子に送る body から **罵倒系 / 否定系 / 強制系 / 個人情報** を検出して reject.
 *   - 「がんばろう」「がんばれ」「お疲れさま」など励まし系は OK (文脈区別はしない最小ルール).
 *   - LLM moderation は Phase 3 で導入. Phase 2 では辞書ベースで十分カバーする.
 *   - reject 時は親 UI で「やわらかい ことば に してみよう」前向き案内を出す
 *     (具体禁止語をユーザに見せず、子供を傷つけない親への教育 / DEC-024).
 *
 * 既存 zod (BODY_MIN=1 / BODY_MAX=200) と同上限を保持. parent-messages.ts から呼ばれる.
 */

// ---------------------------------------------------------------------------
// Constants (server action ファイル `parent-messages.ts` の BODY_MIN/MAX と一致)
// ---------------------------------------------------------------------------
export const BODY_MIN = 1;
export const BODY_MAX = 200;

/**
 * 罵倒系 / 否定系 / 強制系の禁止語辞書 (Phase 2 / W11-T2).
 *
 * 「がんばろう」「がんばれ」は OK のため、辞書には含めない.
 * 「やめろ」は強制系として扱う.
 * 部分一致 (includes) で判定する.
 */
const BLOCKED_WORDS: ReadonlyArray<string> = [
  // 罵倒系
  "ばか",
  "バカ",
  "馬鹿",
  "あほ",
  "アホ",
  "阿呆",
  "ぐず",
  "ノロマ",
  "のろま",
  // 否定系 (人格否定 / 達成否定)
  "だめ",
  "ダメ",
  "駄目",
  "やりすぎ",
  "やり過ぎ",
  "サボるな",
  "サボってる",
  "さぼってる",
  "ペナルティ",
  "罰",
  "最下位",
  "ビリ",
  "下位",
  // 強制系
  "やれ",
  "やりなさい",
  "やめろ",
  "しろよ",
  // 蔑称 (子供向け文脈で安全側)
  "うざい",
  "うっとうしい",
];

/**
 * 個人情報を含むパターン (電話番号 / メール / 住所キーワード+数字).
 *
 * 子供のメッセージに親側から個人情報が混入することを防ぐ防御層.
 * 例: 学校・塾の名前・住所・電話番号を伝言経路として悪用されるリスクの最小化.
 */
const PII_PATTERNS: ReadonlyArray<{ regex: RegExp; label: string }> = [
  // 電話番号 (国内一般 / 03-xxxx-xxxx, 090-xxxx-xxxx 等)
  { regex: /\d{2,4}-\d{2,4}-\d{4}/, label: "phone" },
  // メールアドレス (簡易 / 厳密 RFC ではない)
  { regex: /[\w.+-]+@[\w-]+\.[\w.-]+/, label: "email" },
  // 住所キーワード (県/市/区/町) の直後に 3 桁以上の数字 (番地っぽいもの)
  { regex: /[県市区町]\s*\d{3,}/, label: "address" },
];

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------
export type ModerationResult =
  | { ok: true; body: string }
  | {
      ok: false;
      reason:
        | "too_short"
        | "too_long"
        | "blocked_word"
        | "invalid_type";
      matchedWord?: string;
    };

// ---------------------------------------------------------------------------
// validateParentMessageBody
// ---------------------------------------------------------------------------
/**
 * 親メッセージ本文を辞書ベースで検証する純関数.
 *
 * - body が string 以外: { ok: false, reason: "invalid_type" }
 * - trim 後に length=0: { ok: false, reason: "too_short" }
 * - length > BODY_MAX (200): { ok: false, reason: "too_long" }
 * - BLOCKED_WORDS or PII_PATTERNS にマッチ: { ok: false, reason: "blocked_word", matchedWord }
 * - それ以外: { ok: true, body }
 *
 * @param body - 親が送る本文 (placeholder 解決 **前** の生 body).
 *               trim はせず元の文字列で length 判定する (改行は保持).
 *               ただし「空白のみ」は trim 後 length=0 として too_short 扱い.
 */
export function validateParentMessageBody(body: unknown): ModerationResult {
  // 1. 型ガード
  if (typeof body !== "string") {
    return { ok: false, reason: "invalid_type" };
  }

  // 2. 長さチェック (BODY_MAX は raw length)
  if (body.length > BODY_MAX) {
    return { ok: false, reason: "too_long" };
  }

  // 3. trim 後 length=0 は too_short (連続空白のみ / 空文字列)
  const trimmed = body.trim();
  if (trimmed.length < BODY_MIN) {
    return { ok: false, reason: "too_short" };
  }

  // 4. 禁止語辞書 (部分一致)
  for (const word of BLOCKED_WORDS) {
    if (body.includes(word)) {
      return { ok: false, reason: "blocked_word", matchedWord: word };
    }
  }

  // 5. 個人情報パターン
  for (const { regex, label } of PII_PATTERNS) {
    if (regex.test(body)) {
      return { ok: false, reason: "blocked_word", matchedWord: `pii:${label}` };
    }
  }

  return { ok: true, body };
}

/**
 * 親 UI で表示する「やわらかい ことば に してみよう」前向きコピー.
 *
 * DEC-024 罰則ゼロ哲学に従い、具体的な禁止語をユーザに見せず、子供を傷つけない
 * 親への教育トーンで案内する.
 *
 * @param reason - validateParentMessageBody の reason
 * @returns UI に出すユーザ向け文言 (同 server-side で機械化 / 罵倒語ゼロ)
 */
export function describeModerationReason(
  reason:
    | "too_short"
    | "too_long"
    | "blocked_word"
    | "invalid_type"
    | "rate_limited",
): string {
  switch (reason) {
    case "too_short":
      return "メッセージを かいてください。";
    case "too_long":
      return "200 字 まで で おねがいします。";
    case "blocked_word":
      return "このメッセージは おくれないかも。ことばを やわらかく してみよう。";
    case "rate_limited":
      return "つづけて たくさん おくれないよ。すこし まって また おくってね。";
    case "invalid_type":
    default:
      return "メッセージの かたちを たしかめてください。";
  }
}
