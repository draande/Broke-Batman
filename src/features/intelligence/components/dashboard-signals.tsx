"use client";
import Link from "next/link";
import type { Intelligence } from "@/server/services/intelligence";
export function DashboardSignals({ data }: { data: Intelligence }) {
  return (
    <>
      <section className="panel intelligence-section">
        <div className="eyebrow">PRIORITIZED SIGNALS</div>
        <h2>Needs attention</h2>
        {!data.attention.length ? (
          <p className="muted">No urgent signals. Keep the patrol steady.</p>
        ) : (
          data.attention.slice(0, 8).map((a) => (
            <Link key={a.key} className="intelligence-case" href={a.href}>
              <strong>{a.title}</strong>
              <small>{a.reason}</small>
            </Link>
          ))
        )}
      </section>
      <section className="panel intelligence-section">
        <h2>Weekly intelligence report</h2>
        <p>Rolling seven days compared with the previous seven days.</p>
        <div className="intelligence-grid">
          {Object.entries(data.weekly.current).map(([k, v]) => (
            <div className="intelligence-metric" key={k}>
              <small>{k}</small>
              <strong>{v}</strong>
              <span>
                Previous:{" "}
                {data.weekly.previous[k as keyof typeof data.weekly.previous]} ·
                Change:{" "}
                {v -
                  data.weekly.previous[k as keyof typeof data.weekly.previous]}
              </span>
            </div>
          ))}
        </div>
        <p>
          Best observed response source (at least three applications):{" "}
          {data.weekly.bestSource || "Insufficient data"} · Most requested
          missing skill: {data.weekly.missingSkill || "None identified"} ·
          Attention items: {data.weekly.attention}
        </p>
      </section>
      <section className="panel intelligence-section">
        <h2>Combined activity feed</h2>
        {!data.activity.length && (
          <p className="muted">
            Your case and Gmail activity will appear here.
          </p>
        )}
        {data.activity.slice(0, 20).map((a, i) => (
          <div key={a.id}>
            {(i === 0 ||
              a.date.slice(0, 10) !==
                data.activity[i - 1].date.slice(0, 10)) && (
              <h3>{new Date(a.date).toLocaleDateString()}</h3>
            )}
            <Link
              className="intelligence-case"
              href={`/app/cases/${a.applicationId}`}
            >
              <strong>
                {a.company} · {a.message}
              </strong>
              <small>
                {a.source} · {new Date(a.date).toLocaleTimeString()}
              </small>
            </Link>
          </div>
        ))}
      </section>
    </>
  );
}
