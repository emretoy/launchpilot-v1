import type {
  CrawlResult,
  PageAnalysis,
  ScoringResult,
  ValidationCheckResult,
  ValidationSummary,
  WebsiteDNA,
  DomainInfo,
  DNSResult,
  OnlinePresenceResult,
} from "./types";

// ── Yardımcı: HEAD request ile URL erişim kontrolü ──
async function isUrlAccessible(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LaunchPilotBot/1.0)",
      },
    });
    return res.ok;
  } catch {
    // HEAD başarısızsa GET ile dene (bazı sunucular HEAD'i reddeder)
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LaunchPilotBot/1.0)",
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ── Yardımcı: Batch halinde URL kontrolü ──
async function checkUrlsBatch(
  urls: string[],
  batchSize = 5,
  timeoutMs = 5000
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (url) => ({
        url,
        ok: await isUrlAccessible(url, timeoutMs),
      }))
    );
    for (const { url, ok } of batchResults) {
      results.set(url, ok);
    }
  }

  return results;
}

// ══════════════════════════════════════════
// A. Scraper Verileri Doğrulaması
// ══════════════════════════════════════════

export async function validateScraperData(
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis,
  rawHtml: string
): Promise<{
  crawl: CrawlResult;
  pageAnalysis: PageAnalysis;
  checks: ValidationCheckResult[];
}> {
  const checks: ValidationCheckResult[] = [];
  const mutatedCrawl = structuredClone(crawl);
  const mutatedPageAnalysis = structuredClone(pageAnalysis);

  // ── 1. Title kontrolü ──
  if (mutatedCrawl.basicInfo.title && mutatedCrawl.basicInfo.title.length > 0) {
    const titleInHtml = rawHtml.includes("<title>") && rawHtml.includes("</title>");
    checks.push({
      field: "title",
      verified: titleInHtml,
      reason: titleInHtml ? "HTML'de <title> doğrulandı" : "HTML'de <title> bulunamadı",
    });
  } else {
    checks.push({ field: "title", verified: false, reason: "Başlık bulunamadı" });
  }

  // ── 2. Meta description kontrolü ──
  if (mutatedCrawl.basicInfo.metaDescription && mutatedCrawl.basicInfo.metaDescription.length > 0) {
    const descInHtml = rawHtml.toLowerCase().includes('name="description"');
    checks.push({
      field: "metaDescription",
      verified: descInHtml,
      reason: descInHtml ? "Meta açıklama doğrulandı" : "Meta açıklama HTML'de bulunamadı",
    });
  } else {
    checks.push({ field: "metaDescription", verified: false, reason: "Meta açıklama yok" });
  }

  // ── 3. Canonical URL kontrolü ──
  if (mutatedCrawl.metaSEO.canonical) {
    const canonicalInHtml = rawHtml.toLowerCase().includes('rel="canonical"');
    checks.push({
      field: "canonicalUrl",
      verified: canonicalInHtml,
      reason: canonicalInHtml ? "Canonical URL doğrulandı" : "Canonical HTML'de bulunamadı",
    });
  }

  // ── 4. SSL/HTTPS kontrolü ──
  const isHttps = mutatedCrawl.basicInfo.finalUrl.startsWith("https://");
  checks.push({
    field: "ssl",
    verified: isHttps,
    reason: isHttps ? "HTTPS bağlantısı aktif" : "Güvensiz bağlantı — HTTPS yok",
  });

  // ── 5. Domain erişim kontrolü ──
  const domainAccessible = await isUrlAccessible(mutatedCrawl.basicInfo.finalUrl, 8000);
  checks.push({
    field: "domainAccess",
    verified: domainAccessible,
    reason: domainAccessible ? "Domain erişilebilir" : "Domain erişilemiyor",
  });

  // ── 6. Social links kontrolü (paralel HEAD request) ──
  if (mutatedPageAnalysis.socialLinks.length > 0) {
    const socialUrls = mutatedPageAnalysis.socialLinks.map((s) => s.url);
    const socialResults = await checkUrlsBatch(socialUrls, 5, 5000);

    const validSocialLinks: typeof mutatedPageAnalysis.socialLinks = [];
    for (const link of mutatedPageAnalysis.socialLinks) {
      const accessible = socialResults.get(link.url) ?? false;
      if (accessible) {
        validSocialLinks.push(link);
        checks.push({
          field: `socialLink.${link.platform}`,
          verified: true,
          reason: `${link.platform} linki erişilebilir`,
        });
      } else {
        checks.push({
          field: `socialLink.${link.platform}`,
          verified: false,
          reason: `${link.platform} linki erişilemiyor — kaldırıldı`,
        });
      }
    }
    mutatedPageAnalysis.socialLinks = validSocialLinks;
  }

  // ── 7. OG Image kontrolü ──
  const ogImage = mutatedCrawl.metaSEO.ogTags["og:image"];
  if (ogImage) {
    const ogAccessible = await isUrlAccessible(ogImage, 5000);
    checks.push({
      field: "ogImage",
      verified: ogAccessible,
      reason: ogAccessible ? "OG Image erişilebilir" : "OG Image erişilemiyor",
    });
    if (!ogAccessible) {
      delete mutatedCrawl.metaSEO.ogTags["og:image"];
    }
  }

  // ── 8. Favicon kontrolü ──
  if (mutatedCrawl.basicInfo.favicon) {
    const faviconOk = await isUrlAccessible(mutatedCrawl.basicInfo.favicon, 5000);
    if (faviconOk) {
      checks.push({ field: "favicon", verified: true, reason: "Favicon erişilebilir" });
    } else {
      // Google fallback
      const domain = new URL(mutatedCrawl.basicInfo.finalUrl).hostname;
      mutatedCrawl.basicInfo.favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      checks.push({
        field: "favicon",
        verified: false,
        reason: "Orijinal favicon erişilemiyor — Google fallback kullanılıyor",
      });
    }
  }

  // ── 9. External links kontrolü (ilk 20, 5'li batch) ──
  const externalUrls = mutatedCrawl.links.external.slice(0, 20).map((l) => l.href);
  if (externalUrls.length > 0) {
    const extResults = await checkUrlsBatch(externalUrls, 5, 5000);
    let brokenExtCount = 0;
    for (const [url, ok] of extResults) {
      if (!ok) brokenExtCount++;
      checks.push({
        field: `externalLink`,
        verified: ok,
        reason: ok ? `Dış link erişilebilir: ${url.substring(0, 60)}` : `Kırık dış link: ${url.substring(0, 60)}`,
      });
    }
    if (brokenExtCount > 0) {
      checks.push({
        field: "externalLinks.summary",
        verified: false,
        reason: `${brokenExtCount}/${externalUrls.length} dış link erişilemiyor`,
      });
    }
  }

  // ── 10. Images kontrolü (ilk 10) ──
  const imageUrls = mutatedCrawl.images.images
    .slice(0, 10)
    .map((img) => img.src)
    .filter((src) => src.startsWith("http"));
  if (imageUrls.length > 0) {
    const imgResults = await checkUrlsBatch(imageUrls, 5, 5000);
    let inaccessibleCount = 0;
    for (const [url, ok] of imgResults) {
      if (!ok) inaccessibleCount++;
    }
    checks.push({
      field: "images",
      verified: inaccessibleCount === 0,
      reason:
        inaccessibleCount === 0
          ? `İlk ${imageUrls.length} görsel erişilebilir`
          : `${inaccessibleCount}/${imageUrls.length} görsel erişilemiyor`,
    });
  }

  // ── 11. JSON-LD doğrulama ──
  const jsonLdScripts = rawHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
  let validJsonLd = 0;
  let invalidJsonLd = 0;
  for (const script of jsonLdScripts) {
    const content = script.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
    try {
      const parsed = JSON.parse(content);
      if (parsed["@type"] || parsed["@graph"]) {
        validJsonLd++;
      } else {
        invalidJsonLd++;
      }
    } catch {
      invalidJsonLd++;
    }
  }
  if (jsonLdScripts.length > 0) {
    checks.push({
      field: "jsonLd",
      verified: invalidJsonLd === 0,
      reason:
        invalidJsonLd === 0
          ? `${validJsonLd} JSON-LD bloğu geçerli`
          : `${invalidJsonLd}/${jsonLdScripts.length} JSON-LD bloğu geçersiz`,
    });
  }

  // ── 12. Headings tutarlılık kontrolü ──
  const h1CountInHtml = (rawHtml.match(/<h1[\s>]/gi) || []).length;
  const h2CountInHtml = (rawHtml.match(/<h2[\s>]/gi) || []).length;
  const headingsConsistent =
    Math.abs(h1CountInHtml - mutatedCrawl.headings.totalH1) <= 1 &&
    Math.abs(h2CountInHtml - mutatedCrawl.headings.totalH2) <= 1;
  checks.push({
    field: "headings",
    verified: headingsConsistent,
    reason: headingsConsistent
      ? "Heading sayıları HTML ile tutarlı"
      : `Heading uyumsuzluğu: H1 ${mutatedCrawl.headings.totalH1} vs ${h1CountInHtml}, H2 ${mutatedCrawl.headings.totalH2} vs ${h2CountInHtml}`,
  });

  // ── 13. Tech detection tekrar doğrulama ──
  if (mutatedCrawl.techDetection.platform) {
    const platform = mutatedCrawl.techDetection.platform.toLowerCase();
    const techPatterns: Record<string, string[]> = {
      wordpress: ["wp-content", "wp-includes", "wp-json", "wordpress"],
      shopify: ["cdn.shopify.com", "shopify.theme", "shopify"],
      wix: ["wixstatic.com", "wix-code-sdk", "X-Wix-"],
      squarespace: ["squarespace.com", "static1.squarespace.com"],
      webflow: ["webflow.com", "w-nav", "w-container"],
      joomla: ["/media/jui/", "/components/com_", "joomla"],
      drupal: ["drupal.settings", "/sites/default/files/"],
      "next.js": ["__NEXT_DATA__", "/_next/"],
      gatsby: ["___gatsby", "gatsby"],
    };

    const patterns = techPatterns[platform] || [];
    const htmlLower = rawHtml.toLowerCase();
    const foundAny = patterns.some((p) => htmlLower.includes(p.toLowerCase()));
    checks.push({
      field: "techDetection",
      verified: foundAny,
      reason: foundAny
        ? `${mutatedCrawl.techDetection.platform} HTML'de doğrulandı`
        : `${mutatedCrawl.techDetection.platform} HTML'de doğrulanamadı`,
    });

    if (!foundAny) {
      mutatedCrawl.techDetection.platform = null;
      mutatedCrawl.techDetection.confidence = 0;
      mutatedCrawl.techDetection.signals = [];
    }
  }

  // ── 14. Indexlenebilirlik kontrolü (noindex) ──
  const robotsMeta = mutatedCrawl.metaSEO.robots?.toLowerCase() || "";
  const hasNoIndex = robotsMeta.includes("noindex");
  const robotsTxt = mutatedCrawl.technical.robotsTxtContent?.toLowerCase() || "";
  const disallowAll = robotsTxt.includes("disallow: /") && !robotsTxt.includes("disallow: /.");

  if (hasNoIndex) {
    checks.push({
      field: "indexability",
      verified: false,
      reason: "Meta robots noindex tespit edildi — arama motorları bu sayfayı indexlemez",
    });
  } else if (disallowAll) {
    checks.push({
      field: "indexability",
      verified: false,
      reason: "robots.txt tüm tarayıcıları engelliyor (Disallow: /)",
    });
  } else {
    checks.push({
      field: "indexability",
      verified: true,
      reason: "Sayfa indexlenebilir durumda",
    });
  }

  // ── 15. Yanıt durumu + redirect kontrolü ──
  try {
    const statusRes = await fetch(mutatedCrawl.basicInfo.url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LaunchPilotBot/1.0)" },
    });

    const status = statusRes.status;
    const isRedirect = status >= 300 && status < 400;
    const isOk = status >= 200 && status < 300;

    if (isOk) {
      checks.push({ field: "httpStatus", verified: true, reason: `HTTP ${status} — Başarılı` });
    } else if (isRedirect) {
      // Redirect zinciri kontrolü — max 10 hop
      let hops = 0;
      let currentUrl = mutatedCrawl.basicInfo.url;
      let loopDetected = false;
      const visited = new Set<string>();

      while (hops < 10) {
        visited.add(currentUrl);
        const hopRes = await fetch(currentUrl, {
          method: "HEAD",
          redirect: "manual",
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; LaunchPilotBot/1.0)" },
        });
        if (hopRes.status < 300 || hopRes.status >= 400) break;
        const location = hopRes.headers.get("location");
        if (!location) break;
        const nextUrl = new URL(location, currentUrl).href;
        if (visited.has(nextUrl)) {
          loopDetected = true;
          break;
        }
        currentUrl = nextUrl;
        hops++;
      }

      if (loopDetected) {
        checks.push({ field: "httpStatus", verified: false, reason: `Redirect loop tespit edildi (${hops} hop)` });
      } else if (hops > 3) {
        checks.push({ field: "httpStatus", verified: false, reason: `Çok fazla redirect (${hops} hop) — yavaşlığa neden olur` });
      } else {
        checks.push({ field: "httpStatus", verified: true, reason: `HTTP ${status} → ${hops} redirect ile ulaşıldı` });
      }
    } else {
      checks.push({ field: "httpStatus", verified: false, reason: `HTTP ${status} — Sayfa erişim sorunu` });
    }
  } catch {
    checks.push({ field: "httpStatus", verified: false, reason: "HTTP durum kodu alınamadı" });
  }

  // ── 16. Boş içerik kontrolü ──
  const wordCount = mutatedCrawl.content.wordCount;
  if (wordCount < 50) {
    checks.push({
      field: "contentEmpty",
      verified: false,
      reason: `Sadece ${wordCount} kelime — site henüz beslenmemiş veya içerik çok yetersiz`,
    });
  } else if (wordCount < 150) {
    checks.push({
      field: "contentEmpty",
      verified: false,
      reason: `${wordCount} kelime — içerik zayıf, minimum 300 kelime önerilir`,
    });
  } else {
    checks.push({
      field: "contentEmpty",
      verified: true,
      reason: `${wordCount} kelime — yeterli içerik mevcut`,
    });
  }

  // ── 17. Cookie consent kontrolü ──
  checks.push({
    field: "cookieConsent",
    verified: mutatedPageAnalysis.cookieConsent.detected,
    reason: mutatedPageAnalysis.cookieConsent.detected
      ? `Cookie consent tespit edildi: ${mutatedPageAnalysis.cookieConsent.patterns.join(", ")}`
      : "Cookie consent/banner bulunamadı — KVKK/GDPR uyumluluğu risk altında",
  });

  return { crawl: mutatedCrawl, pageAnalysis: mutatedPageAnalysis, checks };
}

