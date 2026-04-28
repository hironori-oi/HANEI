/**
 * lib.api-error.test.ts
 *
 * `apiError()` のテスト。
 *  - ApiErrorCode 7 種それぞれが正しい HTTP status を返す
 *  - レスポンス body には publicMessage のみが含まれ、internal は漏洩しない
 *  - console.error に timestamp / code / publicMessage / internal / userId を含む構造化ログが出る
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiError, type ApiErrorCode } from "@/lib/api-error";

describe("apiError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it.each<[ApiErrorCode, number]>([
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["BAD_REQUEST", 400],
    ["CONFLICT", 409],
    ["TOO_MANY_REQUESTS", 429],
    ["INTERNAL_ERROR", 500],
  ])("returns HTTP %s for code %s", async (code, expectedStatus) => {
    const res = apiError(code, "public message");
    expect(res.status).toBe(expectedStatus);
  });

  it("response body contains only error.code and error.message (no internal leak)", async () => {
    const res = apiError("BAD_REQUEST", "invalid input", {
      internal: { sql: "SELECT * FROM secrets" },
      userId: "user_123",
    });
    const body = await res.json();
    expect(body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "invalid input",
      },
    });
    // internal 情報が漏洩していないことを厳密に検証
    const json = JSON.stringify(body);
    expect(json).not.toContain("internal");
    expect(json).not.toContain("SELECT");
    expect(json).not.toContain("user_123");
  });

  it("logs structured entry with timestamp / code / publicMessage / internal / userId", () => {
    apiError("INTERNAL_ERROR", "something broke", {
      internal: new Error("DB down"),
      userId: "user_xyz",
    });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const call = consoleErrorSpy.mock.calls[0];
    if (!call) throw new Error("console.error was not called");
    const tag = call[0];
    const payload = call[1];
    expect(tag).toBe("[apiError]");

    const parsed = JSON.parse(payload as string);
    expect(parsed.code).toBe("INTERNAL_ERROR");
    expect(parsed.publicMessage).toBe("something broke");
    expect(parsed.userId).toBe("user_xyz");
    // timestamp は ISO 形式
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // internal は Error オブジェクト → JSON 化で {} になるが、フィールド自体は存在
    expect(parsed).toHaveProperty("internal");
  });

  it("handles missing details argument (no internal / userId)", () => {
    const res = apiError("FORBIDDEN", "no access");
    expect(res.status).toBe(403);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const call = consoleErrorSpy.mock.calls[0];
    if (!call) throw new Error("console.error was not called");
    const payload = call[1] as string;
    const parsed = JSON.parse(payload);
    expect(parsed.code).toBe("FORBIDDEN");
    expect(parsed.publicMessage).toBe("no access");
    expect(parsed.internal).toBeUndefined();
    expect(parsed.userId).toBeUndefined();
  });
});
