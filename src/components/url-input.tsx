"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UrlInput() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { session } = useAuth();

  // URL query param'dan otomatik doldur (window.location ile — SSR-safe)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("url");
    if (prefill) {
      setUrl(prefill);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await res.json();
      // Store result in sessionStorage and navigate
      sessionStorage.setItem("analysisResult", JSON.stringify(data));
      sessionStorage.setItem("analyzedUrl", url.trim());
      router.push("/analyze");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          className="h-12 text-base"
        />
        <Button type="submit" disabled={loading || !url.trim()} className="h-12 px-6">
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Taranıyor...
            </span>
          ) : (
            "Analiz Et"
          )}
        </Button>
      </div>
      {error && (
        <p className="text-destructive text-sm mt-2">{error}</p>
      )}
      {loading && (
        <p className="text-muted-foreground text-sm mt-3">
          Site taranıyor, 8 farklı analiz paralel çalışıyor... Bu işlem biraz sürebilir.
        </p>
      )}
    </form>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
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
  );
}
