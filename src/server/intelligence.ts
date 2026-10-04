import { db } from "./db";
import { applicationInclude } from "./repository";
import {
  canonicalSkill,
  matchScore,
  skillCategory,
} from "@/lib/skills-intelligence";
const day = 86400000;
const closed = ["rejected", "withdrawn", "ghosted", "accepted"];
const responses = new Set([
  "oa",
  "recruiter-screen",
  "phone-interview",
  "technical-interview",
  "behavioral-interview",
  "onsite",
  "final-round",
  "offer",
  "accepted",
  "rejected",
]);
const mean = (a: number[]) =>
  a.length
    ? Math.round((a.reduce((n, v) => n + v, 0) / a.length) * 10) / 10
    : null;
export async function searchIntelligence(userId: string) {
  const [apps, skills, profile, messages] = await Promise.all([
    db.application.findMany({ where: { userId }, include: applicationInclude }),
    db.userSkill.findMany({ where: { userId } }),
    db.searchProfile.findUnique({ where: { userId } }),
    db.emailMessageMetadata.findMany({
      where: { userId },
      include: { actions: true },
      orderBy: { receivedAt: "desc" },
      take: 100,
    }),
  ]);
  const now = Date.now(),
    staleDays = profile?.staleDays || 21;
  const attention: {
    key: string;
    title: string;
    href: string;
    priority: number;
    reason: string;
  }[] = [];
  const cases = apps.map((a) => {
    const age = a.dateApplied ? Math.floor((now - +a.dateApplied) / day) : 0;
    const responded = a.history.some((h) => responses.has(h.toStatus));
    const upcoming = a.interviews.filter(
      (i) => +i.startsAt > now && i.outcome === "Scheduled",
    );
    const pending = messages.some(
      (m) =>
        m.applicationId === a.id &&
        m.actions.some((x) => x.decision === "pending"),
    );
    const health = closed.includes(a.statusId)
      ? "CLOSED"
      : pending
        ? "ACTION REQUIRED"
        : upcoming.length
          ? "INTERVIEWING"
          : age >= staleDays && !responded
            ? "STALE"
            : age >= 8 && !responded
              ? "WAITING"
              : "ACTIVE";
    if (!a.archivedAt && !closed.includes(a.statusId)) {
      if (age >= 10 && !responded)
        attention.push({
          key: `response:${a.id}`,
          title: `${a.company}: no response in ${age} days`,
          href: `/app/cases/${a.id}`,
          priority: age >= staleDays ? 65 : 50,
          reason:
            age >= staleDays
              ? "Stale case; consider a follow-up or closing it"
              : "Consider a polite follow-up",
        });
      if (age >= 8 && age < 10 && !responded)
        attention.push({
          key: `followup-recommendation:${a.id}`,
          title: `Follow-up recommended · ${a.company}`,
          href: `/app/cases/${a.id}`,
          priority: 30,
          reason:
            "Applied at least eight days ago without a recorded response. Draft a check-in; nothing is sent automatically.",
        });
      for (const i of upcoming)
        if (+i.startsAt - now <= day)
          attention.push({
            key: `interview:${i.id}`,
            title: `Interview within 24 hours · ${a.company}`,
            href: `/app/cases/${a.id}`,
            priority: 100,
            reason: i.startsAt.toISOString(),
          });
      for (const i of a.interviews)
        if (now - +i.startsAt > 0 && now - +i.startsAt < 2 * day)
          attention.push({
            key: `thankyou:${i.id}`,
            title: `Thank-you recommended · ${a.company}`,
            href: `/app/cases/${a.id}`,
            priority: 40,
            reason: "Recent interview; consider a short thank-you note.",
          });
      for (const f of a.followUps)
        if (!f.completedAt && +f.dueAt <= now + day)
          attention.push({
            key: `followup:${f.id}`,
            title: `${f.title} · ${a.company}`,
            href: `/app/cases/${a.id}`,
            priority: 80,
            reason: f.dueAt.toISOString(),
          });
    }
    return {
      id: a.id,
      company: a.company,
      position: a.position,
      status: a.status.label,
      health,
      age,
      match: matchScore(
        a.skills,
        skills,
        `${a.jobDescription} ${a.experienceRequirements}`,
        profile?.experienceYears || 0,
        profile?.education || "",
      ),
    };
  });
  for (const m of messages)
    if (m.actions.some((a) => a.decision === "pending"))
      attention.push({
        key: `email:${m.id}`,
        title: `Review ${m.category.replace(/_/g, " ").toLowerCase()} · ${m.company || m.subject}`,
        href: "/app/inbox",
        priority:
          m.category === "OFFER"
            ? 95
            : m.category === "ONLINE_ASSESSMENT"
              ? 90
              : 70,
        reason: `Match confidence ${m.confidence}% · ${m.applicationId ? "linked case" : "choose a case"}`,
      });
  attention.sort((a, b) => b.priority - a.priority);
  const demanded = new Map<
    string,
    {
      name: string;
      required: number;
      preferred: number;
      category: string;
      proficiency: string | null;
    }
  >();
  for (const a of apps.filter((a) => !a.archivedAt))
    for (const s of a.skills) {
      const name = canonicalSkill(s.skill.name),
        row = demanded.get(name) || {
          name,
          required: 0,
          preferred: 0,
          category: skillCategory(name),
          proficiency:
            skills.find((p) => canonicalSkill(p.name) === name)?.proficiency ||
            null,
        };
      if (s.preferred) row.preferred++;
      else row.required++;
      demanded.set(name, row);
    }
  function stats(group: typeof apps) {
    const applied = group.filter((a) => a.dateApplied),
      response = applied.filter((a) =>
        a.history.some((h) => responses.has(h.toStatus)),
      ),
      interview = applied.filter((a) =>
        a.history.some((h) => /interview|onsite|final-round/.test(h.toStatus)),
      ),
      offer = applied.filter((a) =>
        a.history.some((h) => ["offer", "accepted"].includes(h.toStatus)),
      );
    const timing = (filter: (s: string) => boolean) =>
      applied.flatMap((a) => {
        const h = a.history
          .filter((h) => filter(h.toStatus) && +h.createdAt >= +a.dateApplied!)
          .sort((x, y) => +x.createdAt - +y.createdAt)[0];
        return h ? [(+h.createdAt - +a.dateApplied!) / day] : [];
      });
    return {
      applications: applied.length,
      responses: response.length,
      interviews: interview.length,
      offers: offer.length,
      responseRate: applied.length
        ? Math.round((response.length / applied.length) * 100)
        : null,
      interviewRate: applied.length
        ? Math.round((interview.length / applied.length) * 100)
        : null,
      offerRate: applied.length
        ? Math.round((offer.length / applied.length) * 100)
        : null,
      firstResponse: mean(timing((s) => responses.has(s))),
      firstInterview: mean(
        timing((s) => /interview|onsite|final-round/.test(s)),
      ),
      rejection: mean(timing((s) => s === "rejected")),
      offer: mean(timing((s) => ["offer", "accepted"].includes(s))),
      completedProcess: mean(
        timing((s) => ["accepted", "rejected", "withdrawn"].includes(s)),
      ),
    };
  }
  const source = [...new Set(apps.map((a) => a.source))].map((name) => ({
    name,
    ...stats(apps.filter((a) => a.source === name)),
  }));
  const weeklySources = [...new Set(apps.map((a) => a.source))].map((name) => ({
    name,
    ...stats(
      apps.filter(
        (a) =>
          a.source === name &&
          a.dateApplied &&
          +a.dateApplied >= now - 7 * day &&
          +a.dateApplied <= now,
      ),
    ),
  }));
  const companies = [...new Set(apps.map((a) => a.company))].map((name) => {
    const group = apps.filter((a) => a.company === name);
    return {
      name,
      roles: group.map((a) => ({
        id: a.id,
        position: a.position,
        status: a.status.label,
      })),
      contacts: group.flatMap((a) =>
        a.contacts.map((c) => ({ name: c.name, email: c.email, role: c.role })),
      ),
      active: group.filter((a) => !a.archivedAt && !closed.includes(a.statusId))
        .length,
      ...stats(group),
      responseSample: group.filter((a) =>
        a.history.some((h) => responses.has(h.toStatus)),
      ).length,
    };
  });
  const stages = [
    { name: "Saved", test: () => true },
    { name: "Applied", test: (a: (typeof apps)[number]) => !!a.dateApplied },
    {
      name: "Responded",
      test: (a: (typeof apps)[number]) =>
        a.history.some((h) => responses.has(h.toStatus)),
    },
    {
      name: "Interview",
      test: (a: (typeof apps)[number]) =>
        a.history.some((h) => /interview|onsite|final-round/.test(h.toStatus)),
    },
    {
      name: "Final round",
      test: (a: (typeof apps)[number]) =>
        a.history.some((h) => h.toStatus === "final-round"),
    },
    {
      name: "Offer",
      test: (a: (typeof apps)[number]) =>
        a.history.some((h) => ["offer", "accepted"].includes(h.toStatus)),
    },
    {
      name: "Accepted",
      test: (a: (typeof apps)[number]) =>
        a.history.some((h) => h.toStatus === "accepted"),
    },
  ].map((s) => ({ name: s.name, count: apps.filter(s.test).length }));
  const pref = await db.userPreference.findUnique({ where: { userId } }),
    zone = pref?.timezone || "UTC";
  const dateKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  const counts = new Map<string, number>();
  for (const a of apps)
    if (a.dateApplied) {
      const k = dateKey(a.dateApplied);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  const today = dateKey(new Date()),
    cursor = new Date(`${today}T12:00:00Z`),
    heatmap = [];
  let longest = 0,
    run = 0;
  for (let i = 364; i >= 0; i--) {
    const d = new Date(+cursor - i * day),
      date = d.toISOString().slice(0, 10),
      count = counts.get(date) || 0;
    heatmap.push({ date, count });
    run = count ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  let offset = counts.get(today) ? 0 : 1;
  while (
    counts.get(new Date(+cursor - offset * day).toISOString().slice(0, 10))
  ) {
    current++;
    offset++;
  }
  const busiest = [...counts].sort((a, b) => b[1] - a[1])[0];
  const week = (start: number, end: number) => ({
    applications: apps.filter(
      (a) => a.dateApplied && +a.dateApplied >= start && +a.dateApplied < end,
    ).length,
    responses: apps.filter((a) =>
      a.history.some(
        (h) =>
          responses.has(h.toStatus) &&
          +h.createdAt >= start &&
          +h.createdAt < end,
      ),
    ).length,
    interviews: apps
      .flatMap((a) => a.interviews)
      .filter((i) => +i.createdAt >= start && +i.createdAt < end).length,
    rejections: apps.filter((a) =>
      a.history.some(
        (h) =>
          h.toStatus === "rejected" &&
          +h.createdAt >= start &&
          +h.createdAt < end,
      ),
    ).length,
    offers: apps.filter((a) =>
      a.history.some(
        (h) =>
          h.toStatus === "offer" && +h.createdAt >= start && +h.createdAt < end,
      ),
    ).length,
  });
  const demandedSkills = [...demanded.values()].sort(
    (a, b) => b.required - a.required,
  );
  const activity = apps
    .flatMap((a) =>
      a.activities.map((e) => ({
        id: e.id,
        company: a.company,
        applicationId: a.id,
        message: e.message,
        source: e.source,
        date: e.createdAt.toISOString(),
      })),
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 100);
  return {
    cases,
    attention,
    skills,
    profile: profile || { experienceYears: 0, education: "", staleDays: 21 },
    demandedSkills,
    source,
    companies,
    timing: stats(apps),
    funnel: stages,
    heatmap,
    patrol: {
      current,
      longest,
      busiest: busiest ? { date: busiest[0], count: busiest[1] } : null,
      averagePerWeek:
        Math.round((heatmap.reduce((n, d) => n + d.count, 0) / 52) * 10) / 10,
    },
    weekly: {
      current: week(now - 7 * day, now),
      previous: week(now - 14 * day, now - 7 * day),
      bestSource:
        weeklySources
          .filter((s) => s.applications >= 3 && s.responseRate !== null)
          .sort((a, b) => (b.responseRate || 0) - (a.responseRate || 0))[0]
          ?.name || null,
      missingSkill:
        demandedSkills.find((s) => !s.proficiency && s.required)?.name || null,
      attention: attention.length,
    },
    activity,
  };
}
export type Intelligence = Awaited<ReturnType<typeof searchIntelligence>>;
export async function generateNotifications(userId: string) {
  const data = await searchIntelligence(userId);
  for (const a of data.attention.filter((a) => a.priority >= 70))
    await db.notification.upsert({
      where: { userId_key: { userId, key: a.key } },
      create: { userId, key: a.key, title: a.title, href: a.href },
      update: {},
    });
}
