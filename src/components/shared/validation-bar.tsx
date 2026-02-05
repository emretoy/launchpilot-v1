"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ValidationSummary } from "@/lib/types";

export function ValidationSummaryBar({ summary }: { summary: ValidationSummary }) {
  const [showDetails, setShowDetails] = useState(false);
  const score = summary.verificationScore;
  const barColor =
    score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : score >= 40 ? "bg-orange-500" : "bg-red-500";

  const dnaChecks = summary.checks.filter((c) => c.field.startsWith("dna."));
  const scraperChecks = summary.checks.filter((c) => !c.field.startsWith("dna.") && !c.field.startsWith("score."));
  const scoreChecks = summary.checks.filter((c) => c.field.startsWith("score.") || c.field === "content.wordCount" || c.field === "schemaTypes");

  const checkGroups = [
    { label: "DNA Doğrulama", checks: dnaChecks, icon: "🧬" },
    { label: "Veri Doğrulama", checks: scraperChecks, icon: "🔍" },
    { label: "Skor Tutarlılık", checks: scoreChecks, icon: "📊" },
  ];

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">V</span>
          Veri Doğrulama
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Güven Skoru</span>
              <span className="font-semibold">{score}/100</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-white/60 rounded-lg">
              <p className="text-lg font-bold text-green-600">{summary.verified}</p>
              <p className="text-[10px] text-muted-foreground">Doğrulandı</p>
            </div>
            <div className="text-center p-2 bg-white/60 rounded-lg">
              <p className="text-lg font-bold text-yellow-600">{summary.unverified}</p>
              <p className="text-[10px] text-muted-foreground">Doğrulanamadı</p>
            </div>
            <div className="text-center p-2 bg-white/60 rounded-lg">
              <p className="text-lg font-bold text-red-600">{summary.filtered}</p>
              <p className="text-[10px] text-muted-foreground">Filtrelendi</p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px] text-muted-foreground">
              {summary.totalChecks} kontrol, {(summary.duration / 1000).toFixed(1)}s
            </p>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              {showDetails ? "Gizle" : "Detayları Gör"}
            </button>
          </div>

          {showDetails && (
            <div className="space-y-4 pt-2 border-t border-blue-200">
              {checkGroups.map((group) =>
                group.checks.length > 0 ? (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-blue-800 mb-2">
                      {group.icon} {group.label} ({group.checks.filter((c) => c.verified).length}/{group.checks.length})
                    </p>
                    <div className="space-y-1">
                      {group.checks.map((check, i) => (
                        <div
                          key={`${check.field}-${i}`}
                          className={`flex items-start gap-2 text-[11px] px-2 py-1.5 rounded ${
                            check.verified
                              ? "bg-green-50 text-green-800"
                              : check.reason?.includes("düzeltildi") || check.reason?.includes("kaldırıldı")
                                ? "bg-amber-50 text-amber-800"
                                : "bg-red-50 text-red-800"
                          }`}
                        >
                          <span className="mt-0.5 shrink-0">
                            {check.verified ? "✓" : check.reason?.includes("düzeltildi") || check.reason?.includes("kaldırıldı") ? "⚠" : "✗"}
                          </span>
                          <span className="leading-relaxed">{check.reason || check.field}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
