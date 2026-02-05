"use client";

import { useSiteContext } from "@/components/site/site-context";
import { OverallScoreCard } from "@/components/score-card";
import { CATEGORIES, computeCategoryScore } from "@/lib/category-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthorityReportLike } from "@/components/shared/authority-report";
import type { WebsiteDNA, FullAnalysisResult } from "@/lib/types";
import { siteTypeLabels, scaleLabels, maturityLabels } from "@/components/shared/dna-components";

// ── Helpers ──

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-50";
  if (score >= 60) return "bg-yellow-50";
  if (score >= 40) return "bg-orange-50";
  return "bg-red-50";
}

function statusLabel(score: number): { text: string; className: string } {
  if (score >= 80) return { text: "İyi", className: "text-green-700 bg-green-100" };
  if (score >= 60) return { text: "Orta", className: "text-yellow-700 bg-yellow-100" };
  if (score >= 40) return { text: "Zayıf", className: "text-orange-700 bg-orange-100" };
  return { text: "Kritik", className: "text-red-700 bg-red-100" };
}

function verdictBadge(verdict: "onay" | "guclendir" | "yeniden-yapilandir"): { text: string; className: string } {
  switch (verdict) {
    case "onay":
      return { text: "\u2713 Onay", className: "text-green-700 bg-green-100" };
    case "guclendir":
      return { text: "\u2191 G\u00fc\u00e7lendir", className: "text-yellow-700 bg-yellow-100" };
    case "yeniden-yapilandir":
      return { text: "\u26a0 Yeniden Yap\u0131land\u0131r", className: "text-red-700 bg-red-100" };
  }
}

const AUTHORITY_REPORTS = [
  { key: "seoAuthority", label: "SEO Otorite" },
  { key: "geoAuthority", label: "GEO Otorite" },
  { key: "aeoAuthority", label: "AEO Otorite" },
  { key: "backlinkAuthority", label: "Backlink Otorite" },
  { key: "blogAuthority", label: "Blog Otorite" },
] as const;

// ── Main Component ──

