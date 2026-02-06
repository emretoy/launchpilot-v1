// Website DNA Analyzer
// Sitenin değişmeyen kimlik bilgilerini tespit eder
// Mevcut veri kaynaklarından çıkarım yapar — ek API gerekmez

import type {
  CrawlResult,
  PageAnalysis,
  DomainInfo,
  DNSResult,
  SSLInfo,
  WebsiteDNA,
  DNABusinessAnalysis,
  DNAIdentity,
  DNATargetMarket,
  DNAMaturity,
  DNAScale,
  DNARevenueModel,
  DNAContact,
  DNATechStack,
  DNALegalTrust,
  DNAContentStructure,
  DNAAISynthesis,
  DNASiteType,
  DNATargetAudience,
  DNAMarketScope,
  DNAMaturityLevel,
  DNASiteScale,
  DNARevenueModelType,
} from "./types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ============================================================
// MAIN EXPORT
// ============================================================
export async function analyzeWebsiteDNA(
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis,
  domainInfo: DomainInfo,
  dns: DNSResult,
  ssl: SSLInfo,
  rawHtml: string
): Promise<WebsiteDNA> {
  const html = rawHtml.toLowerCase();
  const text = (
    (crawl.basicInfo.title || "") +
    " " +
    (crawl.basicInfo.metaDescription || "")
  ).toLowerCase();

  // Run all detection functions
  const identity = detectIdentity(crawl, html, text, rawHtml);
  const targetMarket = detectTargetMarket(crawl, html, text, rawHtml);
  const maturity = detectMaturity(crawl, pageAnalysis, domainInfo, dns, html);
  const scale = detectScale(crawl);
  const revenueModel = detectRevenueModel(crawl, html, text, rawHtml);
  const contact = detectContact(pageAnalysis, html);
  const techStack = detectTechStack(crawl, pageAnalysis, dns, html);
  const legalTrust = detectLegalTrust(pageAnalysis, ssl, html);
  const contentStructure = detectContentStructure(crawl, html);

  // Business signals override: fiyat yoksa + partner portal varsa → e-ticaret değil
  if (!pageAnalysis.businessSignals.hasVisiblePrice && pageAnalysis.businessSignals.partnerPortal.exists) {
    contentStructure.hasEcommerce = false;
  }

  // Business signals override: gerçekten farklı ülkelerdeyse → global
  if (pageAnalysis.businessSignals.multiCountryPresence) {
    targetMarket.marketScope = "global";
  }

  // Build pre-validation DNA
  let dna: WebsiteDNA = {
    identity,
    targetMarket,
    maturity,
    scale,
    revenueModel,
    contact,
    techStack,
    legalTrust,
    contentStructure,
    aiSynthesis: { summary: null, sophisticationScore: null, growthStage: null },
  };

  // Cross-validate before AI synthesis
  dna = validateDNA(dna, crawl, pageAnalysis, dns, domainInfo, html);

  // v3: Gemini iş analizi + ChatGPT cross-validation paralel
  const [businessResult, chatgptResult] = await Promise.all([
    generateBusinessAnalysis(dna, crawl, pageAnalysis),
    chatgptVerifyDNA(dna, crawl),
  ]);

  if (businessResult) {
    // Yeni aiAnalysis'i ata
    dna.aiAnalysis = businessResult.analysis;

    // Geriye uyumluluk: aiSynthesis'i aiAnalysis'ten türet
    dna.aiSynthesis = {
      summary: businessResult.analysis.summary || null,
      sophisticationScore: businessResult.analysis.digital_maturity.sophistication_score,
      growthStage: scoreToGrowthStage(businessResult.analysis.digital_maturity.sophistication_score),
    };

    // AI düzeltmelerini uygula
    if (businessResult.analysis.metrics.industry) {
      dna.identity.industry = businessResult.analysis.metrics.industry;
    }

    // Site type düzeltmesi (heuristic güveni düşükse)
    if (dna.identity.siteTypeConfidence < 50 && businessResult.analysis.digital_maturity.site_type) {
      const validTypes: DNASiteType[] = ["e-commerce", "blog", "corporate", "saas", "portfolio", "landing-page", "forum", "news", "directory", "education"];
      if (validTypes.includes(businessResult.analysis.digital_maturity.site_type as DNASiteType)) {
        dna.identity.siteType = businessResult.analysis.digital_maturity.site_type as DNASiteType;
        dna.identity.signals.push(`AI v3 düzeltme: siteType → ${dna.identity.siteType}`);
      }
    }

    // Audience düzeltmesi (v3 prompt "Both" döner, heuristic "both" bekler)
    if (dna.targetMarket.audience === "unknown") {
      const aiAudience = businessResult.analysis.target_audience.audience_type?.toLowerCase();
      const validAudiences: DNATargetAudience[] = ["B2B", "B2C", "both"];
      const mapped = aiAudience === "b2b" ? "B2B" : aiAudience === "b2c" ? "B2C" : aiAudience === "both" ? "both" : null;
      if (mapped && validAudiences.includes(mapped)) {
        dna.targetMarket.audience = mapped;
      }
    }

    // ChatGPT cross-validation düzeltmelerini uygula
    if (chatgptResult) {
      // ChatGPT farklı siteType diyorsa ve Gemini v3 de aynı şeyi diyorsa → kesin uygula
      if (chatgptResult.siteType && chatgptResult.siteType !== dna.identity.siteType) {
        if (businessResult.analysis.digital_maturity.site_type === chatgptResult.siteType) {
          dna.identity.siteType = chatgptResult.siteType;
          dna.identity.siteTypeConfidence = Math.min(95, dna.identity.siteTypeConfidence + 20);
          dna.identity.signals.push(`AI konsensüs (v3+ChatGPT): siteType → ${chatgptResult.siteType}`);
        }
      }
      // hasEcommerce — ikisi de false diyorsa kesin false
      if (chatgptResult.hasEcommerce === false && !businessResult.analysis.digital_maturity.has_real_ecommerce) {
        dna.contentStructure.hasEcommerce = false;
      }
      // hasBlog — biri true diyorsa true
      if (chatgptResult.hasBlog === true) {
        dna.contentStructure.hasBlog = true;
      }
      // Industry fallback
      if (!dna.identity.industry && chatgptResult.industry) {
        dna.identity.industry = chatgptResult.industry;
      }
    }

    // Prompt'ları sakla — Gemini v3 + ChatGPT cross-validation
    dna._prompts = {
      gemini: businessResult._prompt,
      chatgpt: chatgptResult?._prompt || undefined,
    };
  } else {
    // Fallback: eski Gemini sentezi + ChatGPT
    console.warn("[DNA v3] generateBusinessAnalysis başarısız — fallback'e düşülüyor");
    const geminiResult = await generateDNASynthesis(dna, crawl);
    resolveAIConsensus(dna, geminiResult, chatgptResult);

    dna._prompts = {
      gemini: geminiResult._prompt || undefined,
      chatgpt: chatgptResult?._prompt || undefined,
    };
  }

  return dna;
}

// ============================================================
// HELPERS
// ============================================================
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ============================================================
// 1. DETECT IDENTITY — Site Type + Brand Name
// ============================================================
function detectIdentity(
  crawl: CrawlResult,
  html: string,
  text: string,
  rawHtml: string
): DNAIdentity {
  const scores: Record<DNASiteType, number> = {
    "e-commerce": 0, blog: 0, corporate: 0, saas: 0, portfolio: 0,
    "landing-page": 0, forum: 0, news: 0, directory: 0, education: 0, unknown: 0,
  };
  const signals: string[] = [];

  // Schema signals
  for (const schema of crawl.technical.schemaTypes) {
    const s = schema.toLowerCase();
    if (s === "product") { scores["e-commerce"] += 30; signals.push("Product schema"); }
    if (s === "article" || s === "blogposting") { scores.blog += 30; signals.push("Article/BlogPosting schema"); }
    if (s === "newsarticle") { scores.news += 30; signals.push("NewsArticle schema"); }
    if (s === "organization") { scores.corporate += 15; signals.push("Organization schema"); }
    if (s === "softwareapplication") { scores.saas += 25; signals.push("SoftwareApplication schema"); }
    if (s === "educationalorganization" || s === "course") { scores.education += 30; signals.push("Education schema"); }
  }

  // Platform signals
  const platform = crawl.techDetection.platform?.toLowerCase() || "";
  if (platform.includes("shopify")) { scores["e-commerce"] += 50; signals.push("Shopify platform"); }
  if (platform.includes("wordpress")) { scores.blog += 15; signals.push("WordPress platform"); }

  // HTML pattern signals — E-commerce
  const hasCartCheckout = /cart|checkout|sepet|ödeme|add.to.cart|sepete.ekle/i.test(html);
  const hasPrice = /\$\d|€\d|₺\d|\d+\s*(TL|USD|EUR|GBP)|price|fiyat/i.test(html);
  if (hasCartCheckout) { scores["e-commerce"] += 35; signals.push("Sepet/checkout pattern"); }
  if (/og:type.*product/i.test(html)) { scores["e-commerce"] += 25; signals.push("og:type=product"); }
  // Negatif sinyal: ürün gösterip satmayan siteler (product kelimesi var ama cart/fiyat yok)
  if (scores["e-commerce"] > 0 && !hasCartCheckout && !hasPrice) {
    scores["e-commerce"] = Math.max(0, scores["e-commerce"] - 30);
    signals.push("Sepet/fiyat yok — e-commerce puanı düşürüldü");
  }

  if (/\/blog|\/yazilar|\/makale/i.test(html)) { scores.blog += 20; signals.push("/blog link"); }
  if (/article|blog.?post/i.test(text)) { scores.blog += 15; }

  if (/pricing|fiyatlandırma|subscribe|abone/i.test(text)) { scores.saas += 30; signals.push("Pricing/subscribe keyword"); }
  if (/sign.?up|free.?trial|kayıt.ol|ücretsiz.dene/i.test(text)) { scores.saas += 20; signals.push("Signup/trial keyword"); }
  if (/api|docs|documentation|entegrasyon/i.test(text)) { scores.saas += 15; }

  if (/about.?us|hakkımızda|team|ekibimiz|career|kariyer/i.test(html)) { scores.corporate += 20; signals.push("Kurumsal sayfa linkleri"); }
  if (/partners|bayi|distribut|wholesale|toptan/i.test(html)) { scores.corporate += 20; signals.push("B2B/partner portal"); }
  if (/factory|fabrika|countries|ülke|üretim|manufacturing/i.test(html)) { scores.corporate += 15; signals.push("Üretim/fabrika bilgisi"); }
  if (/portfolio|projelerimiz|projects|gallery|galeri/i.test(html)) { scores.portfolio += 25; signals.push("Portfolio/galeri"); }

  if (/forum|thread|reply|konu|yanıtla/i.test(html)) { scores.forum += 30; }
  if (/son.?dakika|headline|haber|breaking/i.test(html)) { scores.news += 20; }
  if (/listing|directory|rehber|firma.rehberi/i.test(html)) { scores.directory += 25; }
  if (/course|kurs|lesson|ders|öğren|eğitim/i.test(html)) { scores.education += 25; }

  // Landing page: very few internal links
  if (crawl.links.totalInternal < 3) { scores["landing-page"] += 15; signals.push("Az internal link"); }
  if (!crawl.technical.hasSitemap && crawl.links.totalInternal < 5) { scores["landing-page"] += 20; signals.push("Sitemap yok + az sayfa"); }

  // Find best type
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const best = sorted[0];
  const siteType = best[1] > 10 ? (best[0] as DNASiteType) : "unknown";
  const siteTypeConfidence = Math.min(95, Math.max(10, best[1]));

  // Brand name detection
  let brandName = "";
  // 1. og:site_name
  const ogSiteNameMatch = rawHtml.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  if (ogSiteNameMatch) {
    brandName = ogSiteNameMatch[1].trim();
  }
  // 2. title split
  if (!brandName && crawl.basicInfo.title) {
    const parts = crawl.basicInfo.title.split(/\s*[|–—-]\s*/);
    if (parts.length > 1) {
      brandName = parts[0].trim();
    }
  }
  // 3. domain fallback
  if (!brandName) {
    const domain = getDomain(crawl.basicInfo.finalUrl);
    brandName = domain.replace(/\.(com|net|org|io|co|tr|de|uk)(\.\w+)?$/i, "");
    brandName = brandName.charAt(0).toUpperCase() + brandName.slice(1);
  }

  return {
    siteType,
    siteTypeConfidence,
    industry: null, // AI tarafından doldurulacak
    brandName,
    signals,
  };
}

