"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FullAnalysisResult } from "@/lib/types";

// Eski blog-yaz sayfası artık /site/[domain]/blog'a yönlendiriyor
export default function BlogYazRedirect() {
  const router = useRouter();

  useEffect(() => {
    // sessionStorage'dan domain bilgisini çıkar
    try {
      const stored = sessionStorage.getItem("analysisResult");
      if (stored) {
        const data: FullAnalysisResult = JSON.parse(stored);
        const domain = new URL(data.crawl.basicInfo.url).hostname.replace("www.", "");
        router.replace(`/site/${encodeURIComponent(domain)}/blog`);
        return;
      }
    } catch {
      // parse hatası
    }

    // Domain bulunamazsa ana sayfaya yönlendir
    router.replace("/");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Yönlendiriliyor...</div>
    </main>
  );
}
