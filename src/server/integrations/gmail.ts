import { z } from "zod";
import { googleToken, gmailProfile } from "@/schemas/gmail";
import { createHash, randomBytes } from "node:crypto";

import { db } from "@/server/db";
import { APIError } from "@/server/errors";
import { encryptToken, decryptToken } from "@/server/integrations/token-vault";

export const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";
export const callbackURL = () =>
  `${process.env.APP_URL}/api/gmail/oauth/callback`;
const tokenURL = "https://oauth2.googleapis.com/token";
export async function googleRequest<T>(
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
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
  const result = schema.safeParse(await response.json());
  if (!result.success)
    throw new APIError(
      502,
      "Gmail returned an unexpected response. Please retry.",
    );
  return result.data;
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
  const token = await googleRequest(
    tokenURL,
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: params.get("code")!,
        code_verifier: decryptToken(attempt.verifier),
        grant_type: "authorization_code",
        redirect_uri: callbackURL(),
      }),
    },
    googleToken,
  );
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
    gmailProfile,
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
    const t = await googleRequest(
      tokenURL,
      {
        method: "POST",
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: decryptToken(c.refreshToken),
          grant_type: "refresh_token",
        }),
      },
      googleToken,
    );
    if (!t.access_token)
      throw new APIError(401, "Reconnect Gmail to continue.");
    await db.emailConnection.update({
      where: { userId },
      data: {
        accessToken: encryptToken(t.access_token),
        expiresAt: new Date(Date.now() + Number(t.expires_in || 3600) * 1000),
      },
    });
    return t.access_token;
  } catch (e) {
    if (e instanceof APIError && e.status === 401)
      await db.emailConnection.update({
        where: { userId },
        data: { state: "reconnect", accessToken: null },
      });
    throw e;
  }
}
