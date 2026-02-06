"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BlogTopic } from "@/lib/types";

const FORMAT_LABELS: Record<string, string> = {
  "problem-solution": "Problem-Çözüm",
  rehber: "Kapsamlı Kılavuz",
  "vaka-calismasi": "Başarı Hikayesi",
  karsilastirma: "Karşılaştırma",
  "kontrol-listesi": "Kontrol Listesi",
  sss: "Soru-Cevap",
  liste: "Liste",
  hikaye: "Hikaye",
  "teknik-analiz": "Teknik Analiz",
};

const LENGTH_ESTIMATES: Record<string, string> = {
  "problem-solution": "~800-1500 kelime",
  rehber: "~1500-2500 kelime",
  "vaka-calismasi": "~1000-2000 kelime",
  karsilastirma: "~1200-2000 kelime",
  "kontrol-listesi": "~600-1200 kelime",
  sss: "~600-1200 kelime",
  liste: "~800-1500 kelime",
  hikaye: "~800-1500 kelime",
  "teknik-analiz": "~1500-2500 kelime",
};

const SOURCE_LABELS: Record<string, { label: string; icon: string; description: string }> = {
  autocomplete: {
    label: "Google Arama",
    icon: "🔍",
    description: "Google Autocomplete'te önerilen arama terimi",
  },
  paa: {
    label: "Halk Soruyor",
    icon: "❓",
    description: "Google'da 'Halk da soruyor' bölümünde çıkan soru",
  },
  reddit: {
    label: "Reddit",
    icon: "💬",
    description: "Reddit'te aktif tartışılan konu",
  },
  competitor: {
    label: "Rakip Analiz",
    icon: "🏢",
    description: "Sektördeki rakip sitelerin blog içeriklerinden tespit edildi",
  },
  trends: {
    label: "Google Trends",
    icon: "📈",
    description: "Google Trends'te yükselişte olan arama terimi",
  },
  ai: {
    label: "AI Önerisi",
    icon: "🤖",
    description: "Ham verilerden esinlenerek AI tarafından türetildi",
  },
};

// Kaynak referans linki + label
function getSourceLink(topic: BlogTopic): { url: string; label: string } | null {
  const detail = topic.source_detail;
  const hasUrl = detail && (detail.startsWith("http://") || detail.startsWith("https://"));

  switch (topic.source) {
    case "reddit":
      return hasUrl
        ? { url: detail!, label: "Reddit Tartışmasını Gör" }
        : { url: `https://www.reddit.com/search/?q=${encodeURIComponent(topic.title)}`, label: "Reddit'te Ara" };
    case "competitor":
      return hasUrl
        ? { url: detail!, label: "Rakip Sayfayı Gör" }
        : null;
    case "autocomplete":
    case "paa":
      return { url: `https://www.google.com/search?q=${encodeURIComponent(topic.title)}`, label: "Google'da Ara" };
    case "trends":
      return {
        url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(topic.keywords?.[0] || topic.title)}`,
        label: "Trends'te Gör",
      };
    default:
      return null;
  }
}

// Tag'lerin açıklaması — neye göre bu tag verildi
function getDetailedTags(topic: BlogTopic): { label: string; color: string; reason: string }[] {
  const tags: { label: string; color: string; reason: string }[] = [];

  if (topic.source === "trends") {
    tags.push({
      label: "🔥 Bu Hafta Popüler",
      color: "bg-orange-50 text-orange-700 border-orange-200",
      reason: "Google Trends'te yükselişte — zamana duyarlı, hızlı yayınla",
    });
  }
  if (topic.search_volume === "Yüksek" && topic.source !== "trends") {
    tags.push({
      label: "📊 Genel Popüler",
      color: "bg-purple-50 text-purple-700 border-purple-200",
      reason: "Sürekli yüksek arama hacmi — her zaman trafik getirir, acele etme",
    });
  }
  if (topic.search_volume === "Yüksek") {
    tags.push({
      label: "🔎 Yüksek Arama",
      color: "bg-green-50 text-green-700 border-green-200",
      reason: "Aylık arama hacmi yüksek — organik trafik potansiyeli var",
    });
  }
  if (topic.relevance_score >= 8) {
    tags.push({
      label: "🎯 Siteye Çok Uygun",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      reason: `Uyum skoru ${topic.relevance_score}/10 — sitenin DNA'sıyla çok örtüşüyor`,
    });
  }
  if (topic.difficulty === "Kolay" && topic.relevance_score >= 6) {
    tags.push({
      label: "⚡ Kolay Kazanım",
      color: "bg-yellow-50 text-yellow-700 border-yellow-200",
      reason: "Hem kolay yazılır hem etkili — ilk blog yazıları için ideal",
    });
  }
  if (topic.source === "reddit") {
    tags.push({
      label: "💬 Topluluk İlgisi",
      color: "bg-blue-50 text-blue-700 border-blue-200",
      reason: "Reddit'te insanlar bunu aktif tartışıyor — gerçek ilgi var",
    });
  }
  if (topic.source === "competitor") {
    tags.push({
      label: "🏢 Rakip Yazıyor",
      color: "bg-rose-50 text-rose-700 border-rose-200",
      reason: "Rakip siteler bu konuda içerik üretmiş — sen de yazmalısın",
    });
  }

  return tags;
}

