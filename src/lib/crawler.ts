import * as cheerio from "cheerio";
import type {
  BasicInfo,
  HeadingStructure,
  HeadingInfo,
  MetaSEO,
  ContentStats,
  LinksAnalysis,
  LinkInfo,
  ImagesAnalysis,
  ImageInfo,
  TechnicalInfo,
  SecurityInfo,
  CrawlResult,
} from "./types";
import { detectTechnology } from "./tech-detector";
import { checkLinks } from "./link-checker";

const USER_AGENT =
  "Mozilla/5.0 (compatible; LaunchPilotBot/1.0; +https://launchpilot.dev)";

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function extractBasicInfo($: cheerio.CheerioAPI, url: string, finalUrl: string): BasicInfo {
  const title = $("title").first().text().trim() || "";
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || "";
  const favicon =
    $('link[rel="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    null;
  const language = $("html").attr("lang") || null;
  const charset =
    $('meta[charset]').attr("charset") ||
    $('meta[http-equiv="Content-Type"]').attr("content")?.match(/charset=([^\s;]+)/)?.[1] ||
    null;

  return {
    url,
    finalUrl,
    title,
    metaDescription,
    favicon: favicon ? resolveUrl(finalUrl, favicon) : null,
    language,
    charset,
  };
}

function extractHeadings($: cheerio.CheerioAPI): HeadingStructure {
  const extract = (tag: string): HeadingInfo[] => {
    const items: HeadingInfo[] = [];
    $(tag).each((_, el) => {
      items.push({ tag, text: $(el).text().trim() });
    });
    return items;
  };

  const h1 = extract("h1");
  const h2 = extract("h2");
  const h3 = extract("h3");

  return {
    h1,
    h2,
    h3,
    totalH1: h1.length,
    totalH2: h2.length,
    totalH3: h3.length,
  };
}

function extractMetaSEO($: cheerio.CheerioAPI): MetaSEO {
  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const robots = $('meta[name="robots"]').attr("content") || null;
  const viewport = $('meta[name="viewport"]').attr("content") || null;

  const ogTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property");
    const content = $(el).attr("content");
    if (prop && content) ogTags[prop] = content;
  });

  const twitterTags: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr("name");
    const content = $(el).attr("content");
    if (name && content) twitterTags[name] = content;
  });

  const hreflang: { lang: string; href: string }[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr("hreflang");
    const href = $(el).attr("href");
    if (lang && href) hreflang.push({ lang, href });
  });

  return { canonical, robots, ogTags, twitterTags, hreflang, viewport };
}

function extractContentStats($: cheerio.CheerioAPI, html: string): ContentStats {
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const words = bodyText.split(/\s+/).filter((w) => w.length > 0);
  const paragraphs = $("p").length;

  const textLength = bodyText.length;
  const htmlLength = html.length;
  const ratio = htmlLength > 0 ? Math.round((textLength / htmlLength) * 100) : 0;

  return {
    wordCount: words.length,
    paragraphCount: paragraphs,
    contentToCodeRatio: ratio,
  };
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string): Omit<LinksAnalysis, "broken" | "totalBroken"> & { allLinks: LinkInfo[] } {
  const internal: LinkInfo[] = [];
  const external: LinkInfo[] = [];
  const allLinks: LinkInfo[] = [];
  const baseHost = new URL(baseUrl).hostname;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

    const resolved = resolveUrl(baseUrl, href);
    const text = $(el).text().trim().substring(0, 100);
    const link: LinkInfo = { href: resolved, text, isExternal: false };

    try {
      const linkHost = new URL(resolved).hostname;
      if (linkHost === baseHost) {
        link.isExternal = false;
        internal.push(link);
      } else {
        link.isExternal = true;
        external.push(link);
      }
    } catch {
      internal.push(link);
    }

    allLinks.push(link);
  });

  return {
    internal,
    external,
    totalInternal: internal.length,
    totalExternal: external.length,
    allLinks,
  };
}

function extractImages($: cheerio.CheerioAPI, baseUrl: string): ImagesAnalysis {
  const images: ImageInfo[] = [];
  const missingAlt: ImageInfo[] = [];

  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;

    const img: ImageInfo = {
      src: resolveUrl(baseUrl, src),
      alt: $(el).attr("alt") ?? null,
      width: $(el).attr("width") || null,
      height: $(el).attr("height") || null,
    };

    images.push(img);
    if (!img.alt && img.alt !== "") {
      missingAlt.push(img);
    } else if (img.alt !== null && img.alt.trim() === "") {
      // decorative images with alt="" are acceptable, skip
    } else if (img.alt === null) {
      missingAlt.push(img);
    }
  });

  return {
    total: images.length,
    missingAlt,
    totalMissingAlt: missingAlt.length,
    images: images.slice(0, 50), // limit to first 50
  };
}

