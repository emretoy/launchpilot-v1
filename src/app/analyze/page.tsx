"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalysisResultView } from "@/components/analysis-result";
import { ScanSidebar } from "@/components/scan-sidebar";
import { AuthButton } from "@/components/auth-button";
import { Button } from "@/components/ui/button";
import type { FullAnalysisResult } from "@/lib/types";

export default function AnalyzePage() {
  const [data, setData] = useState<FullAnalysisResult | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = sessionStorage.getItem("analysisResult");
    const url = sessionStorage.getItem("analyzedUrl");
    if (stored) {
      const parsed: FullAnalysisResult = JSON.parse(stored);
      setData(parsed);
      setAnalyzedUrl(url || "");

      // Domain bazlı cache'e de kaydet (sidebar geçişleri için)
      if (url) {
        const domain = url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
        sessionStorage.setItem(`scanCache_${domain}`, stored);
      }
    } else {
      router.push("/");
    }
  }, [router]);

  const handleScanComplete = (result: FullAnalysisResult, url: string) => {
    setData(result);
    setAnalyzedUrl(url);
    setSidebarOpen(false);
  };

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — masaüstünde her zaman, mobilde overlay */}
      <div className="hidden md:block">
        <ScanSidebar currentUrl={analyzedUrl} onScanComplete={handleScanComplete} />
      </div>

      {/* Mobil sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 h-full">
            <ScanSidebar currentUrl={analyzedUrl} onScanComplete={handleScanComplete} />
          </div>
        </div>
      )}

      {/* Ana içerik */}
      <main className="flex-1 min-w-0 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              {/* Mobil hamburger */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden text-muted-foreground hover:text-foreground cursor-pointer"
                title="Tarama gecmisi"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <span
                className="text-lg font-bold tracking-tight cursor-pointer"
                onClick={() => router.push("/")}
              >
                LaunchPilot
              </span>
              <Button variant="outline" size="sm" onClick={() => router.push("/")}>
                Yeni Analiz
              </Button>
            </div>
            <AuthButton />
          </header>
          <AnalysisResultView data={data} />
        </div>
      </main>
    </div>
  );
}
