/**
 * HANEI - /adventure-map (DEC-089 Plan C 項目 1)
 *
 * 冒険マップ UI: 12 学習エリア (英検 5/4/3 級 × 4 skill) を縦長スクロール地図で表示.
 *
 * 設計:
 *  - Server Component で 12 エリア進捗を SSR 集計 (`getAdventureMapSummary`).
 *  - クリック時遷移先は既存 `/study/[levelCode]/[skillCode]` (route 無変更).
 *  - クリア / 進行中 / 未着手の 3 状態のみ. **赤色 / 鎖 / 罰アイコン未使用** (DEC-024 罰則ゼロ).
 *  - WCAG 2.1 AA: 全ノード focusable + aria-label + キーボード遷移可.
 *  - framer-motion stagger entry (`prefers-reduced-motion: reduce` 時は瞬時遷移).
 *
 * 認可 (DEC-003 三層認可):
 *  - 第一層: middleware (proxy.ts).
 *  - 第二層: requireAuth + getFamilyIdForUser + requireLearnerOwner (resolveActiveLearner).
 *  - 第三層: getAdventureMapSummary が learnerId スコープで SQL を発行.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, MapIcon, LockClosedIcon, CheckCircleIcon, SparklesIcon } from "@heroicons/react/24/outline";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  requireAuth,
  getFamilyIdForUser,
  requireLearnerOwner,
} from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { getLearnersForParent } from "@/lib/learner/repository";
import { resolveActiveLearner } from "@/lib/study/learner-switch";
import {
  getAdventureMapSummary,
  type AdventureMapArea,
} from "@/lib/study/aggregations";
import { AdventureMapClient } from "./adventure-map-client";

export const metadata = {
  title: "ぼうけんマップ",
};

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

// URL skillCode へのマップ (冒険マップ → /study route)
const SKILL_URL_CODE: Record<AdventureMapArea["skill"], string> = {
  vocabulary: "vocab",
  grammar: "grammar",
  reading: "reading",
  listening: "listening",
};

/** 表示用に level → skill 順で 4 エリアずつグルーピング */
function groupByLevel(
  areas: ReadonlyArray<AdventureMapArea>,
): ReadonlyArray<{ level: "5" | "4" | "3"; areas: ReadonlyArray<AdventureMapArea> }> {
  const levels: Array<"5" | "4" | "3"> = ["5", "4", "3"];
  return levels.map((lv) => ({
    level: lv,
    areas: areas.filter((a) => a.level === lv),
  }));
}

export default async function AdventureMapPage({ searchParams }: PageProps) {
  // 1. 認可
  const session = await requireAuth();
  const familyId = await getFamilyIdForUser(session.userId);
  if (!familyId) redirect("/onboarding/learner");

  // 2. learner 解決 (/home と同じパターン)
  const learners = await getLearnersForParent(session.userId);
  if (learners.length === 0) redirect("/onboarding/learner");

  const sp = (await searchParams) ?? {};
  const resolved = resolveActiveLearner({
    learners: learners.map((l) => ({ id: l.id, nickname: l.nickname })),
    rawQuery: sp.learner,
  });
  const activeId = resolved.active?.id;
  if (!activeId) redirect("/onboarding/learner");

  await requireLearnerOwner(session.userId, activeId);

  const learner = learners.find((l) => l.id === activeId);
  if (!learner) redirect("/onboarding/learner");

  // 3. 12 エリア進捗集計 (SSR)
  const summary = await getAdventureMapSummary(db, learner.id);
  const grouped = groupByLevel(summary.areas);

  // /study route への遷移用 URL ヘルパ
  const buildStudyHref = (area: AdventureMapArea): string => {
    const skillUrl = SKILL_URL_CODE[area.skill];
    return `/study/eiken-${area.level}/${skillUrl}?learner=${encodeURIComponent(
      activeId,
    )}`;
  };

  return (
    <main
      className="mx-auto max-w-3xl px-6 py-10"
      data-testid="adventure-map-main"
      data-cleared-count={summary.clearedCount}
      data-in-progress-count={summary.inProgressCount}
      data-not-started-count={summary.notStartedCount}
    >
      <header className="mb-6 flex items-center justify-between">
        <Link
          href={`/home?learner=${encodeURIComponent(activeId)}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground underline"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
          ホームに もどる
        </Link>
        <span className="text-sm text-muted-foreground">
          {learner.nickname} さんの ぼうけん
        </span>
      </header>

      <section className="mb-6">
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <MapIcon className="h-8 w-8 text-primary" aria-hidden="true" />
          ぼうけんマップ
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          12 こ の エリアを ことだまトリと いっしょに あるいて いこう。
        </p>
      </section>

      {/* サマリ カード */}
      <section className="mb-8 grid grid-cols-3 gap-3">
        <Card data-testid="adventure-map-cleared-card">
          <CardHeader>
            <CheckCircleIcon
              className="mb-1 h-6 w-6 text-success"
              aria-hidden="true"
            />
            <CardTitle className="text-base">クリア</CardTitle>
            <CardDescription>すごいね！</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-success">
              {summary.clearedCount} / 12
            </p>
          </CardContent>
        </Card>
        <Card data-testid="adventure-map-in-progress-card">
          <CardHeader>
            <SparklesIcon
              className="mb-1 h-6 w-6 text-primary"
              aria-hidden="true"
            />
            <CardTitle className="text-base">しんこうちゅう</CardTitle>
            <CardDescription>ちょうし いいね！</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-primary">
              {summary.inProgressCount} / 12
            </p>
          </CardContent>
        </Card>
        <Card data-testid="adventure-map-not-started-card">
          <CardHeader>
            <LockClosedIcon
              className="mb-1 h-6 w-6 text-muted-foreground"
              aria-hidden="true"
            />
            <CardTitle className="text-base">これから</CardTitle>
            <CardDescription>たのしみだね</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-muted-foreground">
              {summary.notStartedCount} / 12
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 縦長スクロール地図 (3 級 × 4 skill / framer-motion stagger は client 側) */}
      <AdventureMapClient
        grouped={grouped.map((g) => ({
          level: g.level,
          areas: g.areas.map((a) => ({
            ...a,
            href: buildStudyHref(a),
          })),
        }))}
      />

      <footer className="mt-10">
        <Button asChild size="lg" variant="outline" className="min-h-tap-cta">
          <Link href={`/home?learner=${encodeURIComponent(activeId)}`}>
            ホームに もどる
          </Link>
        </Button>
      </footer>
    </main>
  );
}
