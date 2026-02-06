"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TopicDetailPanel } from "./topic-detail-panel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PromptViewer } from "@/components/prompt-viewer";
import type { BlogTopic } from "@/lib/types";

// ── Sabitler ──

const COUNTRY_OPTIONS = [
  { value: "us", label: "ABD", defaultLang: "en", langLabel: "US English" },
  { value: "gb", label: "İngiltere", defaultLang: "en", langLabel: "UK English" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
];

const FORMAT_LABELS: Record<string, string> = {
  "problem-solution": "Problem-Çözüm",
  rehber: "Kılavuz",
  "vaka-calismasi": "B.Hikayesi",
  karsilastirma: "Karşılaştırma",
  "kontrol-listesi": "Kontrol Listesi",
  sss: "SSS",
  liste: "Liste",
  hikaye: "Hikaye",
  "teknik-analiz": "Teknik Analiz",
};

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  autocomplete: { label: "Google Arama", icon: "🔍" },
  paa: { label: "Halk Soruyor", icon: "❓" },
  reddit: { label: "Reddit", icon: "💬" },
  competitor: { label: "Rakip Analiz", icon: "🏢" },
  trends: { label: "Google Trends", icon: "📈" },
  ai: { label: "AI Önerisi", icon: "🤖" },
};

function getSmartTags(topic: BlogTopic): { label: string; color: string }[] {
  const tags: { label: string; color: string }[] = [];

  // Zamanlama / popülerlik tag'leri
  if (topic.source === "trends") {
    tags.push({ label: "🔥 Bu Hafta Popüler", color: "bg-orange-100 text-orange-700 border-orange-200" });
  }
  if (topic.search_volume === "Yüksek" && topic.source !== "trends") {
    tags.push({ label: "📊 Genel Popüler", color: "bg-purple-100 text-purple-700 border-purple-200" });
  }
  if (topic.search_volume === "Yüksek") {
    tags.push({ label: "🔎 Yüksek Arama", color: "bg-green-100 text-green-700 border-green-200" });
  }
  if (topic.relevance_score >= 8) {
    tags.push({ label: "🎯 Siteye Çok Uygun", color: "bg-emerald-100 text-emerald-700 border-emerald-200" });
  }
  if (topic.difficulty === "Kolay" && topic.relevance_score >= 6) {
    tags.push({ label: "⚡ Kolay Kazanım", color: "bg-yellow-100 text-yellow-700 border-yellow-200" });
  }
  if (topic.source === "reddit") {
    tags.push({ label: "💬 Topluluk İlgisi", color: "bg-blue-100 text-blue-700 border-blue-200" });
  }
  if (topic.source === "competitor") {
    tags.push({ label: "🏢 Rakip Yazıyor", color: "bg-rose-100 text-rose-700 border-rose-200" });
  }

  return tags;
}

