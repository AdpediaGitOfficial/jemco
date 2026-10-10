import { defineConfig } from "vitest/config";
/** Black-box API tests: a real server on a fresh database. Files run one at a time; tests inside a file run in order. */
export default defineConfig({
  test: {
    include: ["test/**/*.e2e.spec.ts"],
    globalSetup: ["test/setup.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 120_000,
    environment: "node",
  },
});