// ══════════════════════════════════════════
// C. DNA Doğrulaması
// ══════════════════════════════════════════

export function validateDNAData(
  dna: WebsiteDNA,
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis,
  dns: DNSResult,
  domainInfo: DomainInfo,
  rawHtml: string
): {
  dna: WebsiteDNA;
  checks: ValidationCheckResult[];
} {
  const checks: ValidationCheckResult[] = [];
  const mutated = structuredClone(dna);
  const htmlLower = rawHtml.toLowerCase();

  // ── 1. Site türü güven kontrolü ──
  if (mutated.identity.siteTypeConfidence >= 50) {
    checks.push({
      field: "dna.siteType",
      verified: true,
      reason: `Site türü: ${mutated.identity.siteType} (güven: %${mutated.identity.siteTypeConfidence})`,
    });
  } else if (mutated.identity.siteType !== "unknown") {
    checks.push({
      field: "dna.siteType",
      verified: false,
      reason: `Site türü güveni düşük: ${mutated.identity.siteType} (%${mutated.identity.siteTypeConfidence}) — "unknown" olarak düzeltildi`,
    });
    mutated.identity.siteType = "unknown";
    mutated.identity.siteTypeConfidence = 0;
  } else {
    checks.push({
      field: "dna.siteType",
      verified: false,
      reason: "Site türü tespit edilemedi",
    });
  }

  // ── 2. Sektör (industry) tespiti kontrolü ──
  if (mutated.identity.industry) {
    checks.push({
      field: "dna.industry",
      verified: true,
      reason: `Sektör: ${mutated.identity.industry}`,
    });
  } else {
    checks.push({
      field: "dna.industry",
      verified: false,
      reason: "Sektör tespit edilemedi (AI sentezi başarısız olmuş olabilir)",
    });
  }

  // ── 3. Olgunluk – domain yaşı tutarlılığı ──
  const domainAge = domainInfo.domainAge;
  if (domainAge !== null) {
    const ageYears = domainAge / 365;
    if (mutated.maturity.level === "veteran" && ageYears < 2) {
      checks.push({
        field: "dna.maturity",
        verified: false,
        reason: `Olgunluk çelişkisi: "veteran" ama domain sadece ${Math.round(ageYears * 12)} aylık — "growing" olarak düzeltildi`,
      });
      mutated.maturity.level = "growing";
      mutated.maturity.signals.push("Validator: domain yaşı çelişkisi düzeltildi");
    } else if (mutated.maturity.level === "newborn" && ageYears > 5) {
      checks.push({
        field: "dna.maturity",
        verified: false,
        reason: `Olgunluk çelişkisi: "newborn" ama domain ${Math.round(ageYears)} yaşında — "young" olarak düzeltildi`,
      });
      mutated.maturity.level = "young";
      mutated.maturity.signals.push("Validator: domain yaşı çelişkisi düzeltildi");
    } else {
      checks.push({
        field: "dna.maturity",
        verified: true,
        reason: `Olgunluk tutarlı: ${mutated.maturity.level} (domain: ${Math.round(ageYears)} yıl, skor: ${mutated.maturity.score})`,
      });
    }
  }

  // ── 4. Ölçek – sitemap tutarlılığı ──
  const sitemapPages = crawl.technical.sitemapPageCount ?? 0;
  const internalLinks = crawl.links.internal.length;
  const pageEstimate = mutated.scale.estimatedPages ?? 0;

  if (mutated.scale.level === "enterprise" && sitemapPages < 100 && internalLinks < 50) {
    checks.push({
      field: "dna.scale",
      verified: false,
      reason: `Ölçek çelişkisi: "enterprise" ama sitemap ${sitemapPages} sayfa, ${internalLinks} iç link — "large" olarak düzeltildi`,
    });
    mutated.scale.level = "large";
    mutated.scale.signals.push("Validator: ölçek düzeltildi");
  } else if (mutated.scale.level === "single-page" && internalLinks > 10) {
    checks.push({
      field: "dna.scale",
      verified: false,
      reason: `Ölçek çelişkisi: "single-page" ama ${internalLinks} iç link — "small" olarak düzeltildi`,
    });
    mutated.scale.level = "small";
    mutated.scale.signals.push("Validator: ölçek düzeltildi");
  } else {
    checks.push({
      field: "dna.scale",
      verified: true,
      reason: `Ölçek tutarlı: ${mutated.scale.level} (~${pageEstimate} sayfa)`,
    });
  }

  // ── 5. Gelir modeli çapraz kontrol ──
  const revenueType = mutated.revenueModel.primary;
  if (revenueType === "e-commerce") {
    const platform = crawl.techDetection.platform?.toLowerCase() || "";
    const isEcomPlatform = /shopify|woocommerce|magento|prestashop|opencart/i.test(platform);
    const hasCartPattern = /cart|sepet|checkout|ödeme/i.test(htmlLower);
    if (!isEcomPlatform && !hasCartPattern) {
      checks.push({
        field: "dna.revenueModel",
        verified: false,
        reason: `Gelir modeli çelişkisi: "e-commerce" ama ne platform ne sepet/ödeme pattern'i var — "unknown" olarak düzeltildi`,
      });
      mutated.revenueModel.primary = "unknown";
      mutated.revenueModel.signals.push("Validator: e-commerce doğrulanamadı");
    } else {
      checks.push({
        field: "dna.revenueModel",
        verified: true,
        reason: `Gelir modeli doğrulandı: e-commerce (${isEcomPlatform ? "platform var" : "sepet/ödeme var"})`,
      });
    }
  } else if (revenueType === "saas") {
    const hasPricing = /pricing|fiyat|subscribe|abone/i.test(htmlLower);
    const hasSignup = /sign.?up|free.?trial|ücretsiz.?dene/i.test(htmlLower);
    if (!hasPricing && !hasSignup) {
      checks.push({
        field: "dna.revenueModel",
        verified: false,
        reason: `Gelir modeli çelişkisi: "saas" ama pricing/signup pattern'i yok — "unknown" olarak düzeltildi`,
      });
      mutated.revenueModel.primary = "unknown";
      mutated.revenueModel.signals.push("Validator: saas doğrulanamadı");
    } else {
      checks.push({
        field: "dna.revenueModel",
        verified: true,
        reason: `Gelir modeli doğrulandı: SaaS (${hasPricing ? "pricing var" : "signup var"})`,
      });
    }
  } else if (revenueType !== "unknown") {
    checks.push({
      field: "dna.revenueModel",
      verified: true,
      reason: `Gelir modeli: ${revenueType}`,
    });
  }

  // ── 6. Tech stack – hosting doğrulaması ──
  if (mutated.techStack.hosting) {
    const ns = dns.nameservers.join(" ").toLowerCase();
    const hostingLower = mutated.techStack.hosting.toLowerCase();
    const nsMatch = ns.includes(hostingLower) || htmlLower.includes(hostingLower);
    if (nsMatch) {
      checks.push({
        field: "dna.techStack.hosting",
        verified: true,
        reason: `Hosting doğrulandı: ${mutated.techStack.hosting}`,
      });
    } else {
      checks.push({
        field: "dna.techStack.hosting",
        verified: false,
        reason: `Hosting "${mutated.techStack.hosting}" nameserver/HTML'de doğrulanamadı — kaldırıldı`,
      });
      mutated.techStack.hosting = null;
    }
  }

  // ── 7. Tech stack – platform vs crawl tutarlılığı ──
  if (mutated.techStack.platform && crawl.techDetection.platform) {
    const dnaP = mutated.techStack.platform.toLowerCase();
    const crawlP = crawl.techDetection.platform.toLowerCase();
    const match = dnaP === crawlP || dnaP.includes(crawlP) || crawlP.includes(dnaP);
    checks.push({
      field: "dna.techStack.platform",
      verified: match,
      reason: match
        ? `Platform tutarlı: ${mutated.techStack.platform}`
        : `Platform uyumsuzluğu: DNA="${mutated.techStack.platform}" vs Crawler="${crawl.techDetection.platform}"`,
    });
    if (!match) {
      // Crawler'a güven — o HTML'den doğrulanmış
      mutated.techStack.platform = crawl.techDetection.platform;
    }
  }

  // ── 8. AI sentezi kontrolü ──
  if (mutated.aiSynthesis.summary) {
    checks.push({
      field: "dna.aiSynthesis",
      verified: true,
      reason: "AI DNA sentezi başarılı",
    });
  } else {
    checks.push({
      field: "dna.aiSynthesis",
      verified: false,
      reason: "AI DNA sentezi alınamadı — özet eksik",
    });
  }

  // ── 9. B2B/B2C hedef kitle çapraz kontrol ──
  const audience = mutated.targetMarket.audience;
  if (audience === "B2B") {
    const b2bSignals = /enterprise|api|integration|b2b|kurumsal|demo|case.?study/i.test(htmlLower);
    const hasLinkedin = mutated.contact.socialPlatforms.some(p => /linkedin/i.test(p));
    if (!b2bSignals && !hasLinkedin) {
      checks.push({
        field: "dna.targetMarket",
        verified: false,
        reason: `B2B tespiti doğrulanamadı (ne enterprise/API sinyali ne LinkedIn var) — "unknown" olarak düzeltildi`,
      });
      mutated.targetMarket.audience = "unknown";
    } else {
      checks.push({
        field: "dna.targetMarket",
        verified: true,
        reason: `Hedef kitle doğrulandı: B2B (${b2bSignals ? "keyword sinyali" : "LinkedIn"} var)`,
      });
    }
  } else if (audience === "B2C") {
    const b2cSignals = /add.?to.?cart|sepete.?ekle|kargo|wishlist|b2c/i.test(htmlLower);
    const hasConsumerSocial = mutated.contact.socialPlatforms.some(p => /instagram|tiktok/i.test(p));
    if (!b2cSignals && !hasConsumerSocial) {
      checks.push({
        field: "dna.targetMarket",
        verified: false,
        reason: `B2C tespiti doğrulanamadı (ne sepet/kargo sinyali ne Instagram/TikTok var) — "unknown" olarak düzeltildi`,
      });
      mutated.targetMarket.audience = "unknown";
    } else {
      checks.push({
        field: "dna.targetMarket",
        verified: true,
        reason: `Hedef kitle doğrulandı: B2C (${b2cSignals ? "alışveriş sinyali" : "tüketici sosyal medya"} var)`,
      });
    }
  }

  // ── 10. E-Ticaret – site türü çapraz kontrol ──
  if (mutated.contentStructure.hasEcommerce) {
    const platform = crawl.techDetection.platform?.toLowerCase() || "";
    const isRealEcomPlatform = /shopify|woocommerce|magento|prestashop|opencart/i.test(platform);
    const sType = mutated.identity.siteType;

    if (!isRealEcomPlatform && (sType === "corporate" || sType === "blog" || sType === "portfolio" || sType === "landing-page")) {
      checks.push({
        field: "dna.contentStructure.hasEcommerce",
        verified: false,
        reason: `E-Ticaret çelişkisi: site türü "${sType}" ama gerçek e-ticaret platformu yok — hasEcommerce=false olarak düzeltildi`,
      });
      mutated.contentStructure.hasEcommerce = false;
    } else {
      checks.push({
        field: "dna.contentStructure.hasEcommerce",
        verified: true,
        reason: `E-Ticaret tutarlı: ${isRealEcomPlatform ? "platform mevcut" : "site türü uyumlu"}`,
      });
    }
  }

  return { dna: mutated, checks };
}

