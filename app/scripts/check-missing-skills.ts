/**
 * 一時調査: 12 (level x skill) コンボのうち problems が 0 件の組合せを特定する。
 * adventure map は 3 levels × 4 skills = 12 areas を表示する。
 * - vocabulary, grammar, reading, listening (writing は除外)
 * - eiken-5/4/3
 */
import { db } from "../src/lib/db/client";
import { problems } from "../src/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

const LEVELS = ["5", "4", "3"] as const;
const SKILLS = ["vocabulary", "grammar", "reading", "listening"] as const;

async function main() {
  console.log("[check-missing-skills] adventure map 12 area coverage:");
  for (const lv of LEVELS) {
    for (const sk of SKILLS) {
      const skillId = `${sk}-${lv}`;
      const rows = await db
        .select({
          total: sql<number>`count(*)`.as("total"),
        })
        .from(problems)
        .where(and(eq(problems.levelId, lv), eq(problems.skillId, skillId)));
      const total = Number(rows[0]?.total ?? 0);
      const flag = total === 0 ? " ⚠️  MISSING" : "";
      console.log(`  ${lv} / ${skillId}: ${total} problems${flag}`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
