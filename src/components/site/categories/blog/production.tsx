"use client";

import { useState, useMemo } from "react";
import { BlogGenerator } from "@/components/blog-generator";
import type { BlogTopic } from "@/lib/types";
import type { BlogSiteContext } from "@/lib/blog-generator";

// ── Props ──

interface Props {
  topics: BlogTopic[];
  siteContext: BlogSiteContext;
  selectedTopic: BlogTopic | null;
  onSelectTopic: (topic: BlogTopic | null) => void;
}

// ── Main Component ──

export function BlogProduction({ topics, siteContext, selectedTopic, onSelectTopic }: Props) {
  // Planlanan konular (planned_date sırasıyla, yoksa relevance_score)
  const plannedTopics = useMemo(
    () =>
      topics
        .filter((t) => t.status === "planned" || t.status === "writing")
        .sort((a, b) => {
          if (a.planned_date && b.planned_date) return a.planned_date.localeCompare(b.planned_date);
          if (a.planned_date) return -1;
          if (b.planned_date) return 1;
          return b.relevance_score - a.relevance_score;
        }),
    [topics]
  );

  // Eğer hiç konu yoksa
  if (plannedTopics.length === 0 && !selectedTopic) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-3xl mb-2">✍️</p>
        <p className="text-sm">Henüz yazılacak konu yok.</p>
        <p className="text-xs mt-1">
          Konular sekmesinden beğendiğiniz konuları takvime ekleyin veya &ldquo;Hemen Yaz&rdquo; butonunu kullanın.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Sol: Konu Listesi */}
      <div className="w-[260px] shrink-0 space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Yazılacak Konular ({plannedTopics.length})
        </p>
        {plannedTopics.map((topic) => {
          const isActive = !!(topic.id && selectedTopic?.id === topic.id);
          const dateLabel = topic.planned_date
            ? new Date(topic.planned_date).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "short",
              })
            : null;

          return (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? "border-green-400 bg-green-50 ring-1 ring-green-400"
                  : "border-gray-200 hover:border-green-300 hover:bg-green-50/50"
              }`}
            >
              {dateLabel && (
                <p className="text-[10px] text-gray-400 mb-0.5">{dateLabel}</p>
              )}
              <p className="text-sm font-medium text-gray-800 leading-snug truncate">
                {topic.title}
              </p>
              {topic.suggested_format && (
                <p className="text-[10px] text-gray-400 mt-0.5">{topic.suggested_format}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Sağ: BlogGenerator */}
      <div className="flex-1 min-w-0">
        {selectedTopic ? (
          <BlogGenerator
            siteContext={siteContext}
            initialTopic={selectedTopic.title}
          />
        ) : (
          <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
            <p className="text-3xl mb-2">👈</p>
            <p className="text-sm">Yazmaya başlamak için soldan bir konu seçin</p>
          </div>
        )}
      </div>
    </div>
  );
}
