/**
 * HANEI - Weekly Digest Email Template (W6 / F-1)
 *
 * renderDigestHtml は純関数: 副作用なし、DB / fetch なし。
 * unit test (3 ケース以上) で snapshot 的に検証する。
 *
 * デザイン要件:
 *  - 絵文字 0
 *  - Amber Gold tone (BRAND_COLOR = #F2A93A) は src/lib/email/resend.ts と一致
 *  - HTML inline style のみ (メールクライアント互換)
 *  - 数値はゼロ詰めせず素直に表示
 *  - 4 スキル進捗: 「マスター済 N / 出題対象 M」をテキストで列挙
 */

import type { DailySkillCounts, SkillCoverage } from "@/lib/study/aggregations";

const BRAND_COLOR = "#F2A93A";

export interface DigestCountdown {
  examDate: string;
  daysUntil: number;
  level: "5" | "4" | "3";
}

export interface DigestData {
  learnerNickname: string;
  targetLevel: "5" | "4" | "3";
  /** 直近 7 日の解答数 */
  weeklyAnswers: number;
  /** 直近 7 日の正答数 */
  weeklyCorrect: number;
  /** 連続学習日数 */
  streak: number;
  /** 直近 7 日の XP 増分 */
  weeklyXpDelta: number;
  /** 累計 XP */
  totalXp: number;
  dailyCounts: DailySkillCounts;
  coverage: ReadonlyArray<SkillCoverage>;
  countdown: DigestCountdown | null;
  parentName: string;
}

/** 4 スキル日本語ラベル */
const SKILL_LABEL: Record<SkillCoverage["skill"], string> = {
  vocabulary: "語彙",
  grammar: "文法",
  reading: "読解",
  listening: "リスニング",
};

/**
 * 安全な HTML エスケープ。メール HTML 注入対策。
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 週次ダイジェスト本文を HTML 文字列で返す純関数。
 */
export function renderDigestHtml(data: DigestData): string {
  const accuracyPct =
    data.weeklyAnswers > 0
      ? Math.round((data.weeklyCorrect / data.weeklyAnswers) * 100)
      : null;

  const coverageRows = data.coverage
    .map((c) => {
      const label = SKILL_LABEL[c.skill];
      const pct = c.total > 0 ? Math.round((c.mastered / c.total) * 100) : 0;
      return `<li style="margin:4px 0;">${escapeHtml(label)}: ${c.mastered} / ${c.total} (${pct}%)</li>`;
    })
    .join("");

  const countdownLine = data.countdown
    ? `<p style="margin:8px 0;">受験日まで <strong>${data.countdown.daysUntil}</strong> 日 (英検${escapeHtml(
        data.countdown.level,
      )}級 / ${escapeHtml(data.countdown.examDate)})</p>`
    : `<p style="margin:8px 0; color:#666;">受験日が未登録です。保護者ダッシュボードから設定できます。</p>`;

  const accuracyLine =
    accuracyPct === null
      ? `<li>正答率: 今週は解答記録がまだありません</li>`
      : `<li>正答率: ${accuracyPct}% (${data.weeklyCorrect} / ${data.weeklyAnswers} 問)</li>`;

  const dailyTodayTotal =
    data.dailyCounts.vocabulary +
    data.dailyCounts.grammar +
    data.dailyCounts.listening +
    data.dailyCounts.reading +
    data.dailyCounts.writing;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="background: ${BRAND_COLOR}; color: #fff; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <strong style="font-size: 18px;">HANEI - 今週の学習レポート</strong>
      </div>
      <div style="border: 1px solid #eee; border-top: 0; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="margin:0 0 8px;">${escapeHtml(data.parentName)} さま</p>
        <p style="margin:0 0 16px;">${escapeHtml(data.learnerNickname)} さんの今週 (直近 7 日間) のがんばりをお届けします。</p>

        <h2 style="font-size:16px; margin:20px 0 8px; color:${BRAND_COLOR};">今週のサマリー</h2>
        <ul style="margin:0; padding-left:20px; line-height:1.7;">
          <li>解いた問題数: <strong>${data.weeklyAnswers}</strong> 問</li>
          ${accuracyLine}
          <li>連続学習日数: <strong>${data.streak}</strong> 日</li>
          <li>XP 獲得: <strong>+${data.weeklyXpDelta}</strong> (累計 ${data.totalXp})</li>
          <li>本日の解答合計: ${dailyTodayTotal} 問</li>
        </ul>

        <h2 style="font-size:16px; margin:20px 0 8px; color:${BRAND_COLOR};">英検${escapeHtml(
          data.targetLevel,
        )}級 4 スキル進捗</h2>
        <ul style="margin:0; padding-left:20px; line-height:1.7;">
          ${coverageRows || '<li style="color:#666;">出題対象が登録されていません。</li>'}
        </ul>

        <h2 style="font-size:16px; margin:20px 0 8px; color:${BRAND_COLOR};">受験日</h2>
        ${countdownLine}

        <p style="margin-top:24px; font-size:13px; color:#444;">
          詳細は保護者ダッシュボードからご確認いただけます。
        </p>

        <p style="margin-top:32px; font-size:12px; color:#888;">
          HANEI - 半年で英検3級。AIコーチと、毎日いっしょに。<br/>
          配信停止をご希望の場合は保護者ダッシュボードから設定してください。
        </p>
      </div>
    </div>
  `.trim();
}
