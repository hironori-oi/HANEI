/**
 * HANEI - Drizzle Schema (Turso / libSQL / SQLite)
 *
 * W1: 最小10テーブル雛形 (DEC-003 / dev-phase0 §2 を W1 スコープに圧縮)
 * W2: +15 テーブル拡張 = 合計 25 テーブル
 *   - Better Auth: sessions / accounts / verifications
 *   - 学習計画/進捗: daily_plans / streaks / xp_levels / mastery_estimates
 *   - ゲーミフィケーション: badges / user_badges / characters
 *   - 模試/受験: mock_exam_results / exam_dates
 *   - AI コーチ: ai_coach_conversations / ai_coach_messages
 *   - 問題生成パイプライン: generated_problems_queue / problem_explanations
 */

import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// 1. users (Better Auth 連携 / 保護者 + 学習者の認証アカウント)
// ---------------------------------------------------------------------------
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    name: text("name"),
    image: text("image"),
    role: text("role", { enum: ["parent", "learner", "admin"] })
      .notNull()
      .default("parent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

// ---------------------------------------------------------------------------
// 2. families (1家族 = 1テナント)
// ---------------------------------------------------------------------------
export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  plan: text("plan", { enum: ["free"] }).notNull().default("free"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// 3. family_members (user × family + role)
// 三層認可防衛のスコープキー: family_id
// ---------------------------------------------------------------------------
export const familyMembers = sqliteTable(
  "family_members",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["parent", "learner"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    uniqUserFamily: uniqueIndex("family_members_user_family_idx").on(t.userId, t.familyId),
    familyIdx: index("family_members_family_idx").on(t.familyId),
  }),
);

// ---------------------------------------------------------------------------
// 4. parent_consents (13歳未満 保護者同意ログ)
// ---------------------------------------------------------------------------
export const parentConsents = sqliteTable("parent_consents", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  parentUserId: text("parent_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  learnerProfileId: text("learner_profile_id"),
  consentType: text("consent_type", {
    enum: ["coppa_initial", "ai_chat", "voice_recording", "analytics", "terms"],
  }).notNull(),
  consentVersion: text("consent_version").notNull(),
  signature: text("signature"),
  consentedAt: integer("consented_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
});

// ---------------------------------------------------------------------------
// 5. learner_profiles (子どもプロフィール / 1家族 = 複数子)
// ---------------------------------------------------------------------------
export const learnerProfiles = sqliteTable(
  "learner_profiles",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    nickname: text("nickname").notNull(),
    avatarId: text("avatar_id").notNull().default("kotodama_tori"),
    currentLevel: text("current_level", {
      enum: ["beginner", "eiken5", "eiken4", "eiken3"],
    }).notNull(),
    targetEikenLevel: text("target_eiken_level", { enum: ["5", "4", "3"] }).notNull(),
    examDate: text("exam_date"),
    dailyMinutesTarget: integer("daily_minutes_target").notNull().default(60),
    /**
     * 自己選択日次ゴール XP (W8-T5)
     * - 4 段階: 10 (軽い) / 20 (ふつう) / 30 (がんばる) / 50 (本気)
     * - default 20 = 「ふつう」 (10 分目安)
     * - 学習者本人 or 保護者が settings から変更可
     * - SDT Autonomy 充足の主軸 (Locke & Latham 1990 / Duolingo retention 主軸)
     */
    dailyGoalXp: integer("daily_goal_xp").notNull().default(20),
    /**
     * 学習者プリファレンス JSON (W8-T3 / W8-T4)
     * - soundEnabled: 効果音 ON/OFF (default: true)
     * - confettiEnabled: 紙吹雪演出 ON/OFF (default: true)
     * 保護者が settings 画面から制御する。
     */
    preferences: text("preferences", { mode: "json" })
      .$type<{ soundEnabled?: boolean; confettiEnabled?: boolean }>()
      .notNull()
      .default(sql`('{"soundEnabled":true,"confettiEnabled":true}')`),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    familyIdx: index("learner_profiles_family_idx").on(t.familyId),
  }),
);

// ---------------------------------------------------------------------------
// 6. eiken_levels
// ---------------------------------------------------------------------------
export const eikenLevels = sqliteTable("eiken_levels", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  targetVocabCount: integer("target_vocab_count").notNull(),
  description: text("description"),
});

