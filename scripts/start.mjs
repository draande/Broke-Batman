import { cp, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const server = resolve(root, ".next/standalone/server.js");
await access(server).catch(() => {
  throw new Error("Production build missing. Run npm run build first.");
});
for (const file of [".env", ".env.production", ".env.local"]) {
  const path = resolve(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}
await cp(
  resolve(root, ".next/static"),
  resolve(root, ".next/standalone/.next/static"),
  { recursive: true },
);
if (existsSync(resolve(root, "public")))
  await cp(resolve(root, "public"), resolve(root, ".next/standalone/public"), {
    recursive: true,
  });
process.env.HOSTNAME ||= "127.0.0.1";
await import(pathToFileURL(server).href);
