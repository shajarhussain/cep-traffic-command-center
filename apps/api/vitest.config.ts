import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    globals: true,
    fileParallelism: false,
    hookTimeout: 60_000,   // prisma db push can take ~20s on first run
    testTimeout: 30_000,
  },
});
