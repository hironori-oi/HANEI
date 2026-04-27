/**
 * HANEI - Study Aggregations (W3 / T-2 + T-7)
 *
 * 保護者ダッシュボード向けの集計ユーティリティ。
 * 三層認可: 呼び出し前に requireParent + requireFamilyMember + requireLearnerOwner で
 *           learner_id が family_id 内であることを確認済みである前提。
 *
 * 関数は Drizzle の db を直接 inject 可能にし、unit テストで in-memory libSQL に
 * 差し替えられるようにしている (Vitest)。
 */

import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import {
  answerLogs,
  streaks,
  xpLevels,
  examDates,
  aiCoachMessages,
  aiCoachConversations,
  mockExamResults,
  problems,
  problemExplanations,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------
export interface WeeklySummary {
  /** 連続学習日数 */
  currentStreak: number;
  /** 直近 7 日間の解答数 */
  weeklyAnswers: number;
  /** 直近 7 日間の正答率 (0-1, 解答が無ければ null) */
  weeklyAccuracy: number | null;
  /** 累計 XP (前週末からの増加) */
  totalXp: number;
  weeklyXpDelta: number;
}

export interface RecentMistake {
  problemId: string;
  userAnswer: string;
  answeredAt: Date;
}

// ---------------------------------------------------------------------------
// 1. 連続学習日数
// ---------------------------------------------------------------------------
export async function getCurrentStreak(
  db: Db,
  learnerId: string,
): Promise<number> {
  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済 (呼び出し前 requireLearnerOwner)
  const rows = await db
    .select({ s: streaks.currentStreak })
    .from(streaks)
    .where(eq(streaks.learnerId, learnerId))
    .limit(1);
  return rows[0]?.s ?? 0;
}

// ---------------------------------------------------------------------------
// 2. 直近 N 日の解答数 / 正答率
// ---------------------------------------------------------------------------
export async function getWeeklyAnswers(
  db: Db,
  learnerId: string,
  days = 7,
  now = new Date(),
): Promise<{ count: number; correct: number }> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const sinceUnix = Math.floor(since.getTime() / 1000);

  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済
  const rows = await db
    .select({
      count: sql<number>`COUNT(*)`,
      correct: sql<number>`COALESCE(SUM(CASE WHEN ${answerLogs.isCorrect} THEN 1 ELSE 0 END), 0)`,
    })
    .from(answerLogs)
    .where(
      and(
        eq(answerLogs.learnerId, learnerId),
        sql`${answerLogs.answeredAt} >= ${sinceUnix}`,
      ),
    );

  const r = rows[0];
  return {
    count: Number(r?.count ?? 0),
    correct: Number(r?.correct ?? 0),
  };
}

export function computeAccuracy(count: number, correct: number): number | null {
  if (count <= 0) return null;
  return Number((correct / count).toFixed(4));
}

// ---------------------------------------------------------------------------
// 3. XP (累計 + 直近 7 日の増加)
// ---------------------------------------------------------------------------
export async function getXpSummary(
  db: Db,
  learnerId: string,
  days = 7,
  now = new Date(),
): Promise<{ totalXp: number; weeklyXpDelta: number }> {
  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済
  const xpRows = await db
    .select({ total: xpLevels.totalXp })
    .from(xpLevels)
    .where(eq(xpLevels.learnerId, learnerId))
    .limit(1);
  const totalXp = xpRows[0]?.total ?? 0;

  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const sinceUnix = Math.floor(since.getTime() / 1000);
  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済
  const deltaRows = await db
    .select({
      delta: sql<number>`COALESCE(
        SUM(CASE WHEN ${answerLogs.isCorrect} THEN 10 ELSE 1 END), 0)`,
    })
    .from(answerLogs)
    .where(
      and(
        eq(answerLogs.learnerId, learnerId),
        sql`${answerLogs.answeredAt} >= ${sinceUnix}`,
      ),
    );
  return {
    totalXp,
    weeklyXpDelta: Number(deltaRows[0]?.delta ?? 0),
  };
}

