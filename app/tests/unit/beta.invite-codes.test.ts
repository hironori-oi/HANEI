/**
 * beta.invite-codes.test.ts (W12-T3-A / DEC-069)
 *
 * 純関数のユニットテスト:
 *   - normalizeInviteCode: trim / uppercase / 内部空白除去 / 非文字列耐性
 *   - validateInviteCodeFormat: 正常 / empty / length / alphabet
 *   - generateInviteCode: 形式適合 (length / alphabet) / 一意性 (大量試行)
 *   - isBetaInviteRequired: env 切替 (true / false / undefined)
 *
 * Turbopack `"use server"` sync export ban パターン 9 度目構造定着の構造担保.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  generateInviteCode,
  isBetaInviteRequired,
  normalizeInviteCode,
  validateInviteCodeFormat,
} from "@/lib/beta/invite-codes";

describe("normalizeInviteCode", () => {
  it("trim + uppercase + 内部空白除去 (基本パターン)", () => {
    expect(normalizeInviteCode("  ab cd ef gh  ")).toBe("ABCDEFGH");
  });

  it("タブ / 改行 / 全角スペースも除去", () => {
    expect(normalizeInviteCode("\tab\ncd\u3000ef gh")).toBe("ABCDEFGH");
  });

  it("既に大文字 + 空白なしならそのまま", () => {
    expect(normalizeInviteCode("ABCD2345")).toBe("ABCD2345");
  });

  it("非文字列 (null / undefined / number) は空文字を返す", () => {
    expect(normalizeInviteCode(null)).toBe("");
    expect(normalizeInviteCode(undefined)).toBe("");
    expect(normalizeInviteCode(12345)).toBe("");
    expect(normalizeInviteCode({})).toBe("");
  });
});

describe("validateInviteCodeFormat", () => {
  it("8 文字 / 大文字英数 (alphabet 内) は ok", () => {
    expect(validateInviteCodeFormat("ABCD2345")).toEqual({ ok: true });
  });

  it("空文字 → empty", () => {
    expect(validateInviteCodeFormat("")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("長さ 7 → length", () => {
    expect(validateInviteCodeFormat("ABCD234")).toEqual({
      ok: false,
      reason: "length",
    });
  });

  it("長さ 9 → length", () => {
    expect(validateInviteCodeFormat("ABCD23456")).toEqual({
      ok: false,
      reason: "length",
    });
  });

  it("除外文字 0 を含む → alphabet", () => {
    expect(validateInviteCodeFormat("ABCD2340")).toEqual({
      ok: false,
      reason: "alphabet",
    });
  });

  it("除外文字 O を含む → alphabet", () => {
    expect(validateInviteCodeFormat("ABCO2345")).toEqual({
      ok: false,
      reason: "alphabet",
    });
  });

  it("小文字を含む → alphabet (大文字英数のみ許可)", () => {
    expect(validateInviteCodeFormat("abcd2345")).toEqual({
      ok: false,
      reason: "alphabet",
    });
  });

  it("ハイフン区切り → alphabet", () => {
    expect(validateInviteCodeFormat("ABCD-345")).toEqual({
      ok: false,
      reason: "alphabet",
    });
  });
});

describe("generateInviteCode", () => {
  it("生成コードが INVITE_CODE_LENGTH 文字 (8 文字)", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
    }
  });

  it("生成コードは alphabet 内の文字のみで構成され validateInviteCodeFormat も ok", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateInviteCode();
      for (const ch of code) {
        expect(INVITE_CODE_ALPHABET.includes(ch)).toBe(true);
      }
      expect(validateInviteCodeFormat(code)).toEqual({ ok: true });
    }
  });

  it("生成コードは紛らわしい文字 (0/O/1/I/L) を一切含まない", () => {
    const banned = ["0", "O", "1", "I", "L"];
    for (let i = 0; i < 200; i += 1) {
      const code = generateInviteCode();
      for (const b of banned) {
        expect(code.includes(b)).toBe(false);
      }
    }
  });

  it("大量生成での衝突がほぼ発生しない (500 件で重複 0)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      set.add(generateInviteCode());
    }
    // alphabet 31^8 = 約 8.5e11. 500 件で衝突確率は実質 0.
    expect(set.size).toBe(500);
  });
});

describe("isBetaInviteRequired", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.BETA_INVITE_REQUIRED;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BETA_INVITE_REQUIRED;
    } else {
      process.env.BETA_INVITE_REQUIRED = originalEnv;
    }
    vi.unstubAllEnvs();
  });

  it("env 未設定 → false (既存 dev/E2E 挙動維持)", () => {
    delete process.env.BETA_INVITE_REQUIRED;
    expect(isBetaInviteRequired()).toBe(false);
  });

  it('env = "true" → true (本番 β ゲーティング有効化)', () => {
    process.env.BETA_INVITE_REQUIRED = "true";
    expect(isBetaInviteRequired()).toBe(true);
  });

  it('env = "false" → false (明示無効化)', () => {
    process.env.BETA_INVITE_REQUIRED = "false";
    expect(isBetaInviteRequired()).toBe(false);
  });

  it('env = "1" や "yes" 等 truthy 文字列 → false (厳格 "true" のみ許可)', () => {
    process.env.BETA_INVITE_REQUIRED = "1";
    expect(isBetaInviteRequired()).toBe(false);
    process.env.BETA_INVITE_REQUIRED = "yes";
    expect(isBetaInviteRequired()).toBe(false);
  });
});
