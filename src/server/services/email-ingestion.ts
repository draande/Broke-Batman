import { db } from "@/server/db";
import {
  classifyEmail,
  matchEmail,
  emailActions,
  type MailInput,
} from "@/lib/email-intelligence";
export async function ingestMail(
  userId: string,
  mail: MailInput,
  requireConnection = false,
) {
  const classification = classifyEmail(mail);
  if (classification.category === "UNKNOWN") return null;
  const apps = await db.application.findMany({
      where: { userId },
      include: { contacts: true },
    }),
    match = matchEmail(mail, apps);
  return db.$transaction(async (tx) => {
    if (requireConnection) {
      const connected = await tx.$queryRaw<
        { userId: string }[]
      >`SELECT "userId" FROM "EmailConnection" WHERE "userId" = ${userId} FOR UPDATE`;
      if (!connected.length) return null;
    }
    const existing = await tx.emailMessageMetadata.findUnique({
      where: { userId_externalId: { userId, externalId: mail.id } },
    });
    if (existing) return existing;
    const app = apps.find((a) => a.id === match.applicationId);
    const record = await tx.emailMessageMetadata.create({
      data: {
        userId,
        externalId: mail.id,
        threadId: mail.threadId,
        subject: mail.subject.slice(0, 300),
        sender: mail.sender.slice(0, 300),
        snippet: mail.body.replace(/\s+/g, " ").slice(0, 240),
        receivedAt: mail.receivedAt,
        category: classification.category,
        confidence: match.confidence,
        reasons: [classification.reason, ...match.reasons],
        applicationId: match.applicationId,
        company: app?.company || "",
        role: app?.position || "",
        demo: !!mail.demo,
        actions: {
          create: emailActions(mail, classification.category).map((a) => ({
            kind: a.kind,
            payload: a.payload,
          })),
        },
      },
    });
    await tx.notification.upsert({
      where: { userId_key: { userId, key: `email:${record.id}` } },
      create: {
        userId,
        key: `email:${record.id}`,
        title: `${classification.category.replace(/_/g, " ")}: ${mail.subject.slice(0, 100)}`,
        href: "/app/inbox",
      },
      update: {},
    });
    if (app)
      await tx.activity.create({
        data: {
          applicationId: app.id,
          message: `Email detected: ${mail.subject.slice(0, 150)} · awaiting review`,
          source: "Gmail",
          sourceEmailId: record.id,
          confidence: match.confidence,
        },
      });
    return record;
  });
}
