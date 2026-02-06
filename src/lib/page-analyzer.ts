import * as cheerio from "cheerio";
import type { PageAnalysis, LinkInfo } from "./types";

const ABOUT_USER_AGENT =
  "Mozilla/5.0 (compatible; LaunchPilotBot/1.0; +https://launchpilot.dev)";

export function analyzePage($: cheerio.CheerioAPI, html: string, baseUrl?: string): PageAnalysis {
  // ── Analytics Tespiti ──
  const hasGoogleAnalytics =
    html.includes("google-analytics.com") ||
    html.includes("gtag(") ||
    html.includes("GoogleAnalyticsObject") ||
    html.includes("www.googletagmanager.com/gtag");

  const hasGTM =
    html.includes("googletagmanager.com/gtm") ||
    html.includes("GTM-");

  const hasMetaPixel =
    html.includes("connect.facebook.net") ||
    html.includes("fbq(") ||
    html.includes("facebook-pixel");

  const hasHotjar =
    html.includes("hotjar.com") || html.includes("hj(");

  const otherTools: string[] = [];
  if (html.includes("clarity.ms") || html.includes("clarity(")) otherTools.push("Microsoft Clarity");
  if (html.includes("mixpanel.com")) otherTools.push("Mixpanel");
  if (html.includes("segment.com") || html.includes("analytics.js")) otherTools.push("Segment");
  if (html.includes("plausible.io")) otherTools.push("Plausible");
  if (html.includes("amplitude.com")) otherTools.push("Amplitude");
  if (html.includes("posthog.com") || html.includes("posthog")) otherTools.push("PostHog");

  // ── Sosyal Medya Linkleri ──
  const socialLinks: { platform: string; url: string }[] = [];
  const socialPatterns: [string, RegExp][] = [
    ["Twitter/X", /https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+/],
    ["Facebook", /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.]+/],
    ["Instagram", /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+/],
    ["LinkedIn", /https?:\/\/([a-z]{2}\.)?linkedin\.com\/(company|in|school)\/[a-zA-Z0-9_-]+/],
    ["YouTube", /https?:\/\/(www\.)?youtube\.com\/(channel\/|c\/|@)[a-zA-Z0-9_-]+/],
    ["GitHub", /https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+/],
    ["TikTok", /https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+/],
    ["Pinterest", /https?:\/\/([a-z]{2}\.)?pinterest\.(com|co\.\w+)\/[a-zA-Z0-9_-]+/],
  ];

  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    for (const [platform, pattern] of socialPatterns) {
      const match = href.match(pattern);
      if (match && !seen.has(platform)) {
        seen.add(platform);
        socialLinks.push({ platform, url: match[0] });
      }
    }
  });

  // ── CTA / Form Tespiti ──
  const forms = $("form").length;
  const buttons = $("button").length + $('input[type="submit"]').length + $('a[role="button"]').length;
  const hasContactForm =
    $('form[action*="contact"]').length > 0 ||
    $('form[id*="contact"]').length > 0 ||
    $('form[class*="contact"]').length > 0 ||
    html.includes("contact-form") ||
    html.includes("contactForm");

  // ── Trust Sinyalleri ──
  const bodyText = $("body").text().toLowerCase();
  const allHrefs = $("a[href]")
    .map((_, el) => $(el).attr("href") || "")
    .get()
    .join(" ")
    .toLowerCase();

  const hasPrivacyPolicy =
    allHrefs.includes("privacy") ||
    bodyText.includes("privacy policy") ||
    bodyText.includes("gizlilik politikası");

  const hasTerms =
    allHrefs.includes("terms") ||
    allHrefs.includes("tos") ||
    bodyText.includes("terms of service") ||
    bodyText.includes("kullanım koşulları");

  const hasPhoneNumber = /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}/.test(bodyText);
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test($("body").html() || "");
  const hasAddress =
    bodyText.includes("address") ||
    bodyText.includes("adres") ||
    $("[itemtype*='PostalAddress']").length > 0;
  const hasContactInfo = hasPhoneNumber || hasEmail || hasAddress;

  // ── CTA Metinleri ──
  const ctaTexts: string[] = [];
  const ctaSet = new Set<string>();
  $("button, a.btn, a.cta, a[class*='btn'], a[class*='cta'], a[role='button'], input[type='submit']").each((_, el) => {
    const tag = $(el).prop("tagName")?.toLowerCase();
    let text = "";
    if (tag === "input") {
      text = ($(el).attr("value") || "").trim();
    } else {
      text = $(el).text().trim().replace(/\s+/g, " ");
    }
    if (text && text.length > 1 && text.length < 80 && !ctaSet.has(text.toLowerCase())) {
      ctaSet.add(text.toLowerCase());
      ctaTexts.push(text);
    }
  });

  // ── Hero Text ──
  let heroText: string | null = null;
  const heroSelectors = ["section.hero", "#hero", ".hero", "[class*='hero']", "main > section:first-of-type"];
  for (const sel of heroSelectors) {
    const heroEl = $(sel).first();
    if (heroEl.length > 0) {
      const h1 = heroEl.find("h1").first().text().trim();
      const p = heroEl.find("p").first().text().trim();
      if (h1 || p) {
        heroText = [h1, p].filter(Boolean).join(" — ");
        break;
      }
    }
  }
  // Fallback: ilk H1 + ilk paragraf
  if (!heroText) {
    const firstH1 = $("h1").first().text().trim();
    const firstP = $("p").first().text().trim();
    if (firstH1) {
      heroText = firstP ? `${firstH1} — ${firstP}` : firstH1;
    }
  }
  if (heroText && heroText.length > 300) {
    heroText = heroText.substring(0, 300);
  }

  // ── Font Tespiti ──
  const fonts: string[] = [];
  const fontSet = new Set<string>();
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const familyMatch = href.match(/family=([^&:]+)/);
    if (familyMatch) {
      familyMatch[1].split("|").forEach((f) => {
        const name = decodeURIComponent(f.replace(/\+/g, " ").split(":")[0]);
        if (!fontSet.has(name)) {
          fontSet.add(name);
          fonts.push(name);
        }
      });
    }
  });

  // ── CSS Framework Tespiti ──
  const cssFrameworks: string[] = [];
  if (html.includes("bootstrap") || html.includes("Bootstrap")) cssFrameworks.push("Bootstrap");
  if (html.includes("tailwindcss") || html.includes("tailwind")) cssFrameworks.push("Tailwind CSS");
  if (html.includes("bulma")) cssFrameworks.push("Bulma");
  if (html.includes("foundation")) cssFrameworks.push("Foundation");
  if (html.includes("materialize")) cssFrameworks.push("Materialize");
  if (html.includes("chakra")) cssFrameworks.push("Chakra UI");
  if (html.includes("antd") || html.includes("ant-design")) cssFrameworks.push("Ant Design");

  // ── Cookie Consent / Banner Tespiti ──
  const cookiePatterns: [string, string][] = [
    ["cookiebot", "Cookiebot"],
    ["cookie-consent", "Cookie Consent Banner"],
    ["cookie-banner", "Cookie Banner"],
    ["cookie-notice", "Cookie Notice"],
    ["cookie-law", "Cookie Law"],
    ["cookie-policy", "Cookie Policy Link"],
    ["onetrust", "OneTrust"],
    ["cookieconsent", "CookieConsent (Osano)"],
    ["quantcast", "Quantcast Choice"],
    ["iubenda", "Iubenda"],
    ["complianz", "Complianz"],
    ["cookie_consent", "Cookie Consent"],
    ["gdpr-cookie", "GDPR Cookie"],
    ["cc-banner", "CC Banner"],
    ["cc-compliance", "CC Compliance"],
  ];

  const htmlLower = html.toLowerCase();
  const detectedCookiePatterns: string[] = [];
  for (const [pattern, label] of cookiePatterns) {
    if (htmlLower.includes(pattern)) {
      detectedCookiePatterns.push(label);
    }
  }
  // Body text'te çerez / cookie kelime kontrolü (Türkçe + İngilizce)
  if (!detectedCookiePatterns.length) {
    if (
      bodyText.includes("çerez") ||
      bodyText.includes("cookie") && (bodyText.includes("kabul") || bodyText.includes("accept"))
    ) {
      detectedCookiePatterns.push("Çerez/Cookie metni");
    }
  }

  const cookieConsent = {
    detected: detectedCookiePatterns.length > 0,
    patterns: detectedCookiePatterns,
  };

  // ── Business Signals ──
  const navigationItems = extractNavigationItems($);
  const footerLocations = extractFooterLocations($);
  const numericClaims = extractNumericClaims($);
  const hasVisiblePrice = checkForVisiblePrices($);
  const partnerPortal = detectPartnerPortal($, baseUrl || "");
  const manufacturerSignals = detectManufacturerSignals($);
  const businessKeywords = extractBusinessKeywords($);
  const multiCountryPresence = checkMultiCountryPresence(footerLocations, bodyText);

  return {
    analytics: {
      hasGoogleAnalytics,
      hasGTM,
      hasMetaPixel,
      hasHotjar,
      otherTools,
    },
    socialLinks,
    cta: {
      forms,
      buttons,
      hasContactForm,
    },
    trustSignals: {
      hasPrivacyPolicy,
      hasTerms,
      hasContactInfo,
      hasPhoneNumber,
      hasEmail,
      hasAddress,
    },
    fonts,
    cssFrameworks,
    cookieConsent,
    ctaTexts: ctaTexts.slice(0, 20),
    heroText,
    businessSignals: {
      numericClaims,
      hasVisiblePrice,
      partnerPortal,
      manufacturerSignals,
      footerLocations,
      navigationItems,
      businessKeywords,
      multiCountryPresence,
      aboutPageSummary: null, // filled externally via fetchAboutPageSummary
    },
  };
}

