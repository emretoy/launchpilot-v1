"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BlogTopic } from "@/lib/types";

// ── Props ──

interface BlogTopicPanelProps {
  topics: BlogTopic[];
  loading: boolean;
  onScan: (country: string, language: string) => void;
  onSelectTopic: (topic: BlogTopic) => void;
  defaultCountry: string;
  defaultLanguage: string;
  scanError: string | null;
}

// ── Kaynak İkonları ──

const SOURCE_ICONS: Record<string, { icon: string; label: string }> = {
  autocomplete: { icon: "\uD83D\uDD0D", label: "Google Autocomplete" },
  paa: { icon: "\u2753", label: "People Also Ask" },
  reddit: { icon: "\uD83D\uDCAC", label: "Reddit" },
  competitor: { icon: "\uD83C\uDFE2", label: "Rakip Blog" },
  trends: { icon: "\uD83D\uDCC8", label: "Google Trends" },
  ai: { icon: "\uD83E\uDD16", label: "AI Önerisi" },
};

// ── Ülke/Dil Seçenekleri ──

const COUNTRY_OPTIONS = [
  { value: "tr", label: "Türkiye" },
  { value: "us", label: "ABD" },
  { value: "gb", label: "İngiltere" },
  { value: "de", label: "Almanya" },
  { value: "fr", label: "Fransa" },
];

const LANGUAGE_OPTIONS = [
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
];

// ── Main Component ──

export function BlogTopicPanel({
  topics,
  loading,
  onScan,
  onSelectTopic,
  defaultCountry,
  defaultLanguage,
  scanError,
}: BlogTopicPanelProps) {
  const [country, setCountry] = useState(defaultCountry);
  const [language, setLanguage] = useState(defaultLanguage);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Kategorileri topla
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const t of topics) {
      if (t.category) cats.add(t.category);
    }
    return Array.from(cats).sort();
  }, [topics]);

  // Filtrele
  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      if (filterSource !== "all" && t.source !== filterSource) return false;
      if (filterDifficulty !== "all" && t.difficulty !== filterDifficulty) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !(t.description || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [topics, filterSource, filterDifficulty, filterCategory, searchQuery]);

  // Kategoriye göre grupla
  const groupedTopics = useMemo(() => {
    const groups: Record<string, BlogTopic[]> = {};
    for (const t of filteredTopics) {
      const cat = t.category || "Genel";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  }, [filteredTopics]);

  return (
    <div className="space-y-4">
      {/* Ülke/Dil Seçici + Tara Butonu */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Ülke</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {COUNTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Dil</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => onScan(country, language)}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Konular taranıyor...
            </span>
          ) : topics.length > 0 ? (
            "Yeniden Tara"
          ) : (
            "Konu Tara"
          )}
        </Button>
      </div>

      {/* Error */}
      {scanError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {scanError}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Spinner size="lg" />
              <div>
                <p className="text-sm font-medium text-blue-900">Konu taraması yapılıyor...</p>
                <p className="text-xs text-blue-700">6 kaynaktan veri toplanıyor. 30-60 sn sürebilir.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Boş State */}
      {!loading && topics.length === 0 && !scanError && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-3xl mb-2">{"\uD83D\uDD0D"}</p>
          <p className="text-sm">Henüz konu taranmadı.</p>
          <p className="text-xs mt-1">Yukarıdaki butona tıklayarak başlayın.</p>
        </div>
      )}

      {/* Konular Var — Filtreler + Liste */}
      {topics.length > 0 && !loading && (
        <>
          {/* İstatistik */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{filteredTopics.length} / {topics.length} konu</span>
            <span>{categories.length} kategori</span>
          </div>

          {/* Arama */}
          <input
            type="text"
            placeholder="Konularda ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Filtreler */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white"
            >
              <option value="all">Tüm Kaynaklar</option>
              {Object.entries(SOURCE_ICONS).map(([key, { icon, label }]) => (
                <option key={key} value={key}>{icon} {label}</option>
              ))}
            </select>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white"
            >
              <option value="all">Tüm Zorluklar</option>
              <option value="Kolay">Kolay</option>
              <option value="Orta">Orta</option>
              <option value="Zor">Zor</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white"
            >
              <option value="all">Tüm Kategoriler</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Konu Listesi (Gruplu) */}
          <div className="space-y-4 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
            {Object.entries(groupedTopics).map(([category, catTopics]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {category} ({catTopics.length})
                </p>
                <div className="space-y-2">
                  {catTopics.map((topic) => (
                    <TopicCard
                      key={topic.id || topic.title}
                      topic={topic}
                      onClick={() => onSelectTopic(topic)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Topic Card ──

function TopicCard({ topic, onClick }: { topic: BlogTopic; onClick: () => void }) {
  const sourceInfo = SOURCE_ICONS[topic.source] || SOURCE_ICONS.ai;

  const difficultyColor =
    topic.difficulty === "Kolay"
      ? "bg-green-100 text-green-700"
      : topic.difficulty === "Orta"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";

  const volumeColor =
    topic.search_volume === "Yüksek"
      ? "text-green-600"
      : topic.search_volume === "Orta"
        ? "text-yellow-600"
        : "text-gray-400";

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-2">
        <span className="text-sm shrink-0 mt-0.5" title={sourceInfo.label}>
          {sourceInfo.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 leading-snug">
            {topic.title}
          </p>
          {topic.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{topic.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Alaka Skoru */}
            <span className="text-xs font-medium text-amber-600">
              {"\u2B50"} {topic.relevance_score}/10
            </span>
            {/* Zorluk */}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${difficultyColor}`}>
              {topic.difficulty}
            </Badge>
            {/* Hacim */}
            <span className={`text-[10px] ${volumeColor}`}>
              {"\uD83D\uDD0E"} {topic.search_volume}
            </span>
            {/* Format */}
            {topic.suggested_format && (
              <span className="text-[10px] text-gray-400">
                {topic.suggested_format}
              </span>
            )}
          </div>
        </div>
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
