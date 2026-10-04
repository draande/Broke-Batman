"use client";
import { useState } from "react";
import type { Bootstrap } from "@/types/domain";
import { api, errorMessage } from "@/lib/client";
import { Field } from "@/components/ui";
import { Integrations } from "@/features/inbox/components/integrations";
export function Settings({
  data,
  refresh,
  notify,
  setTheme,
}: {
  data: Bootstrap;
  refresh: () => void;
  notify: (m: string, error?: boolean) => void;
  setTheme: (theme: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const body = {
      weeklyTarget: Number(form.get("weeklyTarget")),
      streakEnabled: form.get("streakEnabled") === "on",
      theme: String(form.get("theme")),
      timezone: String(form.get("timezone")),
    };
    try {
      await api("preferences", "PUT", body);
      setTheme(body.theme);
      refresh();
      notify("Preferences saved.");
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TUNE YOUR COMMAND CENTER</div>
          <h1>Preferences</h1>
          <p>A sustainable search starts with a system that fits you.</p>
        </div>
      </div>
      <section className="panel settings-panel">
        <h2>Search settings</h2>
        <form onSubmit={save} className="form-body">
          <Field label="Weekly application target">
            <input
              type="number"
              name="weeklyTarget"
              min={1}
              max={500}
              required
              defaultValue={data.user.preference.weeklyTarget}
            />
          </Field>
          <label className="checkbox-field">
            <input
              name="streakEnabled"
              type="checkbox"
              defaultChecked={data.user.preference.streakEnabled}
            />
            <span>Show application streaks</span>
          </label>
          <Field label="Appearance">
            <select name="theme" defaultValue={data.user.preference.theme}>
              <option value="dark">Batcave Mode</option>
              <option value="light">Daylight Mode</option>
            </select>
          </Field>
          <Field
            label="Display timezone"
            hint="Use an IANA timezone, such as America/Los_Angeles or Europe/London."
          >
            <input
              name="timezone"
              required
              defaultValue={data.user.preference.timezone}
            />
          </Field>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save preferences"}
          </button>
        </form>
        <div className="settings-account">
          <h3>Signed in as</h3>
          <p>
            {data.user.name} · {data.user.email}
          </p>
        </div>
      </section>
      <Integrations notify={notify} refresh={refresh} />
    </>
  );
}