// ============================================================
// BUSINESS SIGNALS — Extraction Functions
// ============================================================

// 2a. Navigation Items
function extractNavigationItems($: cheerio.CheerioAPI): string[] {
  const items = new Set<string>();
  $('nav a, header a, [role="navigation"] a').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (text && text.length > 0 && text.length < 60) {
      items.add(text);
    }
  });
  return Array.from(items).slice(0, 30);
}

// 2b. Footer Locations
function extractFooterLocations($: cheerio.CheerioAPI): string[] {
  const footerText: string[] = [];
  $('footer, [class*="footer"], #footer').each((_, el) => {
    footerText.push($(el).text());
  });
  const combined = footerText.join(" ");

  const countries = [
    // EN
    "Turkey", "United States", "USA", "United Kingdom", "UK", "Germany", "France",
    "Netherlands", "Italy", "Spain", "UAE", "United Arab Emirates", "Saudi Arabia",
    "Uzbekistan", "China", "Japan", "South Korea", "Korea", "Russia", "India",
    "Brazil", "Canada", "Australia", "Poland", "Belgium", "Austria", "Switzerland",
    "Sweden", "Norway", "Denmark", "Finland", "Greece", "Portugal", "Ireland",
    "Czech Republic", "Romania", "Hungary", "Bulgaria", "Croatia", "Serbia",
    "Mexico", "Argentina", "Colombia", "Chile", "Singapore", "Malaysia",
    "Thailand", "Indonesia", "Vietnam", "Philippines", "Egypt", "Morocco",
    "South Africa", "Nigeria", "Israel", "Qatar", "Kuwait", "Bahrain", "Oman",
    // TR
    "Türkiye", "Amerika", "ABD", "İngiltere", "Almanya", "Fransa", "Hollanda",
    "İtalya", "İspanya", "BAE", "Suudi Arabistan", "Özbekistan", "Çin",
    "Japonya", "Güney Kore", "Rusya", "Hindistan", "Brezilya", "Kanada",
    "Avustralya", "Polonya", "Belçika", "Avusturya", "İsviçre", "İsveç",
    "Norveç", "Danimarka", "Finlandiya", "Yunanistan", "Portekiz", "İrlanda",
    // Major cities
    "Istanbul", "İstanbul", "Ankara", "İzmir", "London", "New York", "Berlin",
    "Paris", "Dubai", "Riyadh", "Tashkent", "Taşkent", "Moscow", "Moskova",
    "Tokyo", "Beijing", "Shanghai", "Mumbai", "Sydney", "Toronto",
    "Çanakkale", "Bursa", "Antalya", "Konya", "Kayseri", "Gaziantep",
    "Warrington", "Neuss", "Barcelona", "Milan", "Milano", "Amsterdam",
  ];

  const found: string[] = [];
  const foundLower = new Set<string>();
  for (const c of countries) {
    if (combined.includes(c) && !foundLower.has(c.toLowerCase())) {
      foundLower.add(c.toLowerCase());
      found.push(c);
    }
  }
  return found;
}

