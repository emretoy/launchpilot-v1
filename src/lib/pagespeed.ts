import type { PageSpeedResult } from "./types";

const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export async function getPageSpeedResults(
  url: string
): Promise<PageSpeedResult> {
  try {
    const key = process.env.GOOGLE_API_KEY;
    const apiUrl = `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo${key ? `&key=${key}` : ""}`;

    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(60000), // PageSpeed can be slow
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        scores: {
          performance: null,
          accessibility: null,
          bestPractices: null,
          seo: null,
        },
        webVitals: {
          lcp: null,
          fid: null,
          cls: null,
          inp: null,
          ttfb: null,
        },
        error: `PageSpeed API error: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }

    const data = await response.json();
    const categories = data.lighthouseResult?.categories || {};
    const audits = data.lighthouseResult?.audits || {};

    // Extract scores (0-100)
    const scores = {
      performance: categories.performance?.score != null
        ? Math.round(categories.performance.score * 100)
        : null,
      accessibility: categories.accessibility?.score != null
        ? Math.round(categories.accessibility.score * 100)
        : null,
      bestPractices: categories["best-practices"]?.score != null
        ? Math.round(categories["best-practices"].score * 100)
        : null,
      seo: categories.seo?.score != null
        ? Math.round(categories.seo.score * 100)
        : null,
    };

    // Extract Core Web Vitals
    const webVitals = {
      lcp: audits["largest-contentful-paint"]?.numericValue
        ? Math.round(audits["largest-contentful-paint"].numericValue)
        : null,
      fid: audits["max-potential-fid"]?.numericValue
        ? Math.round(audits["max-potential-fid"].numericValue)
        : null,
      cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
      inp: audits["interaction-to-next-paint"]?.numericValue
        ? Math.round(audits["interaction-to-next-paint"].numericValue)
        : null,
      ttfb: audits["server-response-time"]?.numericValue
        ? Math.round(audits["server-response-time"].numericValue)
        : null,
    };

    return { scores, webVitals, error: null };
  } catch (err) {
    return {
      scores: {
        performance: null,
        accessibility: null,
        bestPractices: null,
        seo: null,
      },
      webVitals: {
        lcp: null,
        fid: null,
        cls: null,
        inp: null,
        ttfb: null,
      },
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
