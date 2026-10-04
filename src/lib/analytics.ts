type Item = {
  dateApplied: Date | string | null;
  createdAt: Date | string;
  company: string;
  source: string;
  workMode: string;
  status: { id: string; label: string; category: string };
  history: { createdAt: Date | string; toStatus: string }[];
};
export function computeAnalytics(
  apps: Item[],
  now = new Date(),
  timezone = "America/Los_Angeles",
) {
  const applied = apps.filter((a) => a.dateApplied);
  const responded = applied.filter((a) =>
    a.history.some(
      (h) =>
        !["saved", "preparing", "applied", "withdrawn", "ghosted"].includes(
          h.toStatus,
        ),
    ),
  );
  const interviews = apps.filter((a) =>
    a.history.some((h) =>
      [
        "oa",
        "recruiter-screen",
        "phone-interview",
        "technical-interview",
        "behavioral-interview",
        "onsite",
        "final-round",
      ].includes(h.toStatus),
    ),
  );
  const offers = apps.filter((a) =>
    a.history.some((h) => ["offer", "accepted"].includes(h.toStatus)),
  );
  const rate = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const by = (key: (a: Item) => string) =>
    Object.entries(
      apps.reduce<Record<string, number>>((m, a) => {
        const k = key(a) || "Unknown";
        m[k] = (m[k] || 0) + 1;
        return m;
      }, {}),
    )
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  const dateKey = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    return ["year", "month", "day"]
      .map((type) => parts.find((p) => p.type === type)!.value)
      .join("-");
  };
  const today = dateKey(now);
  const dayKeys = new Set(
    applied.map((a) => dateKey(new Date(a.dateApplied!))),
  );
  let streak = 0;
  const cursor = new Date(`${today}T12:00:00Z`);
  if (!dayKeys.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (dayKeys.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const week = Array.from({ length: 8 }, (_, i) => {
    const end = new Date(now.getTime() - (7 - i) * 7 * 86400000),
      start = new Date(end.getTime() - 7 * 86400000);
    return {
      name: start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: timezone,
      }),
      value: applied.filter(
        (a) =>
          new Date(a.dateApplied!) >= start && new Date(a.dateApplied!) < end,
      ).length,
    };
  });
  // Last bucket covers the most recent seven days, including today.
  week[7] = {
    name: "This week",
    value: applied.filter(
      (a) =>
        new Date(a.dateApplied!) >= new Date(now.getTime() - 7 * 86400000) &&
        new Date(a.dateApplied!) <= now,
    ).length,
  };
  const responseDays = responded.flatMap((a) => {
    const first = a.history
      .filter(
        (h) =>
          !["saved", "preparing", "applied", "withdrawn", "ghosted"].includes(
            h.toStatus,
          ) && new Date(h.createdAt) >= new Date(a.dateApplied!),
      )
      .sort((x, y) => +new Date(x.createdAt) - +new Date(y.createdAt))[0];
    return first
      ? [(+new Date(first.createdAt) - +new Date(a.dateApplied!)) / 86400000]
      : [];
  });
  const stages = apps.flatMap((a) => {
    const h = [...a.history].sort(
      (x, y) => +new Date(x.createdAt) - +new Date(y.createdAt),
    );
    return h.slice(1).map((v, i) => ({
      name: `${h[i].toStatus} → ${v.toStatus}`,
      days: (+new Date(v.createdAt) - +new Date(h[i].createdAt)) / 86400000,
    }));
  });
  const stageNames = [...new Set(stages.map((s) => s.name))];
  const averageStageDays = stageNames.map((name) => {
    const values = stages.filter((s) => s.name === name);
    return {
      name,
      value:
        Math.round(
          (values.reduce((sum, v) => sum + v.days, 0) / values.length) * 10,
        ) / 10,
    };
  });
  const finals = apps.filter((a) =>
    a.history.some(
      (h) => h.toStatus === "final-round" || h.toStatus === "onsite",
    ),
  ).length;
  const funnelCounts = [
    applied.length,
    responded.length,
    interviews.filter((a) => a.dateApplied).length,
    finals,
    offers.filter((a) => a.dateApplied).length,
  ];
  return {
    total: apps.length,
    applied: applied.length,
    thisWeek: week[7].value,
    today: applied.filter((a) => dateKey(new Date(a.dateApplied!)) === today)
      .length,
    interviews: interviews.length,
    offers: offers.length,
    rejections: apps.filter((a) => a.status.id === "rejected").length,
    ghosted: apps.filter((a) => a.status.id === "ghosted").length,
    responseRate: rate(responded.length, applied.length),
    interviewRate: rate(
      interviews.filter((a) => a.dateApplied).length,
      applied.length,
    ),
    offerRate: rate(offers.filter((a) => a.dateApplied).length, applied.length),
    streak,
    averageResponseDays: responseDays.length
      ? Math.round(
          (responseDays.reduce((a, b) => a + b, 0) / responseDays.length) * 10,
        ) / 10
      : null,
    averageStageDays,
    weekly: week,
    byCompany: by((a) => a.company),
    bySource: by((a) => a.source),
    byStatus: by((a) => a.status.label),
    byWorkMode: by((a) => a.workMode),
    pipeline: ["saved", "applied", "interview", "offer"].map((category) => ({
      name:
        category === "interview"
          ? "Interviewing"
          : category[0].toUpperCase() + category.slice(1),
      value: apps.filter(
        (a) =>
          a.status.category === category ||
          (category === "interview" && a.status.category === "final"),
      ).length,
    })),
    funnel: [
      "Applications",
      "Responses",
      "Interviews",
      "Final rounds",
      "Offers",
    ].map((name, i) => ({
      name,
      value: funnelCounts[i],
      conversion: i ? rate(funnelCounts[i], funnelCounts[i - 1]) : 100,
    })),
  };
}