// 2c. Numeric Claims
function extractNumericClaims($: cheerio.CheerioAPI): string[] {
  const bodyText = $("body").text();
  const regex = /\d[\d,.]*\+?\s*(?:countries|ülke|products|ürün|sq\s*ft|m²|factory|fabrika|years|yıl|employees|çalışan|branches|şube|export|ihracat|offices|stores|clients|müşteri|dealers|bayi|distributors|distribütör|projects|proje|awards|ödül)/gi;
  const matches = bodyText.match(regex) || [];
  const unique = [...new Set(matches.map(m => m.trim()))];
  return unique.slice(0, 10);
}

// 2d. Visible Prices
function checkForVisiblePrices($: cheerio.CheerioAPI): boolean {
  const priceRegex = /[₺$€£]\s*[\d,.]+|[\d,.]+\s*(?:TL|USD|EUR|GBP)/;
  let found = false;
  $("main, article, .product, .content, [class*='product'], [class*='price']").each((_, el) => {
    if (found) return;
    const text = $(el).text();
    if (priceRegex.test(text)) {
      found = true;
    }
  });
  return found;
}

// 2e. Partner Portal Detection
function detectPartnerPortal($: cheerio.CheerioAPI, baseUrl: string): { exists: boolean; url: string | null; type: "subdomain" | "path" | null } {
  // \b ile tam kelime eşleştir — "partnership" gibi false positive'leri önle
  const portalRegex = /\bpartners?\b|dealer|bayi|distributor|distribütör|\bb2b\b|wholesale|toptancı/i;
  let portalUrl: string | null = null;
  let portalType: "subdomain" | "path" | null = null;

  $("a[href]").each((_, el) => {
    if (portalUrl) return;
    const href = $(el).attr("href") || "";
    if (!portalRegex.test(href)) return;

    try {
      const url = new URL(href, baseUrl || "https://example.com");
      // Check subdomain
      const hostParts = url.hostname.split(".");
      if (hostParts.length > 2 && portalRegex.test(hostParts[0])) {
        portalUrl = url.href;
        portalType = "subdomain";
      } else if (portalRegex.test(url.pathname)) {
        portalUrl = url.href;
        portalType = "path";
      }
    } catch {
      // relative path
      if (portalRegex.test(href)) {
        portalUrl = href;
        portalType = "path";
      }
    }
  });

  return { exists: !!portalUrl, url: portalUrl, type: portalType };
}