// ---------------------------------------------------------------------------
// 4. 受験日カウントダウン
// ---------------------------------------------------------------------------
export async function getNearestExamCountdown(
  db: Db,
  learnerId: string,
  now = new Date(),
): Promise<{ examDate: string; daysUntil: number; level: "5" | "4" | "3" } | null> {
  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済
  const rows = await db
    .select()
    .from(examDates)
    .where(eq(examDates.learnerId, learnerId));

  // ISO YYYY-MM-DD 文字列で「未来日かつ最も近い」を選ぶ
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const future = rows
    .map((r) => {
      const d = new Date(`${r.examDate}T00:00:00`);
      const diffMs = d.getTime() - today.getTime();
      const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      return { ...r, days };
    })
    .filter((r) => r.days >= 0)
    .sort((a, b) => a.days - b.days);

  const pick = future[0];
  if (!pick) return null;
  return {
    examDate: pick.examDate,
    daysUntil: pick.days,
    level: pick.level,
  };
}

// ---------------------------------------------------------------------------
// 5. 直近の誤答 TOP N (ai_coach_messages では誤答メッセージを cross-ref で取れないため、
//    answer_logs の isCorrect=false を時系列で取り、user_answer + problem_id を返す)
//
// 仕様書では「ai_coach_messages から最近の誤答を取得」とあるが、誤答そのものは
// answer_logs 側にしか時系列情報が無い。AI コーチ側のメッセージは「誤答後の補助会話」で
// あるため、Phase 1 では answer_logs 起点で正答率の低い問題を取り、必要なら
// ai_coach_messages の最新 1 件を併せて表示する。
// ---------------------------------------------------------------------------
export async function getRecentMistakes(
  db: Db,
  learnerId: string,
  limit = 5,
): Promise<RecentMistake[]> {
  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済
  const rows = await db
    .select({
      problemId: answerLogs.problemId,
      userAnswer: answerLogs.userAnswer,
      answeredAt: answerLogs.answeredAt,
    })
    .from(answerLogs)
    .where(and(eq(answerLogs.learnerId, learnerId), eq(answerLogs.isCorrect, false)))
    .orderBy(desc(answerLogs.answeredAt))
    .limit(limit);
  return rows.map((r) => ({
    problemId: r.problemId,
    userAnswer: r.userAnswer,
    answeredAt: r.answeredAt instanceof Date ? r.answeredAt : new Date(r.answeredAt),
  }));
}

// ---------------------------------------------------------------------------
// 6. リマインドトリガー判定 (直近 N 日学習していなければ true)
// ---------------------------------------------------------------------------
export async function shouldSendInactivityReminder(
  db: Db,
  learnerId: string,
  inactiveDays = 7,
  now = new Date(),
): Promise<{ shouldSend: boolean; daysSinceLastActive: number | null }> {
  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済
  const rows = await db
    .select({ last: sql<number>`MAX(${answerLogs.answeredAt})` })
    .from(answerLogs)
    .where(eq(answerLogs.learnerId, learnerId));

  const lastUnix = rows[0]?.last ?? null;
  if (!lastUnix) {
    // 一度も学習していない場合は initial onboarding 後 7 日経っても 0 解答 = リマインド対象
    return { shouldSend: true, daysSinceLastActive: null };
  }
  const lastDate = new Date(Number(lastUnix) * 1000);
  const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
  return {
    shouldSend: diffDays >= inactiveDays,
    daysSinceLastActive: diffDays,
  };
}

// ---------------------------------------------------------------------------
// 7. 全集計を 1 関数で
// ---------------------------------------------------------------------------
export async function getWeeklySummary(
  db: Db,
  learnerId: string,
  now = new Date(),
): Promise<WeeklySummary> {
  const [streak, weekly, xp] = await Promise.all([
    getCurrentStreak(db, learnerId),
    getWeeklyAnswers(db, learnerId, 7, now),
    getXpSummary(db, learnerId, 7, now),
  ]);
  return {
    currentStreak: streak,
    weeklyAnswers: weekly.count,
    weeklyAccuracy: computeAccuracy(weekly.count, weekly.correct),
    totalXp: xp.totalXp,
    weeklyXpDelta: xp.weeklyXpDelta,
  };
}

