"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FullAnalysisResult } from "@/lib/types";

type HealthStatus = "ok" | "warn" | "fail";

function HealthIcon({ status }: { status: HealthStatus }) {
  if (status === "ok") return <span className="text-green-600 text-base leading-none">✓</span>;
  if (status === "warn") return <span className="text-yellow-600 text-base leading-none">⚠</span>;
  return <span className="text-red-600 text-base leading-none">✗</span>;
}

function HealthRow({ label, status, detail }: { label: string; status: HealthStatus; detail: string }) {
  const bg = status === "ok" ? "bg-green-50" : status === "warn" ? "bg-yellow-50" : "bg-red-50";
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${bg}`}>
      <HealthIcon status={status} />
      <span className="text-sm font-medium w-28 shrink-0">{label}</span>
      <span className="text-sm text-muted-foreground truncate">{detail}</span>
    </div>
  );
}

export function HealthCard({ data }: { data: FullAnalysisResult }) {
  const { crawl, pageSpeed, ssl, pageAnalysis, htmlValidation } = data;

  // SSL
  const sslOk = crawl.security.isHttps && ssl.valid;
  const sslStatus: HealthStatus = sslOk ? "ok" : crawl.security.isHttps ? "warn" : "fail";
  const sslDetail = sslOk ? "HTTPS aktif, sertifika geçerli" : crawl.security.isHttps ? "HTTPS var ama sertifika sorunu" : "HTTPS yok";

  // Indexlenme
  const robotsMeta = crawl.metaSEO.robots?.toLowerCase() || "";
  const hasNoIndex = robotsMeta.includes("noindex");
  const indexStatus: HealthStatus = hasNoIndex ? "fail" : "ok";
  const indexDetail = hasNoIndex ? "noindex aktif — arama motorları görmez" : "Indexlenebilir durumda";

  // İçerik
  const wc = crawl.content.wordCount;
  const contentStatus: HealthStatus = wc < 50 ? "fail" : wc < 150 ? "warn" : "ok";
  const contentDetail = wc < 50 ? `${wc} kelime — çok az` : wc < 150 ? `${wc} kelime — zayıf` : `${wc} kelime`;

  // TTFB
  const ttfb = pageSpeed.webVitals.ttfb;
  const ttfbStatus: HealthStatus = ttfb === null ? "warn" : ttfb <= 800 ? "ok" : ttfb <= 1800 ? "warn" : "fail";
  const ttfbDetail = ttfb === null ? "TTFB verisi yok" : `TTFB ${ttfb}ms${ttfb <= 800 ? " — hızlı" : ttfb <= 1800 ? " — orta" : " — yavaş"}`;

  // Title & Meta
  const hasTitle = !!crawl.basicInfo.title;
  const hasMetaDesc = !!crawl.basicInfo.metaDescription;
  const metaStatus: HealthStatus = hasTitle && hasMetaDesc ? "ok" : hasTitle || hasMetaDesc ? "warn" : "fail";
  const metaDetail = hasTitle && hasMetaDesc ? "İkisi de tanımlı" : hasTitle ? "Meta description eksik" : "Title eksik";

  // HTML
  const htmlErrors = htmlValidation.errors;
  const htmlStatus: HealthStatus = htmlErrors === 0 ? "ok" : htmlErrors <= 10 ? "warn" : "fail";
  const htmlDetail = htmlErrors === 0 ? "Hata yok" : `${htmlErrors} HTML hatası`;

  // Sitemap
  const sitemapStatus: HealthStatus = crawl.technical.hasSitemap ? "ok" : "warn";
  const sitemapDetail = crawl.technical.hasSitemap
    ? `Mevcut${crawl.technical.sitemapPageCount !== null ? ` (${crawl.technical.sitemapPageCount} sayfa)` : ""}`
    : "Sitemap bulunamadı";

  // Cookie
  const cookieOk = pageAnalysis.cookieConsent.detected;
  const cookieStatus: HealthStatus = cookieOk ? "ok" : "warn";
  const cookieDetail = cookieOk ? pageAnalysis.cookieConsent.patterns[0] : "Banner bulunamadı";

  const statuses = [sslStatus, indexStatus, contentStatus, ttfbStatus, metaStatus, htmlStatus, sitemapStatus, cookieStatus];
  const failCount = statuses.filter((s) => s === "fail").length;
  const warnCount = statuses.filter((s) => s === "warn").length;

  let verdict: string;
  let verdictColor: string;
  if (failCount === 0 && warnCount === 0) {
    verdict = "Sağlıklı"; verdictColor = "text-green-700 bg-green-100";
  } else if (failCount === 0) {
    verdict = "Genel olarak iyi — dikkat gerektiren noktalar var"; verdictColor = "text-yellow-700 bg-yellow-100";
  } else {
    verdict = `${failCount} sorun tespit edildi`; verdictColor = "text-red-700 bg-red-100";
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Site Sağlık Kartı</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <HealthRow label="SSL" status={sslStatus} detail={sslDetail} />
        <HealthRow label="Indexlenme" status={indexStatus} detail={indexDetail} />
        <HealthRow label="İçerik" status={contentStatus} detail={contentDetail} />
        <HealthRow label="Sunucu Hızı" status={ttfbStatus} detail={ttfbDetail} />
        <HealthRow label="Title & Meta" status={metaStatus} detail={metaDetail} />
        <HealthRow label="HTML Kalitesi" status={htmlStatus} detail={htmlDetail} />
        <HealthRow label="Sitemap" status={sitemapStatus} detail={sitemapDetail} />
        <HealthRow label="Cookie Uyumu" status={cookieStatus} detail={cookieDetail} />
        <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium text-center ${verdictColor}`}>
          {verdict}
        </div>
      </CardContent>
    </Card>
  );
}
