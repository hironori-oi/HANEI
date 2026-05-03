"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/client";
import {
  betaInviteCodes,
  families,
  familyMembers,
  parentConsents,
  users,
  type BetaInviteCode,
} from "@/lib/db/schema";
import { CONSENT_VERSION } from "@/lib/constants";
import {
  isBetaInviteRequired,
  normalizeInviteCode,
  validateInviteCodeFormat,
} from "@/lib/beta/invite-codes";
import { SignupSchema } from "./schema";

export async function signupAction(formData: FormData): Promise<void> {
  const parsed = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    parent_name: formData.get("parent_name"),
    consent_coppa: formData.get("consent_coppa"),
    consent_ai_chat: formData.get("consent_ai_chat"),
    consent_terms: formData.get("consent_terms"),
    invite_code: formData.get("invite_code") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/signup?error=invalid_input");
  }

  const { email, password, parent_name } = parsed.data;

  // ---------------------------------------------------------------------
  // W12-T3-A (DEC-069): β 招待コード必須化チェック (env flag で gate)
  //  - BETA_INVITE_REQUIRED === "true" のときのみ有効化.
  //  - dev / staging / E2E (default) では invite_code を一切要求しない =
  //    既存 signup 挙動完全維持 (regression 0).
  //  - 形式検証 → DB SELECT → disabled / expired / full の順に redirect.
  //  - user 作成より前に弾くことで、無効 code 入力時の「孤児 user」発生を防ぐ.
  //  - 実際の redemptionCount +1 は user 作成後に race-safe atomic UPDATE で行う.
  // ---------------------------------------------------------------------
  const requireInvite = isBetaInviteRequired();
  let inviteCodeRow: BetaInviteCode | null = null;
  if (requireInvite) {
    const rawInvite = parsed.data.invite_code;
    const normalizedInviteCode = normalizeInviteCode(rawInvite ?? "");
    const fmt = validateInviteCodeFormat(normalizedInviteCode);
    if (!fmt.ok) {
      redirect("/signup?error=invite_invalid");
    }
    const rows = await db
      .select()
      .from(betaInviteCodes)
      .where(eq(betaInviteCodes.code, normalizedInviteCode))
      .limit(1);
    const found = rows[0];
    if (!found) {
      redirect("/signup?error=invite_not_found");
    }
    if (found.disabledAt) {
      redirect("/signup?error=invite_disabled");
    }
    if (found.expiresAt && found.expiresAt.getTime() < Date.now()) {
      redirect("/signup?error=invite_expired");
    }
    if (found.redemptionCount >= found.maxRedemptions) {
      redirect("/signup?error=invite_full");
    }
    inviteCodeRow = found;
  }

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

  // ---------------------------------------------------------------------
  // 4.5. W12-T3-A (DEC-069): β 招待コードの redeem (user 作成後 / atomic UPDATE)
  //  - DEC-055 idempotency:
  //      WHERE redemption_count < max_redemptions の race-safe atomic UPDATE.
  //      同 invite を 2 client が同時 redeem しても SQLite の serialized writes と
  //      WHERE 句で構造的に上限超過 0 を担保する.
  //  - 万一 race で 0 行 update (= 直前まで残 1 だったが他 client に先取りされた)
  //    の場合は invite_full に redirect (user は既に作成済だが、再 signup 経路で
  //    再利用される / family / consent も DB に残る. 厳格なロールバックは scope 外
  //    で T3-C 以降の hotfix 体制で吸収する).
  //  - users.beta_invited_by_code に code を記録 (履歴保持 / FK 不要).
  // ---------------------------------------------------------------------
  if (requireInvite && inviteCodeRow) {
    const inviteId = inviteCodeRow.id;
    const inviteCodeStr = inviteCodeRow.code;
    const redeemedOk = await db.transaction(async (tx) => {
      const updated = await tx
        .update(betaInviteCodes)
        .set({
          redemptionCount: sql`${betaInviteCodes.redemptionCount} + 1`,
        })
        .where(
          and(
            eq(betaInviteCodes.id, inviteId),
            lt(
              betaInviteCodes.redemptionCount,
              betaInviteCodes.maxRedemptions,
            ),
          ),
        )
        .returning({ id: betaInviteCodes.id });
      if (updated.length === 0) {
        // race condition で先に上限到達 = redeem しない / users 更新もしない.
        return false;
      }
      await tx
        .update(users)
        .set({ betaInvitedByCode: inviteCodeStr })
        .where(eq(users.id, userId));
      return true;
    });
    if (!redeemedOk) {
      redirect("/signup?error=invite_full");
    }
  }

  // 5. メール認証画面へ
  redirect("/verify-email");
}
