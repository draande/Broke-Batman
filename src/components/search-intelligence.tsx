"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { Intelligence } from "@/server/intelligence";
import { api } from "@/lib/client";
import { Field, Skeleton } from "./ui";
export function SearchIntelligence({
  mode,
  notify,
  version = 0,
}: {
  mode: "dashboard" | "analytics" | "skills" | "companies";
  notify: (m: string, e?: boolean) => void;
  version?: number;
}) {
  const [data, setData] = useState<Intelligence | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [rows, setRows] = useState<{ name: string; proficiency: string }[]>([]);
  useEffect(() => {
    let live = true;
    api<Intelligence>("intelligence")
      .then((r) => {
        if (live) {
          setData(r);
          setRows(r.skills);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [version]);
  if (error)
    return (
      <div className="panel">
        <p role="alert" className="form-error">
          {error}
        </p>
      </div>
    );
  if (!data) return <Skeleton />;
  if (mode === "skills")
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">PERSONAL CAPABILITIES</div>
            <h1>Skills profile</h1>
            <p>
              A transparent comparison to posting requirements, not a hiring
              prediction.
            </p>
          </div>
        </div>
        <section className="panel intelligence-section">
          <form
            className="form-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                await api("skills", "PUT", {
                  skills: rows.filter((r) => r.name.trim()),
                  experienceYears: Number(f.get("years")),
                  education: String(f.get("education")),
                  staleDays: Number(f.get("stale")),
                });
                const d = await api<Intelligence>("intelligence");
                setData(d);
                setRows(d.skills);
                notify("Skills profile saved.");
              } catch (err) {
                notify((err as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Years of experience">
                <input
                  name="years"
                  type="number"
                  min={0}
                  max={80}
                  step={0.5}
                  defaultValue={data.profile.experienceYears}
                />
              </Field>
              <Field label="Education">
                <select name="education" defaultValue={data.profile.education}>
                  <option value="">Not specified</option>
                  {["Bachelor", "Master", "Doctorate"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Stale after (days)">
                <input
                  name="stale"
                  type="number"
                  min={8}
                  max={180}
                  defaultValue={data.profile.staleDays}
                />
              </Field>
            </div>
            {rows.map((r, i) => (
              <div className="profile-skill" key={i}>
                <Field label={`Skill ${i + 1}`}>
                  <input
                    value={r.name}
                    maxLength={80}
                    onChange={(e) =>
                      setRows(
                        rows.map((s, j) =>
                          j === i ? { ...s, name: e.target.value } : s,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label={`Proficiency ${i + 1}`}>
                  <select
                    value={r.proficiency}
                    onChange={(e) =>
                      setRows(
                        rows.map((s, j) =>
                          j === i ? { ...s, proficiency: e.target.value } : s,
                        ),
                      )
                    }
                  >
                    {["Learning", "Familiar", "Proficient", "Strong"].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </Field>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="button-row">
              <button
                type="button"
                className="button secondary"
                disabled={rows.length >= 200}
                onClick={() =>
                  setRows([...rows, { name: "", proficiency: "Familiar" }])
                }
              >
                Add skill
              </button>
              <button className="button" disabled={busy}>
                Save profile
              </button>
            </div>
          </form>
        </section>
        <CaseScores data={data} />
      </>
    );
  if (mode === "companies")
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">TRACKED COMPANY SIGNALS</div>
            <h1>Company intelligence</h1>
            <p>
              Built from your cases and contacts. Response averages require at
              least three completed observations.
            </p>
          </div>
        </div>
        {!data.companies.length && (
          <div className="panel empty">
            Add a case to start building company intelligence.
          </div>
        )}
        {data.companies.map((c) => (
          <section className="panel intelligence-section" key={c.name}>
            <h2>{c.name}</h2>
            <p>
              {c.active} active cases · {c.responses} responses · {c.offers}{" "}
              offers · Average response:{" "}
              {c.responseSample >= 3
                ? `${c.firstResponse} days (${c.responseSample} observations)`
                : "Insufficient data"}
            </p>
            <div className="intelligence-grid">
              {c.roles.map((r) => (
                <Link
                  className="intelligence-case"
                  key={r.id}
                  href={`/app/cases/${r.id}`}
                >
                  <strong>{r.position}</strong>
                  <small>{r.status}</small>
                </Link>
              ))}
            </div>
            <h3>Known contacts</h3>
            {c.contacts.length ? (
              c.contacts.map((p, i) => (
                <p key={i}>
                  {p.name} · {p.role} · {p.email}
                </p>
              ))
            ) : (
              <p className="muted">No contacts recorded.</p>
            )}
          </section>
        ))}
      </>
    );
  if (mode === "dashboard")
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
                  {data.weekly.previous[k as keyof typeof data.weekly.previous]}{" "}
                  · Change:{" "}
                  {v -
                    data.weekly.previous[
                      k as keyof typeof data.weekly.previous
                    ]}
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
  return (
    <>
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
function CaseScores({ data }: { data: Intelligence }) {
  return (
    <section className="panel intelligence-section">
      <h2>Case health and match breakdown</h2>
      <p>
        Required skills 70%, experience 20%, education 10%. Unknown requirements
        are excluded and remaining weights are normalized. Proficiency credit:
        Learning 25%, Familiar 50%, Proficient 80%, Strong 100%.
      </p>
      <div className="intelligence-grid">
        {data.cases.map((a) => (
          <Link
            className="intelligence-case"
            href={`/app/cases/${a.id}`}
            key={a.id}
          >
            <span className="eyebrow">{a.health}</span>
            <strong>
              {a.company} · {a.position}
            </strong>
            <span>
              Match:{" "}
              {a.match.score === null
                ? "Unknown requirements"
                : `${a.match.score}%`}
            </span>
            <small>
              {a.match.parts
                .map(
                  (p) =>
                    `${p.name}: ${p.score === null ? "unknown" : `${p.score}%`}`,
                )
                .join(" · ")}
            </small>
            <small>
              Matched: {a.match.matched.join(", ") || "None"} · Missing:{" "}
              {a.match.missing.join(", ") || "None identified"}
            </small>
          </Link>
        ))}
      </div>
    </section>
  );
}
