/**
 * HANEI - Moderation (三重ガード)
 *
 * Layer 1: ローカル NG ワード辞書 (高速・コスト 0) - safety/ng-words.ts に分離
 * Layer 2: OpenAI Moderation API (omni-moderation-latest)
 * Layer 3: 出力後の自家ヒューリスティック (FORBIDDEN_COACH_PHRASES) + 数値・固有名詞 risk word マスク
 *
 * Phase 0 K-4 受入基準: NGワード辞書 60+ 語雛形、Phase 1 中に 100+ 語へ拡張。
 */

import { hasApiKey } from "./openai";
import { FORBIDDEN_COACH_PHRASES } from "./coach";
import { findNgWords, maskNgWords, type NgWordEntry } from "./safety/ng-words";

/**
 * Layer 1: ローカル NG ワード検出
 */
export function detectNgWords(text: string): NgWordEntry[] {
  return findNgWords(text);
}

/**
 * Layer 3: AI 出力に「使ってはいけないコーチフレーズ」が含まれていないかチェック
 */
export function detectForbiddenCoachPhrases(text: string): string[] {
  return FORBIDDEN_COACH_PHRASES.filter((p) => text.includes(p));
}

/**
 * Layer 3: 出力フィルタ - 数値・固有名詞 risk word のマスク
 *  - 電話番号らしき数列 (連続 9-11 桁) → ***
 *  - メールアドレス → ***@***
 *  - 住所っぽいパターン (郵便番号 7 桁) → ***
 */
export function maskRiskOutputs(text: string): string {
  let out = text;
  // 電話番号 (ハイフン許容、9〜11桁の連続数字)
  out = out.replace(/\b\d{2,4}[- ]?\d{2,4}[- ]?\d{3,4}\b/g, "***-****-****");
  // メールアドレス
  out = out.replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***@***");
  // 郵便番号 (XXX-XXXX)
  out = out.replace(/\b\d{3}-\d{4}\b/g, "***-****");
  // NG ワードマスク
  out = maskNgWords(out);
  return out;
}

export interface ModerationResult {
  flagged: boolean;
  ngWords: NgWordEntry[];
  forbiddenPhrases: string[];
  openaiCategories: Record<string, boolean>;
  reason?: string;
}

/**
 * Layer 2: OpenAI Moderation API
 * API キー未設定時は flagged=false を返す (開発用フォールバック)。
 */
export async function moderateWithOpenAI(text: string): Promise<{
  flagged: boolean;
  categories: Record<string, boolean>;
}> {
  if (!hasApiKey()) {
    return { flagged: false, categories: {} };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: text,
      }),
    });
    if (!res.ok) {
      // moderation エラーは fail-closed (安全優先)
      return { flagged: true, categories: { error: true } };
    }
    const data = (await res.json()) as {
      results: Array<{ flagged: boolean; categories: Record<string, boolean> }>;
    };
    const result = data.results[0] ?? { flagged: false, categories: {} };
    return { flagged: result.flagged, categories: result.categories };
  } catch {
    return { flagged: true, categories: { error: true } };
  }
}

/**
 * 三重ガード統合: 入力テキストを全レイヤで検査
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  const ngWords = detectNgWords(text);
  const forbiddenPhrases = detectForbiddenCoachPhrases(text);

  let openaiCategories: Record<string, boolean> = {};
  let openaiFlagged = false;

  if (ngWords.length === 0 && forbiddenPhrases.length === 0) {
    // ローカルでクリアした場合のみ OpenAI 呼び出し (コスト節約)
    const r = await moderateWithOpenAI(text);
    openaiFlagged = r.flagged;
    openaiCategories = r.categories;
  }

  const flagged =
    ngWords.length > 0 || forbiddenPhrases.length > 0 || openaiFlagged;

  let reason: string | undefined;
  if (ngWords.length > 0) {
    reason = `ng_words:${ngWords.map((n) => n.category).join(",")}`;
  } else if (forbiddenPhrases.length > 0) {
    reason = `forbidden_phrases`;
  } else if (openaiFlagged) {
    reason = `openai_moderation`;
  }

  return { flagged, ngWords, forbiddenPhrases, openaiCategories, reason };
}
