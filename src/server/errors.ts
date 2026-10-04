import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof APIError)
    return Response.json(
      { error: error.message, details: error.details },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return Response.json(
      { error: "Please check the form fields.", details: error.flatten() },
      { status: 422 },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return Response.json(
      { error: "That record already exists." },
      { status: 409 },
    );
  if (error instanceof SyntaxError)
    return Response.json({ error: "Malformed JSON." }, { status: 400 });
  console.error(
    JSON.stringify({
      event: "request_failed",
      errorType: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  return Response.json(
    { error: "The Batcomputer encountered an error. Please try again." },
    { status: 500 },
  );
}
export async function jsonBody(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 1_000_000)
    throw new APIError(413, "Request is too large. Maximum size is 1 MB.");
  const reader = request.body?.getReader();
  if (!reader) throw new APIError(400, "Missing request body.");
  const parts: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 1_000_000) {
      await reader.cancel();
      throw new APIError(413, "Request is too large. Maximum size is 1 MB.");
    }
    parts.push(value);
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}
