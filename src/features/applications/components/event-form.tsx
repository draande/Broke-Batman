"use client";
import { useState } from "react";
import type { Application } from "@/types/domain";
import { api, errorMessage } from "@/lib/client";
import { Field, Modal } from "@/components/ui";
type Kind = "interviews" | "follow-ups" | "contacts" | "notes";
export function EventForm({
  kind,
  appId,
  onClose,
  onSaved,
  existing,
  timezone = "America/Los_Angeles",
}: {
  kind: Kind;
  appId: string;
  onClose: () => void;
  onSaved: () => void;
  existing?:
    | Application["interviews"][number]
    | Application["contacts"][number]
    | Application["notes"][number];
  timezone?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const value = (key: string, fallback = "") =>
    String((existing as unknown as Record<string, unknown>)?.[key] ?? fallback);
  const localDate = (date: string) => {
    const d = new Date(date);
    return new Date(+d - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget),
    );
    if (body.startsAt)
      body.startsAt = new Date(String(body.startsAt)).toISOString();
    if (body.dueAt) body.dueAt = new Date(String(body.dueAt)).toISOString();
    try {
      await api(
        `applications/${appId}/${kind}${existing ? `/${existing.id}` : ""}`,
        existing ? "PUT" : "POST",
        body,
      );
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const labels = {
    interviews: "interview",
    "follow-ups": "follow-up",
    contacts: "contact",
    notes: "note",
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`${existing ? "Edit" : "Add"} ${labels[kind]}`}
      description="Keep the next step on your radar."
    >
      <form onSubmit={submit} className="form-body">
        {kind === "interviews" && (
          <>
            <div className="form-grid">
              <Field label="Interview type">
                <select name="type" defaultValue={value("type", "Technical")}>
                  {[
                    "Recruiter",
                    "Phone",
                    "Technical",
                    "Behavioral",
                    "System Design",
                    "Hiring Manager",
                    "Onsite",
                    "Final",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Date and time (your browser's local time)">
                <input
                  type="datetime-local"
                  name="startsAt"
                  required
                  defaultValue={
                    value("startsAt") ? localDate(value("startsAt")) : ""
                  }
                />
              </Field>
              <Field
                label="Display timezone"
                hint="IANA timezone; the chosen time above uses your device timezone."
              >
                <input
                  name="timezone"
                  defaultValue={value("timezone", timezone)}
                  required
                />
              </Field>
              <Field label="Interviewer">
                <input name="interviewer" defaultValue={value("interviewer")} />
              </Field>
            </div>
            <Field label="Meeting URL">
              <input
                name="meetingURL"
                type="url"
                defaultValue={value("meetingURL")}
              />
            </Field>
            <Field label="Preparation notes">
              <textarea
                name="preparationNotes"
                rows={3}
                defaultValue={value("preparationNotes")}
              />
            </Field>
            <Field label="Interview notes">
              <textarea name="notes" rows={3} defaultValue={value("notes")} />
            </Field>
            <Field label="Outcome">
              <select
                name="outcome"
                defaultValue={value("outcome", "Scheduled")}
              >
                {[
                  "Scheduled",
                  "Completed",
                  "Passed",
                  "Declined",
                  "Cancelled",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </>
        )}
        {kind === "follow-ups" && (
          <>
            <Field label="What needs doing?">
              <input
                name="title"
                required
                placeholder="Follow up with recruiter"
                maxLength={300}
              />
            </Field>
            <Field label="Due date and time (your browser's local time)">
              <input name="dueAt" type="datetime-local" required />
            </Field>
          </>
        )}
        {kind === "contacts" && (
          <>
            <Field label="Name">
              <input
                name="name"
                required
                defaultValue={value("name")}
                maxLength={200}
              />
            </Field>
            <Field label="Email">
              <input name="email" type="email" defaultValue={value("email")} />
            </Field>
            <Field label="Role">
              <input
                name="role"
                defaultValue={value("role", "Recruiter")}
                required
                maxLength={100}
              />
            </Field>
          </>
        )}
        {kind === "notes" && (
          <Field label="Personal note">
            <textarea
              name="body"
              rows={7}
              required
              maxLength={20000}
              defaultValue={value("body")}
            />
          </Field>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
