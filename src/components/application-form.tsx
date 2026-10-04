"use client";
import { useState } from "react";
import { ScanLine, LoaderCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Field, Modal } from "./ui";
import { api, RequestError } from "@/lib/client";
import type { Application, Status } from "@/lib/types";
type Draft = {
  company: string;
  position: string;
  jobPostingURL: string;
  jobDescription: string;
  location: string;
  workMode: string;
  employmentType: string;
  salaryMinimum: string;
  salaryMaximum: string;
  salaryCurrency: string;
  datePosted: string;
  dateApplied: string;
  applicationDeadline: string;
  statusId: string;
  source: string;
  requiredSkills: string;
  preferredSkills: string;
  experienceRequirements: string;
  notes: string;
  contactName: string;
  contactEmail: string;
  recruiterName: string;
  recruiterEmail: string;
};
const initial: Draft = {
  company: "",
  position: "",
  jobPostingURL: "",
  jobDescription: "",
  location: "",
  workMode: "Remote",
  employmentType: "Full-time",
  salaryMinimum: "",
  salaryMaximum: "",
  salaryCurrency: "USD",
  datePosted: "",
  dateApplied: "",
  applicationDeadline: "",
  statusId: "saved",
  source: "Direct",
  requiredSkills: "",
  preferredSkills: "",
  experienceRequirements: "",
  notes: "",
  contactName: "",
  contactEmail: "",
  recruiterName: "",
  recruiterEmail: "",
};
export function ApplicationForm({
  open,
  onClose,
  onSaved,
  statuses,
  application,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  statuses: Status[];
  application?: Application;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    application
      ? ({
          ...initial,
          ...Object.fromEntries(
            Object.keys(initial).map((k) => [
              k,
              (application as unknown as Record<string, unknown>)[k] ??
                initial[k as keyof Draft],
            ]),
          ),
          notes: "",
          salaryMinimum: String(application.salaryMinimum ?? ""),
          salaryMaximum: String(application.salaryMaximum ?? ""),
          datePosted: application.datePosted?.slice(0, 10) || "",
          dateApplied: application.dateApplied?.slice(0, 10) || "",
          applicationDeadline:
            application.applicationDeadline?.slice(0, 10) || "",
          requiredSkills: application.skills
            .filter((s) => !s.preferred)
            .map((s) => s.skill.name)
            .join(", "),
          preferredSkills: application.skills
            .filter((s) => s.preferred)
            .map((s) => s.skill.name)
            .join(", "),
        } as Draft)
      : initial,
  );
  const [step, setStep] = useState<"manual" | "analyze">("manual"),
    [input, setInput] = useState(""),
    [mode, setMode] = useState("text"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [warnings, setWarnings] = useState<string[]>([]),
    [duplicates, setDuplicates] = useState<
      {
        id: string;
        company: string;
        position: string;
        status: string;
        source: string;
        age: number;
      }[]
    >([]);
  const set = (key: keyof Draft, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));
  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        data: Record<string, unknown>;
        warnings: string[];
      }>("extract", "POST", mode === "url" ? { url: input } : { text: input });
      setDraft((d) => ({
        ...d,
        ...Object.fromEntries(
          Object.entries(result.data)
            .filter(([key]) => key in initial)
            .map(([key, v]) => [
              key,
              Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v),
            ]),
        ),
      }));
      setWarnings(result.warnings);
      setStep("manual");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(allowDuplicate = false) {
    setBusy(true);
    setError("");
    try {
      await api(
        `applications${application ? `/${application.id}` : ""}`,
        application ? "PUT" : "POST",
        {
          ...draft,
          salaryMinimum: draft.salaryMinimum
            ? Number(draft.salaryMinimum)
            : null,
          salaryMaximum: draft.salaryMaximum
            ? Number(draft.salaryMaximum)
            : null,
          requiredSkills: draft.requiredSkills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          preferredSkills: draft.preferredSkills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          allowDuplicate,
        },
      );
      onSaved();
      onClose();
    } catch (e) {
      if (
        e instanceof RequestError &&
        e.status === 409 &&
        Array.isArray(e.details)
      )
        setDuplicates(e.details);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const text = (
    key: keyof Draft,
    label: string,
    type = "text",
    required = false,
  ) => (
    <Field label={label}>
      <input
        value={draft[key]}
        onChange={(e) => set(key, e.target.value)}
        type={type}
        required={required}
        maxLength={type === "url" ? 2048 : type === "text" ? 200 : undefined}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
      />
    </Field>
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={application ? "Edit case" : "Open a new case"}
      description="Every opportunity deserves a place in the Batcomputer."
      wide
    >
      {!application && (
        <div className="segmented">
          <button
            className={step === "manual" ? "active" : ""}
            onClick={() => {
              setStep("manual");
              setError("");
            }}
          >
            Enter manually
          </button>
          <button
            className={step === "analyze" ? "active" : ""}
            onClick={() => {
              setStep("analyze");
              setError("");
            }}
          >
            <ScanLine size={16} /> Analyze job posting
          </button>
        </div>
      )}
      {step === "analyze" ? (
        <div className="form-body">
          <p className="muted">
            Paste the posting. We&apos;ll extract recognizable fields for you to
            review. Unknown fields stay blank.
          </p>
          <Field label="Input type">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="text">Copied job description</option>
              <option value="url">Public posting URL</option>
            </select>
          </Field>
          <Field label={mode === "url" ? "Posting URL" : "Job description"}>
            {mode === "url" ? (
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                type="url"
                placeholder="https://careers.example.com/jobs/123"
              />
            ) : (
              <textarea
                rows={10}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  "Company: Wayne Enterprises\nTitle: Software Engineer\nLocation: Gotham City\nFull-time · Hybrid\nSalary: $120,000 - $160,000\nRequired: TypeScript, React, PostgreSQL\n3+ years of experience building reliable systems."
                }
              />
            )}
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer">
            <button
              className="button"
              onClick={analyze}
              disabled={busy || !input}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ScanLine size={16} />
              )}
              Analyze posting
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="form-body"
        >
          {!!warnings.length && (
            <div className="notice">
              Review the extracted fields.
              <ul>
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="form-grid">
            {text("company", "Company", "text", true)}
            {text("position", "Position", "text", true)}
            {text("jobPostingURL", "Posting URL", "url")}
            {text("location", "Location")}
            <Field label="Status">
              <select
                value={draft.statusId}
                onChange={(e) => set("statusId", e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Work mode">
              <select
                value={draft.workMode}
                required
                onChange={(e) => set("workMode", e.target.value)}
              >
                <option value="">Select work mode</option>
                {["Remote", "Hybrid", "On-site"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Employment type">
              <select
                value={draft.employmentType}
                required
                onChange={(e) => set("employmentType", e.target.value)}
              >
                <option value="">Select type</option>
                {["Full-time", "Internship", "Part-time", "Contract"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </Field>
            {text("source", "Source")}
            {text("salaryMinimum", "Minimum salary", "number")}
            {text("salaryMaximum", "Maximum salary", "number")}
            {text("salaryCurrency", "Currency (ISO code)")}
            {text("dateApplied", "Applied date", "date")}
            {text("datePosted", "Posted date", "date")}
            {text("applicationDeadline", "Application deadline", "date")}
            {text("requiredSkills", "Required skills (comma separated)")}
            {text("preferredSkills", "Preferred skills (comma separated)")}
          </div>
          <Field label="Experience requirements">
            <textarea
              value={draft.experienceRequirements}
              onChange={(e) => set("experienceRequirements", e.target.value)}
              rows={2}
            />
          </Field>
          <Field label="Job description">
            <textarea
              value={draft.jobDescription}
              onChange={(e) => set("jobDescription", e.target.value)}
              rows={6}
              maxLength={100000}
            />
          </Field>
          {!application && (
            <>
              <div className="form-grid">
                {text("contactName", "Contact name")}
                {text("contactEmail", "Contact email", "email")}
                {text("recruiterName", "Recruiter name")}
                {text("recruiterEmail", "Recruiter email", "email")}
              </div>
              <Field label="Personal notes">
                <textarea
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3}
                />
              </Field>
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {!!duplicates.length && (
            <div className="notice">
              {duplicates.map((d) => (
                <Link
                  key={d.id}
                  href={`/app/cases/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {d.company} · {d.position} · {d.status} · {d.source} · {d.age}{" "}
                  days old <ArrowRight size={14} />
                </Link>
              ))}
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => save(true)}
              >
                Save anyway
              </button>
            </div>
          )}
          <div className="form-footer">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={16} />}{" "}
              {application ? "Save changes" : "Save case"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
