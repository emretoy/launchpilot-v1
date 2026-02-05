"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverallScoreCard, CategoryScoreCard } from "@/components/score-card";
import { supabase } from "@/lib/supabase";
import { normalizeRecKey } from "@/lib/treatment-plan";
import type { FullAnalysisResult, CategoryScore, Recommendation, ScanHistoryEntry, ValidationSummary, TreatmentPlan, TreatmentPhase, WebsiteDNA, AuthoritySubScore } from "@/lib/types";

// ── Doğrulama Bileşenleri ──
function ValidationSummaryBar({ summary }: { summary: ValidationSummary }) {
  const [showDetails, setShowDetails] = useState(false);
  const score = summary.verificationScore;
  const barColor =
    score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : score >= 40 ? "bg-orange-500" : "bg-red-500";

  // Gruplandırma: DNA, Scraper, Skor
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
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Güven Skoru</span>
              <span className="font-semibold">{score}/100</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          {/* İstatistikler */}
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

          {/* Detaylı kontrol sonuçları */}
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

function VerificationBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-medium" title="Doğrulandı">
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-yellow-600 font-medium" title="Doğrulanamadı">
      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    </span>
  );
}

// ── DNA Profil Bileşenleri ──
const siteTypeLabels: Record<string, string> = {
  "e-commerce": "E-Ticaret", blog: "Blog", corporate: "Kurumsal", saas: "SaaS",
  portfolio: "Portfolyo", "landing-page": "Landing Page", forum: "Forum",
  news: "Haber", directory: "Rehber", education: "Eğitim", unknown: "Belirsiz",
};

const maturityLabels: Record<string, string> = {
  newborn: "Yeni Doğmuş", young: "Genç", growing: "Büyüyen", mature: "Olgun", veteran: "Kıdemli",
};

const scaleLabels: Record<string, string> = {
  "single-page": "Tek Sayfa", small: "Küçük", medium: "Orta", large: "Büyük", enterprise: "Kurumsal",
};

const audienceLabels: Record<string, string> = {
  B2B: "B2B (İşletmeler)", B2C: "B2C (Tüketiciler)", both: "B2B + B2C", unknown: "Belirsiz",
};

const marketLabels: Record<string, string> = {
  local: "Yerel", national: "Ulusal", global: "Global", unknown: "Belirsiz",
};

const revenueLabels: Record<string, string> = {
  "e-commerce": "E-Ticaret", advertising: "Reklam", saas: "SaaS Abonelik",
  "lead-generation": "Müşteri Adayı", "content-media": "İçerik/Medya",
  "non-profit": "Kar Amacı Gütmeyen", unknown: "Belirsiz",
};

const contactLabels: Record<string, string> = {
  phone: "Telefon", email: "E-posta", form: "Form", chat: "Canlı Sohbet", whatsapp: "WhatsApp",
};

function DNAMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center px-3 py-2 bg-white/40 rounded-lg">
      <p className="text-xs text-indigo-600 font-medium">{label}</p>
      <p className="text-sm font-semibold text-indigo-900">{value}</p>
    </div>
  );
}

function DNADetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/60 rounded-xl border border-indigo-100 p-4">
      <h4 className="text-sm font-semibold text-indigo-800 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function DNAInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-indigo-50 last:border-0">
      <span className="text-sm text-indigo-600/70">{label}</span>
      <span className="text-sm font-medium text-indigo-900 text-right max-w-[60%]">{value || <span className="text-indigo-300">-</span>}</span>
    </div>
  );
}

