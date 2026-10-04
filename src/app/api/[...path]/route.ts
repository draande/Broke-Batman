import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import {
  checkOrigin,
  createSession,
  requireUser,
  logout,
  limit,
} from "@/server/auth";
import { APIError, errorResponse, jsonBody } from "@/server/errors";
import {
  listApplications,
  saveApplication,
  changeStatus,
} from "@/server/applications";
import { ownedApplication } from "@/server/repository";
import {
  interviewSchema,
  followUpSchema,
  contactSchema,
  preferenceSchema,
  webURL,
} from "@/lib/validation";
import { computeAnalytics } from "@/lib/analytics";
import { analyzePosting } from "@/server/extraction";
import { seedDemo, ensureStatuses } from "@/server/seed";
import { exportData, previewCSV } from "@/server/transfers";
import { intelligenceAPI } from "@/server/intelligence-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(12)
    .max(72)
    .refine(
      (v) => Buffer.byteLength(v, "utf8") <= 72,
      "Password must be at most 72 UTF-8 bytes.",
    ),
  name: z.string().trim().min(1).max(100).optional(),
});
async function handler(request: Request, context: Context): Promise<Response> {
  try {
    checkOrigin(request);
    const { path } = await context.params;
    const [resource, id, child, childId] = path;
    const method = request.method,
      params = new URL(request.url).searchParams;
    if (resource === "auth" && method === "POST") {
      if (id === "logout") {
        await logout();
        return Response.json({ ok: true });
      }
      if (id === "demo") {
        if (
          process.env.NODE_ENV === "production" &&
          process.env.DEMO_ENABLED !== "true"
        )
          throw new APIError(
            403,
            "Demo creation is disabled on this deployment.",
          );
        await limit("public-demo", 30, 3600000);
        const user = await db.user.create({
          data: {
            email: `demo-${randomBytes(12).toString("hex")}@demo.example`,
            name: "Bruce",
            passwordHash: await hash(randomBytes(32).toString("hex"), 12),
            preference: { create: {} },
          },
        });
        await seedDemo(db, user.id);
        await createSession(user.id);
        return Response.json({ ok: true });
      }
      if (!["login", "register"].includes(id))
        throw new APIError(404, "Route not found.");
      const input = credentials.parse(await jsonBody(request));
      await limit(`auth:${input.email}`, 10, 15 * 60000);
      await limit("auth:global", 300, 15 * 60000);
      let user = await db.user.findUnique({ where: { email: input.email } });
      if (id === "register") {
        if (!input.name) throw new APIError(422, "Please enter your name.");
        if (user)
          throw new APIError(
            409,
            "This email is already registered. Please sign in.",
          );
        await ensureStatuses(db);
        user = await db.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash: await hash(input.password, 12),
            preference: { create: {} },
          },
        });
      } else {
        const valid = await compare(
          input.password,
          user?.passwordHash ||
            "$2b$12$Y3PWRGJz9M9IGsgWpFASeur.BqbBe16zbFKwu9.bwTEHU3zLnQlBi",
        );
        if (!user || !valid)
          throw new APIError(401, "Email or password is incorrect.");
      }
      await createSession(user!.id);
      return Response.json(
        { ok: true },
        { status: id === "register" ? 201 : 200 },
      );
    }
    const user = await requireUser();
    const userId = user.id;
    const intelligenceResponse = await intelligenceAPI(request, userId, path);
    if (intelligenceResponse) return intelligenceResponse;
    if (resource === "bootstrap" && method === "GET") {
      const [apps, statuses, activity, interviews, followUps] =
        await Promise.all([
          db.application.findMany({
            where: { userId, archivedAt: null },
            include: { status: true, history: true },
          }),
          db.status.findMany({ orderBy: { order: "asc" } }),
          db.activity.findMany({
            where: { application: { userId } },
            include: {
              application: {
                select: { id: true, company: true, position: true },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          }),
          db.interview.findMany({
            where: {
              application: { userId, archivedAt: null },
            },
            include: {
              application: {
                select: { id: true, company: true, position: true },
              },
            },
            orderBy: { startsAt: "asc" },
          }),
          db.followUp.findMany({
            where: { application: { userId, archivedAt: null } },
            include: {
              application: {
                select: { id: true, company: true, position: true },
              },
            },
            orderBy: { dueAt: "asc" },
          }),
        ]);
      return Response.json({
        user,
        statuses,
        analytics: computeAnalytics(
          apps,
          new Date(),
          user.preference?.timezone,
        ),
        activity,
        interviews,
        followUps,
        deadlines: apps
          .filter((a) => a.applicationDeadline)
          .map((a) => ({
            id: a.id,
            company: a.company,
            position: a.position,
            dueAt: a.applicationDeadline,
          })),
        choices: {
          companies: [...new Set(apps.map((a) => a.company))],
          locations: [...new Set(apps.map((a) => a.location))],
          sources: [...new Set(apps.map((a) => a.source))],
        },
      });
    }
    if (resource === "analytics" && method === "GET") {
      const apps = await db.application.findMany({
        where: { userId, archivedAt: null },
        include: { status: true, history: true },
      });
      return Response.json(
        computeAnalytics(apps, new Date(), user.preference?.timezone),
      );
    }
    if (resource === "preferences" && method === "PUT") {
      const data = preferenceSchema.parse(await jsonBody(request));
      return Response.json(
        await db.userPreference.upsert({
          where: { userId },
          create: { userId, ...data },
          update: data,
        }),
      );
    }
    if (resource === "extract" && method === "POST") {
      await limit(`extract:${userId}`, 30, 3600000);
      const input = z
        .object({
          url: webURL.optional(),
          text: z.string().max(100000).optional(),
        })
        .refine((v) => !!v.url !== !!v.text, "Provide either a URL or text.")
        .parse(await jsonBody(request));
      return Response.json(await analyzePosting(input));
    }
    if (resource === "export" && method === "GET")
      return exportData(userId, params.get("format") || "csv");
    if (resource === "import" && method === "POST") {
      const input = z
        .object({
          csv: z.string().max(1000000),
          mapping: z.record(z.string()).default({}),
          commit: z.boolean().default(false),
          allowDuplicate: z.boolean().default(false),
        })
        .parse(await jsonBody(request));
      const preview = previewCSV(input.csv, input.mapping);
      if (!input.commit) return Response.json(preview);
      if (!preview.valid)
        throw new APIError(
          422,
          "Correct invalid rows before importing.",
          preview.rows.filter((r) => r.errors.length),
        );
      await limit(`import:${userId}`, 10, 3600000);
      const results = [];
      for (const row of preview.rows) {
        try {
          const app = await saveApplication(userId, {
            ...row.data,
            allowDuplicate: input.allowDuplicate,
          });
          results.push({ row: row.row, id: app.id, error: null });
        } catch (error) {
          results.push({
            row: row.row,
            id: null,
            error: error instanceof Error ? error.message : "Import failed",
          });
        }
      }
      return Response.json({
        imported: results.filter((r) => r.id).length,
        results,
      });
    }
    if (resource === "applications") {
      if (!id) {
        if (method === "GET")
          return Response.json(await listApplications(userId, params));
        if (method === "POST")
          return Response.json(
            await saveApplication(userId, await jsonBody(request)),
            { status: 201 },
          );
      }
      if (id === "bulk" && method === "POST") {
        const input = z
          .object({
            ids: z.array(z.string()).min(1).max(100),
            action: z.enum(["archive", "restore", "delete"]),
          })
          .parse(await jsonBody(request));
        const where = { id: { in: input.ids }, userId };
        const count = await db.application.count({ where });
        if (count !== new Set(input.ids).size)
          throw new APIError(404, "One or more cases were not found.");
        await db.$transaction(async (tx) => {
          if (input.action === "delete")
            await tx.application.deleteMany({ where });
          else {
            await tx.application.updateMany({
              where,
              data: {
                archivedAt: input.action === "archive" ? new Date() : null,
              },
            });
            await tx.activity.createMany({
              data: input.ids.map((applicationId) => ({
                applicationId,
                message:
                  input.action === "archive"
                    ? "Case archived"
                    : "Case restored",
              })),
            });
          }
        });
        return Response.json({ ok: true, count });
      }
      if (!id) throw new APIError(405, "Method not allowed.");
      const app = await ownedApplication(userId, id);
      if (!child) {
        if (method === "GET") return Response.json(app);
        if (method === "PUT")
          return Response.json(
            await saveApplication(userId, await jsonBody(request), id),
          );
        if (method === "DELETE") {
          await db.application.delete({ where: { id, userId } });
          return Response.json({ ok: true });
        }
        if (method === "PATCH") {
          const input = z
            .object({
              statusId: z.string().max(80).optional(),
              archived: z.boolean().optional(),
            })
            .refine((v) => v.statusId !== undefined || v.archived !== undefined)
            .parse(await jsonBody(request));
          if (input.statusId) await changeStatus(userId, id, input.statusId);
          if (input.archived !== undefined)
            await db.$transaction([
              db.application.update({
                where: { id, userId },
                data: { archivedAt: input.archived ? new Date() : null },
              }),
              db.activity.create({
                data: {
                  applicationId: id,
                  message: input.archived ? "Case archived" : "Case restored",
                },
              }),
            ]);
          return Response.json(await ownedApplication(userId, id));
        }
      }
      if (["interviews", "follow-ups", "contacts", "notes"].includes(child)) {
        const owner = { applicationId: id, application: { userId } };
        if (method === "POST" && !childId) {
          const input = await jsonBody(request);
          const created = await db.$transaction(async (tx) => {
            if (child === "interviews") {
              const record = await tx.interview.create({
                data: { ...interviewSchema.parse(input), applicationId: id },
              });
              await tx.activity.create({
                data: {
                  applicationId: id,
                  message: `${record.type} interview scheduled`,
                },
              });
              return record;
            }
            if (child === "follow-ups") {
              const record = await tx.followUp.create({
                data: { ...followUpSchema.parse(input), applicationId: id },
              });
              await tx.activity.create({
                data: {
                  applicationId: id,
                  message: `Follow-up scheduled: ${record.title}`,
                },
              });
              return record;
            }
            if (child === "contacts") {
              const record = await tx.contact.create({
                data: { ...contactSchema.parse(input), applicationId: id },
              });
              await tx.activity.create({
                data: {
                  applicationId: id,
                  message: `Contact added: ${record.name}`,
                },
              });
              return record;
            }
            const data = z
              .object({ body: z.string().trim().min(1).max(20000) })
              .parse(input);
            const record = await tx.note.create({
              data: { ...data, applicationId: id },
            });
            await tx.activity.create({
              data: { applicationId: id, message: "Note added" },
            });
            return record;
          });
          return Response.json(created, { status: 201 });
        }
        if (childId && method === "PUT") {
          const input = await jsonBody(request);
          if (child === "interviews") {
            const data = interviewSchema.parse(input);
            const result = await db.interview.updateMany({
              where: { id: childId, ...owner },
              data,
            });
            if (!result.count) throw new APIError(404, "Interview not found.");
          }
          if (child === "follow-ups") {
            const data = z.object({ completed: z.boolean() }).parse(input);
            const result = await db.followUp.updateMany({
              where: { id: childId, ...owner },
              data: { completedAt: data.completed ? new Date() : null },
            });
            if (!result.count) throw new APIError(404, "Follow-up not found.");
          }
          if (child === "contacts") {
            const result = await db.contact.updateMany({
              where: { id: childId, ...owner },
              data: contactSchema.parse(input),
            });
            if (!result.count) throw new APIError(404, "Contact not found.");
          }
          if (child === "notes") {
            const result = await db.note.updateMany({
              where: { id: childId, ...owner },
              data: z
                .object({ body: z.string().trim().min(1).max(20000) })
                .parse(input),
            });
            if (!result.count) throw new APIError(404, "Note not found.");
          }
          await db.activity.create({
            data: {
              applicationId: id,
              message: `${child === "follow-ups" ? "Follow-up" : child === "notes" ? "Note" : child === "contacts" ? "Contact" : "Interview"} updated`,
            },
          });
          return Response.json({ ok: true });
        }
        if (childId && method === "DELETE") {
          const where = { id: childId, ...owner };
          const result =
            child === "interviews"
              ? await db.interview.deleteMany({ where })
              : child === "follow-ups"
                ? await db.followUp.deleteMany({ where })
                : child === "contacts"
                  ? await db.contact.deleteMany({ where })
                  : await db.note.deleteMany({ where });
          if (!result.count) throw new APIError(404, "Record not found.");
          await db.activity.create({
            data: { applicationId: id, message: `${child} record removed` },
          });
          return Response.json({ ok: true });
        }
      }
    }
    throw new APIError(404, "Route not found.");
  } catch (error) {
    return errorResponse(error);
  }
}
async function privateResponse(request: Request, context: Context) {
  const response = await handler(request, context);
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}
export const GET = privateResponse,
  POST = privateResponse,
  PUT = privateResponse,
  PATCH = privateResponse,
  DELETE = privateResponse;
