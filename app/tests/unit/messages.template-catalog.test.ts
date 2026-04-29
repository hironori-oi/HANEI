/**
 * Unit tests for message template catalog (W9-T5).
 *
 * 純データ + 純関数のみテスト対象:
 *  - MESSAGE_TEMPLATES (30 種 = 5 cat × 6 種)
 *  - findTemplateByCode
 *  - listTemplatesByCategory
 */

import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABEL_JA,
  CATEGORY_ORDER,
  MESSAGE_TEMPLATES,
  findTemplateByCode,
  listTemplatesByCategory,
  type MessageCategory,
} from "@/lib/messages/template-catalog";

describe("MESSAGE_TEMPLATES", () => {
  it("30 種定義されている (5 cat × 6 種)", () => {
    expect(MESSAGE_TEMPLATES).toHaveLength(30);
  });

  it("各 category は 6 種ずつ", () => {
    const counts = MESSAGE_TEMPLATES.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + 1;
      return acc;
    }, {});
    for (const cat of CATEGORY_ORDER) {
      expect(counts[cat]).toBe(6);
    }
  });

  it("code は A1..E6 形式 (重複なし)", () => {
    const codes = MESSAGE_TEMPLATES.map((t) => t.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(30);
    for (const c of codes) {
      expect(c).toMatch(/^[A-E][1-6]$/);
    }
  });

  it("body は空文字でない", () => {
    for (const t of MESSAGE_TEMPLATES) {
      expect(t.body.length).toBeGreaterThan(0);
    }
  });

  it("絵文字は含まれない (基本ラテン拡張範囲外の絵文字検出)", () => {
    // U+1F300..U+1F9FF (絵文字) を含まない
    const emojiRe = /[\u{1F300}-\u{1F9FF}]/u;
    for (const t of MESSAGE_TEMPLATES) {
      expect(emojiRe.test(t.body)).toBe(false);
    }
  });
});

describe("findTemplateByCode", () => {
  it("既知 code でテンプレを返す", () => {
    const t = findTemplateByCode("A1");
    expect(t).not.toBeNull();
    expect(t?.code).toBe("A1");
    expect(t?.category).toBe("encourage_start");
  });

  it("未知 code は null", () => {
    expect(findTemplateByCode("Z9")).toBeNull();
    expect(findTemplateByCode("")).toBeNull();
  });

  it("placeholder を含む E1 を返す", () => {
    const t = findTemplateByCode("E1");
    expect(t?.body).toContain("{exam_days}");
  });

  it("placeholder を含む B6 を返す", () => {
    const t = findTemplateByCode("B6");
    expect(t?.body).toContain("{streak_days}");
  });
});

describe("listTemplatesByCategory", () => {
  it("encourage_start は 6 種", () => {
    const ts = listTemplatesByCategory("encourage_start");
    expect(ts).toHaveLength(6);
    expect(ts.every((t) => t.category === "encourage_start")).toBe(true);
  });

  it.each([
    "encourage_start",
    "celebrate",
    "encourage_struggle",
    "check_in",
    "exam_countdown",
  ] satisfies MessageCategory[])("%s は 6 種", (cat) => {
    expect(listTemplatesByCategory(cat as MessageCategory)).toHaveLength(6);
  });
});

describe("CATEGORY_LABEL_JA", () => {
  it("全 5 カテゴリにラベルと説明がある", () => {
    for (const cat of CATEGORY_ORDER) {
      const meta = CATEGORY_LABEL_JA[cat];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });
});
