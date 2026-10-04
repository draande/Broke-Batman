"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search,
  List,
  Columns3,
  SlidersHorizontal,
  ArrowUpRight,
  MapPin,
  Archive,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { api, dateLabel, errorMessage } from "@/lib/client";
import type { Application, Bootstrap } from "@/types/domain";
import { Badge, Empty, Modal, Skeleton } from "@/components/ui";
type Result = {
  items: Application[];
  total: number;
  pages: number;
  page: number;
  pageSize: number;
};
export function Cases({
  data,
  add,
  notify,
  refresh,
}: {
  data: Bootstrap;
  add: () => void;
  notify: (message: string, error?: boolean) => void;
  refresh: () => void;
}) {
  const [result, setResult] = useState<Result | null>(null),
    [view, setView] = useState("table"),
    [q, setQ] = useState(""),
    [query, setQuery] = useState(""),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [showFilters, setShowFilters] = useState(false),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0),
    [moving, setMoving] = useState<string[]>([]);
  const pendingMoves = useRef(new Set<string>());
  const requestVersion = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        ...filters,
        q: query,
        page: String(page),
        pageSize: view === "board" ? "100" : "10",
      });
      const response = await api<Result>(`applications?${params}`);
      if (view === "board" && response.pages > 1) {
        for (let i = 2; i <= response.pages; i++) {
          const next = await api<Result>(
            `applications?${new URLSearchParams({ ...filters, q: query, page: String(i), pageSize: "100" })}`,
          );
          response.items.push(...next.items);
        }
      }
      if (version === requestVersion.current) {
        setResult(response);
        setSelected([]);
      }
    } catch (e) {
      if (version === requestVersion.current) setError(errorMessage(e));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [filters, query, page, view]);
  useEffect(() => {
    void load();
  }, [load, reload, data.analytics.total]);
  const filter = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  async function bulk(action: string) {
    setBusy(true);
    try {
      await api("applications/bulk", "POST", { ids: selected, action });
      notify(
        `${selected.length} case${selected.length === 1 ? "" : "s"} ${action === "delete" ? "deleted" : action === "archive" ? "archived" : "restored"}.`,
      );
      setDeleteOpen(false);
      setReload((n) => n + 1);
      refresh();
    } catch (e) {
      notify(errorMessage(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function move(id: string, statusId: string) {
    if (!result || pendingMoves.current.has(id)) return;
    const previous = result.items.find((a) => a.id === id);
    if (!previous) return;
    pendingMoves.current.add(id);
    setMoving([...pendingMoves.current]);
    const status = data.statuses.find((s) => s.id === statusId)!;
    setResult({
      ...result,
      items: result.items.map((a) =>
        a.id === id ? { ...a, statusId, status } : a,
      ),
    });
    try {
      await api(`applications/${id}`, "PATCH", { statusId });
      notify(`Case moved to ${status.label}.`);
      refresh();
    } catch (e) {
      setResult((current) =>
        current
          ? {
              ...current,
              items: current.items.map((app) =>
                app.id === id ? previous : app,
              ),
            }
          : current,
      );
      notify(errorMessage(e), true);
    } finally {
      pendingMoves.current.delete(id);
      setMoving([...pendingMoves.current]);
    }
  }
  const allSelected =
    !!result?.items.length &&
    result.items.every((a) => selected.includes(a.id));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR OPPORTUNITY DOSSIER</div>
          <h1>
            Cases <span className="count">{result?.total ?? "—"}</span>
          </h1>
          <p>Every lead. Every conversation. Every next step.</p>
        </div>
        <button className="button" onClick={add}>
          + Open a case
        </button>
      </div>
      <section className="panel cases-panel">
        <div className="cases-toolbar">
          <label className="search-box">
            <Search size={17} />
            <input
              aria-label="Search cases"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search cases, notes, skills…"
            />
          </label>
          <div className="toolbar-actions">
            <button
              className={`button secondary ${showFilters ? "chosen" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={16} />
              Filters
            </button>
            <div className="segmented compact">
              <button
                aria-label="Table view"
                className={view === "table" ? "active" : ""}
                onClick={() => {
                  setView("table");
                  setPage(1);
                }}
              >
                <List size={17} />
              </button>
              <button
                aria-label="Kanban view"
                className={view === "board" ? "active" : ""}
                onClick={() => {
                  setView("board");
                  setPage(1);
                }}
              >
                <Columns3 size={17} />
              </button>
            </div>
          </div>
        </div>
        {showFilters && (
          <div className="filter-grid">
            {[
              {
                key: "statusId",
                label: "Status",
                options: data.statuses.map((s) => ({
                  value: s.id,
                  label: s.label,
                })),
              },
              {
                key: "company",
                label: "Company",
                options: data.choices.companies.map((s) => ({
                  value: s,
                  label: s,
                })),
              },
              {
                key: "location",
                label: "Location",
                options: data.choices.locations.map((s) => ({
                  value: s,
                  label: s,
                })),
              },
              {
                key: "workMode",
                label: "Work mode",
                options: ["Remote", "Hybrid", "On-site"].map((s) => ({
                  value: s,
                  label: s,
                })),
              },
              {
                key: "employmentType",
                label: "Employment",
                options: [
                  "Full-time",
                  "Internship",
                  "Part-time",
                  "Contract",
                ].map((s) => ({ value: s, label: s })),
              },
              {
                key: "source",
                label: "Source",
                options: data.choices.sources.map((s) => ({
                  value: s,
                  label: s,
                })),
              },
            ].map((f) => (
              <label className="field" key={f.key}>
                <span>{f.label}</span>
                <select
                  value={filters[f.key] || ""}
                  onChange={(e) => filter(f.key, e.target.value)}
                >
                  <option value="">All</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="field">
              <span>Applied from</span>
              <input
                type="date"
                value={filters.from || ""}
                onChange={(e) => filter("from", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Applied until</span>
              <input
                type="date"
                value={filters.to || ""}
                onChange={(e) => filter("to", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Sort by</span>
              <select
                value={filters.sort || "createdAt"}
                onChange={(e) => filter("sort", e.target.value)}
              >
                {[
                  "createdAt",
                  "company",
                  "position",
                  "dateApplied",
                  "updatedAt",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/([A-Z])/g, " $1")}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Direction</span>
              <select
                value={filters.direction || "desc"}
                onChange={(e) => filter("direction", e.target.value)}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
            <label className="field">
              <span>Archive</span>
              <select
                value={filters.archived || "false"}
                onChange={(e) => filter("archived", e.target.value)}
              >
                <option value="false">Active cases</option>
                <option value="true">Archived cases</option>
              </select>
            </label>
            <button
              className="button secondary"
              onClick={() => {
                setFilters({});
                setQ("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        {!!selected.length && (
          <div className="bulk-bar">
            <strong>{selected.length} selected</strong>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                bulk(filters.archived === "true" ? "restore" : "archive")
              }
            >
              {filters.archived === "true" ? (
                <RotateCcw size={15} />
              ) : (
                <Archive size={15} />
              )}{" "}
              {filters.archived === "true" ? "Restore" : "Archive"}
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
            <button className="button secondary" onClick={load}>
              Retry
            </button>
          </div>
        )}
        {loading && !result ? (
          <Skeleton />
        ) : result?.items.length ? (
          view === "table" ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Select all visible cases"
                          checked={allSelected}
                          onChange={() =>
                            setSelected(
                              allSelected ? [] : result.items.map((a) => a.id),
                            )
                          }
                        />
                      </th>
                      <th>
                        <button
                          className="sort-button"
                          onClick={() => {
                            filter("sort", "company");
                            filter(
                              "direction",
                              filters.direction === "asc" ? "desc" : "asc",
                            );
                          }}
                        >
                          Company ↕
                        </button>
                      </th>
                      <th>Position</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th>Applied</th>
                      <th>Next event</th>
                      <th>Source</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((app) => {
                      const events = [
                        ...app.interviews
                          .filter((i) => i.outcome === "Scheduled")
                          .map((i) => ({
                            date: i.startsAt,
                            title: `${i.type} interview`,
                          })),
                        ...app.followUps
                          .filter((f) => !f.completedAt)
                          .map((f) => ({ date: f.dueAt, title: f.title })),
                        ...(app.applicationDeadline
                          ? [
                              {
                                date: app.applicationDeadline,
                                title: "Deadline",
                              },
                            ]
                          : []),
                      ]
                        .filter((e) => new Date(e.date) > new Date())
                        .sort((x, y) => +new Date(x.date) - +new Date(y.date));
                      return (
                        <tr key={app.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${app.company}`}
                              checked={selected.includes(app.id)}
                              onChange={() =>
                                setSelected((s) =>
                                  s.includes(app.id)
                                    ? s.filter((id) => id !== app.id)
                                    : [...s, app.id],
                                )
                              }
                            />
                          </td>
                          <td>
                            <Link
                              className="company-cell"
                              href={`/app/cases/${app.id}`}
                            >
                              <span
                                className="company-avatar"
                                aria-hidden="true"
                              >
                                {app.company
                                  .split(" ")
                                  .map((w) => w[0])
                                  .slice(0, 2)
                                  .join("")}
                              </span>
                              <strong>{app.company}</strong>
                            </Link>
                          </td>
                          <td>
                            <Link href={`/app/cases/${app.id}`}>
                              {app.position}
                            </Link>
                            <small className="cell-sub">
                              {app.employmentType}
                            </small>
                          </td>
                          <td>
                            <Badge status={app.status} />
                            <small className="case-health">{app.health}</small>
                          </td>
                          <td>
                            {app.location || "—"}
                            <small className="cell-sub">{app.workMode}</small>
                          </td>
                          <td>{dateLabel(app.dateApplied)}</td>
                          <td>
                            {events[0] ? (
                              <>
                                <span>
                                  {dateLabel(
                                    events[0].date,
                                    data.user.preference.timezone,
                                  )}
                                </span>
                                <small className="cell-sub">
                                  {events[0].title}
                                </small>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <span className="source">{app.source}</span>
                          </td>
                          <td>
                            <Link
                              aria-label={`View ${app.company} case`}
                              href={`/app/cases/${app.id}`}
                              className="icon-button"
                            >
                              <ArrowUpRight size={17} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mobile-cases">
                {result.items.map((app) => (
                  <Link
                    className="mobile-case"
                    href={`/app/cases/${app.id}`}
                    key={app.id}
                  >
                    <div>
                      <strong>{app.company}</strong>
                      <Badge status={app.status} />
                      <small className="case-health">{app.health}</small>
                    </div>
                    <h3>{app.position}</h3>
                    <p>
                      {app.location} · {app.workMode}
                    </p>
                    <small>Applied {dateLabel(app.dateApplied)}</small>
                  </Link>
                ))}
              </div>
              <div className="pagination">
                <span>
                  {(page - 1) * 10 + 1}–{Math.min(page * 10, result.total)} of{" "}
                  {result.total} cases
                </span>
                <div>
                  <button
                    className="icon-button"
                    aria-label="Previous page"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span>
                    Page {page} / {result.pages}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Next page"
                    disabled={page >= result.pages || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="kanban" aria-label="Application kanban board">
              {data.statuses.map((s) => (
                <section
                  className="kanban-column"
                  key={s.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (result.items.some((a) => a.id === id))
                      void move(id, s.id);
                  }}
                >
                  <div className="kanban-title">
                    <Badge status={s} />
                    <span>
                      {result.items.filter((a) => a.statusId === s.id).length}
                    </span>
                  </div>
                  {result.items
                    .filter((a) => a.statusId === s.id)
                    .map((app) => (
                      <article
                        key={app.id}
                        className="kanban-card"
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", app.id)
                        }
                      >
                        <Link href={`/app/cases/${app.id}`}>
                          <div className="company-avatar">
                            {app.company
                              .split(" ")
                              .map((w) => w[0])
                              .slice(0, 2)
                              .join("")}
                          </div>
                          <h3>{app.company}</h3>
                          <span className="case-health">{app.health}</span>
                          <p>{app.position}</p>
                          <small>
                            <MapPin size={12} />
                            {app.location || app.workMode}
                          </small>
                        </Link>
                        <select
                          aria-label={`Move ${app.company} to status`}
                          disabled={moving.includes(app.id)}
                          value={app.statusId}
                          onChange={(e) => move(app.id, e.target.value)}
                        >
                          {data.statuses.map((status) => (
                            <option value={status.id} key={status.id}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </article>
                    ))}
                  <div className="drop-hint">Drop a case here</div>
                </section>
              ))}
            </div>
          )
        ) : (
          !error && (
            <Empty
              title={
                query || Object.values(filters).some(Boolean)
                  ? "No cases match your filters."
                  : "No cases yet."
              }
              text={
                query || Object.values(filters).some(Boolean)
                  ? "Try another company, role, or skill."
                  : "Apparently vigilantism doesn’t count as professional experience."
              }
              action={
                <button className="button" onClick={add}>
                  Open a case
                </button>
              }
            />
          )
        )}
      </section>
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Permanently delete these cases?"
        description="This deletes their interviews, notes, contacts, and history. This action cannot be undone."
      >
        <div className="form-footer">
          <button
            className="button secondary"
            onClick={() => setDeleteOpen(false)}
          >
            Keep cases
          </button>
          <button
            className="button danger-button"
            disabled={busy}
            onClick={() => bulk("delete")}
          >
            Delete {selected.length} cases
          </button>
        </div>
      </Modal>
    </>
  );
}