// ============================================================
// 2. DETECT TARGET MARKET — B2B/B2C + Pazar kapsamı
// ============================================================
function detectTargetMarket(
  crawl: CrawlResult,
  html: string,
  text: string,
  rawHtml: string
): DNATargetMarket {
  let b2bScore = 0;
  let b2cScore = 0;

  // B2B signals
  if (/enterprise|kurumsal/i.test(text)) b2bScore += 15;
  if (/api|integration|entegrasyon/i.test(text)) b2bScore += 10;
  if (/demo|request.a.demo|demo.talep/i.test(text)) b2bScore += 15;
  if (/case.study|vaka.çalışması/i.test(text)) b2bScore += 10;
  if (/\bb2b\b/i.test(text)) b2bScore += 20;

  // B2C signals
  if (/add.to.cart|sepete.ekle|kargo|shipping/i.test(text)) b2cScore += 15;
  if (/wishlist|favori|istek.listesi/i.test(text)) b2cScore += 10;
  if (/\bb2c\b/i.test(text)) b2cScore += 20;

  // Social signals for B2B/B2C
  for (const social of pageAnalysisSocialPlatforms(crawl, rawHtml)) {
    if (social === "linkedin") b2bScore += 10;
    if (social === "instagram" || social === "tiktok") b2cScore += 10;
  }

  let audience: DNATargetAudience = "unknown";
  if (b2bScore > 15 && b2cScore > 15) audience = "both";
  else if (b2bScore > 15) audience = "B2B";
  else if (b2cScore > 15) audience = "B2C";

  // Market scope
  const hreflangs = crawl.metaSEO.hreflang.map(h => h.lang);

  let marketScope: DNAMarketScope = "unknown";
  const domain = getDomain(crawl.basicInfo.finalUrl);
  // Ülke TLD tespiti: .co.uk, .com.tr, .com.au gibi compound + .de, .fr gibi tekli
  const isCountryTLD = /\.(?:co\.uk|com\.tr|com\.au|com\.br|co\.jp|co\.kr|co\.za|co\.in|co\.nz|org\.uk|net\.au)$/i.test(domain)
    || /\.(tr|de|fr|jp|cn|br|ru|kr|it|es|nl|pl|uk|au|in|za|se|no|dk|fi|at|ch|be|pt|gr|ie|cz|ro|hu|bg|hr|rs|mx|ar|co|cl|sg|my|th|id|vn|ph|eg|ma|il|qa|kw|bh|om|sa|ae|uz|nz)$/i.test(domain);

  if (hreflangs.length > 1) {
    marketScope = "global";
  } else if (isCountryTLD) {
    marketScope = "national";
  } else if (domain.endsWith(".com") && hreflangs.length <= 1) {
    marketScope = "national";
  }

  // "Free [country] delivery/shipping" veya "ücretsiz [ülke] kargo/teslimat" → national
  const bodyText = html; // html zaten lowercase
  const nationalDeliveryRegex = /(?:free|ücretsiz|kostenlos|gratuit)\s+(?:uk|us|usa|turkey|türkiye|deutschland|france|india|australia)\s+(?:delivery|shipping|kargo|teslimat|versand|livraison)/i;
  if (marketScope === "unknown" && nationalDeliveryRegex.test(bodyText)) {
    marketScope = "national";
  }
  // Daha genel: "free delivery across/throughout [country]" veya "[ülke] genelinde ücretsiz kargo"
  const nationalDeliveryRegex2 = /(?:across|throughout|nationwide|ülke genelinde|tüm türkiye|tüm ingiltere|all over the uk|uk-wide|türkiye geneli)/i;
  if (marketScope === "unknown" && nationalDeliveryRegex2.test(bodyText)) {
    marketScope = "national";
  }

  // Business signals override: multi-country veya "X countries" iddiası → global
  const countryClaimRegex = /\d+\+?\s*(?:countries|ülke|country)/i;
  if (countryClaimRegex.test(bodyText)) {
    marketScope = "global";
  }

  // Languages
  const languages: string[] = [];
  if (crawl.basicInfo.language) languages.push(crawl.basicInfo.language);
  for (const h of hreflangs) {
    const lang = h.split("-")[0];
    if (!languages.includes(lang) && lang !== "x-default") languages.push(lang);
  }

  return {
    audience,
    marketScope,
    languages,
    primaryLanguage: crawl.basicInfo.language || (languages.length > 0 ? languages[0] : null),
  };
}

// Helper: social platform listesi (pageAnalysis socialLinks'ten)
function pageAnalysisSocialPlatforms(crawl: CrawlResult, rawHtml: string): string[] {
  // crawl/rawHtml'den ekstra kontrol
  const platforms: string[] = [];
  const htmlLower = rawHtml.toLowerCase();
  if (/linkedin\.com/i.test(htmlLower)) platforms.push("linkedin");
  if (/instagram\.com/i.test(htmlLower)) platforms.push("instagram");
  if (/tiktok\.com/i.test(htmlLower)) platforms.push("tiktok");
  if (/facebook\.com|fb\.com/i.test(htmlLower)) platforms.push("facebook");
  if (/twitter\.com|x\.com/i.test(htmlLower)) platforms.push("twitter");
  if (/youtube\.com/i.test(htmlLower)) platforms.push("youtube");
  return [...new Set(platforms)];
}

// ============================================================
// 3. DETECT MATURITY — Olgunluk skoru (0-100)
// ============================================================
function detectMaturity(
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis,
  domainInfo: DomainInfo,
  dns: DNSResult,
  html: string
): DNAMaturity {
  let score = 0;
  const signals: string[] = [];

  // Domain age (max 30p) — DomainInfo'dan
  const ageDays = domainInfo.domainAge;
  if (ageDays !== null) {
    const ageYears = ageDays / 365;
    if (ageYears >= 10) { score += 30; signals.push(`Domain ${Math.floor(ageYears)} yaşında (kıdemli)`); }
    else if (ageYears >= 5) { score += 22; signals.push(`Domain ${Math.floor(ageYears)} yaşında`); }
    else if (ageYears >= 2) { score += 15; signals.push(`Domain ${Math.floor(ageYears)} yaşında`); }
    else if (ageDays >= 180) { score += 8; signals.push(`Domain ${Math.floor(ageDays / 30)} aylık`); }
    else { score += 2; signals.push(`Domain çok yeni (${ageDays} gün)`); }
  }

  // Teknik gelişmişlik (max 25p)
  if (crawl.technical.hasSchemaOrg) { score += 5; signals.push("Schema markup mevcut"); }
  if (crawl.technical.hasSitemap) { score += 4; signals.push("Sitemap mevcut"); }
  if (crawl.technical.hasRobotsTxt) { score += 3; signals.push("Robots.txt mevcut"); }
  if (pageAnalysis.analytics.hasGoogleAnalytics || pageAnalysis.analytics.hasGTM) {
    score += 5; signals.push("Analytics entegrasyonu");
  }
  if (pageAnalysis.cookieConsent.detected) {
    score += 4; signals.push("Cookie consent mevcut");
  }
  if (dns.hasSPF) { score += 2; signals.push("SPF kaydı"); }
  if (dns.hasDMARC) { score += 2; signals.push("DMARC kaydı"); }

  // İçerik zenginliği (max 25p)
  const wc = crawl.content.wordCount;
  if (wc > 1000) { score += 25; signals.push(`Zengin içerik (${wc} kelime)`); }
  else if (wc > 500) { score += 18; signals.push(`İyi içerik (${wc} kelime)`); }
  else if (wc > 200) { score += 10; signals.push(`Orta içerik (${wc} kelime)`); }
  else { score += 3; signals.push(`Az içerik (${wc} kelime)`); }

  // Sosyal & güven (max 20p)
  const socialCount = pageAnalysis.socialLinks.length;
  if (socialCount >= 3) { score += 8; signals.push(`${socialCount} sosyal platform`); }
  else if (socialCount >= 1) { score += 4; signals.push(`${socialCount} sosyal platform`); }

  if (pageAnalysis.trustSignals.hasPrivacyPolicy) { score += 4; signals.push("Gizlilik politikası"); }
  if (pageAnalysis.trustSignals.hasTerms) { score += 3; signals.push("Kullanım şartları"); }
  if (pageAnalysis.trustSignals.hasContactInfo) { score += 5; signals.push("İletişim bilgisi"); }

  score = Math.min(100, score);
  let level: DNAMaturityLevel;
  if (score >= 80) level = "veteran";
  else if (score >= 60) level = "mature";
  else if (score >= 40) level = "growing";
  else if (score >= 20) level = "young";
  else level = "newborn";

  return { level, score, signals };
}

