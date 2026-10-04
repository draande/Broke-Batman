"use client";
import Link from "next/link";
import type { Intelligence } from "@/server/services/intelligence";
export function CompanyInsights({ data }: { data: Intelligence }) {
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
}
