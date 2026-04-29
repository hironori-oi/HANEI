/**
 * HanekinBalanceHeader - /shop ページ上部 大表示残高 (W10-T2 / DEC-056)
 *
 * Server Component (動的演出は CSS のみ / inline JSX SVG)。
 * - 大きな数字 + Amber Gold #F2A93A + 黄金グロー
 * - 子ども × screen reader 向けに aria-label に「ハネキン X 個」を明示
 * - 絵文字は使わず inline JSX SVG (硬貨) を使う (CLAUDE.md 絵文字禁止)
 */

import * as React from "react";

interface HanekinBalanceHeaderProps {
  balance: number;
}

/**
 * 硬貨風 SVG (Amber Gold)。Heroicons の CurrencyDollarIcon は「$」シンボルなので、
 * HANEI ブランド (はね = 羽) に合わせた素朴な金貨を inline SVG で描く。
 */
function HanekinCoin({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className="drop-shadow-[0_0_12px_rgba(242,169,58,0.55)]"
    >
      <defs>
        <radialGradient id="hk-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FCE3A4" />
          <stop offset="60%" stopColor="#F2A93A" />
          <stop offset="100%" stopColor="#B97F18" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#hk-grad)" />
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="none"
        stroke="#7A4F0A"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {/* HANEI の頭文字「は」風の意匠ストローク (羽 = はね) */}
      <path
        d="M22 24 Q32 14 42 24 Q44 32 38 38 Q32 44 26 38 Q20 32 22 24 Z"
        fill="#7A4F0A"
        fillOpacity="0.18"
      />
      <path
        d="M28 22 Q32 18 36 22"
        stroke="#7A4F0A"
        strokeOpacity="0.6"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function HanekinBalanceHeader({ balance }: HanekinBalanceHeaderProps) {
  const safeBalance = Math.max(0, Math.floor(balance));
  return (
    <section
      className="rounded-lg border-2 border-[#F2A93A]/40 bg-gradient-to-br from-[#FFF5DC] to-[#FCE3A4]/40 p-6 shadow-sm dark:from-[#3A2A0A] dark:to-[#1A1408]"
      aria-label={`いまの ハネキン ざんだか: ${safeBalance} 個`}
      data-testid="hanekin-balance-header"
      data-balance={safeBalance}
    >
      <div className="flex items-center gap-4 sm:gap-6">
        <HanekinCoin size={64} />
        <div className="flex-1">
          <p className="text-sm font-medium text-[#7A4F0A] dark:text-[#F2A93A]">
            <ruby>
              ハネキン
              <rt>はねきん</rt>
            </ruby>{" "}
            の ざんだか
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className="text-5xl font-extrabold tabular-nums text-[#B97F18] dark:text-[#F2A93A] sm:text-6xl"
              aria-hidden="true"
            >
              {safeBalance.toLocaleString("ja-JP")}
            </span>
            <span className="text-xl font-semibold text-[#7A4F0A] dark:text-[#F2A93A]">
              個
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
