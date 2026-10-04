import { PrismaClient } from "@prisma/client";
import { statuses } from "@/lib/statuses";
export async function ensureStatuses(client: PrismaClient) {
  for (const s of statuses)
    await client.status.upsert({ where: { id: s.id }, create: s, update: s });
}
export async function seedDemo(client: PrismaClient, userId: string) {
  await ensureStatuses(client);
  const companies = [
    "Wayne Enterprises",
    "Stark Industries",
    "Oscorp",
    "Cyberdyne Systems",
    "Aperture Laboratories",
    "Massive Dynamic",
  ];
  const stages = [
    "applied",
    "technical-interview",
    "saved",
    "rejected",
    "offer",
    "recruiter-screen",
    "final-round",
    "preparing",
    "ghosted",
    "phone-interview",
    "accepted",
    "withdrawn",
  ];
  const now = Date.now();
  for (let i = 0; i < 24; i++) {
    const statusId = stages[i % stages.length];
    const applied = !["saved", "preparing"].includes(statusId);
    const dateApplied = applied
      ? new Date(now - (i < 7 ? i : i * 2) * 86400000)
      : null;
    const createdAt = new Date(now - (i + 1) * 2 * 86400000);
    const app = await client.application.create({
      data: {
        userId,
        company: companies[i % 6],
        position:
          [
            "Software Engineer",
            "Frontend Engineer",
            "Platform Engineer",
            "Backend Engineer",
          ][i % 4] + (i >= 12 ? " II" : ""),
        location: ["Gotham City, NJ", "New York, NY", "Remote, US"][i % 3],
        workMode: ["Remote", "Hybrid", "On-site"][i % 3],
        employmentType: i % 7 === 0 ? "Internship" : "Full-time",
        salaryMinimum: 110000 + i * 2000,
        salaryMaximum: 160000 + i * 2000,
        statusId,
        source: ["Direct", "Referral", "LinkedIn", "Job board"][i % 4],
        dateApplied,
        createdAt,
        jobDescription: `${companies[i % 6]} is looking for a ${["Software Engineer", "Frontend Engineer", "Platform Engineer", "Backend Engineer"][i % 4]}. Build dependable services for our research division. Required: TypeScript, React, PostgreSQL, automated testing, and collaborative code reviews. Preferred: Docker and AWS. 3+ years of software engineering experience. A competitive salary, flexible working hours, and no requirement to patrol rooftops.`,
        experienceRequirements: "3+ years of software engineering experience",
        applicationDeadline:
          i % 5 === 0 ? new Date(now + (i + 2) * 86400000) : null,
      },
    });
    const path = applied
      ? [
          "saved",
          "applied",
          ...(!["applied", "withdrawn", "ghosted", "rejected"].includes(
            statusId,
          )
            ? ["recruiter-screen"]
            : []),
          ...(statusId === "offer" || statusId === "accepted"
            ? ["technical-interview", "final-round"]
            : []),
          ...(statusId === "applied" ? [] : [statusId]),
        ]
      : [statusId];
    const unique = [...new Set(path)];
    for (let j = 0; j < unique.length; j++) {
      const at = new Date(
        j === 0
          ? createdAt.getTime()
          : j === 1
            ? dateApplied!.getTime()
            : dateApplied!.getTime() +
              ((now - dateApplied!.getTime()) * (j - 1)) /
                Math.max(1, unique.length - 2),
      );
      await client.applicationStatusHistory.create({
        data: {
          applicationId: app.id,
          fromStatus: j ? unique[j - 1] : null,
          toStatus: unique[j],
          createdAt: at,
        },
      });
      await client.activity.create({
        data: {
          applicationId: app.id,
          message: j
            ? `Moved to ${statuses.find((s) => s.id === unique[j])?.label}`
            : "Case opened",
          createdAt: at,
        },
      });
    }
    for (const name of ["typescript", "react", "postgresql"]) {
      const skill = await client.skill.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      await client.applicationSkill.create({
        data: { applicationId: app.id, skillId: skill.id },
      });
    }
    if (
      [
        "technical-interview",
        "recruiter-screen",
        "final-round",
        "phone-interview",
      ].includes(statusId)
    )
      await client.interview.create({
        data: {
          applicationId: app.id,
          type: statusId === "technical-interview" ? "Technical" : "Recruiter",
          startsAt: new Date(now + ((i % 4) + 1) * 86400000),
          timezone: "America/Los_Angeles",
          interviewer: "Alex Morgan",
          preparationNotes:
            "Review the team mission and prepare two project stories.",
        },
      });
    if (i % 4 === 0 && applied)
      await client.followUp.create({
        data: {
          applicationId: app.id,
          title: "Check in with the recruiter",
          dueAt: new Date(now + ((i % 3) - 1) * 86400000),
        },
      });
    if (i % 3 === 0) {
      await client.contact.create({
        data: {
          applicationId: app.id,
          name: "Alex Morgan",
          email: `recruiting@${companies[i % 6].toLowerCase().replace(/ /g, "")}.example`,
          role: "Recruiter",
        },
      });
      await client.note.create({
        data: {
          applicationId: app.id,
          body: "Interested in the engineering culture. Ask about mentorship and deployment ownership.",
        },
      });
    }
  }
}
