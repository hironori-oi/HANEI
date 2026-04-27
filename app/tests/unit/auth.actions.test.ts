/**
 * 認証系 Server Actions の zod validation
 * (W2-09 / dev-w2 R-6)
 *
 * SignupSchema / LoginSchema / VerifyEmailSchema を直接 import して
 * zod の safeParse 結果を検証する。Server Action 本体の DB 副作用は別途 E2E で確認。
 */

import { describe, it, expect } from "vitest";
import { SignupSchema } from "@/app/(auth)/signup/schema";
import { LoginSchema } from "@/app/(auth)/login/schema";
import { VerifyEmailSchema } from "@/app/(auth)/verify-email/schema";

describe("SignupSchema", () => {
  const valid = {
    email: "parent@example.com",
    password: "supersecret",
    parent_name: "山田太郎",
    consent_coppa: "on",
    consent_ai_chat: "on",
    consent_terms: "on",
  };

  it("正規の入力は成功する", () => {
    const r = SignupSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("email がメール形式でなければ失敗", () => {
    const r = SignupSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("password が 8 文字未満なら失敗", () => {
    const r = SignupSchema.safeParse({ ...valid, password: "abc1" });
    expect(r.success).toBe(false);
  });

  it("parent_name が空なら失敗", () => {
    const r = SignupSchema.safeParse({ ...valid, parent_name: "" });
    expect(r.success).toBe(false);
  });

  it("consent_coppa が 'on' 以外なら失敗 (チェック未付与)", () => {
    const r = SignupSchema.safeParse({ ...valid, consent_coppa: "" });
    expect(r.success).toBe(false);
  });

  it("3 つの同意のうち 1 つでも欠ければ失敗", () => {
    const r1 = SignupSchema.safeParse({ ...valid, consent_ai_chat: undefined });
    const r2 = SignupSchema.safeParse({ ...valid, consent_terms: undefined });
    expect(r1.success).toBe(false);
    expect(r2.success).toBe(false);
  });
});

describe("LoginSchema", () => {
  it("email + password だけで通る", () => {
    const r = LoginSchema.safeParse({
      email: "user@example.com",
      password: "anything",
    });
    expect(r.success).toBe(true);
  });

  it("email が無効なら失敗", () => {
    const r = LoginSchema.safeParse({
      email: "no-at-sign",
      password: "anything",
    });
    expect(r.success).toBe(false);
  });

  it("password が空文字なら失敗", () => {
    const r = LoginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(r.success).toBe(false);
  });

  it("redirect_to / remember は任意", () => {
    const r = LoginSchema.safeParse({
      email: "user@example.com",
      password: "anything",
      remember: "on",
      redirect_to: "/home",
    });
    expect(r.success).toBe(true);
  });
});

describe("VerifyEmailSchema", () => {
  it("6 桁の数字なら成功", () => {
    const r = VerifyEmailSchema.safeParse({ code: "123456" });
    expect(r.success).toBe(true);
  });

  it("5 桁なら失敗", () => {
    const r = VerifyEmailSchema.safeParse({ code: "12345" });
    expect(r.success).toBe(false);
  });

  it("英字混じりは失敗", () => {
    const r = VerifyEmailSchema.safeParse({ code: "12a456" });
    expect(r.success).toBe(false);
  });

  it("空文字は失敗", () => {
    const r = VerifyEmailSchema.safeParse({ code: "" });
    expect(r.success).toBe(false);
  });
});
