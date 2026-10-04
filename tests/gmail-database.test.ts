import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureStatuses } from "../src/server/seed";
import {
  ingestMail,
  requestSync,
  runSyncJob,
  finishOAuth,
  startOAuth,
} from "../src/server/gmail";
import { intelligenceAPI } from "../src/server/intelligence-api";
import {
  searchIntelligence,
  generateNotifications,
} from "../src/server/intelligence";
describe.skipIf(process.env.RUN_DB_TESTS !== "true")(
  "Gmail PostgreSQL workflow",
  () => {
    let userId: string, other: string, appId: string;
    beforeAll(async () => {
      await ensureStatuses(db);
      process.env.GMAIL_TOKEN_KEY = "b".repeat(64);
      process.env.GOOGLE_CLIENT_ID = "mock-client";
      process.env.GOOGLE_CLIENT_SECRET = "mock-secret";
      process.env.APP_URL = "http://localhost:3000";
      userId = (
        await db.user.create({
          data: {
            email: `gmail-${Date.now()}@test.example`,
            name: "Test",
            passwordHash: "unused",
          },
        })
      ).id;
      other = (
        await db.user.create({
          data: {
            email: `gmail-other-${Date.now()}@test.example`,
            name: "Other",
            passwordHash: "unused",
          },
        })
      ).id;
      appId = (
        await db.application.create({
          data: {
            userId,
            company: "Google",
            position: "Software Engineer",
            statusId: "applied",
            dateApplied: new Date(Date.now() - 12 * 86400000),
          },
        })
      ).id;
    });
    afterAll(async () => {
      vi.unstubAllGlobals();
      await db.user.deleteMany({ where: { id: { in: [userId, other] } } });
      await db.$disconnect();
    });
    it("ingests idempotently, requires approval, protects ownership and records audit evidence", async () => {
      const mail = {
        id: "mock-id",
        threadId: "thread",
        subject: "Google Software Engineer offer letter",
        sender: "Hiring <hiring@google.com>",
        body: "Google Software Engineer: we are pleased to offer you the role.",
        receivedAt: new Date(),
      };
      const m = await ingestMail(userId, mail);
      await ingestMail(userId, mail);
      expect(await db.emailMessageMetadata.count({ where: { userId } })).toBe(
        1,
      );
      expect(
        (await db.application.findUniqueOrThrow({ where: { id: appId } }))
          .statusId,
      ).toBe("applied");
      const action = await db.suggestedAction.findFirstOrThrow({
        where: { messageId: m!.id },
      });
      const request = () =>
        new Request("http://localhost:3000/api/suggestions/id", {
          method: "POST",
          body: JSON.stringify({ decision: "approved" }),
        });
      await expect(
        intelligenceAPI(request(), other, ["suggestions", action.id]),
      ).rejects.toMatchObject({ status: 404 });
      await intelligenceAPI(request(), userId, ["suggestions", action.id]);
      await expect(
        intelligenceAPI(request(), userId, ["suggestions", action.id]),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (await db.application.findUniqueOrThrow({ where: { id: appId } }))
          .statusId,
      ).toBe("offer");
      expect(
        await db.activity.count({
          where: {
            applicationId: appId,
            sourceEmailId: m!.id,
            source: "Gmail",
          },
        }),
      ).toBe(2);
    });
    it("queues demo sync outside requests and prevents duplicate processing", async () => {
      await db.emailConnection.create({ data: { userId, mode: "demo" } });
      await requestSync(userId);
      expect(
        (await db.syncState.findUniqueOrThrow({ where: { userId } })).status,
      ).toBe("queued");
      await Promise.all([runSyncJob(userId), runSyncJob(userId)]);
      const count = await db.emailMessageMetadata.count({ where: { userId } });
      expect(count).toBe(6);
      await requestSync(userId);
      await runSyncJob(userId);
      expect(await db.emailMessageMetadata.count({ where: { userId } })).toBe(
        count,
      );
    });
    it("creates interview only after confirmation and deduplicates recruiter contacts", async () => {
      const m = await db.emailMessageMetadata.findUniqueOrThrow({
        where: { userId_externalId: { userId, externalId: "demo-google" } },
        include: { actions: true },
      });
      await db.emailMessageMetadata.update({
        where: { id: m.id },
        data: { applicationId: appId },
      });
      const interview = m.actions.find((a) => a.kind === "interview")!;
      const request = new Request("http://localhost/api/suggestions/id", {
        method: "POST",
        body: JSON.stringify({
          decision: "approved",
          details: {
            startsAt: new Date(Date.now() + 86400000).toISOString(),
            timezone: "UTC",
            type: "Technical",
          },
        }),
      });
      await intelligenceAPI(request, userId, ["suggestions", interview.id]);
      expect(
        await db.interview.count({ where: { applicationId: appId } }),
      ).toBe(1);
    });
    it("derives censored timing, health, and persistent deduplicated notifications", async () => {
      const d = await searchIntelligence(userId);
      expect(d.timing.firstResponse).not.toBeNull();
      expect(d.cases[0].health).toBe("ACTION REQUIRED");
      await generateNotifications(userId);
      const count = await db.notification.count({ where: { userId } });
      await generateNotifications(userId);
      expect(await db.notification.count({ where: { userId } })).toBe(count);
      const empty = await searchIntelligence(other);
      expect(empty.timing.firstResponse).toBeNull();
      expect(empty.timing.responseRate).toBeNull();
    });
    it("validates one-time OAuth state and mocks real callback token exchange", async () => {
      const url = new URL(await startOAuth(other));
      expect(url.searchParams.get("scope")).toBe(
        "https://www.googleapis.com/auth/gmail.readonly",
      );
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      await expect(
        finishOAuth(
          userId,
          new URLSearchParams({
            state: url.searchParams.get("state")!,
            code: "mock",
          }),
        ),
      ).rejects.toMatchObject({ status: 400 });
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            Response.json({
              access_token: "access",
              refresh_token: "refresh",
              scope: "https://www.googleapis.com/auth/gmail.readonly",
              expires_in: 3600,
            }),
          )
          .mockResolvedValueOnce(
            Response.json({ emailAddress: "mock@gmail.com" }),
          ),
      );
      const p = new URLSearchParams({
        state: url.searchParams.get("state")!,
        code: "mock",
      });
      await finishOAuth(other, p);
      await expect(finishOAuth(other, p)).rejects.toMatchObject({
        status: 400,
      });
      const connection = await db.emailConnection.findUniqueOrThrow({
        where: { userId: other },
      });
      expect(connection.accessToken).not.toContain("access");
    });
    it("redirects an invalid OAuth callback to the settings failure state", async () => {
      const response = await intelligenceAPI(
        new Request(
          "http://localhost:3000/api/gmail/oauth/callback?state=invalid&code=mock",
        ),
        userId,
        ["gmail", "oauth", "callback"],
      );
      expect(response?.status).toBe(302);
      expect(response?.headers.get("location")).toContain(
        "/app/settings?gmail=error",
      );
    });
    it("resumes mocked pagination and discards unrelated mail", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            messages: [{ id: "provider-job" }, { id: "provider-unrelated" }],
            nextPageToken: "next-page",
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            id: "provider-job",
            threadId: "provider-thread",
            internalDate: String(Date.now()),
            payload: {
              mimeType: "text/plain",
              headers: [
                { name: "Subject", value: "Application received" },
                { name: "From", value: "careers@example.test" },
              ],
              body: {
                data: Buffer.from(
                  "We received your application for Software Engineer",
                ).toString("base64url"),
              },
            },
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            id: "provider-unrelated",
            threadId: "unrelated",
            internalDate: String(Date.now()),
            payload: {
              mimeType: "text/plain",
              headers: [{ name: "Subject", value: "Grocery deals" }],
              body: {
                data: Buffer.from("Apples are on sale").toString("base64url"),
              },
            },
          }),
        )
        .mockResolvedValueOnce(
          Response.json({ messages: [{ id: "provider-job" }] }),
        );
      vi.stubGlobal("fetch", fetchMock);
      await requestSync(other);
      await runSyncJob(other);
      expect(
        (await db.syncState.findUniqueOrThrow({ where: { userId: other } }))
          .pageToken,
      ).toBe("next-page");
      expect(
        await db.emailMessageMetadata.count({ where: { userId: other } }),
      ).toBe(1);
      await db.syncState.update({
        where: { userId: other },
        data: { retryAt: new Date(0) },
      });
      await runSyncJob(other);
      expect(
        (await db.syncState.findUniqueOrThrow({ where: { userId: other } }))
          .status,
      ).toBe("idle");
      expect(fetchMock.mock.calls[3][0]).toContain("pageToken=next-page");
      expect(
        await db.emailMessageMetadata.count({ where: { userId: other } }),
      ).toBe(1);
    });
    it("handles mocked refresh-token revocation with a safe reconnect notice", async () => {
      await db.emailConnection.update({
        where: { userId: other },
        data: { expiresAt: new Date(0) },
      });
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response("sensitive provider details", { status: 400 }),
          ),
      );
      await requestSync(other);
      await runSyncJob(other);
      expect(
        (
          await db.emailConnection.findUniqueOrThrow({
            where: { userId: other },
          })
        ).state,
      ).toBe("reconnect");
      expect(
        (await db.syncState.findUniqueOrThrow({ where: { userId: other } }))
          .status,
      ).toBe("failed");
      const notice = await db.notification.findUniqueOrThrow({
        where: { userId_key: { userId: other, key: "sync-failure" } },
      });
      expect(notice.title).not.toContain("sensitive");
    });
    it("deduplicates approved recruiter contacts and preserves dismissed decisions", async () => {
      for (const id of ["contact-one", "contact-two"]) {
        const mail = await ingestMail(userId, {
          id,
          threadId: id,
          subject: "Google Software Engineer interview request",
          sender: "Morgan <morgan@google.com>",
          body: "Google Software Engineer interview. Please provide your availability.",
          receivedAt: new Date(),
        });
        const action = await db.suggestedAction.findFirstOrThrow({
          where: { messageId: mail!.id, kind: "contact" },
        });
        await intelligenceAPI(
          new Request("http://localhost/api", {
            method: "POST",
            body: JSON.stringify({ decision: "approved" }),
          }),
          userId,
          ["suggestions", action.id],
        );
        const status = await db.suggestedAction.findFirstOrThrow({
          where: { messageId: mail!.id, kind: "status" },
        });
        await intelligenceAPI(
          new Request("http://localhost/api", {
            method: "POST",
            body: JSON.stringify({ decision: "dismissed" }),
          }),
          userId,
          ["suggestions", status.id],
        );
        expect(
          (
            await db.suggestedAction.findUniqueOrThrow({
              where: { id: status.id },
            })
          ).decidedAt,
        ).not.toBeNull();
      }
      expect(
        await db.contact.count({
          where: { applicationId: appId, email: "morgan@google.com" },
        }),
      ).toBe(1);
      expect(
        (await db.application.findUniqueOrThrow({ where: { id: appId } }))
          .statusId,
      ).toBe("offer");
    });
    it("scopes read/dismiss notifications and prevents ingestion after privacy deletion", async () => {
      const notice = await db.notification.findFirstOrThrow({
        where: { userId, readAt: null },
      });
      const request = () =>
        new Request("http://localhost/api", {
          method: "PATCH",
          body: JSON.stringify({ action: "read" }),
        });
      await intelligenceAPI(request(), other, ["notifications", notice.id]);
      expect(
        (await db.notification.findUniqueOrThrow({ where: { id: notice.id } }))
          .readAt,
      ).toBeNull();
      await intelligenceAPI(request(), userId, ["notifications", notice.id]);
      expect(
        (await db.notification.findUniqueOrThrow({ where: { id: notice.id } }))
          .readAt,
      ).not.toBeNull();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("", { status: 400 })),
      );
      await intelligenceAPI(
        new Request("http://localhost/api", {
          method: "DELETE",
          body: JSON.stringify({ scope: "email", confirmation: "DELETE" }),
        }),
        other,
        ["privacy"],
      );
      expect(
        await db.emailMessageMetadata.count({ where: { userId: other } }),
      ).toBe(0);
      expect(
        await ingestMail(
          other,
          {
            id: "in-flight",
            threadId: "in-flight",
            subject: "Application received",
            sender: "careers@example.test",
            body: "We received your application",
            receivedAt: new Date(),
          },
          true,
        ),
      ).toBeNull();
      expect(await db.user.count({ where: { id: other } })).toBe(1);
      expect(
        await db.emailMessageMetadata.count({ where: { userId } }),
      ).toBeGreaterThan(0);
    });
  },
);
