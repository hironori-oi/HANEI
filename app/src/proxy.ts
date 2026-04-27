/**
 * Next.js 16 で `middleware` は `proxy` にリネーム必須 (tech-stack.md 仕様1)
 *
 * 三層認可防衛の第一層:
 *  - セッション cookie の存在を確認
 *  - 保護対象パス (/onboarding, /home, /study, /coach 等) で未ログインなら /login へ
 *  - /verify-email は未認証ユーザーのみアクセス可
 *
 * 詳細認可は guards.ts の require* に委譲。
 */

import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/home",
  "/onboarding",
  "/learner",
  "/coach",
  "/study",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) {
    return NextResponse.next();
  }

  // Better Auth のセッション cookie 名 (デフォルト: better-auth.session_token)
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav)$).*)",
  ],
};
