import { z } from "zod";
import { db } from "@/server/db";
import { APIError } from "@/server/errors";
import {
  interviewSchema,
  followUpSchema,
  contactSchema,
} from "@/schemas/forms";
export async function reviewSuggestion(
  userId: string,
  id: string,
  input: {
    decision: "approved" | "dismissed";
    details?: Record<string, unknown>;
  },
) {
  return db.$transaction(async (tx) => {
    const action = await tx.suggestedAction.findFirst({
      where: { id, message: { userId } },
      include: { message: true },
    });
    if (!action) throw new APIError(404, "Suggestion not found.");
    const claimed = await tx.suggestedAction.updateMany({
      where: { id, decision: "pending" },
      data: { decision: input.decision, decidedAt: new Date() },
    });
    if (!claimed.count)
      throw new APIError(409, "Suggestion was already reviewed.");
    const app = action.message.applicationId
      ? await tx.application.findFirst({
          where: { id: action.message.applicationId, userId },
        })
      : null;
    let resultId: string | null = null;
    if (input.decision === "approved") {
      if (!app)
        throw new APIError(
          422,
          "Link this message to one of your cases before approving.",
        );
      const payload = z.record(z.unknown()).parse(action.payload);
      if (action.kind === "status") {
        const target = await tx.status.findUnique({
          where: { id: String(payload.statusId) },
        });
        if (!target) throw new APIError(422, "Invalid status suggestion.");
        if (app.statusId !== target.id) {
          await tx.application.update({
            where: { id: app.id },
            data: {
              statusId: target.id,
              dateApplied: app.dateApplied || new Date(),
            },
          });
          await tx.applicationStatusHistory.create({
            data: {
              applicationId: app.id,
              fromStatus: app.statusId,
              toStatus: target.id,
            },
          });
        }
        resultId = app.id;
      } else if (action.kind === "interview") {
        const data = interviewSchema.parse({ ...payload, ...input.details });
        const record = await tx.interview.create({
          data: { ...data, applicationId: app.id },
        });
        resultId = record.id;
      } else if (action.kind === "contact") {
        const data = contactSchema.parse(payload);
        const existing = await tx.contact.findFirst({
          where: {
            applicationId: app.id,
            email: { equals: data.email, mode: "insensitive" },
          },
        });
        resultId =
          existing?.id ||
          (
            await tx.contact.create({
              data: { ...data, applicationId: app.id },
            })
          ).id;
      } else if (action.kind === "assessment" || action.kind === "followup") {
        const data = followUpSchema.parse({ ...payload, ...input.details });
        resultId = (
          await tx.followUp.create({
            data: { ...data, applicationId: app.id },
          })
        ).id;
      }
    }
    await tx.suggestedAction.update({ where: { id }, data: { resultId } });
    if (app)
      await tx.activity.create({
        data: {
          applicationId: app.id,
          message: `${action.kind} suggestion ${input.decision} · ${action.message.subject}`,
          source: "Gmail",
          sourceEmailId: action.message.id,
          confidence: action.message.confidence,
        },
      });
    return { ok: true, resultId };
  });
}
