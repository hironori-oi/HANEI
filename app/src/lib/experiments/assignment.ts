/**
 * HANEI - A/B Test Assignment & Cohort Aggregation (W12-T2 / DEC-066)
 *
 * server-only helper. 認可は呼び出し元責任 (= 呼ぶ前に `requireAdmin()` または
 * `requireLearnerOwner()` を済ませること).
 *
 * 不変条件:
 *   - `"use server"` directive 不使用 (Turbopack `"use server"` sync export ban / 7 度目).
 *   - kpi.ts と同形式: Server Component から直接 import 可能な server-only モジュール.
 *   - 集計関数は SQL aggregate-only (json_extract / GROUP BY / COUNT / AVG) で
 *     learner_id / family_id を構造的に flow させない (DEC-003 三層認可 / 第三層).
 *
 * idempotency (DEC-055):
 *   - getOrAssignVariant は (a) 既存割当が catalog の variants[].key にマッチすれば
 *     DB write 0 / そのまま返却, (b) 未割当 / 不正 variant のときのみ json_set で
 *     UPDATE 1 回. 同一 (learner, experiment) への複数 call は安全.
 *
 * SQL injection 防御:
 *   - experimentKey は SQL に直接埋め込まない. `sql.raw` を使わず `sql\`...\``
 *     テンプレートリテラルでパラメータとして bind する.
 *   - json path 文字列 (`$.<key>`) は Node 側で組み立て、bind パラメータとして渡す.
 */

import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { learnerProfiles, streaks } from "@/lib/db/schema";
import {
  EXPERIMENTS,
  assignVariant,
  getExperimentDef,
  validateExperimentsJson,
  type ExperimentKey,
} from "@/lib/experiments/experiments-catalog";

// ---------------------------------------------------------------------------
// 内部ユーティリティ
// ---------------------------------------------------------------------------

/**
 * SQLite の json_extract path 形式. `$.foo` を experimentKey から組み立てる.
 *
 *  - 注意: 本値は `sql\`json_extract(experiments, ${jsonPath})\`` のように
 *    bind パラメータとして渡すこと (sql.raw で埋めない).
 */
function jsonPathFor(experimentKey: string): string {
  return `$.${experimentKey}`;
}

/**
 * DB から取り出した learner_profiles.experiments cell を `Record<string, string>` に正規化.
 * drizzle の `mode: "json"` text 列は libSQL 上では JSON 文字列で来るケースもあるため、
 * string なら parse、object ならそのまま、それ以外は空オブジェクト fallback.
 */
