"use client";

import { useSiteContext } from "@/components/site/site-context";
import { TaskList } from "@/components/site/task-list";
import { TechnicalDetails } from "@/components/site/technical-details";
import { InfoRow } from "@/components/shared/info-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DijitalVarlikPage() {
  const { data, tasks, updateTaskStatus } = useSiteContext();

  if (!data) return <div className="text-muted-foreground py-8">Veri yükleniyor...</div>;

  const { scoring, onlinePresence } = data;
  const op = scoring.categories.onlinePresence;
  const scoreClr = op.noData ? "text-muted-foreground" : op.score >= 80 ? "text-green-600" : op.score >= 60 ? "text-yellow-600" : op.score >= 40 ? "text-orange-600" : "text-red-600";
  const categoryTasks = tasks.filter((t) => t.category === "dijital-varlik");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
      {/* Sol: İçerik */}
      <div className="space-y-6 min-w-0">
      <div className="flex items-center gap-4">
        <span className="text-4xl">🌐</span>
        <div>
          <h1 className="text-2xl font-bold">Dijital Varlık</h1>
          <p className={`text-3xl font-bold ${scoreClr}`}>
            {op.noData ? "N/A" : `${op.score}/100`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Google indeksleme, sosyal profiller ve web geçmişi
          </p>
        </div>
      </div>

      {/* Hızlı Bakış */}
      {onlinePresence && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Google Index</p>
            <p className="text-sm font-semibold">
              {onlinePresence.googleIndex.noData
                ? "N/A"
                : onlinePresence.googleIndex.isIndexed
                  ? `${onlinePresence.googleIndex.indexedPageCount} sayfa`
                  : "İndekslenmemiş"
              }
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Sosyal Profil</p>
            <p className="text-sm font-semibold">
              {onlinePresence.socialPresence.totalVerified}/{onlinePresence.socialPresence.profiles.length} aktif
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Web Yaşı</p>
            <p className="text-sm font-semibold">
              {onlinePresence.waybackHistory.websiteAge !== null
                ? `${onlinePresence.waybackHistory.websiteAge} yıl`
                : "Bilinmiyor"
              }
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Arşiv Snapshot</p>
            <p className="text-sm font-semibold">{onlinePresence.waybackHistory.snapshotCount}</p>
          </div>
        </div>
      )}

      {/* Teknik Detaylar */}
      <TechnicalDetails>
        {onlinePresence && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Google Index</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="İndekslenmiş" value={onlinePresence.googleIndex.isIndexed ? "Evet" : "Hayır"} />
                <InfoRow label="Sayfa Sayısı" value={onlinePresence.googleIndex.indexedPageCount} />
                <InfoRow label="Rich Snippet" value={onlinePresence.googleIndex.hasRichSnippet ? "Var" : "Yok"} />
                <InfoRow label="Marka Bahsetme" value={onlinePresence.googleIndex.brandMentions} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sosyal Profiller</CardTitle>
              </CardHeader>
              <CardContent>
                {onlinePresence.socialPresence.profiles.map((p) => (
                  <InfoRow
                    key={p.platform}
                    label={p.platform}
                    value={p.accessible ? "✓ Erişilebilir" : "✗ Erişilemez"}
                  />
                ))}
                {onlinePresence.socialPresence.profiles.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sosyal profil bulunamadı</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Webmaster & Yapılandırılmış Veri</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Google Webmaster" value={onlinePresence.webmasterTags.google ? "Doğrulanmış" : "Yok"} />
                <InfoRow label="Bing Webmaster" value={onlinePresence.webmasterTags.bing ? "Doğrulanmış" : "Yok"} />
                <InfoRow label="Schema.org" value={onlinePresence.structuredData.schemaComplete ? "Tam" : "Eksik"} />
                <InfoRow label="Open Graph" value={onlinePresence.structuredData.ogComplete ? "Tam" : "Eksik"} />
              </CardContent>
            </Card>
          </>
        )}

        {op.details.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Skor Detayları</p>
            {op.details.map((d, i) => (
              <div key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-muted">{d}</div>
            ))}
          </div>
        )}
      </TechnicalDetails>

      {/* Backlink Otorite Raporu */}
      {data.backlinkAuthority && (() => {
        const ba = data.backlinkAuthority;
        const verdictConfig = {
          onay: { label: "ONAY", bg: "bg-green-100", text: "text-green-800" },
          guclendir: { label: "GÜÇLENDİR", bg: "bg-yellow-100", text: "text-yellow-800" },
          "yeniden-yapilandir": { label: "YENİDEN YAPILANDIR", bg: "bg-red-100", text: "text-red-800" },
        };
        const v = verdictConfig[ba.verdict];
        const overallColor =
          ba.overall >= 70 ? "text-green-600" : ba.overall >= 50 ? "text-yellow-600" : "text-red-600";

        const subCategories = [
          { key: "relevance" as const, label: "Alaka Düzeyi", max: 30 },
          { key: "trafficSignal" as const, label: "Trafik Sinyali", max: 20 },
          { key: "linkDiversity" as const, label: "Link Çeşitliliği", max: 20 },
          { key: "anchorNaturalness" as const, label: "Anchor Doğallığı", max: 10 },
          { key: "mentionSignal" as const, label: "Bahsetme Sinyali", max: 20 },
        ];

        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  🔗 Backlink Otorite Raporu
                </CardTitle>
                <span className={`text-2xl font-bold ${overallColor}`}>{ba.overall}/100</span>
              </div>
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${v.bg} ${v.text}`}>
                  {v.label}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Alt Skorlar — Kompakt Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {subCategories.map(({ key, label, max }) => {
                  const sub = ba.categories[key];
                  const pct = (sub.score / max) * 100;
                  const barColor = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
                  return (
                    <div key={key} className="p-3 rounded-lg bg-muted/30 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-sm font-bold">{sub.score}/{max}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Aksiyon Planı */}
              {ba.actionPlan.length > 0 && (
                <div className="space-y-2 pt-3 border-t">
                  <h4 className="text-sm font-semibold text-muted-foreground">📅 Aksiyon Planı</h4>
                  <ol className="space-y-1.5 list-decimal list-inside">
                    {ba.actionPlan.map((step, i) => (
                      <li key={i} className="text-sm text-gray-700">{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Topluluk İçgörüleri */}
              {ba.communityInsights.length > 0 && (
                <div className="space-y-2 pt-3 border-t">
                  <h4 className="text-sm font-semibold text-muted-foreground">💬 Topluluk İçgörüleri</h4>
                  <div className="space-y-1.5">
                    {ba.communityInsights.map((insight, i) => (
                      <blockquote key={i} className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3 py-1">
                        {insight}
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}
      </div>

      {/* Sağ: Görevler */}
      <div className="lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold mb-3">Yapılacaklar</h2>
        <TaskList tasks={categoryTasks} onToggle={updateTaskStatus} emptyMessage="Dijital varlık ile ilgili görev yok." />
      </div>
    </div>
  );
}
