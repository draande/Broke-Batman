import { describe, it, expect, vi, afterEach } from "vitest";
import {
  classifyEmail,
  matchEmail,
  emailActions,
} from "../src/lib/email-intelligence";
import { canonicalSkill, matchScore } from "../src/lib/skills-intelligence";
import { encryptToken, decryptToken } from "../src/server/token-vault";
import { googleRequest } from "../src/server/gmail";
afterEach(() => vi.unstubAllGlobals());
describe("Gmail deterministic intelligence", () => {
  it.each([
    [
      "Thanks for applying",
      "We received your application",
      "APPLICATION_CONFIRMATION",
    ],
    [
      "Interview confirmation",
      "Technical interview confirmed",
      "INTERVIEW_CONFIRMATION",
    ],
    [
      "Hiring update",
      "Unfortunately we will not be moving forward with your application",
      "REJECTION",
    ],
    ["Offer letter", "We are pleased to offer you the role", "OFFER"],
    ["Assessment", "Complete the online assessment", "ONLINE_ASSESSMENT"],
    ["Weekly grocery deals", "Offers on apples", "UNKNOWN"],
  ])("classifies %s", (subject, body, category) =>
    expect(classifyEmail({ subject, body, sender: "" }).category).toBe(
      category,
    ),
  );
  it("requires an explicit case choice for ambiguous roles", () => {
    const apps = ["a", "b"].map((id) => ({
      id,
      company: "Google",
      position: "Software Engineer",
      contacts: [],
    }));
    expect(
      matchEmail(
        {
          subject: "Google Software Engineer interview",
          body: "",
          sender: "Hiring <hiring@google.com>",
        },
        apps,
      ).applicationId,
    ).toBeNull();
  });
  it("explains a strong match and rejects weak matches", () => {
    const apps = [
      {
        id: "a",
        company: "Google",
        position: "Software Engineer",
        contacts: [],
      },
    ];
    const result = matchEmail(
      {
        subject: "Google Software Engineer interview",
        body: "",
        sender: "Hiring <hiring@google.com>",
      },
      apps,
    );
    expect(result.applicationId).toBe("a");
    expect(result.confidence).toBe(85);
    expect(result.reasons).toHaveLength(3);
    expect(
      matchEmail(
        { subject: "Interview", body: "", sender: "person@example.com" },
        apps,
      ).applicationId,
    ).toBeNull();
  });
  it("extracts explicit interview details without guessing missing dates", () => {
    const mail = {
      id: "a",
      threadId: "a",
      subject: "Interview confirmed",
      sender: "Taylor <taylor@google.com>",
      body: "Technical interview at 2026-10-04T17:00:00.000Z for 45 minutes https://meet.google.com/abc",
      receivedAt: new Date(),
    };
    const a = emailActions(mail, "INTERVIEW_CONFIRMATION");
    expect(a.find((v) => v.kind === "interview")?.payload).toMatchObject({
      startsAt: "2026-10-04T17:00:00.000Z",
      duration: 45,
      type: "Technical",
    });
    expect(
      emailActions(
        { ...mail, body: "Interview next week" },
        "INTERVIEW_REQUEST",
      ).find((v) => v.kind === "interview")?.payload.startsAt,
    ).toBeNull();
  });
  it("canonicalizes aliases and gives an auditable score", () => {
    expect(canonicalSkill("JS")).toBe("JavaScript");
    expect(canonicalSkill("Postgres")).toBe("PostgreSQL");
    const score = matchScore(
      [
        { skill: { name: "JS" }, preferred: false },
        { skill: { name: "Python" }, preferred: false },
      ],
      [{ name: "JavaScript", proficiency: "Strong" }],
      "3 years experience and Bachelor degree",
      3,
      "Bachelor",
    );
    expect(score.score).toBe(65);
    expect(score.missing).toEqual(["Python"]);
    expect(matchScore([], [], "", 0, "").score).toBeNull();
  });
  it("encrypts nondeterministically and rejects modified ciphertext", () => {
    process.env.GMAIL_TOKEN_KEY = "a".repeat(64);
    const value = encryptToken("secret-access-token");
    expect(value).not.toContain("secret");
    expect(decryptToken(value)).toBe("secret-access-token");
    expect(encryptToken("secret-access-token")).not.toBe(value);
    expect(() => decryptToken(value.slice(0, -3) + "AAA")).toThrow();
  });
  it("maps mocked provider quota and revocation errors without leaking responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private provider body", { status: 429 }),
        ),
    );
    await expect(
      googleRequest("https://gmail.googleapis.com/test"),
    ).rejects.toMatchObject({ status: 503 });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private provider body", { status: 401 }),
        ),
    );
    await expect(
      googleRequest("https://gmail.googleapis.com/test"),
    ).rejects.toMatchObject({ status: 401 });
  });
});
