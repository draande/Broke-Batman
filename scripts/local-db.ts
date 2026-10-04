import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
async function main() {
  const dir = resolve(".postgres/data");
  const postgres = new EmbeddedPostgres({
    databaseDir: dir,
    user: "batman",
    password: "batman",
    port: 5432,
    persistent: true,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-h", "127.0.0.1"],
  });
  if (!existsSync(resolve(dir, "PG_VERSION"))) await postgres.initialise();
  await postgres.start();
  const client = postgres.getPgClient();
  await client.connect();
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'broke_batman'",
  );
  await client.end();
  if (!result.rowCount) await postgres.createDatabase("broke_batman");
  console.log(
    "Local PostgreSQL ready on 127.0.0.1:5432. Development credentials only. Press Ctrl+C to stop.",
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await postgres.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
