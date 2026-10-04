import { spawn } from "node:child_process";
// Playwright owns this supervisor. Its worker only processes fictional connections.
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const args of [
  process.env.E2E_PRODUCTION === "true"
    ? ["scripts/start.mjs"]
    : ["node_modules/next/dist/bin/next", "dev", "--webpack"],
  ["--import", "tsx", "scripts/mail-worker.ts", "--demo-only"],
]) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, DEMO_ENABLED: "true", HOSTNAME: "127.0.0.1" },
  });
  children.push(child);
  child.on("error", () => stop(1));
  child.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
}
