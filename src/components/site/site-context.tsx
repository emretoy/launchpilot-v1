"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import type { FullAnalysisResult, Task } from "@/lib/types";

interface SiteContextType {
  domain: string;
  data: FullAnalysisResult | null;
  tasks: Task[];
  loading: boolean;
  updateTaskStatus: (taskId: string, status: Task["status"]) => Promise<void>;
  rescan: () => Promise<void>;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({
  domain,
  children,
}: {
  domain: string;
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const [data, setData] = useState<FullAnalysisResult | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);

      // 1. sessionStorage'dan kontrol
      const cached = sessionStorage.getItem(`scanCache_${domain}`);
      if (cached) {
        try {
          const parsed: FullAnalysisResult = JSON.parse(cached);
          if (!cancelled) setData(parsed);
        } catch {
          // corrupt cache, devam et
        }
      }

      // 2. API'den tasks + result_json çek (auth varsa)
      if (session?.access_token) {
        try {
          const res = await fetch(`/api/site/${encodeURIComponent(domain)}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const json = await res.json();
            if (!cancelled) {
              if (json.scan?.result_json) {
                setData(json.scan.result_json as FullAnalysisResult);
                // Cache'i güncelle
                sessionStorage.setItem(
                  `scanCache_${domain}`,
                  JSON.stringify(json.scan.result_json)
                );
              }
              setTasks(json.tasks || []);
            }
          }
        } catch (err) {
          console.error("Site data fetch error:", err);
        }
      }

      if (!cancelled) setLoading(false);
    }

    loadData();
    return () => { cancelled = true; };
  }, [domain, session?.access_token]);

  const updateTaskStatus = useCallback(
    async (taskId: string, status: Task["status"]) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status,
                completed_at: status === "completed" ? new Date().toISOString() : t.completed_at,
              }
            : t
        )
      );

      // API call
      if (session?.access_token) {
        try {
          const res = await fetch(`/api/tasks/${taskId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ status }),
          });
          if (!res.ok) {
            // Revert on error
            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? { ...t, status: status === "completed" ? "pending" : "completed" }
                  : t
              )
            );
          }
        } catch {
          // Revert
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, status: status === "completed" ? "pending" : "completed" }
                : t
            )
          );
        }
      }
    },
    [session?.access_token]
  );

  const rescan = useCallback(async () => {
    if (!session?.access_token) return;
    const url = data?.crawl.basicInfo.finalUrl || data?.crawl.basicInfo.url || `https://${domain}`;
    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        const result: FullAnalysisResult = await res.json();
        setData(result);
        sessionStorage.setItem(`scanCache_${domain}`, JSON.stringify(result));

        // Re-fetch tasks (sync happened server-side)
        const siteRes = await fetch(`/api/site/${encodeURIComponent(domain)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (siteRes.ok) {
          const json = await siteRes.json();
          setTasks(json.tasks || []);
        }
      }
    } catch (err) {
      console.error("Rescan error:", err);
    } finally {
      setLoading(false);
    }
  }, [data, domain, session?.access_token]);

  return (
    <SiteContext.Provider value={{ domain, data, tasks, loading, updateTaskStatus, rescan }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteContext() {
  const context = useContext(SiteContext);
  if (context === undefined) {
    throw new Error("useSiteContext must be used within a SiteProvider");
  }
  return context;
}