function DNABadge({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      active ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
    }`}>
      {children}
    </span>
  );
}

function DNABoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-indigo-50 last:border-0">
      <span className="text-sm text-indigo-600/70">{label}</span>
      {value ? (
        <span className="text-green-600 text-sm font-medium">Var</span>
      ) : (
        <span className="text-gray-400 text-sm">Yok</span>
      )}
    </div>
  );
}

function DNAProfileSection({ dna }: { dna: WebsiteDNA }) {
  return (
    <section>
      {/* DNA Hero Kartı */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-cyan-50 border border-indigo-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">&#129516;</span>
          <h2 className="text-xl font-bold text-indigo-900">DNA Profili</h2>
          <span className="text-sm text-indigo-500 ml-1">Bu Site Kim?</span>
        </div>

        {/* Brand Name + Type + Industry */}
        <div className="text-center mb-5">
          <h3 className="text-2xl font-bold text-indigo-900 mb-2">{dna.identity.brandName}</h3>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 text-sm px-3 py-1">
              {siteTypeLabels[dna.identity.siteType] || dna.identity.siteType}
            </Badge>
            {dna.identity.industry && (
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-sm px-3 py-1">
                {dna.identity.industry}
              </Badge>
            )}
            {dna.identity.siteTypeConfidence < 50 && (
              <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs">
                Tahmini
              </Badge>
            )}
          </div>
        </div>

        {/* 4 Mini Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <DNAMiniStat label="Hedef Kitle" value={audienceLabels[dna.targetMarket.audience] || dna.targetMarket.audience} />
          <DNAMiniStat label="Pazar" value={marketLabels[dna.targetMarket.marketScope] || dna.targetMarket.marketScope} />
          <DNAMiniStat label="Olgunluk" value={`${maturityLabels[dna.maturity.level] || dna.maturity.level} (${dna.maturity.score})`} />
          <DNAMiniStat label="Ölçek" value={`${scaleLabels[dna.scale.level] || dna.scale.level}${dna.scale.estimatedPages ? ` (~${dna.scale.estimatedPages})` : ""}`} />
        </div>
      </div>

      {/* Detay Grid (2x2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Teknoloji DNA'sı */}
        <DNADetailCard title="Teknoloji DNA'sı">
          <DNAInfoRow label="Platform" value={dna.techStack.platform || "Tespit edilemedi"} />
          <DNAInfoRow label="JS Framework" value={dna.techStack.jsFramework || "Tespit edilemedi"} />
          <DNAInfoRow label="Hosting" value={dna.techStack.hosting || "Tespit edilemedi"} />
          <DNAInfoRow label="CDN" value={dna.techStack.cdnProvider || "Tespit edilemedi"} />
          <DNAInfoRow label="E-posta" value={dna.techStack.emailProvider || "Tespit edilemedi"} />
          {dna.techStack.marketingTools.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {dna.techStack.marketingTools.map((tool, i) => (
                <DNABadge key={i}>{tool}</DNABadge>
              ))}
            </div>
          )}
        </DNADetailCard>

        {/* İş Modeli & İletişim */}
        <DNADetailCard title="İş Modeli & İletişim">
          <DNAInfoRow label="Gelir Modeli" value={revenueLabels[dna.revenueModel.primary] || dna.revenueModel.primary} />
          <DNAInfoRow
            label="İletişim"
            value={
              dna.contact.methods.length > 0
                ? dna.contact.methods.map(m => contactLabels[m] || m).join(", ")
                : "Tespit edilemedi"
            }
          />
          <DNAInfoRow label="Fiziksel Adres" value={dna.contact.hasPhysicalAddress ? "Var" : "Yok"} />
          {dna.contact.socialPlatforms.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {dna.contact.socialPlatforms.map((p, i) => (
                <DNABadge key={i}>{p}</DNABadge>
              ))}
            </div>
          )}
        </DNADetailCard>

        {/* Hukuki & Güven */}
        <DNADetailCard title="Hukuki & Güven">
          <DNABoolRow label="Gizlilik Politikası" value={dna.legalTrust.hasPrivacyPolicy} />
          <DNABoolRow label="Kullanım Koşulları" value={dna.legalTrust.hasTerms} />
          <DNABoolRow label="KVKK Uyumu" value={dna.legalTrust.hasKVKK} />
          <DNABoolRow label="Cookie Consent" value={dna.legalTrust.hasCookieConsent} />
          {dna.legalTrust.sslDetails && (
            <DNAInfoRow label="SSL" value={dna.legalTrust.sslDetails} />
          )}
        </DNADetailCard>

        {/* İçerik Yapısı */}
        <DNADetailCard title="İçerik Yapısı">
          <DNABoolRow label="Blog" value={dna.contentStructure.hasBlog} />
          <DNABoolRow label="Üyelik Sistemi" value={dna.contentStructure.hasAuth} />
          <DNABoolRow label="Site İçi Arama" value={dna.contentStructure.hasSearch} />
          <DNABoolRow label="Mobil Uygulama" value={dna.contentStructure.hasMobileApp} />
          <DNABoolRow label="Newsletter" value={dna.contentStructure.hasNewsletter} />
          <DNABoolRow label="E-Ticaret" value={dna.contentStructure.hasEcommerce} />
        </DNADetailCard>
      </div>

      {/* AI DNA Sentezi */}
      {(dna.aiSynthesis.summary || dna.aiSynthesis.sophisticationScore !== null) && (
        <div className="rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200 p-5 mb-6">
          <h4 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">AI</span>
            DNA Sentezi
          </h4>
          {dna.aiSynthesis.summary && (
            <p className="text-sm leading-relaxed text-indigo-900 mb-4">{dna.aiSynthesis.summary}</p>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            {dna.aiSynthesis.sophisticationScore !== null && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/60 rounded-lg">
                <span className="text-xs text-indigo-600">Dijital Gelişmişlik</span>
                <span className="text-xl font-bold text-indigo-900">{dna.aiSynthesis.sophisticationScore}</span>
                <span className="text-xs text-indigo-400">/100</span>
              </div>
            )}
            {dna.aiSynthesis.growthStage && (
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-sm px-3 py-1.5">
                {dna.aiSynthesis.growthStage}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Ayırıcı: DNA → Sağlık geçişi */}
      <div className="relative flex items-center justify-center py-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-indigo-200" />
        </div>
        <span className="relative bg-white px-4 text-sm text-indigo-400">
          DNA tespit edildi. Simdi saglik durumuna bakalim...
        </span>
      </div>
    </section>
  );
}

// ── Site Sağlık Kartı (11 Hayati Belirti) ──
type HealthStatus = "ok" | "warn" | "fail";

function HealthIcon({ status }: { status: HealthStatus }) {
  if (status === "ok") return <span className="text-green-600 text-base leading-none">&#10003;</span>;
  if (status === "warn") return <span className="text-yellow-600 text-base leading-none">&#9888;</span>;
  return <span className="text-red-600 text-base leading-none">&#10007;</span>;
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

function SiteHealthCard({ data }: { data: FullAnalysisResult }) {
  const { crawl, pageSpeed, ssl, pageAnalysis, htmlValidation } = data;
  const checks = data.validationSummary?.checks || [];
  const findCheck = (field: string) => checks.find((c) => c.field === field);

  // 1. Erişim
  const httpCheck = findCheck("httpStatus");
  const accessStatus: HealthStatus = httpCheck ? (httpCheck.verified ? "ok" : "fail") : "ok";
  const accessDetail = httpCheck?.reason || "Kontrol edilmedi";

  // 2. SSL
  const sslOk = crawl.security.isHttps && ssl.valid;
  const sslStatus: HealthStatus = sslOk ? "ok" : crawl.security.isHttps ? "warn" : "fail";
  const sslDetail = sslOk
    ? "HTTPS aktif, sertifika geçerli"
    : crawl.security.isHttps
      ? "HTTPS var ama sertifika sorunu"
      : "HTTPS yok — güvensiz bağlantı";

  // 3. Indexlenme
  const robotsMeta = crawl.metaSEO.robots?.toLowerCase() || "";
  const hasNoIndex = robotsMeta.includes("noindex");
  const robotsTxt = crawl.technical.robotsTxtContent?.toLowerCase() || "";
  const disallowAll = robotsTxt.includes("disallow: /") && !robotsTxt.includes("disallow: /.");
  const indexStatus: HealthStatus = hasNoIndex || disallowAll ? "fail" : "ok";
  const indexDetail = hasNoIndex
    ? "noindex aktif — arama motorları görmez"
    : disallowAll
      ? "robots.txt tüm tarayıcıları engelliyor"
      : "Indexlenebilir durumda";

  // 4. İçerik
  const wc = crawl.content.wordCount;
  const contentStatus: HealthStatus = wc < 50 ? "fail" : wc < 150 ? "warn" : "ok";
  const contentDetail =
    wc < 50 ? `${wc} kelime — henüz beslenmemiş`
    : wc < 150 ? `${wc} kelime — zayıf içerik`
    : `${wc} kelime`;

  // 5. Sunucu Hızı (TTFB)
  const ttfb = pageSpeed.webVitals.ttfb;
  const ttfbStatus: HealthStatus =
    ttfb === null ? "warn" : ttfb <= 800 ? "ok" : ttfb <= 1800 ? "warn" : "fail";
  const ttfbDetail =
    ttfb === null ? "TTFB verisi yok"
    : `TTFB ${ttfb}ms${ttfb <= 800 ? " — hızlı" : ttfb <= 1800 ? " — orta" : " — yavaş"}`;

  // 6. Cookie Uyumu
  const cookieOk = pageAnalysis.cookieConsent.detected;
  const cookieStatus: HealthStatus = cookieOk ? "ok" : "warn";
  const cookieDetail = cookieOk
    ? pageAnalysis.cookieConsent.patterns[0]
    : "Banner bulunamadı";

  // 7. Veri Güveni
  const vScore = data.validationSummary?.verificationScore ?? null;
  const trustStatus: HealthStatus =
    vScore === null ? "warn" : vScore >= 70 ? "ok" : vScore >= 40 ? "warn" : "fail";
  const trustDetail =
    vScore === null ? "Doğrulama yapılmadı" : `${vScore}/100`;

  // 8. Sitemap
  const sitemapStatus: HealthStatus = crawl.technical.hasSitemap ? "ok" : "warn";
  const sitemapDetail = crawl.technical.hasSitemap
    ? `Mevcut${crawl.technical.sitemapPageCount !== null ? ` (${crawl.technical.sitemapPageCount} sayfa)` : ""}`
    : "Sitemap bulunamadı";

  // 9. Canonical URL
  const canonicalStatus: HealthStatus = crawl.metaSEO.canonical ? "ok" : "warn";
  const canonicalDetail = crawl.metaSEO.canonical
    ? "Tanımlı"
    : "Canonical URL eksik";

  // 10. Title & Meta Desc
  const hasTitle = !!crawl.basicInfo.title;
  const hasMetaDesc = !!crawl.basicInfo.metaDescription;
  const metaStatus: HealthStatus = hasTitle && hasMetaDesc ? "ok" : hasTitle || hasMetaDesc ? "warn" : "fail";
  const metaDetail = hasTitle && hasMetaDesc
    ? "İkisi de tanımlı"
    : hasTitle
      ? "Meta description eksik"
      : hasMetaDesc
        ? "Title eksik"
        : "İkisi de eksik";

  // 11. HTML Kalitesi
  const htmlErrors = htmlValidation.errors;
  const htmlStatus: HealthStatus = htmlErrors === 0 ? "ok" : htmlErrors <= 10 ? "warn" : "fail";
  const htmlDetail = htmlErrors === 0
    ? "Hata yok"
    : `${htmlErrors} HTML hatası`;

  // Genel durum mesajı
  const statuses = [
    accessStatus, sslStatus, indexStatus, contentStatus, ttfbStatus,
    cookieStatus, trustStatus, sitemapStatus, canonicalStatus, metaStatus, htmlStatus,
  ];
  const failCount = statuses.filter((s) => s === "fail").length;
  const warnCount = statuses.filter((s) => s === "warn").length;

  let verdict: string;
  let verdictColor: string;
  if (failCount === 0 && warnCount === 0) {
    verdict = "Sağlıklı";
    verdictColor = "text-green-700 bg-green-100";
  } else if (failCount === 0) {
    verdict = "Genel olarak iyi — dikkat gerektiren noktalar var";
    verdictColor = "text-yellow-700 bg-yellow-100";
  } else if (hasNoIndex) {
    verdict = "Karantinada — arama motorlarından gizli";
    verdictColor = "text-red-700 bg-red-100";
  } else if (!sslOk) {
    verdict = "Güvenlik riski var";
    verdictColor = "text-red-700 bg-red-100";
  } else if (wc < 50) {
    verdict = "Sağlıklı ama beslenmeli";
    verdictColor = "text-orange-700 bg-orange-100";
  } else {
    verdict = `${failCount} sorun tespit edildi`;
    verdictColor = "text-red-700 bg-red-100";
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Site Sağlık Kartı</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <HealthRow label="Erişim" status={accessStatus} detail={accessDetail} />
        <HealthRow label="SSL" status={sslStatus} detail={sslDetail} />
        <HealthRow label="Indexlenme" status={indexStatus} detail={indexDetail} />
        <HealthRow label="İçerik" status={contentStatus} detail={contentDetail} />
        <HealthRow label="Sunucu Hızı" status={ttfbStatus} detail={ttfbDetail} />
        <HealthRow label="Cookie Uyumu" status={cookieStatus} detail={cookieDetail} />
        <HealthRow label="Veri Güveni" status={trustStatus} detail={trustDetail} />
        <HealthRow label="Sitemap" status={sitemapStatus} detail={sitemapDetail} />
        <HealthRow label="Canonical" status={canonicalStatus} detail={canonicalDetail} />
        <HealthRow label="Title & Meta" status={metaStatus} detail={metaDetail} />
        <HealthRow label="HTML Kalitesi" status={htmlStatus} detail={htmlDetail} />

        <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium text-center ${verdictColor}`}>
          {verdict}
        </div>
      </CardContent>
    </Card>
  );
}