export function TamRaporPage() {
  const { domain, data, tasks } = useSiteContext();

  if (!data) {
    return <div className="text-muted-foreground py-8">{"Veri y\u00fckleniyor..."}</div>;
  }

  const scoring = data.scoring;
  const analysisDate = new Date(data.analyzedAt).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Task counts by category
  const tasksByCategory: Record<string, { total: number; pending: number; completed: number }> = {};
  for (const cat of CATEGORIES) {
    const catTasks = tasks.filter((t) => t.category === cat.slug);
    tasksByCategory[cat.slug] = {
      total: catTasks.length,
      pending: catTasks.filter((t) => t.status === "pending" || t.status === "regressed").length,
      completed: catTasks.filter((t) => t.status === "completed" || t.status === "verified").length,
    };
  }

  const totalTasks = tasks.length;
  const totalPending = tasks.filter((t) => t.status === "pending" || t.status === "regressed").length;
  const totalCompleted = tasks.filter((t) => t.status === "completed" || t.status === "verified").length;

  return (
    <div className="space-y-8">
      {/* ── A: Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <OverallScoreCard score={scoring.overall} color={scoring.overallColor} />
        <div>
          <h1 className="text-2xl font-bold">{domain}</h1>
          <p className="text-sm text-muted-foreground mt-1">Tam Rapor &middot; {analysisDate}</p>
        </div>
      </div>

      {/* ── B: Kategori Skorları Tablosu ── */}
      <Card>
        <CardHeader>
          <CardTitle>{"Kategori Skorlar\u0131"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-muted-foreground">Kategori</th>
                  <th className="pb-2 font-medium text-muted-foreground text-center">Skor</th>
                  <th className="pb-2 font-medium text-muted-foreground text-center">Durum</th>
                  <th className="pb-2 font-medium text-muted-foreground text-center">{"Bekleyen G\u00f6rev"}</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((cat) => {
                  const catScore = computeCategoryScore(scoring, cat);
                  const pending = tasksByCategory[cat.slug]?.pending ?? 0;
                  const status = catScore !== null ? statusLabel(catScore) : null;

                  return (
                    <tr key={cat.slug} className="border-b last:border-0">
                      <td className="py-2.5">
                        <span className="mr-2">{cat.icon}</span>
                        <span className="font-medium">{cat.label}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        {catScore !== null ? (
                          <span className={`font-bold ${scoreColor(catScore)}`}>{catScore}</span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {status ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                            {status.text}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Veri yok</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {pending > 0 ? (
                          <span className="font-semibold text-orange-600">{pending}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── C: Authority Raporları Özeti ── */}
      {hasAnyAuthorityReport(data) && (
        <Card>
          <CardHeader>
            <CardTitle>{"Otorite Raporlar\u0131 \u00d6zeti"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {AUTHORITY_REPORTS.map(({ key, label }) => {
                const report = data[key] as AuthorityReportLike | undefined;
                if (!report) return null;

                const badge = verdictBadge(report.verdict);

                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-4 ${scoreBg(report.overall)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{label}</span>
                      <span className={`text-lg font-bold ${scoreColor(report.overall)}`}>
                        {report.overall}
                      </span>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── D: Görev Özeti ── */}
      <Card>
        <CardHeader>
          <CardTitle>{"G\u00f6rev \u00d6zeti"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold">{totalTasks}</p>
              <p className="text-xs text-muted-foreground">Toplam</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-orange-50">
              <p className="text-2xl font-bold text-orange-600">{totalPending}</p>
              <p className="text-xs text-muted-foreground">Bekleyen</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50">
              <p className="text-2xl font-bold text-green-600">{totalCompleted}</p>
              <p className="text-xs text-muted-foreground">Tamamlanan</p>
            </div>
          </div>

          {totalTasks > 0 && (
            <div className="space-y-1.5">
              {CATEGORIES.map((cat) => {
                const stats = tasksByCategory[cat.slug];
                if (!stats || stats.total === 0) return null;

                return (
                  <div key={cat.slug} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <span>
                      <span className="mr-1.5">{cat.icon}</span>
                      {cat.label}
                    </span>
                    <span className="text-muted-foreground">
                      <span className="text-green-600 font-medium">{stats.completed}</span>
                      /{stats.total}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── E: DNA Bilgileri ── */}
      {data.dna && <DNACompactSection dna={data.dna} />}

      {/* ── F: AI Analiz ── */}
      {data.aiSummary && (
        <Card>
          <CardHeader>
            <CardTitle>AI Analiz</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {data.aiSummary}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ──

function DNACompactSection({ dna }: { dna: WebsiteDNA }) {
  const contactMethods = dna.contact.methods.length > 0 ? dna.contact.methods.join(", ") : "Tespit edilemedi";

  return (
    <Card>
      <CardHeader>
        <CardTitle>DNA Bilgileri</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <DNAItem label="Platform" value={dna.techStack.platform || "Bilinmiyor"} />
          <DNAItem label="Site Tipi" value={siteTypeLabels[dna.identity.siteType] || dna.identity.siteType} />
          <DNAItem label={"\u00d6l\u00e7ek"} value={scaleLabels[dna.scale.level] || dna.scale.level} />
          <DNAItem label="Olgunluk" value={maturityLabels[dna.maturity.level] || dna.maturity.level} />
          <DNAItem label={"\u0130leti\u015fim"} value={contactMethods} />
          {dna.identity.industry && (
            <DNAItem label={"Sekt\u00f6r"} value={dna.identity.industry} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DNAItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

// ── Utility ──

function hasAnyAuthorityReport(data: FullAnalysisResult): boolean {
  return AUTHORITY_REPORTS.some(({ key }) => data[key] != null);
}
