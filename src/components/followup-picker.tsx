"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Application } from "@/lib/types";
import { Field, Modal, Empty } from "./ui";
import { EventForm } from "./event-form";
export function FollowupPicker({
  onClose,
  onSaved,
  timezone,
}: {
  onClose: () => void;
  onSaved: () => void;
  timezone: string;
}) {
  const [q, setQ] = useState(""),
    [apps, setApps] = useState<Application[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api<{ items: Application[] }>(
        `applications?${new URLSearchParams({ q, pageSize: "20" })}`,
      )
        .then((r) => {
          if (active) setApps(r.items);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);
  return selected ? (
    <EventForm
      kind="follow-ups"
      appId={selected}
      onClose={onClose}
      onSaved={onSaved}
      timezone={timezone}
    />
  ) : (
    <Modal
      open
      title="Choose a case"
      description="Attach the follow-up to an application."
      onClose={onClose}
    >
      <div className="form-body">
        <Field label="Search cases">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Company or position"
          />
        </Field>
        {error && <p className="form-error">{error}</p>}
        <div className="command-results">
          {apps.map((a) => (
            <button key={a.id} onClick={() => setSelected(a.id)}>
              {a.company} · {a.position}
            </button>
          ))}
        </div>
        {!apps.length && !error && (
          <Empty
            title="No cases found."
            text="Open a case first, then schedule a follow-up."
          />
        )}
      </div>
    </Modal>
  );
}
