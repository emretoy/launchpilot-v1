"use client";

import Link from "next/link";
import { CATEGORIES, computeCategoryScore } from "@/lib/category-config";
import type { ScoringResult } from "@/lib/types";

function scoreColorClass(score: number | null): string {
  if (score === null) return "text-muted-foreground bg-muted/30 border-muted";
  if (score >= 80) return "text-green-700 bg-green-50 border-green-200";
  if (score >= 60) return "text-yellow-700 bg-yellow-50 border-yellow-200";
  if (score >= 40) return "text-orange-700 bg-orange-50 border-orange-200";
  return "text-red-700 bg-red-50 border-red-200";
}

export function ScoreGrid({
  scoring,
  domain,
}: {
  scoring: ScoringResult;
  domain: string;
}) {
  const basePath = `/site/${encodeURIComponent(domain)}`;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {CATEGORIES.map((cat) => {
        const score = computeCategoryScore(scoring, cat);
        const colorCls = scoreColorClass(score);

        return (
          <Link
            key={cat.slug}
            href={`${basePath}/${cat.slug}`}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:scale-[1.02] hover:shadow-sm ${colorCls}`}
          >
            <span className="text-2xl">{cat.icon}</span>
            <span className="text-2xl font-bold">{score !== null ? score : "—"}</span>
            <span className="text-xs font-medium text-center">{cat.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