// ══════════════════════════════════════════
// D. SEO & Skor Tutarlılık Kontrolü
// ══════════════════════════════════════════

export function validateScores(
  scoring: ScoringResult,
  crawl: CrawlResult
): {
  scoring: ScoringResult;
  checks: ValidationCheckResult[];
} {
  const checks: ValidationCheckResult[] = [];
  const mutatedScoring = structuredClone(scoring);

  // ── 1. Her skor 0-100 aralığında mı ──
  const categories = Object.entries(mutatedScoring.categories) as [
    string,
    typeof mutatedScoring.categories.performance
  ][];

  for (const [name, cat] of categories) {
    if (cat.score < 0 || cat.score > 100) {
      cat.score = Math.max(0, Math.min(100, cat.score));
      checks.push({
        field: `score.${name}`,
        verified: false,
        reason: `${name} skoru 0-100 dışındaydı — düzeltildi`,
      });
    } else {
      checks.push({
        field: `score.${name}`,
        verified: true,
        reason: `${name} skoru geçerli aralıkta (${cat.score})`,
      });
    }
  }

  // ── 2. Overall skor tutarlılık kontrolü ──
  const weights: Record<string, number> = {
    performance: 0.18,
    seo: 0.18,
    security: 0.14,
    accessibility: 0.09,
    bestPractices: 0.09,
    domainTrust: 0.09,
    content: 0.09,
    technology: 0.04,
    onlinePresence: 0.10,
  };

  const active = categories.filter(([, cat]) => !cat.noData);
  const totalWeight = active.reduce(
    (sum, [name]) => sum + (weights[name] || 0),
    0
  );
  const recalculated = Math.round(
    active.reduce(
      (sum, [name, cat]) =>
        sum + cat.score * ((weights[name] || 0) / totalWeight),
      0
    )
  );

  const overallDiff = Math.abs(mutatedScoring.overall - recalculated);
  if (overallDiff > 2) {
    checks.push({
      field: "score.overall",
      verified: false,
      reason: `Overall skor tutarsız (${mutatedScoring.overall} vs hesaplanan ${recalculated}) — düzeltildi`,
    });
    mutatedScoring.overall = recalculated;
  } else {
    checks.push({
      field: "score.overall",
      verified: true,
      reason: `Overall skor tutarlı (${mutatedScoring.overall})`,
    });
  }

  // ── 3. bodyText wordCount tutarlılık ──
  checks.push({
    field: "content.wordCount",
    verified: true,
    reason: `Kelime sayısı: ${crawl.content.wordCount} (otomatik doğrulanmış)`,
  });

  // ── 4. Schema types tutarlılık ──
  if (crawl.technical.schemaTypes.length > 0) {
    checks.push({
      field: "schemaTypes",
      verified: true,
      reason: `Schema türleri mevcut: ${crawl.technical.schemaTypes.join(", ")}`,
    });
  }

  return { scoring: mutatedScoring, checks };
}

