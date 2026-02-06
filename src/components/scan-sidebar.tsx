"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { FullAnalysisResult } from "@/lib/types";

interface ScanEntry {
  domain: string;
  url: string;
  overall_score: number;
  analyzed_at: string;
}

interface ScanSidebarProps {
  currentUrl: string;
  onScanComplete: (result: FullAnalysisResult, url: string) => void;
}

function getCacheKey(domain: string) {
  return `scanCache_${domain}`;
}

function getScoreColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

export function ScanSidebar({ currentUrl, onScanComplete }: ScanSidebarProps) {
  const { user, session } = useAuth();
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingDomain, setAnalyzingDomain] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const supabase = getBrowserSupabase();
    supabase
      .from("scans")
      .select("domain, url, overall_score, analyzed_at")
      .eq("user_id", user.id)
      .order("analyzed_at", { ascending: false })
      .limit(100)
      .then(({ data: rows }: { data: any[] | null }) => {
        if (rows) {
          const seen = new Set<string>();
          const unique: ScanEntry[] = [];
          for (const row of rows) {
            if (!seen.has(row.domain)) {
              seen.add(row.domain);
              unique.push(row);
            }
            if (unique.length >= 20) break;
          }
          setScans(unique);
        }
        setLoading(false);
      });
  }, [user]);

  // Tıklama → cache'den anında göster
  const handleScanClick = (scan: ScanEntry) => {
    if (analyzingDomain) return;

    const cached = sessionStorage.getItem(getCacheKey(scan.domain));
    if (cached) {
      const result: FullAnalysisResult = JSON.parse(cached);
      onScanComplete(result, scan.url);
      return;
    }

    // Cache yoksa yeniden analiz yap
    runAnalysis(scan);
  };

  // Yeniden tara butonu → her zaman yeni analiz
  const handleRescan = (e: React.MouseEvent, scan: ScanEntry) => {
    e.stopPropagation();
    if (analyzingDomain) return;
    runAnalysis(scan);
  };

  const runAnalysis = async (scan: ScanEntry) => {
    setAnalyzingDomain(scan.domain);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: scan.url }),
      });

      if (!res.ok) throw new Error("Analiz başarısız");

      const result: FullAnalysisResult = await res.json();

      // Cache'e kaydet
      sessionStorage.setItem(getCacheKey(scan.domain), JSON.stringify(result));
      sessionStorage.setItem("analysisResult", JSON.stringify(result));
      sessionStorage.setItem("analyzedUrl", scan.url);

      // Sidebar'daki skoru güncelle
      setScans((prev) =>
        prev.map((s) =>
          s.domain === scan.domain
            ? { ...s, overall_score: result.scoring.overall, analyzed_at: result.analyzedAt }
            : s
        )
      );

      onScanComplete(result, scan.url);
    } catch {
      // Hata durumunda sessizce kapat
    } finally {
      setAnalyzingDomain(null);
    }
  };

  // Aktif domain'i bul
  const currentDomain = currentUrl
    ? currentUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    : "";

  if (collapsed) {
    return (
      <div className="w-10 border-r bg-muted/30 flex flex-col items-center pt-4 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
          title="Sidebar'ı aç"
        >
          &raquo;
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b">
        <span className="text-sm font-semibold text-foreground">Tarama Gecmisi</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
          title="Sidebar'ı kapat"
        >
          &laquo;
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!user ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Gecmis taramalarinizi gormek icin giris yapin.
            </p>
          </div>
        ) : loading ? (
          <div className="px-3 py-8 text-center">
            <div className="animate-pulse text-sm text-muted-foreground">Yukleniyor...</div>
          </div>
        ) : scans.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">Henuz tarama yapilmamis.</p>
          </div>
        ) : (
          <div className="py-1">
            {scans.map((scan) => {
              const isActive = scan.domain === currentDomain;
              const isAnalyzing = analyzingDomain === scan.domain;
              const hasCached = !!sessionStorage.getItem(getCacheKey(scan.domain));

              return (
                <div
                  key={scan.domain}
                  onClick={() => handleScanClick(scan)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary/10 border-r-2 border-primary"
                      : "hover:bg-muted/60"
                  } ${analyzingDomain && !isAnalyzing ? "opacity-50 pointer-events-none" : ""}`}
                >
                  {/* Favicon */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${scan.domain}&sz=32`}
                    alt=""
                    width={20}
                    height={20}
                    className="rounded shrink-0"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{scan.domain}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(scan.analyzed_at)}
                      {!hasCached && !isActive && (
                        <span className="ml-1 text-[10px] text-orange-500">yeni tarama</span>
                      )}
                    </p>
                  </div>

                  {/* Skor + yeniden tara */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isAnalyzing ? (
                      <svg
                        className="animate-spin h-4 w-4 text-primary"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <>
                        <span
                          className={`text-[11px] font-bold text-white px-1.5 py-0.5 rounded ${getScoreColor(
                            scan.overall_score
                          )}`}
                        >
                          {scan.overall_score}
                        </span>
                        {/* Yeniden tara ikonu */}
                        <button
                          onClick={(e) => handleRescan(e, scan)}
                          className="p-0.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          title="Yeniden tara"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
