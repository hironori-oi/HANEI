import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/db/schema.ts", "**/*.d.ts"],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
