/**
 * notifications.weekly-digest.test.ts (W6 / F-1)
 *
 * renderDigestHtml の純関数テスト。
 *
 * 検証ポイント:
 *  1. 必須フィールドが HTML に含まれること (nickname / 級 / 解答数 / streak / XP)
 *  2. 受験日 null のとき「未登録」案内が出ること
 *  3. 4 スキル進捗が「mastered / total (pct%)」形式で出ること
 *  4. HTML エスケープ: nickname に < > " & を入れても安全に出る
 *  5. 解答 0 件のとき「解答記録がまだありません」表示
 *  6. 絵文字を含まない (オーナー厳命)
 */

import { describe, it, expect } from "vitest";
import {
  renderDigestHtml,
  escapeHtml,
  type DigestData,
} from "@/lib/notifications/weekly-digest-template";

function buildBaseData(overrides: Partial<DigestData> = {}): DigestData {
  return {
    learnerNickname: "たろう",
    targetLevel: "5",
    weeklyAnswers: 42,
    weeklyCorrect: 35,
    streak: 6,
    weeklyXpDelta: 320,
    totalXp: 1200,
    dailyCounts: {
      vocabulary: 5,
      grammar: 3,
      listening: 2,
      reading: 1,
      writing: 0,
    },
    coverage: [
      { skill: "vocabulary", mastered: 80, total: 200 },
      { skill: "grammar", mastered: 30, total: 100 },
      { skill: "reading", mastered: 10, total: 50 },
      { skill: "listening", mastered: 25, total: 100 },
    ],
    countdown: { examDate: "2026-10-04", daysUntil: 159, level: "5" },
    parentName: "山田",
    ...overrides,
  };
}

describe("renderDigestHtml", () => {
  it("includes nickname / weekly answers / streak / XP / target level", () => {
    const html = renderDigestHtml(buildBaseData());
    expect(html).toContain("たろう");
    expect(html).toContain("山田");
    expect(html).toContain("英検5級");
    // 解答数 / 正答率 / streak / XP
    expect(html).toContain("<strong>42</strong>");
    expect(html).toContain("<strong>6</strong>");
    expect(html).toContain("<strong>+320</strong>");
    expect(html).toContain("1200");
    // 正答率 35/42 ≒ 83%
    expect(html).toContain("83%");
  });

  it("renders countdown null state with the expected hint", () => {
    const html = renderDigestHtml(buildBaseData({ countdown: null }));
    expect(html).toContain("受験日が未登録です");
    // 「N 日」表記は出ない
    expect(html).not.toMatch(/受験日まで <strong>\d+<\/strong> 日/);
  });

  it("renders 4 skill coverage as 'mastered / total (pct%)'", () => {
    const html = renderDigestHtml(buildBaseData());
    // 80 / 200 = 40%
    expect(html).toContain("語彙: 80 / 200 (40%)");
    // 30 / 100 = 30%
    expect(html).toContain("文法: 30 / 100 (30%)");
    // 10 / 50 = 20%
    expect(html).toContain("読解: 10 / 50 (20%)");
    // 25 / 100 = 25%
    expect(html).toContain("リスニング: 25 / 100 (25%)");
  });

  it("escapes HTML special characters in nickname / parentName", () => {
    const html = renderDigestHtml(
      buildBaseData({
        learnerNickname: "<script>alert('x')</script>",
        parentName: 'A&B "boss"',
      }),
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A&amp;B");
    expect(html).toContain("&quot;boss&quot;");
  });

  it("shows 'no answers yet' when weeklyAnswers is 0", () => {
    const html = renderDigestHtml(
      buildBaseData({ weeklyAnswers: 0, weeklyCorrect: 0 }),
    );
    expect(html).toContain("今週は解答記録がまだありません");
  });

  it("contains no emoji characters (owner mandate)", () => {
    const html = renderDigestHtml(buildBaseData());
    // Unicode emoji 範囲 (BMP 外含む) を粗く検出
    // 主要な絵文字ブロック: U+1F300–U+1FAFF, U+2600–U+27BF
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(html).not.toMatch(emojiRe);
  });
});

describe("escapeHtml", () => {
  it("escapes the 5 standard HTML special chars", () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
    );
  });
});
