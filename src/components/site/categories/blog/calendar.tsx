"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BlogGenerator } from "@/components/blog-generator";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { BlogTopic } from "@/lib/types";
import type { BlogSiteContext, DNAAnalysisForPrompt } from "@/lib/blog-generator";
import { buildTopicDataFromBlogTopic } from "@/lib/blog-generator";

// ── Constants ──

const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const FREQUENCY_OPTIONS = [
  { value: 1, label: "1x/hafta", days: [1] }, // Salı
  { value: 2, label: "2x/hafta", days: [1, 3] }, // Salı, Perşembe
  { value: 3, label: "3x/hafta", days: [0, 2, 4] }, // Pazartesi, Çarşamba, Cuma
];

const FORMAT_LABELS: Record<string, string> = {
  "problem-solution": "P.Çözüm",
  rehber: "Kılavuz",
  "vaka-calismasi": "B.Hikayesi",
  karsilastirma: "Karşılaştırma",
  "kontrol-listesi": "K.Listesi",
  sss: "SSS",
  liste: "Liste",
  hikaye: "Hikaye",
  "teknik-analiz": "T.Analiz",
};

// ── Helper ──

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Props ──

interface Props {
  topics: BlogTopic[];
  updateTopic: (topicId: string, updates: { status?: string; planned_date?: string | null }) => Promise<void>;
  bulkUpdateTopics: (updates: { id: string; status: string; planned_date: string | null }[]) => Promise<void>;
  siteContext: BlogSiteContext;
  selectedTopic: BlogTopic | null;
  onSelectTopic: (topic: BlogTopic | null) => void;
  dnaAnalysis?: DNAAnalysisForPrompt;
}

// ── Main Component ──

