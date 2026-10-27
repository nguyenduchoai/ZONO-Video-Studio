import { defineConfig } from "vitest/config";

// Only this system's tests — services/zl-crm has its own test suite.
export default defineConfig({
  test: { include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "evals/**/*.test.ts"], exclude: ["**/node_modules/**", "services/**"] },
});
