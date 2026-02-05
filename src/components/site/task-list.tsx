"use client";

import type { Task } from "@/lib/types";
import { TaskCard } from "./task-card";

export function TaskList({
  tasks,
  onToggle,
  emptyMessage = "Bu kategoride görev yok.",
}: {
  tasks: Task[];
  onToggle: (taskId: string, newStatus: Task["status"]) => void;
  emptyMessage?: string;
}) {
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "regressed");
  const completed = tasks.filter((t) => t.status === "completed" || t.status === "verified");

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sayaç */}
      <div className="flex items-center gap-3 text-sm">
        {pending.length > 0 && (
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{pending.length}</span> görev bekliyor
          </span>
        )}
        {completed.length > 0 && (
          <span className="text-muted-foreground">
            <span className="font-semibold text-green-600">{completed.length}</span> tamamlandı
          </span>
        )}
      </div>

      {/* Bekleyen görevler */}
      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={onToggle} />
          ))}
        </div>
      )}

      {/* Tamamlanan görevler */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium pt-2">Tamamlananlar</p>
          {completed.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
