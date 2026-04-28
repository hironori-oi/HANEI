/**
 * HANEI - Streak Freeze ロジック (W8-T1)
 *
 * 「Streak が途切れそうな時に freezeTickets を 1 枚消費して連続日数を守る」救済機構。
 * Duolingo の Free 層 streak freeze 装備上限 1->2 で DAU +0.38% を参考に、
 * 子供向け HANEI では救済を厚くする (上限 2 枚 / 月初自動付与 / 受験 30 日前ボーナス)。
 *
 * 全関数は Drizzle / DB 非依存の純関数で、cron と submitAnswer 両方から再利用される。
 *
 * 関連:
 *  - src/lib/db/schema.ts: streaks.freezeTickets / streaks.lastActiveDate
 *  - src/app/api/cron/streak-freeze-monthly/route.ts: 毎日 15:00 UTC 実行
 *  - src/lib/study/streak.ts: streak 維持判定ヘルパー
 *
 * 設計原則:
 *  - 罰演出はしない
 *  - 自動消費 (UI 上は事後通知) で子供にストレスを与えない
 *  - 上限 2 枚で「貯まりすぎ -> 安心しすぎ -> 学習離脱」を防ぐ
 */

export const FREEZE_MAX_TICKETS = 2;
export const FREEZE_EXAM_BONUS_DAYS_UNTIL = 30;

/** "YYYY-MM-DD" を Date (00:00 ローカル想定) に変換 */
function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

/** Date を "YYYY-MM-DD" にフォーマット (ローカル日付) */
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 2 つの ISO 日付の差 (toIso - fromIso) 日数を返す。同日 = 0、過去 -> 翌日 = 1。
 */
export function diffDays(fromIso: string, toIso: string): number {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * 月初判定: 渡された Date が「月の 1 日」かどうか。
 *
 * cron は毎日 15:00 UTC = 翌日 00:00 JST に発火するため、
 * cron 内では JST 換算した Date を渡す。
 */
export function isFirstDayOfMonthJst(now: Date): boolean {
  return now.getDate() === 1;
}

/**
 * 受験日 30 日前ボーナス判定: 受験日まで「ちょうど 30 日」かどうか。
 */
export function isExamDateBonusDay(
  todayIso: string,
  examDateIso: string | null,
): boolean {
  if (!examDateIso) return false;
  const days = diffDays(todayIso, examDateIso);
  return days === FREEZE_EXAM_BONUS_DAYS_UNTIL;
}

/**
 * freeze ticket を 1 枚追加 (上限 FREEZE_MAX_TICKETS)。既に上限なら据え置き。
 */
export function grantFreezeTicket(
  current: number,
): { newCount: number; granted: boolean } {
  if (current >= FREEZE_MAX_TICKETS) {
    return { newCount: FREEZE_MAX_TICKETS, granted: false };
  }
  return { newCount: current + 1, granted: true };
}

export interface StreakFreezeInput {
  lastActiveDate: string | null;
  todayIso: string;
  currentStreak: number;
  freezeTickets: number;
}

export interface StreakFreezeResult {
  /** 判定後の streak 値 */
  newStreak: number;
  /** 判定後の freezeTickets 値 */
  newFreezeTickets: number;
  /** freeze を 1 枚消費したか */
  consumed: boolean;
  /** streak が完全に途切れたか */
  broken: boolean;
  /** 学習者の状態に変化が無かった */
  noChange: boolean;
}

/**
 * 「今日 streak が切れそうか」を判定し、freeze で救済できるなら消費する。
 *
 * 判定:
 *  - lastActiveDate === null: 初学習者 -> 何もしない
 *  - diff <= 0 (同日 / 未来): 既に学習済 -> 何もしない
 *  - diff === 1 (昨日学習): streak 維持中 -> 何もしない
 *  - diff === 2 (一昨日まで学習): 1 日サボった -> freeze で 1 枚消費して救済
 *  - diff > 2: 2 日以上サボった -> streak リセット (freeze は救済不可)
 */
export function applyStreakFreeze(
  input: StreakFreezeInput,
): StreakFreezeResult {
  const { lastActiveDate, todayIso, currentStreak, freezeTickets } = input;

  if (!lastActiveDate) {
    return {
      newStreak: currentStreak,
      newFreezeTickets: freezeTickets,
      consumed: false,
      broken: false,
      noChange: true,
    };
  }

  const diff = diffDays(lastActiveDate, todayIso);

  if (diff <= 0) {
    return {
      newStreak: currentStreak,
      newFreezeTickets: freezeTickets,
      consumed: false,
      broken: false,
      noChange: true,
    };
  }

  if (diff === 1) {
    return {
      newStreak: currentStreak,
      newFreezeTickets: freezeTickets,
      consumed: false,
      broken: false,
      noChange: true,
    };
  }

  if (diff === 2) {
    if (freezeTickets > 0) {
      return {
        newStreak: currentStreak,
        newFreezeTickets: freezeTickets - 1,
        consumed: true,
        broken: false,
        noChange: false,
      };
    }
    return {
      newStreak: 0,
      newFreezeTickets: freezeTickets,
      consumed: false,
      broken: true,
      noChange: false,
    };
  }

  return {
    newStreak: 0,
    newFreezeTickets: freezeTickets,
    consumed: false,
    broken: true,
    noChange: false,
  };
}
