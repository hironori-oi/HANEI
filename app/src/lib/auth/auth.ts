/**
 * HANEI - Better Auth configuration (W2 完成形)
 *
 * Drizzle adapter + email/password + email verification + organization
 * (family role: parent / learner) を統合。
 *
 * 三層認可防衛 第二層 = guards.ts と組み合わせる:
 *   1. middleware (proxy.ts) でセッション cookie 検証
 *   2. ここで Better Auth セッション → AuthSession に正規化
 *   3. scoped queries で family_id スコープを SQL で強制
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/lib/db/client";
import { sendVerificationEmail } from "@/lib/email/resend";

const baseURL = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      // forgot password 導線スタブ (W3 で UI 完成予定)
      await sendVerificationEmail({
        to: user.email,
        kind: "password_reset",
        verifyUrl: url,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      await sendVerificationEmail({
        to: user.email,
        kind: "email_verify",
        verifyUrl: url,
        token,
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24h
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30日
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5分
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "parent",
        input: false, // ユーザーが直接書き換えるのを禁止
      },
    },
  },
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-replace-me-in-production",
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ],
  // Server Action 内で auth.api.signUpEmail / signInEmail を呼んだ際、
  // Set-Cookie を Next.js の応答 cookie ストアに転記して、後続のリクエストで
  // Better Auth セッション cookie が確実に維持されるようにする。
  // (E2E "signup → /onboarding/learner → /home" のハッピーパス成立のため必須 / W5 G-6)
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
