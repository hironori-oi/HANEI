/**
 * Unit tests: src/lib/messages/moderation.ts (W11-T2 / 親→子 応援メッセージ moderation)
 *
 * 純関数 validateParentMessageBody の境界条件 + DEC-024 罰則ゼロ哲学を網羅.
 *
 *   - 型ガード (string 以外は invalid_type)
 *   - 長さ境界 (1 / 200 / 0 / 201)
 *   - 禁止語辞書: 罵倒系 / 否定系 / 強制系 / 人格否定
 *   - 個人情報: 電話番号 / メール / 住所
 *   - 励まし系 (がんばろう / がんばれ / お疲れさま) は OK
 *   - 連続空白のみは too_short (trim 後 0 文字)
 *   - 改行・絵文字混在も length 判定は raw 文字数
 */

import { describe, expect, it } from "vitest";
import {
  validateParentMessageBody,
  describeModerationReason,
  BODY_MIN,
  BODY_MAX,
} from "@/lib/messages/moderation";

describe("validateParentMessageBody / 型ガード", () => {
  it("null は invalid_type", () => {
    const r = validateParentMessageBody(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_type");
  });

  it("undefined は invalid_type", () => {
    const r = validateParentMessageBody(undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_type");
  });

  it("数値は invalid_type", () => {
    const r = validateParentMessageBody(123);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_type");
  });

  it("オブジェクトは invalid_type", () => {
    const r = validateParentMessageBody({ body: "がんばろう" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_type");
  });
});

describe("validateParentMessageBody / 長さ境界", () => {
  it("空文字列は too_short", () => {
    const r = validateParentMessageBody("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_short");
  });

  it("1 文字 (BODY_MIN ちょうど) は OK", () => {
    const r = validateParentMessageBody("あ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toBe("あ");
  });

  it("200 文字 (BODY_MAX ちょうど) は OK", () => {
    const body = "あ".repeat(BODY_MAX);
    const r = validateParentMessageBody(body);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.length).toBe(200);
  });

  it("201 文字は too_long", () => {
    const body = "あ".repeat(BODY_MAX + 1);
    const r = validateParentMessageBody(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_long");
  });

  it("BODY_MIN === 1 / BODY_MAX === 200 (parent-messages.ts と一致)", () => {
    expect(BODY_MIN).toBe(1);
    expect(BODY_MAX).toBe(200);
  });

  it("連続空白のみは too_short (trim 後 length=0)", () => {
    const r = validateParentMessageBody("    ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_short");
  });

  it("改行のみも too_short", () => {
    const r = validateParentMessageBody("\n\n\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_short");
  });
});

describe("validateParentMessageBody / 罵倒系禁止語", () => {
  it.each([
    ["ばか"],
    ["バカ"],
    ["馬鹿"],
    ["あほ"],
    ["アホ"],
    ["ぐず"],
  ])("「%s」を含む body は blocked_word", (word) => {
    const r = validateParentMessageBody(`${word}じゃないよ がんばれ`);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("blocked_word");
      expect(r.matchedWord).toBe(word);
    }
  });
});

describe("validateParentMessageBody / 否定系禁止語", () => {
  it("「だめ」を含むと blocked_word", () => {
    const r = validateParentMessageBody("そんなの だめ だよ");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("blocked_word");
      expect(r.matchedWord).toBe("だめ");
    }
  });

  it("「やりすぎ」を含むと blocked_word", () => {
    const r = validateParentMessageBody("きょうは やりすぎ じゃないかな");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_word");
  });

  it("「サボるな」を含むと blocked_word", () => {
    const r = validateParentMessageBody("きょうは サボるな");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_word");
  });

  it("「ペナルティ」を含むと blocked_word", () => {
    const r = validateParentMessageBody("やらないと ペナルティ だよ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_word");
  });

  it("「最下位」を含むと blocked_word", () => {
    const r = validateParentMessageBody("きみは 最下位 だね");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_word");
  });
});

describe("validateParentMessageBody / 強制系禁止語", () => {
  it("「やれ」を含むと blocked_word", () => {
    const r = validateParentMessageBody("いますぐ やれ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_word");
  });

  it("「やりなさい」を含むと blocked_word", () => {
    const r = validateParentMessageBody("ちゃんと やりなさい");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_word");
  });

  it("「やめろ」を含むと blocked_word", () => {
    const r = validateParentMessageBody("もう やめろ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_word");
  });
});

describe("validateParentMessageBody / 励まし系は OK (DEC-024 整合)", () => {
  it("「がんばろう」は OK", () => {
    const r = validateParentMessageBody("きょうも いっしょに がんばろう");
    expect(r.ok).toBe(true);
  });

  it("「がんばれ」は OK", () => {
    const r = validateParentMessageBody("がんばれ おうえんしてるよ");
    expect(r.ok).toBe(true);
  });

  it("「お疲れさま」は OK", () => {
    const r = validateParentMessageBody("お疲れさま よくがんばったね");
    expect(r.ok).toBe(true);
  });

  it("「うれしいね」は OK", () => {
    const r = validateParentMessageBody("クリアできて うれしいね");
    expect(r.ok).toBe(true);
  });

  it("placeholder 表記 {streak_days} を含む body も OK (resolve は呼び出し側責務)", () => {
    const r = validateParentMessageBody("れんぞく {streak_days} 日 すごい");
    expect(r.ok).toBe(true);
  });
});

describe("validateParentMessageBody / 個人情報 (PII)", () => {
  it("電話番号 03-1234-5678 は blocked_word (pii:phone)", () => {
    const r = validateParentMessageBody("でんわ 03-1234-5678 まで");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("blocked_word");
      expect(r.matchedWord).toBe("pii:phone");
    }
  });

  it("携帯電話番号 090-1234-5678 も検出", () => {
    const r = validateParentMessageBody("でんわは 090-1234-5678");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.matchedWord).toBe("pii:phone");
  });

  it("メールアドレス は blocked_word (pii:email)", () => {
    const r = validateParentMessageBody("メールは parent@example.com にね");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("blocked_word");
      expect(r.matchedWord).toBe("pii:email");
    }
  });

  it("住所キーワード+番地 (区+数字) は blocked_word (pii:address)", () => {
    const r = validateParentMessageBody("江戸川区 123 まで きてね");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.matchedWord).toBe("pii:address");
  });
});

