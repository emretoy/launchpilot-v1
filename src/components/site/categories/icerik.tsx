"use client";

import { useSiteContext } from "@/components/site/site-context";
import { TaskList } from "@/components/site/task-list";
import { TechnicalDetails } from "@/components/site/technical-details";
import { InfoRow } from "@/components/shared/info-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AuthoritySubScore } from "@/lib/types";

/* ── Verdict config ── */
const verdictConfig = {
  onay: { label: "ONAY", bg: "bg-green-100", text: "text-green-800" },
  guclendir: { label: "GUCLENDIR", bg: "bg-yellow-100", text: "text-yellow-800" },
  "yeniden-yapilandir": { label: "YENIDEN YAPILANDIR", bg: "bg-red-100", text: "text-red-800" },
} as const;

/* ── Blog authority sub-score keys with Turkish labels ── */
const subScoreKeys: { key: string; label: string }[] = [
  { key: "contentDepth", label: "Icerik Derinligi" },
  { key: "pillarCluster", label: "Pillar & Cluster" },
  { key: "originality", label: "Ozgunluk" },
  { key: "assetProduction", label: "Asset Uretimi" },
  { key: "trustSignals", label: "Guven Sinyalleri" },
  { key: "distributionSignal", label: "Dagitim Sinyali" },
];

/* ── Sub-score card ── */
function SubScoreCard({ sub, fallbackLabel }: { sub: AuthoritySubScore; fallbackLabel: string }) {
  const pct = sub.max > 0 ? (sub.score / sub.max) * 100 : 0;
  const barColor =
    pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{sub.label || fallbackLabel}</span>
        <span className="text-sm font-bold">
          {sub.score}/{sub.max}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sub.noData && (
        <p className="text-xs text-amber-600">Veri sinirli — tahmine dayali</p>
      )}
    </div>
  );
}

export function IcerikPage() {
  const { data, tasks, updateTaskStatus } = useSiteContext();

  if (!data) return <div className="text-muted-foreground py-8">Veri yukleniyor...</div>;

  const { scoring, crawl } = data;
  const content = scoring.categories.content;
  const blogAuthority = data.blogAuthority;
  const categoryTasks = tasks.filter((t) => t.category === "icerik");

  const scoreClr =
    content.score >= 80
      ? "text-green-600"
      : content.score >= 60
        ? "text-yellow-600"
        : content.score >= 40
          ? "text-orange-600"
          : "text-red-600";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
      {/* Sol: İçerik */}
      <div className="space-y-6 min-w-0">
      {/* Skor */}
      <div className="flex items-center gap-4">
        <span className="text-4xl">&#x1F4DD;</span>
        <div>
          <h1 className="text-2xl font-bold">Icerik</h1>
          <p className={`text-3xl font-bold ${scoreClr}`}>{content.score}/100</p>
          <p className="text-sm text-muted-foreground mt-1">
            Kelime sayisi, icerik derinligi ve blog otoritesi
          </p>
        </div>
      </div>

      {/* Hizli Bakis */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">Kelime Sayisi</p>
          <p className="text-sm font-semibold">{crawl.content.wordCount}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">Paragraf</p>
          <p className="text-sm font-semibold">{crawl.content.paragraphCount}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">Icerik/Kod Orani</p>
          <p className="text-sm font-semibold">
            %{(crawl.content.contentToCodeRatio * 100).toFixed(1)}
          </p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">Gorseller</p>
          <p className="text-sm font-semibold">
            {crawl.images.total} ({crawl.images.totalMissingAlt} alt eksik)
          </p>
        </div>
      </div>

      {/* Blog Otorite Raporu */}
      {blogAuthority && (
        <Card className="border-lime-200 bg-gradient-to-br from-lime-50 to-green-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Blog Otorite Raporu</CardTitle>
              <span
                className={`text-2xl font-bold ${
                  blogAuthority.overall >= 70
                    ? "text-green-600"
                    : blogAuthority.overall >= 50
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {blogAuthority.overall}/100
              </span>
            </div>
            <div className="mt-2">
              {(() => {
                const v = verdictConfig[blogAuthority.verdict];
                return (
                  <Badge className={`${v.bg} ${v.text} hover:opacity-90`}>
                    {v.label}
                  </Badge>
                );
              })()}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Sub-scores grid */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-600">Alt Skorlar</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subScoreKeys.map(({ key, label }) => {
                  const sub = (
                    blogAuthority.categories as Record<string, AuthoritySubScore>
                  )[key];
                  if (!sub) return null;
                  return <SubScoreCard key={key} sub={sub} fallbackLabel={label} />;
                })}
              </div>
            </div>

            {/* Action Plan */}
            {blogAuthority.actionPlan.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-lime-200">
                <h4 className="text-sm font-semibold text-gray-600">30 Gunluk Plan</h4>
                <ol className="space-y-1.5 list-decimal list-inside">
                  {blogAuthority.actionPlan.map((step, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-700 bg-white/60 rounded-lg px-3 py-2"
                    >
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Community Insights */}
            {blogAuthority.communityInsights.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-lime-200">
                <h4 className="text-sm font-semibold text-gray-600">Topluluk Icgoruler</h4>
                <div className="space-y-1.5">
                  {blogAuthority.communityInsights.map((insight, i) => (
                    <blockquote
                      key={i}
                      className="text-sm text-gray-700 bg-white/60 rounded-lg px-3 py-2 border-l-4 border-lime-300 italic"
                    >
                      {insight}
                    </blockquote>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Teknik Detaylar */}
      <TechnicalDetails>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Icerik Istatistikleri</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Kelime Sayisi" value={crawl.content.wordCount} />
            <InfoRow label="Paragraf Sayisi" value={crawl.content.paragraphCount} />
            <InfoRow
              label="Icerik/Kod Orani"
              value={`%${(crawl.content.contentToCodeRatio * 100).toFixed(1)}`}
            />
            <InfoRow label="Toplam Gorsel" value={crawl.images.total} />
            <InfoRow
              label="Alt Eksik Gorsel"
              value={`${crawl.images.totalMissingAlt}/${crawl.images.total}`}
            />
          </CardContent>
        </Card>

        {content.details.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Icerik Skor Detaylari</p>
            {content.details.map((d, i) => (
              <div
                key={i}
                className="text-sm text-muted-foreground pl-3 border-l-2 border-muted"
              >
                {d}
              </div>
            ))}
          </div>
        )}

        {blogAuthority && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Blog Otorite Detaylari</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {subScoreKeys.map(({ key, label }) => {
                const sub = (
                  blogAuthority.categories as Record<string, AuthoritySubScore>
                )[key];
                if (!sub) return null;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{sub.label || label}</span>
                      <span className="font-bold">
                        {sub.score}/{sub.max}
                      </span>
                    </div>
                    {sub.details.length > 0 && (
                      <ul className="space-y-0.5 pl-3">
                        {sub.details.map((detail, i) => (
                          <li
                            key={i}
                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                          >
                            <span
                              className={`mt-0.5 shrink-0 ${
                                detail.includes("bulunamadi") ||
                                detail.includes("yok") ||
                                detail.includes("zayif") ||
                                detail.includes("dusuk")
                                  ? "text-red-400"
                                  : "text-green-400"
                              }`}
                            >
                              ●
                            </span>
                            {detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </TechnicalDetails>
      </div>

      {/* Sağ: Görevler */}
      <div className="lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold mb-3">Yapılacaklar</h2>
        <TaskList tasks={categoryTasks} onToggle={updateTaskStatus} emptyMessage="İçerik ile ilgili görev yok." />
      </div>
    </div>
  );
}
