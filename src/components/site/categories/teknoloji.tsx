"use client";

import { useSiteContext } from "@/components/site/site-context";
import { TaskList } from "@/components/site/task-list";
import { TechnicalDetails } from "@/components/site/technical-details";
import { InfoRow } from "@/components/shared/info-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function TeknolojiPage() {
  const { data, tasks, updateTaskStatus } = useSiteContext();

  if (!data) return <div className="text-muted-foreground py-8">Veri yükleniyor...</div>;

  const { scoring, crawl, pageAnalysis, htmlValidation } = data;
  const tech = scoring.categories.technology;
  const bp = scoring.categories.bestPractices;
  const a11y = scoring.categories.accessibility;

  const scores = [tech.score, bp.score, a11y.score].filter((s) => s !== undefined);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const scoreClr = avgScore >= 80 ? "text-green-600" : avgScore >= 60 ? "text-yellow-600" : avgScore >= 40 ? "text-orange-600" : "text-red-600";

  const categoryTasks = tasks.filter((t) => t.category === "teknoloji");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
      {/* Sol: İçerik */}
      <div className="space-y-6 min-w-0">
      <div className="flex items-center gap-4">
        <span className="text-4xl">🔧</span>
        <div>
          <h1 className="text-2xl font-bold">Teknoloji</h1>
          <p className={`text-3xl font-bold ${scoreClr}`}>{avgScore}/100</p>
          <p className="text-sm text-muted-foreground mt-1">
            Teknoloji yığını, en iyi uygulamalar ve erişilebilirlik
          </p>
        </div>
      </div>

      {/* Tech Stack */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Teknoloji Yığını</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Platform" value={crawl.techDetection.platform || "Tespit edilemedi"} />
          {crawl.techDetection.confidence > 0 && (
            <InfoRow label="Güven" value={`%${crawl.techDetection.confidence}`} />
          )}
          <InfoRow label="Analytics" value={
            <div className="flex flex-wrap gap-1">
              {pageAnalysis.analytics.hasGoogleAnalytics && <Badge variant="secondary" className="text-[10px]">GA</Badge>}
              {pageAnalysis.analytics.hasGTM && <Badge variant="secondary" className="text-[10px]">GTM</Badge>}
              {pageAnalysis.analytics.hasMetaPixel && <Badge variant="secondary" className="text-[10px]">Meta Pixel</Badge>}
              {pageAnalysis.analytics.hasHotjar && <Badge variant="secondary" className="text-[10px]">Hotjar</Badge>}
              {pageAnalysis.analytics.otherTools.map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>)}
              {!pageAnalysis.analytics.hasGoogleAnalytics && !pageAnalysis.analytics.hasGTM && "Yok"}
            </div>
          } />
          {pageAnalysis.cssFrameworks.length > 0 && (
            <InfoRow label="CSS" value={pageAnalysis.cssFrameworks.join(", ")} />
          )}
          {pageAnalysis.fonts.length > 0 && (
            <InfoRow label="Fontlar" value={pageAnalysis.fonts.slice(0, 5).join(", ")} />
          )}
        </CardContent>
      </Card>

      {/* Teknik Detaylar */}
      <TechnicalDetails>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">HTML Doğrulama</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Hatalar" value={htmlValidation.errors} />
            <InfoRow label="Uyarılar" value={htmlValidation.warnings} />
            {htmlValidation.details.length > 0 && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {htmlValidation.details.slice(0, 10).map((d, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">
                    {d.type}: {d.message} {d.line && `(satır ${d.line})`}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Erişilebilirlik</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Skor" value={`${a11y.score}/100`} />
            <InfoRow label="Eksik Alt Tag" value={`${crawl.images.totalMissingAlt}/${crawl.images.total}`} />
            <InfoRow label="Dil Tanımlı" value={crawl.basicInfo.language ? "Evet" : "Hayır"} />
            {a11y.details.length > 0 && (
              <div className="mt-2 space-y-1">
                {a11y.details.map((d, i) => (
                  <div key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-muted">{d}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {tech.details.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Teknoloji Skor Detayları</p>
            {tech.details.map((d, i) => (
              <div key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-muted">{d}</div>
            ))}
          </div>
        )}
      </TechnicalDetails>
      </div>

      {/* Sağ: Görevler */}
      <div className="lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold mb-3">Yapılacaklar</h2>
        <TaskList tasks={categoryTasks} onToggle={updateTaskStatus} emptyMessage="Teknoloji ile ilgili görev yok." />
      </div>
    </div>
  );
}