// ── AI Özeti Kartı ──
function AISummaryCard({ summary, prompt }: { summary: string; prompt?: string | null }) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">AI</span>
          AI Analiz
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{summary}</p>

        {prompt && (
          <>
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="text-xs text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1"
            >
              <span className={`transition-transform ${showPrompt ? "rotate-90" : ""}`}>&#9654;</span>
              Kullanılan Prompt
            </button>
            {showPrompt && (
              <pre className="text-xs bg-white/80 border border-purple-100 rounded-lg p-3 whitespace-pre-wrap break-words text-gray-600 max-h-64 overflow-y-auto">
                {prompt}
              </pre>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Yardımcı Bileşenler ──
function MetricBadge({ value, good, mid }: { value: number | null; good: number; mid: number }) {
  if (value === null) return <Badge variant="secondary">N/A</Badge>;
  if (value <= good) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">İyi</Badge>;
  if (value <= mid) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Orta</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Kötü</Badge>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] truncate">
        {value || <span className="text-muted-foreground">-</span>}
      </span>
    </div>
  );
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <Badge variant="secondary">N/A</Badge>;
  const colors: Record<string, string> = {
    "A+": "bg-green-100 text-green-800",
    A: "bg-green-100 text-green-800",
    B: "bg-lime-100 text-lime-800",
    C: "bg-yellow-100 text-yellow-800",
    D: "bg-orange-100 text-orange-800",
    F: "bg-red-100 text-red-800",
  };
  return <Badge className={`${colors[grade] || "bg-gray-100 text-gray-800"} hover:opacity-90`}>{grade}</Badge>;
}

// Yardımcı: Belirli bir field için doğrulama durumunu bul
function getCheck(data: FullAnalysisResult, field: string): boolean | null {
  if (!data.validationSummary) return null;
  const check = data.validationSummary.checks.find((c) => c.field === field);
  return check ? check.verified : null;
}

// ── Section Header ──
const sectionColors: Record<string, string> = {
  overview: "bg-blue-500",
  performance: "bg-orange-500",
  seo: "bg-emerald-500",
  security: "bg-red-500",
  technology: "bg-purple-500",
  onlinePresence: "bg-cyan-500",
  seoAuthority: "bg-violet-500",
  geoAuthority: "bg-teal-500",
  aeoAuthority: "bg-rose-500",
  backlinkAuthority: "bg-amber-500",
  blogAuthority: "bg-lime-500",
  conclusion: "bg-indigo-500",
};

function SectionHeader({ title, accent, scores }: {
  title: string;
  accent: string;
  scores?: CategoryScore[];
}) {
  const accentColor = sectionColors[accent] || "bg-gray-500";

  return (
    <div className="flex items-center gap-4 pb-3 mb-4 border-b border-border">
      <div className={`w-1 self-stretch rounded-full ${accentColor}`} />
      <h2 className="text-xl font-bold flex-1">{title}</h2>
      {scores && scores.length > 0 && (
        <div className="flex items-center gap-2">
          {scores.map((s) => (
            <CategoryScoreCard key={s.label} category={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mini Skor Dairesi (Section başlıkları için) ──
function MiniScore({ score, color, label }: { score: number; color: CategoryScore["color"]; label: string }) {
  const colorMap: Record<CategoryScore["color"], string> = {
    green: "text-green-600 border-green-200 bg-green-50",
    lime: "text-lime-600 border-lime-200 bg-lime-50",
    yellow: "text-yellow-600 border-yellow-200 bg-yellow-50",
    orange: "text-orange-600 border-orange-200 bg-orange-50",
    red: "text-red-600 border-red-200 bg-red-50",
  };
  const c = colorMap[color];

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${c}`}>
      <span className="text-sm font-bold">{score}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

// ── Ana Bileşen: Tab'lı Analiz Raporu ──
export function AnalysisResultView({ data }: { data: FullAnalysisResult }) {
  const { crawl, pageSpeed, ssl, domainInfo, securityHeaders, safeBrowsing, dns, htmlValidation, pageAnalysis, scoring } = data;

  // Conditional tab'lar
  const onlinePresenceVisible = !!(data.onlinePresence && scoring.categories.onlinePresence && !scoring.categories.onlinePresence.noData);
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList variant="line" className="w-full justify-start overflow-x-auto flex-nowrap mb-6 border-b border-border pb-0 sticky top-0 bg-white z-10">
        <TabsTrigger value="overview">Genel Bakis</TabsTrigger>
        <TabsTrigger value="performance">Performans</TabsTrigger>
        <TabsTrigger value="seo">SEO & Icerik</TabsTrigger>
        <TabsTrigger value="security">Guvenlik</TabsTrigger>
        <TabsTrigger value="technology">Teknoloji</TabsTrigger>
        {onlinePresenceVisible && <TabsTrigger value="digital">Dijital Varlik</TabsTrigger>}
        <TabsTrigger value="authority">SEO Otorite</TabsTrigger>
        <TabsTrigger value="geo">GEO Otorite</TabsTrigger>
        <TabsTrigger value="aeo">AEO Otorite</TabsTrigger>
        <TabsTrigger value="backlink">Backlink</TabsTrigger>
        <TabsTrigger value="blog">Blog</TabsTrigger>
        <TabsTrigger value="conclusion">Sonuc</TabsTrigger>
      </TabsList>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 1: GENEL BAKIŞ
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="overview" className="space-y-6">
        {/* DNA Profili */}
        {data.dna && <DNAProfileSection dna={data.dna} />}

        <section>
          <SectionHeader title="Genel Bakış" accent="overview" />

          {/* Site başlığı + URL + süre */}
          <div className="text-center space-y-2 mb-6">
            <h1 className="text-2xl font-bold">{crawl.basicInfo.title || crawl.basicInfo.url}</h1>
            <p className="text-muted-foreground text-sm">{crawl.basicInfo.finalUrl}</p>
            <p className="text-xs text-muted-foreground">
              Analiz süresi: {(data.duration / 1000).toFixed(1)}s
            </p>
          </div>

          {/* Genel Skor Dairesi */}
          <div className="flex justify-center mb-6">
            <OverallScoreCard score={scoring.overall} color={scoring.overallColor} />
          </div>

          {/* Site Sağlık Kartı (11 hayati belirti) */}
          <div className="mb-6">
            <SiteHealthCard data={data} />
          </div>

          {/* AI Özeti */}
          {data.aiSummary && (
            <AISummaryCard summary={data.aiSummary} prompt={data.aiPrompt} />
          )}

          {/* 9 Kategori Skor Grid (küçük daireler) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CategoryScoreCard category={scoring.categories.performance} />
            <CategoryScoreCard category={scoring.categories.seo} />
            <CategoryScoreCard category={scoring.categories.security} />
            <CategoryScoreCard category={scoring.categories.accessibility} />
            <CategoryScoreCard category={scoring.categories.bestPractices} />
            <CategoryScoreCard category={scoring.categories.domainTrust} />
            <CategoryScoreCard category={scoring.categories.content} />
            <CategoryScoreCard category={scoring.categories.technology} />
            {scoring.categories.onlinePresence && !scoring.categories.onlinePresence.noData && (
              <CategoryScoreCard category={scoring.categories.onlinePresence} />
            )}
          </div>
        </section>
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 2: PERFORMANS & HIZ
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="performance" className="space-y-6">
        <section>
          <SectionHeader title="Performans & Hız" accent="performance" />
          <div className="flex flex-wrap gap-2 mb-4">
            <MiniScore score={scoring.categories.performance.score} color={scoring.categories.performance.color} label="Performans" />
          </div>

          {/* Core Web Vitals */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Core Web Vitals</CardTitle>
            </CardHeader>
            <CardContent>
              {pageSpeed.error ? (
                <p className="text-sm text-muted-foreground">PageSpeed verisi alınamadı: {pageSpeed.error}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">LCP</p>
                      <p className="text-xs text-muted-foreground">Largest Contentful Paint</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">
                        {pageSpeed.webVitals.lcp ? `${(pageSpeed.webVitals.lcp / 1000).toFixed(1)}s` : "N/A"}
                      </span>
                      <MetricBadge value={pageSpeed.webVitals.lcp} good={2500} mid={4000} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">CLS</p>
                      <p className="text-xs text-muted-foreground">Cumulative Layout Shift</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">
                        {pageSpeed.webVitals.cls !== null ? pageSpeed.webVitals.cls.toFixed(3) : "N/A"}
                      </span>
                      <MetricBadge value={pageSpeed.webVitals.cls !== null ? pageSpeed.webVitals.cls * 1000 : null} good={100} mid={250} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">INP</p>
                      <p className="text-xs text-muted-foreground">Interaction to Next Paint</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">
                        {pageSpeed.webVitals.inp ? `${pageSpeed.webVitals.inp}ms` : "N/A"}
                      </span>
                      <MetricBadge value={pageSpeed.webVitals.inp} good={200} mid={500} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">TTFB</p>
                      <p className="text-xs text-muted-foreground">Time to First Byte</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">
                        {pageSpeed.webVitals.ttfb ? `${pageSpeed.webVitals.ttfb}ms` : "N/A"}
                      </span>
                      <MetricBadge value={pageSpeed.webVitals.ttfb} good={800} mid={1800} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performans Detayları */}
          {scoring.categories.performance.details.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Performans Detayları</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {scoring.categories.performance.details.map((detail, i) => (
                    <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-orange-200">
                      {detail}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </section>
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 3: SEO & KEŞFEDİLEBİLİRLİK
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="seo" className="space-y-6">
        <section>
          <SectionHeader title="SEO & Keşfedilebilirlik" accent="seo" />
          <div className="flex flex-wrap gap-2 mb-4">
            <MiniScore score={scoring.categories.seo.score} color={scoring.categories.seo.color} label="SEO" />
            <MiniScore score={scoring.categories.content.score} color={scoring.categories.content.color} label="İçerik" />
          </div>

          {/* SEO Temel Bilgileri */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Temel SEO Bilgileri</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Başlık" value={
                  <span className="flex items-center gap-1">
                    {crawl.basicInfo.title || "-"}
                    {getCheck(data, "title") !== null && <VerificationBadge verified={getCheck(data, "title")!} />}
                  </span>
                } />
                <InfoRow
                  label="Meta Açıklama"
                  value={
                    <span className="flex items-center gap-1">
                      {crawl.basicInfo.metaDescription
                        ? crawl.basicInfo.metaDescription.substring(0, 120) + (crawl.basicInfo.metaDescription.length > 120 ? "..." : "")
                        : "-"}
                      {getCheck(data, "metaDescription") !== null && <VerificationBadge verified={getCheck(data, "metaDescription")!} />}
                    </span>
                  }
                />
                <InfoRow label="Dil" value={crawl.basicInfo.language} />
                <InfoRow label="Charset" value={crawl.basicInfo.charset} />
                <InfoRow label="Canonical" value={
                  <span className="flex items-center gap-1">
                    {crawl.metaSEO.canonical ? "Var" : "Yok"}
                    {getCheck(data, "canonicalUrl") !== null && <VerificationBadge verified={getCheck(data, "canonicalUrl")!} />}
                  </span>
                } />
                <InfoRow label="OG Tags" value={`${Object.keys(crawl.metaSEO.ogTags).length} adet`} />
                <InfoRow
                  label="Indexlenebilirlik"
                  value={
                    <span className="flex items-center gap-1">
                      {crawl.metaSEO.robots?.toLowerCase().includes("noindex") ? (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">noindex</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Indexlenebilir</Badge>
                      )}
                      {getCheck(data, "indexability") !== null && <VerificationBadge verified={getCheck(data, "indexability")!} />}
                    </span>
                  }
                />
                <InfoRow
                  label="HTTP Durumu"
                  value={
                    <span className="flex items-center gap-1">
                      {(() => {
                        const httpCheck = data.validationSummary?.checks.find((c) => c.field === "httpStatus");
                        if (!httpCheck) return <Badge variant="secondary">Kontrol edilmedi</Badge>;
                        return httpCheck.verified
                          ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{httpCheck.reason}</Badge>
                          : <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{httpCheck.reason}</Badge>;
                      })()}
                    </span>
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">İçerik İstatistikleri</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Kelime Sayısı" value={
                  <span className="flex items-center gap-1">
                    {crawl.content.wordCount.toLocaleString("tr-TR")}
                    {crawl.content.wordCount < 50 ? (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px]">Beslenmemiş</Badge>
                    ) : crawl.content.wordCount < 150 ? (
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-[10px]">Zayıf</Badge>
                    ) : null}
                    {getCheck(data, "contentEmpty") !== null && <VerificationBadge verified={getCheck(data, "contentEmpty")!} />}
                  </span>
                } />
                <InfoRow label="Paragraf Sayısı" value={crawl.content.paragraphCount} />
                <InfoRow label="İçerik/Kod Oranı" value={`%${crawl.content.contentToCodeRatio}`} />
                <InfoRow label="İç Linkler" value={crawl.links.totalInternal} />
                <InfoRow label="Dış Linkler" value={crawl.links.totalExternal} />
                <InfoRow
                  label="Kırık Linkler"
                  value={
                    crawl.links.totalBroken > 0 ? (
                      <span className="text-red-600">{crawl.links.totalBroken}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )
                  }
                />
              </CardContent>
            </Card>
          </div>

          {/* Başlık Yapısı & Görseller + HTML Doğrulama */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Başlık Yapısı & Görseller</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-xl font-bold">{crawl.headings.totalH1}</p>
                    <p className="text-xs text-muted-foreground">H1</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-xl font-bold">{crawl.headings.totalH2}</p>
                    <p className="text-xs text-muted-foreground">H2</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-xl font-bold">{crawl.headings.totalH3}</p>
                    <p className="text-xs text-muted-foreground">H3</p>
                  </div>
                </div>
                <InfoRow label="Toplam Görsel" value={crawl.images.total} />
                <InfoRow
                  label="Alt Tag Eksik"
                  value={
                    crawl.images.totalMissingAlt > 0 ? (
                      <span className="text-red-600">{crawl.images.totalMissingAlt}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">HTML Doğrulama</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow
                  label="HTML Hataları"
                  value={
                    htmlValidation.errors === 0 ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">0 hata</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{htmlValidation.errors} hata</Badge>
                    )
                  }
                />
                <InfoRow label="Uyarılar" value={htmlValidation.warnings} />
                {htmlValidation.error && (
                  <InfoRow label="Not" value={<span className="text-xs text-muted-foreground">{htmlValidation.error}</span>} />
                )}
                {htmlValidation.details.slice(0, 5).map((d, i) => (
                  <div key={i} className="text-xs text-muted-foreground py-1 border-b border-border/30">
                    <Badge variant="secondary" className="text-[10px] mr-1">{d.type}</Badge>
                    {d.message.substring(0, 80)}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* SEO & İçerik Detayları */}
          {(scoring.categories.seo.details.length > 0 || scoring.categories.content.details.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {scoring.categories.seo.details.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">SEO Detayları</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {scoring.categories.seo.details.map((detail, i) => (
                        <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-emerald-200">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {scoring.categories.content.details.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">İçerik Detayları</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {scoring.categories.content.details.map((detail, i) => (
                        <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-emerald-200">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 4: GÜVENLİK & GÜVEN
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="security" className="space-y-6">
        <section>
          <SectionHeader title="Güvenlik & Güven" accent="security" />
          <div className="flex flex-wrap gap-2 mb-4">
            <MiniScore score={scoring.categories.security.score} color={scoring.categories.security.color} label="Güvenlik" />
            <MiniScore score={scoring.categories.domainTrust.score} color={scoring.categories.domainTrust.color} label="Domain Güven" />
          </div>

          {/* SSL & Güvenlik Header'ları */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">SSL & HTTPS</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow
                  label="HTTPS"
                  value={
                    <span className="flex items-center gap-1">
                      {crawl.security.isHttps ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aktif</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Yok</Badge>
                      )}
                      {getCheck(data, "ssl") !== null && <VerificationBadge verified={getCheck(data, "ssl")!} />}
                    </span>
                  }
                />
                <InfoRow
                  label="SSL Sertifikası"
                  value={
                    ssl.valid ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Geçerli</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Geçersiz</Badge>
                    )
                  }
                />
                {ssl.issuer && <InfoRow label="Sertifika Sağlayıcı" value={ssl.issuer} />}
                {ssl.daysUntilExpiry !== null && (
                  <InfoRow
                    label="Kalan Süre"
                    value={
                      ssl.daysUntilExpiry > 30 ? (
                        <span className="text-green-600">{ssl.daysUntilExpiry} gün</span>
                      ) : (
                        <span className="text-red-600">{ssl.daysUntilExpiry} gün</span>
                      )
                    }
                  />
                )}
                <InfoRow
                  label="Mixed Content"
                  value={
                    crawl.security.hasMixedContent ? (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{crawl.security.mixedContentUrls.length} sorun</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Temiz</Badge>
                    )
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Güvenlik Header&apos;ları</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Genel Not" value={<GradeBadge grade={securityHeaders.grade} />} />
                {securityHeaders.headers.map((h) => (
                  <InfoRow
                    key={h.name}
                    label={h.name}
                    value={
                      h.present ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Eksik</Badge>
                      )
                    }
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Safe Browsing & DNS + Domain Bilgisi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Safe Browsing & DNS</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow
                  label="Google Safe Browsing"
                  value={
                    safeBrowsing.safe ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Güvenli</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Tehdit Bulundu</Badge>
                    )
                  }
                />
                {safeBrowsing.threats.length > 0 && (
                  <InfoRow label="Tehditler" value={safeBrowsing.threats.join(", ")} />
                )}
                <InfoRow
                  label="SPF Kaydı"
                  value={dns.hasSPF ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                  ) : (
                    <Badge variant="secondary">Yok</Badge>
                  )}
                />
                <InfoRow
                  label="DMARC Kaydı"
                  value={dns.hasDMARC ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                  ) : (
                    <Badge variant="secondary">Yok</Badge>
                  )}
                />
                <InfoRow label="MX Kayıtları" value={dns.mxRecords.length > 0 ? `${dns.mxRecords.length} kayıt` : "Yok"} />
                <InfoRow label="Nameservers" value={dns.nameservers.slice(0, 2).join(", ") || "—"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Domain Bilgisi</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow
                  label="Domain Yaşı"
                  value={
                    domainInfo.domainAge !== null
                      ? domainInfo.domainAge > 365
                        ? `${Math.floor(domainInfo.domainAge / 365)} yıl`
                        : `${domainInfo.domainAge} gün`
                      : null
                  }
                />
                <InfoRow label="Registrar" value={domainInfo.registrar} />
                <InfoRow
                  label="Kayıt Tarihi"
                  value={domainInfo.createdDate ? new Date(domainInfo.createdDate).toLocaleDateString("tr-TR") : null}
                />
                <InfoRow label="İlk Arşiv Tarihi" value={domainInfo.firstArchiveDate} />
              </CardContent>
            </Card>
          </div>

          {/* Trust Sinyalleri & Sosyal Medya */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Güven Sinyalleri</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow
                  label="Gizlilik Politikası"
                  value={
                    pageAnalysis.trustSignals.hasPrivacyPolicy ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                    ) : (
                      <Badge variant="secondary">Yok</Badge>
                    )
                  }
                />
                <InfoRow
                  label="Kullanım Koşulları"
                  value={
                    pageAnalysis.trustSignals.hasTerms ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                    ) : (
                      <Badge variant="secondary">Yok</Badge>
                    )
                  }
                />
                <InfoRow
                  label="İletişim Bilgisi"
                  value={
                    pageAnalysis.trustSignals.hasContactInfo ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                    ) : (
                      <Badge variant="secondary">Yok</Badge>
                    )
                  }
                />
              </CardContent>
            </Card>

            {/* Sosyal Medya */}
            {pageAnalysis.socialLinks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sosyal Medya</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {pageAnalysis.socialLinks.map((s, i) => {
                      const checkResult = getCheck(data, `socialLink.${s.platform}`);
                      return (
                        <span key={i} className="flex items-center gap-0.5">
                          <Badge variant="secondary" className="text-xs">
                            {s.platform}
                          </Badge>
                          {checkResult !== null && <VerificationBadge verified={checkResult} />}
                        </span>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Güvenlik & Domain Trust Detayları */}
          {(scoring.categories.security.details.length > 0 || scoring.categories.domainTrust.details.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {scoring.categories.security.details.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Güvenlik Detayları</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {scoring.categories.security.details.map((detail, i) => (
                        <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-red-200">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {scoring.categories.domainTrust.details.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Domain Güven Detayları</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {scoring.categories.domainTrust.details.map((detail, i) => (
                        <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-red-200">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 5: TEKNOLOJİ & ALTYAPI
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="technology" className="space-y-6">
        <section>
          <SectionHeader title="Teknoloji & Altyapı" accent="technology" />
          <div className="flex flex-wrap gap-2 mb-4">
            <MiniScore score={scoring.categories.technology.score} color={scoring.categories.technology.color} label="Teknoloji" />
            <MiniScore score={scoring.categories.bestPractices.score} color={scoring.categories.bestPractices.color} label="Best Practices" />
            <MiniScore score={scoring.categories.accessibility.score} color={scoring.categories.accessibility.color} label="Erişilebilirlik" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Platform & Analytics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Platform & Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                {crawl.techDetection.platform && (
                  <InfoRow
                    label="Platform"
                    value={
                      <span className="flex items-center gap-1">
                        <Badge className="px-2 py-0.5">{crawl.techDetection.platform}</Badge>
                        {getCheck(data, "techDetection") !== null && <VerificationBadge verified={getCheck(data, "techDetection")!} />}
                      </span>
                    }
                  />
                )}
                <InfoRow
                  label="Google Analytics"
                  value={
                    pageAnalysis.analytics.hasGoogleAnalytics ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                    ) : (
                      <Badge variant="secondary">Yok</Badge>
                    )
                  }
                />
                <InfoRow
                  label="Google Tag Manager"
                  value={
                    pageAnalysis.analytics.hasGTM ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                    ) : (
                      <Badge variant="secondary">Yok</Badge>
                    )
                  }
                />
                <InfoRow
                  label="Meta Pixel"
                  value={
                    pageAnalysis.analytics.hasMetaPixel ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                    ) : (
                      <Badge variant="secondary">Yok</Badge>
                    )
                  }
                />
                <InfoRow
                  label="Hotjar"
                  value={
                    pageAnalysis.analytics.hasHotjar ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                    ) : (
                      <Badge variant="secondary">Yok</Badge>
                    )
                  }
                />
                {pageAnalysis.analytics.otherTools.length > 0 && (
                  <InfoRow label="Diğer" value={pageAnalysis.analytics.otherTools.join(", ")} />
                )}
                <InfoRow
                  label="Cookie Consent"
                  value={
                    <span className="flex items-center gap-1">
                      {pageAnalysis.cookieConsent.detected ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          {pageAnalysis.cookieConsent.patterns[0]}
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Bulunamadı</Badge>
                      )}
                      {getCheck(data, "cookieConsent") !== null && <VerificationBadge verified={getCheck(data, "cookieConsent")!} />}
                    </span>
                  }
                />
              </CardContent>
            </Card>

            {/* Teknik Bilgiler */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Teknik Bilgiler</CardTitle>
              </CardHeader>
              <CardContent>
                {pageAnalysis.cssFrameworks.length > 0 && (
                  <InfoRow label="CSS Framework" value={pageAnalysis.cssFrameworks.join(", ")} />
                )}
                {pageAnalysis.fonts.length > 0 && (
                  <InfoRow label="Fontlar" value={pageAnalysis.fonts.join(", ")} />
                )}
                <InfoRow
                  label="Schema.org / JSON-LD"
                  value={
                    crawl.technical.hasSchemaOrg ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                    ) : (
                      <Badge variant="secondary">Yok</Badge>
                    )
                  }
                />
                {crawl.technical.schemaTypes.length > 0 && (
                  <InfoRow label="Schema Tipleri" value={crawl.technical.schemaTypes.join(", ")} />
                )}
                <InfoRow
                  label="Sitemap"
                  value={
                    crawl.technical.hasSitemap ? (
                      <span>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                        {crawl.technical.sitemapPageCount !== null && (
                          <span className="ml-1 text-xs">({crawl.technical.sitemapPageCount} sayfa)</span>
                        )}
                      </span>
                    ) : (
                      <Badge variant="secondary">Yok</Badge>
                    )
                  }
                />
                <InfoRow
                  label="Robots.txt"
                  value={
                    crawl.technical.hasRobotsTxt ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                    ) : (
                      <Badge variant="secondary">Yok</Badge>
                    )
                  }
                />
                <InfoRow label="Formlar" value={pageAnalysis.cta.forms} />
                <InfoRow label="Butonlar" value={pageAnalysis.cta.buttons} />
              </CardContent>
            </Card>
          </div>

          {/* Kırık Linkler */}
          {crawl.links.totalBroken > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-600">Kırık Linkler ({crawl.links.totalBroken})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {crawl.links.broken.slice(0, 10).map((link, i) => (
                    <div key={i} className="text-sm p-2 bg-red-50 rounded border border-red-100">
                      <p className="font-mono text-xs truncate">{link.href}</p>
                      {link.text && (
                        <p className="text-muted-foreground text-xs mt-0.5">Metin: {link.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Teknoloji & Best Practices & Erişilebilirlik Detayları */}
          {(scoring.categories.technology.details.length > 0 || scoring.categories.bestPractices.details.length > 0 || scoring.categories.accessibility.details.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scoring.categories.technology.details.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Teknoloji Detayları</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {scoring.categories.technology.details.map((detail, i) => (
                        <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-purple-200">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {scoring.categories.bestPractices.details.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Best Practices Detayları</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {scoring.categories.bestPractices.details.map((detail, i) => (
                        <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-purple-200">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {scoring.categories.accessibility.details.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Erişilebilirlik Detayları</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {scoring.categories.accessibility.details.map((detail, i) => (
                        <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-purple-200">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 6: DİJİTAL VARLIK (Conditional)
         ═══════════════════════════════════════════════════════════════ */}
      {onlinePresenceVisible && (
        <TabsContent value="digital" className="space-y-6">
          <section>
            <SectionHeader title="Dijital Varlık" accent="onlinePresence" />
            <div className="flex flex-wrap gap-2 mb-4">
              <MiniScore score={scoring.categories.onlinePresence!.score} color={scoring.categories.onlinePresence!.color} label="Dijital Varlık" />
            </div>

            {/* Özet Tablo */}
            <Card className="mb-4 overflow-hidden">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cyan-50 border-b border-cyan-200">
                      <th className="text-left py-2 px-4 font-semibold text-cyan-900 w-1/3">Özellik</th>
                      <th className="text-left py-2 px-4 font-semibold text-cyan-900">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ── Google Index ── */}
                    <tr className="border-b border-border/30 bg-cyan-50/40">
                      <td colSpan={2} className="py-2 px-4 font-semibold text-cyan-800 text-xs uppercase tracking-wide">Google Index</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="py-2 px-4 text-muted-foreground">Indexlenme</td>
                      <td className="py-2 px-4">
                        {data.onlinePresence!.googleIndex.noData ? (
                          <Badge variant="secondary">Veri Yok</Badge>
                        ) : data.onlinePresence!.googleIndex.isIndexed ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Indexli</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Indexli Değil</Badge>
                        )}
                      </td>
                    </tr>
                    {!data.onlinePresence!.googleIndex.noData && (
                      <>
                        <tr className="border-b border-border/30 bg-muted/20">
                          <td className="py-2 px-4 text-muted-foreground">Indexli Sayfa Sayısı</td>
                          <td className="py-2 px-4 font-medium">{data.onlinePresence!.googleIndex.indexedPageCount}</td>
                        </tr>
                        <tr className="border-b border-border/30">
                          <td className="py-2 px-4 text-muted-foreground">Rich Snippet</td>
                          <td className="py-2 px-4">
                            {data.onlinePresence!.googleIndex.hasRichSnippet ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Var</Badge>
                            ) : (
                              <Badge variant="secondary">Yok</Badge>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b border-border/30 bg-muted/20">
                          <td className="py-2 px-4 text-muted-foreground">Marka Bahsetmeleri</td>
                          <td className="py-2 px-4 font-medium">{data.onlinePresence!.googleIndex.brandMentions}</td>
                        </tr>
                        {data.onlinePresence!.googleIndex.serpAppearance && (
                          <tr className="border-b border-border/30">
                            <td className="py-2 px-4 text-muted-foreground">SERP Görünümü</td>
                            <td className="py-2 px-4 text-xs max-w-xs">{data.onlinePresence!.googleIndex.serpAppearance}</td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* ── Webmaster Doğrulama ── */}
                    <tr className="border-b border-border/30 bg-cyan-50/40">
                      <td colSpan={2} className="py-2 px-4 font-semibold text-cyan-800 text-xs uppercase tracking-wide">Webmaster Doğrulama</td>
                    </tr>
                    {([
                      ["Google Search Console", data.onlinePresence!.webmasterTags.google],
                      ["Bing Webmaster", data.onlinePresence!.webmasterTags.bing],
                      ["Yandex Webmaster", data.onlinePresence!.webmasterTags.yandex],
                    ] as const).map(([label, verified], i) => (
                      <tr key={label} className={`border-b border-border/30 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                        <td className="py-2 px-4 text-muted-foreground">{label}</td>
                        <td className="py-2 px-4">
                          {verified ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Doğrulanmış</Badge>
                          ) : (
                            <Badge variant="secondary">Yok</Badge>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* ── Arşiv & Domain ── */}
                    <tr className="border-b border-border/30 bg-cyan-50/40">
                      <td colSpan={2} className="py-2 px-4 font-semibold text-cyan-800 text-xs uppercase tracking-wide">Arşiv & Domain</td>
                    </tr>
                    {data.onlinePresence!.waybackHistory.websiteAge !== null && (
                      <tr className="border-b border-border/30">
                        <td className="py-2 px-4 text-muted-foreground">Domain Yaşı</td>
                        <td className="py-2 px-4 font-medium">{data.onlinePresence!.waybackHistory.websiteAge} yıl</td>
                      </tr>
                    )}
                    <tr className="border-b border-border/30 bg-muted/20">
                      <td className="py-2 px-4 text-muted-foreground">Toplam Snapshot</td>
                      <td className="py-2 px-4 font-medium">{data.onlinePresence!.waybackHistory.snapshotCount}</td>
                    </tr>
                    {data.onlinePresence!.waybackHistory.firstSnapshot && (
                      <tr className="border-b border-border/30">
                        <td className="py-2 px-4 text-muted-foreground">İlk Snapshot</td>
                        <td className="py-2 px-4">{new Date(data.onlinePresence!.waybackHistory.firstSnapshot).toLocaleDateString("tr-TR")}</td>
                      </tr>
                    )}
                    {data.onlinePresence!.waybackHistory.lastSnapshot && (
                      <tr className="border-b border-border/30 bg-muted/20">
                        <td className="py-2 px-4 text-muted-foreground">Son Snapshot</td>
                        <td className="py-2 px-4">{new Date(data.onlinePresence!.waybackHistory.lastSnapshot).toLocaleDateString("tr-TR")}</td>
                      </tr>
                    )}

                    {/* ── Yapısal Veri ── */}
                    <tr className="border-b border-border/30 bg-cyan-50/40">
                      <td colSpan={2} className="py-2 px-4 font-semibold text-cyan-800 text-xs uppercase tracking-wide">Yapısal Veri</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="py-2 px-4 text-muted-foreground">Schema.org</td>
                      <td className="py-2 px-4">
                        {data.onlinePresence!.structuredData.schemaComplete ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Tamamlanmış</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Eksik</Badge>
                        )}
                        {data.onlinePresence!.structuredData.schemaTypes.length > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">({data.onlinePresence!.structuredData.schemaTypes.join(", ")})</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-border/30 bg-muted/20">
                      <td className="py-2 px-4 text-muted-foreground">Open Graph</td>
                      <td className="py-2 px-4">
                        {data.onlinePresence!.structuredData.ogComplete ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Tamamlanmış</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Eksik</Badge>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="py-2 px-4 text-muted-foreground">Twitter Card</td>
                      <td className="py-2 px-4">
                        {data.onlinePresence!.structuredData.twitterCardComplete ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Tamamlanmış</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Eksik</Badge>
                        )}
                      </td>
                    </tr>

                    {/* ── Sosyal Medya ── */}
                    {data.onlinePresence!.socialPresence.profiles.length > 0 && (
                      <>
                        <tr className="border-b border-border/30 bg-cyan-50/40">
                          <td colSpan={2} className="py-2 px-4 font-semibold text-cyan-800 text-xs uppercase tracking-wide">
                            Sosyal Medya
                            <span className="ml-2 font-normal normal-case text-cyan-600">
                              ({data.onlinePresence!.socialPresence.totalVerified} erişilebilir, {data.onlinePresence!.socialPresence.totalInvalid} erişilemez)
                            </span>
                          </td>
                        </tr>
                        {data.onlinePresence!.socialPresence.profiles.map((profile, i) => (
                          <tr key={i} className={`border-b border-border/30 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                            <td className="py-2 px-4 text-muted-foreground">{profile.platform}</td>
                            <td className="py-2 px-4">
                              {profile.accessible ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Erişilebilir</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Erişilemez</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Skor Detayları */}
            {scoring.categories.onlinePresence!.details.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-cyan-50 border-b border-cyan-200">
                        <th className="text-left py-2 px-4 font-semibold text-cyan-900">Skor Detayları</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoring.categories.onlinePresence!.details.map((detail, i) => (
                        <tr key={i} className={`border-b border-border/30 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                          <td className="py-2 px-4 text-muted-foreground">{detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </section>
        </TabsContent>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 7: SEO OTORİTE
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="authority" className="space-y-6">
        {data.seoAuthority ? (
          <AuthorityReportSection
            report={data.seoAuthority}
            title="SEO Otorite Raporu"
            accent="seoAuthority"
            gradient="from-purple-50 to-indigo-50"
            borderPrefix="purple"
          />
        ) : (
          <section>
            <SectionHeader title="SEO Otorite Raporu" accent="seoAuthority" />
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
              <p className="font-medium">SEO Otorite verisi bulunamadı</p>
              <p className="text-sm mt-1">Yeni bir tarama yaparak güncel veriyi alabilirsiniz.</p>
            </div>
          </section>
        )}
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════
          TAB: GEO OTORİTE
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="geo" className="space-y-6">
        {data.geoAuthority ? (
          <AuthorityReportSection
            report={data.geoAuthority}
            title="GEO Otorite Raporu"
            accent="geoAuthority"
            gradient="from-teal-50 to-emerald-50"
            borderPrefix="teal"
          />
        ) : (
          <section>
            <SectionHeader title="GEO Otorite Raporu" accent="geoAuthority" />
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
              <p className="font-medium">GEO Otorite verisi bulunamadı</p>
              <p className="text-sm mt-1">Yeni bir tarama yaparak güncel veriyi alabilirsiniz.</p>
            </div>
          </section>
        )}
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════
          TAB: AEO OTORİTE
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="aeo" className="space-y-6">
        {data.aeoAuthority ? (
          <AuthorityReportSection
            report={data.aeoAuthority}
            title="AEO Otorite Raporu"
            accent="aeoAuthority"
            gradient="from-rose-50 to-pink-50"
            borderPrefix="rose"
          />
        ) : (
          <section>
            <SectionHeader title="AEO Otorite Raporu" accent="aeoAuthority" />
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
              <p className="font-medium">AEO Otorite verisi bulunamadı</p>
              <p className="text-sm mt-1">Yeni bir tarama yaparak güncel veriyi alabilirsiniz.</p>
            </div>
          </section>
        )}
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════
          TAB: BACKLINK OTORİTE
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="backlink" className="space-y-6">
        {data.backlinkAuthority ? (
          <AuthorityReportSection
            report={data.backlinkAuthority}
            title="Backlink Otorite Raporu"
            accent="backlinkAuthority"
            gradient="from-amber-50 to-yellow-50"
            borderPrefix="amber"
          />
        ) : (
          <section>
            <SectionHeader title="Backlink Otorite Raporu" accent="backlinkAuthority" />
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
              <p className="font-medium">Backlink Otorite verisi bulunamadı</p>
              <p className="text-sm mt-1">Yeni bir tarama yaparak güncel veriyi alabilirsiniz.</p>
            </div>
          </section>
        )}
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════
          TAB: BLOG OTORİTE
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="blog" className="space-y-6">
        {data.blogAuthority ? (
          <AuthorityReportSection
            report={data.blogAuthority}
            title="Blog Otorite Raporu"
            accent="blogAuthority"
            gradient="from-lime-50 to-green-50"
            borderPrefix="lime"
          />
        ) : (
          <section>
            <SectionHeader title="Blog Otorite Raporu" accent="blogAuthority" />
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
              <p className="font-medium">Blog Otorite verisi bulunamadı</p>
              <p className="text-sm mt-1">Yeni bir tarama yaparak güncel veriyi alabilirsiniz.</p>
            </div>
          </section>
        )}
      </TabsContent>

      {/* ═══════════════════════════════════════════════════════════════
          TAB: SONUÇ & AKSİYON
         ═══════════════════════════════════════════════════════════════ */}
      <TabsContent value="conclusion" className="space-y-6">
        <section>
          <SectionHeader title="Sonuç & Aksiyon" accent="conclusion" />

          {/* Tedavi Planı */}
          {data.treatmentPlan && data.treatmentPlan.phases.length > 0 && (
            <TreatmentPlanSection plan={data.treatmentPlan} data={data} />
          )}

          {/* Doğrulama Özeti */}
          {data.validationSummary && (
            <div className="mb-4">
              <ValidationSummaryBar summary={data.validationSummary} />
            </div>
          )}

          {/* Geçmiş Karşılaştırma */}
          <ScanComparison data={data} />
        </section>
      </TabsContent>
    </Tabs>
  );
}

// ── SEO Otorite Raporu Bileşeni ──

const authorityDescriptions: Record<string, string> = {
  // SEO Authority
  "Intent Uyumu": "Sayfanın arama niyetine uygunluğu — title, meta description ve heading yapısı doğru mu?",
  "Topikal Otorite": "Konu hakkında ne kadar derin ve kapsamlı içerik var — iç linkler, kelime sayısı, yapılandırılmış veri",
  "Teknik Altyapı": "SEO'nun teknik temelleri — robots.txt, sitemap, canonical, indexlenme ve sayfa hızı",
  "Güven Sinyalleri": "Sitenin güvenilir görünüp görünmediği — SSL, gizlilik politikası, iletişim bilgisi, dış kaynaklar",
  "Backlink & Referans": "Sitenin dış dünyadaki bilinirliği — marka bahsetmeleri, sosyal medya varlığı, web arşivi geçmişi",
  // GEO Authority
  "SEO Temeli": "GEO'nun temeli olan klasik SEO altyapısı — title, meta description, H1, canonical, robots, sitemap",
  "Yapılandırılmış Veri": "AI arama motorlarının anlayabilmesi için Schema.org, JSON-LD, Open Graph ve Twitter Card yapısı",
  "Cite Edilebilirlik": "İçeriğin AI tarafından kaynak gösterilme potansiyeli — kelime sayısı, bölümleme, dış kaynak linkleri",
  "Marka Bahsetmeleri": "Markanın web'deki bilinirliği — bahsetmeler, sosyal medya varlığı, web arşivi geçmişi",
  "LLM Görünürlüğü": "ChatGPT, Perplexity gibi AI araçlarının sitenizi bulup alıntılayabilme potansiyeli",
  // AEO Authority
  "Cevap Blokları": "Sayfadaki kısa, yapılı cevap blokları — paragraf yapısı, listeler, özet bölümleri",
  "FAQ/HowTo Schema": "Cevap motorlarının anlaması için FAQPage, HowTo ve Article schema markup'ları",
  "Snippet Hedefleme": "Featured snippet (Position 0) için meta description, soru-cevap formatı ve içerik-kod oranı",
  "Niyet Uyumu": "Sayfa yapısının kullanıcı sorularına ne kadar uygun olduğu — soru formatında başlıklar, tutarlılık",
  "Ölçüm & Takip": "AEO performansını izleyebilmek için analitik ve webmaster araçları altyapısı",
  // Backlink Authority
  "Alaka Düzeyi": "Backlink'lerin niş ile alakası — aynı konudaki sitelerden link almak, DA/DR'den daha değerli",
  "Trafik Sinyali": "Link veren sayfanın trafik potansiyeli — indexlenme, sayfa sayısı ve rich snippet varlığı",
  "Link Çeşitliliği": "Farklı kaynaklardan gelen linklerin dağılımı — tek kaynağa bağımlılık riskli",
  "Anchor Doğallığı": "Link anchor text'lerinin doğallığı — tekrar ve generic anchor oranı",
  "Bahsetme Sinyali": "Markanın web'deki organik bahsetmeleri — sosyal medya, arşiv geçmişi ve brand mentions",
  // Blog Authority
  "İçerik Derinliği": "Blog arşivinin zenginliği — yazı sayısı, kelime sayısı, bölümleme derinliği",
  "Pillar & Cluster": "Pillar içerik + destek yazılardan oluşan topikal küme yapısı — iç linkler ve başlık derinliği",
  "Özgünlük & Deneyim": "İçeriğin özgünlüğü ve deneyim kanıtları — E-E-A-T sinyalleri, görseller, yazar bilgisi",
  "Asset Üretimi": "İndirilebilir içerikler — PDF checklist, şablon, mini araç gibi kaydedilen ve paylaşılan varlıklar",
  "Dağıtım Sinyali": "İçeriğin dağıtım kanalları — sosyal medya, newsletter, video ve aktif paylaşım altyapısı",
};

function AuthorityProgressBar({ sub }: { sub: AuthoritySubScore }) {
  const pct = (sub.score / sub.max) * 100;
  const barColor =
    sub.score >= 15 ? "bg-green-500" : sub.score >= 10 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-base font-semibold text-gray-800">{sub.label}</span>
        <span className="text-base font-bold text-gray-900">{sub.score}/{sub.max}</span>
      </div>
      {authorityDescriptions[sub.label] && (
        <p className="text-sm text-gray-500">{authorityDescriptions[sub.label]}</p>
      )}
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sub.details.length > 0 && (
        <ul className="space-y-1 pl-1">
          {sub.details.map((detail, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className={`mt-1 shrink-0 ${detail.includes("bulunamadı") || detail.includes("yok") || detail.includes("zayıf") || detail.includes("düşük") || detail.includes("güvenilir değil") ? "text-red-400" : "text-green-400"}`}>●</span>
              {detail}
            </li>
          ))}
        </ul>
      )}
      {sub.noData && (
        <p className="text-sm text-amber-600 flex items-center gap-1.5">
          <span>⚠</span>
          {sub.label === "Intent Uyumu"
            ? "Anahtar kelime verisi yok — tam intent analizi yapılamadı"
            : sub.label === "Topikal Otorite"
              ? "Tek sayfa taraması — cluster yapısı tespit edilemez"
              : sub.label === "LLM Görünürlüğü"
                ? "Doğrudan LLM API verisi yok — dolaylı sinyallerle tahmin edildi"
                : sub.label === "Marka Bahsetmeleri"
                  ? "Marka bahsetme verisi sınırlı (API key gerekli)"
                  : sub.label === "Niyet Uyumu"
                    ? "Hedef soru/keyword olmadan tam niyet analizi yapılamadı"
                    : sub.label === "Alaka Düzeyi" || sub.label === "Link Çeşitliliği" || sub.label === "Anchor Doğallığı"
                      ? "Backlink profil verisi yok (Ahrefs/Moz API gerekli) — dolaylı sinyallerle skorlandı"
                      : sub.label === "Bahsetme Sinyali" || sub.label === "Trafik Sinyali"
                        ? "Sınırlı veri kaynağı — tam analiz için ek API gerekli"
                        : sub.label === "İçerik Derinliği" || sub.label === "Pillar & Cluster"
                          ? "Tek sayfa taraması — tüm blog arşivi analiz edilemez"
                          : sub.label === "Özgünlük & Deneyim" || sub.label === "Asset Üretimi"
                            ? "HTML pattern'lerle dolaylı tespit — tam analiz için içerik taraması gerekli"
                            : sub.label === "Dağıtım Sinyali"
                              ? "Dağıtım kanalları doğrudan ölçülemiyor — dolaylı sinyallerle skorlandı"
                              : "Veri kaynağı sınırlı — sonuçlar tahmine dayalı"}
        </p>
      )}
    </div>
  );
}

type AuthorityReportLike = {
  overall: number;
  color: CategoryScore["color"];
  verdict: "onay" | "guclendir" | "yeniden-yapilandir";
  categories: Record<string, AuthoritySubScore>;
  communityInsights: string[];
  actionPlan: string[];
};

function AuthorityReportSection({
  report,
  title,
  accent,
  gradient,
  borderPrefix,
}: {
  report: AuthorityReportLike;
  title: string;
  accent: string;
  gradient: string;
  borderPrefix: string;
}) {
  const verdictConfig = {
    onay: { label: "ONAY", bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
    guclendir: { label: "GÜÇLENDİR", bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200" },
    "yeniden-yapilandir": { label: "YENİDEN YAPILANDIR", bg: "bg-red-100", text: "text-red-800", border: "border-red-200" },
  };

  const v = verdictConfig[report.verdict];

  const overallColor =
    report.overall >= 70 ? "text-green-600" : report.overall >= 50 ? "text-yellow-600" : "text-red-600";

  const borderColorMap: Record<string, string> = {
    purple: "border-purple-200",
    teal: "border-teal-200",
    rose: "border-rose-200",
    amber: "border-amber-200",
    lime: "border-lime-200",
  };
  const dividerColorMap: Record<string, string> = {
    purple: "border-purple-200",
    teal: "border-teal-200",
    rose: "border-rose-200",
    amber: "border-amber-200",
    lime: "border-lime-200",
  };
  const borderColor = borderColorMap[borderPrefix] || "border-purple-200";
  const dividerColor = dividerColorMap[borderPrefix] || "border-purple-200";

  const categoryEntries = Object.values(report.categories);

  return (
    <section>
      <SectionHeader title={title} accent={accent} />
      <Card className={`${borderColor} bg-gradient-to-br ${gradient}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {title}
            </CardTitle>
            <span className={`text-2xl font-bold ${overallColor}`}>{report.overall}/100</span>
          </div>
          <div className="mt-2">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${v.bg} ${v.text}`}>
              {v.label}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Alt Skorlar */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-600">Alt Skorlar</h4>
            {categoryEntries.map((sub) => (
              <AuthorityProgressBar key={sub.label} sub={sub} />
            ))}
          </div>

          {/* Topluluk İçgörüleri */}
          {report.communityInsights.length > 0 && (
            <div className={`space-y-2 pt-4 border-t ${dividerColor}`}>
              <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-1">
                <span>💬</span> Topluluk İçgörüleri
              </h4>
              <ul className="space-y-1.5">
                {report.communityInsights.map((insight, i) => (
                  <li key={i} className="text-sm text-gray-700 bg-white/60 rounded-lg px-3 py-2">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 30 Günlük Plan */}
          {report.actionPlan.length > 0 && (
            <div className={`space-y-2 pt-4 border-t ${dividerColor}`}>
              <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-1">
                <span>📅</span> 30 Günlük Plan
              </h4>
              <ul className="space-y-1.5">
                {report.actionPlan.map((step, i) => (
                  <li key={i} className="text-sm text-gray-700 bg-white/60 rounded-lg px-3 py-2">
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// ── Kontrol Muayenesi (Recommendation Karşılaştırma) ──
function TreatmentComparison({ data }: { data: FullAnalysisResult }) {
  const [prevScan, setPrevScan] = useState<{
    overallScore: number;
    recommendationKeys: string[];
    analyzedAt: string;
  } | null>(null);

  useEffect(() => {
    const domain = getDomain(data.crawl.basicInfo.finalUrl);
    supabase
      .from("scans")
      .select("overall_score, recommendation_keys, analyzed_at")
      .eq("domain", domain)
      .lt("analyzed_at", data.analyzedAt)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .then(({ data: rows }) => {
        if (rows && rows.length > 0) {
          const row = rows[0];
          // recommendation_keys null ise (eski tarama) → gösterme
          if (!row.recommendation_keys || !Array.isArray(row.recommendation_keys)) return;
          setPrevScan({
            overallScore: row.overall_score,
            recommendationKeys: row.recommendation_keys as string[],
            analyzedAt: row.analyzed_at,
          });
        }
      });
  }, [data.crawl.basicInfo.finalUrl, data.analyzedAt]);

  if (!prevScan) return null;

  const currentKeys = data.recommendations.map(normalizeRecKey);
  const currentKeySet = new Set(currentKeys);
  const prevKeySet = new Set(prevScan.recommendationKeys);

  // Düzeltildi: öncekinde var, şimdikinde yok
  const fixed = prevScan.recommendationKeys.filter((k) => !currentKeySet.has(k));
  // Devam ediyor: her ikisinde de var
  const ongoing = prevScan.recommendationKeys.filter((k) => currentKeySet.has(k));
  // Yeni sorun: şimdikinde var, öncekinde yok
  const newIssues = currentKeys.filter((k) => !prevKeySet.has(k));

  // Hiç fark yoksa gösterme
  if (fixed.length === 0 && newIssues.length === 0) return null;

  const prevDate = new Date(prevScan.analyzedAt).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const scoreDiff = data.scoring.overall - prevScan.overallScore;

  // Mevcut recommendation'ları key→title map'ine çevir
  const currentKeyToTitle = new Map<string, { title: string; category: string }>();
  data.recommendations.forEach((r) => {
    currentKeyToTitle.set(normalizeRecKey(r), { title: r.title, category: r.category });
  });

  // Key'den okunabilir label üret (mevcut recommendation title'ından veya key'den)
  function keyLabel(key: string): string {
    const found = currentKeyToTitle.get(key);
    if (found) return found.title;
    // key'den geri çöz: "kategori::baslik-metin" → "baslik metin"
    const parts = key.split("::");
    return parts.length > 1 ? parts[1].replace(/-/g, " ") : key;
  }

  function keyCategory(key: string): string {
    const found = currentKeyToTitle.get(key);
    if (found) return found.category;
    const parts = key.split("::");
    return parts.length > 0 ? parts[0] : "";
  }

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold">
            &#9876;
          </span>
          Kontrol Muayenesi
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          vs. {prevDate} taraması
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Skor değişimi */}
        <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg">
          <span className="text-sm font-medium text-muted-foreground">Genel Skor:</span>
          <span className="text-lg font-bold">
            {prevScan.overallScore} → {data.scoring.overall}
          </span>
          {scoreDiff !== 0 && (
            <Badge className={`${scoreDiff > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} text-sm`}>
              {scoreDiff > 0 ? "+" : ""}{scoreDiff} puan
            </Badge>
          )}
        </div>

        {/* Düzeltildi */}
        {fixed.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600 text-base">&#10003;</span>
              <span className="text-sm font-medium text-green-700">
                {fixed.length} sorun düzeltildi
              </span>
            </div>
            <div className="space-y-1 ml-7">
              {fixed.map((key) => (
                <div key={key} className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-2 py-1 rounded">
                  <span className="text-xs">&#10003;</span>
                  <span className="flex-1">{keyLabel(key)}</span>
                  <Badge variant="secondary" className="text-[10px]">{keyCategory(key)}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Devam ediyor */}
        {ongoing.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-600 text-base">&#9888;</span>
              <span className="text-sm font-medium text-yellow-700">
                {ongoing.length} sorun devam ediyor
              </span>
            </div>
            <div className="space-y-1 ml-7">
              {ongoing.map((key) => (
                <div key={key} className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                  <span className="text-xs">&#9888;</span>
                  <span className="flex-1">{keyLabel(key)}</span>
                  <Badge variant="secondary" className="text-[10px]">{keyCategory(key)}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yeni sorunlar */}
        {newIssues.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-600 text-base">&#9679;</span>
              <span className="text-sm font-medium text-blue-700">
                {newIssues.length} yeni sorun tespit edildi
              </span>
            </div>
            <div className="space-y-1 ml-7">
              {newIssues.map((key) => (
                <div key={key} className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded">
                  <span className="text-xs">&#9679;</span>
                  <span className="flex-1">{keyLabel(key)}</span>
                  <Badge variant="secondary" className="text-[10px]">{keyCategory(key)}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Tedavi Planı Bileşenleri ──
const phaseConfig: Record<TreatmentPhase["id"], { accent: string; accentBg: string; accentBorder: string; stepBg: string; numberBg: string; numberText: string }> = {
  acil: { accent: "text-red-700", accentBg: "bg-red-50", accentBorder: "border-red-200", stepBg: "bg-red-50/50", numberBg: "bg-red-100", numberText: "text-red-700" },
  temel: { accent: "text-yellow-700", accentBg: "bg-yellow-50", accentBorder: "border-yellow-200", stepBg: "bg-yellow-50/50", numberBg: "bg-yellow-100", numberText: "text-yellow-700" },
  ileri: { accent: "text-blue-700", accentBg: "bg-blue-50", accentBorder: "border-blue-200", stepBg: "bg-blue-50/50", numberBg: "bg-blue-100", numberText: "text-blue-700" },
};

const effortStyles: Record<Recommendation["effort"], { bg: string; text: string }> = {
  "Kolay": { bg: "bg-green-100", text: "text-green-700" },
  "Orta": { bg: "bg-yellow-100", text: "text-yellow-700" },
  "Zor": { bg: "bg-red-100", text: "text-red-700" },
};

function TreatmentPlanSection({ plan, data }: { plan: TreatmentPlan; data: FullAnalysisResult }) {
  const effortCounts = plan.phases.reduce(
    (acc, phase) => {
      phase.steps.forEach((s) => { acc[s.effort] = (acc[s.effort] || 0) + 1; });
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4 mb-4">
      {/* Tedavi Planı Özet Kartı */}
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">Rx</span>
            Tedavi Planı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            {plan.totalSteps} adımlık iyileştirme planı — {plan.phases.length} aşamada
          </p>
          <div className="flex flex-wrap gap-2">
            {plan.phases.map((phase) => {
              const config = phaseConfig[phase.id];
              return (
                <Badge key={phase.id} className={`${config.accentBg} ${config.accent} ${config.accentBorder} border text-xs`}>
                  {phase.name} ({phase.steps.length})
                </Badge>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {(["Kolay", "Orta", "Zor"] as const).map((e) =>
              effortCounts[e] ? (
                <Badge key={e} className={`${effortStyles[e].bg} ${effortStyles[e].text} text-[10px]`}>
                  {e}: {effortCounts[e]}
                </Badge>
              ) : null
            )}
          </div>
        </CardContent>
      </Card>

      {/* Kontrol Muayenesi */}
      <TreatmentComparison data={data} />

      {/* Fazlar */}
      {plan.phases.map((phase, phaseIndex) => (
        <PhaseCard key={phase.id} phase={phase} defaultOpen={phaseIndex === 0} />
      ))}
    </div>
  );
}

function PhaseCard({ phase, defaultOpen }: { phase: TreatmentPhase; defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const config = phaseConfig[phase.id];

  const effortCounts = phase.steps.reduce(
    (acc, s) => { acc[s.effort] = (acc[s.effort] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <Card className={`${config.accentBorder} border`}>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center gap-3 text-base">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${config.numberBg} ${config.numberText} text-xs font-bold`}>
            {phase.id === "acil" ? "1" : phase.id === "temel" ? "2" : "3"}
          </span>
          <span className="flex-1">{phase.name}</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{phase.steps.length} adım</Badge>
            {(["Kolay", "Orta", "Zor"] as const).map((e) =>
              effortCounts[e] ? (
                <Badge key={e} className={`${effortStyles[e].bg} ${effortStyles[e].text} text-[10px]`}>
                  {e}: {effortCounts[e]}
                </Badge>
              ) : null
            )}
            <span className={`text-sm transition-transform ${isOpen ? "rotate-180" : ""}`}>&#9660;</span>
          </div>
        </CardTitle>
        <p className="text-xs text-muted-foreground ml-9">{phase.description}</p>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-3 pt-0">
          {phase.steps.map((step, i) => (
            <StepCard key={i} step={step} index={i + 1} phaseId={phase.id} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function StepCard({ step, index, phaseId }: { step: Recommendation; index: number; phaseId: TreatmentPhase["id"] }) {
  const [showHowTo, setShowHowTo] = useState(false);
  const config = phaseConfig[phaseId];
  const eStyle = effortStyles[step.effort];

  return (
    <div className={`rounded-lg border ${config.accentBorder} ${config.stepBg} p-3`}>
      <div className="flex items-start gap-3">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${config.numberBg} ${config.numberText} text-xs font-bold shrink-0 mt-0.5`}>
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium">{step.title}</span>
            <Badge className={`${eStyle.bg} ${eStyle.text} text-[10px]`}>{step.effort}</Badge>
            <Badge variant="secondary" className="text-[10px]">{step.category}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{step.description}</p>
          <button
            onClick={() => setShowHowTo(!showHowTo)}
            className={`mt-2 text-xs font-medium flex items-center gap-1 ${config.accent} hover:underline`}
          >
            <span>{showHowTo ? "&#9660;" : "&#9654;"}</span>
            Nasıl düzeltilir?
          </button>
          {showHowTo && (
            <div className="mt-2 p-3 bg-white/80 rounded-lg border border-border/50 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {step.howTo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Geçmiş Karşılaştırma ──
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ScoreDiff({ current, previous, label }: { current: number; previous: number; label: string }) {
  const diff = current - previous;
  if (diff === 0) return null;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${diff > 0 ? "text-green-600" : "text-red-600"}`}>
        {previous} → {current} ({diff > 0 ? "+" : ""}{diff})
      </span>
    </div>
  );
}

function ScanComparison({ data }: { data: FullAnalysisResult }) {
  const [previous, setPrevious] = useState<ScanHistoryEntry | null>(null);

  useEffect(() => {
    const domain = getDomain(data.crawl.basicInfo.finalUrl);
    supabase
      .from("scans")
      .select("url, overall_score, category_scores, analyzed_at")
      .eq("domain", domain)
      .lt("analyzed_at", data.analyzedAt)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .then(({ data: rows }) => {
        if (rows && rows.length > 0) {
          const row = rows[0];
          setPrevious({
            url: row.url,
            overallScore: row.overall_score,
            categoryScores: row.category_scores as Record<string, number>,
            analyzedAt: row.analyzed_at,
          });
        }
      });
  }, [data.crawl.basicInfo.finalUrl, data.analyzedAt]);

  if (!previous) return null;

  const prevDate = new Date(previous.analyzedAt).toLocaleDateString("tr-TR");
  const overallDiff = data.scoring.overall - previous.overallScore;

  const categoryNames: Record<string, string> = {
    performance: "Performans",
    seo: "SEO",
    security: "Güvenlik",
    accessibility: "Erişilebilirlik",
    bestPractices: "Best Practices",
    domainTrust: "Domain Güven",
    content: "İçerik",
    technology: "Teknoloji",
    onlinePresence: "Dijital Varlık",
  };

  const currentCategories: Record<string, number> = {
    performance: data.scoring.categories.performance.score,
    seo: data.scoring.categories.seo.score,
    security: data.scoring.categories.security.score,
    accessibility: data.scoring.categories.accessibility.score,
    bestPractices: data.scoring.categories.bestPractices.score,
    domainTrust: data.scoring.categories.domainTrust.score,
    content: data.scoring.categories.content.score,
    technology: data.scoring.categories.technology.score,
    ...(data.scoring.categories.onlinePresence && {
      onlinePresence: data.scoring.categories.onlinePresence.score,
    }),
  };

  const hasChanges = overallDiff !== 0 || Object.keys(currentCategories).some(
    (k) => currentCategories[k] !== (previous.categoryScores[k] ?? 0)
  );

  if (!hasChanges) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Önceki Tarama ile Karşılaştırma</CardTitle>
        <p className="text-xs text-muted-foreground">Önceki tarama: {prevDate}</p>
      </CardHeader>
      <CardContent>
        <div className="mb-3 pb-3 border-b">
          <div className="flex items-center justify-between">
            <span className="font-medium">Genel Skor</span>
            <span className={`text-lg font-bold ${overallDiff > 0 ? "text-green-600" : overallDiff < 0 ? "text-red-600" : ""}`}>
              {previous.overallScore} → {data.scoring.overall}
              {overallDiff !== 0 && (
                <span className="text-sm ml-1">({overallDiff > 0 ? "+" : ""}{overallDiff})</span>
              )}
            </span>
          </div>
        </div>
        {Object.entries(currentCategories).map(([key, score]) => (
          <ScoreDiff
            key={key}
            current={score}
            previous={previous.categoryScores[key] ?? 0}
            label={categoryNames[key] || key}
          />
        ))}
      </CardContent>
    </Card>
  );
}
