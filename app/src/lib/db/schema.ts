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
    /**
     * W12-T3-A (DEC-069): β invite flow
     *  - 当該 user が β 招待コード経由で signup した場合、該当 betaInviteCodes.code を保存.
     *  - nullable / FK 不要 (履歴保持目的 / 後で invite code を delete しても痕跡を残す).
     *  - better-auth は additionalFields で管理しないため、`input: false` 相当の運用 (signup
     *    action 内の DB UPDATE でのみ書き換え / クライアントから直接書き換え不可).
     */
    betaInvitedByCode: text("beta_invited_by_code"),
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
  /**
   * W11-T1: Family 内 Streak (家族のれんぞく)
   *  - 同一 family の learner 全員が共通の Family Streak を持つ.
   *  - 1 人でも当日学習すれば家族 Streak 維持 (兄弟がいる家庭の救済).
   *  - DEC-024 罰則ゼロ哲学: 切れた日も罰なく「またいつでも始められるよ」と前向きに表示.
   */
  familyStreakDays: integer("family_streak_days").notNull().default(0),
  /**
   * W11-T1: 直近で family streak が更新された日付 ('YYYY-MM-DD' / JST 6:00 境界).
   *  - getJstQuestDate(now) と同形式. quest_date と整合.
   *  - NULL = 一度も家族として学習していない (初学習で 1 になる).
   */
  lastFamilyActiveDate: text("last_family_active_date"),
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
     * 学習者プリファレンス JSON (W8-T3 / W8-T4 / W10-T5)
     * - soundEnabled: 効果音 ON/OFF (default: true)
     * - confettiEnabled: 紙吹雪演出 ON/OFF (default: true)
     * - preferredSessionMinutes: 「いつもの長さ」 5/7/10/null (W10-T5 / cross-device 永続化)
     * 保護者 / 学習者が settings 画面 + SessionPicker から制御する。
     */
    preferences: text("preferences", { mode: "json" })
      .$type<{
        soundEnabled?: boolean;
        confettiEnabled?: boolean;
        preferredSessionMinutes?: 5 | 7 | 10 | null;
      }>()
      .notNull()
      .default(sql`('{"soundEnabled":true,"confettiEnabled":true}')`),
    /**
     * W10-T1: ハネキン (はね金) 残高 (denormalized cache)
     * - 真のソースは coin_transactions の累計 (`SUM(amount) WHERE learner_id = ?`)
     *   だが 1 ユーザあたり毎日 10〜30 件の取引が想定されるため balance は denormalized.
     * - INSERT(coin_transactions) + UPDATE(coin_balance) を一連の awardCoins / spendCoins
     *   Server Action 内で原子的に行う (SQLite の serialized writes 前提)。
     * - 不変条件: coin_balance >= 0 (spendCoins は WHERE coin_balance >= amount で防御)。
     * - 課金システム化禁止 (DEC-012) : 外部購入導線ゼロの閉じた経済。
     */
    coinBalance: integer("coin_balance").notNull().default(0),
    /**
     * W12-T2: A/B test cohort 割当 JSON (DEC-066)
     * - shape: { [experimentKey: string]: variantKey: string }
     * - 例: { "streak_freeze_monthly_grant": "variant_a" }
     * - getOrAssignVariant で idempotent UPSERT (DEC-055)
     * - cohort 集計は SQL aggregate-only (json_extract / GROUP BY) で learner_id flow 0 (DEC-003)
     */
    experiments: text("experiments", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`('{}')`),
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
// 29. coin_transactions (W10-T1 ハネキン取引ログ)
//
// 仮想通貨「ハネキン (はね金)」の獲得 / 消費を 1 行 = 1 トランザクションで記録する。
//
// 不変条件:
//   - amount > 0  : 獲得 (lesson / streak / badge / quest / level_up / manual_adjust)
//   - amount < 0  : 消費 (shop_purchase / freeze_purchase / feed_purchase / manual_adjust)
//   - amount = 0  : 不正
//   - SUM(amount) WHERE learner_id = ?  ==  learner_profiles.coin_balance (denormalized)
//
// 三層認可:
//   - 第二層: requireLearnerOwner (Server Action 入口)
//   - 第三層: 全クエリに learner_id スコープ条件
//
// 課金システム化禁止 (DEC-012): 外部購入導線ゼロの閉じた経済。
// ---------------------------------------------------------------------------
export const coinTransactions = sqliteTable(
  "coin_transactions",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    /** 正 = 獲得 / 負 = 消費 / 0 不可 */
    amount: integer("amount").notNull(),
    /**
     * 取引理由: 獲得 5 種 + 消費 3 種 + manual_adjust。
     * "lesson" は問題正解での獲得、"streak" は連続記録達成、"badge" はバッジ獲得、
     * "quest" は Daily Quest 完了 (W10-T3)、"level_up" はレベル昇格 (任意)。
     * "shop_purchase" / "freeze_purchase" / "feed_purchase" は W10-T2 Shop UI で消費。
     */
    reason: text("reason", {
      enum: [
        "lesson",
        "streak",
        "badge",
        "quest",
        "level_up",
        "shop_purchase",
        "freeze_purchase",
        "feed_purchase",
        "manual_adjust",
      ],
    }).notNull(),
    /** 関連 ID (problemId / badgeId / questId / accessoryCode 等) - 監査・冪等チェック用 */
    referenceId: text("reference_id"),
    /** 表示用メモ (任意 / "週次連続 7 日達成" 等) */
    memo: text("memo"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    learnerIdx: index("coin_transactions_learner_idx").on(t.learnerId, t.createdAt),
    /** 冪等チェック用 (同一 reason + referenceId の重複付与を検出する SELECT が高速) */
    learnerReasonRefIdx: index("coin_transactions_learner_reason_ref_idx").on(
      t.learnerId,
      t.reason,
      t.referenceId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 30. learner_inventory (W10-T2 / Shop 購入で増えるアイテム在庫)
//
// アイテム種:
//   - 'streak_freeze'           : Streak 維持アイテム (W8 で 1 個無料配布 base / W10-T2 追加購入)
//   - 'kotodama_feed_normal'    : ことだまトリの普通エサ (mood +1)
//   - 'kotodama_feed_premium'   : ことだまトリの特上エサ (mood +3 + 24h 持続)
//   - 'kotodama_feed_rainy'     : 雨の日限定エサ (Phase 3 で天気 API 連動)
//
// 不変条件:
//   - 1 学習者 × 1 item_type = 1 行 (uniqueIndex で保証)
//   - quantity >= 0 (アプリ層で +1 のみ / 消費は W10-T5 以降)
//   - shop 購入経路でのみ INSERT/UPDATE (DEC-056 アクセサリは購入経路を持たない)
//
// 課金システム化禁止 (DEC-012): 外部購入導線ゼロの閉じた経済。
// ---------------------------------------------------------------------------
export const learnerInventory = sqliteTable(
  "learner_inventory",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    /**
     * Shop で購入できる item_type 識別子。
     * shop-prices.ts の `SHOP_ITEMS` キーと完全一致する必要がある。
     */
    itemType: text("item_type", {
      enum: [
        "streak_freeze",
        "kotodama_feed_normal",
        "kotodama_feed_premium",
        "kotodama_feed_rainy",
      ],
    }).notNull(),
    /** 在庫数 (常に >= 0) */
    quantity: integer("quantity").notNull().default(0),
    /** 最終取得日時 (購入で更新) */
    lastAcquiredAt: integer("last_acquired_at", { mode: "timestamp" }),
    /** 最終使用日時 (W10-T5 以降の消費 hook で更新予定) */
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    uniqLearnerItem: uniqueIndex("learner_inventory_learner_item_idx").on(
      t.learnerId,
      t.itemType,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 31. daily_quests (W10-T3 / Daily Quest デイリーミッション)
//
// 1 行 = 1 学習者 × 1 quest_date (JST) × 1 quest_type のクエスト割り当て。
//
// quest_type (7 種 / Phase 1):
//   - 'vocab_count'        : 今日 N 問の語彙正解 (skill='vocabulary')
//   - 'listening_perfect'  : 今日 N 問の listening を全問正解 (skill='listening')
//   - 'reading_count'      : 今日 N 問の reading 解答 (skill='reading')
//   - 'writing_count'      : 今日 1〜2 問の writing 解答 (skill='writing')
//   - 'streak_keep'        : 今日 1 問でも解いて streak をつなぐ
//   - 'badge_progress'     : 今日 N 問正解 (汎用)
//   - 'mock_warmup'        : 今日 1 度ミニ模試予熱 (Phase 3 stub / 進捗 0 のままでも完了不可)
//
// 不変条件:
//   - 1 (learner_id, quest_date, quest_type) = 1 行 (uniqueIndex で保証)
//   - progress >= 0 / progress <= target で UI の clamp は別途
//   - status は 'in_progress' → 'completed'(target 到達) → 'claimed'(報酬受け取り済) のみ
//   - claimed 後は再付与不可 (idempotency: claimQuestReward の冪等チェックで担保)
//   - quest_date は 'YYYY-MM-DD' 形式 (JST 6:00 境界で日付確定 / DEC-024 整合)
//
// Lazy generation:
//   - cron は使わない (Vercel Hobby plan 制約)
//   - /home or /quests への初回アクセスで「今日の 3 件」を deterministic に生成
//   - 同 (learner_id, quest_date) で既に行があれば再生成しない (冪等)
//
// 罰則ゼロ哲学 (DEC-024): 未達でも streak は減らさない / マイナス pop は出さない。
// ---------------------------------------------------------------------------
export const dailyQuests = sqliteTable(
  "daily_quests",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    /** JST ローカル日付 ('YYYY-MM-DD') / 6:00 境界で日付確定 */
    questDate: text("quest_date").notNull(),
    questType: text("quest_type", {
      enum: [
        "vocab_count",
        "listening_perfect",
        "reading_count",
        "writing_count",
        "streak_keep",
        "badge_progress",
        "mock_warmup",
      ],
    }).notNull(),
    /** UI 表示タイトル (生成時 snapshot / 文言変更しても過去日は不変) */
    title: text("title").notNull(),
    /** 達成目標 (例: vocab_count なら 5 = 今日 5 問正解) */
    target: integer("target").notNull(),
    /** 現在の進捗 (submitAnswer の hook で incrementQuestProgress 経由で進む) */
    progress: integer("progress").notNull().default(0),
    /** 完了時の報酬ハネキン (生成時 snapshot / COIN_REWARDS.QUEST_COMPLETE 既定) */
    rewardCoins: integer("reward_coins").notNull(),
    /** 'in_progress' (未達 or 達成だが未受領) / 'claimed' (報酬受領済) */
    status: text("status", { enum: ["in_progress", "claimed"] })
      .notNull()
      .default("in_progress"),
    /** 達成 (progress >= target) になった瞬間 (UI のお祝い演出基準) */
    completedAt: integer("completed_at", { mode: "timestamp" }),
    /** 報酬受領日時 */
    claimedAt: integer("claimed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    /** 1 学習者 × 1 quest_date × 1 quest_type = 1 行 (lazy gen 冪等性) */
    uniqLearnerDateType: uniqueIndex(
      "daily_quests_learner_date_type_idx",
    ).on(t.learnerId, t.questDate, t.questType),
    /** 「今日のクエスト一覧」取得用 */
    learnerDateIdx: index("daily_quests_learner_date_idx").on(
      t.learnerId,
      t.questDate,
    ),
  }),
);

// ---------------------------------------------------------------------------
// study_sessions (W10-T5 / 過学習防止)
//
// 1 行 = 「ある学習者が 1 回 /study/[level]/[skill] を開いてから閉じるまでの単位」.
// W10-T4 の URL session UUID (= clientSessionId) と 1:1 対応する.
//
// 用途:
//   - 「今日 X 分学習」可視化 (保護者ダッシュボード / 学習画面の上部表示).
//   - 30 分 / 60 分の overlearning 閾値判定 (DB レイヤを真のソース化 / reload 越え対応).
//   - 親が「今日のがんばり」を見るための一次資料 (DEC-024 罰則ゼロ哲学整合: 表示は祝福のみ).
//
// 不変条件:
//   - cumulative_seconds >= 0
//   - ended_at IS NULL = アクティブ / NOT NULL = 終了済
//   - end_reason は 'natural' / 'abort' / 'overtime' / 'hard_limit' のいずれか (終了時のみ)
//   - session_date は JST 6:00 境界 (DEC-024 / quest 整合) の 'YYYY-MM-DD'
//   - (learner_id, client_session_id) は UNIQUE (= URL UUID 単位で 1 行のみ)
//
// 罰則ゼロ哲学:
//   - hard_limit (60 分) 終了時も「ごほうび: ハネキン X 枚 / きょうは おつかれさま」と祝福.
//   - streak はこのテーブルからは減算しない (streak は answer_logs から日次で再計算).
// ---------------------------------------------------------------------------
export const studySessions = sqliteTable(
  "study_sessions",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    /** JST 6:00 境界の 'YYYY-MM-DD' (= 「今日」のキー / sum 集計の検索キー) */
    sessionDate: text("session_date").notNull(),
    /** /study URL に乗る session UUID (= W10-T4 で発行された値). 同じ URL を再訪したら同じ行に集約. */
    clientSessionId: text("client_session_id").notNull(),
    /** 5 / 7 / 10 (NULL = session-mode 外で開いたケース / Phase 1 直リンク) */
    durationMinutes: integer("duration_minutes"),
    /** セッション開始時刻 (= 行 INSERT 瞬間). server time を使用. */
    startedAt: integer("started_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** セッション終了時刻 (NULL = 進行中). endStudySession で UPDATE. */
    endedAt: integer("ended_at", { mode: "timestamp" }),
    /** 当該セッションの累計学習秒数 (heartbeat で += clamped delta). */
    cumulativeSeconds: integer("cumulative_seconds").notNull().default(0),
    /** 終了理由 (NULL = 進行中). */
    endReason: text("end_reason", {
      enum: ["natural", "abort", "overtime", "hard_limit"],
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    /** (学習者, URL session UUID) で 1 行 = startOrResumeStudySession の冪等性担保 */
    uniqLearnerClientSession: uniqueIndex(
      "study_sessions_learner_client_session_idx",
    ).on(t.learnerId, t.clientSessionId),
    /** 「今日の累計」 SUM 集計用インデックス */
    learnerDateIdx: index("study_sessions_learner_date_idx").on(
      t.learnerId,
      t.sessionDate,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 32. beta_invite_codes (W12-T3-A / DEC-069 / β 招待コード)
//
// β リリース期間中の signup ゲーティング用の招待コード.
//
// 設計思想 (DEC-069):
//   - 1 行 = 1 招待コード. `code` UNIQUE. 8 文字大文字英数 (`0/O/1/I/L` 除外).
//   - `maxRedemptions` >= 1 / `redemptionCount` 0..maxRedemptions.
//   - `disabledAt`/`expiresAt` は nullable で構造的に「無期限 / 有効」を表現.
//   - 個人特定可能要素 0 (DEC-003 第三層: SQL aggregate 不要 / SELECT で隠蔽不要).
//   - admin UI 不要 (β 期間は scripts/generate-beta-invite.ts で運営者手動発行).
//
// 三層認可 (DEC-003):
//   - 第一層: signup ページは middleware 認可不要 (公開 form / invite check は
//     server action 内で完結).
//   - 第二層: signup action 内で SELECT + race-safe atomic UPDATE.
//   - 第三層: テーブル設計時点で個人特定要素 0 = 構造排除.
//
// idempotency (DEC-055):
//   - signup action 内 transaction で
//       UPDATE ... SET redemption_count = redemption_count + 1
//        WHERE id = ? AND redemption_count < max_redemptions
//     の atomic 増加で race 条件下でも上限超過 0 を SQL レベルで担保.
// ---------------------------------------------------------------------------
export const betaInviteCodes = sqliteTable(
  "beta_invite_codes",
  {
    id: text("id").primaryKey(),
    /**
     * 招待コード本体 (8 文字 / 大文字英数 / `0/O/1/I/L` 除外).
     * normalizeInviteCode (trim + uppercase + 内部空白除去) 後の値で保存.
     */
    code: text("code").notNull(),
    /** 運営者識別子 (任意 / 「ceo」「dev」等のフリーテキスト) */
    createdBy: text("created_by"),
    /** 発行メモ (任意 / 「2026-05 早期 β 配布」等) */
    note: text("note"),
    /** 同コードを redeem 可能な最大回数 (1 = 個人用 / >1 = 共有用) */
    maxRedemptions: integer("max_redemptions").notNull().default(1),
    /** 既に redeem された回数 (atomic +1 で更新 / 0..maxRedemptions) */
    redemptionCount: integer("redemption_count").notNull().default(0),
    /** 期限 (nullable / null = 無期限) */
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    /** 無効化日時 (nullable / null = 有効) */
    disabledAt: integer("disabled_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    codeIdx: uniqueIndex("beta_invite_codes_code_idx").on(t.code),
    /** 「有効コード」検索高速化 (disabled / expired を構造的に弾く) */
    activeIdx: index("beta_invite_codes_active_idx").on(
      t.disabledAt,
      t.expiresAt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 33. learner_settings (W12-T1 / Phase 3 第 1 波 / M-1 / DEC-073 / DEC-074)
//
// 1 学習者 1 行 (learner_id UNIQUE).
//
// 親が parent settings (/parent/settings/notifications) から編集する通知 / リマインド系設定.
// 既存 learner_profiles.preferences (JSON) は PWA 内動作 preferences として残し, 本テーブルは
// 「親が制御する settings」として分離管理する.
//
// フィールド:
//   - notifications_enabled: メール / push 通知の総合 ON/OFF (default true)
//   - daily_reminder_time:   1 日 1 回のリマインド時刻 'HH:MM' (NULL = 無効)
//   - sound_enabled:         効果音 ON/OFF (default true) — 学習画面の audio-feedback と連動可
//   - display_name_override: 学習者本人が自分の表示名を変えたい場合の override (任意)
//
// 三層認可 (DEC-003):
//   - 第二層: 親 settings page で requireAuth + requireParent + requireLearnerOwner.
//   - 第三層: learner_id 経由で family_id 間接 scope.
//
// 罰則ゼロ哲学 (DEC-024): 通知 OFF でも罰メッセージは出さない.
// 冪等性 (DEC-055): learner_id UNIQUE で upsert 結果が同一入力で同一.
// ---------------------------------------------------------------------------
export const learnerSettings = sqliteTable(
  "learner_settings",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learnerProfiles.id, { onDelete: "cascade" }),
    notificationsEnabled: integer("notifications_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    /** 'HH:MM' (24h) / NULL = リマインド無効 */
    dailyReminderTime: text("daily_reminder_time"),
    soundEnabled: integer("sound_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    /** 学習者本人が表示名を変えたい場合の override (任意) */
    displayNameOverride: text("display_name_override"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    uniqLearner: uniqueIndex("learner_settings_learner_idx").on(t.learnerId),
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

// W10-T1 / ハネキン (はね金) 経済
export type CoinTransaction = typeof coinTransactions.$inferSelect;
export type NewCoinTransaction = typeof coinTransactions.$inferInsert;

// W10-T2 / Shop 在庫
export type LearnerInventory = typeof learnerInventory.$inferSelect;
export type NewLearnerInventory = typeof learnerInventory.$inferInsert;

// W10-T3 / Daily Quests
export type DailyQuest = typeof dailyQuests.$inferSelect;
export type NewDailyQuest = typeof dailyQuests.$inferInsert;

// W10-T5 / Study Sessions (過学習防止)
export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;

// W12-T3-A / β invite codes (DEC-069)
export type BetaInviteCode = typeof betaInviteCodes.$inferSelect;
export type NewBetaInviteCode = typeof betaInviteCodes.$inferInsert;

// W12-T1 / Phase 3 第 1 波 / learner_settings (DEC-073 / DEC-074 / M-1)
export type LearnerSettings = typeof learnerSettings.$inferSelect;
export type NewLearnerSettings = typeof learnerSettings.$inferInsert;