function validateExperimentsCell(raw: unknown): Record<string, string> {
  if (typeof raw === "string") {
    try {
      return validateExperimentsJson(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return validateExperimentsJson(raw);
}

// ---------------------------------------------------------------------------
// getOrAssignVariant: idempotent UPSERT
// ---------------------------------------------------------------------------

/**
 * 学習者 × experiment の variant 割当を「取得 or 新規 deterministic 割当」する.
 *
 *  - 既に valid な割当があれば DB write 0 で返却 (idempotent / DEC-055).
 *  - 未割当 or catalog から外れた variant なら deterministic に割当 → json_set で UPSERT.
 *  - 認可は呼び出し元責任 (本関数は学習者 ID を受け取るだけ / 所有権検証は外側で).
 *
 * @param learnerId - learner_profiles.id
 * @param experimentKey - EXPERIMENTS の key (catalog 未登録なら throw)
 * @returns 割当済 variant key
 */
export async function getOrAssignVariant(
  learnerId: string,
  experimentKey: string,
): Promise<string> {
  if (typeof learnerId !== "string" || learnerId.length === 0) {
    throw new Error(
      "[experiments/assignment] getOrAssignVariant: learnerId required",
    );
  }
  const def = getExperimentDef(experimentKey);
  if (!def) {
    throw new Error(
      `[experiments/assignment] getOrAssignVariant: unknown experiment "${experimentKey}"`,
    );
  }

  // 1. 現在の experiments JSON を読む.
  // eslint-disable-next-line no-restricted-syntax -- admin/experiments helper (DEC-003 / DEC-066)
  const rows = await db
    .select({ experiments: learnerProfiles.experiments })
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);
  if (rows.length === 0) {
    throw new Error(
      `[experiments/assignment] getOrAssignVariant: learner ${learnerId} not found`,
    );
  }
  const current = validateExperimentsCell(rows[0]?.experiments);

  const knownVariantKeys = new Set(def.variants.map((v) => v.key));
  const existing = current[experimentKey];
  if (typeof existing === "string" && knownVariantKeys.has(existing)) {
    // (a) 既に valid → DB write 0 で即返却 (idempotent).
    return existing;
  }

  // (b) 未割当 / 不正 variant → deterministic 割当.
  const assigned = assignVariant(`${learnerId}:${experimentKey}`, def.variants);

  // 2. json_set で UPDATE. experimentKey は bind 経由 (json path 文字列で).
  const path = jsonPathFor(experimentKey);
  await db
    .update(learnerProfiles)
    .set({
      experiments: sql`json_set(${learnerProfiles.experiments}, ${path}, ${assigned})`,
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(learnerProfiles.id, learnerId));

  return assigned;
}

// ---------------------------------------------------------------------------
// getCohortDistribution: variant 別 cohort 数 (aggregate-only)
// ---------------------------------------------------------------------------

/**
 * variant 別の cohort サイズを返す.
 *
 *  - SQL: `SELECT json_extract(experiments, '$.<key>') AS variant, COUNT(*) AS count
 *           FROM learner_profiles
 *           WHERE json_extract(experiments, '$.<key>') IS NOT NULL
 *           GROUP BY variant`
 *  - learner_id / family_id を SELECT 句から構造的に排除 (DEC-003 / DEC-066).
 */
export async function getCohortDistribution(
  experimentKey: string,
): Promise<{ variantKey: string; count: number }[]> {
  if (typeof experimentKey !== "string" || experimentKey.length === 0) {
    throw new Error(
      "[experiments/assignment] getCohortDistribution: experimentKey required",
    );
  }
  const path = jsonPathFor(experimentKey);
  // eslint-disable-next-line no-restricted-syntax -- admin/experiments aggregate-only (DEC-003 / DEC-066)
  const rows = await db
    .select({
      variant: sql<string | null>`json_extract(${learnerProfiles.experiments}, ${path})`,
      cnt: sql<number>`COUNT(*)`,
    })
    .from(learnerProfiles)
    .where(sql`json_extract(${learnerProfiles.experiments}, ${path}) IS NOT NULL`)
    .groupBy(sql`json_extract(${learnerProfiles.experiments}, ${path})`);

  return rows
    .filter((r) => typeof r.variant === "string" && r.variant.length > 0)
    .map((r) => ({
      variantKey: String(r.variant),
      count: Number(r.cnt ?? 0),
    }));
}

// ---------------------------------------------------------------------------
// getCohortStreakAvg: variant 別 streak 平均 (aggregate-only)
// ---------------------------------------------------------------------------

/**
 * variant 別の current_streak 平均と母数を返す.
 *
 *  - SQL: `SELECT json_extract(lp.experiments, '$.<key>') AS variant,
 *                 AVG(s.current_streak) AS avg_streak,
 *                 COUNT(*) AS n
 *           FROM learner_profiles lp
 *           JOIN streaks s ON s.learner_id = lp.id
 *           WHERE json_extract(lp.experiments, '$.<key>') IS NOT NULL
 *           GROUP BY variant`
 *  - learner_id を SELECT 句から構造的に排除 (DEC-003 / DEC-066).
 */
export async function getCohortStreakAvg(
  experimentKey: string,
): Promise<{ variantKey: string; avgStreak: number; n: number }[]> {
  if (typeof experimentKey !== "string" || experimentKey.length === 0) {
    throw new Error(
      "[experiments/assignment] getCohortStreakAvg: experimentKey required",
    );
  }
  const path = jsonPathFor(experimentKey);
  // eslint-disable-next-line no-restricted-syntax -- admin/experiments aggregate-only (DEC-003 / DEC-066)
  const rows = await db
    .select({
      variant: sql<string | null>`json_extract(${learnerProfiles.experiments}, ${path})`,
      avgStreak: sql<number>`AVG(${streaks.currentStreak})`,
      n: sql<number>`COUNT(*)`,
    })
    .from(learnerProfiles)
    .innerJoin(streaks, eq(streaks.learnerId, learnerProfiles.id))
    .where(sql`json_extract(${learnerProfiles.experiments}, ${path}) IS NOT NULL`)
    .groupBy(sql`json_extract(${learnerProfiles.experiments}, ${path})`);

  return rows
    .filter((r) => typeof r.variant === "string" && r.variant.length > 0)
    .map((r) => ({
      variantKey: String(r.variant),
      avgStreak: Number(r.avgStreak ?? 0),
      n: Number(r.n ?? 0),
    }));
}

// ---------------------------------------------------------------------------
// 公開 catalog 参照 (admin/kpi.ts から再利用しやすいように re-export)
// ---------------------------------------------------------------------------

export { EXPERIMENTS };
export type { ExperimentKey };
