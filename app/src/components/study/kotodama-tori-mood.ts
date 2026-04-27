/**
 * HANEI - ことだまトリ mood 純関数 (W5 / G-5)
 *
 * UI 側 (kotodama-tori.tsx) と分離してユニットテスト可能にする。
 * "use client" コンポーネントから import した場合と挙動が完全に一致する。
 */

export type KotodamaMood =
  | "thinking"
  | "cheerful"
  | "celebrating"
  | "sad"
  | "encouraging";

export type LastResult = "correct" | "wrong" | null;

/**
 * 直前の結果と連続正解数から mood を決める。
 *
 * - 解答前 (lastResult=null) = "thinking"
 * - 直前正解 + streak >= 3 = "celebrating"
 * - 直前正解 = "cheerful"
 * - 直前不正解 + 直前まで streak >= 3 = "sad"  (連勝が途切れた瞬間の落胆)
 * - 直前不正解 = "encouraging"
 */
export function pickMood(
  lastResult: LastResult,
  streakBeforeAnswer: number,
): KotodamaMood {
  if (lastResult === null) return "thinking";
  if (lastResult === "correct") {
    return streakBeforeAnswer >= 3 ? "celebrating" : "cheerful";
  }
  // wrong
  return streakBeforeAnswer >= 3 ? "sad" : "encouraging";
}
