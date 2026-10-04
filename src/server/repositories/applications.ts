import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { APIError } from "@/server/errors";
export const applicationInclude = {
  status: true,
  history: { orderBy: { createdAt: "asc" as const } },
  interviews: { orderBy: { startsAt: "asc" as const } },
  followUps: { orderBy: { dueAt: "asc" as const } },
  contacts: true,
  notes: { orderBy: { createdAt: "desc" as const } },
  skills: { include: { skill: true } },
  activities: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ApplicationInclude;
export async function ownedApplication(userId: string, id: string) {
  const app = await db.application.findFirst({
    where: { id, userId },
    include: applicationInclude,
  });
  if (!app) throw new APIError(404, "Case not found.");
  return app;
}
