/**
 * HANEI - Family Weekly Digest Summary Pure Helper (W11-T5 / 保護者ダッシュボード Card 版 Weekly Digest)
 *
 * Phase 2 W11-T5 (DEC-063): 保護者ダッシュボードに「今週の ハイライト」Card を出すため、
 * view-model 構築を純関数化する.
 *
 * 不変条件 (Turbopack 制約):
 *   - 純関数のみ / DB I/O ゼロ / "use server" 一切なし.
 *   - server-only モジュール (family-weekly-digest.ts) からのみ import.
 *   - W11-T1 / W11-T3 / W11-T2 で確立した「純関数を server-only ファイル外に隔離」パターンの 5 度目再適用.
 *
 * 設計指針 (DEC-024 罰則ゼロ哲学 / DEC-063):
 *   - 励ましコピーは pre-curated catalog 8 件のみ. 罰語は構造的に発生し得ない (catalog に存在しない).
 *   - selection は `weekStartUtc` (= ISO week-of-year) + `familyId` から deterministic seed で決まる純関数.
 *   - 同一週・同一家族で同じコピーを安定に返す (= 親が複数回 dashboard を開いても同じメッセージ).
 *   - 全員 0 XP / streak 0 日 / 解答 0 問でも前向きコピーで完結する (UI 側で罰メッセージを出さない).
 */

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** 単元別解答数 (top skills 集計の入力 row) */
export interface DigestSkillRow {
  skillId: string;
  displayName: string;
  answerCount: number;
}

/** 各 learner の今週 XP (leaderboard 並び順を尊重) */
export interface DigestLearnerXp {
  learnerId: string;
  nickname: string;
  weeklyXp: number;
}

/** 家族 weekly digest の view-model 入力 */
export interface FamilyWeeklyDigestInput {
  familyId: string;
  /** JST 6:00 境界の週開始 UTC (= 7 日 window cutoff の起点) */
  weekStartUtc: Date;
  /** family-streak の今週まで days */
  familyStreakDays: number;
  /** family-streak が「生きている」 (= 今日 or 昨日 active) か */
  familyStreakAlive: boolean;
  /** leaderboard rank 順を尊重した learner ごとの今週 XP */
  perLearnerWeeklyXp: ReadonlyArray<DigestLearnerXp>;
  /** 家族全体の直近 7 日トップ skill (新規 SQL 集計結果. limit 5 程度のバッファを期待) */
  topSkills: ReadonlyArray<DigestSkillRow>;
}

/** 完成した weekly digest view-model */
export interface FamilyWeeklyDigestView {
  familyStreakDays: number;
  familyStreakAlive: boolean;
  /** 家族 streak 集約コピー (前向きのみ / 罰語ゼロ) */
  familyStreakHeadline: string;
  /** leaderboard rank 順を尊重した learner ごとの今週 XP (そのまま伝搬) */
  perLearnerXp: ReadonlyArray<DigestLearnerXp>;
  /** 上位 3 単元 (同数タイは skillId 昇順安定 / 0 件は空配列) */
  topSkills: ReadonlyArray<DigestSkillRow>;
  /** deterministic に選ばれた今週の励ましコピー */
  encouragement: { key: string; copy: string };
}

// ---------------------------------------------------------------------------
// 励ましコピー catalog (pre-curated / 罰語ゼロ)
//
// NG 語 (catalog に絶対含めない):
//   「最下位」「ペナルティ」「サボ」「だめ」「がんばってない」「やりすぎ」
//   「もう おそい」「もうダメ」「失敗」
//
// 全件:
//   - 平仮名中心
//   - 命令形ではなく共有・ねぎらい tone
//   - 子ども本人ではなく「家族」「来週」「学び」など中立対象に向ける
//   - 200 char 以内 (UI 表示の安全域)
// ---------------------------------------------------------------------------

