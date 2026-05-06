"use client";

/**
 * HANEI - 冒険マップ client
 *
 * DEC-089 Plan C 項目 1: 12 ノード描画
 * DEC-091 / 項目 B: 「道のり」本格実装
 *   - B-1: ノード間 SVG curved trail 線 (status 別 stroke / dashed flow animation)
 *   - B-2: 進行中 / 次クリア候補 ノードに halo (radial pulse) 追加
 *   - B-3: 「次のエリアへ つづける」 sticky CTA bar
 *   - B-4: boss area tag + boss-battle-celebration preview-mode wire
 *
 * 既存 selector / data-testid / data-status / data-level / data-skill 完全保持.
 *
 * 設計:
 *  - framer-motion stagger entry (各ノードを順番に弾むように出現)
 *  - prefers-reduced-motion: reduce 時は瞬時表示 / trail flow 停止 / halo 静止
 *  - 状態色:
 *      cleared    = Mint Green (success token)
 *      in_progress = Amber Gold (primary token)
 *      not_started = Lavender 半透明 (muted-foreground/40)
 *  - クリック / Enter / Space で `/study/eiken-{level}/{skill}` 遷移
 *  - 全ノード aria-label + tabIndex=0 + focus-visible リング
 *  - **罰則ゼロ哲学厳守 (DEC-024)**: 赤色 / 鎖 / バツ印 / 怒り 0
 *
 * boss area:
 *  - 各レベル (5/4/3) の最後 skill (listening) を boss area として tag
 *  - data-boss-area="true" attribute / 異なる color tint (deep amber + soft red-orange = warm amber グラデ)
 *  - クリック時に boss-battle-celebration を **preview-mode** で表示 (合格条件説明 + 中立コピー / mutation +0)
 */

import * as React from "react";
import Link from "next/link";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import {
  CheckCircleIcon as CheckCircleIconSolid,
  SparklesIcon as SparklesIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
} from "@heroicons/react/24/solid";
import {
  LockClosedIcon,
  ArrowRightIcon,
  FireIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type { AdventureMapArea, AdventureMapSkill } from "@/lib/study/aggregations";
import { BossBattleCelebrationModal } from "@/components/exam/boss-battle-celebration";

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
  // DEC-093: 「じゅんびちゅう」(問題未準備 / total = 0) に Mint 色 + 期待感を持たせる.
  preparing: "じゅんびちゅう",
};

const LEVEL_LABEL_JA: Record<"5" | "4" | "3", string> = {
  "5": "英検 5 級",
  "4": "英検 4 級",
  "3": "英検 3 級",
};

/** boss area 判定: 各レベル最後の skill = listening を試練 (boss) とする. */
function isBossArea(area: AdventureMapArea): boolean {
  return area.skill === "listening";
}

export function AdventureMapClient({ grouped }: Props) {
  return (
    <LazyMotion features={domAnimation} strict>
      <AdventureMapClientInner grouped={grouped} />
    </LazyMotion>
  );
}

function AdventureMapClientInner({ grouped }: Props) {
  const reduce = useReducedMotion();

  // 進行中エリア (1 件目) を見つけて sticky CTA に出す
  const allAreas = React.useMemo(
    () => grouped.flatMap((g) => g.areas),
    [grouped],
  );
  const inProgressArea: AreaWithHref | undefined = React.useMemo(
    () => allAreas.find((a) => a.status === "in_progress"),
    [allAreas],
  );

  // boss preview modal state
  const [previewArea, setPreviewArea] = React.useState<AreaWithHref | null>(
    null,
  );

  return (
    <>
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
            onBossPreview={setPreviewArea}
          />
        ))}
      </div>

      {/* B-3: sticky bottom CTA (進行中エリアが 1 件以上あるときのみ) */}
      {inProgressArea ? (
        <div
          className="sticky bottom-4 z-30 mt-8"
          data-testid="adventure-map-continue-cta"
        >
          <div className="mx-auto max-w-md rounded-3xl border-[3px] border-primary/70 bg-card/95 p-3 shadow-xl backdrop-blur">
            <Link
              href={inProgressArea.href}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl px-4 py-3",
                "bg-primary/15 text-primary outline-none",
                "hover:bg-primary/25",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              )}
              aria-label={`${LEVEL_LABEL_JA[inProgressArea.level]} ${SKILL_LABELS_JA[inProgressArea.skill]} を つづける`}
              data-testid="adventure-map-continue-link"
            >
              <span className="flex items-center gap-2">
                <SparklesIconSolid
                  className="h-5 w-5 text-primary"
                  aria-hidden="true"
                />
                <span className="font-display text-base font-bold">
                  {LEVEL_LABEL_JA[inProgressArea.level]}{" "}
                  {SKILL_LABELS_JA[inProgressArea.skill]} を つづける
                </span>
              </span>
              <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}

      {/* B-4: boss-battle-celebration preview modal (mutation +0 / data 副作用 0) */}
      {previewArea ? (
        <BossBattleCelebrationModal
          open
          // preview = 合格条件説明 (実 score 0 / pass=false で「がんばろう」中立コピー固定)
          pass={false}
          score={0}
          maxScore={50}
          levelLabel={`${LEVEL_LABEL_JA[previewArea.level]} (${SKILL_LABELS_JA[previewArea.skill]} の試練)`}
          onContinue={() => {
            // preview なので「実エリアへ」遷移 = router 不要 / Link で onClose して通常遷移
            window.location.href = previewArea.href;
          }}
          onClose={() => setPreviewArea(null)}
          // preview-mode は confetti を出さない (pass=false 経路で既に出ない)
        />
      ) : null}
    </>
  );
}

