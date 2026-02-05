"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getBrowserSupabase } from "@/lib/supabase";
import { AuthButton } from "@/components/auth-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

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
  category_scores: Record<string, number>;
  analyzed_at: string;
  duration: number;
}

const categoryLabels: Record<string, string> = {
  performance: "Perf",
  seo: "SEO",
  security: "Güv",
  accessibility: "Eriş",
  bestPractices: "BP",
  domainTrust: "DT",
  content: "İçerik",
  technology: "Tek",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Site ekleme state
  const [newSiteUrl, setNewSiteUrl] = useState("");
  const [addingSite, setAddingSite] = useState(false);

  // Auth kontrolü
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Siteleri ve analizleri çek
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
        .select("id, domain, url, overall_score, category_scores, analyzed_at, duration")
        .eq("user_id", user.id)
        .order("analyzed_at", { ascending: false }),
    ]).then(([sitesRes, scansRes]) => {
      if (sitesRes.error) console.error("Sites fetch error:", sitesRes.error);
      if (scansRes.error) console.error("Scans fetch error:", scansRes.error);
      setSites(sitesRes.data || []);
      setScans(scansRes.data || []);
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

  // Bir site için taramaları getir (domain eşleşmesi)
  const getScansForSite = (site: SiteRow): ScanRow[] => {
    const domain = domainFromUrl(site.url);
    return scans.filter((s) => s.domain === domain);
  };

  // Checkbox toggle
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) return prev;
        next.add(id);
      }
      return next;
    });
  };

  // Karşılaştırma kontrolü
  const selectedArray = Array.from(selected);
  const canCompare =
    selectedArray.length === 2 &&
    scans.find((s) => s.id === selectedArray[0])?.domain ===
      scans.find((s) => s.id === selectedArray[1])?.domain;

  const handleCompare = () => {
    if (selectedArray.length === 2) {
      router.push(`/dashboard/compare?a=${selectedArray[0]}&b=${selectedArray[1]}`);
    }
  };

  // Siteyi tara
  const handleScan = (siteUrl: string) => {
    router.push(`/?url=${encodeURIComponent(siteUrl)}`);
  };

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
        <AuthButton />
      </header>

      <div className="max-w-4xl mx-auto">
        {/* Sitelerim */}
        <section className="mb-10">
          <h1 className="text-2xl font-bold mb-4">Sitelerim</h1>

          {/* Site kartları */}
          {loadingData ? (
            <div className="text-muted-foreground animate-pulse py-4">Yükleniyor...</div>
          ) : sites.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">
              Henüz site eklemediniz. Aşağıdan ekleyin.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {sites.map((site) => {
                const siteScans = getScansForSite(site);
                const lastScan = siteScans[0];
                return (
                  <Card key={site.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{site.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{site.url}</p>
                        {lastScan ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Son skor:{" "}
                            <span className={`font-semibold ${scoreColor(lastScan.overall_score)}`}>
                              {lastScan.overall_score}/100
                            </span>
                            {" · "}
                            {siteScans.length} tarama
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">Henüz taranmadı</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => handleScan(site.url)}
                        >
                          Tara
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveSite(site.id)}
                        >
                          Kaldır
                        </Button>
                      </div>
                    </div>
                  </Card>
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

        {/* Geçmiş Analizler */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Geçmiş Analizler</h2>
            {selected.size === 2 && (
              <Button
                onClick={handleCompare}
                disabled={!canCompare}
                size="sm"
                title={!canCompare ? "Aynı domain'den 2 analiz seçin" : ""}
              >
                Karşılaştır
              </Button>
            )}
          </div>

          {selected.size === 1 && (
            <p className="text-sm text-muted-foreground mb-3">
              Karşılaştırmak için aynı siteden bir analiz daha seçin
            </p>
          )}
          {selected.size === 2 && !canCompare && (
            <p className="text-sm text-destructive mb-3">
              Karşılaştırma için aynı siteden iki analiz seçmelisiniz
            </p>
          )}

          {loadingData ? (
            <div className="text-muted-foreground animate-pulse py-8">Analizler yükleniyor...</div>
          ) : scans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Henüz analiz yapılmadı. Bir sitenizi tarayarak başlayın.
            </p>
          ) : (
            <div className="space-y-2">
              {scans.map((scan) => {
                const isSelected = selected.has(scan.id);
                return (
                  <Card
                    key={scan.id}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                    }`}
                    onClick={() => toggleSelect(scan.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* İçerik */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{scan.domain}</p>
                          <span className={`text-lg font-bold ${scoreColor(scan.overall_score)}`}>
                            {scan.overall_score}/100
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(scan.analyzed_at)} &middot; {(scan.duration / 1000).toFixed(1)}s
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {scan.category_scores &&
                            Object.entries(scan.category_scores).map(([key, score]) => (
                              <span key={key} className="text-xs px-2 py-0.5 rounded-full bg-muted">
                                {categoryLabels[key] || key}:{" "}
                                <span className={scoreColor(score as number)}>{score as number}</span>
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