// Kaynak referans linki + label
function getSourceLink(topic: BlogTopic): { url: string; label: string } | null {
  const detail = topic.source_detail;
  const hasUrl = detail && (detail.startsWith("http://") || detail.startsWith("https://"));

  switch (topic.source) {
    case "reddit":
      return hasUrl
        ? { url: detail!, label: "Reddit Tartışması ↗" }
        : { url: `https://www.reddit.com/search/?q=${encodeURIComponent(topic.title)}`, label: "Reddit'te Ara ↗" };
    case "competitor":
      return hasUrl
        ? { url: detail!, label: "Rakip Sayfayı Gör ↗" }
        : null;
    case "autocomplete":
    case "paa":
      return { url: `https://www.google.com/search?q=${encodeURIComponent(topic.title)}`, label: "Google'da Ara ↗" };
    case "trends":
      return {
        url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(topic.keywords?.[0] || topic.title)}&geo=${typeof window !== "undefined" ? "TR" : "TR"}`,
        label: "Trends'te Gör ↗",
      };
    default:
      return null;
  }
}

// ── Props ──

interface Props {
  topics: BlogTopic[];
  loading: boolean;
  scanError: string | null;
  scanPrompt: string | null;
  defaultCountry: string;
  defaultLanguage: string;
  onScan: (country: string, language: string) => void;
  onPlanTopic: (topic: BlogTopic) => void;
  onGenerateTopic: (topic: BlogTopic) => void;
  selectedTopic: BlogTopic | null;
  onSelectTopic: (topic: BlogTopic | null) => void;
}

// ── Main Component ──

export function BlogTopicDiscovery({
  topics,
  loading,
  scanError,
  defaultCountry,
  defaultLanguage,
  onScan,
  scanPrompt,
  onPlanTopic,
  onGenerateTopic,
  selectedTopic,
  onSelectTopic,
}: Props) {
  const [country, setCountry] = useState(defaultCountry);
  const [language, setLanguage] = useState(defaultLanguage);

  // Ülke değişince dili otomatik güncelle
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const match = COUNTRY_OPTIONS.find((c) => c.value === newCountry);
    if (match) setLanguage(match.defaultLang);
  };
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showRescanPicker, setShowRescanPicker] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  // Sadece suggested + planned konuları göster
  const suggestedTopics = useMemo(
    () => topics.filter((t) => t.status === "suggested" || t.status === "planned"),
    [topics]
  );

  // Kaynak bazlı konu sayıları
  const sourceCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of suggestedTopics) {
      if (t.source) map[t.source] = (map[t.source] || 0) + 1;
    }
    return map;
  }, [suggestedTopics]);

  // Filtrele
  const filteredTopics = useMemo(() => {
    return suggestedTopics.filter((t) => {
      if (filterDifficulty !== "all" && t.difficulty !== filterDifficulty) return false;
      if (filterSource !== "all" && t.source !== filterSource) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !(t.description || "").toLowerCase().includes(q) &&
          !(t.keywords || []).some((kw) => kw.toLowerCase().includes(q))
        )
          return false;
      }
      return true;
    });
  }, [suggestedTopics, filterDifficulty, filterSource, searchQuery]);

  const visibleTopics = filteredTopics.slice(0, visibleCount);
  const hasScanned = suggestedTopics.length > 0;

  // ── Tarama Öncesi ──
  if (!hasScanned && !loading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="text-sm font-medium text-gray-800">
                Bu öneriler sitenizin DNA analizine göre üretilecek
              </p>
              <p className="text-xs text-gray-500 mt-1">
                6 kaynaktan veri toplanıp AI ile sentezlenir. 30-60 saniye sürebilir.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Ülke</label>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COUNTRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} — {o.langLabel}</option>
                ))}
              </select>
            </div>
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => onScan(country, language)}
            disabled={loading}
          >
            🔍 Konu Tara
          </Button>

          {scanError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {scanError}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-3">
            <Spinner size="lg" />
            <div>
              <p className="text-sm font-medium text-blue-900">Konu taraması yapılıyor...</p>
              <p className="text-xs text-blue-700">6 kaynaktan veri toplanıyor. 30-60 sn sürebilir.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Tarama Sonrası: 2-Panel Layout ──
  return (
    <>
      <div className="flex gap-4">
        {/* Sol: Konu Listesi */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Filtreler */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Zorluk chip filtreleri */}
            {(["all", "Kolay", "Orta", "Zor"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setFilterDifficulty(d)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors cursor-pointer ${
                  filterDifficulty === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {d === "all" ? "Tümü" : d}
              </button>
            ))}

            {/* Kaynak dropdown */}
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Tüm Kaynaklar ({suggestedTopics.length})</option>
              {Object.entries(SOURCE_LABELS).map(([key, info]) => {
                const count = sourceCountMap[key] || 0;
                return (
                  <option key={key} value={key} disabled={count === 0}>
                    {info.icon} {info.label} ({count})
                  </option>
                );
              })}
            </select>

            {/* Arama */}
            <input
              type="text"
              placeholder="Konu veya anahtar kelime ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ml-auto px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>

          {/* İstatistik + Tekrar Tara */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {filteredTopics.length} konu
              <span className="text-gray-400 ml-1.5">
                · {COUNTRY_OPTIONS.find((c) => c.value === country)?.label} · {COUNTRY_OPTIONS.find((c) => c.value === country)?.langLabel || LANGUAGE_OPTIONS.find((l) => l.value === language)?.label}
              </span>
            </span>
            <button
              onClick={() => setShowRescanPicker((v) => !v)}
              className="text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              🔄 Tekrar Tara
            </button>
          </div>

          {/* Tekrar Tara — Ülke seçimi */}
          {showRescanPicker && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COUNTRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} — {o.langLabel}</option>
                ))}
              </select>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => { setShowRescanPicker(false); onScan(country, language); }}
              >
                Tara
              </Button>
            </div>
          )}

          {scanError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {scanError}
            </div>
          )}

          {/* Konu Kartları */}
          <div className="space-y-2">
            {visibleTopics.map((topic) => (
              <TopicCard
                key={topic.id || topic.title}
                topic={topic}
                isSelected={!!(topic.id && selectedTopic?.id === topic.id)}
                onClick={() => onSelectTopic(topic)}
              />
            ))}
          </div>

          {/* Daha Fazla Göster */}
          {visibleCount < filteredTopics.length && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setVisibleCount((prev) => prev + 10)}
            >
              Daha Fazla Göster ({visibleCount}/{filteredTopics.length})
            </Button>
          )}

        </div>

        {/* Sağ: Detay Panel (desktop) */}
        <div className="hidden lg:block w-[440px] shrink-0">
          {selectedTopic ? (
            <div className="sticky top-6">
              <TopicDetailPanel
                topic={selectedTopic}
                onPlanToCalendar={onPlanTopic}
                onGenerate={onGenerateTopic}
              />
            </div>
          ) : (
            <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400">
              <p className="text-3xl mb-2">👈</p>
              <p className="text-sm">Detayları görmek için bir konu seçin</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobil: Detay Sheet */}
      <Sheet
        open={!!selectedTopic && typeof window !== "undefined" && window.innerWidth < 1024}
        onOpenChange={(open) => { if (!open) onSelectTopic(null); }}
      >
        <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Konu Detayı</SheetTitle>
          </SheetHeader>
          {selectedTopic && (
            <div className="mt-4">
              <TopicDetailPanel
                topic={selectedTopic}
                onPlanToCalendar={onPlanTopic}
                onGenerate={onGenerateTopic}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── Topic Card ──

function TopicCard({
  topic,
  isSelected,
  onClick,
}: {
  topic: BlogTopic;
  isSelected: boolean;
  onClick: () => void;
}) {
  const formatLabel = topic.suggested_format
    ? FORMAT_LABELS[topic.suggested_format] || topic.suggested_format
    : null;

  const sourceInfo = SOURCE_LABELS[topic.source] || { label: topic.source, icon: "📄" };
  const sourceLink = getSourceLink(topic);
  const smartTags = getSmartTags(topic);

  const impactLevel =
    topic.relevance_score >= 8
      ? { label: "Yüksek Etki", color: "bg-green-100 text-green-700" }
      : topic.relevance_score >= 5
        ? { label: "Orta Etki", color: "bg-yellow-100 text-yellow-700" }
        : { label: "Düşük Etki", color: "bg-gray-100 text-gray-600" };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400"
          : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
      }`}
    >
      {/* Üst: Kaynak (linkli) + Zorluk + Arama Hacmi */}
      <div className="flex items-center gap-2 mb-1.5 text-[11px]">
        <span className="text-gray-400">
          {sourceInfo.icon} {sourceInfo.label}
        </span>
        {sourceLink && (
          <>
            <span className="text-gray-300">·</span>
            <a
              href={sourceLink.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-500 hover:text-blue-700 hover:underline"
            >
              {sourceLink.label}
            </a>
          </>
        )}
        <span className="text-gray-300">·</span>
        <span className={`${
          topic.difficulty === "Kolay" ? "text-green-600" : topic.difficulty === "Orta" ? "text-yellow-600" : "text-red-600"
        }`}>
          {topic.difficulty}
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-500">
          Arama: {topic.search_volume}
        </span>
        {topic.category && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-gray-400 truncate">{topic.category}</span>
          </>
        )}
      </div>

      {/* Başlık */}
      <p className="text-[15px] font-semibold text-gray-900 leading-snug">{topic.title}</p>

      {/* Açıklama — daha uzun, 3 satır */}
      {topic.description && (
        <p className="text-[13px] text-gray-600 mt-1.5 leading-relaxed line-clamp-3">
          {topic.description}
        </p>
      )}

      {/* Akıllı Tag'ler */}
      {smartTags.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {smartTags.map((tag) => (
            <span
              key={tag.label}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${tag.color}`}
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Alt: Format + Etki + Keywords + Takvim durumu */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {formatLabel && (
          <Badge variant="outline" className="text-[11px] px-2 py-0.5">
            {formatLabel}
          </Badge>
        )}
        <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${impactLevel.color}`}>
          {impactLevel.label}
        </Badge>
        {topic.status === "planned" && (
          <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-700">
            Takvimde
          </Badge>
        )}
        {topic.keywords && topic.keywords.length > 0 && (
          <span className="text-[11px] text-gray-400 ml-auto truncate max-w-[200px]">
            {topic.keywords.slice(0, 3).join(", ")}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Spinner ──

function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  const s = size === "lg" ? "w-6 h-6" : "w-4 h-4";
  return (
    <svg
      className={`animate-spin ${s} text-blue-500`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
