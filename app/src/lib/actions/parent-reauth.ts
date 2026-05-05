"use server";

/**
 * HANEI - 親パスワード再認証 (W12-T1 / Phase 3 第 1 波 / T3 統合 / DEC-074)
 *
 * 親が settings の sensitive 操作 (account / security) を行う前に、直近 5 分以内に
 * パスワード再確認 (reauth) 済であることを担保するための仕組み.
 *
 * 設計 (DEC-074 §(d) / オーナー O-4 採択 = Better Auth reauth):
 *   - Better Auth `auth.api.verifyPassword({ body: { password }, headers })` で現セッションの
 *     ユーザのパスワードを検証.
 *   - 検証成功時、HTTP-only cookie `parent_reauth_at=<unix-ms>` を 5 分間 set.
 *   - sensitive 操作 (Server Action) は冒頭で `requireParentReauth()` を呼び、cookie が無い /
 *     5 分超過なら明示エラーを返して dialog を開く.
 *
 * 分類:
 *   - 本ファイルは "use server" だが、含む export `verifyParentPasswordAndStartGrace` は
 *     **auth gate** (cookie 設定のみ / 業務データの mutation 無し) であり、DEC-006 拡張版の
 *     「mutation = page form から直接呼ばれる top-level Server Action」5→8 のカウント対象外
 *     とする (DEC-074 本来意図再定義に整合).
 *   - `requireParentReauth` は helper. mutation Server Action 側で呼ぶ.
 *
 * 三層認可:
 *   - 第二層: requireAuth で session 必須.
 *   - 第三層: 本 action は cookie のみ書く (DB 書き込み無し). family_id scope は呼び出し元の
 *            mutation 側で再評価する.
 *
 * 罰則ゼロ哲学 (DEC-024): エラーは丁寧な日本語で返し、罰語ゼロ.
 */

import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { requireAuth } from "@/lib/auth/guards";

const REAUTH_COOKIE_NAME = "parent_reauth_at";
const REAUTH_GRACE_MS = 5 * 60 * 1000; // 5 分

export interface VerifyParentPasswordResult {
  ok: boolean;
  reason?: "missing_password" | "invalid_password" | "session_required";
}

/**
 * 親パスワードを Better Auth `verifyPassword` で検証し、成功時に reauth cookie を 5 分間 set する.
 *
 * 呼び出し元 (Client dialog) は `formData.password` を投げる.
 *
 * 戻り値:
 *   - { ok: true } : reauth 成功 / cookie set 済 / 5 分間 grace.
 *   - { ok: false, reason }: 失敗. dialog はメッセージ表示して再入力を促す.
 */
export async function verifyParentPasswordAndStartGrace(
  formData: FormData,
): Promise<VerifyParentPasswordResult> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, reason: "missing_password" };
  }

  const session = await requireAuth();
  if (!session.userId) {
    return { ok: false, reason: "session_required" };
  }

  try {
    const result = await auth.api.verifyPassword({
      body: { password },
      headers: await headers(),
    });
    if (!result?.status) {
      return { ok: false, reason: "invalid_password" };
    }
  } catch {
    // Better Auth は invalid password で APIError を throw する
    return { ok: false, reason: "invalid_password" };
  }

  const jar = await cookies();
  jar.set(REAUTH_COOKIE_NAME, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(REAUTH_GRACE_MS / 1000),
  });

  return { ok: true };
}

/**
 * 直近 5 分以内に parent reauth が完了しているかを判定する helper.
 *
 * mutation Server Action 側 (updateLearnerProfile 等) の冒頭で呼ぶ.
 * false の場合、呼び出し元は明示エラーを返して dialog を開く.
 *
 * 注意: 本関数は **helper** であり、top-level Server Action のカウント対象外 (DEC-074 整合).
 */
export async function isParentReauthFresh(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(REAUTH_COOKIE_NAME)?.value;
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  const elapsed = Date.now() - ts;
  return elapsed >= 0 && elapsed <= REAUTH_GRACE_MS;
}

/**
 * Server Action 冒頭で呼ぶ reauth 確認 helper. fresh でなければ Error throw.
 *
 * 呼び出し側はこの Error を catch して dialog を開く.
 */
export async function requireParentReauth(): Promise<void> {
  const fresh = await isParentReauthFresh();
  if (!fresh) {
    throw new Error("PARENT_REAUTH_REQUIRED");
  }
}

/**
 * テスト / 退会等で reauth grace を破棄する helper.
 */
export async function clearParentReauth(): Promise<void> {
  const jar = await cookies();
  jar.delete(REAUTH_COOKIE_NAME);
}