export const ENCOURAGEMENT_COPIES: ReadonlyArray<{ key: string; copy: string }> =
  [
    {
      key: "next_week_together",
      copy: "来週も みんなで がんばろうね",
    },
    {
      key: "small_steps",
      copy: "みんなが ちょっとずつ つみあげていけば、すごい 力になるよ",
    },
    {
      key: "family_continues",
      copy: "家族みんなで まなびつづけてるね",
    },
    {
      key: "be_kind",
      copy: "来週も やさしく いこう",
    },
    {
      key: "future_self",
      copy: "ふだんの 1 問が、未来の あなたを つくります",
    },
    {
      key: "without_pressure",
      copy: "無理せず つづけていきましょう",
    },
    {
      key: "support_matters",
      copy: "家族の おうえんが 何より 大きな 力です",
    },
    {
      key: "looking_forward",
      copy: "来週は どんな 単元に であえるか たのしみだね",
    },
  ];

// ---------------------------------------------------------------------------
// selectTopSkills: 同数タイ skillId 昇順安定 / 0 件は空 / limit default 3
// ---------------------------------------------------------------------------

/**
 * answerCount 降順 + 同数タイは skillId 昇順で安定ソートして上位 N 件を返す純関数.
 *
 * 仕様:
 *   - limit default = 3 (UI 表示の Top 3 単元)
 *   - 入力が配列でない場合は TypeError throw (防御).
 *   - 0 件入力は空配列を返す.
 *   - answerCount 0 件 / 負値も「除外せず受容」 (純関数は防御正規化しない / 防御は SQL 側で済).
 */
export function selectTopSkills(
  rows: ReadonlyArray<DigestSkillRow>,
  limit?: number,
): Array<DigestSkillRow> {
  if (!Array.isArray(rows)) {
    throw new TypeError(
      "[family-weekly-digest-summary] rows must be an array",
    );
  }
  const cap =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : 3;
  const sorted = [...rows].sort((a, b) => {
    if (b.answerCount !== a.answerCount) return b.answerCount - a.answerCount;
    return a.skillId.localeCompare(b.skillId);
  });
  return sorted.slice(0, cap);
}

// ---------------------------------------------------------------------------
// pickEncouragementCopy: deterministic seed (week-of-year + familyId codePoint sum)
// ---------------------------------------------------------------------------

/**
 * ISO 週番号 (1〜53) を JST 6:00 境界の週開始 UTC Date から計算する純関数.
 *
 * - ISO 8601: 月曜始まり / 1 月 4 日を含む週 = 第 1 週.
 * - 罰語との関連はない. 単に「同一週で安定」させるための seed 因子.
 */
function isoWeekOfYear(weekStartUtc: Date): number {
  // UTC で日付部分のみを取り出して計算 (家族間の挙動を locale 依存にしない)
  const d = new Date(
    Date.UTC(
      weekStartUtc.getUTCFullYear(),
      weekStartUtc.getUTCMonth(),
      weekStartUtc.getUTCDate(),
    ),
  );
  // 木曜起点で「その週」を確定 (ISO 8601 仕様)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart) / 86400000 + 1) / 7,
  );
  return weekNum;
}

/**
 * familyId 文字列の codePoint 総和 (純関数 seed の安定因子).
 */
function familyIdSeed(familyId: string): number {
  let sum = 0;
  for (let i = 0; i < familyId.length; i += 1) {
    sum = (sum + (familyId.codePointAt(i) ?? 0)) | 0;
  }
  return Math.abs(sum);
}

/**
 * 同一週・同一家族で安定して同じコピーを返す決定論的 selector.
 *
 * - seed = isoWeekOfYear(weekStartUtc) + familyIdSeed(familyId)
 * - index = seed mod ENCOURAGEMENT_COPIES.length (= 8)
 *
 * 返り値: catalog 内の 1 件 (key + copy).
 */
