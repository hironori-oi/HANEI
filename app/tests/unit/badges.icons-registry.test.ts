/**
 * Unit tests for badge icons registry (W9-C).
 *
 * 純データ + 純関数のみテスト対象:
 *  - BADGE_ICON_BY_CODE: 全 8 種が登録されている
 *  - 各 Component が ComponentType として callable
 */

import { describe, expect, it } from "vitest";
import { ALL_BADGE_CODES } from "@/lib/badges/badge-codes";
import { BADGE_ICON_BY_CODE } from "@/components/badges/icons";

describe("BADGE_ICON_BY_CODE", () => {
  it("全 8 種の BadgeCode が登録されている", () => {
    for (const code of ALL_BADGE_CODES) {
      expect(BADGE_ICON_BY_CODE[code]).toBeDefined();
      expect(typeof BADGE_ICON_BY_CODE[code]).toBe("function");
    }
  });

  it("registry のキー数は 8 (重複なし)", () => {
    const keys = Object.keys(BADGE_ICON_BY_CODE);
    expect(keys).toHaveLength(ALL_BADGE_CODES.length);
  });

  it("不明コードでは BADGE_ICON_BY_CODE[code] が undefined", () => {
    // Type は BadgeCode 制約だが index 演算子で widening を確認
    const map = BADGE_ICON_BY_CODE as Record<string, unknown>;
    expect(map["nonexistent"]).toBeUndefined();
  });
});
