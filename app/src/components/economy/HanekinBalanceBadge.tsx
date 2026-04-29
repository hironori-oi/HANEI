/**
 * HanekinBalanceBadge - 共通 layout header に常時表示される小サイズ残高バッジ (W10-T2 / DEC-056)
 *
 * Server Component (Link で wrap して /shop へ遷移)。
 * - 小サイズ硬貨 + 数字 + 「ハネキン」label
 * - クリックで /shop?learner=<activeId> へ遷移
 * - 全 authed ページから残高が見える状態にする
 */

import Link from "next/link";

interface HanekinBalanceBadgeProps {
  balance: number;
  /** /shop 遷移時に query string に乗せる learnerId (optional) */
  learnerId?: string | undefined;
}

function HanekinCoinSmall({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hk-badge-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FCE3A4" />
          <stop offset="60%" stopColor="#F2A93A" />
          <stop offset="100%" stopColor="#B97F18" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#hk-badge-grad)" />
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="none"
        stroke="#7A4F0A"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
    </svg>
  );
}

export function HanekinBalanceBadge({
  balance,
  learnerId,
}: HanekinBalanceBadgeProps) {
  const safeBalance = Math.max(0, Math.floor(balance));
  const href = learnerId
    ? `/shop?learner=${encodeURIComponent(learnerId)}`
    : "/shop";
  return (
    <Link
      href={href}
      data-testid="hanekin-balance-badge"
      data-balance={safeBalance}
      aria-label={`ショップ。いまの ハネキン ざんだか ${safeBalance} 個`}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#F2A93A]/40 bg-[#FFF5DC] px-3 py-1.5 text-sm font-semibold text-[#7A4F0A] shadow-sm transition-colors hover:bg-[#FCE3A4]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A93A] focus-visible:ring-offset-2 dark:border-[#F2A93A]/30 dark:bg-[#3A2A0A] dark:text-[#F2A93A] dark:hover:bg-[#5A3F18]"
    >
      <HanekinCoinSmall size={18} />
      <span className="tabular-nums">{safeBalance.toLocaleString("ja-JP")}</span>
      <span className="text-xs">ハネキン</span>
    </Link>
  );
}
