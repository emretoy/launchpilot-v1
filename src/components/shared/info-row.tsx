"use client";

import { Badge } from "@/components/ui/badge";

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] truncate">
        {value || <span className="text-muted-foreground">-</span>}
      </span>
    </div>
  );
}

export function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <Badge variant="secondary">N/A</Badge>;
  const colors: Record<string, string> = {
    "A+": "bg-green-100 text-green-800",
    A: "bg-green-100 text-green-800",
    B: "bg-lime-100 text-lime-800",
    C: "bg-yellow-100 text-yellow-800",
    D: "bg-orange-100 text-orange-800",
    F: "bg-red-100 text-red-800",
  };
  return <Badge className={`${colors[grade] || "bg-gray-100 text-gray-800"} hover:opacity-90`}>{grade}</Badge>;
}

export function MetricBadge({ value, good, mid }: { value: number | null; good: number; mid: number }) {
  if (value === null) return <Badge variant="secondary">N/A</Badge>;
  if (value <= good) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">İyi</Badge>;
  if (value <= mid) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Orta</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Kötü</Badge>;
}