function LevelSection({
  level,
  areas,
  reduce,
  groupIdx,
  onBossPreview,
}: {
  level: "5" | "4" | "3";
  areas: ReadonlyArray<AreaWithHref>;
  reduce: boolean;
  groupIdx: number;
  onBossPreview: (area: AreaWithHref) => void;
}) {
  return (
    <section
      data-testid={`adventure-map-level-${level}`}
      data-card-decoration="true"
      className="rounded-3xl border-[3px] bg-card p-5 shadow-md"
    >
      <h2 className="mb-4 font-display text-xl font-bold text-primary">
        英検 {level} 級 エリア
      </h2>

      {/* グリッド + SVG trail overlay */}
      <div className="relative">
        {/* B-1: trail 線 SVG overlay (grid 同領域) */}
        <TrailOverlay areas={areas} reduce={reduce} />

        <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              className="relative"
            >
              <AreaNode
                area={area}
                reduce={reduce}
                onBossPreview={onBossPreview}
              />
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * B-1: ノード間 curved trail 線 SVG overlay.
 *
 * grid (2 cols on mobile / 4 cols on sm+) 内の隣接ノード間を
 * SVG quadratic Bezier で繋ぐ. status 組合せ別に stroke を変える.
 *
 * - 両端 cleared           = 実線 Amber Gold (太め)
 * - cleared <-> in_progress = 実線 Amber Gold → dashed flow Sky Blue
 * - in_progress <-> not_started = dashed Lavender (flow)
 * - 両端 not_started       = 半透明 Lavender (静止)
 *
 * 子供向けに「次に行ける道」が dashed で flowing するため没入感が出る.
 * pointer-events: none で操作干渉ゼロ. aria-hidden=true.
 */
function TrailOverlay({
  areas,
  reduce,
}: {
  areas: ReadonlyArray<AreaWithHref>;
  reduce: boolean;
}) {
  // 4 ノード (vocabulary / grammar / reading / listening) 横並び前提
  // sm: 4 cols / mobile: 2 cols (2 行折返し)
  // SVG は viewBox を %-based にして responsive に追従させる
  // 簡易: 横線 3 本 (i → i+1) を 4 cols (sm+) で表示するため
  // hidden sm:block で sm 以上でのみ trail を表示する
  if (areas.length < 2) return null;

  // ノード x 中心 (4 cols 等分): 12.5%, 37.5%, 62.5%, 87.5%
  const nodeXs = [12.5, 37.5, 62.5, 87.5];

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full sm:block"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-testid="adventure-map-trail-overlay"
    >
      {areas.slice(0, 3).map((from, i) => {
        const to = areas[i + 1];
        if (!to) return null;
        const x1 = nodeXs[i];
        const x2 = nodeXs[i + 1];
        if (x1 === undefined || x2 === undefined) return null;
        const midX = (x1 + x2) / 2;
        const cy = 15;
        const ctrlY = 6 + (i % 2) * 3; // 上下に揺らぎ

        // status 組合せから stroke 決定
        const trailStyle = resolveTrailStyle(from.status, to.status);

        // path: M start C ctrl1 ctrl2 end (smooth curve)
        const d = `M ${x1} ${cy} Q ${midX} ${ctrlY} ${x2} ${cy}`;

        return (
          <path
            key={`trail-${i}`}
            d={d}
            fill="none"
            stroke={trailStyle.stroke}
            strokeWidth={trailStyle.width}
            strokeOpacity={trailStyle.opacity}
            strokeLinecap="round"
            strokeDasharray={trailStyle.dashArray ?? undefined}
            className={
              !reduce && trailStyle.flow
                ? "hanei-trail-flow"
                : undefined
            }
            data-trail-from={from.status}
            data-trail-to={to.status}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

interface TrailStyle {
  stroke: string;
  width: number;
  opacity: number;
  dashArray: string | null;
  flow: boolean;
}

function resolveTrailStyle(
  from: AdventureMapArea["status"],
  to: AdventureMapArea["status"],
): TrailStyle {
  // Amber Gold = #F2A93A / Sky Blue = #4FC3F7 / Lavender = #B8A4E0
  const bothCleared = from === "cleared" && to === "cleared";
  const oneCleared =
    (from === "cleared" && to !== "cleared") ||
    (to === "cleared" && from !== "cleared");
  const involvesInProgress =
    from === "in_progress" || to === "in_progress";
  const bothNotStarted = from === "not_started" && to === "not_started";

  // DEC-092: stroke width +0.4 / opacity を全体的に強化 (進行中 0.85 → 0.95 / fallback 0.55 → 0.75)
  if (bothCleared) {
    return {
      stroke: "#F2A93A",
      width: 2.8,
      opacity: 0.95,
      dashArray: null,
      flow: false,
    };
  }
  if (oneCleared && involvesInProgress) {
    return {
      stroke: "#4FC3F7",
      width: 2.4,
      opacity: 0.95,
      dashArray: "3 4",
      flow: true,
    };
  }
  if (involvesInProgress) {
    return {
      stroke: "#B8A4E0",
      width: 2.2,
      opacity: 0.85,
      dashArray: "2 4",
      flow: true,
    };
  }
  if (bothNotStarted) {
    return {
      stroke: "#B8A4E0",
      width: 1.6,
      opacity: 0.45,
      dashArray: "2 5",
      flow: false,
    };
  }
  // fallback: cleared <-> not_started (進行中なし)
  return {
    stroke: "#F2A93A",
    width: 2.2,
    opacity: 0.75,
    dashArray: "3 4",
    flow: false,
  };
}

function AreaNode({
  area,
  reduce,
  onBossPreview,
}: {
  area: AreaWithHref;
  reduce: boolean;
  onBossPreview: (area: AreaWithHref) => void;
}) {
  const boss = isBossArea(area);
  // DEC-093: preparing は「じゅんびちゅう (もうすぐ あえるよ)」で期待感を伝える.
  const statusSuffix =
    area.status === "preparing"
      ? `${STATUS_LABEL_JA[area.status]} (もうすぐ あえるよ)`
      : `${STATUS_LABEL_JA[area.status]} マスタリ ${area.mastered}/${area.total}`;
  const ariaLabel =
    `エリア 英検${area.level}級 ${SKILL_LABELS_JA[area.skill]} ` +
    statusSuffix +
    (boss ? " (試練エリア)" : "");

  // DEC-092: 視認性強化 = border-2 → border-[3px] / rounded-2xl → rounded-3xl / p-4 → p-5
  // bg opacity 10% → 18-20% / shadow-md hover:shadow-lg 追加
  // DEC-093: preparing は Mint 色 (secondary) で期待感を持たせる中立表示.
  const cardClasses = cn(
    "group block rounded-3xl border-[3px] p-5 shadow-md outline-none transition-all",
    "hover:shadow-lg",
    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    area.status === "cleared"
      ? "border-success/70 bg-success/20 hover:border-success"
      : area.status === "in_progress"
        ? "border-primary/70 bg-primary/20 hover:border-primary"
        : area.status === "preparing"
          ? "border-secondary/60 bg-secondary/15 hover:border-secondary"
          : "border-muted-foreground/30 bg-muted/30 hover:border-muted-foreground/50",
    // boss area = warm amber ring (罰則ゼロ準拠 / 「赤色」未使用)
    boss && "ring-2 ring-primary/40 ring-offset-1",
  );

  // halo: in_progress または boss area not_started に subtle pulse
  const showHalo =
    area.status === "in_progress" ||
    (boss && area.status !== "cleared");

  // DEC-092: in_progress = double-ring halo (内側 amber + 外側 white glow / 強化版)
  const isDoubleRing = area.status === "in_progress";

  return (
    <div className="relative">
      {/* B-2 / DEC-092: halo (進行中 = double-ring 強化 / 試練エリア = 単色 amber pulse) */}
      {showHalo ? (
        isDoubleRing ? (
          <span
            aria-hidden="true"
            data-testid={`adventure-map-halo-${area.areaId}`}
            data-halo-style="double-ring"
            className={cn(
              "pointer-events-none absolute -inset-1 rounded-3xl",
              "hanei-node-halo-double",
            )}
          />
        ) : (
          <span
            aria-hidden="true"
            data-testid={`adventure-map-halo-${area.areaId}`}
            data-halo-style="single"
            className={cn(
              "pointer-events-none absolute inset-0 rounded-3xl",
              "hanei-node-halo",
            )}
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(242, 169, 58, 0.50) 0%, rgba(255, 210, 122, 0.22) 60%, transparent 78%)",
            }}
          />
        )
      ) : null}

      <Link
        href={area.href}
        aria-label={ariaLabel}
        data-testid={`adventure-map-node-${area.areaId}`}
        data-status={area.status}
        data-level={area.level}
        data-skill={area.skill}
        data-boss-area={boss ? "true" : undefined}
        className={cn(cardClasses, "relative")}
      >
        {/* DEC-092: cleared ノードの floating checkmark sticker (角バッジ) */}
        {area.status === "cleared" ? (
          <span
            aria-hidden="true"
            data-testid={`adventure-map-cleared-sticker-${area.areaId}`}
            className={cn(
              "absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center",
              "rounded-full border-2 border-white bg-success text-white shadow-md",
              "hanei-cleared-sticker",
            )}
          >
            <CheckCircleIconSolid className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}

        <div className="mb-2 flex items-center justify-between">
          <NodeStatusIcon status={area.status} reduce={reduce} boss={boss} />
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
                : area.status === "preparing"
                  ? "text-secondary"
                  : "text-muted-foreground",
          )}
        >
          {SKILL_LABELS_JA[area.skill]}
          {boss ? (
            <span
              className="ml-1 inline-flex items-center gap-0.5 align-middle text-[10px] font-bold text-primary/80"
              data-testid={`adventure-map-boss-tag-${area.areaId}`}
            >
              <ShieldCheckIcon
                className="inline h-3 w-3"
                aria-hidden="true"
              />
              しれん
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {STATUS_LABEL_JA[area.status]}
        </p>

        {/* 進捗 ring の代替: 細い fill bar */}
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
                  : area.status === "preparing"
                    ? "bg-secondary/30"
                    : "bg-muted-foreground/40",
            )}
          />
        </div>

        {/* DEC-093: preparing 専用 子供向け励ましテキスト (期待感 / 罰則ゼロ厳守) */}
        {area.status === "preparing" ? (
          <p
            className="mt-2 text-[11px] font-medium text-secondary"
            data-testid={`adventure-map-preparing-msg-${area.areaId}`}
          >
            もうすぐ あえるよ!
          </p>
        ) : null}
      </Link>

      {/* boss preview ボタン (試練エリア専用 / 罰則ゼロ中立コピー) */}
      {boss ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBossPreview(area);
          }}
          data-testid={`adventure-map-boss-preview-${area.areaId}`}
          className={cn(
            "mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg",
            "border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary",
            "outline-none transition-colors hover:bg-primary/10",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          )}
          aria-label={`${SKILL_LABELS_JA[area.skill]} の試練について見る`}
        >
          <FireIcon className="h-3 w-3" aria-hidden="true" />
          しれんを みる
        </button>
      ) : null}
    </div>
  );
}

