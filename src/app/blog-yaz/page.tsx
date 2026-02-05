"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BlogGenerator } from "@/components/blog-generator";
import { BlogTopicPanel } from "@/components/blog-topic-panel";
import { useAuth } from "@/lib/auth-context";
import type { FullAnalysisResult, BlogTopic, BlogTopicScanRequest } from "@/lib/types";
import type { BlogSiteContext } from "@/lib/blog-generator";

// ── Ülke/dil eşleme ──

function languageToCountry(lang: string | null, scope: string | null): string {
  if (scope === "local" || scope === "national") {
    const map: Record<string, string> = { tr: "tr", en: "us", de: "de", fr: "fr" };
    return map[lang || "tr"] || "tr";
  }
  return "tr";
}

// ── SessionStorage helpers ──

function getTopicsCache(domain: string): BlogTopic[] {
  try {
    const raw = sessionStorage.getItem(`blogTopics_${domain}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setTopicsCache(domain: string, topics: BlogTopic[]) {
  try {
    sessionStorage.setItem(`blogTopics_${domain}`, JSON.stringify(topics));
  } catch {
    // sessionStorage dolu olabilir — sessizce geç
  }
}

export default function BlogYazPage() {
  const [siteContext, setSiteContext] = useState<BlogSiteContext | null>(null);
  const [analysisData, setAnalysisData] = useState<FullAnalysisResult | null>(null);
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const router = useRouter();
  const { session } = useAuth();

  // DNA'dan default ülke/dil
  const defaultLanguage = analysisData?.dna?.targetMarket.primaryLanguage || "tr";
  const defaultCountry = languageToCountry(
    defaultLanguage,
    analysisData?.dna?.targetMarket.marketScope || null
  );
  const domain = analysisData?.crawl.basicInfo.url
    ? new URL(analysisData.crawl.basicInfo.url).hostname.replace("www.", "")
    : "";

  // SessionStorage'dan analiz verisi oku + cache'den konuları yükle
  useEffect(() => {
    const stored = sessionStorage.getItem("analysisResult");
    if (!stored) {
      router.push("/");
      return;
    }

    try {
      const data: FullAnalysisResult = JSON.parse(stored);
      setAnalysisData(data);

      const ctx: BlogSiteContext = {
        brandName: data.dna?.identity.brandName || data.crawl.basicInfo.title || "Site",
        siteType: data.dna?.identity.siteType || "unknown",
        industry: data.dna?.identity.industry || null,
        primaryLanguage: data.dna?.targetMarket.primaryLanguage || "tr",
        platform: data.dna?.techStack.platform || data.crawl.techDetection.platform || null,
        blogAuthorityScore: data.blogAuthority?.overall ?? null,
      };

      setSiteContext(ctx);

      // Hemen sessionStorage cache'den konuları yükle (anında görünsün)
      const parsedDomain = new URL(data.crawl.basicInfo.url).hostname.replace("www.", "");
      const cached = getTopicsCache(parsedDomain);
      if (cached.length > 0) {
        setTopics(cached);
      }
    } catch {
      router.push("/");
    }
  }, [router]);

  // Supabase'den konuları yükle (cache'in üstüne yazabilir, daha güncel veri)
  useEffect(() => {
    if (!domain || !session?.access_token || topicsLoaded) return;

    async function loadExistingTopics() {
      try {
        const res = await fetch(`/api/blog-topics?domain=${encodeURIComponent(domain)}`, {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setTopics(data);
            setTopicsCache(domain, data);
          }
        }
      } catch {
        // Supabase yüklenemezse cache zaten kullanılıyor
      } finally {
        setTopicsLoaded(true);
      }
    }

    loadExistingTopics();
  }, [domain, session, topicsLoaded]);

  // Konu tarama
  const handleScan = useCallback(
    async (country: string, language: string) => {
      if (!siteContext || !analysisData || !session?.access_token) {
        setScanError("Konu taraması için giriş yapmanız gerekiyor.");
        return;
      }

      setScanLoading(true);
      setScanError(null);

      try {
        const requestBody: BlogTopicScanRequest = {
          domain,
          industry: siteContext.industry || siteContext.siteType,
          siteType: siteContext.siteType,
          language,
          country,
          brandName: siteContext.brandName,
          dnaSummary: analysisData.dna?.aiSynthesis.summary || null,
          blogAuthorityScore: siteContext.blogAuthorityScore,
        };

        const res = await fetch("/api/blog-topics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Konu taraması başarısız oldu.");
        }

        const result = await res.json();
        const newTopics = result.topics || [];
        setTopics(newTopics);

        // Her zaman sessionStorage'a kaydet (Supabase başarısız olsa bile)
        if (newTopics.length > 0) {
          setTopicsCache(domain, newTopics);
        }
      } catch (err) {
        setScanError(err instanceof Error ? err.message : "Bir hata oluştu.");
      } finally {
        setScanLoading(false);
      }
    },
    [siteContext, analysisData, session, domain]
  );

  // Konu seçimi — BlogGenerator'a aktar
  const handleSelectTopic = useCallback((topic: BlogTopic) => {
    setSelectedTopic(topic.title);
  }, []);

  if (!siteContext) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="text-lg font-bold tracking-tight cursor-pointer"
              onClick={() => router.push("/")}
            >
              LaunchPilot
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">Blog</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/analyze")}>
            Analiz Sonuçlarına Dön
          </Button>
        </div>
      </header>

      {/* Main — İki Panel */}
      <main className="max-w-[1400px] mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Siteniz İçin Blog Yazın
          </h1>
          <p className="text-gray-500 mt-1">
            {siteContext.brandName} sitesi için konu tarayın ve AI destekli blog yazısı oluşturun.
          </p>
        </div>

        <div className="flex gap-6 items-start">
          {/* Sol Panel — Konu Araştırması */}
          <div className="w-[380px] shrink-0">
            <div className="sticky top-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">Konu Araştırması</h2>
                <BlogTopicPanel
                  topics={topics}
                  loading={scanLoading}
                  onScan={handleScan}
                  onSelectTopic={handleSelectTopic}
                  defaultCountry={defaultCountry}
                  defaultLanguage={defaultLanguage}
                  scanError={scanError}
                />
              </div>
            </div>
          </div>

          {/* Sağ Panel — Blog Yazma */}
          <div className="flex-1 min-w-0">
            <BlogGenerator siteContext={siteContext} initialTopic={selectedTopic} />
          </div>
        </div>
      </main>
    </div>
  );
}
