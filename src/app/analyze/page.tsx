"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AnalyzePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 1. Query param (?url=...) — yeni tab / direkt link için
    // 2. sessionStorage fallback
    const url = searchParams.get("url") || sessionStorage.getItem("analyzedUrl");
    if (url) {
      try {
        const inputUrl = url.startsWith("http") ? url : `https://${url}`;
        const domain = new URL(inputUrl).hostname.replace(/^www\./, "");
        router.replace(`/site/${encodeURIComponent(domain)}/overview`);
      } catch {
        router.replace("/");
      }
    } else {
      router.replace("/");
    }
  }, [router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Yönlendiriliyor...</div>
    </main>
  );
}