describe("validateParentMessageBody / 通常メッセージは全て OK", () => {
  it("テンプレ既定文「きょうも いっしょに がんばろう」は OK", () => {
    const r = validateParentMessageBody("きょうも いっしょに がんばろう");
    expect(r.ok).toBe(true);
  });

  it("数字混在も OK", () => {
    const r = validateParentMessageBody("れんぞく 7 日 すごい");
    expect(r.ok).toBe(true);
  });

  it("カタカナ混在も OK", () => {
    const r = validateParentMessageBody("リスニング よくできたね");
    expect(r.ok).toBe(true);
  });

  it("漢字+ひらがな OK", () => {
    const r = validateParentMessageBody("英検合格に向けて 一緒に頑張ろう");
    expect(r.ok).toBe(true);
  });
});

describe("describeModerationReason", () => {
  it("too_short の文言", () => {
    const msg = describeModerationReason("too_short");
    expect(msg).toContain("かいてください");
  });

  it("too_long の文言は 200 字 を含む", () => {
    const msg = describeModerationReason("too_long");
    expect(msg).toContain("200");
  });

  it("blocked_word の文言は前向き案内 (具体禁止語を見せない / DEC-024)", () => {
    const msg = describeModerationReason("blocked_word");
    expect(msg).toContain("やわらかく");
    // 罰語そのものを文言に含めない
    expect(msg).not.toContain("だめ");
    expect(msg).not.toContain("ペナルティ");
    expect(msg).not.toContain("禁止");
  });

  it("rate_limited の文言は前向き", () => {
    const msg = describeModerationReason("rate_limited");
    expect(msg).toContain("まって");
    expect(msg).not.toContain("だめ");
    expect(msg).not.toContain("ペナルティ");
  });

  it("invalid_type の文言は前向き", () => {
    const msg = describeModerationReason("invalid_type");
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).not.toContain("だめ");
  });
});
