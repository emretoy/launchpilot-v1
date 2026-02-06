"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSiteContext } from "@/components/site/site-context";
import { useAuth } from "@/lib/auth-context";
import { BlogTopicDiscovery } from "./blog/topic-discovery";
import { BlogCalendar } from "./blog/calendar";
import { PromptViewer } from "@/components/prompt-viewer";
import type { BlogTopic, BlogTopicScanRequest } from "@/lib/types";
import type { BlogSiteContext, DNAAnalysisForPrompt } from "@/lib/blog-generator";
import { normalizeLegacyFormat } from "@/lib/blog-generator";

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
    // sessionStorage dolu olabilir
  }
}

// Scanner fallback'ten gelen konularda id olmayabilir — geçici id ata
// Eski DB key'lerini yeni key'lere dönüştür (pillar→rehber vb.)
function ensureTopicIds(topics: BlogTopic[]): BlogTopic[] {
  return topics.map((t) => ({
    ...t,
    id: t.id || `temp_${crypto.randomUUID()}`,
    suggested_format: t.suggested_format ? normalizeLegacyFormat(t.suggested_format) : t.suggested_format,
  }));
}

export function BlogPage() {
  const { domain, data } = useSiteContext();
  const { session } = useAuth();
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [activeTab, setActiveTab] = useState("konular");
  const [selectedTopic, setSelectedTopic] = useState<BlogTopic | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanPrompt, setScanPrompt] = useState<string | null>(null);
  const [topicsLoaded, setTopicsLoaded] = useState(false);

  // SiteContext'ten BlogSiteContext türet
  const ai = data?.dna?.aiAnalysis;
  const siteContext: BlogSiteContext = {
    brandName: data?.dna?.identity.brandName || data?.crawl.basicInfo.title || "Site",
    siteType: data?.dna?.identity.siteType || "unknown",
    industry: data?.dna?.identity.industry || null,
    primaryLanguage: data?.dna?.targetMarket.primaryLanguage || "tr",
    platform: data?.dna?.techStack.platform || null,
    blogAuthorityScore: data?.blogAuthority?.overall ?? null,
    // v3 aiAnalysis alanları
    targetAudience: ai?.target_audience.primary_audience || null,
    blogTone: ai?.tone_and_voice.recommended_blog_tone || null,
    blogRole: ai?.blog_strategy_verdict.blog_role || null,
    priorityTopics: ai?.blog_strategy_verdict.priority_topics || [],
    topicsToAvoid: ai?.blog_strategy_verdict.topics_to_avoid || [],
    recommendedContentTypes: ai?.blog_strategy_verdict.recommended_content_types || [],
    recommendedCta: ai?.cta_structure.recommended_blog_cta || null,
    valueProposition: ai?.business_identity.value_proposition || null,
  };

  // Mevcut konularda country/language varsa onu kullan (son taramanın ayarları)
  const lastTopic = topics.find((t) => t.country && t.language);
  const defaultCountry = lastTopic?.country || "us";
  const defaultLanguage = lastTopic?.language || "en";

  // DNA Analysis objesi (v2.4 prompt injection için)
  const dnaAnalysis: DNAAnalysisForPrompt | undefined = ai
    ? {
        tone_and_voice: {
          recommended_blog_tone: ai.tone_and_voice?.recommended_blog_tone || undefined,
        },
        target_audience: {
          primary_audience: ai.target_audience?.primary_audience || undefined,
          awareness_level: ai.target_audience?.awareness_level || undefined,
        },
        business_identity: {
          value_proposition: ai.business_identity?.value_proposition || undefined,
          industry: data?.dna?.identity.industry || undefined,
          brand_name: data?.dna?.identity.brandName || undefined,
        },
        cta_structure: {
          recommended_blog_cta: ai.cta_structure?.recommended_blog_cta || undefined,
        },
        revenue_model: {
          primary_conversion_action: ai.revenue_model?.primary_conversion_action || undefined,
        },
        content_language: data?.dna?.targetMarket.primaryLanguage || defaultLanguage,
      }
    : undefined;

  // SessionStorage cache'den konuları ve scanPrompt'u yükle
  useEffect(() => {
    const cached = getTopicsCache(domain);
    if (cached.length > 0) {
      setTopics(ensureTopicIds(cached));
    }
    try {
      const cachedPrompt = sessionStorage.getItem(`blogScanPrompt_${domain}`);
      if (cachedPrompt) setScanPrompt(cachedPrompt);
    } catch {}
  }, [domain]);

  // Topics değiştiğinde cache'i otomatik güncelle
  useEffect(() => {
    if (topics.length > 0 && domain) {
      setTopicsCache(domain, topics);
    }
  }, [topics, domain]);

  // Supabase'den konuları yükle
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
            setTopics(ensureTopicIds(data));
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
      if (!session?.access_token) {
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
          dnaSummary: data?.dna?.aiAnalysis?.summary || data?.dna?.aiSynthesis.summary || null,
          blogAuthorityScore: siteContext.blogAuthorityScore,
          priorityTopics: siteContext.priorityTopics,
          topicsToAvoid: siteContext.topicsToAvoid,
          observedKeywords: ai?.content_status.observed_keyword_signals || [],
          marketScope: ai?.metrics.market_scope || data?.dna?.targetMarket.marketScope || undefined,
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
          const result = await res.json();
          throw new Error(result.error || "Konu taraması başarısız oldu.");
        }

        const result = await res.json();
        const newTopics = ensureTopicIds(result.topics || []);
        setTopics(newTopics);
        if (result._prompt) {
          setScanPrompt(result._prompt);
          try { sessionStorage.setItem(`blogScanPrompt_${domain}`, result._prompt); } catch {}
        }

        if (newTopics.length > 0) {
          setTopicsCache(domain, newTopics);
        }
      } catch (err) {
        setScanError(err instanceof Error ? err.message : "Bir hata oluştu.");
      } finally {
        setScanLoading(false);
      }
    },
    [siteContext, data, session, domain]
  );

  // Tek konu güncelle (optimistic)
  const updateTopic = useCallback(
    async (topicId: string, updates: { status?: string; planned_date?: string | null }) => {
      if (!session?.access_token || !topicId) return;

      // Optimistic update
      setTopics((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, ...updates } as BlogTopic : t))
      );

      // Geçici id ise API call yapma (DB'de yok)
      if (topicId.startsWith("temp_")) return;

      try {
        const res = await fetch(`/api/blog-topics/${topicId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          // Revert — yeniden yükle
          const reloadRes = await fetch(`/api/blog-topics?domain=${encodeURIComponent(domain)}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (reloadRes.ok) {
            const reloaded = await reloadRes.json();
            if (Array.isArray(reloaded)) setTopics(ensureTopicIds(reloaded));
          }
        }
      } catch {
        // Hata durumunda sessiz geç
      }
    },
    [session, domain]
  );

  // Bulk update
  const bulkUpdateTopics = useCallback(
    async (updates: { id: string; status: string; planned_date: string | null }[]) => {
      if (!session?.access_token) return;

      // Optimistic
      setTopics((prev) =>
        prev.map((t) => {
          const upd = updates.find((u) => u.id === t.id);
          return upd ? { ...t, ...upd } as BlogTopic : t;
        })
      );

      // Geçici id'li update'leri filtrele
      const dbUpdates = updates.filter((u) => !u.id.startsWith("temp_"));
      if (dbUpdates.length === 0) return;

      try {
        await fetch("/api/blog-topics/bulk", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ updates: dbUpdates }),
        });
      } catch {
        // Hata durumunda sessiz geç
      }
    },
    [session]
  );

  // Takvime ekle
  const handlePlanTopic = useCallback(
    (topic: BlogTopic) => {
      updateTopic(topic.id, { status: "planned" });
      setActiveTab("takvim");
    },
    [updateTopic]
  );

  // Hemen yaz
  const handleGenerateTopic = useCallback(
    (topic: BlogTopic) => {
      updateTopic(topic.id, { status: "planned" });
      setSelectedTopic(topic);
      setActiveTab("takvim");
    },
    [updateTopic]
  );

  const suggestedCount = topics.filter((t) => t.status === "suggested").length;
  const plannedCount = topics.filter((t) => t.status === "planned").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Blog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {siteContext.brandName} için konu araştırması yapın, takvimleyin ve blog yazısı üretin.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="konular">
            Konular {suggestedCount > 0 && `(${suggestedCount})`}
          </TabsTrigger>
          <TabsTrigger value="takvim">
            Takvim & Üretim {plannedCount > 0 && `(${plannedCount})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="konular" className="mt-4 space-y-3">
          <BlogTopicDiscovery
            topics={topics}
            loading={scanLoading}
            scanError={scanError}
            scanPrompt={scanPrompt}
            defaultCountry={defaultCountry}
            defaultLanguage={defaultLanguage}
            onScan={handleScan}
            onPlanTopic={handlePlanTopic}
            onGenerateTopic={handleGenerateTopic}
            selectedTopic={selectedTopic}
            onSelectTopic={setSelectedTopic}
          />
          {scanPrompt && (
            <PromptViewer label="Konu Tarama Prompt'u (Gemini)" prompt={scanPrompt} />
          )}
        </TabsContent>

        <TabsContent value="takvim" className="mt-4">
          <BlogCalendar
            topics={topics}
            updateTopic={updateTopic}
            bulkUpdateTopics={bulkUpdateTopics}
            siteContext={siteContext}
            selectedTopic={selectedTopic}
            onSelectTopic={setSelectedTopic}
            dnaAnalysis={dnaAnalysis}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Helper ──

function languageToCountry(lang: string | null, scope: string | null): string {
  if (scope === "local" || scope === "national") {
    const map: Record<string, string> = { tr: "tr", en: "us", de: "de", fr: "fr" };
    return map[lang || "tr"] || "tr";
  }
  return "tr";
}
