"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, verifications } from "@/lib/db/schema";
import { auth } from "@/lib/auth/auth";
import { getSession } from "@/lib/auth/guards";
import { VerifyEmailSchema } from "./schema";

/**
 * 6桁コードを `verifications` テーブルから検証して users.email_verified=true に更新する。
 * Better Auth デフォルトは link 形式だが、HANEI では子ども保護観点でコード入力に簡略化。
 *
 * - identifier に `email-verify:{userEmail}` 形式で保管されている前提
 * - value にハッシュ化された 6 桁コード
 * - expires_at で有効期限チェック
 */
export async function verifyEmailAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const parsed = VerifyEmailSchema.safeParse({
    code: formData.get("code"),
  });
  if (!parsed.success) {
    redirect("/verify-email?error=invalid_code");
  }

  const identifier = `email-verify:${session.email}`;
  const now = new Date();

  // eslint-disable-next-line no-restricted-syntax -- 認証検証 (scoped 例外)
  const rows = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.identifier, identifier),
        gt(verifications.expiresAt, now),
      ),
    )
    .limit(1);
  const row = rows[0];

  if (!row) {
    redirect("/verify-email?error=expired");
  }

  if (row.value !== parsed.data.code) {
    redirect("/verify-email?error=invalid_code");
  }

  // 検証 OK → users を更新 + verifications レコードを削除
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, session.userId));
  await db.delete(verifications).where(eq(verifications.id, row.id));

  redirect("/onboarding/learner");
}

/**
 * 6桁コードを再送 (Better Auth の sendVerificationEmail にフック)
 */
export async function resendVerificationAction(): Promise<void> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  try {
    await auth.api.sendVerificationEmail({
      body: {
        email: session.email,
        callbackURL: "/onboarding/learner",
      },
      headers: await headers(),
    });
  } catch {
    redirect("/verify-email?error=unknown");
  }
  redirect("/verify-email?sent=1");
}
