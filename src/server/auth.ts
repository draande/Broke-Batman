import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, createHash } from "node:crypto";
import { db } from "@/server/db";
import { environment } from "@/server/env";
import { APIError } from "@/server/errors";
export async function currentUser() {
  const token = (await cookies()).get("bat_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(environment().SESSION_SECRET),
      { algorithms: ["HS256"], issuer: "broke-batman", audience: "batcave" },
    );
    const session = await db.session.findUnique({
      where: { id: String(payload.jti) },
      include: {
        user: {
          select: { id: true, name: true, email: true, preference: true },
        },
      },
    });
    return session && session.expiresAt > new Date() ? session.user : null;
  } catch {
    return null;
  }
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new APIError(401, "Please sign in to enter the Batcave.");
  return user;
}
export async function createSession(userId: string) {
  const id = randomBytes(32).toString("hex");
  await db.session.create({
    data: { id, userId, expiresAt: new Date(Date.now() + 7 * 86400000) },
  });
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setJti(id)
    .setIssuer("broke-batman")
    .setAudience("batcave")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(environment().SESSION_SECRET));
  (await cookies()).set("bat_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
}
export async function logout() {
  const token = (await cookies()).get("bat_session")?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(environment().SESSION_SECRET),
      );
      await db.session.deleteMany({ where: { id: String(payload.jti) } });
    } catch {
      /* Invalid sessions are already unusable. */
    }
  }
  (await cookies()).delete("bat_session");
}
export function checkOrigin(request: Request) {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    request.headers.get("origin") !== new URL(environment().APP_URL).origin
  )
    throw new APIError(403, "Request origin is not allowed.");
}
export async function limit(key: string, maximum: number, windowMs: number) {
  const hashed = createHash("sha256").update(key).digest("hex");
  const now = new Date();
  const results = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${hashed}, 1, ${new Date(now.getTime() + windowMs)})
    ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "RateLimit"."expiresAt" < ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
    "expiresAt" = CASE WHEN "RateLimit"."expiresAt" < ${now} THEN ${new Date(now.getTime() + windowMs)} ELSE "RateLimit"."expiresAt" END
    RETURNING "count"`;
  if (results[0].count > maximum)
    throw new APIError(429, "Too many attempts. Please try again later.");
}
