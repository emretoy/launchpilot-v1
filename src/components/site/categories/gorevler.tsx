"use client";

import { useState } from "react";
import { useSiteContext } from "@/components/site/site-context";
import { TaskList } from "@/components/site/task-list";
import { CATEGORIES } from "@/lib/category-config";

export function GorevlerPage() {
  const { tasks, updateTaskStatus } = useSiteContext();
  const [filter, setFilter] = useState<string>("all");

  const categories = [
    { value: "all", label: "Tümü" },
    ...CATEGORIES.filter((c) => c.recommendationCategories.length > 0).map((c) => ({
      value: c.slug,
      label: c.label,
    })),
  ];

  const filteredTasks = filter === "all" ? tasks : tasks.filter((t) => t.category === filter);

  const pendingCount = tasks.filter((t) => t.status === "pending" || t.status === "regressed").length;
  const completedCount = tasks.filter((t) => t.status === "completed" || t.status === "verified").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-4xl">✅</span>
        <div>
          <h1 className="text-2xl font-bold">Tüm Görevler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingCount > 0 && <><span className="font-semibold text-foreground">{pendingCount}</span> görev bekliyor</>}
            {pendingCount > 0 && completedCount > 0 && " · "}
            {completedCount > 0 && <><span className="font-semibold text-green-600">{completedCount}</span> tamamlandı</>}
            {pendingCount === 0 && completedCount === 0 && "Henüz görev oluşturulmadı"}
          </p>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {categories.map((cat) => {
          const count = cat.value === "all"
            ? tasks.length
            : tasks.filter((t) => t.category === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setFilter(cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Görev Listesi */}
      <TaskList
        tasks={filteredTasks}
        onToggle={updateTaskStatus}
        emptyMessage={filter === "all" ? "Henüz görev yok." : `${categories.find(c => c.value === filter)?.label || ""} kategorisinde görev yok.`}
      />
    </div>
  );
}
