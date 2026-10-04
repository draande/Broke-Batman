"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  CalendarDays,
  ChartNoAxesCombined,
  Sun,
  ArrowUpRight,
} from "lucide-react";
import { Modal } from "./ui";
import { api } from "@/lib/client";
import type { Application } from "@/lib/types";
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  return index < 0 ? (
    <>{text}</>
  ) : (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}
export function CommandPalette({
  open,
  onClose,
  add,
  toggleTheme,
  addFollowup,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  add: () => void;
  toggleTheme: () => void;
  addFollowup: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const router = useRouter(),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<Application[]>([]),
    [error, setError] = useState(""),
    [index, setIndex] = useState(0);
  const commands = [
    { label: "Add Application", Icon: Plus, action: add },
    { label: "Analyze Posting", Icon: Search, action: add },
    {
      label: "Bat-Inbox",
      Icon: Search,
      action: () => router.push("/app/inbox"),
    },
    { label: "Skills", Icon: Search, action: () => router.push("/app/skills") },
    {
      label: "Missions",
      Icon: CalendarDays,
      action: () => router.push("/app/missions"),
    },
    {
      label: "Sync Gmail",
      Icon: Search,
      action: () => {
        void api("gmail/sync", "POST")
          .then(() => notify("Sync queued."))
          .catch((e) => notify(e.message, true));
        router.push("/app/inbox");
      },
    },
    {
      label: "Export Data",
      Icon: Search,
      action: () => router.push("/app/transfers"),
    },
    {
      label: "Search Cases",
      Icon: Search,
      action: () => router.push("/app/cases"),
    },
    {
      label: "View Interviews",
      Icon: CalendarDays,
      action: () => router.push("/app/missions"),
    },
    {
      label: "View Analytics",
      Icon: ChartNoAxesCombined,
      action: () => router.push("/app/analytics"),
    },
    { label: "Add Follow-Up", Icon: CalendarDays, action: addFollowup },
    { label: "Toggle Daylight Mode", Icon: Sun, action: toggleTheme },
  ].filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    if (!query) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      api<{ items: Application[] }>(
        `applications?${new URLSearchParams({ q: query, pageSize: "8" })}`,
      )
        .then((r) => {
          if (active) {
            setResults(r.items);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open]);
  const actions = [
    ...commands.map((c) => c.action),
    ...results.map((a) => () => router.push(`/app/cases/${a.id}`)),
  ];
  const run = (action: () => void) => {
    onClose();
    action();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Command center"
      description="Search cases or choose a command. Arrow keys navigate; Enter selects."
    >
      <div className="command-search">
        <Search size={19} />
        <input
          autoFocus
          placeholder="Search cases or type a command…"
          aria-label="Command search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(actions.length - 1, i + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && actions[index]) {
              e.preventDefault();
              run(actions[index]);
            }
          }}
        />
      </div>
      <div className="command-results">
        {commands.map((c, i) => (
          <button
            className={index === i ? "selected" : ""}
            key={c.label}
            onClick={() => run(c.action)}
          >
            <c.Icon size={17} />
            {c.label}
            <ArrowUpRight size={14} />
          </button>
        ))}
        {results.map((a, i) => {
          const match = [
            a.jobDescription,
            ...a.notes.map((n) => n.body),
            ...a.contacts.map((c) => `${c.name} ${c.email}`),
            ...a.skills.map((s) => s.skill.name),
          ].find((v) => v.toLowerCase().includes(query.toLowerCase()));
          const at = match?.toLowerCase().indexOf(query.toLowerCase()) ?? 0;
          const snippet = match?.slice(
            Math.max(0, at - 30),
            at + query.length + 65,
          );
          return (
            <button
              key={a.id}
              className={index === commands.length + i ? "selected" : ""}
              onClick={() => run(() => router.push(`/app/cases/${a.id}`))}
            >
              <Search size={17} />
              <span>
                <strong>
                  <Highlight text={a.company} query={query} />
                </strong>
                <small>
                  <Highlight text={a.position} query={query} /> ·{" "}
                  {a.status.label} ·{" "}
                  {Math.floor(
                    (Date.now() - Date.parse(a.createdAt)) / 86400000,
                  )}{" "}
                  days old
                </small>
                {snippet && (
                  <small>
                    <Highlight text={snippet} query={query} />
                  </small>
                )}
              </span>
              <ArrowUpRight size={14} />
            </button>
          );
        })}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {query && !actions.length && !error && (
          <p className="muted">No matching cases or commands.</p>
        )}
      </div>
      <div className="command-footer">
        <span>↑ ↓ to navigate</span>
        <span>↵ to open</span>
        <span>esc to close</span>
      </div>
    </Modal>
  );
}