// 2f. Manufacturer Signals
function detectManufacturerSignals($: cheerio.CheerioAPI): boolean {
  const bodyText = $("body").text();
  return /factory|fabrika|üretim|production|manufacturing|tesis|assembly|montaj|ihracat|export|OEM|ODM/i.test(bodyText);
}

// 2g. Business Keywords
function extractBusinessKeywords($: cheerio.CheerioAPI): string[] {
  const predefined = [
    "factory", "production", "manufacturer", "distributor", "wholesale",
    "B2B", "partner", "dealer", "OEM", "ODM", "export", "franchise",
    "bayilik", "üretici", "toptancı", "ihracat", "tedarik", "supply chain",
    "manufacturing", "fabrika", "üretim", "bayi", "distribütör",
  ];
  const bodyText = $("body").text();
  const found: string[] = [];
  const seen = new Set<string>();
  for (const kw of predefined) {
    if (seen.has(kw.toLowerCase())) continue;
    if (new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(bodyText)) {
      seen.add(kw.toLowerCase());
      found.push(kw);
    }
  }
  return found;
}

// 2h. Multi-Country Presence
// Country alias → normalized country code mapping
const COUNTRY_NORMALIZE: Record<string, string> = {
  "turkey": "TR", "türkiye": "TR",
  "usa": "US", "united states": "US", "amerika": "US", "america": "US",
  "uk": "GB", "united kingdom": "GB", "ingiltere": "GB", "İngiltere": "GB", "england": "GB", "britain": "GB", "great britain": "GB",
  "germany": "DE", "almanya": "DE", "deutschland": "DE",
  "france": "FR", "fransa": "FR",
  "netherlands": "NL", "hollanda": "NL",
  "italy": "IT", "İtalya": "IT", "italya": "IT",
  "spain": "ES", "İspanya": "ES", "ispanya": "ES",
  "uae": "AE", "united arab emirates": "AE", "bae": "AE",
  "saudi arabia": "SA", "suudi arabistan": "SA",
  "uzbekistan": "UZ", "özbekistan": "UZ",
  "china": "CN", "çin": "CN",
  "japan": "JP", "japonya": "JP",
  "south korea": "KR", "güney kore": "KR", "korea": "KR",
  "russia": "RU", "rusya": "RU",
  "india": "IN", "hindistan": "IN",
  "brazil": "BR", "brezilya": "BR",
  "canada": "CA", "kanada": "CA",
  "australia": "AU", "avustralya": "AU",
  "poland": "PL", "polonya": "PL",
  "belgium": "BE", "belçika": "BE",
  "austria": "AT", "avusturya": "AT",
  "switzerland": "CH", "İsviçre": "CH", "isviçre": "CH",
  "sweden": "SE", "İsveç": "SE", "isveç": "SE",
  "norway": "NO", "norveç": "NO",
  "denmark": "DK", "danimarka": "DK",
  "finland": "FI", "finlandiya": "FI",
  "greece": "GR", "yunanistan": "GR",
  "portugal": "PT", "portekiz": "PT",
  "ireland": "IE", "İrlanda": "IE", "irlanda": "IE",
  "israel": "IL",
  "singapore": "SG",
  "malaysia": "MY", "malezya": "MY",
  "mexico": "MX", "meksika": "MX",
  "argentina": "AR", "arjantin": "AR",
  "egypt": "EG", "mısır": "EG",
  "south africa": "ZA",
  "nigeria": "NG", "nijerya": "NG",
  "qatar": "QA", "katar": "QA",
  "kuwait": "KW", "kuveyt": "KW",
};

