/**
 * scripts/seed-dev-user.ts (W5 / W6 申し送り — dev ログインシード)
 *
 * 用途:
 *   - ローカル開発時に「すぐ手動ログインして動作確認できる」固定 dev ユーザーを
 *     `local.db` に投入する。
 *   - `tests/e2e/fixtures/db-fixture.ts` の `applyMigrations()` を再利用し、
 *     drizzle migrations 0000/0001 を冪等適用してから seed を流すので、
 *     fresh な `local.db`（テーブル未作成）でも単一コマンドで完結する。
 *
 * 固定 ID 仕様 (CEO 決裁・変更不可):
 *   - Email     : owner@hanei.local
 *   - Password  : OwnerPass123!
 *   - name      : HANEI オーナー
 *   - role      : parent
 *   - Family    : fam_dev_owner / "オーナー家族" / free
 *   - Learner   : lp_dev_taro / たろう / kotodama_tori / eiken5
 *   - Exam date : 2026-10-12
 *
 * 冪等性:
 *   - 既存 `users.email = 'owner@hanei.local'` を見つけたら、関連する family /
 *     family_members / parent_consents / learner_profiles / exam_dates / streaks /
 *     xp_levels / characters / accounts / sessions を CASCADE 経由で全削除してから
 *     再 INSERT する。
 *   - 各 INSERT は固定 ID を使うので、複数回走らせても重複しない。
 *
 * パスワードハッシュ:
 *   - Better Auth `auth.api.signUpEmail()` を呼ぶことで accounts テーブルに
 *     正しい scrypt hash が入る (DEC-018 構成)。
 *
 * 実行: `npm run db:seed:dev`
 */

// ---------------------------------------------------------------------------
// dev seed は必ずローカル SQLite (file:./local.db) を対象にする。
// .env.local には本番 Turso の URL が入っている可能性があるため、
// `src/lib/db/client.ts` (process.env.TURSO_DATABASE_URL を即時読む) や
// `src/lib/auth/auth.ts` を import する前に env を上書き固定する必要がある。
//
// → 静的 import で hoist される module は使わず、main() 内で動的 import する。
//
// CEO 直命: 「dev は file:./local.db」
// ---------------------------------------------------------------------------

import { eq, sql } from "drizzle-orm";
import { createClient } from "@libsql/client";

