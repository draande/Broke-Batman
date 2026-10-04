"use client";
import Link from "next/link";
import type { Intelligence } from "@/server/services/intelligence";
export function CaseScores({ data }: { data: Intelligence }) {
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