// ---------------------------------------------------------------------------
// 7. skills
// ---------------------------------------------------------------------------
export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  parentSkillId: text("parent_skill_id"),
  eikenLevelId: text("eiken_level_id")
    .notNull()
    .references(() => eikenLevels.id, { onDelete: "restrict" }),
  displayName: text("display_name").notNull(),
});

// ---------------------------------------------------------------------------
// 8. problems
// ---------------------------------------------------------------------------
export const problems = sqliteTable(
  "problems",
  {
    id: text("id").primaryKey(),
    levelId: text("level_id")
      .notNull()
      .references(() => eikenLevels.id, { onDelete: "restrict" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "restrict" }),
    type: text("type", {
      enum: [
        "mcq",
        "fill_in",
        "reorder",
        "listening_mcq",
        "reading_passage_mcq",
        "writing_essay",
      ],
    }).notNull(),
    questionJson: text("question_json", { mode: "json" }).notNull(),
    correctAnswer: text("correct_answer").notNull(),
    explanation: text("explanation").notNull(),
    generationQualityScore: real("generation_quality_score"),
    qaVerdict: text("qa_verdict", { enum: ["pass", "fail", "pending"] })
      .notNull()
      .default("pending"),
    qaReasons: text("qa_reasons", { mode: "json" }),
    qaStatus: text("qa_status", { enum: ["draft", "reviewed", "live", "retired"] })
      .notNull()
      .default("draft"),
    audioUrl: text("audio_url"),
    source: text("source", { enum: ["ai_generated", "curated", "past_paper"] })
      .notNull()
      .default("ai_generated"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    levelSkillIdx: index("problems_level_skill_idx").on(t.levelId, t.skillId),
    qaStatusIdx: index("problems_qa_status_idx").on(t.qaStatus),
  }),
);

// ---------------------------------------------------------------------------
// 9. answer_logs
// ---------------------------------------------------------------------------
export const answerLogs = sqliteTable(
  "answer_logs",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "restrict" }),
    userAnswer: text("user_answer").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    timeSpentMs: integer("time_spent_ms").notNull(),
    answeredAt: integer("answered_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    learnerIdx: index("answer_logs_learner_idx").on(t.learnerId, t.answeredAt),
    learnerProblemIdx: index("answer_logs_learner_problem_idx").on(t.learnerId, t.problemId),
  }),
);

// ---------------------------------------------------------------------------
// 10. srs_states (FSRS 状態 / learner × problem ユニーク)
// ---------------------------------------------------------------------------
export const srsStates = sqliteTable(
  "srs_states",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    fsrsState: text("fsrs_state", { mode: "json" }).notNull(),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(5),
    state: integer("state").notNull().default(0),
    dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp" }),
    reviewCount: integer("review_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    uniqLearnerProblem: uniqueIndex("srs_states_learner_problem_idx").on(
      t.learnerId,
      t.problemId,
    ),
    learnerDueIdx: index("srs_states_learner_due_idx").on(t.learnerId, t.dueAt),
  }),
);

// ===========================================================================
// W2 拡張テーブル (+15)
// ===========================================================================

// ---------------------------------------------------------------------------
// 11. sessions (Better Auth セッション)
// ---------------------------------------------------------------------------
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    tokenIdx: uniqueIndex("sessions_token_idx").on(t.token),
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

// ---------------------------------------------------------------------------
// 12. accounts (Better Auth oauth/email 用)
// ---------------------------------------------------------------------------
export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    providerAccountIdx: uniqueIndex("accounts_provider_account_idx").on(
      t.providerId,
      t.accountId,
    ),
    userIdx: index("accounts_user_idx").on(t.userId),
  }),
);

// ---------------------------------------------------------------------------
// 13. verifications (メール認証コード / Better Auth)
// ---------------------------------------------------------------------------
export const verifications = sqliteTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    identifierIdx: index("verifications_identifier_idx").on(t.identifier),
  }),
);

// ---------------------------------------------------------------------------
// 14. daily_plans (その日の学習プラン)
// ---------------------------------------------------------------------------
export const dailyPlans = sqliteTable(
  "daily_plans",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // ISO YYYY-MM-DD
    targetMinutes: integer("target_minutes").notNull().default(60),
    vocabCount: integer("vocab_count").notNull().default(0),
    grammarCount: integer("grammar_count").notNull().default(0),
    listeningCount: integer("listening_count").notNull().default(0),
    writingCount: integer("writing_count").notNull().default(0),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    uniqLearnerDate: uniqueIndex("daily_plans_learner_date_idx").on(t.learnerId, t.date),
  }),
);