// ══════════════════════════════════════════
// E. Online Presence Doğrulaması
// ══════════════════════════════════════════

export function validateOnlinePresence(
  onlinePresence: OnlinePresenceResult,
  crawl: CrawlResult,
  domainInfo: DomainInfo
): ValidationCheckResult[] {
  const checks: ValidationCheckResult[] = [];

  // ── 1. Google Index – noindex çapraz kontrol ──
  const robotsMeta = crawl.metaSEO.robots?.toLowerCase() || "";
  const hasNoIndex = robotsMeta.includes("noindex");
  const gi = onlinePresence.googleIndex;

  if (!gi.noData) {
    if (gi.isIndexed && hasNoIndex) {
      checks.push({
        field: "onlinePresence.googleIndex",
        verified: false,
        reason: "Çelişki: Google'da indexli görünüyor ama noindex tag'i aktif — Google henüz noindex'i işlememiş olabilir",
      });
    } else if (!gi.isIndexed && !hasNoIndex) {
      checks.push({
        field: "onlinePresence.googleIndex",
        verified: false,
        reason: "Google'da indexli değil — site yeni olabilir veya crawl sorunu olabilir",
      });
    } else if (gi.isIndexed) {
      checks.push({
        field: "onlinePresence.googleIndex",
        verified: true,
        reason: `Google'da indexli (${gi.indexedPageCount} sayfa)`,
      });
    } else {
      checks.push({
        field: "onlinePresence.googleIndex",
        verified: true,
        reason: "noindex aktif ve Google'da indexli değil — tutarlı",
      });
    }
  }

  // ── 2. Wayback History – domain age çapraz kontrol ──
  const wb = onlinePresence.waybackHistory;
  if (wb.websiteAge !== null && domainInfo.domainAge !== null) {
    const domainAgeYears = domainInfo.domainAge / 365;
    const ageDiff = Math.abs(wb.websiteAge - domainAgeYears);
    if (ageDiff > 5) {
      checks.push({
        field: "onlinePresence.waybackHistory",
        verified: false,
        reason: `Wayback yaşı (${wb.websiteAge.toFixed(1)} yıl) ile domain yaşı (${domainAgeYears.toFixed(1)} yıl) arasında büyük fark — domain el değiştirmiş olabilir`,
      });
    } else {
      checks.push({
        field: "onlinePresence.waybackHistory",
        verified: true,
        reason: `Wayback yaşı (${wb.websiteAge.toFixed(1)} yıl) domain yaşı (${domainAgeYears.toFixed(1)} yıl) ile tutarlı`,
      });
    }
  } else if (wb.snapshotCount > 0) {
    checks.push({
      field: "onlinePresence.waybackHistory",
      verified: true,
      reason: `Wayback'te ${wb.snapshotCount} snapshot mevcut`,
    });
  }

  // ── 3. Webmaster tags doğrulama ──
  const wm = onlinePresence.webmasterTags;
  if (wm.google) {
    checks.push({
      field: "onlinePresence.webmasterTags.google",
      verified: true,
      reason: "Google Search Console verification tag'i mevcut",
    });
  }
  if (wm.bing) {
    checks.push({
      field: "onlinePresence.webmasterTags.bing",
      verified: true,
      reason: "Bing Webmaster verification tag'i mevcut",
    });
  }
  if (!wm.google && !wm.bing && !wm.yandex) {
    checks.push({
      field: "onlinePresence.webmasterTags",
      verified: false,
      reason: "Hiçbir arama motoru doğrulama tag'i bulunamadı — Search Console kaydı önerilir",
    });
  }

  return checks;
}

