"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import {
  learnerProfiles,
  examDates,
  streaks,
  xpLevels,
  characters,
  dailyPlans,
} from "@/lib/db/schema";
import { requireAuth, requireParent } from "@/lib/auth/guards";
import { CreateLearnerSchema } from "./schema";

export async function createLearnerAction(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const { familyId } = await requireParent(session.userId);

  const parsed = CreateLearnerSchema.safeParse({
    nickname: formData.get("nickname"),
    avatar_id: formData.get("avatar_id"),
    current_level: formData.get("current_level"),
    target_level: formData.get("target_level"),
    exam_date: formData.get("exam_date"),
  });
  if (!parsed.success) {
    redirect("/onboarding/learner?error=invalid_input");
  }

  const data = parsed.data;
  const learnerId = `lr_${randomUUID()}`;

  await db.insert(learnerProfiles).values({
    id: learnerId,
    familyId,
    nickname: data.nickname,
    avatarId: data.avatar_id,
    currentLevel: data.current_level as "beginner" | "eiken5" | "eiken4",
    targetEikenLevel: data.target_level as "5" | "4" | "3",
    examDate: data.exam_date,
    dailyMinutesTarget: 60,
  });

  // 受験日 + 周辺レコード初期化 (進捗・XP・キャラクター・本日プラン)
  await db.insert(examDates).values({
    id: `ex_${randomUUID()}`,
    learnerId,
    level: data.target_level as "5" | "4" | "3",
    examDate: data.exam_date,
  });
  await db.insert(streaks).values({
    id: `st_${randomUUID()}`,
    learnerId,
    currentStreak: 0,
    longestStreak: 0,
  });
  await db.insert(xpLevels).values({
    id: `xp_${randomUUID()}`,
    learnerId,
    totalXp: 0,
    level: 1,
    nextLevelXp: 100,
  });
  await db.insert(characters).values({
    id: `ch_${randomUUID()}`,
    learnerId,
    mood: "happy",
    level: 1,
  });

  const today = new Date().toISOString().slice(0, 10);
  await db.insert(dailyPlans).values({
    id: `dp_${randomUUID()}`,
    learnerId,
    date: today,
    targetMinutes: 60,
    vocabCount: 15,
    grammarCount: 15,
    listeningCount: 15,
    writingCount: 15,
  });

  redirect("/home");
}
