import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedDemo, ensureStatuses } from "@/server/demo/seed";
const db = new PrismaClient();
async function main() {
  await ensureStatuses(db);
  const password = process.env.DEMO_PASSWORD;
  if (
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 72
  )
    throw new Error(
      "Set DEMO_PASSWORD to at least 12 characters and at most 72 UTF-8 bytes to seed a demo user.",
    );
  const user = await db.user.upsert({
    where: { email: "bruce@demo.example" },
    create: {
      email: "bruce@demo.example",
      name: "Bruce",
      passwordHash: await hash(password, 12),
      preference: { create: {} },
    },
    update: {},
  });
  if (!(await db.application.count({ where: { userId: user.id } })))
    await seedDemo(db, user.id);
  console.log(
    "Demo data seeded for bruce@demo.example. Existing data was preserved.",
  );
}
main().finally(() => db.$disconnect());