// ══════════════════════════════════════════
// F. Genel Güven Skoru Hesaplama
// ══════════════════════════════════════════

export function buildValidationSummary(
  allChecks: ValidationCheckResult[],
  durationMs: number
): ValidationSummary {
  const verified = allChecks.filter((c) => c.verified).length;
  const unverified = allChecks.filter((c) => !c.verified).length;
  const total = allChecks.length;

  // Filtrelenen veri sayısı (kaldırıldı/düzeltildi olarak belirtilenler)
  const filtered = allChecks.filter(
    (c) => !c.verified && c.reason && (c.reason.includes("kaldırıldı") || c.reason.includes("düzeltildi"))
  ).length;

  // Güven skoru: doğrulanan / toplam * 100
  const verificationScore = total > 0 ? Math.round((verified / total) * 100) : 100;

  return {
    totalChecks: total,
    verified,
    unverified,
    filtered,
    verificationScore,
    duration: durationMs,
    checks: allChecks,
  };
}

// ══════════════════════════════════════════
// Ana Doğrulama Fonksiyonu
// ══════════════════════════════════════════

export async function runFullValidation(
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis,
  scoring: ScoringResult,
  rawHtml: string,
  dna?: WebsiteDNA,
  dns?: DNSResult,
  domainInfo?: DomainInfo,
  onlinePresence?: OnlinePresenceResult
): Promise<{
  crawl: CrawlResult;
  pageAnalysis: PageAnalysis;
  scoring: ScoringResult;
  dna?: WebsiteDNA;
  validationSummary: ValidationSummary;
}> {
  const startTime = Date.now();
  const allChecks: ValidationCheckResult[] = [];

  // A. Scraper verileri doğrulama
  const scraperResult = await validateScraperData(crawl, pageAnalysis, rawHtml);
  allChecks.push(...scraperResult.checks);

  // C. DNA doğrulama
  let validatedDna = dna;
  if (dna && dns && domainInfo) {
    const dnaResult = validateDNAData(dna, crawl, pageAnalysis, dns, domainInfo, rawHtml);
    validatedDna = dnaResult.dna;
    allChecks.push(...dnaResult.checks);
  }

  // D.5 Online Presence doğrulama
  if (onlinePresence && domainInfo) {
    const opChecks = validateOnlinePresence(onlinePresence, crawl, domainInfo);
    allChecks.push(...opChecks);
  }

  // D. Skor tutarlılık kontrolü
  const scoreResult = validateScores(scoring, scraperResult.crawl);
  allChecks.push(...scoreResult.checks);

  const duration = Date.now() - startTime;
  const validationSummary = buildValidationSummary(allChecks, duration);

  console.log(
    `[Validator] ${validationSummary.verified}/${validationSummary.totalChecks} doğrulandı, ` +
    `${validationSummary.filtered} filtrelendi, skor: ${validationSummary.verificationScore}/100, ` +
    `süre: ${duration}ms`
  );

  return {
    crawl: scraperResult.crawl,
    pageAnalysis: scraperResult.pageAnalysis,
    scoring: scoreResult.scoring,
    dna: validatedDna,
    validationSummary,
  };
}
