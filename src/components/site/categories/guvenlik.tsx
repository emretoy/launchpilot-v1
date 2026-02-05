"use client";

import { useSiteContext } from "@/components/site/site-context";
import { TaskList } from "@/components/site/task-list";
import { TechnicalDetails } from "@/components/site/technical-details";
import { InfoRow, GradeBadge } from "@/components/shared/info-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function GuvenlikPage() {
  const { data, tasks, updateTaskStatus } = useSiteContext();

  if (!data) return <div className="text-muted-foreground py-8">Veri yükleniyor...</div>;

  const { scoring, ssl, securityHeaders, safeBrowsing, dns, crawl } = data;
  const sec = scoring.categories.security;
  const dt = scoring.categories.domainTrust;
  const avgScore = Math.round((sec.score + dt.score) / 2);
  const scoreClr = avgScore >= 80 ? "text-green-600" : avgScore >= 60 ? "text-yellow-600" : avgScore >= 40 ? "text-orange-600" : "text-red-600";
  const categoryTasks = tasks.filter((t) => t.category === "guvenlik");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
      {/* Sol: İçerik */}
      <div className="space-y-6 min-w-0">
      <div className="flex items-center gap-4">
        <span className="text-4xl">🛡️</span>
        <div>
          <h1 className="text-2xl font-bold">Güvenlik</h1>
          <p className={`text-3xl font-bold ${scoreClr}`}>{avgScore}/100</p>
          <p className="text-sm text-muted-foreground mt-1">
            SSL, güvenlik başlıkları ve domain güvenilirliği
          </p>
        </div>
      </div>

      {/* Hızlı Bakış */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">HTTPS</p>
          <p className={`text-sm font-semibold ${crawl.security.isHttps ? "text-green-600" : "text-red-600"}`}>
            {crawl.security.isHttps ? "Aktif" : "Yok"}
          </p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">SSL</p>
          <p className={`text-sm font-semibold ${ssl.valid ? "text-green-600" : "text-red-600"}`}>
            {ssl.valid ? "Geçerli" : "Sorunlu"}
          </p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">Güvenlik Notu</p>
          <GradeBadge grade={securityHeaders.grade} />
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">Safe Browsing</p>
          <p className={`text-sm font-semibold ${safeBrowsing.safe ? "text-green-600" : "text-red-600"}`}>
            {safeBrowsing.safe ? "Güvenli" : "Tehdit Var"}
          </p>
        </div>
      </div>

      {/* Teknik Detaylar */}
      <TechnicalDetails>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">SSL Sertifikası</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Geçerli" value={ssl.valid ? "Evet" : "Hayır"} />
            <InfoRow label="Sağlayıcı" value={ssl.issuer} />
            <InfoRow label="Bitiş Tarihi" value={ssl.expiresAt ? new Date(ssl.expiresAt).toLocaleDateString("tr-TR") : "—"} />
            <InfoRow label="Kalan Gün" value={ssl.daysUntilExpiry !== null ? `${ssl.daysUntilExpiry} gün` : "—"} />
            <InfoRow label="Protokol" value={ssl.protocol} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Güvenlik Başlıkları</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Not" value={<GradeBadge grade={securityHeaders.grade} />} />
            {securityHeaders.headers.map((h) => (
              <InfoRow key={h.name} label={h.name} value={h.present ? "✓ Mevcut" : "✗ Eksik"} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">DNS & Domain</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="SPF" value={dns.hasSPF ? "Var" : "Yok"} />
            <InfoRow label="DMARC" value={dns.hasDMARC ? "Var" : "Yok"} />
            <InfoRow label="Domain Yaşı" value={data.domainInfo.domainAge ? `${Math.round(data.domainInfo.domainAge / 365)} yıl` : "—"} />
            <InfoRow label="Registrar" value={data.domainInfo.registrar} />
          </CardContent>
        </Card>

        {sec.details.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Güvenlik Skor Detayları</p>
            {sec.details.map((d, i) => (
              <div key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-muted">{d}</div>
            ))}
          </div>
        )}
      </TechnicalDetails>
      </div>

      {/* Sağ: Görevler */}
      <div className="lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold mb-3">Yapılacaklar</h2>
        <TaskList tasks={categoryTasks} onToggle={updateTaskStatus} emptyMessage="Güvenlik ile ilgili görev yok." />
      </div>
    </div>
  );
}
