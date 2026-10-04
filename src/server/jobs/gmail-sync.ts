import { gmailPage, gmailMessage, type GmailPart } from "@/schemas/gmail";
import { load } from "cheerio";
import { db } from "@/server/db";
import { APIError } from "@/server/errors";
import { accessToken, googleRequest } from "@/server/integrations/gmail";
import { ingestMail } from "@/server/services/email-ingestion";
import { demoMails } from "@/server/demo/mail-fixtures";

function plainText(part: GmailPart): string {
  if (part.parts) return part.parts.map(plainText).join("\n");
  const text = part.body?.data
    ? Buffer.from(part.body.data, "base64url").toString("utf8").slice(0, 100000)
    : "";
  return part.mimeType === "text/html"
    ? load(text).text()
    : part.mimeType === "text/plain"
      ? text
      : "";
}
export async function requestSync(userId: string) {
  if (!(await db.emailConnection.findUnique({ where: { userId } })))
    throw new APIError(400, "Connect Gmail or the demo first.");
  await db.syncState.upsert({
    where: { userId },
    create: { userId, status: "queued", requestedAt: new Date() },
    update: { requestedAt: new Date() },
  });
  await db.syncState.updateMany({
    where: { userId, status: { in: ["idle", "failed"] } },
    data: { status: "queued", retryAt: null, attempts: 0, error: null },
  });
}
export async function runSyncJob(userId: string, demoOnly = false) {
  if (
    demoOnly &&
    (await db.emailConnection.findUnique({ where: { userId } }))?.mode !==
      "demo"
  )
    return;
  const now = new Date(),
    claimed = await db.syncState.updateMany({
      where: {
        userId,
        OR: [
          { status: "queued", retryAt: { lte: now } },
          { status: "queued", retryAt: null },
          { status: "running", leaseUntil: { lt: now } },
        ],
      },
      data: {
        status: "running",
        leaseUntil: new Date(Date.now() + 120000),
        attempts: { increment: 1 },
      },
    });
  if (!claimed.count) return;
  try {
    const c = await db.emailConnection.findUnique({ where: { userId } });
    if (!c) return;
    if (demoOnly && c.mode !== "demo") return;
    const state = await db.syncState.findUniqueOrThrow({ where: { userId } });
    if (c.mode === "demo") {
      for (const mail of demoMails()) await ingestMail(userId, mail, true);
    } else {
      const token = await accessToken(userId),
        headers = { Authorization: `Bearer ${token}` };
      const q =
        'newer_than:90d {application interview recruiter assessment "offer letter" "hiring process"}';
      const query = new URLSearchParams({
        q,
        maxResults: "25",
        ...(state.pageToken ? { pageToken: state.pageToken } : {}),
      });
      const page = await googleRequest(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${query}`,
        { headers },
        gmailPage,
      );
      for (const item of page.messages || []) {
        if (
          await db.emailMessageMetadata.count({
            where: { userId, externalId: item.id },
          })
        )
          continue;
        const m = await googleRequest(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`,
          { headers },
          gmailMessage,
        );
        const h = (name: string) =>
          m.payload?.headers?.find(
            (v: { name: string; value: string }) =>
              v.name.toLowerCase() === name,
          )?.value || "";
        await ingestMail(
          userId,
          {
            id: m.id,
            threadId: m.threadId,
            subject: h("subject"),
            sender: h("from"),
            body: plainText(m.payload || {}),
            receivedAt: new Date(Number(m.internalDate)),
          },
          true,
        );
      }
      if (page.nextPageToken) {
        await db.syncState.update({
          where: { userId },
          data: {
            status: "queued",
            pageToken: page.nextPageToken,
            leaseUntil: null,
            retryAt: new Date(Date.now() + 2000),
            attempts: 0,
          },
        });
        return;
      }
    }
    await db.syncState.updateMany({
      where: { userId },
      data: {
        status: "idle",
        pageToken: null,
        lastSyncedAt: new Date(),
        leaseUntil: null,
        error: null,
        attempts: 0,
      },
    });
  } catch (e) {
    const s = await db.syncState.findUnique({ where: { userId } });
    if (!s) return;
    const retry =
      !(e instanceof APIError && e.status === 401) && s.attempts < 5;
    const message =
      e instanceof APIError
        ? e.message
        : "Sync failed safely. Check the connection and retry.";
    await db.syncState.update({
      where: { userId },
      data: {
        status: retry ? "queued" : "failed",
        error: message,
        leaseUntil: null,
        retryAt: retry
          ? new Date(Date.now() + Math.min(60000, 2000 * 2 ** s.attempts))
          : null,
      },
    });
    await db.notification.upsert({
      where: { userId_key: { userId, key: "sync-failure" } },
      create: {
        userId,
        key: "sync-failure",
        title: message,
        href: "/app/settings",
      },
      update: { title: message, readAt: null, dismissedAt: null },
    });
  }
}
