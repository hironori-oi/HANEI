import { createClient } from "@libsql/client";

async function main() {
const c = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const r = await c.execute(`
  SELECT
    p.skill_id,
    COUNT(p.id) as total_problems,
    COUNT(e.problem_id) as with_explanation
  FROM problems p
  LEFT JOIN problem_explanations e ON e.problem_id = p.id
  WHERE p.skill_id LIKE '%-4' OR p.skill_id LIKE '%-3'
  GROUP BY p.skill_id
  ORDER BY p.skill_id
`);

console.log("[B-2 progress: 4/3 level explanations]");
let totalProblems = 0;
let totalCovered = 0;
for (const row of r.rows) {
  const t = Number(row.total_problems);
  const c2 = Number(row.with_explanation);
  totalProblems += t;
  totalCovered += c2;
  const pct = ((c2 / t) * 100).toFixed(1);
  console.log(
    `  ${String(row.skill_id).padEnd(20)} ${c2}/${t} (${pct}%)`,
  );
}
console.log(
  `  --- TOTAL ${totalCovered}/${totalProblems} (${((totalCovered / totalProblems) * 100).toFixed(1)}%)`,
);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
