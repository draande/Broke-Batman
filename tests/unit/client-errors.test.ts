import { afterEach, describe, expect, it, vi } from "vitest";
import { api, RequestError } from "@/lib/client";
afterEach(() => vi.unstubAllGlobals());
describe("client error responses", () => {
  it("preserves duplicate review evidence and its server message", async () => {
    const duplicates = [
      {
        id: "case-1",
        company: "Wayne",
        position: "Engineer",
        status: "Applied",
        source: "Direct",
        age: 3,
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: "This case may already be in the Batcomputer.",
            details: duplicates,
          },
          { status: 409 },
        ),
      ),
    );
    await expect(api("applications", "POST", {})).rejects.toMatchObject({
      status: 409,
      message: "This case may already be in the Batcomputer.",
      details: duplicates,
    });
  });
  it("displays structured field errors while retaining their details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: "Check fields",
            details: { fieldErrors: { company: ["Required"] } },
          },
          { status: 422 },
        ),
      ),
    );
    await expect(api("applications", "POST", {})).rejects.toMatchObject({
      status: 422,
      message: "company: Required",
    });
  });
  it("does not display an untrusted malformed error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { stack: "private internals" } },
            { status: 500 },
          ),
        ),
    );
    await expect(api("applications")).rejects.toMatchObject({
      status: 500,
      message: "Request failed",
    });
  });
  it("gives a useful offline message and handles non-JSON server failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(api("applications")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("Lost contact with the Batcave"),
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<html>internal error</html>", { status: 503 }),
        ),
    );
    await expect(api("applications")).rejects.toBeInstanceOf(RequestError);
  });
});