// ============================================================
// 4. DETECT SCALE — Ölçek tahmini
// ============================================================
function detectScale(crawl: CrawlResult): DNAScale {
  const signals: string[] = [];

  // Primary: sitemap page count
  let pageEstimate: number;
  if (crawl.technical.sitemapPageCount !== null && crawl.technical.sitemapPageCount > 0) {
    pageEstimate = crawl.technical.sitemapPageCount;
    signals.push(`Sitemap: ${pageEstimate} sayfa`);
  } else {
    // Fallback: internal link count
    pageEstimate = crawl.links.totalInternal;
    signals.push(`${pageEstimate} internal link tespit edildi (tahmini)`);
  }

  let level: DNASiteScale;
  if (pageEstimate <= 1) level = "single-page";
  else if (pageEstimate <= 10) level = "small";
  else if (pageEstimate <= 50) level = "medium";
  else if (pageEstimate <= 500) level = "large";
  else level = "enterprise";

  return { level, estimatedPages: pageEstimate, signals };
}

// ============================================================
// 5. DETECT REVENUE MODEL — Gelir modeli
// ============================================================
function detectRevenueModel(
  crawl: CrawlResult,
  html: string,
  text: string,
  rawHtml: string
): DNARevenueModel {
  const scores: Record<DNARevenueModelType, number> = {
    "e-commerce": 0, advertising: 0, saas: 0,
    "lead-generation": 0, "content-media": 0, "non-profit": 0, unknown: 0,
  };
  const signals: string[] = [];
  const platform = crawl.techDetection.platform?.toLowerCase() || "";

  // E-commerce
  const revenueHasCart = /cart|checkout|sepet|ödeme/i.test(html);
  const revenueHasPrice = /\$\d|€\d|₺\d|\d+\s*(TL|USD|EUR|GBP)|price|fiyat/i.test(html);
  if (platform.includes("shopify")) { scores["e-commerce"] += 50; signals.push("Shopify platform"); }
  if (/woocommerce|wp-content.*wc/i.test(html)) { scores["e-commerce"] += 40; signals.push("WooCommerce"); }
  if (revenueHasCart) { scores["e-commerce"] += 30; signals.push("Sepet/checkout pattern"); }
  if (crawl.technical.schemaTypes.some(s => s.toLowerCase() === "product")) {
    scores["e-commerce"] += 25; signals.push("Product schema");
  }
  // Negatif: ürün gösterir ama satış mekanizması yoksa puan düşür
  if (scores["e-commerce"] > 0 && !revenueHasCart && !revenueHasPrice && !platform.includes("shopify")) {
    scores["e-commerce"] = Math.max(0, scores["e-commerce"] - 25);
    signals.push("Satış mekanizması yok — e-commerce puanı düşürüldü");
  }

  // Advertising
  if (/googlesyndication|adsense/i.test(html)) { scores.advertising += 40; signals.push("Google AdSense"); }
  if (/doubleclick/i.test(html)) { scores.advertising += 30; signals.push("DoubleClick"); }

  // SaaS
  if (/pricing|fiyatlandırma/i.test(text)) { scores.saas += 25; signals.push("Pricing keyword"); }
  if (/free.?trial|ücretsiz.dene/i.test(text)) { scores.saas += 20; signals.push("Free trial"); }
  if (/sign.?up|kayıt/i.test(text)) { scores.saas += 15; signals.push("Sign up CTA"); }
  if (/monthly|annually|aylık|yıllık/i.test(text)) { scores.saas += 20; signals.push("Abonelik modeli"); }

  // Lead generation
  if (/<form/i.test(rawHtml) || /contact.?form|iletişim.formu/i.test(html)) {
    scores["lead-generation"] += 25; signals.push("İletişim formu");
  }
  if (/teklif.al|demo|request.a.quote/i.test(text)) { scores["lead-generation"] += 25; signals.push("Teklif/demo CTA"); }
  if (/partners|bayi|distribut|wholesale|toptan/i.test(html)) { scores["lead-generation"] += 20; signals.push("B2B partner/bayi yönlendirmesi"); }

  // Content-media
  if (crawl.technical.schemaTypes.some(s => ["article", "newsarticle"].includes(s.toLowerCase()))) {
    scores["content-media"] += 25; signals.push("Article schema");
  }

  // Non-profit
  if (/donate|bağış|bağışla/i.test(text)) { scores["non-profit"] += 30; signals.push("Bağış butonu"); }
  const domain = getDomain(crawl.basicInfo.finalUrl);
  if (/\.org$/i.test(domain)) { scores["non-profit"] += 15; signals.push(".org domain"); }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const best = sorted[0];
  const primary = best[1] > 10 ? (best[0] as DNARevenueModelType) : "unknown";

  return { primary, signals };
}

// ============================================================
// 6. DETECT CONTACT — İletişim kanalları
// ============================================================
function detectContact(pageAnalysis: PageAnalysis, html: string): DNAContact {
  const methods: string[] = [];

  // From trustSignals
  if (pageAnalysis.trustSignals.hasPhoneNumber) methods.push("phone");
  if (pageAnalysis.trustSignals.hasEmail) methods.push("email");
  if (pageAnalysis.cta.hasContactForm) methods.push("form");

  // Chat widgets from HTML
  if (/tawk\.to|intercom|crisp\.chat|zendesk|tidio|drift|livechat/i.test(html)) methods.push("chat");
  // WhatsApp
  if (/wa\.me|api\.whatsapp\.com|whatsapp/i.test(html)) methods.push("whatsapp");

  // Social platforms from pageAnalysis
  const socialPlatforms = pageAnalysis.socialLinks.map(s => s.platform.toLowerCase());
  // Extra social from HTML
  if (/tiktok\.com/i.test(html) && !socialPlatforms.includes("tiktok")) socialPlatforms.push("tiktok");
  if (/pinterest\.com/i.test(html) && !socialPlatforms.includes("pinterest")) socialPlatforms.push("pinterest");

  return {
    methods,
    socialPlatforms: [...new Set(socialPlatforms)],
    hasPhysicalAddress: pageAnalysis.trustSignals.hasAddress,
  };
}

