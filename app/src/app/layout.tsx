import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Mochiy_Pop_One } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// 暫定: Geist 採用前の placeholder。`geist` パッケージ追加後に置換予定。
const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * DEC-087 Plan A: 見出し / Hero タイトル / Level-up テキスト用 display フォント。
 * Mochiy Pop One = 子ども向け楽しい印象のラウンド系日本語ゴシック。
 * 見出し用途のみで利用 (本文 Inter は維持) / Latin subset のみ宣言。
 * 日本語グリフは Google Fonts の動的サブセット (variable font) 配信で軽量化。
 */
const fontDisplay = Mochiy_Pop_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "HANEI - 半年で英検3級を目指す小学生向け英語学習アプリ",
    template: "%s | HANEI",
  },
  description:
    "HANEI（ハンエイ / 半英）は、AIコーチが毎日伴走する小学生向け英語学習Webアプリです。英検5級から3級まで、半年で英検3級合格を目指します。",
  keywords: ["英検", "小学生", "英語学習", "英検3級", "AIコーチ", "HANEI"],
  authors: [{ name: "HANEI" }],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2A93A" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1410" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && (
          <>
            {/* dev では cookie 累積 (HTTP 431) の元凶になるため production のみで有効化 */}
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