// ---------------------------------------------------------------------------
// 固定 ID 仕様
// ---------------------------------------------------------------------------
const SEED = {
  email: "owner@hanei.local",
  password: "OwnerPass123!",
  name: "HANEI オーナー",
  familyId: "fam_dev_owner",
  familyDisplayName: "オーナー家族",
  familyPlan: "free" as const,
  learnerId: "lp_dev_taro",
  learnerNickname: "たろう",
  learnerAvatarId: "kotodama_tori",
  learnerCurrentLevel: "eiken5" as const,
  learnerTargetEikenLevel: "5" as const,
  learnerDailyMinutesTarget: 60,
  examDate: "2026-10-12",
} as const;

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  // 0. env 上書き → そのあとで env 依存モジュールを動的 import
  //    (`src/lib/db/client` はモジュール評価時に process.env.TURSO_DATABASE_URL
  //    を読む。auth はその client を使う。よって両方とも remap 後に import する。)
  // -------------------------------------------------------------------------
  const original = process.env.TURSO_DATABASE_URL;
  if (!original || !original.startsWith("file:")) {
    process.env.TURSO_DATABASE_URL = "file:./local.db";
    delete process.env.TURSO_AUTH_TOKEN;
  }
  const DB_URL = process.env.TURSO_DATABASE_URL!;
  console.log(`[seed-dev-user] connection: ${DB_URL}`);

  const { applyMigrations } = await import("../tests/e2e/fixtures/db-fixture");
  const { db } = await import("../src/lib/db/client");
  const { auth } = await import("../src/lib/auth/auth");
  const {
    users,
    families,
    familyMembers,
    parentConsents,
    learnerProfiles,
    examDates,
    streaks,
    xpLevels,
    characters,
    eikenLevels,
    skills,
  } = await import("../src/lib/db/schema");

  // -------------------------------------------------------------------------
  // 1. drizzle migrations を冪等適用
  //    fresh な local.db (users テーブル未作成) でも本スクリプト単独で完結させる。
  // -------------------------------------------------------------------------
  const migrationClient = createClient({ url: DB_URL });
  try {
    await applyMigrations(migrationClient);
    console.log("[seed-dev-user] migrations applied (idempotent)");
  } finally {
    migrationClient.close();
  }

  // -------------------------------------------------------------------------
  // 2. 既存 dev ユーザーがいれば関連レコードごと削除 (冪等)
  // -------------------------------------------------------------------------
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, SEED.email))
    .limit(1);

  if (existing.length > 0) {
    const existingUserId = existing[0]!.id;
    console.log(
      `[seed-dev-user] existing user found (id=${existingUserId}) — purging related rows`,
    );

    // 学習者プロフィールにぶら下がるテーブルを先に消す
    const learners = await db
      .select({ id: learnerProfiles.id })
      .from(learnerProfiles)
      .where(eq(learnerProfiles.familyId, SEED.familyId));
    for (const l of learners) {
      await db.delete(streaks).where(eq(streaks.learnerId, l.id));
      await db.delete(xpLevels).where(eq(xpLevels.learnerId, l.id));
      await db.delete(characters).where(eq(characters.learnerId, l.id));
      await db.delete(examDates).where(eq(examDates.learnerId, l.id));
    }
    await db.delete(learnerProfiles).where(eq(learnerProfiles.familyId, SEED.familyId));
    await db.delete(parentConsents).where(eq(parentConsents.familyId, SEED.familyId));
    await db.delete(familyMembers).where(eq(familyMembers.familyId, SEED.familyId));
    await db.delete(families).where(eq(families.id, SEED.familyId));

    // accounts / sessions は users CASCADE で消えるが念のため明示
    await db.run(sql`DELETE FROM sessions WHERE user_id = ${existingUserId}`);
    await db.run(sql`DELETE FROM accounts WHERE user_id = ${existingUserId}`);
    await db.delete(users).where(eq(users.id, existingUserId));

    console.log("[seed-dev-user] purge complete");
  }

  // -------------------------------------------------------------------------
  // 3. eiken_levels / skills マスタの最低限投入 (空なら)
  // -------------------------------------------------------------------------
  const lvl5 = await db
    .select({ id: eikenLevels.id })
    .from(eikenLevels)
    .where(eq(eikenLevels.id, "5"))
    .limit(1);
  if (lvl5.length === 0) {
    await db.insert(eikenLevels).values({
      id: "5",
      displayName: "英検5級",
      targetVocabCount: 600,
      description: "中学初級レベル",
    });
    console.log("[seed-dev-user] inserted eiken_levels '5'");
  }
  const skVocab = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.id, "vocabulary"))
    .limit(1);
  if (skVocab.length === 0) {
    await db.insert(skills).values({
      id: "vocabulary",
      eikenLevelId: "5",
      displayName: "語彙",
    });
    console.log("[seed-dev-user] inserted skills 'vocabulary'");
  }

  // -------------------------------------------------------------------------
  // 4. Better Auth で signUpEmail を実行
  //    - accounts テーブルに正しい scrypt hash が入る
  //    - users 行 (id 自動生成) も作成される
  //    - requireEmailVerification:false なので即ログイン可能
  // -------------------------------------------------------------------------
  console.log("[seed-dev-user] signUpEmail via Better Auth...");
  const signUpResult = await auth.api.signUpEmail({
    body: {
      email: SEED.email,
      password: SEED.password,
      name: SEED.name,
    },
  });

  // Better Auth 1.1.x の signUpEmail 戻り値の形は揺れるので id は DB から再取得
  const created = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, SEED.email))
    .limit(1);
  if (created.length === 0) {
    throw new Error(
      `[seed-dev-user] signUpEmail did not create a user row (result=${JSON.stringify(signUpResult)})`,
    );
  }
  const userId = created[0]!.id;
  console.log(`[seed-dev-user] user created: id=${userId}`);

  // role 明示 + emailVerified=true (本番フローでは verify 必要だが dev seed は即利用可とする)
  await db
    .update(users)
    .set({ role: "parent", emailVerified: true })
    .where(eq(users.id, userId));

  // -------------------------------------------------------------------------
  // 5. family / family_members / parent_consents / learner_profiles /
  //    exam_dates / streaks / xp_levels / characters を直接 INSERT
  // -------------------------------------------------------------------------
  await db.insert(families).values({
    id: SEED.familyId,
    displayName: SEED.familyDisplayName,
    plan: SEED.familyPlan,
  });

  await db.insert(familyMembers).values({
    id: "fm_dev_owner",
    familyId: SEED.familyId,
    userId,
    role: "parent",
  });

  // 13歳未満の同意 3 種を最低 1 行ずつ
  const consentKinds = ["coppa_initial", "ai_chat", "terms"] as const;
  for (let i = 0; i < consentKinds.length; i++) {
    await db.insert(parentConsents).values({
      id: `pc_dev_${i}`,
      familyId: SEED.familyId,
      parentUserId: userId,
      consentType: consentKinds[i]!,
      consentVersion: "v1",
    });
  }

  await db.insert(learnerProfiles).values({
    id: SEED.learnerId,
    familyId: SEED.familyId,
    nickname: SEED.learnerNickname,
    avatarId: SEED.learnerAvatarId,
    currentLevel: SEED.learnerCurrentLevel,
    targetEikenLevel: SEED.learnerTargetEikenLevel,
    examDate: SEED.examDate,
    dailyMinutesTarget: SEED.learnerDailyMinutesTarget,
  });

  await db.insert(examDates).values({
    id: "ed_dev_owner",
    learnerId: SEED.learnerId,
    level: SEED.learnerTargetEikenLevel,
    examDate: SEED.examDate,
    planGenerated: false,
  });

  await db.insert(streaks).values({
    id: "sk_dev_owner",
    learnerId: SEED.learnerId,
    currentStreak: 0,
    longestStreak: 0,
  });

  await db.insert(xpLevels).values({
    id: "xp_dev_owner",
    learnerId: SEED.learnerId,
    totalXp: 0,
    level: 1,
    nextLevelXp: 100,
  });

  await db.insert(characters).values({
    id: "ch_dev_owner",
    learnerId: SEED.learnerId,
    mood: "normal",
    level: 1,
  });

  console.log("[seed-dev-user] family / learner / streak / xp / character seeded");
  console.log("");
  console.log("[seed-dev-user] ✓ Dev seed completed. Login: owner@hanei.local / OwnerPass123!");
}

main()
  .then(() => {
    // libSQL client のハンドルが残ってプロセスがハングするのを避けるため明示 exit(0)
    process.exit(0);
  })
  .catch((err) => {
    console.error("[seed-dev-user] FAILED:", err);
    process.exit(1);
  });
