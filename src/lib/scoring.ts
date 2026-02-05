import type {
  CrawlResult,
  PageSpeedResult,
  SSLInfo,
  DomainInfo,
  SecurityHeadersResult,
  SafeBrowsingResult,
  DNSResult,
  HTMLValidationResult,
  PageAnalysis,
  CategoryScore,
  ScoringResult,
  OnlinePresenceResult,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getColor(score: number): CategoryScore["color"] {
  if (score >= 90) return "green";
  if (score >= 70) return "lime";
  if (score >= 50) return "yellow";
  if (score >= 30) return "orange";
  return "red";
}

// ── Performance Skoru (%20 ağırlık) ──
function scorePerformance(pageSpeed: PageSpeedResult): CategoryScore {
  const details: string[] = [];

  // PageSpeed verisi yoksa → noData
  if (pageSpeed.error || pageSpeed.scores.performance === null) {
    details.push("PageSpeed verisi alınamadı");
    return { score: 0, label: "Performans", color: "yellow", details, noData: true };
  }

  let score = pageSpeed.scores.performance;
  details.push(`PageSpeed Performance: ${score}`);

  // CWV bonusları/cezaları
  const cwv = pageSpeed.webVitals;
  if (cwv.lcp !== null) {
    if (cwv.lcp <= 2500) details.push("LCP iyi (≤2.5s)");
    else if (cwv.lcp > 4000) {
      score = Math.max(0, score - 5);
      details.push("LCP kötü (>4s)");
    }
  }
  if (cwv.cls !== null) {
    if (cwv.cls <= 0.1) details.push("CLS iyi (≤0.1)");
    else if (cwv.cls > 0.25) {
      score = Math.max(0, score - 5);
      details.push("CLS kötü (>0.25)");
    }
  }

  return { score: clamp(score), label: "Performans", color: getColor(score), details };
}

// ── SEO Skoru (%20 ağırlık) ──
function scoreSEO(crawl: CrawlResult, pageSpeed: PageSpeedResult): CategoryScore {
  const details: string[] = [];
  let score = 0;

  // PageSpeed SEO skoru (0-100 → max 40 puan)
  if (pageSpeed.scores.seo !== null) {
    score += (pageSpeed.scores.seo / 100) * 40;
    details.push(`PageSpeed SEO: ${pageSpeed.scores.seo}`);
  }

  // Title var mı (10 puan)
  if (crawl.basicInfo.title) {
    score += 10;
    const len = crawl.basicInfo.title.length;
    if (len >= 30 && len <= 60) details.push(`Başlık uzunluğu iyi (${len} karakter)`);
    else details.push(`Başlık uzunluğu: ${len} karakter (ideal: 30-60)`);
  } else {
    details.push("Başlık (title) eksik!");
  }

  // Meta description var mı (10 puan)
  if (crawl.basicInfo.metaDescription) {
    score += 10;
    const len = crawl.basicInfo.metaDescription.length;
    if (len >= 120 && len <= 160) details.push(`Meta açıklama uzunluğu iyi (${len})`);
    else details.push(`Meta açıklama: ${len} karakter (ideal: 120-160)`);
  } else {
    details.push("Meta açıklama eksik!");
  }

  // H1 var mı (10 puan)
  if (crawl.headings.totalH1 === 1) {
    score += 10;
    details.push("Tek H1 — doğru");
  } else if (crawl.headings.totalH1 > 1) {
    score += 5;
    details.push(`${crawl.headings.totalH1} adet H1 — tek olmalı`);
  } else {
    details.push("H1 yok!");
  }

  // Canonical (5 puan)
  if (crawl.metaSEO.canonical) { score += 5; details.push("Canonical var"); }
  else details.push("Canonical eksik");

  // OG tags (5 puan)
  if (Object.keys(crawl.metaSEO.ogTags).length >= 3) {
    score += 5;
    details.push("Open Graph tag'leri var");
  } else details.push("Open Graph eksik/yetersiz");

  // Sitemap (5 puan)
  if (crawl.technical.hasSitemap) { score += 5; details.push("Sitemap var"); }
  else details.push("Sitemap yok");

  // Robots.txt (5 puan)
  if (crawl.technical.hasRobotsTxt) { score += 5; details.push("Robots.txt var"); }
  else details.push("Robots.txt yok");

  // Schema.org (5 puan)
  if (crawl.technical.hasSchemaOrg) { score += 5; details.push("Schema.org / JSON-LD var"); }
  else details.push("Yapılandırılmış veri (Schema) yok");

  // Viewport (5 puan)
  if (crawl.metaSEO.viewport) { score += 5; }

  // noindex kontrolü — kritik SEO cezası
  const robotsMeta = crawl.metaSEO.robots?.toLowerCase() || "";
  if (robotsMeta.includes("noindex")) {
    score = Math.max(0, score - 30);
    details.push("noindex aktif — arama motorları sayfayı indexlemez!");
  }

  // robots.txt Disallow: / kontrolü (tam satır eşleşmesi — "Disallow: /path" yanlış tetiklemesin)
  const robotsTxt = crawl.technical.robotsTxtContent || "";
  const hasFullDisallow = robotsTxt
    .split(/\r?\n/)
    .some((line) => /^\s*disallow:\s*\/\s*$/i.test(line));
  if (hasFullDisallow) {
    score = Math.max(0, score - 15);
    details.push("robots.txt tüm tarayıcıları engelliyor");
  }

  return { score: clamp(score), label: "SEO", color: getColor(score), details };
}

// ── Security Skoru (%15 ağırlık) ──
function scoreSecurity(
  crawl: CrawlResult,
  ssl: SSLInfo,
  securityHeaders: SecurityHeadersResult,
  safeBrowsing: SafeBrowsingResult
): CategoryScore {
  const details: string[] = [];
  let score = 0;

  // HTTPS (25 puan)
  if (crawl.security.isHttps) { score += 25; details.push("HTTPS aktif"); }
  else details.push("HTTPS yok — kritik!");

  // SSL geçerli (20 puan)
  if (ssl.valid) {
    score += 20;
    if (ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry > 30) {
      details.push(`SSL geçerli (${ssl.daysUntilExpiry} gün)`);
    } else if (ssl.daysUntilExpiry !== null) {
      score -= 5;
      details.push(`SSL yakında bitiyor (${ssl.daysUntilExpiry} gün)`);
    }
  } else {
    details.push("SSL sertifikası geçersiz");
  }

  // Mixed content yok (10 puan)
  if (!crawl.security.hasMixedContent) {
    score += 10;
  } else {
    details.push(`Mixed content: ${crawl.security.mixedContentUrls.length} sorun`);
  }

  // Security headers (30 puan)
  if (securityHeaders.grade) {
    const gradeScores: Record<string, number> = { "A+": 30, A: 25, B: 20, C: 15, D: 10, F: 0 };
    const headerScore = gradeScores[securityHeaders.grade] ?? 10;
    score += headerScore;
    details.push(`Güvenlik header'ları: ${securityHeaders.grade}`);
    if (securityHeaders.missingHeaders.length > 0) {
      details.push(`Eksik: ${securityHeaders.missingHeaders.join(", ")}`);
    }
  }

  // Safe Browsing (15 puan)
  if (safeBrowsing.safe) {
    score += 15;
    details.push("Google Safe Browsing: temiz");
  } else {
    details.push(`Tehdit bulundu: ${safeBrowsing.threats.join(", ")}`);
  }

  return { score: clamp(score), label: "Güvenlik", color: getColor(score), details };
}

// ── Accessibility Skoru (%10 ağırlık) ──
function scoreAccessibility(crawl: CrawlResult, pageSpeed: PageSpeedResult): CategoryScore {
  const details: string[] = [];
  let score = 50;

  if (pageSpeed.scores.accessibility !== null) {
    score = pageSpeed.scores.accessibility;
    details.push(`PageSpeed Erişilebilirlik: ${score}`);
  }

  // Alt tag kontrolü
  if (crawl.images.total > 0) {
    const altRatio = 1 - (crawl.images.totalMissingAlt / crawl.images.total);
    if (altRatio >= 0.9) details.push("Alt tag'ler iyi");
    else {
      score = Math.max(0, score - 10);
      details.push(`${crawl.images.totalMissingAlt}/${crawl.images.total} görselde alt tag eksik`);
    }
  }

  // Language attribute
  if (crawl.basicInfo.language) details.push("HTML lang attribute var");
  else {
    score = Math.max(0, score - 5);
    details.push("HTML lang attribute eksik");
  }

  return { score: clamp(score), label: "Erişilebilirlik", color: getColor(score), details };
}

// ── Best Practices Skoru (%10 ağırlık) ──
function scoreBestPractices(
  crawl: CrawlResult,
  pageSpeed: PageSpeedResult,
  htmlValidation: HTMLValidationResult
): CategoryScore {
  const details: string[] = [];
  let score = 0;

  // PageSpeed best practices (40 puan)
  if (pageSpeed.scores.bestPractices !== null) {
    score += (pageSpeed.scores.bestPractices / 100) * 40;
    details.push(`PageSpeed Best Practices: ${pageSpeed.scores.bestPractices}`);
  }

  // HTML valid (20 puan)
  if (htmlValidation.errors === 0) {
    score += 20;
    details.push("HTML hatasız");
  } else if (htmlValidation.errors < 10) {
    score += 10;
    details.push(`${htmlValidation.errors} HTML hatası`);
  } else {
    details.push(`${htmlValidation.errors} HTML hatası — çok fazla`);
  }

  // Sitemap (10 puan)
  if (crawl.technical.hasSitemap) { score += 10; }

  // Robots.txt (10 puan)
  if (crawl.technical.hasRobotsTxt) { score += 10; }

  // Charset (5 puan)
  if (crawl.basicInfo.charset) { score += 5; }

  // Favicon (5 puan)
  if (crawl.basicInfo.favicon) { score += 5; details.push("Favicon var"); }
  else details.push("Favicon eksik");

  // Viewport (5 puan)
  if (crawl.metaSEO.viewport) { score += 5; }

  // Broken links cezası
  if (crawl.links.totalBroken > 0) {
    score = Math.max(0, score - crawl.links.totalBroken * 2);
    details.push(`${crawl.links.totalBroken} kırık link`);
  }

  return { score: clamp(score), label: "Best Practices", color: getColor(score), details };
}

// ── Domain Trust Skoru (%10 ağırlık) ──
function scoreDomainTrust(
  crawl: CrawlResult,
  ssl: SSLInfo,
  domainInfo: DomainInfo,
  dns: DNSResult,
  pageAnalysis: PageAnalysis
): CategoryScore {
  const details: string[] = [];
  let score = 0;

  // Domain yaşı (25 puan)
  if (domainInfo.domainAge !== null) {
    if (domainInfo.domainAge > 1825) { // 5+ yıl
      score += 25;
      details.push(`Domain ${Math.floor(domainInfo.domainAge / 365)} yaşında`);
    } else if (domainInfo.domainAge > 365) {
      score += 15;
      details.push(`Domain ${Math.floor(domainInfo.domainAge / 365)} yaşında`);
    } else {
      score += 5;
      details.push(`Domain ${domainInfo.domainAge} günlük — yeni`);
    }
  }

  // HTTPS (15 puan)
  if (crawl.security.isHttps && ssl.valid) score += 15;

  // Trust sinyalleri (30 puan)
  const trust = pageAnalysis.trustSignals;
  if (trust.hasPrivacyPolicy) { score += 8; details.push("Gizlilik politikası var"); }
  if (trust.hasTerms) { score += 7; details.push("Kullanım koşulları var"); }
  if (trust.hasContactInfo) { score += 8; details.push("İletişim bilgisi var"); }
  if (trust.hasEmail) { score += 4; }
  if (trust.hasPhoneNumber) { score += 3; }

  // DNS sağlığı (15 puan)
  if (dns.hasSPF) { score += 5; details.push("SPF kaydı var"); }
  if (dns.hasDMARC) { score += 5; details.push("DMARC kaydı var"); }
  if (dns.mxRecords.length > 0) { score += 5; details.push("MX kaydı var"); }

  // Social media varlığı (10 puan)
  if (pageAnalysis.socialLinks.length >= 3) {
    score += 10;
    details.push(`${pageAnalysis.socialLinks.length} sosyal medya linki`);
  } else if (pageAnalysis.socialLinks.length > 0) {
    score += 5;
  }

  return { score: clamp(score), label: "Domain Güven", color: getColor(score), details };
}

// ── Content Skoru (%10 ağırlık) ──
function scoreContent(crawl: CrawlResult): CategoryScore {
  const details: string[] = [];
  let score = 0;

  // Kelime sayısı (30 puan)
  const wc = crawl.content.wordCount;
  if (wc >= 300) {
    score += 30;
    details.push(`${wc} kelime — iyi`);
  } else if (wc >= 100) {
    score += 15;
    details.push(`${wc} kelime — az`);
  } else {
    details.push(`${wc} kelime — çok az`);
  }

  // Heading yapısı (20 puan)
  if (crawl.headings.totalH1 >= 1 && crawl.headings.totalH2 >= 1) {
    score += 20;
    details.push("Başlık hiyerarşisi var");
  } else if (crawl.headings.totalH1 >= 1) {
    score += 10;
  }

  // İç linkler (15 puan)
  if (crawl.links.totalInternal >= 5) {
    score += 15;
    details.push(`${crawl.links.totalInternal} iç link`);
  } else if (crawl.links.totalInternal >= 1) {
    score += 7;
  }

  // Dış linkler (10 puan)
  if (crawl.links.totalExternal >= 1) {
    score += 10;
  }

  // İçerik/kod oranı (15 puan)
  if (crawl.content.contentToCodeRatio >= 20) {
    score += 15;
  } else if (crawl.content.contentToCodeRatio >= 10) {
    score += 8;
  } else {
    details.push(`İçerik/kod oranı düşük (%${crawl.content.contentToCodeRatio})`);
  }

  // Görseller (10 puan)
  if (crawl.images.total >= 1) {
    score += 10;
    details.push(`${crawl.images.total} görsel`);
  } else {
    details.push("Görsel yok");
  }

  return { score: clamp(score), label: "İçerik", color: getColor(score), details };
}

// ── Technology Skoru (%5 ağırlık) ──
function scoreTechnology(crawl: CrawlResult, pageAnalysis: PageAnalysis): CategoryScore {
  const details: string[] = [];
  let score = 0;

  // Analytics var mı (30 puan)
  const a = pageAnalysis.analytics;
  if (a.hasGoogleAnalytics || a.hasGTM) {
    score += 30;
    details.push("Google Analytics/GTM var");
  }
  if (a.hasMetaPixel) { score += 5; details.push("Meta Pixel var"); }
  if (a.otherTools.length > 0) {
    score += 5;
    details.push(`Diğer: ${a.otherTools.join(", ")}`);
  }

  // Platform tespiti (20 puan) — modern stack bonusu
  if (crawl.techDetection.platform) {
    score += 20;
    details.push(`Platform: ${crawl.techDetection.platform}`);
  }

  // CSS framework (10 puan)
  if (pageAnalysis.cssFrameworks.length > 0) {
    score += 10;
    details.push(`CSS: ${pageAnalysis.cssFrameworks.join(", ")}`);
  }

  // Font kullanımı (10 puan)
  if (pageAnalysis.fonts.length > 0) {
    score += 10;
    details.push(`Fontlar: ${pageAnalysis.fonts.join(", ")}`);
  }

  // Schema.org (15 puan)
  if (crawl.technical.hasSchemaOrg) {
    score += 15;
  }

  // Form/CTA varlığı (10 puan)
  if (pageAnalysis.cta.forms > 0 || pageAnalysis.cta.buttons > 0) {
    score += 10;
  }

  return { score: clamp(score), label: "Teknoloji", color: getColor(score), details };
}

// ── Online Presence (Dijital Varlık) Skoru (%10 ağırlık) ──
function scoreOnlinePresence(
  onlinePresence: OnlinePresenceResult | undefined,
  domainInfo: DomainInfo
): CategoryScore {
  const details: string[] = [];

  if (!onlinePresence) {
    return { score: 0, label: "Dijital Varlık", color: "yellow", details: ["Online presence verisi yok"], noData: true };
  }

  // Serper verisi yoksa → noData
  if (onlinePresence.googleIndex.noData) {
    details.push("Google index verisi alınamadı (API key yok)");
    return { score: 0, label: "Dijital Varlık", color: "yellow", details, noData: true };
  }

  let score = 0;

  // ── Google'da indexli (15 puan) ──
  if (onlinePresence.googleIndex.isIndexed) {
    score += 15;
    details.push("Google'da indexli");
  } else {
    details.push("Google'da indexli değil!");
  }

  // ── 10+ sayfa indexli (+10 puan) ──
  const indexedPages = onlinePresence.googleIndex.indexedPageCount;
  if (indexedPages >= 10) {
    score += 10;
    details.push(`${indexedPages} sayfa indexli`);
  } else if (indexedPages > 0) {
    details.push(`Sadece ${indexedPages} sayfa indexli`);
  }

  // ── Rich snippet (+5 puan) ──
  if (onlinePresence.googleIndex.hasRichSnippet) {
    score += 5;
    details.push("Rich snippet mevcut");
  }

  // ── Brand mentions (10/7/5 puan) ──
  const mentions = onlinePresence.googleIndex.brandMentions;
  if (mentions >= 50) {
    score += 10;
    details.push(`${mentions} marka bahsetmesi`);
  } else if (mentions >= 10) {
    score += 7;
    details.push(`${mentions} marka bahsetmesi`);
  } else if (mentions >= 1) {
    score += 5;
    details.push(`${mentions} marka bahsetmesi`);
  } else {
    details.push("Dış sitelerde marka bahsetmesi yok");
  }

  // ── 3+ sosyal profil doğrulandı (15 puan) ──
  const verifiedSocials = onlinePresence.socialPresence.totalVerified;
  if (verifiedSocials >= 3) {
    score += 15;
    details.push(`${verifiedSocials} sosyal profil doğrulandı`);
  } else if (verifiedSocials > 0) {
    score += 7;
    details.push(`Sadece ${verifiedSocials} sosyal profil doğrulandı`);
  } else {
    details.push("Doğrulanmış sosyal profil yok");
  }
  if (onlinePresence.socialPresence.totalInvalid > 0) {
    details.push(`${onlinePresence.socialPresence.totalInvalid} sosyal profil erişilemiyor`);
  }

  // ── Webmaster tags (7 + 2 + 1 = 10 puan) ──
  const wm = onlinePresence.webmasterTags;
  if (wm.google) { score += 7; details.push("Google Search Console doğrulandı"); }
  else details.push("Google Search Console verification yok");
  if (wm.bing) { score += 2; details.push("Bing Webmaster doğrulandı"); }
  if (wm.yandex) { score += 1; details.push("Yandex Webmaster doğrulandı"); }

  // ── Wayback snapshot (15/10/5 puan) ──
  const snapshots = onlinePresence.waybackHistory.snapshotCount;
  if (snapshots >= 50) {
    score += 15;
    details.push(`Wayback'te ${snapshots} snapshot`);
  } else if (snapshots >= 10) {
    score += 10;
    details.push(`Wayback'te ${snapshots} snapshot`);
  } else if (snapshots >= 1) {
    score += 5;
    details.push(`Wayback'te ${snapshots} snapshot`);
  } else {
    details.push("Wayback Machine'de kayıt yok");
  }

  // ── Schema.org complete (5 puan) ──
  if (onlinePresence.structuredData.schemaComplete) {
    score += 5;
    details.push(`Schema.org: ${onlinePresence.structuredData.schemaTypes.join(", ")}`);
  } else {
    details.push("Schema.org eksik/yetersiz");
  }

  // ── Open Graph complete (5 puan) ──
  if (onlinePresence.structuredData.ogComplete) {
    score += 5;
    details.push("Open Graph tag'leri tam");
  } else {
    details.push("Open Graph tag'leri eksik");
  }

  // ── Domain age bonus (10/5 puan) ──
  const domainAge = domainInfo.domainAge;
  if (domainAge !== null) {
    const ageYears = domainAge / 365;
    if (ageYears >= 5) {
      score += 10;
      details.push(`Domain ${Math.floor(ageYears)} yaşında (5+ yıl)`);
    } else if (ageYears >= 1) {
      score += 5;
      details.push(`Domain ${Math.floor(ageYears)} yaşında`);
    } else {
      details.push(`Domain ${Math.round(ageYears * 12)} aylık — yeni`);
    }
  }

  return { score: clamp(score), label: "Dijital Varlık", color: getColor(score), details };
}

// ── Ana Puanlama Fonksiyonu ──
export function calculateScores(
  crawl: CrawlResult,
  pageSpeed: PageSpeedResult,
  ssl: SSLInfo,
  domainInfo: DomainInfo,
  securityHeaders: SecurityHeadersResult,
  safeBrowsing: SafeBrowsingResult,
  dns: DNSResult,
  htmlValidation: HTMLValidationResult,
  pageAnalysis: PageAnalysis,
  onlinePresence?: OnlinePresenceResult,
  crawlReliable: boolean = true
): ScoringResult {
  const noHtmlData = (label: string): CategoryScore => ({
    score: 0, label, color: "yellow", details: ["Sayfa HTML verisi alınamadı (bot koruması olabilir)"], noData: true,
  });

  const performance = scorePerformance(pageSpeed);
  const seo = crawlReliable ? scoreSEO(crawl, pageSpeed) : noHtmlData("SEO");
  const security = scoreSecurity(crawl, ssl, securityHeaders, safeBrowsing);
  const accessibility = crawlReliable ? scoreAccessibility(crawl, pageSpeed) : noHtmlData("Erişilebilirlik");
  const bestPractices = crawlReliable ? scoreBestPractices(crawl, pageSpeed, htmlValidation) : noHtmlData("Best Practices");
  const domainTrust = scoreDomainTrust(crawl, ssl, domainInfo, dns, pageAnalysis);
  const content = crawlReliable ? scoreContent(crawl) : noHtmlData("İçerik");
  const technology = crawlReliable ? scoreTechnology(crawl, pageAnalysis) : noHtmlData("Teknoloji");
  const onlinePresenceCat = scoreOnlinePresence(onlinePresence, domainInfo);

  // Ağırlıklı ortalama — noData olan kategoriler hariç tutulur
  const weights: { cat: CategoryScore; weight: number }[] = [
    { cat: performance, weight: 0.18 },
    { cat: seo, weight: 0.18 },
    { cat: security, weight: 0.14 },
    { cat: accessibility, weight: 0.09 },
    { cat: bestPractices, weight: 0.09 },
    { cat: domainTrust, weight: 0.09 },
    { cat: content, weight: 0.09 },
    { cat: technology, weight: 0.04 },
    { cat: onlinePresenceCat, weight: 0.10 },
  ];

  const active = weights.filter((w) => !w.cat.noData);
  const totalWeight = active.reduce((sum, w) => sum + w.weight, 0);
  const overall = Math.round(
    active.reduce((sum, w) => sum + w.cat.score * (w.weight / totalWeight), 0)
  );

  return {
    overall,
    overallColor: getColor(overall),
    categories: {
      performance,
      seo,
      security,
      accessibility,
      bestPractices,
      domainTrust,
      content,
      technology,
      onlinePresence: onlinePresenceCat,
    },
  };
}
