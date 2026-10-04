import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const child = spawn(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "tests/integration"],
  {
    stdio: "inherit",
    env: { ...process.env, RUN_DB_TESTS: "true" },
  },
);
child.on("error", () => {
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