interface Props {
  topic: BlogTopic;
  onPlanToCalendar: (topic: BlogTopic) => void;
  onGenerate: (topic: BlogTopic) => void;
}

export function TopicDetailPanel({ topic, onPlanToCalendar, onGenerate }: Props) {
  const formatLabel = topic.suggested_format
    ? FORMAT_LABELS[topic.suggested_format] || topic.suggested_format
    : null;

  const lengthEstimate = topic.suggested_format
    ? LENGTH_ESTIMATES[topic.suggested_format] || "~1500 kelime"
    : "~1500 kelime";

  const sourceInfo = SOURCE_LABELS[topic.source] || {
    label: topic.source,
    icon: "📄",
    description: "Kaynak bilgisi",
  };
  const sourceLink = getSourceLink(topic);
  const detailedTags = getDetailedTags(topic);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Başlık */}
      <h3 className="text-base font-semibold text-gray-900 leading-snug">{topic.title}</h3>

      {/* Açıklama */}
      {topic.description && (
        <p className="text-sm text-gray-600 leading-relaxed">{topic.description}</p>
      )}

      {/* Kaynak bilgisi (linkli) */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Kaynak</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {sourceInfo.icon} {sourceInfo.label}
          </span>
          {sourceLink && (
            <a
              href={sourceLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
            >
              {sourceLink.label} ↗
            </a>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">{sourceInfo.description}</p>
        {topic.source_detail && topic.source_detail !== sourceInfo.label && (
          <p className="text-xs text-gray-400 mt-0.5 truncate" title={topic.source_detail}>
            {topic.source_detail}
          </p>
        )}
      </div>

      {/* Kaynak Kanıtları */}
      {topic.source_evidence && topic.source_evidence.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">
            Kaynak Kanıtları ({topic.source_evidence.length})
          </p>
          {topic.source_evidence.map((ev, i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span>{SOURCE_LABELS[ev.source]?.icon || "📄"}</span>
                <span className="text-gray-500">{SOURCE_LABELS[ev.source]?.label || ev.source}</span>
                {ev.url && (
                  <a href={ev.url} target="_blank" rel="noopener noreferrer"
                     className="text-blue-500 hover:underline ml-auto">
                    Kaynağa Git ↗
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                &ldquo;{ev.text}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Akıllı Tag'ler — açıklamalı */}
      {detailedTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Öne Çıkan Özellikler</p>
          {detailedTags.map((tag) => (
            <div key={tag.label} className={`rounded-lg border px-3 py-2 ${tag.color}`}>
              <p className="text-xs font-medium">{tag.label}</p>
              <p className="text-[11px] opacity-80 mt-0.5">{tag.reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Format + Uzunluk */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Format</p>
          <p className="text-sm font-medium text-gray-700">{formatLabel || "Belirtilmemiş"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Uzunluk</p>
          <p className="text-sm font-medium text-gray-700">{lengthEstimate}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Zorluk</p>
          <Badge
            variant="outline"
            className={`text-xs ${
              topic.difficulty === "Kolay"
                ? "bg-green-100 text-green-700"
                : topic.difficulty === "Orta"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {topic.difficulty}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Arama Hacmi</p>
          <p className="text-sm font-medium text-gray-700">{topic.search_volume}</p>
        </div>
      </div>

      {/* Keywords */}
      {topic.keywords && topic.keywords.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Anahtar Kelimeler</p>
          <div className="flex flex-wrap gap-1.5">
            {topic.keywords.slice(0, 8).map((kw) => (
              <span
                key={kw}
                className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA Butonları */}
      <div className="flex flex-col gap-2 pt-2">
        {topic.status !== "planned" && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onPlanToCalendar(topic)}
          >
            📅 Takvime Yerleştir
          </Button>
        )}
        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          onClick={() => onGenerate(topic)}
        >
          ✍️ Hemen Yaz
        </Button>
      </div>
    </div>
  );
}
