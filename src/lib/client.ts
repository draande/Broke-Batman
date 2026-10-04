import { z } from "zod";
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Lost contact with the Batcave. Please try again.";
}
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
  }).catch(() => {
    throw new RequestError(
      "Lost contact with the Batcave. Check your connection and try again.",
      0,
    );
  });
  const data: unknown = await response.json().catch(() => {
    throw new RequestError(
      "The Batcomputer returned an unreadable response. Please retry.",
      response.status,
    );
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("auth/"))
      window.location.assign("/login");
    const parsed = z
      .object({
        error: z.string().optional(),
        details: z.unknown().optional(),
      })
      .safeParse(data);
    const failure = parsed.success ? parsed.data : {};
    const validation = z
      .object({ fieldErrors: z.record(z.array(z.string())) })
      .safeParse(failure.details);
    const details = validation.success
      ? Object.entries(validation.data.fieldErrors)
          .map(([k, v]) => `${k}: ${v.join(", ")}`)
          .join(" · ")
      : "";
    throw new RequestError(
      details || failure.error || "Request failed",
      response.status,
      failure.details,
    );
  }
  return data as T;
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