// ---------------------------------------------------------------------------
// 15. streaks (連続学習日数)
// ---------------------------------------------------------------------------
export const streaks = sqliteTable("streaks", {
  id: text("id").primaryKey(),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learnerProfiles.id, { onDelete: "cascade" })
    .unique(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: text("last_active_date"), // ISO YYYY-MM-DD
  freezeTickets: integer("freeze_tickets").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// 16. xp_levels (経験値・レベル)
// ---------------------------------------------------------------------------
export const xpLevels = sqliteTable("xp_levels", {
  id: text("id").primaryKey(),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learnerProfiles.id, { onDelete: "cascade" })
    .unique(),
  totalXp: integer("total_xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  nextLevelXp: integer("next_level_xp").notNull().default(100),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// 17. badges (達成バッジ マスタ)
// ---------------------------------------------------------------------------
export const badges = sqliteTable(
  "badges",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    iconName: text("icon_name").notNull(), // Heroicon name (e.g., 'TrophyIcon')
    /** W9-C: tier (rarity / 演出強度) — "bronze" | "silver" | "gold" | "platinum" */
    tier: text("tier", { enum: ["bronze", "silver", "gold", "platinum"] })
      .notNull()
      .default("bronze"),
    criteriaJson: text("criteria_json", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    codeIdx: uniqueIndex("badges_code_idx").on(t.code),
  }),
);

// ---------------------------------------------------------------------------
// 18. user_badges (badges 中間 / 学習者の獲得バッジ)
// ---------------------------------------------------------------------------
export const userBadges = sqliteTable(
  "user_badges",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    badgeId: text("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    earnedAt: integer("earned_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    uniqLearnerBadge: uniqueIndex("user_badges_learner_badge_idx").on(
      t.learnerId,
      t.badgeId,
    ),
    learnerIdx: index("user_badges_learner_idx").on(t.learnerId),
  }),
);

// ---------------------------------------------------------------------------
// 19. mock_exam_results (模試結果)
// ---------------------------------------------------------------------------
export const mockExamResults = sqliteTable(
  "mock_exam_results",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    level: text("level", { enum: ["5", "4", "3"] }).notNull(),
    score: integer("score").notNull(),
    maxScore: integer("max_score").notNull(),
    vocabCorrect: integer("vocab_correct").notNull().default(0),
    grammarCorrect: integer("grammar_correct").notNull().default(0),
    listeningCorrect: integer("listening_correct").notNull().default(0),
    writingScore: integer("writing_score").notNull().default(0),
    takenAt: integer("taken_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    learnerIdx: index("mock_exam_results_learner_idx").on(t.learnerId, t.takenAt),
  }),
);

// ---------------------------------------------------------------------------
// 20. ai_coach_conversations (AI コーチ会話セッション)
// ---------------------------------------------------------------------------
export const aiCoachConversations = sqliteTable(
  "ai_coach_conversations",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    contextType: text("context_type", {
      enum: ["general", "wrong_answer", "study_plan", "encouragement"],
    })
      .notNull()
      .default("general"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    learnerIdx: index("ai_coach_conversations_learner_idx").on(t.learnerId, t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// 21. ai_coach_messages (メッセージ単位 / コスト記録 + moderation 結果)
// ---------------------------------------------------------------------------
export const aiCoachMessages = sqliteTable(
  "ai_coach_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiCoachConversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system", "tool"] }).notNull(),
    content: text("content").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costJpy: real("cost_jpy").notNull().default(0),
    moderationVerdict: text("moderation_verdict", {
      enum: ["pass", "blocked_input", "blocked_output", "warning"],
    })
      .notNull()
      .default("pass"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    conversationIdx: index("ai_coach_messages_conv_idx").on(
      t.conversationId,
      t.createdAt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 22. mastery_estimates (IRT/BKT パラメータ / skill 別)
// ---------------------------------------------------------------------------
export const masteryEstimates = sqliteTable(
  "mastery_estimates",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    theta: real("theta").notNull().default(0), // IRT theta
    masteryProb: real("mastery_prob").notNull().default(0.5), // BKT P(L)
    lastUpdated: integer("last_updated", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    uniqLearnerSkill: uniqueIndex("mastery_estimates_learner_skill_idx").on(
      t.learnerId,
      t.skillId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 23. characters (ことだまトリ育成)
// ---------------------------------------------------------------------------
export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learnerProfiles.id, { onDelete: "cascade" })
    .unique(),
  mood: text("mood", { enum: ["happy", "normal", "tired", "excited"] })
    .notNull()
    .default("normal"),
  level: integer("level").notNull().default(1),
  accessoryIdsJson: text("accessory_ids_json", { mode: "json" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// 24. generated_problems_queue (LLM 生成キュー / cron で消化)
// ---------------------------------------------------------------------------
export const generatedProblemsQueue = sqliteTable(
  "generated_problems_queue",
  {
    id: text("id").primaryKey(),
    status: text("status", {
      enum: ["pending", "processing", "passed", "failed", "retired"],
    })
      .notNull()
      .default("pending"),
    level: text("level", { enum: ["5", "4", "3"] }).notNull(),
    skill: text("skill", {
      enum: ["vocabulary", "grammar", "listening", "reading", "writing", "speaking"],
    }).notNull(),
    prompt: text("prompt"),
    generationId: text("generation_id"),
    judgeScore: real("judge_score"),
    judgeVerdict: text("judge_verdict", { enum: ["pass", "fail", "pending"] })
      .notNull()
      .default("pending"),
    retries: integer("retries").notNull().default(0),
    problemId: text("problem_id"), // 採点 pass 時に投入された problems.id
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    statusIdx: index("generated_problems_queue_status_idx").on(t.status, t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// 25. problem_explanations (問題解説 / AI 生成 + 既存解説の上書き保存)
// ---------------------------------------------------------------------------
export const problemExplanations = sqliteTable(
  "problem_explanations",
  {
    id: text("id").primaryKey(),
    problemId: text("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    explanationText: text("explanation_text").notNull(),
    generatedBy: text("generated_by", { enum: ["ai_coach", "curated", "fallback"] })
      .notNull()
      .default("ai_coach"),
    generatedAt: integer("generated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    problemIdx: index("problem_explanations_problem_idx").on(t.problemId),
  }),
);

// ---------------------------------------------------------------------------
// 26-A. accessories (W9-T2 / アクセサリ マスタ)
//
// ことだまトリ装着用アクセサリ。3 スロット (hat / scarf / wing_charm) × 4 種 = 12 種。
// unlock 条件は `unlock_type` + `unlock_value` の機械可読 enum で表現する。
//   - unlock_type = 'level': xp_levels.level >= unlock_value (number)
//   - unlock_type = 'streak': streaks.currentStreak >= unlock_value (number)
//   - unlock_type = 'xp': xp_levels.totalXp >= unlock_value (number)
//   - unlock_type = 'badge': user_badges に対応する badges.code を保持
// ---------------------------------------------------------------------------
export const accessories = sqliteTable(
  "accessories",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(), // 'hat_school_cap' 等
    slot: text("slot", { enum: ["hat", "scarf", "wing_charm"] }).notNull(),
    name: text("name").notNull(),
    unlockType: text("unlock_type", {
      enum: ["level", "streak", "xp", "badge"],
    }).notNull(),
    unlockValue: text("unlock_value").notNull(),
    description: text("description").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    codeIdx: uniqueIndex("accessories_code_idx").on(t.code),
    slotIdx: index("accessories_slot_idx").on(t.slot, t.displayOrder),
  }),
);

// ---------------------------------------------------------------------------
// 26-B. learner_accessories (W9-T2 / 解禁 + 装着状態)
// ---------------------------------------------------------------------------
export const learnerAccessories = sqliteTable(
  "learner_accessories",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    /**
     * accessories.code を参照。FK は付けない (code 主軸 enum / seed 順序非依存)。
     */
    accessoryCode: text("accessory_code").notNull(),
    unlockedAt: integer("unlocked_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** 0 / 1 (drizzle SQLite mode: boolean) */
    isEquipped: integer("is_equipped", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    uniqLearnerAccessory: uniqueIndex("learner_accessories_learner_code_idx").on(
      t.learnerId,
      t.accessoryCode,
    ),
    learnerIdx: index("learner_accessories_learner_idx").on(t.learnerId),
  }),
);

// ---------------------------------------------------------------------------
// 26. exam_dates (受験日登録 / 1学習者複数登録可・最新を採用)
// ---------------------------------------------------------------------------
export const examDates = sqliteTable(
  "exam_dates",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    level: text("level", { enum: ["5", "4", "3"] }).notNull(),
    examDate: text("exam_date").notNull(), // ISO YYYY-MM-DD
    countdownDays: integer("countdown_days"),
    planGenerated: integer("plan_generated", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    learnerIdx: index("exam_dates_learner_idx").on(t.learnerId, t.examDate),
  }),
);

// ---------------------------------------------------------------------------
// 27. message_templates (W9-T5 親→子応援メッセージテンプレ マスタ)
//
// 30 種 = 5 カテゴリ × 6 種:
//   - encourage_start  (A1..A6) 学習開始の応援
//   - celebrate        (B1..B6) 達成への祝福
//   - encourage_struggle (C1..C6) 困難への励まし
//   - check_in         (D1..D6) 学習継続の確認
//   - exam_countdown   (E1..E6) 受験日カウントダウン
//
// body 内 placeholder: {streak_days} / {exam_days} は送信時に解決される。
// ---------------------------------------------------------------------------
export const messageTemplates = sqliteTable(
  "message_templates",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(), // 'A1' .. 'E6'
    category: text("category", {
      enum: [
        "encourage_start",
        "celebrate",
        "encourage_struggle",
        "check_in",
        "exam_countdown",
      ],
    }).notNull(),
    body: text("body").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    codeIdx: uniqueIndex("message_templates_code_idx").on(t.code),
    categoryIdx: index("message_templates_category_idx").on(t.category, t.displayOrder),
  }),
);

// ---------------------------------------------------------------------------
// 28. parent_messages (W9-T5 親→子メッセージ送信ログ)
//
// 三層認可境界:
//   - 第二層: requireParent + requireLearnerOwner (同 family_id 強制)
//   - 第三層: family_id を SQL 条件で必須化
// ---------------------------------------------------------------------------
export const parentMessages = sqliteTable(
  "parent_messages",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toLearnerId: text("to_learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    templateCode: text("template_code"), // NULL なら自由文
    body: text("body").notNull(), // placeholder 解決後の本文
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    toLearnerIdx: index("parent_messages_to_learner_idx").on(t.toLearnerId, t.createdAt),
    familyIdx: index("parent_messages_family_idx").on(t.familyId, t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// Drizzle inferred types
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Family = typeof families.$inferSelect;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type ParentConsent = typeof parentConsents.$inferSelect;
export type NewParentConsent = typeof parentConsents.$inferInsert;
export type LearnerProfile = typeof learnerProfiles.$inferSelect;
export type NewLearnerProfile = typeof learnerProfiles.$inferInsert;
export type Problem = typeof problems.$inferSelect;
export type AnswerLog = typeof answerLogs.$inferSelect;
export type NewAnswerLog = typeof answerLogs.$inferInsert;
export type SrsState = typeof srsStates.$inferSelect;
export type NewSrsState = typeof srsStates.$inferInsert;

// W2 拡張
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type DailyPlan = typeof dailyPlans.$inferSelect;
export type Streak = typeof streaks.$inferSelect;
export type XpLevel = typeof xpLevels.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type MockExamResult = typeof mockExamResults.$inferSelect;
export type AiCoachConversation = typeof aiCoachConversations.$inferSelect;
export type AiCoachMessage = typeof aiCoachMessages.$inferSelect;
export type NewAiCoachMessage = typeof aiCoachMessages.$inferInsert;
export type MasteryEstimate = typeof masteryEstimates.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type GeneratedProblemsQueue = typeof generatedProblemsQueue.$inferSelect;
export type NewGeneratedProblemsQueue = typeof generatedProblemsQueue.$inferInsert;
export type ProblemExplanation = typeof problemExplanations.$inferSelect;
export type NewProblemExplanation = typeof problemExplanations.$inferInsert;
export type ExamDate = typeof examDates.$inferSelect;

// W9-T2 / Accessories
export type Accessory = typeof accessories.$inferSelect;
export type NewAccessory = typeof accessories.$inferInsert;
export type LearnerAccessory = typeof learnerAccessories.$inferSelect;
export type NewLearnerAccessory = typeof learnerAccessories.$inferInsert;

// W9-T5 / Parent → Child Messages
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;
export type ParentMessage = typeof parentMessages.$inferSelect;
export type NewParentMessage = typeof parentMessages.$inferInsert;
