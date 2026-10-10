import { defineConfig } from "vitest/config";
/** Unit tests only; the Playwright journey lives in e2e/ and runs with `pnpm test:e2e`. */
export default defineConfig({ test: { include: ["src/**/*.spec.{ts,tsx}"], exclude: ["e2e/**", ".next/**", "node_modules/**"], passWithNoTests: true } });
