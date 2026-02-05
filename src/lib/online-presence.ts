import type {
  CrawlResult,
  GoogleIndexResult,
  SocialProfileVerification,
  SocialPresenceResult,
  WebmasterVerification,
  WaybackHistory,
  StructuredDataCompleteness,
  OnlinePresenceResult,
} from "./types";

// ── 1. Google Index Check (Serper API) ──
export async function checkGoogleIndex(
  domain: string,
  brandName: string
): Promise<GoogleIndexResult> {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    return {
      isIndexed: false,
      indexedPageCount: 0,
      hasRichSnippet: false,
      serpAppearance: null,
      brandMentions: 0,
      noData: true,
    };
  }

  try {
    // site: sorgusu ile indexli sayfa kontrolü
    const [siteRes, brandRes] = await Promise.all([
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: `site:${domain}`, num: 10 }),
        signal: AbortSignal.timeout(10000),
      }),
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: `"${brandName}" -site:${domain}`,
          num: 10,
        }),
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    const siteData = await siteRes.json();
    const brandData = await brandRes.json();

    const organic = siteData.organic || [];
    const indexedPageCount = siteData.searchInformation?.totalResults
      ? parseInt(siteData.searchInformation.totalResults, 10)
      : organic.length;

    const hasRichSnippet =
      !!siteData.answerBox ||
      !!siteData.knowledgeGraph ||
      (organic.length > 0 && organic.some((r: Record<string, unknown>) => r.sitelinks));

    const serpAppearance =
      organic.length > 0
        ? `${organic[0].title || ""} — ${organic[0].snippet || ""}`.substring(0, 200)
        : null;

    const brandOrganic = brandData.organic || [];
    const brandMentions = brandData.searchInformation?.totalResults
      ? Math.min(parseInt(brandData.searchInformation.totalResults, 10), 9999)
      : brandOrganic.length;

    return {
      isIndexed: organic.length > 0,
      indexedPageCount,
      hasRichSnippet,
      serpAppearance,
      brandMentions,
    };
  } catch (err) {
    console.error("Serper API error:", err);
    return {
      isIndexed: false,
      indexedPageCount: 0,
      hasRichSnippet: false,
      serpAppearance: null,
      brandMentions: 0,
      noData: true,
    };
  }
}

// ── 2. Wayback Machine History (CDX API) ──
export async function checkWaybackHistory(
  domain: string
): Promise<WaybackHistory> {
  try {
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&fl=timestamp&limit=5000&collapse=timestamp:8`;
    const res = await fetch(cdxUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "LaunchPilotBot/1.0" },
    });

    if (!res.ok) {
      return { firstSnapshot: null, lastSnapshot: null, snapshotCount: 0, websiteAge: null };
    }

    const data = await res.json();

    // İlk satır header: ["timestamp"]
    if (!Array.isArray(data) || data.length <= 1) {
      return { firstSnapshot: null, lastSnapshot: null, snapshotCount: 0, websiteAge: null };
    }

    const timestamps = data.slice(1).map((row: string[]) => row[0]);
    const snapshotCount = timestamps.length;

    const parseWaybackDate = (ts: string): string => {
      // Format: 20050101120000
      const y = ts.substring(0, 4);
      const m = ts.substring(4, 6);
      const d = ts.substring(6, 8);
      return `${y}-${m}-${d}`;
    };

    const firstSnapshot = parseWaybackDate(timestamps[0]);
    const lastSnapshot = parseWaybackDate(timestamps[timestamps.length - 1]);

    const firstDate = new Date(firstSnapshot);
    const now = new Date();
    const websiteAge = Math.round(
      (now.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000) * 10
    ) / 10;

    return { firstSnapshot, lastSnapshot, snapshotCount, websiteAge };
  } catch (err) {
    console.error("Wayback CDX error:", err);
    return { firstSnapshot: null, lastSnapshot: null, snapshotCount: 0, websiteAge: null };
  }
}

// ── 3. Social Profile Verification (HEAD requests) ──
export async function verifySocialProfiles(
  socialLinks: { platform: string; url: string }[]
): Promise<SocialPresenceResult> {
  if (socialLinks.length === 0) {
    return { profiles: [], totalVerified: 0, totalInvalid: 0 };
  }

  const profiles: SocialProfileVerification[] = [];
  const batchSize = 5;

  for (let i = 0; i < socialLinks.length; i += batchSize) {
    const batch = socialLinks.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (link) => {
        let accessible = false;
        try {
          const res = await fetch(link.url, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(5000),
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });
          accessible = res.ok;
        } catch {
          // HEAD başarısızsa GET dene
          try {
            const res = await fetch(link.url, {
              method: "GET",
              redirect: "follow",
              signal: AbortSignal.timeout(5000),
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              },
            });
            accessible = res.ok;
          } catch {
            accessible = false;
          }
        }
        return { platform: link.platform, url: link.url, accessible };
      })
    );
    profiles.push(...results);
  }

  const totalVerified = profiles.filter((p) => p.accessible).length;
  const totalInvalid = profiles.filter((p) => !p.accessible).length;

  return { profiles, totalVerified, totalInvalid };
}

// ── 4. Webmaster Verification Tags (HTML Parse) ──
export function checkWebmasterTags(rawHtml: string): WebmasterVerification {
  const htmlLower = rawHtml.toLowerCase();

  // Google: <meta name="google-site-verification" content="...">
  const google = htmlLower.includes("google-site-verification");

  // Bing: <meta name="msvalidate.01" content="...">
  const bing = htmlLower.includes("msvalidate.01");

  // Yandex: <meta name="yandex-verification" content="...">
  const yandex = htmlLower.includes("yandex-verification");

  return { google, bing, yandex };
}

// ── 5. Structured Data Completeness ──
export function checkStructuredDataCompleteness(
  crawl: CrawlResult
): StructuredDataCompleteness {
  const schemaTypes = crawl.technical.schemaTypes || [];
  const schemaComplete = crawl.technical.hasSchemaOrg && schemaTypes.length > 0;

  // OG tags kontrolü
  const og = crawl.metaSEO.ogTags;
  const ogComplete = !!(og["og:title"] && og["og:description"] && og["og:image"]);

  // Twitter Card kontrolü
  const tw = crawl.metaSEO.twitterTags;
  const twitterCardComplete = !!(tw["twitter:card"] && tw["twitter:title"]);

  return { schemaTypes, schemaComplete, ogComplete, twitterCardComplete };
}

// ── Ana Fonksiyon ──
export async function analyzeOnlinePresence(
  domain: string,
  brandName: string,
  crawl: CrawlResult,
  socialLinks: { platform: string; url: string }[],
  rawHtml: string,
  googleIndex: GoogleIndexResult,
  waybackHistory: WaybackHistory
): Promise<OnlinePresenceResult> {
  // Social profiles + webmaster tags + structured data (Phase 2 — crawl sonrası)
  const [socialPresence] = await Promise.all([
    verifySocialProfiles(socialLinks),
  ]);

  const webmasterTags = checkWebmasterTags(rawHtml);
  const structuredData = checkStructuredDataCompleteness(crawl);

  return {
    googleIndex,
    socialPresence,
    webmasterTags,
    waybackHistory,
    structuredData,
  };
}