async function extractTechnical($: cheerio.CheerioAPI, baseUrl: string): Promise<TechnicalInfo> {
  // Schema.org / JSON-LD
  let hasSchemaOrg = false;
  const schemaTypes: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    hasSchemaOrg = true;
    try {
      const json = JSON.parse($(el).html() || "");
      if (json["@type"]) schemaTypes.push(json["@type"]);
      if (Array.isArray(json["@graph"])) {
        json["@graph"].forEach((item: { "@type"?: string }) => {
          if (item["@type"]) schemaTypes.push(item["@type"]);
        });
      }
    } catch {
      // invalid JSON-LD, skip
    }
  });

  // Also check for microdata
  if ($("[itemtype]").length > 0) {
    hasSchemaOrg = true;
  }

  // Robots.txt
  let hasRobotsTxt = false;
  let robotsTxtContent: string | null = null;
  try {
    const origin = new URL(baseUrl).origin;
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes("<!DOCTYPE") && !text.includes("<html")) {
        hasRobotsTxt = true;
        robotsTxtContent = text.substring(0, 2000);
      }
    }
  } catch {
    // not available
  }

  // Sitemap
  let hasSitemap = false;
  let sitemapUrl: string | null = null;
  let sitemapPageCount: number | null = null;

  // Check robots.txt for sitemap
  if (robotsTxtContent) {
    const sitemapMatch = robotsTxtContent.match(/Sitemap:\s*(.+)/i);
    if (sitemapMatch) {
      sitemapUrl = sitemapMatch[1].trim();
    }
  }

  // Fallback: check common sitemap locations
  if (!sitemapUrl) {
    const origin = new URL(baseUrl).origin;
    sitemapUrl = `${origin}/sitemap.xml`;
  }

  try {
    const res = await fetch(sitemapUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text.includes("<urlset") || text.includes("<sitemapindex")) {
        hasSitemap = true;
        const urlMatches = text.match(/<loc>/g);
        sitemapPageCount = urlMatches ? urlMatches.length : 0;
      } else {
        sitemapUrl = null;
      }
    } else {
      sitemapUrl = null;
    }
  } catch {
    sitemapUrl = null;
  }

  return {
    hasSchemaOrg,
    schemaTypes,
    hasSitemap,
    sitemapUrl: hasSitemap ? sitemapUrl : null,
    sitemapPageCount,
    hasRobotsTxt,
    robotsTxtContent,
  };
}

function extractSecurity($: cheerio.CheerioAPI, finalUrl: string): SecurityInfo {
  const isHttps = finalUrl.startsWith("https://");
  const mixedContentUrls: string[] = [];

  if (isHttps) {
    // Check for mixed content: http:// resources on an https page
    const checkMixed = (attr: string, selector: string) => {
      $(selector).each((_, el) => {
        const val = $(el).attr(attr);
        if (val && val.startsWith("http://")) {
          mixedContentUrls.push(val);
        }
      });
    };

    checkMixed("src", "script[src]");
    checkMixed("src", "img[src]");
    checkMixed("href", 'link[rel="stylesheet"]');
    checkMixed("src", "iframe[src]");
  }

  return {
    isHttps,
    hasMixedContent: mixedContentUrls.length > 0,
    mixedContentUrls: mixedContentUrls.slice(0, 20),
  };
}

export async function crawlSite(url: string): Promise<{ result: CrawlResult; rawHtml: string }> {
  // Fetch the page
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const finalUrl = response.url;
  const $ = cheerio.load(html);

  // Run extractions
  const basicInfo = extractBasicInfo($, url, finalUrl);
  const headings = extractHeadings($);
  const metaSEO = extractMetaSEO($);
  const content = extractContentStats($, html);
  const { internal, external, totalInternal, totalExternal, allLinks } = extractLinks($, finalUrl);
  const images = extractImages($, finalUrl);
  const security = extractSecurity($, finalUrl);

  // These can run in parallel
  const [technical, techDetection, brokenLinks] = await Promise.all([
    extractTechnical($, finalUrl),
    detectTechnology($, html, finalUrl),
    checkLinks(allLinks.slice(0, 50)), // limit broken link checks
  ]);

  const links: LinksAnalysis = {
    internal,
    external,
    broken: brokenLinks,
    totalInternal,
    totalExternal,
    totalBroken: brokenLinks.length,
  };

  return {
    result: {
      basicInfo,
      headings,
      metaSEO,
      content,
      links,
      images,
      technical,
      techDetection,
      security,
    },
    rawHtml: html,
  };
}
