"use client";
import { useEffect, useState, useCallback } from "react";
import { api, timeLabel } from "@/lib/client";
import { Field, Modal } from "./ui";
type ConnectionStatus = {
  connection: { mode: string; account: string; state: string } | null;
  sync: {
    status: string;
    lastSyncedAt: string | null;
    error: string | null;
  } | null;
  configured: boolean;
};
export function Integrations({
  notify,
  refresh,
}: {
  notify: (m: string, e?: boolean) => void;
  refresh: () => void;
}) {
  const [data, setData] = useState<ConnectionStatus | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [scope, setScope] = useState<"email" | "all" | null>(null),
    [confirmation, setConfirmation] = useState("");
  const [oauthError, setOAuthError] = useState(false);
  useEffect(() => {
    setOAuthError(
      new URLSearchParams(window.location.search).get("gmail") === "error",
    );
  }, []);
  const reload = useCallback(
    () =>
      api<ConnectionStatus>("gmail/status")
        .then((r) => {
          setData(r);
          setError("");
        })
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [reload]);
  async function run(path: string) {
    setBusy(true);
    try {
      const result = await api<{ url?: string }>(`gmail/${path}`, "POST");
      if (result.url) window.location.assign(result.url);
      else {
        await reload();
        refresh();
        notify(
          path === "sync" || path === "demo"
            ? "Sync queued for the background worker."
            : "Gmail disconnected.",
        );
      }
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel settings-panel integration-panel">
        <div className="eyebrow">BATCOMPUTER INTEGRATIONS</div>
        <h2>Gmail signals</h2>
        {oauthError && (
          <p role="alert" className="form-error">
            Gmail connection was not completed. The authorization may have
            expired or been declined. Reconnect to try again.
          </p>
        )}
        <p>
          Optional read-only access. The app cannot send, modify, or delete your
          mail.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {data?.connection ? (
          <>
            <p>
              <strong>{data.connection.account}</strong> ·{" "}
              {data.connection.state}
              {data.connection.mode === "demo" ? " · FICTIONAL DEMO" : ""}
            </p>
            <p className="muted">
              Sync: {data.sync?.status || "idle"} · Last successful sync:{" "}
              {data.sync?.lastSyncedAt
                ? timeLabel(data.sync.lastSyncedAt)
                : "Never"}
            </p>
            {data.sync?.error && (
              <p className="form-error">{data.sync.error}</p>
            )}
            <div className="button-row">
              <button
                className="button"
                disabled={busy}
                onClick={() => void run("sync")}
              >
                Sync Gmail
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void run("disconnect")}
              >
                Disconnect Gmail
              </button>
              {data.connection.state === "reconnect" && (
                <button className="button" onClick={() => void run("connect")}>
                  Reconnect Gmail
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="button-row">
              <button
                className="button"
                disabled={busy || !data?.configured}
                onClick={() => void run("connect")}
              >
                Connect Gmail
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void run("demo")}
              >
                Try fictional inbox demo
              </button>
            </div>
            {data && !data.configured && (
              <p className="muted">
                Google credentials and a token encryption key are required for a
                real connection. The demo uses five clearly labeled fictional
                messages.
              </p>
            )}
          </>
        )}
        <p className="muted">
          Stored: sender, subject, a 240-character excerpt, message IDs,
          classification, matching evidence, suggestions and your decisions.
          Full bodies are processed temporarily. Tokens are encrypted on the
          server. Job-search messages are queried from the last 90 days;
          unrelated messages are discarded.
        </p>
      </section>
      <section className="panel settings-panel integration-panel">
        <h2>Privacy controls</h2>
        <p>
          Export your data before deleting it. Disconnecting revokes Google
          access; deleting imported metadata also removes the inbox and its
          suggestion records.
        </p>
        <div className="button-row">
          <a className="button secondary" href="/api/export?format=json">
            Export job-search data
          </a>
          <button
            className="button secondary"
            onClick={() => {
              setScope("email");
              setConfirmation("");
            }}
          >
            Delete imported email metadata
          </button>
          <button
            className="button danger"
            onClick={() => {
              setScope("all");
              setConfirmation("");
            }}
          >
            Delete all job-search data
          </button>
        </div>
      </section>
      {scope && (
        <Modal
          open
          onClose={() => setScope(null)}
          title={
            scope === "all"
              ? "Delete all job-search data?"
              : "Delete imported email metadata?"
          }
          description="This permanently removes the selected data and disconnects Gmail. Your login account remains. Type DELETE to confirm."
        >
          <form
            className="form-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("privacy", "DELETE", { scope, confirmation });
                setScope(null);
                await reload();
                refresh();
                notify("Selected data deleted.");
              } catch (err) {
                notify((err as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Confirmation">
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />
            </Field>
            <button
              className="button danger"
              disabled={busy || confirmation !== "DELETE"}
            >
              Permanently delete
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