// City → country code mapping
const CITY_TO_COUNTRY: Record<string, string> = {
  "istanbul": "TR", "İstanbul": "TR", "ankara": "TR", "izmir": "TR", "İzmir": "TR",
  "çanakkale": "TR", "bursa": "TR", "antalya": "TR", "konya": "TR", "kayseri": "TR", "gaziantep": "TR",
  "london": "GB", "manchester": "GB", "birmingham": "GB", "warrington": "GB", "edinburgh": "GB", "glasgow": "GB",
  "new york": "US", "los angeles": "US", "chicago": "US", "san francisco": "US", "miami": "US",
  "berlin": "DE", "munich": "DE", "hamburg": "DE", "neuss": "DE", "frankfurt": "DE",
  "paris": "FR", "lyon": "FR", "marseille": "FR",
  "dubai": "AE", "abu dhabi": "AE",
  "riyadh": "SA", "jeddah": "SA",
  "tashkent": "UZ", "taşkent": "UZ",
  "moscow": "RU", "moskova": "RU",
  "tokyo": "JP", "osaka": "JP",
  "beijing": "CN", "shanghai": "CN",
  "mumbai": "IN", "delhi": "IN",
  "sydney": "AU", "melbourne": "AU",
  "toronto": "CA", "vancouver": "CA",
  "barcelona": "ES", "madrid": "ES",
  "milan": "IT", "milano": "IT", "rome": "IT",
  "amsterdam": "NL", "rotterdam": "NL",
};

function normalizeToCountryCode(location: string): string | null {
  const lower = location.toLowerCase();
  if (COUNTRY_NORMALIZE[lower]) return COUNTRY_NORMALIZE[lower];
  if (CITY_TO_COUNTRY[lower]) return CITY_TO_COUNTRY[lower];
  return null;
}

