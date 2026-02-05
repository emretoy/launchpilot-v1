"use client";

import { useSiteContext } from "@/components/site/site-context";
import { TaskList } from "@/components/site/task-list";
import { TechnicalDetails } from "@/components/site/technical-details";
import { InfoRow, MetricBadge } from "@/components/shared/info-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

export function PerformansPage() {
  const { data, tasks, updateTaskStatus } = useSiteContext();

  if (!data) return <div className="text-muted-foreground py-8">Veri yükleniyor...</div>;

  const { scoring, pageSpeed } = data;
  const perf = scoring.categories.performance;
  const wv = pageSpeed.webVitals;
  const categoryTasks = tasks.filter((t) => t.category === "performans");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
      {/* Sol: İçerik */}
      <div className="space-y-6 min-w-0">
        <div className="flex items-center gap-4">
          <span className="text-4xl">⚡</span>
          <div>
            <h1 className="text-2xl font-bold">Performans</h1>
            <p className={`text-3xl font-bold ${scoreColor(perf.score)}`}>
              {perf.noData ? "N/A" : `${perf.score}/100`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Sayfa hızı, Core Web Vitals ve yükleme performansı
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Core Web Vitals</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">LCP</p>
              <p className="text-xl font-bold">{wv.lcp !== null ? `${wv.lcp}ms` : "N/A"}</p>
              <MetricBadge value={wv.lcp} good={2500} mid={4000} />
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">CLS</p>
              <p className="text-xl font-bold">{wv.cls !== null ? wv.cls.toFixed(3) : "N/A"}</p>
              <MetricBadge value={wv.cls !== null ? wv.cls * 1000 : null} good={100} mid={250} />
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">INP</p>
              <p className="text-xl font-bold">{wv.inp !== null ? `${wv.inp}ms` : "N/A"}</p>
              <MetricBadge value={wv.inp} good={200} mid={500} />
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">TTFB</p>
              <p className="text-xl font-bold">{wv.ttfb !== null ? `${wv.ttfb}ms` : "N/A"}</p>
              <MetricBadge value={wv.ttfb} good={800} mid={1800} />
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">FID</p>
              <p className="text-xl font-bold">{wv.fid !== null ? `${wv.fid}ms` : "N/A"}</p>
              <MetricBadge value={wv.fid} good={100} mid={300} />
            </div>
          </CardContent>
        </Card>

        <TechnicalDetails>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">PageSpeed Skorları</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Performance" value={<span className={scoreColor(pageSpeed.scores.performance)}>{pageSpeed.scores.performance ?? "N/A"}</span>} />
              <InfoRow label="Accessibility" value={<span className={scoreColor(pageSpeed.scores.accessibility)}>{pageSpeed.scores.accessibility ?? "N/A"}</span>} />
              <InfoRow label="Best Practices" value={<span className={scoreColor(pageSpeed.scores.bestPractices)}>{pageSpeed.scores.bestPractices ?? "N/A"}</span>} />
              <InfoRow label="SEO" value={<span className={scoreColor(pageSpeed.scores.seo)}>{pageSpeed.scores.seo ?? "N/A"}</span>} />
            </CardContent>
          </Card>

          {perf.details.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Skor Detayları</p>
              {perf.details.map((d, i) => (
                <div key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-muted">{d}</div>
              ))}
            </div>
          )}
        </TechnicalDetails>
      </div>

      {/* Sağ: Görevler */}
      <div className="lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold mb-3">Yapılacaklar</h2>
        <TaskList tasks={categoryTasks} onToggle={updateTaskStatus} emptyMessage="Performans ile ilgili görev yok." />
      </div>
    </div>
  );
}
