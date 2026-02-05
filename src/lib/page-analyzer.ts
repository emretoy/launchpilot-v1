import * as cheerio from "cheerio";
import type { PageAnalysis } from "./types";

export function analyzePage($: cheerio.CheerioAPI, html: string): PageAnalysis {
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
  };
}
