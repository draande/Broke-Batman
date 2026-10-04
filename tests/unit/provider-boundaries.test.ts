import { describe, expect, it } from "vitest";
import { gmailMessage, gmailPage, googleToken } from "@/schemas/gmail";
import { suggestionDetails } from "@/schemas/suggestion";
describe("provider boundaries", () => {
  it("rejects incomplete or malformed Gmail payloads before ingestion", () => {
    expect(gmailPage.safeParse({ messages: [{ id: null }] }).success).toBe(
      false,
    );
    expect(googleToken.safeParse({ access_token: 42 }).success).toBe(false);
    expect(
      gmailMessage.safeParse({ id: "a", threadId: "b", internalDate: "bad" })
        .success,
    ).toBe(false);
    expect(
      gmailMessage.safeParse({
        id: "a",
        threadId: "b",
        internalDate: "0",
        payload: { parts: [{ mimeType: "text/plain", body: { data: "YQ" } }] },
      }).success,
    ).toBe(true);
  });
  it("handles damaged stored suggestion JSON without crashing the review screen", () => {
    expect(suggestionDetails(null)).toEqual({});
    expect(suggestionDetails({ startsAt: "not-a-date" })).toEqual({});
    expect(suggestionDetails({ startsAt: null, duration: 45 })).toEqual({
      startsAt: null,
      duration: 45,
    });
    expect(
      suggestionDetails({ startsAt: "2026-10-03T17:00:00Z", meetingURL: null })
        .startsAt,
    ).toBe("2026-10-03T17:00:00Z");
  });
});
