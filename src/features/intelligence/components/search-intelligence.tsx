"use client";
import { useEffect, useState } from "react";
import type { Intelligence } from "@/server/services/intelligence";
import { api, errorMessage } from "@/lib/client";
import { Skeleton } from "@/components/ui";
import { SkillsProfile } from "./skills-profile";
import { CompanyInsights } from "./company-insights";
import { DashboardSignals } from "./dashboard-signals";
import { AnalyticsInsights } from "./analytics-insights";
export function SearchIntelligence({
  mode,
  notify,
  version = 0,
}: {
  mode: "dashboard" | "analytics" | "skills" | "companies";
  notify: (message: string, error?: boolean) => void;
  version?: number;
}) {
  const [data, setData] = useState<Intelligence | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<Intelligence>("intelligence")
      .then((result) => {
        if (live) {
          setData(result);
          setError("");
        }
      })
      .catch((error) => {
        if (live) setError(errorMessage(error));
      });
    return () => {
      live = false;
    };
  }, [version]);
  if (error)
    return (
      <div className="panel">
        <p role="alert" className="form-error">
          {error}
        </p>
      </div>
    );
  if (!data) return <Skeleton />;
  if (mode === "skills")
    return <SkillsProfile data={data} notify={notify} onUpdated={setData} />;
  if (mode === "companies") return <CompanyInsights data={data} />;
  if (mode === "dashboard") return <DashboardSignals data={data} />;
  return <AnalyticsInsights data={data} notify={notify} />;
}
