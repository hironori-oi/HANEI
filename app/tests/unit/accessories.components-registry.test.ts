/**
 * Unit tests for accessories component registry (W9-B).
 *
 * 純データ + 純関数のみテスト対象:
 *  - ACCESSORY_COMPONENT_BY_CODE: 全 12 種が登録されている
 *  - 各 Component が ComponentType として callable
 *  - 12 種が 3 スロット × 4 = 完全網羅 (catalog と一致)
 */

import { describe, expect, it } from "vitest";
import {
  ACCESSORY_CODES,
  ACCESSORIES_BY_SLOT,
  ACCESSORY_SLOTS,
} from "@/lib/accessories/catalog";
import { ACCESSORY_COMPONENT_BY_CODE } from "@/components/character/accessories";

describe("ACCESSORY_COMPONENT_BY_CODE", () => {
  it("全 12 種の AccessoryCode が登録されている", () => {
    for (const code of ACCESSORY_CODES) {
      expect(ACCESSORY_COMPONENT_BY_CODE[code]).toBeDefined();
      expect(typeof ACCESSORY_COMPONENT_BY_CODE[code]).toBe("function");
    }
  });

  it("registry のキー数は 12 (重複なし)", () => {
    const keys = Object.keys(ACCESSORY_COMPONENT_BY_CODE);
    expect(keys).toHaveLength(ACCESSORY_CODES.length);
    expect(keys).toHaveLength(12);
  });

  it("不明コードでは ACCESSORY_COMPONENT_BY_CODE[code] が undefined", () => {
    const map = ACCESSORY_COMPONENT_BY_CODE as Record<string, unknown>;
    expect(map["nonexistent"]).toBeUndefined();
  });

  it("3 スロット × 4 = 12 (slot ごとの均等分布)", () => {
    let total = 0;
    for (const slot of ACCESSORY_SLOTS) {
      const accs = ACCESSORIES_BY_SLOT[slot];
      expect(accs.length).toBe(4);
      total += accs.length;
    }
    expect(total).toBe(12);
  });

  it("各 slot 内で displayOrder が 1..4 で揃っている", () => {
    for (const slot of ACCESSORY_SLOTS) {
      const orders = ACCESSORIES_BY_SLOT[slot]
        .map((a) => a.displayOrder)
        .sort((a, b) => a - b);
      expect(orders).toEqual([1, 2, 3, 4]);
    }
  });
});
