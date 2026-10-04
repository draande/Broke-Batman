"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, CircleCheck, ArrowUpRight } from "lucide-react";
import type { Bootstrap } from "@/lib/types";
import { api, timeLabel } from "@/lib/client";
import { Empty } from "./ui";
export function Missions({
  data,
  refresh,
  notify,
}: {
  data: Bootstrap;
  refresh: () => void;
  notify: (m: string, error?: boolean) => void;
}) {
  const [filter, setFilter] = useState("upcoming");
  const interviews = data.interviews.filter((i) =>
    filter === "completed"
      ? i.outcome !== "Scheduled"
      : i.outcome === "Scheduled" &&
        (filter === "upcoming"
          ? new Date(i.startsAt) >= new Date()
          : new Date(i.startsAt) < new Date()),
  );
  const followups = data.followUps.filter((f) =>
    filter === "completed"
      ? !!f.completedAt
      : !f.completedAt &&
        (filter === "overdue" ? new Date(f.dueAt) < new Date() : true),
  );
  async function complete(appId: string, id: string, completed: boolean) {
    try {
      await api(`applications/${appId}/follow-ups/${id}`, "PUT", { completed });
      refresh();
      notify(completed ? "Mission complete." : "Mission reopened.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KEEP THE SIGNAL ALIVE</div>
          <h1>Missions</h1>
          <p>
            Interviews, deadlines, and follow-ups. Nothing slips through the
            cracks.
          </p>
        </div>
        <Link href="/app/cases" className="button secondary">
          Choose a case to schedule
        </Link>
      </div>
      <div className="segmented mission-filters">
        {["upcoming", "overdue", "completed"].map((s) => (
          <button
            key={s}
            className={filter === s ? "active" : ""}
            onClick={() => setFilter(s)}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <h2>
            {filter === "overdue" ? "Past scheduled interviews" : "Interviews"}
          </h2>
          {interviews.length ? (
            interviews.map((i) => (
              <Link
                className="mission roomy"
                href={`/app/cases/${i.applicationId}`}
                key={i.id}
              >
                <span className="mission-icon">
                  <CalendarDays size={20} />
                </span>
                <div>
                  <strong>
                    {i.type} interview · {i.application.company}
                  </strong>
                  <p>{i.application.position}</p>
                  <small>
                    {timeLabel(i.startsAt, i.timezone)} · {i.timezone}
                  </small>
                </div>
                <ArrowUpRight size={17} />
              </Link>
            ))
          ) : (
            <Empty
              title="The Bat-Signal remains dark."
              text="Scheduled interviews appear here. Record outcomes from the case."
            />
          )}
        </section>
        <section className="panel">
          <h2>Follow-ups</h2>
          {followups.length ? (
            followups.map((f) => (
              <div className="mission roomy" key={f.id}>
                <button
                  className={`icon-button ${f.completedAt ? "gold" : ""}`}
                  aria-label={`${f.completedAt ? "Reopen" : "Complete"} ${f.title}`}
                  onClick={() =>
                    complete(f.applicationId, f.id, !f.completedAt)
                  }
                >
                  <CircleCheck size={22} />
                </button>
                <Link href={`/app/cases/${f.applicationId}`}>
                  <strong>{f.title}</strong>
                  <p>{f.application.company}</p>
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
                </Link>
              </div>
            ))
          ) : (
            <Empty title="Clear skies." text="No follow-ups in this view." />
          )}
        </section>
        <section className="panel">
          <h2>Application deadlines</h2>
          {data.deadlines
            .filter((d) =>
              filter === "overdue"
                ? new Date(d.dueAt) < new Date()
                : filter === "upcoming"
                  ? new Date(d.dueAt) >= new Date()
                  : false,
            )
            .map((d) => (
              <Link
                className="mission roomy"
                key={d.id}
                href={`/app/cases/${d.id}`}
              >
                <CalendarDays size={20} />
                <div>
                  <strong>{d.company}</strong>
                  <p>{d.position}</p>
                  <small>
                    {timeLabel(d.dueAt, data.user.preference.timezone)}
                  </small>
                </div>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          {!data.deadlines.length && (
            <p className="muted">
              Add a deadline when opening or editing a case.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
