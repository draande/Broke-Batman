"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  Archive,
  Trash2,
  MapPin,
  CalendarDays,
  Mail,
  CircleCheck,
  Clock3,
} from "lucide-react";
import type { Application, Bootstrap } from "@/lib/types";
import { api, dateLabel, timeLabel } from "@/lib/client";
import { Badge, Empty, Modal, Skeleton, Field } from "./ui";
import { ApplicationForm } from "./application-form";
import { EventForm } from "./event-form";
export function CaseDetail({
  id,
  data,
  notify,
  refresh,
}: {
  id: string;
  data: Bootstrap;
  notify: (message: string, error?: boolean) => void;
  refresh: () => void;
}) {
  const [app, setApp] = useState<Application | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Overview"),
    [edit, setEdit] = useState(false),
    [event, setEvent] = useState<
      "interviews" | "follow-ups" | "contacts" | "notes" | null
    >(null),
    [existing, setExisting] = useState<
      | Application["interviews"][number]
      | Application["contacts"][number]
      | Application["notes"][number]
      | undefined
    >(),
    [deleteOpen, setDeleteOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setApp(await api<Application>(`applications/${id}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const saved = () => {
    void load();
    refresh();
    notify("Case updated.");
  };
  async function patch(body: unknown) {
    setBusy(true);
    try {
      setApp(await api<Application>(`applications/${id}`, "PATCH", body));
      refresh();
      notify("Case updated.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function remove(kind: string, recordId: string) {
    try {
      await api(`applications/${id}/${kind}/${recordId}`, "DELETE");
      saved();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function complete(recordId: string, completed: boolean) {
    try {
      await api(`applications/${id}/follow-ups/${recordId}`, "PUT", {
        completed,
      });
      saved();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  const openEvent = (kind: typeof event, record?: typeof existing) => {
    setExisting(record);
    setEvent(kind);
  };
  if (error)
    return (
      <div className="panel empty">
        <h2>{error}</h2>
        <Link href="/app/cases" className="button secondary">
          Back to cases
        </Link>
      </div>
    );
  if (!app) return <Skeleton />;
  const currency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: app.salaryCurrency,
      maximumFractionDigits: 0,
    }).format(amount);
  return (
    <>
      <Link href="/app/cases" className="back-link">
        <ArrowLeft size={16} />
        All cases
      </Link>
      <div className="case-heading">
        <div className="company-avatar large">
          {app.company
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <div className="eyebrow">{app.company}</div>
          <h1>{app.position}</h1>
          <div className="case-meta">
            <Badge status={app.status} />
            <span>
              <MapPin size={15} />
              {app.location || "Location unspecified"} · {app.workMode}
            </span>
            <span>
              {app.salaryMinimum != null ? currency(app.salaryMinimum) : ""}
              {app.salaryMaximum != null
                ? ` – ${currency(app.salaryMaximum)}`
                : ""}
            </span>
          </div>
        </div>
        <button className="button secondary" onClick={() => setEdit(true)}>
          <Pencil size={15} />
          Edit case
        </button>
      </div>
      <div className="detail-grid">
        <section className="panel detail-main">
          <div className="tabs" role="tablist" aria-label="Case information">
            {[
              "Overview",
              "Job description",
              "Skills",
              "Notes",
              "Contacts",
              "Timeline",
            ].map((t) => (
              <button
                role="tab"
                id={`tab-${t}`}
                aria-controls="case-tab-panel"
                aria-selected={tab === t}
                key={t}
                onClick={() => setTab(t)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const tabs = [
                      "Overview",
                      "Job description",
                      "Skills",
                      "Notes",
                      "Contacts",
                      "Timeline",
                    ];
                    const next =
                      tabs[
                        (tabs.indexOf(t) + (e.key === "ArrowRight" ? 1 : 5)) % 6
                      ];
                    setTab(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }
                }}
                tabIndex={tab === t ? 0 : -1}
                className={tab === t ? "active" : ""}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            className="tab-content"
            role="tabpanel"
            id="case-tab-panel"
            aria-labelledby={`tab-${tab}`}
          >
            {tab === "Overview" && (
              <>
                <h2>The case at a glance</h2>
                <dl className="overview-grid">
                  {[
                    ["Company", app.company],
                    ["Employment", app.employmentType],
                    ["Source", app.source],
                    ["Applied", dateLabel(app.dateApplied)],
                    ["Posted", dateLabel(app.datePosted)],
                    ["Deadline", dateLabel(app.applicationDeadline)],
                    ["Opened", dateLabel(app.createdAt)],
                    ["Updated", dateLabel(app.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                {app.experienceRequirements && (
                  <>
                    <h3>Experience requirements</h3>
                    <p className="pre-wrap">{app.experienceRequirements}</p>
                  </>
                )}
                {app.jobPostingURL && (
                  <a
                    href={app.jobPostingURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button secondary"
                  >
                    Open original posting <ExternalLink size={14} />
                  </a>
                )}
                <div className="section-head">
                  <h2>Interviews</h2>
                  <button
                    className="button secondary small"
                    onClick={() => openEvent("interviews")}
                  >
                    + Schedule
                  </button>
                </div>
                {app.interviews.length ? (
                  app.interviews.map((i) => (
                    <div className="detail-record" key={i.id}>
                      <div className="record-top">
                        <strong>
                          <CalendarDays size={17} /> {i.type} interview
                        </strong>
                        <span className="pill">{i.outcome}</span>
                      </div>
                      <p>
                        {timeLabel(i.startsAt, i.timezone)} · {i.timezone}
                      </p>
                      {i.interviewer && <p>With {i.interviewer}</p>}
                      {i.meetingURL && (
                        <a
                          href={i.meetingURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-link"
                        >
                          Join meeting <ExternalLink size={13} />
                        </a>
                      )}
                      {i.preparationNotes && (
                        <p className="pre-wrap">
                          <strong>Preparation:</strong> {i.preparationNotes}
                        </p>
                      )}
                      {i.notes && <p className="pre-wrap">{i.notes}</p>}
                      <div className="record-actions">
                        <button onClick={() => openEvent("interviews", i)}>
                          Edit / record outcome
                        </button>
                        <button
                          className="danger"
                          onClick={() => remove("interviews", i.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="The Bat-Signal remains dark."
                    text="Schedule your first interview here."
                  />
                )}
                <div className="section-head">
                  <h2>Follow-ups</h2>
                  <button
                    className="button secondary small"
                    onClick={() => openEvent("follow-ups")}
                  >
                    + Add follow-up
                  </button>
                </div>
                {app.followUps.length ? (
                  app.followUps.map((f) => (
                    <div
                      className={`followup-record ${f.completedAt ? "done" : ""}`}
                      key={f.id}
                    >
                      <button
                        className="icon-button"
                        aria-label={`${f.completedAt ? "Reopen" : "Complete"} ${f.title}`}
                        onClick={() => complete(f.id, !f.completedAt)}
                      >
                        <CircleCheck size={20} />
                      </button>
                      <div>
                        <strong>{f.title}</strong>
                        <small
                          className={
                            !f.completedAt && new Date(f.dueAt) < new Date()
                              ? "danger"
                              : ""
                          }
                        >
                          {timeLabel(f.dueAt, data.user.preference.timezone)}
                          {!f.completedAt && new Date(f.dueAt) < new Date()
                            ? " · Overdue"
                            : ""}
                        </small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${f.title}`}
                        onClick={() => remove("follow-ups", f.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted">No follow-ups scheduled.</p>
                )}
              </>
            )}
            {tab === "Job description" && (
              <>
                <h2>Job description</h2>
                {app.jobDescription ? (
                  <div className="description pre-wrap">
                    {app.jobDescription}
                  </div>
                ) : (
                  <Empty
                    title="No description added."
                    text="Edit the case to add a description."
                  />
                )}
              </>
            )}
            {tab === "Skills" && (
              <>
                {[false, true].map((preferred) => (
                  <section key={String(preferred)}>
                    <h2>{preferred ? "Preferred" : "Required"} skills</h2>
                    <div className="skill-list">
                      {app.skills
                        .filter((s) => s.preferred === preferred)
                        .map((s) => (
                          <span className="skill" key={s.skillId}>
                            {s.skill.name}
                          </span>
                        ))}
                    </div>
                    {!app.skills.some((s) => s.preferred === preferred) && (
                      <p className="muted">No skills recorded.</p>
                    )}
                  </section>
                ))}
              </>
            )}
            {tab === "Notes" && (
              <>
                <div className="section-head">
                  <h2>Field notes</h2>
                  <button
                    className="button secondary"
                    onClick={() => openEvent("notes")}
                  >
                    + Add note
                  </button>
                </div>
                {app.notes.length ? (
                  app.notes.map((n) => (
                    <article className="detail-record" key={n.id}>
                      <p className="pre-wrap">{n.body}</p>
                      <small>{dateLabel(n.createdAt)}</small>
                      <div className="record-actions">
                        <button onClick={() => openEvent("notes", n)}>
                          Edit
                        </button>
                        <button
                          className="danger"
                          onClick={() => remove("notes", n.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <Empty
                    title="A clean notebook."
                    text="Capture research, preparation, and conversation notes."
                  />
                )}
              </>
            )}
            {tab === "Contacts" && (
              <>
                <div className="section-head">
                  <h2>Your network</h2>
                  <button
                    className="button secondary"
                    onClick={() => openEvent("contacts")}
                  >
                    + Add contact
                  </button>
                </div>
                {app.contacts.length ? (
                  app.contacts.map((c) => (
                    <article className="detail-record" key={c.id}>
                      <h3>
                        {c.name} <span className="pill">{c.role}</span>
                      </h3>
                      {c.email && (
                        <a className="text-link" href={`mailto:${c.email}`}>
                          <Mail size={15} />
                          {c.email}
                        </a>
                      )}
                      <div className="record-actions">
                        <button onClick={() => openEvent("contacts", c)}>
                          Edit
                        </button>
                        <button
                          className="danger"
                          onClick={() => remove("contacts", c.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <Empty
                    title="Build your signal network."
                    text="Keep recruiters, referrals, and hiring managers together."
                  />
                )}
              </>
            )}
            {tab === "Timeline" && (
              <>
                <h2>Case history</h2>
                <p className="muted">
                  A preserved record of every important move.
                </p>
                {app.activities.map((a) => (
                  <div className="timeline-row" key={a.id}>
                    <Clock3 size={16} />
                    <div>
                      <strong>{a.message}</strong>
                      <small>
                        {a.source}
                        {a.confidence !== null
                          ? ` · ${a.confidence}% match`
                          : ""}
                        {a.sourceEmailId ? " · Email evidence recorded" : ""}
                      </small>
                      <small>
                        {timeLabel(a.createdAt, data.user.preference.timezone)}
                      </small>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
        <aside className="detail-sidebar">
          <section className="panel">
            <div className="eyebrow">CURRENT STAGE</div>
            <h2>Next move</h2>
            <Field label="Application status">
              <select
                value={app.statusId}
                disabled={busy}
                onChange={(e) => patch({ statusId: e.target.value })}
              >
                {data.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <p className="muted">
              Each stage change is saved to the case timeline.
            </p>
            <button
              className="button secondary full"
              onClick={() => openEvent("interviews")}
            >
              Schedule interview
            </button>
            <button
              className="button secondary full"
              onClick={() => openEvent("follow-ups")}
            >
              Add follow-up
            </button>
          </section>
          <section className="panel">
            <h3>Case management</h3>
            <button
              className="button secondary full"
              disabled={busy}
              onClick={() => patch({ archived: !app.archivedAt })}
            >
              <Archive size={16} />
              {app.archivedAt ? "Restore case" : "Archive case"}
            </button>
            <button
              className="button danger-button full"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={16} />
              Delete case
            </button>
            <small className="muted">
              Archived cases stay searchable in the archive filter.
            </small>
          </section>
        </aside>
      </div>
      {edit && (
        <ApplicationForm
          open
          onClose={() => setEdit(false)}
          onSaved={saved}
          statuses={data.statuses}
          application={app}
        />
      )}{" "}
      {event && (
        <EventForm
          kind={event}
          appId={id}
          existing={existing}
          timezone={data.user.preference.timezone}
          onClose={() => setEvent(null)}
          onSaved={saved}
        />
      )}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this case permanently?"
        description="Interviews, contacts, notes, and history will be deleted. This cannot be undone."
      >
        <div className="form-footer">
          <button
            className="button secondary"
            onClick={() => setDeleteOpen(false)}
          >
            Keep case
          </button>
          <button
            className="button danger-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`applications/${id}`, "DELETE");
                window.location.assign("/app/cases");
              } catch (e) {
                notify((e as Error).message, true);
                setBusy(false);
              }
            }}
          >
            Delete case
          </button>
        </div>
      </Modal>
    </>
  );
}