// ============================================================
// 7. DETECT TECH STACK — Teknoloji DNA'sı
// ============================================================
function detectTechStack(
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis,
  dns: DNSResult,
  html: string
): DNATechStack {
  // Platform (from existing techDetection)
  const platform = crawl.techDetection.platform || null;

  // JS Framework detection
  let jsFramework: string | null = null;
  if (/__NEXT_DATA__|_next\/static/i.test(html)) jsFramework = "Next.js";
  else if (/__nuxt|_nuxt\//i.test(html)) jsFramework = "Nuxt.js";
  else if (/ng-app|ng-version/i.test(html)) jsFramework = "Angular";
  else if (/data-reactroot|__REACT/i.test(html)) jsFramework = "React";
  else if (/data-v-/i.test(html)) jsFramework = "Vue.js";
  else if (/___gatsby/i.test(html)) jsFramework = "Gatsby";
  else if (/data-svelte|svelte/i.test(html)) jsFramework = "Svelte";

  // Hosting (from nameservers)
  let hosting: string | null = null;
  const ns = dns.nameservers.join(" ").toLowerCase();
  if (ns.includes("cloudflare")) hosting = "Cloudflare";
  else if (ns.includes("awsdns")) hosting = "AWS";
  else if (ns.includes("google") || ns.includes("googledomains")) hosting = "Google Cloud";
  else if (ns.includes("vercel")) hosting = "Vercel";
  else if (ns.includes("netlify")) hosting = "Netlify";
  else if (ns.includes("digitalocean")) hosting = "DigitalOcean";
  else if (ns.includes("hetzner")) hosting = "Hetzner";
  // Fallback: HTML hints
  if (!hosting) {
    if (/vercel/i.test(html)) hosting = "Vercel";
    else if (/netlify/i.test(html)) hosting = "Netlify";
    else if (/cloudflare/i.test(html)) hosting = "Cloudflare";
  }

  // CDN
  let cdnProvider: string | null = null;
  if (/cloudfront\.net/i.test(html)) cdnProvider = "AWS CloudFront";
  else if (/akamaized\.net|akamai/i.test(html)) cdnProvider = "Akamai";
  else if (/fastly/i.test(html)) cdnProvider = "Fastly";
  else if (/cloudflare/i.test(html) && hosting !== "Cloudflare") cdnProvider = "Cloudflare";

  // Email provider (from MX records)
  let emailProvider: string | null = null;
  const mx = dns.mxRecords.map(m => m.exchange.toLowerCase()).join(" ");
  if (/google|gmail|googlemail/i.test(mx)) emailProvider = "Google Workspace";
  else if (/outlook|microsoft/i.test(mx)) emailProvider = "Microsoft 365";
  else if (/yandex/i.test(mx)) emailProvider = "Yandex";
  else if (/zoho/i.test(mx)) emailProvider = "Zoho";
  else if (/protonmail|proton/i.test(mx)) emailProvider = "ProtonMail";

  // Marketing tools
  const marketingTools: string[] = [];
  if (pageAnalysis.analytics.hasGoogleAnalytics) marketingTools.push("Google Analytics");
  if (pageAnalysis.analytics.hasGTM) marketingTools.push("Google Tag Manager");
  if (pageAnalysis.analytics.hasMetaPixel) marketingTools.push("Facebook Pixel");
  if (pageAnalysis.analytics.hasHotjar) marketingTools.push("Hotjar");
  for (const tool of pageAnalysis.analytics.otherTools) {
    if (!marketingTools.includes(tool)) marketingTools.push(tool);
  }
  // Extra from HTML
  if (/mailchimp/i.test(html) && !marketingTools.includes("Mailchimp")) marketingTools.push("Mailchimp");
  if (/hubspot/i.test(html) && !marketingTools.includes("HubSpot")) marketingTools.push("HubSpot");
  if (/klaviyo/i.test(html) && !marketingTools.includes("Klaviyo")) marketingTools.push("Klaviyo");
  if (/brevo|sendinblue/i.test(html) && !marketingTools.includes("Brevo")) marketingTools.push("Brevo");
  if (/intercom/i.test(html) && !marketingTools.includes("Intercom")) marketingTools.push("Intercom");
  if (/clarity\.ms|microsoft.*clarity/i.test(html) && !marketingTools.includes("Microsoft Clarity")) marketingTools.push("Microsoft Clarity");
  if (/segment\.com|analytics\.js/i.test(html) && !marketingTools.includes("Segment")) marketingTools.push("Segment");

  return { platform, jsFramework, hosting, emailProvider, cdnProvider, marketingTools };
}

// ============================================================
// 8. DETECT LEGAL TRUST — Hukuki & güven
// ============================================================
function detectLegalTrust(pageAnalysis: PageAnalysis, ssl: SSLInfo, html: string): DNALegalTrust {
  const hasPrivacyPolicy = pageAnalysis.trustSignals.hasPrivacyPolicy;
  const hasTerms = pageAnalysis.trustSignals.hasTerms;
  const hasKVKK = /kvkk|kişisel.veri|6698|aydınlatma.metni/i.test(html);
  const hasCookieConsent = pageAnalysis.cookieConsent.detected;

  // SSL details
  let sslDetails: string | null = null;
  if (ssl.valid && ssl.issuer) {
    sslDetails = `${ssl.issuer}${ssl.daysUntilExpiry !== null ? ` (${ssl.daysUntilExpiry} gün kaldı)` : ""}`;
  } else if (!ssl.valid) {
    sslDetails = ssl.error || "Geçersiz SSL";
  }

  return { hasPrivacyPolicy, hasTerms, hasKVKK, hasCookieConsent, sslDetails };
}

// ============================================================
// 9. DETECT CONTENT STRUCTURE — İçerik yapısı
// ============================================================
function detectContentStructure(crawl: CrawlResult, html: string): DNAContentStructure {
  const allLinks = crawl.links.internal.map(l => l.href).join(" ").toLowerCase();
  const combined = html + " " + allLinks;

  const hasBlog = /\/blog|\/yazilar|\/makale/i.test(combined) ||
    crawl.technical.schemaTypes.some(s => ["article", "blogposting"].includes(s.toLowerCase()));

  const hasAuth = /\/login|\/giris|\/register|\/kayit|\/signup|\/sign-in/i.test(combined);

  const hasSearch = /type=["']search["']|role=["']search["']|\/search/i.test(html);

  const hasMobileApp = /apps\.apple\.com|play\.google\.com|itunes\.apple\.com/i.test(html);

  const hasNewsletter = /newsletter|bülten|bulten|mailchimp|email.?signup|abone.ol/i.test(html);

  // E-ticaret: platform kesin sinyalse yeter, değilse sepet + fiyat birlikte olmalı
  const isEcomPlatform = ["shopify", "woocommerce"].some(p =>
    crawl.techDetection.platform?.toLowerCase().includes(p) ?? false
  );
  const hasCartPattern = /cart|checkout|sepet|ödeme|add.to.cart|sepete.ekle/i.test(html);
  const hasPricePattern = /\$\d|€\d|₺\d|\d+\s*(TL|USD|EUR|GBP)|price|fiyat/i.test(html);
  const hasEcommerce = isEcomPlatform || (hasCartPattern && hasPricePattern);

  const hasPricingPage = /\/(pricing|fiyat|fiyatlandirma|plans|paketler)(\/|$|\?|#)/i.test(allLinks);

  return { hasBlog, hasAuth, hasSearch, hasMobileApp, hasNewsletter, hasEcommerce, hasPricingPage };
}

// ============================================================
// 10. GENERATE DNA SYNTHESIS — Gemini AI sentezi
// ============================================================
interface AIVerification {
  synthesis: DNAAISynthesis;
  industry: string | null;
  correctedSiteType: DNASiteType | null;
  correctedAudience: DNATargetAudience | null;
  correctedRevenue: DNARevenueModelType | null;
  correctedMarketScope: DNAMarketScope | null;
  correctedMaturity: DNAMaturityLevel | null;
  correctedScale: DNASiteScale | null;
  correctedHasEcommerce: boolean | null;
  correctedHasBlog: boolean | null;
  _prompt?: { template: string; context: string };
}

async function generateDNASynthesis(dna: WebsiteDNA, crawl: CrawlResult): Promise<AIVerification> {
  const fallback: AIVerification = {
    synthesis: { summary: null, sophisticationScore: null, growthStage: null },
    industry: null, correctedSiteType: null, correctedAudience: null, correctedRevenue: null,
    correctedMarketScope: null, correctedMaturity: null, correctedScale: null,
    correctedHasEcommerce: null, correctedHasBlog: null, _prompt: { template: "", context: "" },
  };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  const dnaContext = `
Site: ${crawl.basicInfo.finalUrl}
Title: ${crawl.basicInfo.title || "N/A"}
Description: ${crawl.basicInfo.metaDescription || "N/A"}
Brand: ${dna.identity.brandName}
Algılanan Site Türü: ${dna.identity.siteType} (güven: ${dna.identity.siteTypeConfidence}%)
Algılanan Hedef: ${dna.targetMarket.audience} / ${dna.targetMarket.marketScope}
Algılanan Gelir Modeli: ${dna.revenueModel.primary}
Olgunluk: ${dna.maturity.level} (skor: ${dna.maturity.score})
Ölçek: ${dna.scale.level} (~${dna.scale.estimatedPages} sayfa)
Teknoloji: ${dna.techStack.platform || "N/A"} / ${dna.techStack.jsFramework || "N/A"} / Hosting: ${dna.techStack.hosting || "N/A"}
İletişim: ${dna.contact.methods.join(", ") || "Yok"}
Sosyal: ${dna.contact.socialPlatforms.join(", ") || "Yok"}
Hukuki: gizlilik=${dna.legalTrust.hasPrivacyPolicy}, şartlar=${dna.legalTrust.hasTerms}, kvkk=${dna.legalTrust.hasKVKK}
İçerik: blog=${dna.contentStructure.hasBlog}, auth=${dna.contentStructure.hasAuth}, ecommerce=${dna.contentStructure.hasEcommerce}
Tespit sinyalleri: ${dna.identity.signals.join(", ")}
`;

  const promptTemplate = `Sen bir web sitesi DNA doğrulama uzmanısın. Otomatik tarayıcı aşağıdaki tespitleri yaptı. Senin görevin:
1. Bu tespitleri doğrula veya düzelt
2. Türkçe bir özet yaz
3. Eksik bilgileri tamamla

[SİTE VERİSİ BURAYA EKLENİR]

JSON döndür:
{
  "summary": "Türkçe 8-12 cümle...",
  "sophisticationScore": "0-100",
  "growthStage": "Yeni Doğmuş|Bebek|Çocuk|Genç|Yetişkin|Usta",
  "industry": "Sektör (Türkçe, kısa)",
  "correctedSiteType": "Yanlışsa doğrusu, doğruysa null",
  "correctedAudience": "Yanlışsa doğrusu, doğruysa null",
  "correctedRevenue": "Yanlışsa doğrusu, doğruysa null",
  "correctedMarketScope": "Yanlışsa doğrusu, doğruysa null",
  "correctedMaturity": "Yanlışsa doğrusu, doğruysa null",
  "correctedScale": "Yanlışsa doğrusu, doğruysa null",
  "correctedHasEcommerce": "Boolean, doğruysa null",
  "correctedHasBlog": "Boolean, doğruysa null"
}

Kurallar:
- Sadece JSON döndür, başka bir şey yazma
- Türkçe yaz (summary ve industry için)
- Site title, description ve sinyallerden çıkarım yap
- Eğer tespit doğruysa corrected alanlarına null yaz`;

  const prompt = `Sen bir web sitesi DNA doğrulama uzmanısın. Otomatik tarayıcı aşağıdaki tespitleri yaptı. Senin görevin:
1. Bu tespitleri doğrula veya düzelt
2. Türkçe bir özet yaz
3. Eksik bilgileri tamamla

${dnaContext}

JSON döndür:
{
  "summary": "Türkçe 8-12 cümle. Sitenin ne sitesi olduğunu, hangi sektörde faaliyet gösterdiğini, kime hitap ettiğini (hedef kitle profili), nasıl bir iş modeli izlediğini, dijital olgunluğunu, içerik stratejisini ve genel dijital varlık durumunu detaylıca açıkla. Teknik olmayan bir dille, sanki bu siteyi birine tanıtıyormuş gibi yaz. Bu açıklama aynı zamanda blog stratejisi için bağlam olarak kullanılacak.",
  "sophisticationScore": 0-100 (teknik gelişmişlik + içerik + pazarlama + hukuki uyum),
  "growthStage": "Yeni Doğmuş|Bebek|Çocuk|Genç|Yetişkin|Usta",
  "industry": "Sektör (Türkçe, kısa. Örn: Mobilya / Üretim, SaaS / Proje Yönetimi, Sağlık / Klinik)",
  "correctedSiteType": "Yanlışsa doğrusu. Seçenekler: e-commerce, blog, corporate, saas, portfolio, landing-page, forum, news, directory, education. Doğruysa null.",
  "correctedAudience": "Yanlışsa doğrusu. Seçenekler: B2B, B2C, both. Doğruysa null.",
  "correctedRevenue": "Yanlışsa doğrusu. Seçenekler: e-commerce, advertising, saas, lead-generation, content-media, non-profit. Doğruysa null.",
  "correctedMarketScope": "Yanlışsa doğrusu. Seçenekler: local, national, global. Doğruysa null.",
  "correctedMaturity": "Yanlışsa doğrusu. Seçenekler: newborn, young, growing, mature, veteran. Doğruysa null.",
  "correctedScale": "Yanlışsa doğrusu. Seçenekler: single-page, small, medium, large, enterprise. Doğruysa null.",
  "correctedHasEcommerce": "Boolean. Sitede GERÇEK e-ticaret (sepet+ödeme) var mı? Ürün tanıtımı yeterli DEĞİL. Doğruysa null.",
  "correctedHasBlog": "Boolean. Sitede aktif blog var mı? Doğruysa null."
}

Kurallar:
- Sadece JSON döndür, başka bir şey yazma
- Türkçe yaz (summary ve industry için)
- Site title, description ve sinyallerden çıkarım yap
- Ürün tanıtımı yapan ama sepet/ödeme olmayan siteler e-commerce DEĞİL, corporate'tir
- Bayilik/partner portalı olan siteler genellikle B2B + lead-generation'dır
- Eğer tespit doğruysa corrected alanlarına null yaz`;

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error("[DNA] Gemini API error:", res.status, await res.text());
      return fallback;
    }

    const data = await res.json();
    let jsonStr = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!jsonStr) return fallback;

    // Clean markdown fences if present
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

    const parsed = JSON.parse(jsonStr.trim());

    const validSiteTypes: DNASiteType[] = ["e-commerce", "blog", "corporate", "saas", "portfolio", "landing-page", "forum", "news", "directory", "education"];
    const validAudiences: DNATargetAudience[] = ["B2B", "B2C", "both"];
    const validRevenues: DNARevenueModelType[] = ["e-commerce", "advertising", "saas", "lead-generation", "content-media", "non-profit"];
    const validScopes: DNAMarketScope[] = ["local", "national", "global"];
    const validMaturity: DNAMaturityLevel[] = ["newborn", "young", "growing", "mature", "veteran"];
    const validScale: DNASiteScale[] = ["single-page", "small", "medium", "large", "enterprise"];

    return {
      synthesis: {
        summary: parsed.summary || null,
        sophisticationScore: parsed.sophisticationScore != null
          ? Math.min(100, Math.max(0, parsed.sophisticationScore))
          : null,
        growthStage: parsed.growthStage || null,
      },
      industry: parsed.industry || null,
      correctedSiteType: parsed.correctedSiteType && validSiteTypes.includes(parsed.correctedSiteType) ? parsed.correctedSiteType : null,
      correctedAudience: parsed.correctedAudience && validAudiences.includes(parsed.correctedAudience) ? parsed.correctedAudience : null,
      correctedRevenue: parsed.correctedRevenue && validRevenues.includes(parsed.correctedRevenue) ? parsed.correctedRevenue : null,
      correctedMarketScope: parsed.correctedMarketScope && validScopes.includes(parsed.correctedMarketScope) ? parsed.correctedMarketScope : null,
      correctedMaturity: parsed.correctedMaturity && validMaturity.includes(parsed.correctedMaturity) ? parsed.correctedMaturity : null,
      correctedScale: parsed.correctedScale && validScale.includes(parsed.correctedScale) ? parsed.correctedScale : null,
      correctedHasEcommerce: typeof parsed.correctedHasEcommerce === "boolean" ? parsed.correctedHasEcommerce : null,
      correctedHasBlog: typeof parsed.correctedHasBlog === "boolean" ? parsed.correctedHasBlog : null,
      _prompt: { template: promptTemplate, context: dnaContext.trim() },
    };
  } catch (err) {
    console.error("[DNA] AI synthesis error:", err);
    fallback._prompt = { template: promptTemplate, context: dnaContext.trim() };
    return fallback;
  }
}

