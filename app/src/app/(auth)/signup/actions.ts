"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/client";
import { families, familyMembers, parentConsents } from "@/lib/db/schema";
import { CONSENT_VERSION } from "@/lib/constants";
import { SignupSchema } from "./schema";

export async function signupAction(formData: FormData): Promise<void> {
  const parsed = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    parent_name: formData.get("parent_name"),
    consent_coppa: formData.get("consent_coppa"),
    consent_ai_chat: formData.get("consent_ai_chat"),
    consent_terms: formData.get("consent_terms"),
  });

  if (!parsed.success) {
    redirect("/signup?error=invalid_input");
  }

  const { email, password, parent_name } = parsed.data;

  // 1. Better Auth で user 作成 (autoSignIn=true でセッション開始 + メール認証コード送付)
  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: parent_name,
      },
      headers: await headers(),
      asResponse: false,
    });
    const user = (result as { user?: { id: string } })?.user;
    if (!user?.id) {
      redirect("/signup?error=signup_failed");
    }
    userId = user.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message.toLowerCase().includes("already") || message.toLowerCase().includes("exist")) {
      redirect("/signup?error=email_exists");
    }
    redirect("/signup?error=signup_failed");
  }

  // 2. families レコードを作成
  const familyId = `fam_${randomUUID()}`;
  await db.insert(families).values({
    id: familyId,
    displayName: `${parent_name} さんの家族`,
  });

  // 3. family_members に parent role 登録
  await db.insert(familyMembers).values({
    id: `fm_${randomUUID()}`,
    familyId,
    userId,
    role: "parent",
  });

  // 4. parent_consents に 3レコード INSERT (COPPA / AI / Terms)
  const reqHeaders = await headers();
  const ipAddress =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    reqHeaders.get("x-real-ip") ??
    null;
  const userAgent = reqHeaders.get("user-agent") ?? null;
  const now = new Date();
  await db.insert(parentConsents).values([
    {
      id: `cs_${randomUUID()}`,
      familyId,
      parentUserId: userId,
      consentType: "coppa_initial",
      consentVersion: CONSENT_VERSION,
      ipAddress,
      userAgent,
      consentedAt: now,
    },
    {
      id: `cs_${randomUUID()}`,
      familyId,
      parentUserId: userId,
      consentType: "ai_chat",
      consentVersion: CONSENT_VERSION,
      ipAddress,
      userAgent,
      consentedAt: now,
    },
    {
      id: `cs_${randomUUID()}`,
      familyId,
      parentUserId: userId,
      consentType: "terms",
      consentVersion: CONSENT_VERSION,
      ipAddress,
      userAgent,
      consentedAt: now,
    },
  ]);

  // 5. メール認証画面へ
  redirect("/verify-email");
}
