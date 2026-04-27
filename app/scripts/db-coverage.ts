/**
 * Per-(level, skill) explanation coverage breakdown.
 * 一時調査用。CEO trust-but-verify。
 */
import { db } from "../src/lib/db/client";
import { problems, problemExplanations } from "../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      levelId: problems.levelId,
      skillId: problems.skillId,
      total: sql<number>`count(*)`.as("total"),
      withExp: sql<number>`sum(case when ${problemExplanations.problemId} is not null then 1 else 0 end)`.as("withExp"),
    })
    .from(problems)
    .leftJoin(problemExplanations, eq(problems.id, problemExplanations.problemId))
    .groupBy(problems.levelId, problems.skillId)
    .orderBy(problems.levelId, problems.skillId);

  console.log("[db-coverage] per (level, skill):");
  for (const r of rows) {
    const pct = Number(r.total) > 0 ? ((Number(r.withExp) / Number(r.total)) * 100).toFixed(1) : "0.0";
    console.log(`  ${r.levelId} / ${r.skillId}: ${r.withExp}/${r.total} (${pct}%)`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