// ============================================================
// 11. CHATGPT VERIFICATION — Cross-validation (v3'te paralel çalışır)
// ============================================================
interface ChatGPTVerification {
  siteType: DNASiteType | null;
  audience: DNATargetAudience | null;
  revenue: DNARevenueModelType | null;
  industry: string | null;
  marketScope: DNAMarketScope | null;
  maturity: DNAMaturityLevel | null;
  scale: DNASiteScale | null;
  hasEcommerce: boolean | null;
  hasBlog: boolean | null;
  _prompt?: { template: string; context: string };
}

async function chatgptVerifyDNA(dna: WebsiteDNA, crawl: CrawlResult): Promise<ChatGPTVerification | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const context = `Site: ${crawl.basicInfo.finalUrl}
Title: ${crawl.basicInfo.title || "N/A"}
Description: ${crawl.basicInfo.metaDescription || "N/A"}
Brand: ${dna.identity.brandName}
Platform: ${dna.techStack.platform || "N/A"}
Olgunluk: ${dna.maturity.level} (skor: ${dna.maturity.score})
Ölçek: ${dna.scale.level} (~${dna.scale.estimatedPages} sayfa)
Pazar: ${dna.targetMarket.marketScope}
Diller: ${dna.targetMarket.languages.join(", ") || "N/A"}
Content: blog=${dna.contentStructure.hasBlog}, auth=${dna.contentStructure.hasAuth}, ecommerce=${dna.contentStructure.hasEcommerce}, search=${dna.contentStructure.hasSearch}, newsletter=${dna.contentStructure.hasNewsletter}
Contact: ${dna.contact.methods.join(", ") || "Yok"}
Social: ${dna.contact.socialPlatforms.join(", ") || "Yok"}
Hukuki: gizlilik=${dna.legalTrust.hasPrivacyPolicy}, kvkk=${dna.legalTrust.hasKVKK}, cookie=${dna.legalTrust.hasCookieConsent}
Signals: ${dna.identity.signals.join(", ")}`;

  const chatgptTemplate = `Bir web sitesinin otomatik tarama verileri aşağıda. Bu siteyi BAĞIMSIZ olarak analiz et ve TÜM alanları sınıflandır.

[SİTE VERİSİ BURAYA EKLENİR]

Sadece JSON döndür:
{
  "siteType": "e-commerce|blog|corporate|saas|...",
  "audience": "B2B|B2C|both",
  "revenue": "e-commerce|advertising|saas|...",
  "industry": "Sektör (Türkçe, kısa)",
  "marketScope": "local|national|global",
  "maturity": "newborn|young|growing|mature|veteran",
  "scale": "single-page|small|medium|large|enterprise",
  "hasEcommerce": true/false,
  "hasBlog": true/false
}

Kurallar:
- Sadece JSON döndür
- Ürün tanıtımı yapan ama sepet/ödeme olmayan siteler corporate'tir
- hasEcommerce: SADECE gerçek alışveriş (sepet+ödeme) varsa true
- Bayilik/partner portalı = B2B + lead-generation
- .com.tr gibi ülke TLD'si + tek dil = local veya national`;

  const prompt = `Bir web sitesinin otomatik tarama verileri aşağıda. Bu siteyi BAĞIMSIZ olarak analiz et ve TÜM alanları sınıflandır.

${context}

Sadece JSON döndür:
{
  "siteType": "e-commerce|blog|corporate|saas|portfolio|landing-page|forum|news|directory|education",
  "audience": "B2B|B2C|both",
  "revenue": "e-commerce|advertising|saas|lead-generation|content-media|non-profit",
  "industry": "Sektör (Türkçe, kısa. Örn: Mobilya / Üretim)",
  "marketScope": "local|national|global",
  "maturity": "newborn|young|growing|mature|veteran",
  "scale": "single-page|small|medium|large|enterprise",
  "hasEcommerce": true/false,
  "hasBlog": true/false
}

Kurallar:
- Sadece JSON döndür
- Ürün tanıtımı yapan ama sepet/ödeme olmayan siteler corporate'tir, e-commerce DEĞİL
- hasEcommerce: SADECE gerçek alışveriş (sepet+ödeme) varsa true. Ürün galerisi/kataloğu yetmez
- Bayilik/partner portalı olan siteler genellikle B2B + lead-generation'dır
- .com.tr gibi ülke TLD'si + tek dil = local veya national
- maturity: domain yaşı, içerik zenginliği, teknik gelişmişliğe göre karar ver
- scale: sitemap sayfa sayısı ve iç link sayısına göre karar ver`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error("[DNA] ChatGPT API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    let content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    // Clean markdown fences if present
    if (content.startsWith("```json")) content = content.slice(7);
    if (content.startsWith("```")) content = content.slice(3);
    if (content.endsWith("```")) content = content.slice(0, -3);

    const parsed = JSON.parse(content.trim());

    const validSiteTypes: DNASiteType[] = ["e-commerce", "blog", "corporate", "saas", "portfolio", "landing-page", "forum", "news", "directory", "education"];
    const validAudiences: DNATargetAudience[] = ["B2B", "B2C", "both"];
    const validRevenues: DNARevenueModelType[] = ["e-commerce", "advertising", "saas", "lead-generation", "content-media", "non-profit"];
    const validScopes: DNAMarketScope[] = ["local", "national", "global"];
    const validMaturity: DNAMaturityLevel[] = ["newborn", "young", "growing", "mature", "veteran"];
    const validScale: DNASiteScale[] = ["single-page", "small", "medium", "large", "enterprise"];

    return {
      siteType: validSiteTypes.includes(parsed.siteType) ? parsed.siteType : null,
      audience: validAudiences.includes(parsed.audience) ? parsed.audience : null,
      revenue: validRevenues.includes(parsed.revenue) ? parsed.revenue : null,
      industry: parsed.industry || null,
      marketScope: validScopes.includes(parsed.marketScope) ? parsed.marketScope : null,
      maturity: validMaturity.includes(parsed.maturity) ? parsed.maturity : null,
      scale: validScale.includes(parsed.scale) ? parsed.scale : null,
      hasEcommerce: typeof parsed.hasEcommerce === "boolean" ? parsed.hasEcommerce : null,
      hasBlog: typeof parsed.hasBlog === "boolean" ? parsed.hasBlog : null,
      _prompt: { template: chatgptTemplate, context: context.trim() },
    };
  } catch (err) {
    console.error("[DNA] ChatGPT verification error:", err);
    return null;
  }
}

