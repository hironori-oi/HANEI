/**
 * AI コーチ system prompt のスナップショット + NG ワード検出
 * (review-phase0-gate.md §8.2 W1-09)
 */

import { describe, it, expect } from "vitest";
import { KID_SAFE_SYSTEM_PROMPT, ENCOURAGEMENT_PHRASES, FORBIDDEN_COACH_PHRASES, isOffTopic } from "@/lib/ai/coach";
import {
  detectNgWords,
  detectForbiddenCoachPhrases,
} from "@/lib/ai/moderation";
import { NG_WORDS_JA, NG_WORDS_EN } from "@/lib/ai/safety/ng-words";

describe("KID_SAFE_SYSTEM_PROMPT", () => {
  it("snapshot — 文言変更時にレビュー強制", () => {
    expect(KID_SAFE_SYSTEM_PROMPT).toMatchSnapshot();
  });

  it("ことだまトリ / 小学生 / ですます調 / 絵文字禁止 のキーフレーズが含まれている", () => {
    expect(KID_SAFE_SYSTEM_PROMPT).toContain("ことだまトリ");
    expect(KID_SAFE_SYSTEM_PROMPT).toContain("小学生");
    expect(KID_SAFE_SYSTEM_PROMPT).toContain("ですます調");
    expect(KID_SAFE_SYSTEM_PROMPT).toContain("絵文字");
  });

  it("禁止表現リストとの整合性: 「だめ」「違う」「なんで?」が NG として宣言されている", () => {
    expect(KID_SAFE_SYSTEM_PROMPT).toContain("だめ");
    expect(KID_SAFE_SYSTEM_PROMPT).toContain("違う");
    expect(KID_SAFE_SYSTEM_PROMPT).toContain("なんで?");
  });
});

describe("ENCOURAGEMENT_PHRASES", () => {
  it("最低 5 件以上の励ましフレーズを定義", () => {
    expect(ENCOURAGEMENT_PHRASES.length).toBeGreaterThanOrEqual(5);
  });

  it("全フレーズが「ね」「よ」「です」など子ども向けトーンで終わる", () => {
    // 末尾の「。」を許容し、ね / よ / です / でした / ます / ました / ましょう を許可
    const acceptablePatterns = /(ね|よ|です|でした|ます|ました|ましょう)。?$/;
    for (const p of ENCOURAGEMENT_PHRASES) {
      expect(p).toMatch(acceptablePatterns);
    }
  });

  it("絵文字が一切含まれない", () => {
    const emojiPattern = /[\p{Extended_Pictographic}]/u;
    for (const p of ENCOURAGEMENT_PHRASES) {
      expect(p).not.toMatch(emojiPattern);
    }
  });
});

describe("NG word detection", () => {
  it("最低 30 語の NG 辞書を持つ (K-4 受入基準の途中段階)", () => {
    const total = NG_WORDS_JA.length + NG_WORDS_EN.length;
    expect(total).toBeGreaterThanOrEqual(30);
  });

  it("「死ね」を含む文を検出する", () => {
    const hits = detectNgWords("おまえ死ね");
    expect(hits.map((h) => h.word)).toContain("死ね");
  });

  it("英語の罵り fuck を検出する", () => {
    const hits = detectNgWords("This is fucking bad");
    expect(hits.map((h) => h.word)).toContain("fuck");
  });

  it("クリーンな文章では検出しない", () => {
    const hits = detectNgWords("英語の勉強がんばろうね");
    expect(hits).toHaveLength(0);
  });
});

describe("Forbidden coach phrase detection (Layer 3 自家フィルタ)", () => {
  it("「だめだね」を検出する", () => {
    expect(detectForbiddenCoachPhrases("そんなのだめだね")).toContain("だめだね");
  });

  it("肯定的な励ましは検出しない", () => {
    expect(detectForbiddenCoachPhrases("すごいね、よくできました")).toHaveLength(0);
  });

  it("FORBIDDEN_COACH_PHRASES が最低 5 件以上定義されている", () => {
    expect(FORBIDDEN_COACH_PHRASES.length).toBeGreaterThanOrEqual(5);
  });
});

describe("Off-topic detection", () => {
  it("英語学習トピックは off-topic ではない", () => {
    expect(isOffTopic("be動詞の使い方を教えて")).toBe(false);
  });

  it("自殺・暴力など危機キーワードは off-topic 扱い (危機検知)", () => {
    expect(isOffTopic("死にたい")).toBe(true);
    expect(isOffTopic("暴力をふるわれた")).toBe(true);
  });
});