export function pickEncouragementCopy(
  weekStartUtc: Date,
  familyId: string,
): { key: string; copy: string } {
  if (!(weekStartUtc instanceof Date) || Number.isNaN(weekStartUtc.getTime())) {
    throw new TypeError(
      "[family-weekly-digest-summary] weekStartUtc must be a valid Date",
    );
  }
  if (typeof familyId !== "string") {
    throw new TypeError(
      "[family-weekly-digest-summary] familyId must be a string",
    );
  }
  const week = isoWeekOfYear(weekStartUtc);
  const seed = (week + familyIdSeed(familyId)) | 0;
  const idx = ((seed % ENCOURAGEMENT_COPIES.length) + ENCOURAGEMENT_COPIES.length) %
    ENCOURAGEMENT_COPIES.length;
  // catalog は 8 件 ≥ 1 件で固定なので idx は必ず 0..7 の範囲、安全に index access.
  const picked = ENCOURAGEMENT_COPIES[idx];
  if (!picked) {
    // 構造的に到達不能だが TS の noUncheckedIndexedAccess 互換のため fallback
    return ENCOURAGEMENT_COPIES[0]!;
  }
  return picked;
}

// ---------------------------------------------------------------------------
// describeFamilyStreakSummary: 家族 streak 集約コピー (前向きのみ)
// ---------------------------------------------------------------------------

/**
 * 家族 streak 状態から前向き集約コピーを生成する純関数.
 *
 * ルール (DEC-024 罰則ゼロ厳守):
 *   - days <= 0                        → 「今週の つみあげを 始めよう」
 *   - days >= 1 + alive=true           → 「家族で {days} 日 つながってるね」
 *   - days >= 1 + alive=false          → 「{days} 日 つながった あと、ひとやすみ。またいつでも 始められるよ」
 */
export function describeFamilyStreakSummary(
  days: number,
  alive: boolean,
): string {
  const safeDays =
    Number.isFinite(days) && (days as number) > 0
      ? Math.floor(days as number)
      : 0;
  if (safeDays === 0) {
    return "今週の つみあげを 始めよう";
  }
  if (alive) {
    return `家族で ${safeDays} 日 つながってるね`;
  }
  return `${safeDays} 日 つながった あと、ひとやすみ。またいつでも 始められるよ`;
}

// ---------------------------------------------------------------------------
// composeWeeklyDigestView: view-model 全体の組み立て (pure compose)
// ---------------------------------------------------------------------------

/**
 * 家族 weekly digest view-model を 1 関数で組み立てる pure compose 関数.
 *
 * 入力 ↔ 出力の対応:
 *   - input.perLearnerWeeklyXp        → そのまま伝搬 (leaderboard rank 順を尊重)
 *   - input.topSkills (≤ 5 想定)       → selectTopSkills(_, 3) で 3 件まで絞る
 *   - input.familyStreakDays / Alive   → describeFamilyStreakSummary でコピー化
 *   - input.weekStartUtc + familyId    → pickEncouragementCopy で励ましコピーを deterministic 選択
 */
export function composeWeeklyDigestView(
  input: FamilyWeeklyDigestInput,
): FamilyWeeklyDigestView {
  if (!input || typeof input !== "object") {
    throw new TypeError(
      "[family-weekly-digest-summary] input must be an object",
    );
  }
  const topSkills = selectTopSkills(input.topSkills ?? [], 3);
  const encouragement = pickEncouragementCopy(
    input.weekStartUtc,
    input.familyId,
  );
  const familyStreakHeadline = describeFamilyStreakSummary(
    input.familyStreakDays,
    Boolean(input.familyStreakAlive),
  );
  return {
    familyStreakDays: Math.max(
      0,
      Number.isFinite(input.familyStreakDays)
        ? Math.floor(input.familyStreakDays as number)
        : 0,
    ),
    familyStreakAlive: Boolean(input.familyStreakAlive),
    familyStreakHeadline,
    perLearnerXp: input.perLearnerWeeklyXp ?? [],
    topSkills,
    encouragement,
  };
}
