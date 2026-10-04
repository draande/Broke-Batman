"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  ArrowDownUp,
  Settings2,
  Search,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Command,
  Plus,
} from "lucide-react";
import { api } from "@/lib/client";
import type { Bootstrap } from "@/lib/types";
import { Mark, Skeleton } from "./ui";
import { Dashboard, AnalyticsPage } from "./dashboard";
import { Cases } from "./cases";
import { CaseDetail } from "./case-detail";
import { Missions } from "./missions";
import { Settings } from "./settings";
import { Transfers } from "./transfers";
import { ApplicationForm } from "./application-form";
import { CommandPalette } from "./command-palette";
import { FollowupPicker } from "./followup-picker";
import { BatInbox } from "./bat-inbox";
import { SearchIntelligence } from "./search-intelligence";
import { NotificationCenter } from "./notification-center";
const links = [
  { path: "/app", label: "Mission control", Icon: LayoutDashboard },
  { path: "/app/cases", label: "Cases", Icon: BriefcaseBusiness },
  { path: "/app/inbox", label: "Bat-Inbox", Icon: BriefcaseBusiness },
  { path: "/app/missions", label: "Missions", Icon: CalendarDays },
  { path: "/app/analytics", label: "Intelligence", Icon: ChartNoAxesCombined },
  { path: "/app/skills", label: "Skills", Icon: ShieldCheck },
  { path: "/app/companies", label: "Companies", Icon: BriefcaseBusiness },
  { path: "/app/transfers", label: "Import & export", Icon: ArrowDownUp },
];
export function AppShell() {
  const pathname = usePathname(),
    [data, setData] = useState<Bootstrap | null>(null),
    [error, setError] = useState(""),
    [add, setAdd] = useState(false),
    [command, setCommand] = useState(false),
    [mobile, setMobile] = useState(false),
    [followup, setFollowup] = useState(false),
    [theme, setThemeState] = useState("dark"),
    [toast, setToast] = useState<{ message: string; error: boolean } | null>(
      null,
    ),
    [version, setVersion] = useState(0);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const setTheme = useCallback((t: string) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
  }, []);
  useEffect(() => {
    let active = true;
    api<Bootstrap>("bootstrap")
      .then((result) => {
        if (active) {
          setData(result);
          setTheme(result.user.preference.theme);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [version, setTheme]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((o) => !o);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => setMobile(false), [pathname]);
  async function toggleTheme() {
    if (!data) return;
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      await api("preferences", "PUT", { ...data.user.preference, theme: next });
      setData({
        ...data,
        user: {
          ...data.user,
          preference: { ...data.user.preference, theme: next },
        },
      });
    } catch (e) {
      setTheme(theme);
      notify((e as Error).message, true);
    }
  }
  const current =
    links.find((l) => l.path === pathname)?.label ||
    (pathname === "/app/settings" ? "Preferences" : "Case dossier");
  const detail = pathname.startsWith("/app/cases/")
    ? pathname.split("/")[3]
    : null;
  const addCase = () => setAdd(true);
  return (
    <div className="app-layout">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link className="brand" href="/app">
          <Mark size={35} />
          <span>
            BROKE BATMAN<small>JOB SEARCH COMMAND CENTER</small>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-icon">B</span>
          <div>
            Personal workspace<small>THE BATCAVE</small>
          </div>
          <span className="signal" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(({ path, label, Icon }) => (
            <Link
              aria-current={pathname === path ? "page" : undefined}
              className={
                pathname === path || (path === "/app/cases" && detail)
                  ? "active"
                  : ""
              }
              href={path}
              key={path}
            >
              <Icon size={18} />
              {label}
              {path === "/app/cases" && data && (
                <span className="nav-count">{data.analytics.total}</span>
              )}
              {path === "/app/missions" &&
                data &&
                data.followUps.some(
                  (f) => !f.completedAt && new Date(f.dueAt) < new Date(),
                ) && <span className="nav-alert" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="eyebrow">
            <ShieldCheck size={14} /> THE LONG GAME
          </div>
          <p>
            One application closer
            <br />
            to hanging up the cape.
          </p>
          <button onClick={addCase}>
            <Plus size={14} />
            Open a new case
          </button>
        </div>
        <div className="sidebar-bottom">
          <Link href="/app/settings">
            <Settings2 size={17} />
            Preferences
          </Link>
          <button onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}{" "}
            {theme === "dark" ? "Daylight Mode" : "Batcave Mode"}
          </button>
          <button
            onClick={async () => {
              try {
                await api("auth/logout", "POST");
                window.location.assign("/");
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
          <div className="user-card">
            <span>{data?.user.name[0] || "B"}</span>
            <div>
              <strong>{data?.user.name || "Loading…"}</strong>
              <small>PERSONAL ACCOUNT</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span> <strong>{current}</strong>
            </span>
          </div>
          <button className="global-search" onClick={() => setCommand(true)}>
            <Search size={16} />
            <span>Search the Batcomputer</span>
            <kbd>
              <Command size={11} /> K
            </kbd>
          </button>
          <NotificationCenter notify={notify} />
          <span className="system-status">
            <span className="signal" />
            SYSTEM ONLINE
          </span>
        </header>
        <main className="main">
          {error ? (
            <div className="panel empty">
              <h2>Unable to load the command center.</h2>
              <p className="form-error" role="alert">
                {error}
              </p>
              <button className="button" onClick={refresh}>
                Try again
              </button>
            </div>
          ) : !data ? (
            <Skeleton />
          ) : detail ? (
            <CaseDetail
              key={detail}
              id={detail}
              data={data}
              refresh={refresh}
              notify={notify}
            />
          ) : pathname === "/app" ? (
            <>
              <Dashboard data={data} add={addCase} />
              <SearchIntelligence
                mode="dashboard"
                notify={notify}
                version={version}
              />
            </>
          ) : pathname === "/app/cases" ? (
            <Cases
              data={data}
              add={addCase}
              refresh={refresh}
              notify={notify}
            />
          ) : pathname === "/app/missions" ? (
            <Missions data={data} refresh={refresh} notify={notify} />
          ) : pathname === "/app/analytics" ? (
            <>
              <AnalyticsPage data={data} />
              <SearchIntelligence
                mode="analytics"
                notify={notify}
                version={version}
              />
            </>
          ) : pathname === "/app/inbox" ? (
            <BatInbox notify={notify} refresh={refresh} />
          ) : pathname === "/app/skills" || pathname === "/app/companies" ? (
            <SearchIntelligence
              mode={pathname === "/app/skills" ? "skills" : "companies"}
              notify={notify}
              version={version}
            />
          ) : pathname === "/app/settings" ? (
            <Settings
              data={data}
              refresh={refresh}
              notify={notify}
              setTheme={setTheme}
            />
          ) : pathname === "/app/transfers" ? (
            <Transfers refresh={refresh} notify={notify} />
          ) : (
            <div className="empty">
              <h1>Page not found.</h1>
              <Link href="/app">Back to mission control</Link>
            </div>
          )}
          <footer className="app-footer">
            <span>
              <Mark size={13} /> BROKE BATMAN
            </span>
            <span>Less chaos. More clarity.</span>
          </footer>
        </main>
      </div>
      {add && data && (
        <ApplicationForm
          open
          onClose={() => setAdd(false)}
          statuses={data.statuses}
          onSaved={() => {
            refresh();
            notify("Case opened. Your next chapter is in motion.");
          }}
        />
      )}
      <CommandPalette
        notify={notify}
        open={command}
        onClose={() => setCommand(false)}
        add={addCase}
        toggleTheme={toggleTheme}
        addFollowup={() => setFollowup(true)}
      />
      {followup && data && (
        <FollowupPicker
          timezone={data.user.preference.timezone}
          onClose={() => setFollowup(false)}
          onSaved={() => {
            refresh();
            notify("Follow-up scheduled.");
          }}
        />
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.message}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
