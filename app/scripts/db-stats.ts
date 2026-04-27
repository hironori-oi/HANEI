/**
 * scripts/db-stats.ts (運用 / 検証用)
 *
 * 用途:
 *   AI バルク生成 (ai:generate-explanations / ai:generate-tts) の完了後に、
 *   DB 上のレコード件数を CEO / オーナー両者で同じ数字でクロスチェックするための
 *   軽量 SELECT スクリプト。
 *
 *   - problems          : seed-problems-runner で投入済の問題総数
 *   - problem_explanations: ai:generate-explanations が書き込む解説数
 *
 *   実 OpenAI API / R2 PUT は一切呼ばないため、Agent 側からも安全に実行できる。
 *
 * 実行: `npm run db:stats`
 */
import { db } from "../src/lib/db/client";
import {
  problems,
  problemExplanations,
} from "../src/lib/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  // 接続先表示 (DEC-028 と同方針)
  const dbUrl = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
  const dbKind =
    dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")
      ? "TURSO (remote)"
      : dbUrl.startsWith("file:")
        ? "LOCAL SQLite file"
        : "UNKNOWN";
  const safeUrl = dbUrl.replace(
    /(authToken|password|token)=[^&]*/gi,
    "$1=<REDACTED>",
  );
  console.log(`[db-stats] connection: kind=${dbKind} url=${safeUrl}`);
  console.log("");

  // 1. 件数集計
  const [problemCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(problems);
  const [explanationCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(problemExplanations);

  console.log("[db-stats] table counts:");
  console.log(`  problems              = ${problemCount?.c ?? 0}`);
  console.log(`  problem_explanations  = ${explanationCount?.c ?? 0}`);
  console.log("");

  // 2. problems を levelId/skillId 別にブレイクダウン
  const breakdown = await db
    .select({
      levelId: problems.levelId,
      skillId: problems.skillId,
      c: sql<number>`count(*)`,
    })
    .from(problems)
    .groupBy(problems.levelId, problems.skillId)
    .orderBy(problems.levelId, problems.skillId);

  console.log("[db-stats] problems breakdown by (levelId, skillId):");
  for (const row of breakdown) {
    console.log(`  ${row.levelId} / ${row.skillId}  = ${row.c}`);
  }
  console.log("");

  // 3. explanation 未生成の問題数 (= 解説バルク生成の残)
  const missing = await db
    .select({ c: sql<number>`count(*)` })
    .from(problems)
    .leftJoin(
      problemExplanations,
      sql`${problemExplanations.problemId} = ${problems.id}`,
    )
    .where(sql`${problemExplanations.id} IS NULL`);

  console.log(
    `[db-stats] problems WITHOUT explanation = ${missing[0]?.c ?? 0}`,
  );
  console.log("");

  // 4. 完了率
  const total = problemCount?.c ?? 0;
  const done = explanationCount?.c ?? 0;
  const ratio = total > 0 ? ((done / total) * 100).toFixed(1) : "n/a";
  console.log(`[db-stats] explanation coverage = ${done}/${total} (${ratio}%)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
