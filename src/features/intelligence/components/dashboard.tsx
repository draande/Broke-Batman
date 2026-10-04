"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleCheck,
  Radio,
  Target,
  XCircle,
  Flame,
  Clock3,
  ArrowRight,
} from "lucide-react";
import type { Bootstrap } from "@/types/domain";
import { timeLabel } from "@/lib/client";
import { Empty } from "@/components/ui";
const Chart = dynamic(
  () =>
    import("@/features/intelligence/components/charts").then((m) => m.Chart),
  {
    loading: () => <div className="skeleton chart" />,
  },
);
export function Dashboard({ data, add }: { data: Bootstrap; add: () => void }) {
  const a = data.analytics,
    p = data.user.preference;
  const missions = [
    ...data.interviews
      .filter(
        (i) => i.outcome === "Scheduled" && new Date(i.startsAt) > new Date(),
      )
      .map((i) => ({
        id: i.id,
        app: i.application,
        title: `${i.type} interview`,
        date: i.startsAt,
        type: "Interview",
      })),
    ...data.followUps
      .filter((f) => !f.completedAt)
      .map((f) => ({
        id: f.id,
        app: f.application,
        title: f.title,
        date: f.dueAt,
        type: "Follow-up",
      })),
    ...data.deadlines
      .filter((d) => new Date(d.dueAt) > new Date())
      .map((d) => ({
        id: d.id,
        app: d,
        title: "Application deadline",
        date: d.dueAt,
        type: "Deadline",
      })),
  ]
    .sort((x, y) => +new Date(x.date) - +new Date(y.date))
    .slice(0, 5);
  const metrics = [
    {
      title: "Total applications",
      value: a.total,
      Icon: BriefcaseBusiness,
      sub: "Every opportunity, accounted for",
    },
    {
      title: "This week",
      value: a.thisWeek,
      Icon: CalendarDays,
      sub: "Rolling seven days",
    },
    {
      title: "Interviews",
      value: a.interviews,
      Icon: Radio,
      sub: "Cases that reached an interview",
    },
    {
      title: "Offers",
      value: a.offers,
      Icon: CircleCheck,
      sub: "Gotham has a new employer",
    },
    {
      title: "Rejections",
      value: a.rejections,
      Icon: XCircle,
      sub: "Another one for the rogues’ gallery",
    },
    {
      title: "Response rate",
      value: `${a.responseRate}%`,
      Icon: ArrowUpRight,
      sub: "Responses / submitted cases",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            MISSION CONTROL <span className="signal" />
          </div>
          <h1>Good evening, {data.user.name.split(" ")[0]}.</h1>
          <p>Gotham isn&apos;t paying the bills. Time to find employment.</p>
        </div>
        <button className="button" onClick={add}>
          + Open a case
        </button>
      </div>
      <div className="metrics">
        {metrics.map(({ title, value, Icon, sub }) => (
          <article className="panel metric" key={title}>
            <div>
              <span>{title}</span>
              <Icon size={17} />
            </div>
            <strong>{value}</strong>
            <small>{sub}</small>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel pipeline">
          <div className="section-head">
            <div>
              <h2>Application pipeline</h2>
              <p>Your next chapter, in motion.</p>
            </div>
            <Link href="/app/cases" className="text-link">
              View cases <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="pipeline-stages">
            {a.pipeline.map((s, i) => (
              <div key={s.name}>
                <span className="stage-number">0{i + 1}</span>
                <strong>{s.value}</strong>
                <span>{s.name}</span>
                <div className={`stage-track s${i}`}>
                  <i
                    style={{
                      width: `${Math.max(4, a.total ? (s.value / a.total) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel goal">
          <div className="section-head">
            <h2>Weekly target</h2>
            <Target size={19} />
          </div>
          <div className="goal-number">
            {a.thisWeek}
            <span>/ {p.weeklyTarget}</span>
          </div>
          <p>applications in the last 7 days</p>
          <div className="progress">
            <i
              style={{
                width: `${Math.min(100, (a.thisWeek / p.weeklyTarget) * 100)}%`,
              }}
            />
          </div>
          <Link href="/app/settings" className="text-link">
            Adjust your target <ArrowRight size={14} />
          </Link>
        </section>
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Application activity</h2>
              <p>A steady signal beats a single burst.</p>
            </div>
            <span className="pill">LAST 8 WEEKS</span>
          </div>
          <Chart data={a.weekly} />
        </section>
        <section className="panel missions-panel">
          <div className="section-head">
            <div>
              <h2>Missions</h2>
              <p>What needs your attention.</p>
            </div>
            <Link className="text-link" href="/app/missions">
              <ArrowUpRight size={18} />
              <span className="sr-only">View all missions</span>
            </Link>
          </div>
          {missions.length ? (
            missions.map((m) => (
              <Link
                className="mission"
                href={`/app/cases/${m.app.id}`}
                key={`${m.type}${m.id}`}
              >
                <span
                  className={`mission-icon ${new Date(m.date) < new Date() ? "overdue" : ""}`}
                >
                  <CalendarDays size={18} />
                </span>
                <div>
                  <strong>{m.title}</strong>
                  <p>{m.app.company}</p>
                  <small
                    className={new Date(m.date) < new Date() ? "danger" : ""}
                  >
                    {timeLabel(m.date, p.timezone)}
                    {new Date(m.date) < new Date() ? " · Overdue" : ""}
                  </small>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))
          ) : (
            <Empty
              title="The Bat-Signal remains dark."
              text="Schedule an interview or follow-up from a case."
            />
          )}
        </section>
        <section className="panel activity-panel">
          <div className="section-head">
            <h2>Recent activity</h2>
            <Clock3 size={18} />
          </div>
          {data.activity.length ? (
            data.activity.map((item) => (
              <Link
                className="activity-row"
                href={`/app/cases/${item.application.id}`}
                key={item.id}
              >
                <span className="activity-dot" />
                <div>
                  <strong>{item.message}</strong>
                  <p>
                    {item.application.company}{" "}
                    <span>· {item.application.position}</span>
                  </p>
                </div>
                <small>{timeLabel(item.createdAt, p.timezone)}</small>
              </Link>
            ))
          ) : (
            <Empty
              action={
                <button className="button" onClick={add}>
                  Open a case
                </button>
              }
            />
          )}
        </section>
        {p.streakEnabled && (
          <section className="panel streak">
            <Flame size={26} />
            <strong>{a.streak} day streak</strong>
            {a.streak >= 7 && <small>Alfred recommends sunlight.</small>}
            <p>
              {a.today} application{a.today === 1 ? "" : "s"} today.
            </p>
            <small>
              Justice doesn&apos;t take weekends off. Unfortunately, neither
              does LinkedIn.
            </small>
          </section>
        )}
      </div>
    </>
  );
}
export function AnalyticsPage({ data }: { data: Bootstrap }) {
  const a = data.analytics;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PATTERNS. SIGNALS. OPPORTUNITIES.</div>
          <h1>Batcomputer Intelligence</h1>
          <p>Understand what&apos;s working. Make your next move count.</p>
        </div>
        <Link className="button secondary" href="/api/export?format=csv">
          Export cases <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="metrics four">
        {[
          { label: "Response rate", value: `${a.responseRate}%` },
          { label: "Interview rate", value: `${a.interviewRate}%` },
          { label: "Offer rate", value: `${a.offerRate}%` },
          {
            label: "Average response",
            value:
              a.averageResponseDays === null
                ? "—"
                : `${a.averageResponseDays} ${a.averageResponseDays === 1 ? "day" : "days"}`,
          },
        ].map((m) => (
          <div className="panel metric" key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="panel funnel">
          <div className="section-head">
            <h2>Hiring funnel</h2>
            <span className="pill">HISTORICAL REACH</span>
          </div>
          <p className="muted">
            Submitted cases that reached each stage. Withdrawn and ghosted cases
            are not responses.
          </p>
          {a.funnel.map((f, i) => (
            <div className="funnel-row" key={f.name}>
              <span>{f.name}</span>
              <div>
                <i
                  style={{
                    width: `${a.applied ? Math.max(2, (f.value / a.applied) * 100) : 0}%`,
                    opacity: 1 - i * 0.12,
                  }}
                />
              </div>
              <strong>{f.value}</strong>
              <small>{i ? `${f.conversion}% from previous` : "Baseline"}</small>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Applications over time</h2>
          <Chart data={a.weekly} />
        </section>
        {[
          { title: "Applications by source", data: a.bySource },
          { title: "Applications by work mode", data: a.byWorkMode },
          { title: "Applications by company", data: a.byCompany },
          { title: "Applications by status", data: a.byStatus },
        ].map((c) => (
          <section className="panel" key={c.title}>
            <h2>{c.title}</h2>
            <Chart bar data={c.data} />
          </section>
        ))}
        <section className="panel">
          <h2>Average time between stages</h2>
          <p className="muted">
            Days between recorded changes. Based on preserved case history.
          </p>
          {a.averageStageDays.length ? (
            a.averageStageDays.map((s) => (
              <div className="stat-row" key={s.name}>
                <span>{s.name}</span>
                <strong>{s.value} days</strong>
              </div>
            ))
          ) : (
            <p className="muted">
              Move cases through stages to start measuring.
            </p>
          )}
        </section>
        <section className="panel outcomes">
          <h2>Search outcomes</h2>
          <div className="stat-row">
            <span>Submitted applications</span>
            <strong>{a.applied}</strong>
          </div>
          <div className="stat-row">
            <span>Offers reached</span>
            <strong>{a.offers}</strong>
          </div>
          <div className="stat-row">
            <span>Current rejections</span>
            <strong>{a.rejections}</strong>
          </div>
          <div className="stat-row">
            <span>Currently ghosted</span>
            <strong>{a.ghosted}</strong>
          </div>
          <p className="muted">
            Analytics exclude archived cases. Rates use submitted applications;
            historical reach uses status history.
          </p>
        </section>
      </div>
    </>
  );
}