function checkMultiCountryPresence(footerLocations: string[], bodyText: string): boolean {
  // Count unique countries from footer locations
  const uniqueCountries = new Set<string>();
  for (const loc of footerLocations) {
    const code = normalizeToCountryCode(loc);
    if (code) uniqueCountries.add(code);
  }
  if (uniqueCountries.size >= 2) return true;

  // Check body text for country mentions
  const bodyCountries = new Set<string>();
  for (const [name, code] of Object.entries(COUNTRY_NORMALIZE)) {
    if (bodyText.includes(name.toLowerCase())) {
      bodyCountries.add(code);
      if (bodyCountries.size >= 2) return true;
    }
  }
  return false;
}

// 2i. About Page Summary (Async — called externally)
export async function fetchAboutPageSummary(
  baseUrl: string,
  internalLinks: LinkInfo[]
): Promise<string | null> {
  // Priority about paths
  const aboutPaths = [
    "/about-us", "/about", "/hakkimizda", "/kurumsal",
    "/hakkinda", "/biz-kimiz", "/company", "/who-we-are",
  ];

  // 1. Try to find about page from internal links
  let aboutUrl: string | null = null;

  // Check link hrefs against known paths
  for (const path of aboutPaths) {
    const found = internalLinks.find(l => {
      try {
        const u = new URL(l.href, baseUrl);
        return u.pathname.toLowerCase().replace(/\/$/, "") === path;
      } catch {
        return l.href.toLowerCase().includes(path);
      }
    });
    if (found) {
      try {
        aboutUrl = new URL(found.href, baseUrl).href;
      } catch {
        aboutUrl = found.href.startsWith("http") ? found.href : `${baseUrl.replace(/\/$/, "")}${found.href}`;
      }
      break;
    }
  }

  // Check link text
  if (!aboutUrl) {
    const aboutTextPatterns = /^(about|about us|hakkımızda|hakkimizda|kurumsal|şirket|company|who we are|biz kimiz)$/i;
    const found = internalLinks.find(l => aboutTextPatterns.test(l.text.trim()));
    if (found) {
      try {
        aboutUrl = new URL(found.href, baseUrl).href;
      } catch {
        aboutUrl = found.href.startsWith("http") ? found.href : `${baseUrl.replace(/\/$/, "")}${found.href}`;
      }
    }
  }

  // Fallback: try common paths directly
  if (!aboutUrl) {
    for (const path of aboutPaths.slice(0, 4)) {
      const testUrl = `${baseUrl.replace(/\/$/, "")}${path}`;
      try {
        const res = await fetch(testUrl, {
          method: "HEAD",
          headers: { "User-Agent": ABOUT_USER_AGENT },
          signal: AbortSignal.timeout(4000),
          redirect: "follow",
        });
        if (res.ok) {
          aboutUrl = testUrl;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!aboutUrl) return null;

  // Fetch about page
  try {
    const res = await fetch(aboutUrl, {
      headers: { "User-Agent": ABOUT_USER_AGENT },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $about = cheerio.load(html);

    // Extract text from main content area
    let text = "";
    const contentSelectors = ["main", "article", ".content", "[class*='about']", "[class*='hakkimizda']", "[class*='kurumsal']"];
    for (const sel of contentSelectors) {
      const el = $about(sel).first();
      if (el.length > 0) {
        text = el.text().trim().replace(/\s+/g, " ");
        break;
      }
    }
    if (!text) {
      text = $about("body").text().trim().replace(/\s+/g, " ");
    }

    if (!text || text.length < 30) return null;

    // Truncate at 500 chars on sentence boundary
    if (text.length > 500) {
      const truncated = text.substring(0, 500);
      const lastPeriod = truncated.lastIndexOf(".");
      const lastExcl = truncated.lastIndexOf("!");
      const lastQ = truncated.lastIndexOf("?");
      const boundary = Math.max(lastPeriod, lastExcl, lastQ);
      text = boundary > 200 ? truncated.substring(0, boundary + 1) : truncated + "...";
    }

    return text;
  } catch {
    return null;
  }
}
