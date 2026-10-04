export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("auth/"))
      window.location.assign("/login");
    const details = data.details?.fieldErrors
      ? Object.entries(data.details.fieldErrors)
          .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
          .join(" · ")
      : "";
    throw new RequestError(
      details || data.error || "Request failed",
      response.status,
      data.details,
    );
  }
  return data;
}
export const dateLabel = (
  date: string | Date | null | undefined,
  timezone?: string,
) =>
  date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
      })
    : "—";
export const timeLabel = (date: string, timezone?: string) =>
  new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
