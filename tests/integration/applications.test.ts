import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { db } from "@/server/db";
import { ensureStatuses } from "@/server/demo/seed";
import {
  saveApplication,
  changeStatus,
  listApplications,
} from "@/server/services/applications";
import { ownedApplication } from "@/server/repositories/applications";
import { interviewSchema } from "@/schemas/forms";
import { computeAnalytics } from "@/lib/analytics";
const run = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!run)("PostgreSQL integration", () => {
  let owner: string, other: string;
  beforeAll(async () => {
    await ensureStatuses(db);
    owner = (
      await db.user.create({
        data: {
          email: `test-owner-${Date.now()}@example.test`,
          name: "Owner",
          passwordHash: "test",
        },
      })
    ).id;
    other = (
      await db.user.create({
        data: {
          email: `test-other-${Date.now()}@example.test`,
          name: "Other",
          passwordHash: "test",
        },
      })
    ).id;
  });
  afterAll(async () => {
    await db.user.deleteMany({
      where: { id: { in: [owner, other].filter(Boolean) } },
    });
    await db.$disconnect();
  });
  it("persists CRUD, blocks cross-user access, preserves skills on stage changes, and cascades children", async () => {
    const app = await saveApplication(owner, {
      company: "Test Wayne",
      position: "Engineer",
      statusId: "applied",
      requiredSkills: ["TypeScript"],
      notes: "Remember this note",
    });
    expect((await ownedApplication(owner, app.id)).notes[0].body).toContain(
      "Remember",
    );
    await expect(ownedApplication(other, app.id)).rejects.toThrow(
      "Case not found",
    );
    await expect(changeStatus(other, app.id, "offer")).rejects.toThrow(
      "Case not found",
    );
    expect((await listApplications(other, new URLSearchParams())).total).toBe(
      0,
    );
    await changeStatus(owner, app.id, "technical-interview");
    const moved = await ownedApplication(owner, app.id);
    expect(moved.history.map((h) => h.toStatus)).toEqual([
      "applied",
      "technical-interview",
    ]);
    expect(moved.skills[0].skill.name).toBe("TypeScript");
    const parsed = interviewSchema.parse({
      type: "Technical",
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      timezone: "America/Los_Angeles",
    });
    await db.interview.create({ data: { ...parsed, applicationId: app.id } });
    expect((await ownedApplication(owner, app.id)).interviews).toHaveLength(1);
    const updated = await saveApplication(
      owner,
      {
        company: "Test Wayne",
        position: "Senior Engineer",
        statusId: "technical-interview",
        requiredSkills: ["TypeScript"],
      },
      app.id,
    );
    expect(updated.position).toBe("Senior Engineer");
    expect(updated.history).toHaveLength(2);
    expect(computeAnalytics([updated]).interviews).toBe(1);
    await expect(
      saveApplication(owner, {
        company: "Test Wayne",
        position: "Senior Engineer",
      }),
    ).rejects.toThrow("already");
    await db.application.delete({ where: { id: app.id, userId: owner } });
    expect(await db.interview.count({ where: { applicationId: app.id } })).toBe(
      0,
    );
  });
});