export function BlogCalendar({
  topics,
  updateTopic,
  bulkUpdateTopics,
  siteContext,
  selectedTopic,
  onSelectTopic,
  dnaAnalysis,
}: Props) {
  const [frequency, setFrequency] = useState(1);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Ayın ilk gününün pazartesisinden başla
  const currentMonday = useMemo(
    () => getMonday(new Date(viewMonth.year, viewMonth.month, 1)),
    [viewMonth]
  );

  // Ay bazlı navigasyon
  const goNextMonth = useCallback(() => {
    setViewMonth((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );
  }, []);

  const goPrevMonth = useCallback(() => {
    setViewMonth((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );
  }, []);

  // Ay etiketi
  const monthLabel = useMemo(() => {
    const d = new Date(viewMonth.year, viewMonth.month, 1);
    return d.toLocaleDateString("tr-TR", { month: "long" });
  }, [viewMonth]);

  // planned topics (planned_date set)
  const plannedTopics = useMemo(
    () => topics.filter((t) => t.status === "planned" && t.planned_date),
    [topics]
  );

  // Unscheduled: planned status but no date
  const unscheduledTopics = useMemo(
    () => topics.filter((t) => t.status === "planned" && !t.planned_date),
    [topics]
  );

  // 4-haftalık grid oluştur
  const weeks = useMemo(() => {
    const result: { weekStart: Date; days: { date: Date; dateStr: string }[] }[] = [];
    for (let w = 0; w < 4; w++) {
      const weekStart = addDays(currentMonday, w * 7);
      const days = DAYS.map((_, i) => {
        const date = addDays(weekStart, i);
        return { date, dateStr: formatDate(date) };
      });
      result.push({ weekStart, days });
    }
    return result;
  }, [currentMonday]);

  // Tarihe göre konuları map'le
  const topicsByDate = useMemo(() => {
    const map: Record<string, BlogTopic[]> = {};
    for (const t of plannedTopics) {
      const dateStr = t.planned_date!.split("T")[0];
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(t);
    }
    return map;
  }, [plannedTopics]);

  // Drag aktivesi
  const activeTopic = activeDragId
    ? topics.find((t) => t.id === activeDragId) || null
    : null;

  // ── Handlers ──

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over) return;

      const topicId = active.id as string;
      const targetDateStr = over.id as string;

      if (!targetDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return;

      updateTopic(topicId, { status: "planned", planned_date: targetDateStr });
    },
    [updateTopic]
  );

  // AI ile Planla
  const handleAIPlan = useCallback(() => {
    const toSchedule = [...unscheduledTopics]
      .sort((a, b) => b.relevance_score - a.relevance_score);

    if (toSchedule.length === 0) return;

    const freqOption = FREQUENCY_OPTIONS.find((f) => f.value === frequency)!;
    const updates: { id: string; status: string; planned_date: string | null }[] = [];
    const usedDates = new Set<string>(Object.keys(topicsByDate));
    let topicIdx = 0;

    for (let w = 0; w < 4 && topicIdx < toSchedule.length; w++) {
      for (const dayIdx of freqOption.days) {
        if (topicIdx >= toSchedule.length) break;
        const date = addDays(currentMonday, w * 7 + dayIdx);
        const dateStr = formatDate(date);

        if (usedDates.has(dateStr)) continue;

        updates.push({
          id: toSchedule[topicIdx].id,
          status: "planned",
          planned_date: dateStr,
        });
        usedDates.add(dateStr);
        topicIdx++;
      }
    }

    if (updates.length > 0) {
      bulkUpdateTopics(updates);
    }
  }, [unscheduledTopics, frequency, currentMonday, topicsByDate, bulkUpdateTopics]);

  // Konuyu takvimden kaldır
  const handleRemoveFromCalendar = useCallback(
    (topicId: string) => {
      updateTopic(topicId, { status: "planned", planned_date: null });
    },
    [updateTopic]
  );

  // Takvimde konuya tıkla → yanında BlogGenerator aç
  const handleTopicClick = useCallback(
    (topic: BlogTopic) => {
      onSelectTopic(selectedTopic?.id === topic.id ? null : topic);
    },
    [onSelectTopic, selectedTopic]
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4">
        {/* Sol: Takvim */}
        <div className={`space-y-4 ${selectedTopic ? "w-1/2 shrink-0" : "flex-1"}`}>
          {/* Üst: Frekans + AI Planla + Navigasyon */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Sıklık:</span>
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                    frequency === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleAIPlan}
                disabled={unscheduledTopics.length === 0}
              >
                🤖 AI ile Planla
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={goPrevMonth}
              >
                ◀
              </Button>
              <span className="text-xs font-medium text-gray-700 min-w-[140px] text-center">
                {monthLabel}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={goNextMonth}
              >
                ▶
              </Button>
            </div>
          </div>

          {/* Takvim Grid */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            {/* Başlık satırı */}
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {DAYS.map((day) => (
                <div key={day} className="px-1 py-2 text-[10px] font-semibold text-gray-500 uppercase text-center">
                  {day}
                </div>
              ))}
            </div>

            {/* Hafta satırları */}
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
                {week.days.map((day) => (
                  <CalendarCell
                    key={day.dateStr}
                    dateStr={day.dateStr}
                    date={day.date}
                    topics={topicsByDate[day.dateStr] || []}
                    selectedTopicId={selectedTopic?.id || null}
                    onRemove={handleRemoveFromCalendar}
                    onTopicClick={handleTopicClick}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Planlanmamış Konular (drag source) */}
          {unscheduledTopics.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Planlanmamış Konular ({unscheduledTopics.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {unscheduledTopics.map((topic) => (
                  <DraggableTopic key={topic.id} topic={topic} />
                ))}
              </div>
            </div>
          )}

          {unscheduledTopics.length === 0 && plannedTopics.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm">Henüz takvime eklenmiş konu yok.</p>
              <p className="text-xs mt-1">Konular sekmesinden &ldquo;Takvime Yerleştir&rdquo; butonunu kullanın.</p>
            </div>
          )}
        </div>

        {/* Sağ: BlogGenerator (konu seçiliyse) */}
        {selectedTopic && (
          <div className="w-1/2 min-w-0">
            <div className="sticky top-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Yazılıyor:</p>
                  <p className="text-sm font-medium text-gray-800 truncate">{selectedTopic.title}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectTopic(null)}
                >
                  ✕
                </Button>
              </div>
              <BlogGenerator
                siteContext={siteContext}
                initialTopic={selectedTopic.title}
                autoMode
                language={selectedTopic.language || undefined}
                topicData={buildTopicDataFromBlogTopic(selectedTopic)}
                dnaAnalysis={dnaAnalysis}
              />
            </div>
          </div>
        )}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTopic ? (
          <div className="bg-blue-100 border border-blue-300 rounded-lg px-3 py-2 shadow-lg opacity-90 max-w-[200px]">
            <p className="text-xs font-medium text-blue-800 truncate">{activeTopic.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Calendar Cell (Droppable) ──

function CalendarCell({
  dateStr,
  date,
  topics,
  selectedTopicId,
  onRemove,
  onTopicClick,
}: {
  dateStr: string;
  date: Date;
  topics: BlogTopic[];
  selectedTopicId: string | null;
  onRemove: (id: string) => void;
  onTopicClick: (topic: BlogTopic) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dateStr });
  const isToday = formatDate(new Date()) === dateStr;
  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] px-1 py-1.5 border-l border-gray-100 transition-colors ${
        isOver ? "bg-blue-50" : isPast ? "bg-gray-50/50" : ""
      }`}
    >
      <p className={`text-[10px] mb-1 ${isToday ? "font-bold text-blue-600" : "text-gray-400"}`}>
        {date.getDate() === 1
          ? `1 ${date.toLocaleDateString("tr-TR", { month: "short" })}`
          : date.getDate()}
      </p>
      {topics.map((t) => {
        const formatLabel = t.suggested_format
          ? FORMAT_LABELS[t.suggested_format] || ""
          : "";
        const isSelected = !!(t.id && selectedTopicId === t.id);
        const color = isSelected
          ? "bg-green-200 border-green-400 text-green-900 ring-1 ring-green-400"
          : t.relevance_score >= 8
            ? "bg-green-100 border-green-200 text-green-800"
            : t.relevance_score >= 5
              ? "bg-yellow-100 border-yellow-200 text-yellow-800"
              : "bg-blue-100 border-blue-200 text-blue-800";

        return (
          <div
            key={t.id}
            onClick={() => onTopicClick(t)}
            className={`group rounded px-1.5 py-1 mb-1 border text-[10px] leading-tight cursor-pointer transition-all hover:opacity-80 ${color}`}
          >
            <p className="font-medium truncate">{t.title}</p>
            {formatLabel && <p className="text-[9px] opacity-70">{formatLabel}</p>}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
              className="hidden group-hover:block text-[9px] text-red-500 hover:text-red-700 mt-0.5 cursor-pointer"
            >
              Kaldır
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Draggable Topic Chip ──

function DraggableTopic({ topic }: { topic: BlogTopic }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: topic.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:bg-blue-50 transition-colors ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <span className="font-medium">{topic.title}</span>
      {topic.suggested_format && (
        <span className="text-gray-400 ml-1">
          · {FORMAT_LABELS[topic.suggested_format] || topic.suggested_format}
        </span>
      )}
    </div>
  );
}
