import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  resolve: { alias: { "@": resolve("src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://batman:batman@127.0.0.1:5432/broke_batman?schema=public",
    },
  },
});