// ============================================================
// 12. AI CONSENSUS — İki AI'ın konsensüsü (v3 fallback'te kullanılır)
// ============================================================
function resolveAIConsensus(
  dna: WebsiteDNA,
  gemini: AIVerification,
  chatgpt: ChatGPTVerification | null
): void {
  // Gemini sentezini uygula
  dna.aiSynthesis = gemini.synthesis;
  if (gemini.industry) dna.identity.industry = gemini.industry;

  // Yardımcı: iki AI arasında konsensüs çöz
  // Eğer ikisi de aynı şeyi söylüyorsa → kesin uygula
  // Biri farklıysa → ChatGPT'ye öncelik (bağımsız değerlendirme)
  // Sadece biri varsa → onu uygula
  function resolve<T>(
    current: T,
    geminiVal: T | null,
    chatgptVal: T | null,
    label: string
  ): { value: T; source: string | null } {
    const gVal = geminiVal || current;
    const cVal = chatgptVal;

    if (cVal && cVal !== current) {
      if (gVal === cVal) {
        return { value: cVal, source: `AI konsensüs: ${current} → ${cVal} (Gemini + ChatGPT)` };
      } else if (geminiVal) {
        return { value: cVal, source: `AI uyuşmazlık (${label}): Gemini=${gVal}, ChatGPT=${cVal} → ChatGPT` };
      } else {
        return { value: cVal, source: `ChatGPT düzeltme: ${current} → ${cVal}` };
      }
    } else if (geminiVal && geminiVal !== current) {
      return { value: geminiVal, source: `Gemini düzeltme: ${current} → ${geminiVal}` };
    }
    return { value: current, source: null };
  }

  // 1. Site Type
  const siteTypeResult = resolve(
    dna.identity.siteType, gemini.correctedSiteType,
    chatgpt?.siteType ?? null, "siteType"
  );
  if (siteTypeResult.source) {
    dna.identity.signals.push(siteTypeResult.source);
    dna.identity.siteType = siteTypeResult.value;
    if (siteTypeResult.source.includes("konsensüs")) {
      dna.identity.siteTypeConfidence = Math.min(95, dna.identity.siteTypeConfidence + 20);
    }
  }

  // 2. Audience
  const audResult = resolve(
    dna.targetMarket.audience, gemini.correctedAudience,
    chatgpt?.audience ?? null, "audience"
  );
  if (audResult.source) dna.targetMarket.audience = audResult.value;

  // 3. Revenue
  const revResult = resolve(
    dna.revenueModel.primary, gemini.correctedRevenue,
    chatgpt?.revenue ?? null, "revenue"
  );
  if (revResult.source) {
    dna.revenueModel.signals.push(revResult.source);
    dna.revenueModel.primary = revResult.value;
  }

  // 4. Market Scope
  const scopeResult = resolve(
    dna.targetMarket.marketScope, gemini.correctedMarketScope,
    chatgpt?.marketScope ?? null, "marketScope"
  );
  if (scopeResult.source) dna.targetMarket.marketScope = scopeResult.value;

  // 5. Maturity
  const matResult = resolve(
    dna.maturity.level, gemini.correctedMaturity,
    chatgpt?.maturity ?? null, "maturity"
  );
  if (matResult.source) {
    dna.maturity.signals.push(matResult.source);
    dna.maturity.level = matResult.value;
  }

  // 6. Scale
  const scaleResult = resolve(
    dna.scale.level, gemini.correctedScale,
    chatgpt?.scale ?? null, "scale"
  );
  if (scaleResult.source) {
    dna.scale.signals.push(scaleResult.source);
    dna.scale.level = scaleResult.value;
  }

  // 7. hasEcommerce — boolean konsensüs
  const geminiEcom = gemini.correctedHasEcommerce;
  const chatgptEcom = chatgpt?.hasEcommerce ?? null;
  if (geminiEcom !== null || chatgptEcom !== null) {
    // İkisi de false diyorsa → kesin false
    if (geminiEcom === false && chatgptEcom === false) {
      dna.contentStructure.hasEcommerce = false;
    } else if (geminiEcom === false || chatgptEcom === false) {
      // En az biri false diyorsa → false (muhafazakar yaklaşım)
      dna.contentStructure.hasEcommerce = false;
    }
    // İkisi de true diyorsa veya biri true + biri null → mevcut kalsın
  }

  // 8. hasBlog — boolean konsensüs
  const geminiBlog = gemini.correctedHasBlog;
  const chatgptBlog = chatgpt?.hasBlog ?? null;
  if (geminiBlog !== null || chatgptBlog !== null) {
    if (geminiBlog === true || chatgptBlog === true) {
      dna.contentStructure.hasBlog = true;
    } else if (geminiBlog === false && chatgptBlog === false) {
      dna.contentStructure.hasBlog = false;
    }
  }

  // 9. Industry — ChatGPT fallback
  if (!dna.identity.industry && chatgpt?.industry) {
    dna.identity.industry = chatgpt.industry;
  }
}

// ============================================================
// VALIDATION — Çapraz doğrulama
// ============================================================
function validateDNA(
  dna: WebsiteDNA,
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis,
  dns: DNSResult,
  domainInfo: DomainInfo,
  html: string
): WebsiteDNA {
  const result = structuredClone(dna);

  // --- Site Type Cross-Validation ---
  validateSiteType(result, crawl, html);

  // --- Target Market Cross-Validation ---
  validateTargetMarket(result, pageAnalysis, html);

  // --- Maturity Cross-Validation ---
  validateMaturityConsistency(result, domainInfo);

  // --- Scale Cross-Validation ---
  validateScaleConsistency(result, crawl);

  // --- Revenue Model Cross-Validation ---
  validateRevenueModelConsistency(result, crawl, html);

  // --- Tech Stack Cross-Validation ---
  validateTechStackConsistency(result, dns, html);

  return result;
}

function validateSiteType(dna: WebsiteDNA, crawl: CrawlResult, html: string): void {
  const type = dna.identity.siteType;
  const platform = crawl.techDetection.platform?.toLowerCase() || "";

  if (type === "e-commerce") {
    const hasProductSchema = crawl.technical.schemaTypes.some(s => s.toLowerCase() === "product");
    const hasShopify = platform.includes("shopify");
    const hasCartPattern = /cart|checkout|sepet|ödeme/i.test(html);
    const checks = [hasProductSchema, hasShopify, hasCartPattern].filter(Boolean).length;
    if (checks < 2) {
      dna.identity.siteTypeConfidence = Math.min(dna.identity.siteTypeConfidence, 45);
      dna.identity.signals.push("Doğrulama: e-commerce sinyalleri zayıf");
    }
  }

  if (type === "blog") {
    const hasArticleSchema = crawl.technical.schemaTypes.some(s =>
      ["article", "blogposting"].includes(s.toLowerCase())
    );
    const hasBlogLink = /\/blog/i.test(html);
    const checks = [hasArticleSchema, hasBlogLink].filter(Boolean).length;
    if (checks < 1) {
      dna.identity.siteTypeConfidence = Math.min(dna.identity.siteTypeConfidence, 45);
      dna.identity.signals.push("Doğrulama: blog sinyalleri zayıf");
    }
  }

  if (type === "saas") {
    const hasPricing = /pricing|fiyatlandırma/i.test(html);
    const hasSignup = /sign.?up|free.?trial|kayıt/i.test(html);
    const hasApi = /api|docs/i.test(html);
    const checks = [hasPricing, hasSignup, hasApi].filter(Boolean).length;
    if (checks < 2) {
      dna.identity.siteTypeConfidence = Math.min(dna.identity.siteTypeConfidence, 45);
      dna.identity.signals.push("Doğrulama: SaaS sinyalleri zayıf");
    }
  }
}

function validateTargetMarket(dna: WebsiteDNA, pageAnalysis: PageAnalysis, html: string): void {
  const socialPlatforms = pageAnalysis.socialLinks.map(s => s.platform.toLowerCase());

  if (dna.targetMarket.audience === "B2B") {
    const hasLinkedIn = socialPlatforms.includes("linkedin") || /linkedin\.com/i.test(html);
    const hasEnterprise = /enterprise|api|integration/i.test(html);
    if (!hasLinkedIn && !hasEnterprise) {
      dna.targetMarket.audience = "unknown";
    }
  }

  if (dna.targetMarket.audience === "B2C") {
    const hasEcomSignal = /cart|sepet|kargo|shipping/i.test(html);
    const hasSocialConsumer = socialPlatforms.includes("instagram") || /tiktok\.com/i.test(html);
    if (!hasEcomSignal && !hasSocialConsumer) {
      dna.targetMarket.audience = "unknown";
    }
  }
}

function validateMaturityConsistency(dna: WebsiteDNA, domainInfo: DomainInfo): void {
  const { score, level } = dna.maturity;
  const ageDays = domainInfo.domainAge;

  // veteran ama domain < 2 yıl → growing'e düşür
  if (level === "veteran" && ageDays !== null && ageDays < 730) {
    dna.maturity.level = "growing";
    dna.maturity.signals.push("Doğrulama: veteran → growing (domain çok genç)");
  }
  // newborn ama domain > 5 yıl → young'a yükselt
  if (level === "newborn" && ageDays !== null && ageDays > 1825) {
    dna.maturity.level = "young";
    dna.maturity.signals.push("Doğrulama: newborn → young (domain eski)");
  }

  // Score-level consistency
  if (level === "veteran" && score < 80) dna.maturity.level = "mature";
  if (level === "mature" && score < 60) dna.maturity.level = "growing";
  if (level === "growing" && score < 40) dna.maturity.level = "young";
  if (level === "newborn" && score >= 20) dna.maturity.level = "young";
}

function validateScaleConsistency(dna: WebsiteDNA, crawl: CrawlResult): void {
  const { level, estimatedPages } = dna.scale;
  const sitemapCount = crawl.technical.sitemapPageCount;

  if (level === "enterprise" && (sitemapCount !== null ? sitemapCount < 100 : (estimatedPages ?? 0) < 100)) {
    dna.scale.level = "large";
    dna.scale.signals.push("Doğrulama: enterprise → large (sayfa sayısı yetersiz)");
  }
  if (level === "single-page" && crawl.links.totalInternal > 10) {
    dna.scale.level = "small";
    dna.scale.signals.push("Doğrulama: single-page → small (internal linkler var)");
  }
}

function validateRevenueModelConsistency(dna: WebsiteDNA, crawl: CrawlResult, html: string): void {
  const model = dna.revenueModel.primary;
  const platform = crawl.techDetection.platform?.toLowerCase() || "";

  if (model === "e-commerce") {
    const hasShopify = platform.includes("shopify");
    const hasCart = /cart|checkout|sepet/i.test(html);
    if (!hasShopify && !hasCart) {
      dna.revenueModel.primary = "unknown";
      dna.revenueModel.signals.push("Doğrulama: e-commerce sinyalleri yetersiz → unknown");
    }
  }

  if (model === "saas") {
    const hasPricing = /pricing|subscribe|fiyatlandırma/i.test(html);
    if (!hasPricing) {
      dna.revenueModel.primary = "unknown";
      dna.revenueModel.signals.push("Doğrulama: SaaS pricing sinyali yok → unknown");
    }
  }
}

