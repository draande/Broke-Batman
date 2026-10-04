"use client";
import Link from "next/link";
import type { Intelligence } from "@/server/services/intelligence";
import { CaseScores } from "./case-scores";
export function AnalyticsInsights({
  data,
  notify,
}: {
  data: Intelligence;
  notify: (message: string, error?: boolean) => void;
}) {
  return (
    <>
      {!data.cases.length && (
        <section className="panel intelligence-section">
          <h2>Not enough evidence.</h2>
          <p>
            Track a few applications and the Batcomputer will start finding
            patterns.
          </p>
        </section>
      )}
      <section className="panel intelligence-section">
        <h2>Patrol activity</h2>
        <p>
          Each square is one calendar day in your display timezone. Hover or
          focus to see submissions.
        </p>
        <div className="patrol-scroll">
          <div className="patrol-heatmap">
            {data.heatmap.map((d) => (
              <button
                type="button"
                onClick={() => notify(`${d.date}: ${d.count} applications`)}
                key={d.date}
                className={`patrol-day level-${Math.min(4, d.count)}`}
                title={`${d.date}: ${d.count} applications`}
                aria-label={`${d.date}: ${d.count} applications`}
              />
            ))}
          </div>
        </div>
        <p>
          Current streak: {data.patrol.current} · Longest in the last year:{" "}
          {data.patrol.longest} · Average / week: {data.patrol.averagePerWeek} ·
          Busiest day:{" "}
          {data.patrol.busiest
            ? `${data.patrol.busiest.date} (${data.patrol.busiest.count})`
            : "No submissions"}
        </p>
      </section>
      <section className="panel intelligence-section">
        <h2>Historical funnel</h2>
        <p>
          Cases that reached each stage. Stage-specific paths can skip a final
          round; adjacent ratios describe recorded reach only.
        </p>
        <div className="intelligence-grid">
          {data.funnel.map((s, i) => (
            <div key={s.name} className="intelligence-metric">
              <small>{s.name}</small>
              <strong>{s.count}</strong>
              <span>
                {i && data.funnel[i - 1].count
                  ? `${Math.round((s.count / data.funnel[i - 1].count) * 100)}% of previous stage`
                  : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel intelligence-section">
        <h2>Source conversion</h2>
        <p>Observed outcomes, not evidence that a source caused the result.</p>
        <div className="intelligence-table-wrap">
          <table className="intelligence-table">
            <thead>
              <tr>
                {[
                  "Source",
                  "Applied",
                  "Responses",
                  "Interviews",
                  "Offers",
                  "Response %",
                  "Interview %",
                  "Offer %",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.source.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.applications}</td>
                  <td>{s.responses}</td>
                  <td>{s.interviews}</td>
                  <td>{s.offers}</td>
                  <td>{s.responseRate ?? "—"}</td>
                  <td>{s.interviewRate ?? "—"}</td>
                  <td>{s.offerRate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel intelligence-section">
        <h2>Observed response times</h2>
        <p>
          Days from application to recorded event. Pending cases are excluded;
          missing observations are shown as —.
        </p>
        <div className="intelligence-grid">
          {(
            [
              ["First response", data.timing.firstResponse],
              ["First interview", data.timing.firstInterview],
              ["Rejection", data.timing.rejection],
              ["Offer", data.timing.offer],
              ["Completed process", data.timing.completedProcess],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="intelligence-metric">
              <small>{label}</small>
              <strong>{value ?? "—"}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="panel intelligence-section">
        <h2>Required skills and profile gaps</h2>
        <div className="intelligence-table-wrap">
          <table className="intelligence-table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Category</th>
                <th>Required cases</th>
                <th>Preferred cases</th>
                <th>Your proficiency</th>
              </tr>
            </thead>
            <tbody>
              {data.demandedSkills.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.category}</td>
                  <td>{s.required}</td>
                  <td>{s.preferred}</td>
                  <td>{s.proficiency || "Missing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link href="/app/skills">Update your skills profile</Link>
      </section>
      <CaseScores data={data} />
    </>
  );
}
