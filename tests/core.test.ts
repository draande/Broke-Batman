import { describe, it, expect } from "vitest";
import { applicationSchema, interviewSchema } from "../src/lib/validation";
import { computeAnalytics } from "../src/lib/analytics";
import { likelyDuplicate, similarDescriptions } from "../src/lib/duplicates";
import {
  parseText,
  normalizeContent,
  extractHTML,
  isPublicAddress,
  validatePublicURL,
} from "../src/server/extraction";
import { ownershipWhere } from "../src/server/repository";
import { previewCSV } from "../src/server/transfers";
describe("validation", () => {
  it("returns validation errors for malformed URLs and impossible calendar dates", () => {
    expect(
      applicationSchema.safeParse({
        company: "A",
        position: "B",
        jobPostingURL: "not a URL",
      }).success,
    ).toBe(false);
    expect(
      applicationSchema.safeParse({
        company: "A",
        position: "B",
        dateApplied: "2026-02-31",
      }).success,
    ).toBe(false);
  });
  it("rejects inverted salary ranges and unknown fields are stripped", () => {
    expect(
      applicationSchema.safeParse({
        company: "Wayne",
        position: "Engineer",
        salaryMinimum: 200,
        salaryMaximum: 100,
      }).success,
    ).toBe(false);
    expect(
      applicationSchema.parse({
        company: "Wayne",
        position: "Engineer",
        userId: "victim",
      }),
    ).not.toHaveProperty("userId");
  });
  it("rejects script links and invalid interview timezones", () => {
    expect(
      applicationSchema.safeParse({
        company: "A",
        position: "B",
        jobPostingURL: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      interviewSchema.safeParse({
        type: "Technical",
        startsAt: new Date().toISOString(),
        timezone: "Not/AZone",
      }).success,
    ).toBe(false);
  });
});
describe("extraction", () => {
  it("normalizes whitespace and extracts salary, skills, experience, and mode", () => {
    expect(normalizeContent("  a  b\r\n\n\n c ")).toBe("a b\n\n c");
    const r = parseText(
      "Company: Wayne Enterprises\nTitle: Software Engineer\nLocation: Gotham\nFull-time, Hybrid\nSalary: $120k - $180k\nRequired: TypeScript, React, PostgreSQL\n3+ years of experience\nPreferred: Docker and AWS",
    );
    expect(r).toMatchObject({
      company: "Wayne Enterprises",
      position: "Software Engineer",
      salaryMinimum: 120000,
      salaryMaximum: 180000,
      workMode: "Hybrid",
    });
    expect(r.requiredSkills).toContain("TypeScript");
    expect(r.preferredSkills).toContain("Docker");
    expect(r.experienceRequirements).toContain("3+ years");
  });
  it("prefers JSON-LD and removes scripts", () => {
    const r = extractHTML(
      `<html><body><nav>Ignored links</nav><main><script>bad()</script>Build reliable software with a team of thoughtful engineers working in Gotham for Wayne Enterprises.</main><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "JobPosting", title: "Platform Engineer", hiringOrganization: { name: "Wayne" }, description: "<p>Build reliable software. Required: Python and PostgreSQL. Work with a team on public cloud infrastructure.</p>", jobLocationType: "TELECOMMUTE", baseSalary: { currency: "USD", value: { minValue: 100000, maxValue: 150000 } } })}</script></body></html>`,
    );
    expect(r.company).toBe("Wayne");
    expect(r.position).toBe("Platform Engineer");
    expect(r.jobDescription).not.toContain("bad()");
    expect(r.extractionMethod).toContain("JSON-LD");
  });
  it("blocks loopback, private, mapped IPv6, multicast, link-local, and non-web schemes", async () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.1.1",
      "169.254.169.254",
      "::1",
      "::ffff:127.0.0.1",
      "fc00::1",
      "224.0.0.1",
    ])
      expect(isPublicAddress(address)).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    await expect(validatePublicURL("http://127.0.0.1/jobs")).rejects.toThrow();
    await expect(validatePublicURL("http://localhost/jobs")).rejects.toThrow();
    await expect(validatePublicURL("file:///etc/passwd")).rejects.toThrow();
  });
  it("leaves unrecognized company and employment type blank", () => {
    const r = parseText(
      "We offer a friendly team and excellent benefits. Join us to make the world better.",
    );
    expect(r.company).toBe("");
    expect(r.employmentType).toBe("");
  });
});
describe("duplicates and import", () => {
  it("normalizes companies, roles and tracking URLs", () => {
    const a = {
      company: "Wayne Enterprises",
      position: "Software Engineer",
      jobDescription: "",
    };
    expect(
      likelyDuplicate(a, {
        ...a,
        company: "WAYNE ENTERPRISES!",
        position: "Software-Engineer",
      }),
    ).toBe(true);
    expect(
      likelyDuplicate(
        { ...a, jobPostingURL: "https://example.com/job/1?utm_source=a" },
        {
          ...a,
          company: "Other",
          jobPostingURL: "https://example.com/job/1?utm_source=b",
        },
      ),
    ).toBe(true);
    expect(similarDescriptions("short", "short")).toBe(false);
  });
  it("validates mapped CSV rows before import", () => {
    const result = previewCSV("Employer,Role\nWayne,Engineer\nOscorp,\n", {
      company: "Employer",
      position: "Role",
    });
    expect(result.valid).toBe(false);
    expect(result.rows[0].errors).toEqual([]);
    expect(result.rows[1].errors[0]).toContain("position");
  });
  it("always constrains object lookups by owner", () => {
    expect(ownershipWhere("alice", "case-1")).toEqual({
      id: "case-1",
      userId: "alice",
    });
  });
});
describe("analytics", () => {
  it("counts calendar-day streaks across daylight saving changes", () => {
    const now = new Date("2026-03-09T07:30:00Z");
    const base = {
      company: "Wayne",
      source: "Direct",
      workMode: "Remote",
      createdAt: now,
      status: { id: "applied", label: "Applied", category: "applied" },
      history: [],
    };
    const apps = [
      "2026-03-09T07:15:00Z",
      "2026-03-08T08:45:00Z",
      "2026-03-07T09:00:00Z",
    ].map((dateApplied) => ({ ...base, dateApplied }));
    expect(computeAnalytics(apps, now, "America/Los_Angeles").streak).toBe(3);
  });
  it("uses historical reach, ignores ghosting as response, and handles empty searches", () => {
    const now = new Date("2026-10-03T20:00:00Z");
    const item = {
      company: "Wayne",
      source: "Direct",
      workMode: "Remote",
      createdAt: now,
      dateApplied: new Date("2026-10-01T20:00:00Z"),
      status: { id: "rejected", label: "Rejected", category: "closed" },
      history: [
        {
          createdAt: new Date("2026-10-02T20:00:00Z"),
          toStatus: "technical-interview",
        },
        { createdAt: now, toStatus: "rejected" },
      ],
    };
    const a = computeAnalytics(
      [
        item,
        {
          ...item,
          status: { id: "ghosted", label: "Ghosted", category: "closed" },
          history: [{ createdAt: now, toStatus: "ghosted" }],
        },
      ],
      now,
    );
    expect(a.responseRate).toBe(50);
    expect(a.interviews).toBe(1);
    expect(a.averageResponseDays).toBe(1);
    expect(computeAnalytics([], now).responseRate).toBe(0);
    expect(a.averageStageDays[0].value).toBe(1);
  });
});
