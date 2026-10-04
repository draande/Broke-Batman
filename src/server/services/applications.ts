import { canonicalSkill } from "@/lib/skills-intelligence";
import { caseHealth } from "@/lib/case-health";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { applicationSchema } from "@/schemas/forms";
import { likelyDuplicate } from "@/lib/duplicates";
import { db } from "@/server/db";
import { APIError } from "@/server/errors";
import {
  applicationInclude,
  ownedApplication,
} from "@/server/repositories/applications";
export async function saveApplication(
  userId: string,
  input: unknown,
  id?: string,
) {
  const data = applicationSchema.parse(input);
  const old = id ? await ownedApplication(userId, id) : null;
  const status = await db.status.findUnique({ where: { id: data.statusId } });
  if (!status) throw new APIError(422, "Unknown status.");
  if (!id && !data.allowDuplicate) {
    const existing = await db.application.findMany({
      where: { userId },
      select: {
        id: true,
        company: true,
        position: true,
        jobPostingURL: true,
        jobDescription: true,
        createdAt: true,
        status: true,
        source: true,
      },
    });
    const duplicates = existing.filter((a) => likelyDuplicate(data, a));
    if (duplicates.length)
      throw new APIError(
        409,
        "This case may already be in the Batcomputer.",
        duplicates.map((a) => ({
          id: a.id,
          company: a.company,
          position: a.position,
          status: a.status.label,
          source: a.source,
          age: Math.floor((Date.now() - +a.createdAt) / 86400000),
        })),
      );
  }
  const {
    requiredSkills,
    preferredSkills,
    notes,
    contactName,
    contactEmail,
    recruiterName,
    recruiterEmail,
    allowDuplicate: _allow,
    ...fields
  } = data;
  void _allow;
  if (!fields.dateApplied && !["saved", "preparing"].includes(fields.statusId))
    fields.dateApplied = new Date();
  return db.$transaction(async (tx) => {
    const app = old
      ? await tx.application.update({
          where: { id: old.id, userId },
          data: fields,
        })
      : await tx.application.create({ data: { ...fields, userId } });
    if (!old || old.statusId !== fields.statusId) {
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: app.id,
          fromStatus: old?.statusId,
          toStatus: fields.statusId,
        },
      });
      await tx.activity.create({
        data: {
          applicationId: app.id,
          message: old
            ? `Status changed from ${old.status.label} to ${status.label}`
            : `Case opened · ${status.label}`,
        },
      });
    } else
      await tx.activity.create({
        data: { applicationId: app.id, message: "Case information updated" },
      });
    await tx.applicationSkill.deleteMany({ where: { applicationId: app.id } });
    const skillNames = [
      ...new Set(
        [...requiredSkills, ...preferredSkills].map((s) => canonicalSkill(s)),
      ),
    ];
    for (const name of skillNames) {
      const skill = await tx.skill.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      await tx.applicationSkill.create({
        data: {
          applicationId: app.id,
          skillId: skill.id,
          preferred: !requiredSkills
            .map((s) => canonicalSkill(s))
            .includes(name),
        },
      });
    }
    if (notes) {
      await tx.note.create({ data: { applicationId: app.id, body: notes } });
      await tx.activity.create({
        data: { applicationId: app.id, message: "Note added" },
      });
    }
    for (const [name, email, role] of [
      [contactName, contactEmail, "Contact"],
      [recruiterName, recruiterEmail, "Recruiter"],
    ])
      if (name)
        await tx.contact.create({
          data: {
            applicationId: app.id,
            name,
            email: email || "",
            role: role!,
          },
        });
    return tx.application.findUniqueOrThrow({
      where: { id: app.id },
      include: applicationInclude,
    });
  });
}
export async function changeStatus(
  userId: string,
  id: string,
  statusId: string,
) {
  await ownedApplication(userId, id);
  const status = await db.status.findUnique({ where: { id: statusId } });
  if (!status) throw new APIError(422, "Unknown status.");
  return db.$transaction(async (tx) => {
    const app = await tx.application.findFirstOrThrow({
      where: { id, userId },
      include: { status: true },
    });
    if (app.statusId !== statusId) {
      await tx.application.update({
        where: { id, userId },
        data: {
          statusId,
          dateApplied:
            app.dateApplied ||
            (!["saved", "preparing"].includes(statusId) ? new Date() : null),
        },
      });
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: app.statusId,
          toStatus: statusId,
        },
      });
      await tx.activity.create({
        data: {
          applicationId: id,
          message: `Status changed from ${app.status.label} to ${status.label}`,
        },
      });
    }
    return tx.application.findUniqueOrThrow({
      where: { id, userId },
      include: applicationInclude,
    });
  });
}
export async function listApplications(
  userId: string,
  params: URLSearchParams,
) {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .parse(params.get("page") || 1);
  const pageSize = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .parse(params.get("pageSize") || 20);
  const q = (params.get("q") || "").slice(0, 200);
  const where: Prisma.ApplicationWhereInput = {
    userId,
    archivedAt:
      params.get("archived") === "all"
        ? undefined
        : params.get("archived") === "true"
          ? { not: null }
          : null,
  };
  if (q)
    where.OR = [
      ...[
        "company",
        "position",
        "jobDescription",
        "location",
        "source",
        "experienceRequirements",
      ].map((field) => ({ [field]: { contains: q, mode: "insensitive" } })),
      { notes: { some: { body: { contains: q, mode: "insensitive" } } } },
      {
        contacts: {
          some: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        skills: {
          some: { skill: { name: { contains: q, mode: "insensitive" } } },
        },
      },
    ];
  for (const field of [
    "statusId",
    "company",
    "location",
    "workMode",
    "employmentType",
    "source",
  ])
    if (params.get(field)) Object.assign(where, { [field]: params.get(field) });
  if (params.get("from") || params.get("to")) {
    const from = params.get("from") ? new Date(params.get("from")!) : undefined,
      to = params.get("to")
        ? new Date(`${params.get("to")}T23:59:59.999Z`)
        : undefined;
    if ((from && isNaN(+from)) || (to && isNaN(+to)))
      throw new APIError(422, "Invalid date filter");
    where.dateApplied = { gte: from, lte: to };
  }
  const sort = z
    .enum(["company", "position", "createdAt", "dateApplied", "updatedAt"])
    .parse(params.get("sort") || "createdAt");
  const direction = z
    .enum(["asc", "desc"])
    .parse(params.get("direction") || "desc");
  const [items, total] = await db.$transaction([
    db.application.findMany({
      where,
      include: applicationInclude,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ [sort]: direction }, { id: "asc" }],
    }),
    db.application.count({ where }),
  ]);
  const [profile, pending] = await Promise.all([
    db.searchProfile.findUnique({ where: { userId } }),
    db.emailMessageMetadata.findMany({
      where: { userId, actions: { some: { decision: "pending" } } },
      select: { applicationId: true },
    }),
  ]);
  return {
    items: items.map((a) => ({
      ...a,
      health: caseHealth(
        a,
        profile?.staleDays || 21,
        pending.some((m) => m.applicationId === a.id),
      ),
    })),
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
  };
}
