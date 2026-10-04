"use client";
import type { Intelligence } from "@/server/services/intelligence";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { Field } from "@/components/ui";
import { CaseScores } from "./case-scores";
export function SkillsProfile({
  data,
  notify,
  onUpdated,
}: {
  data: Intelligence;
  notify: (message: string, error?: boolean) => void;
  onUpdated: (data: Intelligence) => void;
}) {
  const [busy, setBusy] = useState(false),
    [rows, setRows] = useState<{ name: string; proficiency: string }[]>(
      data.skills,
    );
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
              onUpdated(d);
              setRows(d.skills);
              notify("Skills profile saved.");
            } catch (err) {
              notify(errorMessage(err), true);
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
                  {["Learning", "Familiar", "Proficient", "Strong"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
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
}
