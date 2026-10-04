"use client";
import { useState } from "react";
import { Download, Upload, FileText, CheckCircle2 } from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import { Field } from "@/components/ui";
const fields = [
  "company",
  "position",
  "location",
  "workMode",
  "employmentType",
  "salaryMinimum",
  "salaryMaximum",
  "salaryCurrency",
  "dateApplied",
  "datePosted",
  "applicationDeadline",
  "statusId",
  "source",
  "jobPostingURL",
  "jobDescription",
  "notes",
  "contactName",
  "contactEmail",
  "recruiterName",
  "recruiterEmail",
  "requiredSkills",
  "preferredSkills",
  "experienceRequirements",
];
type Preview = {
  headers: string[];
  rows: { row: number; data: Record<string, unknown>; errors: string[] }[];
  valid: boolean;
};
export function Transfers({
  refresh,
  notify,
}: {
  refresh: () => void;
  notify: (m: string, error?: boolean) => void;
}) {
  const [csv, setCSV] = useState(""),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [results, setResults] = useState<
      { row: number; id: string | null; error: string | null }[]
    >([]),
    [allowDuplicate, setAllowDuplicate] = useState(false);
  async function analyze(input = csv, map = mapping) {
    setBusy(true);
    setError("");
    try {
      setPreview(
        await api<Preview>("import", "POST", { csv: input, mapping: map }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 1000000) {
      setError("CSV must be under 1 MB.");
      return;
    }
    const text = await file.text();
    setCSV(text);
    setMapping({});
    setResults([]);
    void analyze(text, {});
  }
  async function commit() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ imported: number; results: typeof results }>(
        "import",
        "POST",
        { csv, mapping, commit: true, allowDuplicate },
      );
      setResults(result.results);
      refresh();
      notify(
        `${result.imported} cases imported. ${result.results.filter((r) => r.error).length} rows skipped.`,
      );
      setPreview(null);
      setCSV("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR DATA. YOUR CONTROL.</div>
          <h1>Import & export</h1>
          <p>Bring your search with you. Keep a complete backup.</p>
        </div>
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <Download size={25} className="gold" />
          <h2>Export the dossier</h2>
          <p className="muted">
            Exports include active and archived cases. JSON preserves
            interviews, contacts, notes, skills, and the full timeline.
          </p>
          <a className="button secondary" href="/api/export?format=csv">
            <FileText size={16} />
            Download CSV
          </a>{" "}
          <a className="button secondary" href="/api/export?format=json">
            <Download size={16} />
            Complete JSON backup
          </a>
          <small className="transfer-note">
            CSV cells are protected against spreadsheet formula injection.
          </small>
        </section>
        <section className="panel">
          <Upload size={25} className="gold" />
          <h2>Import cases from CSV</h2>
          <p className="muted">
            Up to 500 rows and 1 MB per import. Map columns, review validation,
            then save. Dates accept YYYY-MM-DD or ISO timestamps. Skills use
            semicolons.
          </p>
          <Field label="Choose CSV file">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => upload(e.target.files?.[0])}
              disabled={busy}
            />
          </Field>
          <p className="muted">
            Required: company, position. Status uses IDs such as saved, applied,
            technical-interview, or offer.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      {preview && (
        <section className="panel import-preview">
          <h2>Map your columns</h2>
          <div className="filter-grid">
            {fields.map((f) => (
              <Field key={f} label={f}>
                <select
                  value={mapping[f] || (preview.headers.includes(f) ? f : "")}
                  onChange={(e) => {
                    const map = {
                      ...mapping,
                      [f]: e.target.value || "__ignore__",
                    };
                    setMapping(map);
                    void analyze(csv, map);
                  }}
                >
                  <option value="">Ignore</option>
                  {preview.headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <h2>Preview · {preview.rows.length} rows</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CSV row</th>
                  <th>Company</th>
                  <th>Position</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>{String(r.data.company || "—")}</td>
                    <td>{String(r.data.position || "—")}</td>
                    <td>
                      {r.errors.length ? (
                        <span className="danger">{r.errors.join(" · ")}</span>
                      ) : (
                        <span className="success">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={allowDuplicate}
              onChange={(e) => setAllowDuplicate(e.target.checked)}
            />
            Allow likely duplicates
          </label>
          <p className="muted">
            Valid rows are saved independently. Duplicate or failed rows are
            reported and can be retried.
          </p>
          <button
            className="button"
            onClick={commit}
            disabled={busy || !preview.valid}
          >
            {busy ? "Importing…" : `Import ${preview.rows.length} rows`}
          </button>
        </section>
      )}
      {!!results.length && (
        <section className="panel import-preview">
          <h2>
            <CheckCircle2 size={20} /> Import report
          </h2>
          {results.map((r) => (
            <div className="stat-row" key={r.row}>
              <span>Row {r.row}</span>
              <strong className={r.error ? "danger" : "success"}>
                {r.error || "Imported"}
              </strong>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
