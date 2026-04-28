/**
 * lib.utils.test.ts
 *
 * `cn()` のテスト - Tailwind class merge ヘルパ。
 * coverage 50% 閾値到達のため、軽量モジュールにも 100% カバレッジを付ける。
 */

import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges multiple class strings into a single string", () => {
    const result = cn("px-2", "py-1", "text-sm");
    expect(result).toBe("px-2 py-1 text-sm");
  });

  it("dedupes Tailwind conflicts and keeps the last one (twMerge)", () => {
    // p-2 と p-4 は衝突 → 後者が勝つ
    const result = cn("p-2", "p-4");
    expect(result).toBe("p-4");
  });

  it("dedupes color conflicts within the same property", () => {
    const result = cn("text-red-500", "text-blue-600");
    expect(result).toBe("text-blue-600");
  });

  it("ignores falsy values (null / undefined / false / empty string)", () => {
    const result = cn("base", null, undefined, false, "", "extra");
    expect(result).toBe("base extra");
  });

  it("supports conditional object syntax (clsx)", () => {
    const result = cn("base", { active: true, disabled: false });
    expect(result).toBe("base active");
  });

  it("supports nested arrays (clsx)", () => {
    const result = cn(["a", "b"], ["c"]);
    expect(result).toBe("a b c");
  });

  it("returns an empty string when no inputs are given", () => {
    const result = cn();
    expect(result).toBe("");
  });
});
