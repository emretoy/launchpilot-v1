"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AnalyzePage() {
  const router = useRouter();

  useEffect(() => {
    // sessionStorage'dan domain al ve /site/[domain]'e yönlendir
    const url = sessionStorage.getItem("analyzedUrl");
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
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Yönlendiriliyor...</div>
    </main>
  );
}
