import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
let stopped = false;
const demoOnly = process.argv.includes("--demo-only");
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
async function work() {
  const { db } = await import("@/server/db");
  const { runSyncJob } = await import("@/server/jobs/gmail-sync");
  while (!stopped) {
    const jobs = await db.syncState.findMany({
      where: {
        ...(demoOnly ? { user: { emailConnection: { mode: "demo" } } } : {}),
        OR: [
          { status: "queued" },
          { status: "running", leaseUntil: { lt: new Date() } },
        ],
      },
      take: 10,
    });
    for (const job of jobs) await runSyncJob(job.userId, demoOnly);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  await db.$disconnect();
}
work().catch(() => {
  console.error(
    "Mail worker stopped. Restart after checking database connectivity.",
  );
  process.exitCode = 1;
});