function validateTechStackConsistency(dna: WebsiteDNA, dns: DNSResult, html: string): void {
  if (dna.techStack.hosting === "Cloudflare") {
    const nsHasCloudflare = dns.nameservers.some(ns => ns.toLowerCase().includes("cloudflare"));
    const htmlHasCloudflare = /cloudflare/i.test(html);
    if (!nsHasCloudflare && !htmlHasCloudflare) {
      dna.techStack.hosting = null;
    }
  }
}

// ============================================================
// 13. BUILD CRAWL DATA JSON — Heuristic DNA + CrawlResult → JSON
// ============================================================
function buildCrawlDataJSON(
  dna: WebsiteDNA,
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis
): string {
  const data = {
    url: crawl.basicInfo.finalUrl,
    title: crawl.basicInfo.title || null,
    meta_description: crawl.basicInfo.metaDescription || null,
    h1_tags: crawl.headings.h1.map(h => h.text),
    page_titles: crawl.links.internal.map(l => l.text).filter(Boolean).slice(0, 30),
    internal_links_count: crawl.links.totalInternal,
    has_blog: dna.contentStructure.hasBlog,
    blog_post_count: null,
    last_blog_date: null,
    has_ecommerce: dna.contentStructure.hasEcommerce,
    has_pricing_page: dna.contentStructure.hasPricingPage,
    has_contact_form: pageAnalysis.cta.hasContactForm,
    tech_stack: [
      dna.techStack.platform,
      dna.techStack.jsFramework,
      dna.techStack.hosting,
    ].filter(Boolean),
    legal_pages: {
      privacy_policy: dna.legalTrust.hasPrivacyPolicy,
      terms: dna.legalTrust.hasTerms,
      kvkk: dna.legalTrust.hasKVKK,
      cookie_consent: dna.legalTrust.hasCookieConsent,
    },
    social_links: pageAnalysis.socialLinks.map(s => `${s.platform}: ${s.url}`),
    contact_info: {
      methods: dna.contact.methods,
      has_physical_address: dna.contact.hasPhysicalAddress,
    },
    visible_cta_texts: pageAnalysis.ctaTexts.slice(0, 15),
    homepage_hero_text: pageAnalysis.heroText || null,
    about_page_summary: pageAnalysis.businessSignals.aboutPageSummary || null,
    business_signals: {
      numeric_claims: pageAnalysis.businessSignals.numericClaims,
      has_visible_price: pageAnalysis.businessSignals.hasVisiblePrice,
      partner_portal: pageAnalysis.businessSignals.partnerPortal,
      manufacturer_signals: pageAnalysis.businessSignals.manufacturerSignals,
      footer_locations: pageAnalysis.businessSignals.footerLocations,
      navigation_items: pageAnalysis.businessSignals.navigationItems,
      business_keywords: pageAnalysis.businessSignals.businessKeywords,
      multi_country_presence: pageAnalysis.businessSignals.multiCountryPresence,
    },
    schema_types: crawl.technical.schemaTypes,
    language: crawl.basicInfo.language,
    domain_tld: getDomain(crawl.basicInfo.finalUrl).split(".").pop() || null,
  };

  return JSON.stringify(data, null, 2);
}

// ============================================================
// 14. GENERATE BUSINESS ANALYSIS — v3 Prompt + Gemini
// ============================================================
interface BusinessAnalysisResult {
  analysis: DNABusinessAnalysis;
  _prompt: { template: string; context: string };
}

