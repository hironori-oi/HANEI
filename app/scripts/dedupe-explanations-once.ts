/**
 * scripts/dedupe-explanations-once.ts (W7 / B-9 ad-hoc cleanup)
 *
 * 用途:
 *   B-9 実行中に並行 run が同 problem に対して複数 explanation を INSERT してしまった
 *   ケースを修復する 1 度限りの cleanup スクリプト。
 *
 *   - problem_explanations を problemId でグループ化
 *   - 各 problemId について最古 (generatedAt 昇順) の 1 件を残し、それ以外を DELETE
 *
 * 冪等: 既に 1 件しか無い problem は何もしない。
 */

import { db } from "../src/lib/db/client";
import { problemExplanations } from "../src/lib/db/schema";
import { sql, inArray } from "drizzle-orm";

async function main() {
  const all = await db
    .select({
      id: problemExplanations.id,
      problemId: problemExplanations.problemId,
      generatedAt: problemExplanations.generatedAt,
    })
    .from(problemExplanations)
    .orderBy(problemExplanations.problemId, problemExplanations.generatedAt);

  const groups = new Map<string, typeof all>();
  for (const row of all) {
    const list = groups.get(row.problemId) ?? [];
    list.push(row);
    groups.set(row.problemId, list);
  }

  const toDelete: string[] = [];
  for (const [, rows] of groups) {
    if (rows.length <= 1) continue;
    // keep first (oldest), delete rest
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r) toDelete.push(r.id);
    }
  }

  console.log(
    `[dedupe] total rows=${all.length} groups=${groups.size} duplicates to delete=${toDelete.length}`,
  );

  if (toDelete.length === 0) {
    console.log("[dedupe] no duplicates found.");
    return;
  }

  // バッチで削除 (大量 IN 句で SQLite が嫌がる場合に備え 200 件単位)
  const batchSize = 200;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    await db
      .delete(problemExplanations)
      .where(inArray(problemExplanations.id, batch));
    console.log(`[dedupe] deleted batch ${i}..${i + batch.length - 1}`);
  }

  // 検証
  const after = await db
    .select({ c: sql<number>`count(*)` })
    .from(problemExplanations);
  console.log(`[dedupe] after = ${after[0]?.c ?? 0} rows`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
