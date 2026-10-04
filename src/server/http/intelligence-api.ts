import { reviewSuggestion } from "@/server/services/suggestions";
import { z } from "zod";
import { limit } from "@/server/auth";
import { db } from "@/server/db";
import { APIError, jsonBody } from "@/server/errors";
import {
  startOAuth,
  finishOAuth,
  disconnect,
} from "@/server/integrations/gmail";
import { requestSync } from "@/server/jobs/gmail-sync";
import { canonicalSkill } from "@/lib/skills-intelligence";
import {
  generateNotifications,
  searchIntelligence,
} from "@/server/services/intelligence";

export async function intelligenceAPI(
  request: Request,
  userId: string,
  path: string[],
): Promise<Response | null> {
  const [resource, id, child] = path,
    method = request.method,
    params = new URL(request.url).searchParams;
  if (resource === "intelligence" && method === "GET")
    return Response.json(await searchIntelligence(userId));
  if (resource === "skills" && method === "PUT") {
    const input = z
      .object({
        skills: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(80),
              proficiency: z.enum([
                "Learning",
                "Familiar",
                "Proficient",
                "Strong",
              ]),
            }),
          )
          .max(200),
        experienceYears: z.number().min(0).max(80),
        education: z.enum(["", "Bachelor", "Master", "Doctorate"]),
        staleDays: z.number().int().min(8).max(180),
      })
      .parse(await jsonBody(request));
    const names = new Set<string>();
    const skills = input.skills
      .map((s) => ({ ...s, name: canonicalSkill(s.name) }))
      .filter((s) => {
        if (names.has(s.name)) return false;
        names.add(s.name);
        return true;
      });
    await db.$transaction([
      db.userSkill.deleteMany({ where: { userId } }),
      db.userSkill.createMany({ data: skills.map((s) => ({ ...s, userId })) }),
      db.searchProfile.upsert({
        where: { userId },
        create: {
          userId,
          experienceYears: input.experienceYears,
          education: input.education,
          staleDays: input.staleDays,
        },
        update: {
          experienceYears: input.experienceYears,
          education: input.education,
          staleDays: input.staleDays,
        },
      }),
    ]);
    return Response.json({ ok: true });
  }
  if (resource === "gmail") {
    if (id === "oauth" && child === "callback" && method === "GET") {
      try {
        await finishOAuth(userId, params);
      } catch {
        return Response.redirect(
          `${process.env.APP_URL}/app/settings?gmail=error`,
        );
      }
      return Response.redirect(
        `${process.env.APP_URL}/app/settings?gmail=connected`,
      );
    }
    if (id === "connect" && method === "POST") {
      await limit(`gmail-connect:${userId}`, 10, 600000);
      return Response.json({ url: await startOAuth(userId) });
    }
    if (id === "demo" && method === "POST") {
      const existing = await db.emailConnection.findUnique({
        where: { userId },
      });
      if (existing?.mode === "google")
        throw new APIError(
          409,
          "Disconnect real Gmail before trying the demo.",
        );
      await db.emailConnection.upsert({
        where: { userId },
        create: {
          userId,
          mode: "demo",
          account: "Demo inbox · fictional messages",
        },
        update: { mode: "demo", state: "connected" },
      });
      await requestSync(userId);
      return Response.json({ ok: true });
    }
    if (id === "disconnect" && method === "POST") {
      await disconnect(userId);
      return Response.json({ ok: true });
    }
    if (id === "sync" && method === "POST") {
      await limit(`gmail-sync:${userId}`, 30, 3600000);
      await requestSync(userId);
      return Response.json({ ok: true, queued: true }, { status: 202 });
    }
    if (id === "status" && method === "GET") {
      const [connection, sync] = await Promise.all([
        db.emailConnection.findUnique({
          where: { userId },
          select: { mode: true, account: true, state: true, connectedAt: true },
        }),
        db.syncState.findUnique({ where: { userId } }),
      ]);
      return Response.json({
        connection,
        sync,
        configured: !!(
          process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GMAIL_TOKEN_KEY
        ),
      });
    }
  }
  if (resource === "inbox" && method === "GET") {
    const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .parse(params.get("page") || 1),
      category = params.get("category"),
      review = params.get("review") === "true";
    const where = {
      userId,
      ...(category ? { category } : {}),
      ...(review ? { actions: { some: { decision: "pending" } } } : {}),
    };
    const [items, total, apps, connection] = await Promise.all([
      db.emailMessageMetadata.findMany({
        where,
        include: {
          actions: true,
          application: { select: { id: true, company: true, position: true } },
        },
        orderBy: { receivedAt: "desc" },
        take: 20,
        skip: (page - 1) * 20,
      }),
      db.emailMessageMetadata.count({ where }),
      db.application.findMany({
        where: { userId },
        select: { id: true, company: true, position: true },
        orderBy: { company: "asc" },
      }),
      db.emailConnection.findUnique({
        where: { userId },
        select: { account: true },
      }),
    ]);
    return Response.json({
      items,
      account: connection?.account || "",
      total,
      page,
      pages: Math.ceil(total / 20),
      apps,
    });
  }
  if (resource === "inbox" && id && method === "PATCH") {
    const input = z
      .object({ applicationId: z.string().min(1) })
      .parse(await jsonBody(request));
    const app = await db.application.findFirst({
      where: { id: input.applicationId, userId },
    });
    if (!app) throw new APIError(404, "Case not found.");
    const result = await db.emailMessageMetadata.updateMany({
      where: { id, userId },
      data: { applicationId: app.id, company: app.company, role: app.position },
    });
    if (!result.count) throw new APIError(404, "Message not found.");
    return Response.json({ ok: true });
  }
  if (resource === "suggestions" && id && method === "POST") {
    const input = z
      .object({
        decision: z.enum(["approved", "dismissed"]),
        details: z.record(z.unknown()).optional(),
      })
      .parse(await jsonBody(request));
    const result = await reviewSuggestion(userId, id, input);
    return Response.json(result);
  }
  if (resource === "notifications") {
    if (method === "GET") {
      await generateNotifications(userId);
      return Response.json(
        await db.notification.findMany({
          where: { userId, dismissedAt: null },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      );
    }
    if (method === "PATCH") {
      const data = z
        .object({ action: z.enum(["read", "dismiss", "all-read"]) })
        .parse(await jsonBody(request));
      await db.notification.updateMany({
        where: {
          userId,
          ...(data.action !== "all-read" ? { id: id || "" } : {}),
        },
        data:
          data.action === "dismiss"
            ? { dismissedAt: new Date() }
            : { readAt: new Date() },
      });
      return Response.json({ ok: true });
    }
  }
  if (resource === "privacy" && method === "DELETE") {
    const input = z
      .object({
        scope: z.enum(["email", "all"]),
        confirmation: z.literal("DELETE"),
      })
      .parse(await jsonBody(request));
    await disconnect(userId);
    await db.$transaction([
      db.emailMessageMetadata.deleteMany({ where: { userId } }),
      db.activity.deleteMany({
        where: { application: { userId }, source: "Gmail" },
      }),
      db.notification.deleteMany({ where: { userId } }),
      ...(input.scope === "all"
        ? [
            db.application.deleteMany({ where: { userId } }),
            db.userSkill.deleteMany({ where: { userId } }),
            db.searchProfile.deleteMany({ where: { userId } }),
          ]
        : []),
    ]);
    return Response.json({ ok: true });
  }
  return null;
}