async function generateBusinessAnalysis(
  dna: WebsiteDNA,
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis
): Promise<BusinessAnalysisResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const crawlDataJSON = buildCrawlDataJSON(dna, crawl, pageAnalysis);

  const promptTemplate = `Sen kıdemli bir Dijital İş Analisti, İçerik Stratejisti ve Blog Danışmanısın.

Sana verilen bir web sitesini yalnızca tasarım veya teknik yapı üzerinden değil; iş modelinin
mantığı, para kazanma mekanizması, stratejik konumlanması ve içerik potansiyeli üzerinden
analiz edeceksin.

═══════════════════════════════════════
SİTE VERİLERİ (Otomatik Tarama)
═══════════════════════════════════════
Aşağıdaki veriler otomatik crawl ile elde edilmiştir.
Bu verileri DOĞRU KABUL ET, tekrar tahmin etme.
Senin görevin bu verilerin ÜSTÜNE iş analizi katmanını eklemek.

Tech stack, legal sayfalar, iletişim bilgileri ve sosyal medya
linkleri gibi veriler zaten taranmıştır — bunları tekrar üretme.

{{CRAWL_DATA}}

═══════════════════════════════════════
AMAÇ
═══════════════════════════════════════
Bu sitenin gerçek DNA'sını çözmek. Yani:
• Şirket gerçekte ne iş yapıyor?
• Web sitesi bu iş modeline hizmet ediyor mu, yoksa sadece vitrin mi?
• Blog / içerik üretimi bu yapıda satış motoru mu, lead makinesi mi, yoksa marka süsü mü?
• Bu site için blog yazacak biri HANGİ konularda, HANGİ tonda, KİME hitaben yazmalı?

═══════════════════════════════════════
ANALİZ KATMANLARI
═══════════════════════════════════════

1. MİSYON & PROBLEM ANALİZİ
   • Site gerçekten bir problemi mi çözüyor, yoksa "biz buradayız" mı diyor?
   • Kullanıcı siteye girdiğinde neden kalmalı?
   • Hangi acı noktayı (pain point) adresliyor?
   • Çözüm vaadi net mi, belirsiz mi?

2. GELİR MODELİ ÇÖZÜMLEMESİ
   • Para doğrudan mı kazanılıyor (ürün/hizmet satışı)?
   • Lead toplayıp satış ekibine mi aktarılıyor?
   • Distribütörlük, bayilik veya teklif talebi mi ana hedef?
   • Trafik → içerik → dolaylı gelir (reklam, otorite) modeli var mı?
   • Sitede fiyat bilgisi var mı? Yoksa "teklif alın" mı diyor? Bu ne anlama geliyor?

3. GÜVEN & OTORİTE SİNYALLERİ
   • "Fabrika / üretici / köklü firma" hissi mi veriyor?
   • Yoksa "startup / girişim / ölçeklenme arayan yapı" mı?
   • Referanslar, sertifikalar, teknik dil, görsel yapı ve söylem bunu nasıl destekliyor?
   • Sosyal kanıt var mı? (Müşteri yorumları, vaka çalışmaları, logolar, medya görünürlüğü)

4. HEDEF KİTLE DERİNLİĞİ (Blog için kritik)
   • Birincil hedef kitle kim? (Sektör, pozisyon, karar verici profili)
   • Alıcı farkındalık seviyesi ne?
     - Problemi bilmiyor (Unaware)
     - Problemi biliyor ama çözümü bilmiyor (Problem-Aware)
     - Çözümleri araştırıyor (Solution-Aware)
     - Bu firmayı değerlendiriyor (Product-Aware)
   • Müşteri yolculuğunun hangi aşamasına hitap ediyor site? (TOFU / MOFU / BOFU)
   • Sitenin dili teknik mi, sade mi, kurumsal mı, samimi mi?

5. İÇERİK & SEO DURUMU
   • Mevcut blog var mı? Aktif mi? Son yazı ne zaman yayınlanmış?
   • İçerik bilinçli bir stratejiyle mi üretilmiş, yoksa rastgele mi?
   • Sayfa başlıkları ve meta açıklamaları SEO odaklı mı?
   • H1, title ve meta description'lardan gözlemlenen anahtar kelime sinyalleri neler?
   • Sektör bilgine dayanarak olası içerik boşlukları neler?

6. CTA & DÖNÜŞÜM YAPISI
   • Sitede ana CTA (Call-to-Action) ne? (Teklif al, ara, sepete ekle, demo iste, form doldur)
   • CTA tutarlı mı yoksa sayfalara göre değişiyor mu?
   • Blog yazılarının sonunda hangi CTA mantıklı olur?

7. TON & SES ANALİZİ (Blog için kritik)
   • Sitenin mevcut iletişim tonu ne?
     - Kurumsal / Resmi
     - Teknik / Mühendislik dili
     - Samimi / Sohbet tarzı
     - Satışçı / İkna odaklı
     - Eğitici / Bilgilendirici
   • Blog bu tonla uyumlu mu olmalı, yoksa farklılaşmalı mı?

8. DİJİTAL OLGUNLUK
   • Site aktif bir satış aracı mı, yoksa dijital kartvizit mi?
   • İçerik stratejisi bilinçli mi yoksa rastgele mi?
   • Blog yazılabilir mi, yazılmalı mı, yoksa zaman kaybı mı?
   • Eğer blog yazılacaksa, sitenin mevcut yapısı bunu destekliyor mu?

═══════════════════════════════════════
İŞ MODELİ SİNYAL OKUMA KURALLARI (KRİTİK)
═══════════════════════════════════════
business_signals verisini MUTLAKA oku ve şu kurallara göre değerlendir:

• manufacturer_signals: true ise → operational_role: "Manufacturer" olma ihtimali çok yüksek
• partner_portal.exists: true ise → audience_type: "B2B" sinyali, lead-gen modeli
• has_visible_price: false VE ürün/kategori sayfaları varsa → bu e-ticaret DEĞİL, KATALOG/TANITIM sitesi
• multi_country_presence: true ise → market_scope: KESİNLİKLE "Global" yap, "National" YAZMA
• numeric_claims'de "X countries/ülke" geçiyorsa → market_scope: KESİNLİKLE "Global"
• footer_locations'da 2+ farklı ülke varsa → market_scope: KESİNLİKLE "Global"
• domain_tld ülkeye özel ise (.co.uk, .de, .fr, .com.tr vb.) → market_scope: "National" (o ülke pazarı)
• Sitede "free UK delivery", "ücretsiz Türkiye kargo" gibi ülkeye özel teslimat ifadesi varsa → "National"
• numeric_claims'de "factory/fabrika" geçiyorsa → kesinlikle üretici
• navigation_items'da "partner/dealer/bayi/login" varsa → B2B portal sinyali
• cta_texts'de "buy/satın al/sepete ekle" YOKSA VE "reach us/get connected/teklif al" VARSA → lead-gen, e-ticaret değil
• footer_locations 2+ ülke gösteriyorsa → global operasyon
• about_page_summary varsa → şirketin gerçek hikayesini buradan oku, homepage'den değil

ÖNEMLİ: Ürün görselleri ve kategori sayfaları olması e-ticaret ANLAMINA GELMEZ.
Fiyat + sepet + ödeme yoksa bu bir KATALOG/TANITIM sitesidir.

═══════════════════════════════════════
KURALLAR
═══════════════════════════════════════
• Doğrulayamadığın veya crawl verisinden çıkaramadığın alanlara null yaz, UYDURMA.
• Tahmine dayanan alanlarda değerin başına "estimated:" öneki ekle.
  Örnek: "estimated: Ayda 2-3 yazı"
• Crawl verisinde zaten bulunan bilgileri (tech stack, legal, contact, social) tekrar üretme.
  Senin işin İŞ ANALİZİ ve BLOG STRATEJİSİ katmanını eklemek.
• identified_keyword_clusters yerine observed_keyword_signals kullan.
  Bunlar H1/title/meta'dan gözlemlenen sinyallerdir, GSC/Semrush verisi DEĞİLDİR.
• content_gaps alanı sektör bilgine dayanan TAHMİNDİR, bunu açıkça belirt.
• Tüm açıklama alanlarını TÜRKÇE yaz.

═══════════════════════════════════════
ÇIKTI FORMATI
═══════════════════════════════════════

⚠️ SADECE JSON DÖNDÜR – açıklama, yorum, ekstra metin yazma.

{
  "business_identity": {
    "what_it_does": "",
    "core_problem_solved": "",
    "value_proposition": "",
    "operational_role": "Manufacturer | Distributor | Service-Provider | Retailer | SaaS | Content-Creator | Marketplace | Agency",
    "primary_purpose": "Sales | Lead-Generation | Brand-Awareness | Support | Community",
    "pricing_transparency": "Visible | Hidden-Quote-Based | Freemium | Not-Applicable"
  },

  "target_audience": {
    "primary_audience": "",
    "buyer_persona": "",
    "decision_maker_role": "",
    "awareness_level": "Unaware | Problem-Aware | Solution-Aware | Product-Aware | Most-Aware",
    "funnel_focus": "TOFU | MOFU | BOFU | Full-Funnel",
    "audience_type": "B2B | B2C | Both"
  },

  "revenue_model": {
    "how_money_is_made": "",
    "primary_conversion_action": "",
    "sales_cycle": "Instant | Short | Medium | Long-Complex",
    "lead_capture_methods": []
  },

  "trust_signals": {
    "company_maturity": "Startup | Growing | Established | Enterprise",
    "social_proof_types": [],
    "certifications_or_awards": [],
    "trust_level_assessment": ""
  },

  "content_status": {
    "has_active_blog": false,
    "last_post_date": null,
    "content_frequency": "None | Sporadic | Monthly | Weekly | Daily",
    "content_quality": "None | Low | Medium | High | Professional",
    "seo_awareness": "None | Basic | Intermediate | Advanced",
    "observed_keyword_signals": [],
    "estimated_content_gaps": []
  },

  "cta_structure": {
    "primary_cta": "",
    "cta_consistency": "Consistent | Varies | Weak | Missing",
    "recommended_blog_cta": ""
  },

  "tone_and_voice": {
    "current_site_tone": "Corporate | Technical | Friendly | Sales-Driven | Educational | Mixed",
    "language_complexity": "Simple | Moderate | Technical | Expert-Level",
    "recommended_blog_tone": "",
    "tone_alignment_note": ""
  },

  "digital_maturity": {
    "sophistication_score": 0,
    "score_reasoning": "",
    "site_type": "e-commerce | corporate | saas | blog | portfolio | hybrid",
    "is_active_sales_tool": false,
    "has_real_ecommerce": false
  },

  "blog_strategy_verdict": {
    "should_blog": true,
    "why": "",
    "blog_role": "SEO-Traffic-Engine | Lead-Magnet | Authority-Builder | Customer-Education | Sales-Support | Not-Recommended",
    "priority_topics": [],
    "topics_to_avoid": [],
    "recommended_content_types": [],
    "posting_frequency_suggestion": ""
  },

  "summary": "",

  "metrics": {
    "industry": "",
    "market_scope": "Local | National | Regional | Global"
  }
}`;

  const prompt = promptTemplate.replace("{{CRAWL_DATA}}", crawlDataJSON);

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8000,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[DNA v3] Gemini API error:", res.status, errText);
      return null;
    }

    const data = await res.json();
    let jsonStr = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!jsonStr) return null;

    // Clean markdown fences if present
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

    const parsed = JSON.parse(jsonStr.trim());

    // Validation + defaults
    const analysis: DNABusinessAnalysis = {
      business_identity: {
        what_it_does: parsed.business_identity?.what_it_does || "Bilinmiyor",
        core_problem_solved: parsed.business_identity?.core_problem_solved || "Bilinmiyor",
        value_proposition: parsed.business_identity?.value_proposition || "Bilinmiyor",
        operational_role: parsed.business_identity?.operational_role || "Service-Provider",
        primary_purpose: parsed.business_identity?.primary_purpose || "Brand-Awareness",
        pricing_transparency: parsed.business_identity?.pricing_transparency || "Not-Applicable",
      },
      target_audience: {
        primary_audience: parsed.target_audience?.primary_audience || "Bilinmiyor",
        buyer_persona: parsed.target_audience?.buyer_persona || "Bilinmiyor",
        decision_maker_role: parsed.target_audience?.decision_maker_role || "Bilinmiyor",
        awareness_level: parsed.target_audience?.awareness_level || "Problem-Aware",
        funnel_focus: parsed.target_audience?.funnel_focus || "Full-Funnel",
        audience_type: parsed.target_audience?.audience_type || "B2C",
      },
      revenue_model: {
        how_money_is_made: parsed.revenue_model?.how_money_is_made || "Bilinmiyor",
        primary_conversion_action: parsed.revenue_model?.primary_conversion_action || "Bilinmiyor",
        sales_cycle: parsed.revenue_model?.sales_cycle || "Medium",
        lead_capture_methods: Array.isArray(parsed.revenue_model?.lead_capture_methods) ? parsed.revenue_model.lead_capture_methods : [],
      },
      trust_signals: {
        company_maturity: parsed.trust_signals?.company_maturity || "Growing",
        social_proof_types: Array.isArray(parsed.trust_signals?.social_proof_types) ? parsed.trust_signals.social_proof_types : [],
        certifications_or_awards: Array.isArray(parsed.trust_signals?.certifications_or_awards) ? parsed.trust_signals.certifications_or_awards : [],
        trust_level_assessment: parsed.trust_signals?.trust_level_assessment || "",
      },
      content_status: {
        has_active_blog: typeof parsed.content_status?.has_active_blog === "boolean" ? parsed.content_status.has_active_blog : false,
        last_post_date: parsed.content_status?.last_post_date || null,
        content_frequency: parsed.content_status?.content_frequency || "None",
        content_quality: parsed.content_status?.content_quality || "None",
        seo_awareness: parsed.content_status?.seo_awareness || "None",
        observed_keyword_signals: Array.isArray(parsed.content_status?.observed_keyword_signals) ? parsed.content_status.observed_keyword_signals : [],
        estimated_content_gaps: Array.isArray(parsed.content_status?.estimated_content_gaps) ? parsed.content_status.estimated_content_gaps : [],
      },
      cta_structure: {
        primary_cta: parsed.cta_structure?.primary_cta || null,
        cta_consistency: parsed.cta_structure?.cta_consistency || "Missing",
        recommended_blog_cta: parsed.cta_structure?.recommended_blog_cta || "",
      },
      tone_and_voice: {
        current_site_tone: parsed.tone_and_voice?.current_site_tone || "Mixed",
        language_complexity: parsed.tone_and_voice?.language_complexity || "Moderate",
        recommended_blog_tone: parsed.tone_and_voice?.recommended_blog_tone || "Bilinmiyor",
        tone_alignment_note: parsed.tone_and_voice?.tone_alignment_note || "",
      },
      digital_maturity: {
        sophistication_score: parsed.digital_maturity?.sophistication_score != null
          ? Math.min(100, Math.max(0, parsed.digital_maturity.sophistication_score))
          : 50,
        score_reasoning: parsed.digital_maturity?.score_reasoning || "",
        site_type: parsed.digital_maturity?.site_type || "corporate",
        is_active_sales_tool: typeof parsed.digital_maturity?.is_active_sales_tool === "boolean" ? parsed.digital_maturity.is_active_sales_tool : false,
        has_real_ecommerce: typeof parsed.digital_maturity?.has_real_ecommerce === "boolean" ? parsed.digital_maturity.has_real_ecommerce : false,
      },
      blog_strategy_verdict: {
        should_blog: typeof parsed.blog_strategy_verdict?.should_blog === "boolean" ? parsed.blog_strategy_verdict.should_blog : true,
        why: parsed.blog_strategy_verdict?.why || "",
        blog_role: parsed.blog_strategy_verdict?.blog_role || "Authority-Builder",
        priority_topics: Array.isArray(parsed.blog_strategy_verdict?.priority_topics) ? parsed.blog_strategy_verdict.priority_topics : [],
        topics_to_avoid: Array.isArray(parsed.blog_strategy_verdict?.topics_to_avoid) ? parsed.blog_strategy_verdict.topics_to_avoid : [],
        recommended_content_types: Array.isArray(parsed.blog_strategy_verdict?.recommended_content_types) ? parsed.blog_strategy_verdict.recommended_content_types : [],
        posting_frequency_suggestion: parsed.blog_strategy_verdict?.posting_frequency_suggestion || "",
      },
      summary: parsed.summary || "",
      metrics: {
        industry: parsed.metrics?.industry || "Bilinmiyor",
        market_scope: parsed.metrics?.market_scope || "National",
      },
    };

    return {
      analysis,
      _prompt: { template: promptTemplate, context: crawlDataJSON },
    };
  } catch (err) {
    console.error("[DNA v3] Business analysis error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ============================================================
// 15. SCORE → GROWTH STAGE MAPPING
// ============================================================
function scoreToGrowthStage(score: number): string {
  if (score >= 85) return "Usta";
  if (score >= 70) return "Yetişkin";
  if (score >= 55) return "Genç";
  if (score >= 40) return "Çocuk";
  if (score >= 25) return "Bebek";
  return "Yeni Doğmuş";
}