// ---------------------------------------------------------------------------
// 8. 模試結果 (mock_exam_results) 関連
// ---------------------------------------------------------------------------

/** 4 技能スコアの内訳 (W4 / T-1: レーダーチャート用) */
export interface SkillScores {
  /** 0-1 正規化済み (0 が最低 / 1 が満点) */
  vocab: number;
  grammar: number;
  reading: number;
  listening: number;
}

export interface MockExamRow {
  id: string;
  level: "5" | "4" | "3";
  examDate: Date;
  score: number;
  maxScore: number;
  passFlag: boolean;
  skills: SkillScores;
}

/**
 * 過去模試一覧を直近 N 件、日付降順で返す。
 * 合格判定は「score / maxScore >= 0.7」を Phase 1 暫定値とする。
 * (英検公式の合格ライン level 別: 5 級 ≒ 60% / 4 級 ≒ 65% / 3 級 ≒ 70% を上限合わせ)
 */
export async function getMockExamResults(
  db: Db,
  learnerId: string,
  limit = 10,
): Promise<MockExamRow[]> {
  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済 (呼び出し前 requireLearnerOwner)
  const rows = await db
    .select({
      id: mockExamResults.id,
      level: mockExamResults.level,
      score: mockExamResults.score,
      maxScore: mockExamResults.maxScore,
      vocab: mockExamResults.vocabCorrect,
      grammar: mockExamResults.grammarCorrect,
      listening: mockExamResults.listeningCorrect,
      writing: mockExamResults.writingScore,
      takenAt: mockExamResults.takenAt,
    })
    .from(mockExamResults)
    .where(eq(mockExamResults.learnerId, learnerId))
    .orderBy(desc(mockExamResults.takenAt))
    .limit(limit);

  return rows.map((r) => {
    const examDate = r.takenAt instanceof Date ? r.takenAt : new Date(r.takenAt);
    const ratio = r.maxScore > 0 ? r.score / r.maxScore : 0;
    const passThreshold = passThresholdForLevel(r.level);
    // 4 技能を 0-1 にリスケール (1 技能あたり最大点 = vocab/grammar/listening は maxScore/4 想定 / writing は writingScore 直接の上限を maxScore/4 換算)
    const perSkillMax = Math.max(1, Math.floor(r.maxScore / 4));
    return {
      id: r.id,
      level: r.level,
      examDate,
      score: r.score,
      maxScore: r.maxScore,
      passFlag: ratio >= passThreshold,
      skills: {
        vocab: clamp01(r.vocab / perSkillMax),
        grammar: clamp01(r.grammar / perSkillMax),
        // writing は「読解」は直接保存していないため writing スコアを reading 軸に採用
        // (W2 schema に reading_correct カラムが無いため、writingScore を「読解+作文」枠として扱う Phase 1 暫定)
        reading: clamp01(r.writing / perSkillMax),
        listening: clamp01(r.listening / perSkillMax),
      },
    };
  });
}

