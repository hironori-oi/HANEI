/**
 * HANEI - 認可ガード (三層認可防衛・第二層 / DEC-003)
 *
 * 第一層: middleware (proxy.ts) でセッション cookie 存在チェック
 * 第二層: ここで定義する require* 関数で「誰が・どこに・何をできるか」を強制
 * 第三層: src/lib/db/scoped.ts の scopedQueries(familyId) で SQL レベル絞り込み
 *
 * 全ての Server Action / Route Handler は冒頭で require* を呼ぶこと。
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "@/lib/db/client";
import { familyMembers, learnerProfiles } from "@/lib/db/schema";

export interface AuthSession {
  userId: string;
  email: string;
  role: "parent" | "learner" | "admin";
  emailVerified: boolean;
}

type FamilyMember = typeof familyMembers.$inferSelect;

/**
 * 現在のセッションを取得 (Better Auth から)。なければ null。
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session.user) return null;
    const user = session.user as {
      id: string;
      email: string;
      emailVerified?: boolean;
      role?: "parent" | "learner" | "admin";
    };
    return {
      userId: user.id,
      email: user.email,
      role: user.role ?? "parent",
      emailVerified: user.emailVerified ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * 未ログインなら /login にリダイレクト。
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * メール認証必須。未認証なら /verify-email にリダイレクト。
 */
export async function requireVerifiedEmail(): Promise<AuthSession> {
  const session = await requireAuth();
  if (!session.emailVerified) {
    redirect("/verify-email");
  }
  return session;
}

/**
 * 管理者ロール必須 (W12-T1 / DEC-065).
 *
 *  - 第一層 (middleware) でセッション cookie の存在を担保する.
 *  - 第二層 = ここ. role !== "admin" の場合は /home へ redirect (throw ではなく redirect で
 *    error boundary を汚さず middleware 風 UX を保つ / DEC-065 §判断根拠 4-5).
 *  - 第三層 (scopedQueries / SQL aggregate) は呼び出し元で担う. KPI ダッシュボードは
 *    family-scoped でなく集約値のみを表示するため, 個別 family / learner row は構造的に
 *    flow しない (COPPA / DEC-003).
 *
 * 戻り値は AuthSession (role: "admin" 確定).
 */
export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireAuth();
  if (session.role !== "admin") {
    redirect("/home");
  }
  return session;
}

/**
 * 認証済みかつ family_members.role = 'parent' であることを確認。
 */
export async function requireParent(userId: string): Promise<{ familyId: string }> {
  // 認可判定そのもの (eslint.config.mjs 内 files 例外で no-restricted-syntax は無効化済)
  const rows = await db
    .select({ familyId: familyMembers.familyId, role: familyMembers.role })
    .from(familyMembers)
    .where(and(eq(familyMembers.userId, userId), eq(familyMembers.role, "parent")))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error("[HANEI/auth] requireParent: user is not a parent in any family");
  }
  return { familyId: row.familyId };
}

/**
 * 指定 user が指定 family のメンバーであることを確認。
 */
export async function requireFamilyMember(
  userId: string,
  familyId: string,
): Promise<FamilyMember> {
  // 認可判定そのもの (eslint.config.mjs 内 files 例外で no-restricted-syntax は無効化済)
  const rows = await db
    .select()
    .from(familyMembers)
    .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, familyId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(
      `[HANEI/auth] requireFamilyMember: user ${userId} is not in family ${familyId}`,
    );
  }
  return row;
}

/**
 * 親が学習者プロフィールにアクセス可能かを確認。
 */
export async function requireLearnerOwner(
  parentUserId: string,
  learnerId: string,
): Promise<{ familyId: string; learnerId: string }> {
  // 認可判定そのもの (eslint.config.mjs 内 files 例外で no-restricted-syntax は無効化済)
  const rows = await db
    .select({
      familyId: familyMembers.familyId,
    })
    .from(familyMembers)
    .innerJoin(
      learnerProfiles,
      and(
        eq(familyMembers.familyId, learnerProfiles.familyId),
        eq(learnerProfiles.id, learnerId),
      ),
    )
    .where(
      and(
        eq(familyMembers.userId, parentUserId),
        eq(familyMembers.role, "parent"),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(
      `[HANEI/auth] requireLearnerOwner: parent ${parentUserId} cannot access learner ${learnerId}`,
    );
  }
  return { familyId: row.familyId, learnerId };
}

/**
 * 認証済みかつ family_members.role = 'learner' であることを確認 (W12-T2 / DEC-076).
 *
 * 学習者本人が自分のリソース (受験日 / 学習目標 等) を直接操作するパスで使う第二層認可。
 * 親が parent role でログインしている場合は本ガードは throw し、呼び出し側が
 * 「parent path」「learner-self path」の二系統認可で分岐する想定 (DEC-003 三層認可拡張)。
 *
 * 現行 Phase 1〜2 では学習者ログイン経路が無く、親が学習者画面 (/home) を代理操作する
 * 構造になっている。本ガードは将来 learner 直接ログイン導入時の forward-compat と、
 * テスト時の意図明示のために先行整備する (mutation +0 / top-level fn ではなく helper)。
 */
export async function requireLearner(
  userId: string,
): Promise<{ familyId: string }> {
  // 認可判定そのもの (eslint.config.mjs 内 files 例外で no-restricted-syntax は無効化済)
  const rows = await db
    .select({ familyId: familyMembers.familyId, role: familyMembers.role })
    .from(familyMembers)
    .where(and(eq(familyMembers.userId, userId), eq(familyMembers.role, "learner")))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error("[HANEI/auth] requireLearner: user is not a learner in any family");
  }
  return { familyId: row.familyId };
}

/**
 * 学習者本人が「自分自身の learnerProfiles 行」にアクセスしていることを確認 (W12-T2 / DEC-076).
 *
 * 学習者として認証している userId が、対象 learnerId の所有者 (learnerProfiles.userId 一致) で
 * あることを SQL レベルで検証する。第三層 (DB scoped) の代替として learnerId に紐付く
 * userId を直接照合する。
 *
 * 現行 Phase 1〜2 では学習者ログイン経路がないため、本ガードは forward-compat として
 * 用意する。実運用では親代理 (requireParent + requireLearnerOwner) を使うため、
 * 現状本ガードの呼び出しは Server Action 内の二系統認可分岐の learner-self 枝で発火する。
 */
export async function requireSelfLearner(
  learnerUserId: string,
  learnerId: string,
): Promise<{ familyId: string; learnerId: string }> {
  // 認可判定そのもの (eslint.config.mjs 内 files 例外で no-restricted-syntax は無効化済)
  const rows = await db
    .select({
      familyId: learnerProfiles.familyId,
    })
    .from(learnerProfiles)
    .where(
      and(
        eq(learnerProfiles.id, learnerId),
        eq(learnerProfiles.userId, learnerUserId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(
      `[HANEI/auth] requireSelfLearner: learner ${learnerUserId} cannot access learner profile ${learnerId}`,
    );
  }
  return { familyId: row.familyId, learnerId };
}

/**
 * セッションから家族 ID を取得 (parent / learner どちらでも可)。
 * 家族未所属なら null (新規 onboarding 中の状態)。
 */
export async function getFamilyIdForUser(userId: string): Promise<string | null> {
  // 認可判定そのもの (eslint.config.mjs 内 files 例外で no-restricted-syntax は無効化済)
  const rows = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .limit(1);
  return rows[0]?.familyId ?? null;
}
