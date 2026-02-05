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

  // AI synthesis + verification: Gemini + ChatGPT paralel
  const [geminiResult, chatgptResult] = await Promise.all([
    generateDNASynthesis(dna, crawl),
    chatgptVerifyDNA(dna, crawl),
  ]);

  // Konsensüs oluştur ve DNA'yı güncelle
  resolveAIConsensus(dna, geminiResult, chatgptResult);

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
  if (hreflangs.length > 1) {
    marketScope = "global";
  } else if (/\.(tr|de|fr|jp|cn|br|ru|kr|it|es|nl|pl)$/i.test(domain)) {
    marketScope = "local";
  } else if (domain.endsWith(".com") && hreflangs.length <= 1) {
    marketScope = "national";
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

  return { hasBlog, hasAuth, hasSearch, hasMobileApp, hasNewsletter, hasEcommerce };
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
}

async function generateDNASynthesis(dna: WebsiteDNA, crawl: CrawlResult): Promise<AIVerification> {
  const fallback: AIVerification = {
    synthesis: { summary: null, sophisticationScore: null, growthStage: null },
    industry: null, correctedSiteType: null, correctedAudience: null, correctedRevenue: null,
    correctedMarketScope: null, correctedMaturity: null, correctedScale: null,
    correctedHasEcommerce: null, correctedHasBlog: null,
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

  const prompt = `Sen bir web sitesi DNA doğrulama uzmanısın. Otomatik tarayıcı aşağıdaki tespitleri yaptı. Senin görevin:
1. Bu tespitleri doğrula veya düzelt
2. Türkçe bir özet yaz
3. Eksik bilgileri tamamla

${dnaContext}

JSON döndür:
{
  "summary": "Türkçe 3-5 cümle. Sitenin ne olduğunu, kime hitap ettiğini, dijital varlık durumunu açıkla.",
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
          maxOutputTokens: 2000,
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
    };
  } catch (err) {
    console.error("[DNA] AI synthesis error:", err);
    return fallback;
  }
}

// ============================================================
// 11. CHATGPT VERIFICATION — İkinci AI doğrulama
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
    };
  } catch (err) {
    console.error("[DNA] ChatGPT verification error:", err);
    return null;
  }
}

// ============================================================
// 12. AI CONSENSUS — İki AI'ın konsensüsü
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
