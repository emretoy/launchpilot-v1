"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getBrowserSupabase } from "@/lib/supabase";
import { AuthButton } from "@/components/auth-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteCard } from "@/components/dashboard/site-card";
import { WeeklySummary } from "@/components/dashboard/weekly-summary";

interface SiteRow {
  id: string;
  name: string;
  url: string;
  status: string;
  created_at: string;
}

interface ScanRow {
  id: string;
  domain: string;
  url: string;
  overall_score: number;
  analyzed_at: string;
}

interface TaskRow {
  domain: string;
  status: string;
}

function domainFromUrl(url: string): string {
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function DashboardPage() {
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Site ekleme state
  const [newSiteUrl, setNewSiteUrl] = useState("");
  const [addingSite, setAddingSite] = useState(false);

  // Auth kontrolü
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Veri çek
  useEffect(() => {
    if (!user) return;
    const supabase = getBrowserSupabase();

    Promise.all([
      supabase
        .from("projects")
        .select("id, name, url, status, created_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("scans")
        .select("id, domain, url, overall_score, analyzed_at")
        .eq("user_id", user.id)
        .order("analyzed_at", { ascending: false }),
      Promise.resolve(
        supabase
          .from("tasks")
          .select("domain, status")
          .eq("user_id", user.id)
      ).catch(() => ({ data: null, error: { message: "tasks table not found" } })),
    ]).then(([sitesRes, scansRes, tasksRes]) => {
      if (sitesRes.error) console.error("Sites fetch error:", sitesRes.error);
      if (scansRes.error) console.error("Scans fetch error:", scansRes.error);
      if (tasksRes.error) console.error("Tasks fetch error (table may not exist yet):", tasksRes.error);
      setSites(sitesRes.data || []);
      setScans(scansRes.data || []);
      setTasks((tasksRes as { data: TaskRow[] | null }).data || []);
      setLoadingData(false);
    }).catch((err) => {
      console.error("Dashboard data fetch error:", err);
      setLoadingData(false);
    });
  }, [user]);

  // Site ekle
  const handleAddSite = async () => {
    if (!newSiteUrl.trim() || !user) return;
    setAddingSite(true);
    const supabase = getBrowserSupabase();
    const domain = domainFromUrl(newSiteUrl.trim());
    const url = newSiteUrl.trim().startsWith("http")
      ? newSiteUrl.trim()
      : `https://${newSiteUrl.trim()}`;

    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, name: domain, url })
      .select()
      .single();

    if (error) {
      console.error("Site ekleme hatası:", error);
    } else if (data) {
      setSites((prev) => [...prev, data as SiteRow]);
    }
    setNewSiteUrl("");
    setAddingSite(false);
  };

  // Site sil
  const handleRemoveSite = async (siteId: string) => {
    const supabase = getBrowserSupabase();
    await supabase.from("projects").update({ status: "archived" }).eq("id", siteId);
    setSites((prev) => prev.filter((s) => s.id !== siteId));
  };

  // Siteyi tara
  const handleScan = (siteUrl: string) => {
    router.push(`/?url=${encodeURIComponent(siteUrl)}`);
  };

  // Hesaplamalar
  const getScansForDomain = (domain: string) => scans.filter((s) => s.domain === domain);
  const getTasksForDomain = (domain: string) => tasks.filter((t) => t.domain === domain);

  const totalPending = tasks.filter((t) => t.status === "pending" || t.status === "regressed").length;
  const unscannedSites = sites.filter((s) => getScansForDomain(domainFromUrl(s.url)).length === 0).length;

  if (loading || (!user && !loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-12">
      {/* Header */}
      <header className="max-w-4xl mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <span
            className="text-lg font-bold tracking-tight cursor-pointer"
            onClick={() => router.push("/")}
          >
            LaunchPilot
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => router.push("/blog-yaz")}
          >
            Blog Yaz
          </Button>
          <AuthButton />
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Haftalık Özet */}
        {!loadingData && <WeeklySummary pendingTasks={totalPending} unscannedSites={unscannedSites} />}

        {/* Sitelerim */}
        <section>
          <h1 className="text-2xl font-bold mb-4">Sitelerim</h1>

          {loadingData ? (
            <div className="text-muted-foreground animate-pulse py-4">Yükleniyor...</div>
          ) : sites.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">
              Henüz site eklemediniz. Aşağıdan ekleyin.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {sites.map((site) => {
                const domain = domainFromUrl(site.url);
                const siteScans = getScansForDomain(domain);
                const lastScan = siteScans[0];
                const siteTasks = getTasksForDomain(domain);
                const pending = siteTasks.filter((t) => t.status === "pending" || t.status === "regressed").length;
                const completed = siteTasks.filter((t) => t.status === "completed" || t.status === "verified").length;

                return (
                  <SiteCard
                    key={site.id}
                    domain={domain}
                    url={site.url}
                    overallScore={lastScan?.overall_score ?? null}
                    pendingTasks={pending}
                    completedTasks={completed}
                    totalTasks={siteTasks.length}
                    lastScanAt={lastScan?.analyzed_at ?? null}
                    onScan={handleScan}
                    onRemove={() => handleRemoveSite(site.id)}
                  />
                );
              })}
            </div>
          )}

          {/* Site ekle */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="example.com"
              value={newSiteUrl}
              onChange={(e) => setNewSiteUrl(e.target.value)}
              disabled={addingSite}
              className="h-9 text-sm max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && handleAddSite()}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={addingSite || !newSiteUrl.trim()}
              onClick={handleAddSite}
            >
              {addingSite ? "Ekleniyor..." : "Site Ekle"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
