import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "playwright-report/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      // PRJ-016 三層認可防衛 (DEC-003): 生 db.select() は禁止、scopedQueries 経由必須
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='db'][callee.property.name='select']",
          message:
            "PRJ-016 三層認可: 生の db.select() は禁止。src/lib/db/scoped.ts の scopedQueries(familyId) ヘルパを使用してください (DEC-003 三層認可防衛)。",
        },
      ],
    },
  },
  {
    // 認可ガード自身は scopedQueries を使えない (循環するため)
    // learner/repository.ts は parent userId から family を解決する認可層 (W6 / F-3)
    files: [
      "src/lib/auth/guards.ts",
      "src/lib/db/scoped.ts",
      "src/lib/learner/repository.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // 運用 / バルク管理スクリプト (CLI) は family スコープ外 = 全件横断で動く設計。
    // 認可チェックは元々対象外なので、生 db.select() を許容する。
    // 例: db-stats / db-coverage / seed-problems-runner / generate-explanations etc.
    files: ["scripts/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];

export default config;
