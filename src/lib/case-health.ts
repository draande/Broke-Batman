export function caseHealth(
  app: {
    statusId: string;
    dateApplied: Date | string | null;
    interviews: { startsAt: Date | string; outcome: string }[];
    history: { toStatus: string }[];
  },
  staleDays = 21,
  pending = false,
  now = Date.now(),
) {
  if (["rejected", "withdrawn", "ghosted", "accepted"].includes(app.statusId))
    return "CLOSED";
  if (pending) return "ACTION REQUIRED";
  if (
    app.interviews.some(
      (i) => i.outcome === "Scheduled" && +new Date(i.startsAt) > now,
    )
  )
    return "INTERVIEWING";
  const age = app.dateApplied
    ? (now - +new Date(app.dateApplied)) / 86400000
    : 0;
  const response = app.history.some(
    (h) =>
      !["saved", "preparing", "applied", "withdrawn", "ghosted"].includes(
        h.toStatus,
      ),
  );
  return !response && age >= staleDays
    ? "STALE"
    : !response && age >= 8
      ? "WAITING"
      : "ACTIVE";
}
