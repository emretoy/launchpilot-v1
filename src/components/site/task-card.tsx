"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/types";

const effortColors: Record<string, string> = {
  Kolay: "bg-green-100 text-green-700",
  Orta: "bg-yellow-100 text-yellow-700",
  Zor: "bg-red-100 text-red-700",
};

const priorityLabels: Record<string, string> = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-blue-100 text-blue-800",
};

export function TaskCard({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (taskId: string, newStatus: Task["status"]) => void;
}) {
  const [showHowTo, setShowHowTo] = useState(false);
  const isCompleted = task.status === "completed" || task.status === "verified";
  const isRegressed = task.status === "regressed";

  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        isCompleted
          ? "bg-green-50/50 border-green-200"
          : isRegressed
            ? "bg-red-50/50 border-red-200"
            : "bg-background border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(task.id, isCompleted ? "pending" : "completed")}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
            isCompleted
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 hover:border-primary"
          }`}
        >
          {isCompleted && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </p>

          {/* Description */}
          <p className="text-xs text-muted-foreground mt-1">{task.description}</p>

          {/* Badges */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Badge className={`text-[10px] ${effortColors[task.effort] || "bg-gray-100"}`}>
              {task.effort}
            </Badge>
            <Badge className={`text-[10px] ${priorityColors[task.priority] || "bg-gray-100"}`}>
              {priorityLabels[task.priority] || task.priority}
            </Badge>
            {isRegressed && (
              <Badge className="text-[10px] bg-red-100 text-red-700">Tekrar oluştu</Badge>
            )}
          </div>

          {/* How To */}
          <button
            onClick={() => setShowHowTo(!showHowTo)}
            className="text-xs text-primary hover:underline mt-2 flex items-center gap-1 cursor-pointer"
          >
            <span className={`transition-transform ${showHowTo ? "rotate-90" : ""}`}>▶</span>
            Nasıl düzeltilir?
          </button>

          {showHowTo && (
            <div className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-line">
              {task.how_to}
            </div>
          )}

          {/* Completed date */}
          {isCompleted && task.completed_at && (
            <p className="text-[10px] text-green-600 mt-2">
              ✓ {new Date(task.completed_at).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
              })} tamamlandı
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
