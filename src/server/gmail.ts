import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { load } from "cheerio";
import { db } from "./db";
import { APIError } from "./errors";
import { encryptToken, decryptToken } from "./token-vault";
import {
  classifyEmail,
  matchEmail,
  emailActions,
  type MailInput,
} from "@/lib/email-intelligence";
export const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";
export const callbackURL = () =>
  `${process.env.APP_URL}/api/gmail/oauth/callback`;
const tokenURL = "https://oauth2.googleapis.com/token";
export async function googleRequest(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok)
    throw new APIError(
      response.status === 429 || response.status >= 500 ? 503 : 401,
      response.status === 429
        ? "Gmail rate limited the request; sync will retry."
        : response.status >= 500
          ? "Gmail is temporarily unavailable; sync will retry."
          : "Gmail authorization expired or was revoked. Reconnect Gmail.",
    );
  return response.json();
}
export async function startOAuth(userId: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    throw new APIError(
      503,
      "Google OAuth is not configured. Try the explicitly labeled demo connection.",
    );
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  await db.oAuthAttempt.deleteMany({ where: { userId } });
  await db.oAuthAttempt.create({
    data: {
      userId,
      state,
      verifier: encryptToken(verifier),
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  const query = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackURL(),
    response_type: "code",
    scope: gmailScope,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}
export async function finishOAuth(userId: string, params: URLSearchParams) {
  const state = params.get("state") || "";
  const attempt = await db.$transaction(async (tx) => {
    const item = await tx.oAuthAttempt.findFirst({
      where: { state, userId, expiresAt: { gt: new Date() } },
    });
    if (!item)
      throw new APIError(
        400,
        "OAuth state is invalid, expired, or already used.",
      );
    const deleted = await tx.oAuthAttempt.deleteMany({
      where: { state, userId },
    });
    if (!deleted.count)
      throw new APIError(400, "OAuth state was already used.");
    return item;
  });
  if (params.has("error") || !params.get("code"))
    throw new APIError(400, "Gmail connection was not authorized.");
  const token = await googleRequest(tokenURL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code: params.get("code")!,
      code_verifier: decryptToken(attempt.verifier),
      grant_type: "authorization_code",
      redirect_uri: callbackURL(),
    }),
  });
  if (
    !token.access_token ||
    !token.scope?.split(" ").includes(gmailScope) ||
    !token.refresh_token
  )
    throw new APIError(
      400,
      "Google did not grant offline Gmail read-only access. Reconnect and consent.",
    );
  const profile = await googleRequest(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${token.access_token}` } },
  );
  await db.emailConnection.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  await db.emailConnection.update({
    where: { userId },
    data: {
      mode: "google",
      account: profile.emailAddress,
      accessToken: encryptToken(token.access_token),
      refreshToken: encryptToken(token.refresh_token),
      expiresAt: new Date(Date.now() + Number(token.expires_in || 3600) * 1000),
      state: "connected",
    },
  });
}
export async function disconnect(userId: string) {
  const connection = await db.emailConnection.findUnique({ where: { userId } });
  if (connection?.refreshToken) {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: decryptToken(connection.refreshToken),
      }),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    if (!response.ok && response.status !== 400)
      throw new APIError(
        503,
        "Google could not revoke access. Try disconnect again.",
      );
  }
  await db.$transaction([
    db.emailConnection.deleteMany({ where: { userId } }),
    db.syncState.deleteMany({ where: { userId } }),
    db.oAuthAttempt.deleteMany({ where: { userId } }),
  ]);
}
export async function accessToken(userId: string) {
  const c = await db.emailConnection.findUnique({ where: { userId } });
  if (!c?.accessToken || c.state !== "connected")
    throw new APIError(401, "Reconnect Gmail to continue.");
  if (c.expiresAt && +c.expiresAt > Date.now() + 60000)
    return decryptToken(c.accessToken);
  if (!c.refreshToken) throw new APIError(401, "Reconnect Gmail to continue.");
  try {
    const t = await googleRequest(tokenURL, {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: decryptToken(c.refreshToken),
        grant_type: "refresh_token",
      }),
    });
    if (!t.access_token)
      throw new APIError(401, "Reconnect Gmail to continue.");
    await db.emailConnection.update({
      where: { userId },
      data: {
        accessToken: encryptToken(t.access_token),
        expiresAt: new Date(Date.now() + Number(t.expires_in || 3600) * 1000),
      },
    });
    return t.access_token as string;
  } catch (e) {
    if (e instanceof APIError && e.status === 401)
      await db.emailConnection.update({
        where: { userId },
        data: { state: "reconnect", accessToken: null },
      });
    throw e;
  }
}
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
            payload: a.payload as Prisma.InputJsonValue,
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
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
function plainText(part: Part): string {
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
export function demoMails(): MailInput[] {
  const interview = new Date(Date.now() + 86400000);
  interview.setUTCHours(17, 0, 0, 0);
  const deadline = new Date(Date.now() + 2 * 86400000).toISOString();
  return [
    {
      id: "demo-google",
      subject: "Google Software Engineer interview confirmation",
      sender: "Taylor Morgan <taylor@google.com>",
      body: `Google Software Engineer technical interview confirmed for ${interview.toISOString()}. Duration 45 minutes. Join https://meet.google.com/demo-interview`,
    },
    {
      id: "demo-stripe",
      subject: "Stripe Software Engineer application update",
      sender: "Hiring <careers@stripe.com>",
      body: "Thank you for applying for the Stripe Software Engineer role. Unfortunately we will not be moving forward with your application.",
    },
    {
      id: "demo-nvidia",
      subject: "NVIDIA Software Engineer opportunity",
      sender: "Alex Chen <alex@nvidia.com>",
      body: "I am a recruiter at NVIDIA. We have an opportunity for a Software Engineer role. Please reply with your availability.",
    },
    {
      id: "demo-wayne",
      subject: "Wayne Enterprises application received",
      sender: "Careers <careers@wayne.example>",
      body: "Wayne Enterprises has received your application for Software Engineer. Thank you for applying.",
    },
    {
      id: "demo-cyberdyne",
      subject: "Cyberdyne Software Engineer online assessment",
      sender: "Recruiting <recruiting@cyberdyne.example>",
      body: `Complete the online assessment for Cyberdyne Software Engineer. Deadline: ${deadline}`,
    },
  ].map((m) => ({ ...m, threadId: m.id, receivedAt: new Date(), demo: true }));
}
