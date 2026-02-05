import type { CheerioAPI } from "cheerio";
import type { TechDetection } from "./types";

interface DetectionRule {
  platform: string;
  checks: ((
    $: CheerioAPI,
    html: string,
    url: string
  ) => string | null)[];
}

const rules: DetectionRule[] = [
  {
    platform: "WordPress",
    checks: [
      ($) => {
        const gen = $('meta[name="generator"]').attr("content");
        return gen?.toLowerCase().includes("wordpress") ? "meta generator: WordPress" : null;
      },
      (_, html) =>
        html.includes("/wp-content/") ? "wp-content directory detected" : null,
      (_, html) =>
        html.includes("/wp-includes/") ? "wp-includes directory detected" : null,
      ($) =>
        $('link[href*="wp-content"]').length > 0
          ? "stylesheet from wp-content"
          : null,
      (_, html) =>
        html.includes("wp-json") ? "wp-json REST API reference" : null,
    ],
  },
  {
    platform: "Shopify",
    checks: [
      (_, html) =>
        html.includes("cdn.shopify.com") ? "Shopify CDN detected" : null,
      (_, html) =>
        html.includes("Shopify.theme") ? "Shopify.theme JS object" : null,
      ($) => {
        const gen = $('meta[name="generator"]').attr("content");
        return gen?.toLowerCase().includes("shopify")
          ? "meta generator: Shopify"
          : null;
      },
      (_, html) =>
        html.includes("/shopify_") ? "Shopify asset reference" : null,
    ],
  },
  {
    platform: "Wix",
    checks: [
      (_, html) =>
        html.includes("static.wixstatic.com") ? "Wix static CDN" : null,
      ($) => {
        const gen = $('meta[name="generator"]').attr("content");
        return gen?.toLowerCase().includes("wix") ? "meta generator: Wix" : null;
      },
      (_, html) =>
        html.includes("wix-code-sdk") ? "Wix code SDK" : null,
      (_, html) =>
        html.includes("X-Wix-") ? "Wix header reference" : null,
    ],
  },
  {
    platform: "Squarespace",
    checks: [
      (_, html) =>
        html.includes("squarespace.com") ? "Squarespace reference" : null,
      ($) => {
        const gen = $('meta[name="generator"]').attr("content");
        return gen?.toLowerCase().includes("squarespace")
          ? "meta generator: Squarespace"
          : null;
      },
      (_, html) =>
        html.includes("static1.squarespace.com")
          ? "Squarespace static CDN"
          : null,
    ],
  },
  {
    platform: "Webflow",
    checks: [
      ($) => {
        const gen = $('meta[name="generator"]').attr("content");
        return gen?.toLowerCase().includes("webflow")
          ? "meta generator: Webflow"
          : null;
      },
      (_, html) =>
        html.includes("webflow.com") ? "Webflow reference" : null,
      (_, html) =>
        html.includes("w-nav") && html.includes("w-container")
          ? "Webflow CSS classes"
          : null,
    ],
  },
  {
    platform: "Joomla",
    checks: [
      ($) => {
        const gen = $('meta[name="generator"]').attr("content");
        return gen?.toLowerCase().includes("joomla")
          ? "meta generator: Joomla"
          : null;
      },
      (_, html) =>
        html.includes("/media/jui/") ? "Joomla UI assets" : null,
      (_, html) =>
        html.includes("/components/com_") ? "Joomla component path" : null,
    ],
  },
  {
    platform: "Drupal",
    checks: [
      ($) => {
        const gen = $('meta[name="generator"]').attr("content");
        return gen?.toLowerCase().includes("drupal")
          ? "meta generator: Drupal"
          : null;
      },
      (_, html) =>
        html.includes("Drupal.settings") ? "Drupal.settings JS object" : null,
      (_, html) =>
        html.includes("/sites/default/files/")
          ? "Drupal default files path"
          : null,
    ],
  },
  {
    platform: "Next.js",
    checks: [
      (_, html) =>
        html.includes("__NEXT_DATA__") ? "__NEXT_DATA__ script tag" : null,
      (_, html) =>
        html.includes("/_next/") ? "Next.js asset path" : null,
    ],
  },
  {
    platform: "Gatsby",
    checks: [
      (_, html) =>
        html.includes("___gatsby") ? "Gatsby root element" : null,
      ($) => {
        const gen = $('meta[name="generator"]').attr("content");
        return gen?.toLowerCase().includes("gatsby")
          ? "meta generator: Gatsby"
          : null;
      },
    ],
  },
];

export async function detectTechnology(
  $: CheerioAPI,
  html: string,
  url: string
): Promise<TechDetection> {
  let bestPlatform: string | null = null;
  let bestConfidence = 0;
  let bestSignals: string[] = [];

  for (const rule of rules) {
    const signals: string[] = [];
    for (const check of rule.checks) {
      const signal = check($, html, url);
      if (signal) signals.push(signal);
    }

    if (signals.length > 0) {
      const confidence = Math.min(
        Math.round((signals.length / rule.checks.length) * 100),
        100
      );
      if (confidence > bestConfidence) {
        bestPlatform = rule.platform;
        bestConfidence = confidence;
        bestSignals = signals;
      }
    }
  }

  return {
    platform: bestPlatform,
    confidence: bestConfidence,
    signals: bestSignals,
  };
}
