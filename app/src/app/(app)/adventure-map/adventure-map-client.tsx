"use client";

/**
 * HANEI - DEC-089 Plan C 項目 1: 冒険マップ 12 ノード描画 (client side)
 *
 * /adventure-map page.tsx から渡される 3 級 × 4 skill = 12 エリアを
 * 縦長スクロール地図として描画する.
 *
 * 設計:
 *  - framer-motion stagger entry (各ノードを順番に弾むように出現)
 *  - prefers-reduced-motion: reduce 時は瞬時表示
 *  - 状態色:
 *      cleared    = Mint Green ノード + チェック (CheckCircleIcon)
 *      in_progress = Amber Gold + pulse animation (現在地マーカー / SparklesIcon)
 *      not_started = グレー + 中立 lock (LockClosedIcon / **罰アイコン未使用**)
 *  - クリック / Enter / Space キーで `/study/eiken-{level}/{skill}` に遷移.
 *  - 全ノード aria-label 付与 + tabIndex=0 + focus-visible リング.
 *  - **赤色 / 鎖 / 罰アイコン 0** (DEC-024 罰則ゼロ哲学厳守).
 */

import * as React from "react";
import Link from "next/link";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import {
  CheckCircleIcon,
  LockClosedIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type { AdventureMapArea, AdventureMapSkill } from "@/lib/study/aggregations";

interface AreaWithHref extends AdventureMapArea {
  href: string;
}

interface LevelGroup {
  level: "5" | "4" | "3";
  areas: ReadonlyArray<AreaWithHref>;
}

interface Props {
  grouped: ReadonlyArray<LevelGroup>;
}

const SKILL_LABELS_JA: Record<AdventureMapSkill, string> = {
  vocabulary: "ごい",
  grammar: "ぶんぽう",
  reading: "どっかい",
  listening: "リスニング",
};

const STATUS_LABEL_JA: Record<AdventureMapArea["status"], string> = {
  cleared: "クリアずみ",
  in_progress: "しんこうちゅう",
  not_started: "これから",
};

export function AdventureMapClient({ grouped }: Props) {
  return (
    <LazyMotion features={domAnimation} strict>
      <AdventureMapClientInner grouped={grouped} />
    </LazyMotion>
  );
}

function AdventureMapClientInner({ grouped }: Props) {
  const reduce = useReducedMotion();

  return (
    <div
      className="space-y-10"
      data-testid="adventure-map-grid"
      role="list"
      aria-label="12 エリアの ぼうけんマップ"
    >
      {grouped.map((group, groupIdx) => (
        <LevelSection
          key={group.level}
          level={group.level}
          areas={group.areas}
          reduce={reduce ?? false}
          groupIdx={groupIdx}
        />
      ))}
    </div>
  );
}

function LevelSection({
  level,
  areas,
  reduce,
  groupIdx,
}: {
  level: "5" | "4" | "3";
  areas: ReadonlyArray<AreaWithHref>;
  reduce: boolean;
  groupIdx: number;
}) {
  return (
    <section
      data-testid={`adventure-map-level-${level}`}
      className="rounded-2xl border bg-card p-5"
    >
      <h2 className="mb-4 font-display text-xl font-bold text-primary">
        英検 {level} 級 エリア
      </h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {areas.map((area, i) => (
          <m.div
            key={area.areaId}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={reduce ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    type: "spring",
                    stiffness: 220,
                    damping: 22,
                    delay: groupIdx * 0.18 + i * 0.06,
                  }
            }
          >
            <AreaNode area={area} reduce={reduce} />
          </m.div>
        ))}
      </div>
    </section>
  );
}

function AreaNode({
  area,
  reduce,
}: {
  area: AreaWithHref;
  reduce: boolean;
}) {
  const ariaLabel =
    `エリア 英検${area.level}級 ${SKILL_LABELS_JA[area.skill]} ${STATUS_LABEL_JA[area.status]} ` +
    `マスタリ ${area.mastered}/${area.total}`;

  return (
    <Link
      href={area.href}
      aria-label={ariaLabel}
      data-testid={`adventure-map-node-${area.areaId}`}
      data-status={area.status}
      data-level={area.level}
      data-skill={area.skill}
      className={cn(
        "group block rounded-2xl border-2 p-4 outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        area.status === "cleared"
          ? "border-success/60 bg-success/10 hover:border-success"
          : area.status === "in_progress"
            ? "border-primary/60 bg-primary/10 hover:border-primary"
            : "border-muted-foreground/20 bg-muted/20 hover:border-muted-foreground/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <NodeStatusIcon status={area.status} reduce={reduce} />
        <span className="text-xs tabular-nums text-muted-foreground">
          {area.mastered}/{area.total}
        </span>
      </div>
      <p
        className={cn(
          "mb-1 text-sm font-bold",
          area.status === "cleared"
            ? "text-success"
            : area.status === "in_progress"
              ? "text-primary"
              : "text-muted-foreground",
        )}
      >
        {SKILL_LABELS_JA[area.skill]}
      </p>
      <p className="text-xs text-muted-foreground">
        {STATUS_LABEL_JA[area.status]}
      </p>

      {/* 進捗 ring の代替: 細い fill bar (track + fill) */}
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/60"
        role="progressbar"
        aria-valuenow={Math.round(area.ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${SKILL_LABELS_JA[area.skill]} の進捗 ${Math.round(area.ratio * 100)}%`}
      >
        <m.div
          initial={reduce ? false : { width: "0%" }}
          animate={{ width: `${Math.round(area.ratio * 100)}%` }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 80, damping: 16, delay: 0.4 }
          }
          className={cn(
            "h-full rounded-full",
            area.status === "cleared"
              ? "bg-success"
              : area.status === "in_progress"
                ? "bg-primary"
                : "bg-muted-foreground/40",
          )}
        />
      </div>
    </Link>
  );
}

function NodeStatusIcon({
  status,
  reduce,
}: {
  status: AdventureMapArea["status"];
  reduce: boolean;
}) {
  if (status === "cleared") {
    return (
      <CheckCircleIcon
        className="h-7 w-7 text-success"
        aria-hidden="true"
      />
    );
  }
  if (status === "in_progress") {
    return (
      <m.span
        animate={
          reduce
            ? { opacity: 1 }
            : { scale: [1, 1.12, 1], opacity: [1, 0.85, 1] }
        }
        transition={
          reduce
            ? { duration: 0 }
            : { repeat: Infinity, duration: 1.6, ease: "easeInOut" }
        }
        className="inline-block"
        aria-hidden="true"
      >
        <SparklesIcon className="h-7 w-7 text-primary" aria-hidden="true" />
      </m.span>
    );
  }
  // not_started: 中立 lock (鎖アイコン未使用 / 罰なし / DEC-024 罰則ゼロ)
  return (
    <LockClosedIcon
      className="h-7 w-7 text-muted-foreground/70"
      aria-hidden="true"
    />
  );
}
