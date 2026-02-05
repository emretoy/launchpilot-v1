"use client";

import { useSiteContext } from "@/components/site/site-context";
import { TaskList } from "@/components/site/task-list";
import { TechnicalDetails } from "@/components/site/technical-details";
import { InfoRow } from "@/components/shared/info-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SEOPage() {
  const { data, tasks, updateTaskStatus } = useSiteContext();

  if (!data) return <div className="text-muted-foreground py-8">Veri yükleniyor...</div>;

  const { scoring, crawl } = data;
  const seo = scoring.categories.seo;
  const categoryTasks = tasks.filter((t) => t.category === "seo");
  const scoreClr = seo.score >= 80 ? "text-green-600" : seo.score >= 60 ? "text-yellow-600" : seo.score >= 40 ? "text-orange-600" : "text-red-600";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
      {/* Sol: İçerik */}
      <div className="space-y-6 min-w-0">
      {/* Skor */}
      <div className="flex items-center gap-4">
        <span className="text-4xl">🔍</span>
        <div>
          <h1 className="text-2xl font-bold">SEO</h1>
          <p className={`text-3xl font-bold ${scoreClr}`}>{seo.score}/100</p>
          <p className="text-sm text-muted-foreground mt-1">
            Meta etiketler, başlıklar ve site haritası
          </p>
        </div>
      </div>

      {/* Hızlı Bakış */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">Title</p>
          <p className="text-sm font-semibold">{crawl.basicInfo.title ? "Var" : "Yok"}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">Meta Desc</p>
          <p className="text-sm font-semibold">{crawl.basicInfo.metaDescription ? "Var" : "Yok"}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">H1</p>
          <p className="text-sm font-semibold">{crawl.headings.totalH1}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">Kelime Sayısı</p>
          <p className="text-sm font-semibold">{crawl.content.wordCount}</p>
        </div>
      </div>

      {/* Teknik Detaylar */}
      <TechnicalDetails>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Meta & SEO Detayları</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Title" value={crawl.basicInfo.title || "—"} />
            <InfoRow label="Meta Description" value={crawl.basicInfo.metaDescription || "—"} />
            <InfoRow label="Canonical" value={crawl.metaSEO.canonical || "Yok"} />
            <InfoRow label="Robots" value={crawl.metaSEO.robots || "Yok"} />
            <InfoRow label="Viewport" value={crawl.metaSEO.viewport || "Yok"} />
            <InfoRow label="Language" value={crawl.basicInfo.language || "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Başlık Yapısı</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="H1" value={`${crawl.headings.totalH1} adet`} />
            <InfoRow label="H2" value={`${crawl.headings.totalH2} adet`} />
            <InfoRow label="H3" value={`${crawl.headings.totalH3} adet`} />
            {crawl.headings.h1.length > 0 && (
              <div className="mt-2 space-y-1">
                {crawl.headings.h1.map((h, i) => (
                  <p key={i} className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">{h.text}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">İçerik & Link'ler</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Kelime Sayısı" value={crawl.content.wordCount} />
            <InfoRow label="Paragraf" value={crawl.content.paragraphCount} />
            <InfoRow label="İçerik/Kod Oranı" value={`%${(crawl.content.contentToCodeRatio * 100).toFixed(1)}`} />
            <InfoRow label="İç Link" value={crawl.links.totalInternal} />
            <InfoRow label="Dış Link" value={crawl.links.totalExternal} />
            <InfoRow label="Kırık Link" value={crawl.links.totalBroken} />
            <InfoRow label="Eksik Alt" value={`${crawl.images.totalMissingAlt}/${crawl.images.total}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Teknik SEO</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Sitemap" value={crawl.technical.hasSitemap ? `Var${crawl.technical.sitemapPageCount ? ` (${crawl.technical.sitemapPageCount} sayfa)` : ""}` : "Yok"} />
            <InfoRow label="Robots.txt" value={crawl.technical.hasRobotsTxt ? "Var" : "Yok"} />
            <InfoRow label="Schema.org" value={crawl.technical.hasSchemaOrg ? crawl.technical.schemaTypes.join(", ") : "Yok"} />
            {crawl.metaSEO.hreflang.length > 0 && (
              <InfoRow label="Hreflang" value={crawl.metaSEO.hreflang.map(h => h.lang).join(", ")} />
            )}
          </CardContent>
        </Card>

        {seo.details.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">SEO Skor Detayları</p>
            {seo.details.map((d, i) => (
              <div key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-muted">{d}</div>
            ))}
          </div>
        )}
      </TechnicalDetails>

      {/* Authority Raporları */}
      {data.seoAuthority && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span>🏆</span> SEO Otorite
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{data.seoAuthority.overall}/100</span>
                <Badge
                  variant="outline"
                  className={
                    data.seoAuthority.verdict === "onay"
                      ? "border-green-500 text-green-600 bg-green-50"
                      : data.seoAuthority.verdict === "guclendir"
                        ? "border-yellow-500 text-yellow-600 bg-yellow-50"
                        : "border-red-500 text-red-600 bg-red-50"
                  }
                >
                  {data.seoAuthority.verdict === "onay"
                    ? "Onay"
                    : data.seoAuthority.verdict === "guclendir"
                      ? "Güçlendir"
                      : "Yeniden Yapılandır"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Alt Kategoriler */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.values(data.seoAuthority.categories).map((sub: { score: number; max: number; label: string; details: string[]; noData?: boolean }, i: number) => (
                <div key={i} className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">{sub.label}</p>
                  <p className="text-sm font-semibold">
                    {sub.noData ? "N/A" : `${sub.score}/${sub.max}`}
                  </p>
                </div>
              ))}
            </div>

            {/* Aksiyon Planı */}
            {data.seoAuthority.actionPlan && data.seoAuthority.actionPlan.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Aksiyon Planı</p>
                <ol className="list-decimal list-inside space-y-1">
                  {data.seoAuthority.actionPlan.map((item: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">{item}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Community Insights */}
            {data.seoAuthority.communityInsights && data.seoAuthority.communityInsights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Topluluk Görüşleri</p>
                {data.seoAuthority.communityInsights.map((insight: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1">
                    &ldquo;{insight}&rdquo;
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {data.geoAuthority && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span>🌍</span> GEO Otorite
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{data.geoAuthority.overall}/100</span>
                <Badge
                  variant="outline"
                  className={
                    data.geoAuthority.verdict === "onay"
                      ? "border-green-500 text-green-600 bg-green-50"
                      : data.geoAuthority.verdict === "guclendir"
                        ? "border-yellow-500 text-yellow-600 bg-yellow-50"
                        : "border-red-500 text-red-600 bg-red-50"
                  }
                >
                  {data.geoAuthority.verdict === "onay"
                    ? "Onay"
                    : data.geoAuthority.verdict === "guclendir"
                      ? "Güçlendir"
                      : "Yeniden Yapılandır"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Alt Kategoriler */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.values(data.geoAuthority.categories).map((sub: { score: number; max: number; label: string; details: string[]; noData?: boolean }, i: number) => (
                <div key={i} className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">{sub.label}</p>
                  <p className="text-sm font-semibold">
                    {sub.noData ? "N/A" : `${sub.score}/${sub.max}`}
                  </p>
                </div>
              ))}
            </div>

            {/* Aksiyon Planı */}
            {data.geoAuthority.actionPlan && data.geoAuthority.actionPlan.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Aksiyon Planı</p>
                <ol className="list-decimal list-inside space-y-1">
                  {data.geoAuthority.actionPlan.map((item: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">{item}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Community Insights */}
            {data.geoAuthority.communityInsights && data.geoAuthority.communityInsights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Topluluk Görüşleri</p>
                {data.geoAuthority.communityInsights.map((insight: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1">
                    &ldquo;{insight}&rdquo;
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {data.aeoAuthority && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span>🤖</span> AEO Otorite
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{data.aeoAuthority.overall}/100</span>
                <Badge
                  variant="outline"
                  className={
                    data.aeoAuthority.verdict === "onay"
                      ? "border-green-500 text-green-600 bg-green-50"
                      : data.aeoAuthority.verdict === "guclendir"
                        ? "border-yellow-500 text-yellow-600 bg-yellow-50"
                        : "border-red-500 text-red-600 bg-red-50"
                  }
                >
                  {data.aeoAuthority.verdict === "onay"
                    ? "Onay"
                    : data.aeoAuthority.verdict === "guclendir"
                      ? "Güçlendir"
                      : "Yeniden Yapılandır"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Alt Kategoriler */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.values(data.aeoAuthority.categories).map((sub: { score: number; max: number; label: string; details: string[]; noData?: boolean }, i: number) => (
                <div key={i} className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">{sub.label}</p>
                  <p className="text-sm font-semibold">
                    {sub.noData ? "N/A" : `${sub.score}/${sub.max}`}
                  </p>
                </div>
              ))}
            </div>

            {/* Aksiyon Planı */}
            {data.aeoAuthority.actionPlan && data.aeoAuthority.actionPlan.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Aksiyon Planı</p>
                <ol className="list-decimal list-inside space-y-1">
                  {data.aeoAuthority.actionPlan.map((item: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">{item}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Community Insights */}
            {data.aeoAuthority.communityInsights && data.aeoAuthority.communityInsights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Topluluk Görüşleri</p>
                {data.aeoAuthority.communityInsights.map((insight: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1">
                    &ldquo;{insight}&rdquo;
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>

      {/* Sağ: Görevler */}
      <div className="lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold mb-3">Yapılacaklar</h2>
        <TaskList tasks={categoryTasks} onToggle={updateTaskStatus} emptyMessage="SEO ile ilgili görev yok." />
      </div>
    </div>
  );
}