function NodeStatusIcon({
  status,
  reduce,
  boss,
}: {
  status: AdventureMapArea["status"];
  reduce: boolean;
  boss: boolean;
}) {
  // DEC-092: cleared / in_progress = Solid icons (24/solid) で目立たせる
  // not_started = Outline (中立 / 控えめ)
  if (status === "cleared") {
    return (
      <CheckCircleIconSolid
        className="h-8 w-8 text-success drop-shadow-sm"
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
            : { scale: [1, 1.15, 1], opacity: [1, 0.85, 1] }
        }
        transition={
          reduce
            ? { duration: 0 }
            : { repeat: Infinity, duration: 1.6, ease: "easeInOut" }
        }
        className="inline-block"
        aria-hidden="true"
      >
        <SparklesIconSolid
          className="h-8 w-8 text-primary drop-shadow-sm"
          aria-hidden="true"
        />
      </m.span>
    );
  }
  // DEC-093: preparing (じゅんびちゅう) = Mint 色 SparklesIcon outline で期待感を演出.
  // 「もうすぐ あえるよ!」のメッセージとセットで子供に「準備中」と伝える (罰則ゼロ厳守).
  if (status === "preparing") {
    return (
      <SparklesIcon
        className="h-8 w-8 text-secondary"
        aria-hidden="true"
      />
    );
  }
  // not_started: 中立 lock (鎖アイコン未使用 / 罰なし / DEC-024 罰則ゼロ)
  // boss area の not_started はあえて lock ではなく shield (中立) でも良いが,
  // 既存 selector 互換 + 罰則ゼロ哲学 (LockClosedIcon は既に「中立」運用) を維持.
  if (boss) {
    return (
      <ShieldCheckIconSolid
        className="h-8 w-8 text-primary/70"
        aria-hidden="true"
      />
    );
  }
  return (
    <LockClosedIcon
      className="h-7 w-7 text-muted-foreground/70"
      aria-hidden="true"
    />
  );
}
