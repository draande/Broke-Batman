"use client";
import { useCallback, useEffect, useState } from "react";
import { suggestionDetails } from "@/schemas/suggestion";
import Link from "next/link";
import type { Inbox, Mail } from "@/types/domain";
import { api, timeLabel, errorMessage } from "@/lib/client";
import { categories } from "@/lib/email-intelligence";
import { Field, Modal, Skeleton } from "@/components/ui";
export function BatInbox({
  notify,
  refresh,
}: {
  notify: (m: string, e?: boolean) => void;
  refresh: () => void;
}) {
  const [data, setData] = useState<Inbox | null>(null),
    [category, setCategory] = useState(""),
    [review, setReview] = useState(true),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [viewEmail, setViewEmail] = useState<Mail | null>(null),
    [interview, setInterview] = useState<Mail["actions"][number] | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sync") === "1") {
      void api("gmail/sync", "POST")
        .then(() => notify("Sync queued."))
        .catch((e) => notify(e.message, true));
      window.history.replaceState(null, "", "/app/inbox");
    }
  }, [notify]);
  const reload = useCallback(
    () =>
      api<Inbox>(
        `inbox?${new URLSearchParams({ category, review: String(review), page: String(page) })}`,
      )
        .then((r) => {
          setData(r);
          setError("");
        })
        .catch((e) => setError(e.message)),
    [category, review, page],
  );
  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [reload]);
  async function act(
    id: string,
    decision: string,
    details?: Record<string, unknown>,
  ) {
    setBusy(true);
    try {
      await api(`suggestions/${id}`, "POST", { decision, details });
      setInterview(null);
      await reload();
      refresh();
      notify(
        decision === "approved"
          ? "Suggestion approved. Case timeline updated."
          : "Suggestion dismissed.",
      );
    } catch (e) {
      notify(errorMessage(e), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">INCOMING SIGNALS</div>
          <h1>Bat-Inbox</h1>
          <p>
            Job-search messages only. Every suggested change is yours to
            approve.
          </p>
        </div>
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("gmail/sync", "POST");
              notify("Sync queued. The background worker will process it.");
            } catch (e) {
              notify(errorMessage(e), true);
            } finally {
              setBusy(false);
            }
          }}
        >
          Sync Gmail
        </button>
      </div>
      <div className="panel intelligence-filters">
        <Field label="Inbox section">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All job-search messages</option>
            {categories
              .filter((c) => c !== "UNKNOWN")
              .map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
          </select>
        </Field>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={review}
            onChange={(e) => {
              setReview(e.target.checked);
              setPage(1);
            }}
          />{" "}
          Needs attention only
        </label>
      </div>
      {error ? (
        <div className="panel empty">
          <p role="alert" className="form-error">
            {error}
          </p>
          <button className="button" onClick={reload}>
            Try again
          </button>
        </div>
      ) : !data ? (
        <Skeleton />
      ) : !data.items.length ? (
        <div className="panel empty">
          <h2>Gotham is quiet.</h2>
          <p>
            Connect Gmail or try the fictional demo in Batcomputer Integrations.
          </p>
          <Link className="button secondary" href="/app/settings">
            Open integrations
          </Link>
        </div>
      ) : (
        data.items.map((m) => (
          <article className="panel mail-card" key={m.id}>
            <div className="mail-heading">
              <div>
                <span className="eyebrow">
                  {m.category.replace(/_/g, " ")}
                  {m.demo ? " · DEMO / FICTIONAL" : ""}
                </span>
                <h2>{m.subject}</h2>
                <p className="muted">
                  {m.sender} · {timeLabel(String(m.receivedAt))}
                </p>
              </div>
              {!m.demo && (
                <a
                  className="button secondary"
                  href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(data.account)}#all/${encodeURIComponent(m.threadId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View email
                </a>
              )}
              {m.demo && (
                <button
                  className="button secondary"
                  onClick={() => setViewEmail(m)}
                >
                  View demo email
                </button>
              )}
            </div>
            <p>{m.snippet}</p>
            <div className="mail-evidence">
              <strong>Match confidence: {m.confidence}%</strong>
              <p>{(m.reasons as string[]).join(" · ")}</p>
              <Field label={`Linked case for ${m.subject}`}>
                <select
                  value={m.applicationId || ""}
                  disabled={busy}
                  onChange={async (e) => {
                    if (!e.target.value) return;
                    setBusy(true);
                    try {
                      await api(`inbox/${m.id}`, "PATCH", {
                        applicationId: e.target.value,
                      });
                      await reload();
                    } catch (e) {
                      notify(errorMessage(e), true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <option value="">Choose a case — uncertain match</option>
                  {data.apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.company} · {a.position}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mail-actions">
              {m.actions.map((a) => (
                <div key={a.id}>
                  <span>
                    {a.kind === "status"
                      ? `Suggested status: ${suggestionDetails(a.payload).statusId}`
                      : a.kind === "interview"
                        ? "Interview detected — confirm details"
                        : a.kind === "assessment"
                          ? "Assessment deadline detected"
                          : a.kind === "followup"
                            ? "Interview availability reply recommended"
                            : "Recruiter contact detected"}
                  </span>
                  {a.decision === "pending" ? (
                    <div className="button-row">
                      <button
                        className="button"
                        disabled={busy || !m.applicationId}
                        onClick={() =>
                          a.kind === "interview"
                            ? setInterview(a)
                            : void act(a.id, "approved")
                        }
                      >
                        {a.kind === "interview"
                          ? "Add interview"
                          : a.kind === "contact"
                            ? "Add contact"
                            : a.kind === "assessment"
                              ? "Add assessment reminder"
                              : a.kind === "followup"
                                ? "Add reply reminder"
                                : "Approve status"}
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => void act(a.id, "dismissed")}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <small className="muted">
                      {a.decision} ·{" "}
                      {a.decidedAt ? timeLabel(String(a.decidedAt)) : ""}
                    </small>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))
      )}
      {data && data.pages > 1 && (
        <div className="button-row">
          <button
            className="button secondary"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {data.pages}
          </span>
          <button
            className="button secondary"
            disabled={page === data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
      {viewEmail && (
        <Modal
          open
          onClose={() => setViewEmail(null)}
          title={viewEmail.subject}
          description="Fictional demonstration email. No Gmail account is accessed."
        >
          <div className="form-body">
            <strong>{viewEmail.sender}</strong>
            <p>{viewEmail.snippet}</p>
            <p className="muted">
              Received {timeLabel(String(viewEmail.receivedAt))}. This view
              shows the stored demo excerpt.
            </p>
          </div>
        </Modal>
      )}
      {interview && (
        <Modal
          open
          onClose={() => setInterview(null)}
          title="Confirm interview details"
          description="Verify date, time, timezone, and meeting link against the original email."
        >
          <form
            className="form-body"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void act(interview.id, "approved", {
                type: String(form.get("type")),
                startsAt: new Date(String(form.get("startsAt"))).toISOString(),
                timezone: String(form.get("timezone")),
                meetingURL: String(form.get("meetingURL")) || undefined,
                interviewer: String(form.get("interviewer")),
                notes: `Email detected duration: ${suggestionDetails(interview.payload).duration ?? "unknown"} minutes. Confirmed manually.`,
              });
            }}
          >
            <Field label="Interview type">
              <select
                name="type"
                defaultValue={suggestionDetails(interview.payload).type}
              >
                {[
                  "Recruiter",
                  "Phone",
                  "Technical",
                  "Behavioral",
                  "System Design",
                  "Hiring Manager",
                  "Onsite",
                  "Final",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Date and time (your device timezone)">
              <input
                type="datetime-local"
                name="startsAt"
                required
                defaultValue={(() => {
                  const t = suggestionDetails(interview.payload).startsAt;
                  if (!t) return "";
                  const d = new Date(t);
                  return new Date(+d - d.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16);
                })()}
              />
            </Field>
            <Field label="Interview timezone">
              <input
                name="timezone"
                required
                defaultValue={suggestionDetails(interview.payload).timezone}
              />
            </Field>
            <Field label="Meeting URL">
              <input
                name="meetingURL"
                type="url"
                defaultValue={
                  suggestionDetails(interview.payload).meetingURL || ""
                }
              />
            </Field>
            <Field label="Interviewer">
              <input name="interviewer" />
            </Field>
            <button className="button" disabled={busy}>
              Confirm and create interview
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