/** 合格ライン (英検公式 2016 リニューアル後の technical reading) */
function passThresholdForLevel(level: "5" | "4" | "3"): number {
  switch (level) {
    case "5":
      return 0.6;
    case "4":
      return 0.65;
    case "3":
      return 0.7;
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return Number(v.toFixed(4));
}

/**
 * 弱点 TOP N を「過去 N 回の平均スコアが低い 4 技能」から抽出。
 * (W4 / T-1: AI コーチ提案に紐付ける弱点ハイライト)
 */
export interface WeakSkill {
  skill: keyof SkillScores;
  /** 平均スコア 0-1 */
  averageScore: number;
  /** 何回分の平均か */
  sampleSize: number;
}

export function computeWeakestSkills(
  rows: ReadonlyArray<Pick<MockExamRow, "skills">>,
  topN = 3,
): WeakSkill[] {
  if (rows.length === 0) return [];
  const skillKeys: Array<keyof SkillScores> = [
    "vocab",
    "grammar",
    "reading",
    "listening",
  ];
  const sums: Record<keyof SkillScores, number> = {
    vocab: 0,
    grammar: 0,
    reading: 0,
    listening: 0,
  };
  for (const r of rows) {
    for (const k of skillKeys) {
      sums[k] += r.skills[k];
    }
  }
  const ranked: WeakSkill[] = skillKeys
    .map((k) => ({
      skill: k,
      averageScore: Number((sums[k] / rows.length).toFixed(4)),
      sampleSize: rows.length,
    }))
    .sort((a, b) => a.averageScore - b.averageScore);
  return ranked.slice(0, topN);
}

/**
 * AI コーチ提案テンプレ (gpt-5-mini を呼ばずに固定テンプレ + 弱点パラメータで構築)。
 * 「弱点に応じた学習プラン提案」を保護者向け敬語で返す。
 */
export function buildCoachSuggestionForWeakSkills(
  weak: ReadonlyArray<WeakSkill>,
): string {
  if (weak.length === 0) {
    return "まだ模試結果が登録されていません。1回受験すると AI コーチが弱点分析を行います。";
  }
  const labelMap: Record<keyof SkillScores, string> = {
    vocab: "語彙",
    grammar: "文法",
    reading: "読解",
    listening: "リスニング",
  };
  const tipMap: Record<keyof SkillScores, string> = {
    vocab: "毎日 10 語ずつ「単語カード」モードで反復し、SRS で苦手単語を優先しましょう。",
    grammar: "「文法ドリル」を 1 日 5 問、誤答時は AI コーチの解説を必ず読み返しましょう。",
    reading: "1 日 1 つ短文読解に取り組み、AI コーチに要約を聞いてみるのが効果的です。",
    listening: "TTS 音声で同じ問題を 3 回連続でシャドーイングする習慣をおすすめします。",
  };
  const top = weak[0];
  if (!top) {
    return "弱点はまだ特定されていません。まずは受験を続けてみましょう。";
  }
  const head = `直近の弱点は「${labelMap[top.skill]}」です（平均スコア ${(top.averageScore * 100).toFixed(0)}%、過去${top.sampleSize}回平均）。`;
  const tips = weak
    .map((w) => `・${labelMap[w.skill]}: ${tipMap[w.skill]}`)
    .join("\n");
  return `${head}\n\n【AI コーチからの学習プラン提案】\n${tips}`;
}

// ---------------------------------------------------------------------------
// 9. (W5 / G-1) home 画面: その日のスキル別解答数
// ---------------------------------------------------------------------------

/**
 * その日 (ローカル日付 = JST 想定) の解答数を skill 別に集計する。
 * skill 判定は `problems.skillId` (`vocabulary-5` / `grammar-5` / `listening-5`
 * / `reading-5` / `writing-3` 等) のサフィックス前を skill code として扱う。
 *
 * Phase 1 = 5 級単一学習者前提だが、levelId フィルタを付けて将来 4/3 級にも転用可能。
 */
export interface DailySkillCounts {
  vocabulary: number;
  grammar: number;
  listening: number;
  reading: number;
  writing: number;
}

export async function getDailySkillCounts(
  db: Db,
  learnerId: string,
  now = new Date(),
): Promise<DailySkillCounts> {
  // ローカル日 (JST 想定) の 00:00 unix
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const startUnix = Math.floor(startOfDay.getTime() / 1000);
  const endUnix = Math.floor(endOfDay.getTime() / 1000);

  // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済 (呼び出し前 requireLearnerOwner)
  const rows = await db
    .select({
      skillId: problems.skillId,
      cnt: sql<number>`COUNT(*)`,
    })
    .from(answerLogs)
    .innerJoin(problems, eq(problems.id, answerLogs.problemId))
    .where(
      and(
        eq(answerLogs.learnerId, learnerId),
        sql`${answerLogs.answeredAt} >= ${startUnix}`,
        sql`${answerLogs.answeredAt} < ${endUnix}`,
      ),
    )
    .groupBy(problems.skillId);

  const counts: DailySkillCounts = {
    vocabulary: 0,
    grammar: 0,
    listening: 0,
    reading: 0,
    writing: 0,
  };
  for (const r of rows) {
    const skill = parseSkillCode(r.skillId);
    if (!skill) continue;
    counts[skill] += Number(r.cnt ?? 0);
  }
  return counts;
}

/** skill_id ("vocabulary-5") から skill code ("vocabulary") を抽出。未知 prefix は null。 */
function parseSkillCode(skillId: string): keyof DailySkillCounts | null {
  const m = /^(vocabulary|grammar|listening|reading|writing)(?:-[0-9]+)?$/.exec(
    skillId,
  );
  if (!m) return null;
  return m[1] as keyof DailySkillCounts;
}

// ---------------------------------------------------------------------------
// 10. (W5 / G-3) home 画面: 級別マスタリ進捗 (4 スキル)
// ---------------------------------------------------------------------------

export interface SkillCoverage {
  skill: "vocabulary" | "grammar" | "reading" | "listening";
  /** マスター済み問題数 */
  mastered: number;
  /** 出題対象の問題数 (DEC-036 G-4 と整合: explanation 行 EXISTS) */
  total: number;
}

/**
 * 指定 level の 4 スキルについて「マスター済み / 出題対象」を集計。
 *
 * - total: `problems.levelId = levelId` かつ `problems.skillId = "<code>-<levelId>"`
 *   かつ `problem_explanations` 行 EXISTS (G-4 出題対象フィルタと整合)
 * - mastered: 上記 total に含まれる problemId のうち、当該 learner が
 *   `answer_logs.is_correct = true` を 1 回以上記録した distinct 問題数
 *
 * 「正解 1 回以上 = マスター」は Phase 1 暫定。SRS state≥2 への置き換えは W6 以降検討。
 */
export async function getMasteryCoverage(
  db: Db,
  learnerId: string,
  levelId: "5" | "4" | "3",
): Promise<SkillCoverage[]> {
  const skillCodes = ["vocabulary", "grammar", "reading", "listening"] as const;
  const result: SkillCoverage[] = [];

  for (const code of skillCodes) {
    const skillId = `${code}-${levelId}`;

    // total: 出題対象 (explanation 行 EXISTS)
    // eslint-disable-next-line no-restricted-syntax -- public マスタ参照 (level/skill 限定で家族横断ではない)
    const totalRows = await db
      .select({ cnt: sql<number>`COUNT(*)` })
      .from(problems)
      .where(
        and(
          eq(problems.levelId, levelId),
          eq(problems.skillId, skillId),
          sql`EXISTS (
            SELECT 1 FROM ${problemExplanations}
            WHERE ${problemExplanations.problemId} = ${problems.id}
          )`,
        ),
      );
    const total = Number(totalRows[0]?.cnt ?? 0);

    // mastered: 学習者が正解 1 回以上記録した distinct 問題数 (出題対象内に絞る)
    // eslint-disable-next-line no-restricted-syntax -- 学習者本人スコープ済 (呼び出し前 requireLearnerOwner)
    const masteredRows = await db
      .select({
        cnt: sql<number>`COUNT(DISTINCT ${answerLogs.problemId})`,
      })
      .from(answerLogs)
      .innerJoin(problems, eq(problems.id, answerLogs.problemId))
      .where(
        and(
          eq(answerLogs.learnerId, learnerId),
          eq(answerLogs.isCorrect, true),
          eq(problems.levelId, levelId),
          eq(problems.skillId, skillId),
          sql`EXISTS (
            SELECT 1 FROM ${problemExplanations}
            WHERE ${problemExplanations.problemId} = ${problems.id}
          )`,
        ),
      );
    const mastered = Number(masteredRows[0]?.cnt ?? 0);

    result.push({ skill: code, mastered, total });
  }
  return result;
}

// 未使用警告抑止 (gte / lte は将来集計に使用予定)
const _exports = { gte, lte, aiCoachMessages, aiCoachConversations };
void _exports;
