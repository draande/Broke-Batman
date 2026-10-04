export function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function normalizedURL(value?: string | null) {
  if (!value) return "";
  try {
    const u = new URL(value);
    const identifiers = [
      "jobId",
      "job_id",
      "gh_jid",
      "requisitionId",
      "jk",
    ].flatMap((key) =>
      u.searchParams.get(key) ? [`${key}=${u.searchParams.get(key)}`] : [],
    );
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, "")}${identifiers.length ? `?${identifiers.join("&")}` : ""}`;
  } catch {
    return "";
  }
}
export function similarDescriptions(a: string, b: string) {
  const words = (s: string) =>
    new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const x = words(a),
    y = words(b);
  if (x.size < 15 || y.size < 15) return false;
  const overlap = [...x].filter((w) => y.has(w)).length;
  return overlap / (x.size + y.size - overlap) > 0.8;
}
export function likelyDuplicate(
  a: {
    company: string;
    position: string;
    jobPostingURL?: string | null;
    jobDescription: string;
  },
  b: {
    company: string;
    position: string;
    jobPostingURL?: string | null;
    jobDescription: string;
  },
) {
  return (
    (!!normalizedURL(a.jobPostingURL) &&
      normalizedURL(a.jobPostingURL) === normalizedURL(b.jobPostingURL)) ||
    (normalize(a.company) === normalize(b.company) &&
      (normalize(a.position) === normalize(b.position) ||
        similarDescriptions(a.jobDescription, b.jobDescription)))
  );
}
